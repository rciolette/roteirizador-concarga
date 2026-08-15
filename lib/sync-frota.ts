import { createClient } from '@supabase/supabase-js'
import { queryVeiculosDisponiveis } from '@/lib/siat-db'
import type { SiatRow } from '@/lib/siat'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function deriveSigla(nome: string): string {
  return nome.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase()
}

function cleanPhone(raw: string | null | undefined): string {
  if (!raw) return ''
  const s = raw.trim()
  return s === '-' ? '' : s
}

function chunked<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

// Verifica se a situação SIAT indica veículo disponível (não em manutenção/bloqueado).
function situacaoEhDisponivel(sit: string | null | undefined): boolean {
  if (!sit) return true
  const s = String(sit).toUpperCase()
  return !s.includes('MANUT') && !s.includes('MANUTENÇÃO') &&
         !s.includes('INDISPON') && !s.includes('BLOQ') && !s.includes('INATIV')
}

// Seed da tabela veiculo_disponibilidade com sugestão do SIAT para hoje.
// ignoreDuplicates=true: preserva confirmações feitas pelo operador (origem='operador').
export async function seedDisponibilidadeHoje(
  rows: SiatRow[],
  adminClient?: ReturnType<typeof getAdminSupabase>,
): Promise<number> {
  const admin = adminClient ?? getAdminSupabase()
  const hoje = new Date().toISOString().slice(0, 10)

  const placasDisp = rows
    .filter(r => r.Placa && situacaoEhDisponivel(r.Situacao))
    .map(r => String(r.Placa!).trim().toUpperCase())

  if (placasDisp.length === 0) return 0

  // Buscar IDs dos veículos pelas placas.
  // Em lotes de 500: o PostgREST devolve no máximo 1000 linhas por request e a
  // frota passa de 2.000 — num `.in()` único o resto sumia sem erro, e só metade
  // dos veículos ficava marcada como disponível.
  const placaToId = new Map<string, string>()
  for (const chunk of chunked(placasDisp, 500)) {
    const { data: veics, error } = await admin
      .from('veiculos')
      .select('id, placa')
      .in('placa', chunk)
    if (error) throw new Error(`Seed disponibilidade (busca de placas): ${error.message}`)
    for (const v of veics ?? []) placaToId.set(v.placa as string, v.id as string)
  }

  const payload = placasDisp
    .map(placa => {
      const veiculoId = placaToId.get(placa)
      if (!veiculoId) return null
      return { veiculo_id: veiculoId, data: hoje, disponivel: true, origem: 'siat_sugerido' as const }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (payload.length === 0) return 0

  // ignoreDuplicates preserva registros com origem='operador' já existentes
  for (const chunk of chunked(payload, 500)) {
    const { error } = await admin.from('veiculo_disponibilidade')
      .upsert(chunk, { onConflict: 'veiculo_id,data', ignoreDuplicates: true })
    if (error) throw new Error(`Seed disponibilidade: ${error.message}`)
  }

  // Sincroniza o cache `veiculos.disponivel_hoje` com a disponibilidade do dia.
  // Reconstrói a partir de veiculo_disponibilidade (a fonte de verdade) em vez
  // de só marcar os sugeridos agora: assim as confirmações do operador entram e
  // os veículos que estavam disponíveis ontem deixam de aparecer como do dia.
  const disponiveisHoje: string[] = []
  const PAGINA = 1000
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await admin
      .from('veiculo_disponibilidade')
      .select('veiculo_id')
      .eq('data', hoje)
      .eq('disponivel', true)
      .range(inicio, inicio + PAGINA - 1)
    if (error) throw new Error(`Seed disponibilidade (leitura do dia): ${error.message}`)
    disponiveisHoje.push(...(data ?? []).map(d => d.veiculo_id as string))
    if (!data || data.length < PAGINA) break
  }

  await admin.from('veiculos').update({ disponivel_hoje: false }).not('id', 'is', null)
  for (const chunk of chunked(disponiveisHoje, 500)) {
    await admin.from('veiculos').update({ disponivel_hoje: true }).in('id', chunk)
  }

  return payload.length
}

export async function syncFrotaDoSiat(): Promise<{ motoristas: number; veiculos: number; disponibilidade: number }> {
  const rows = await queryVeiculosDisponiveis()
  const admin = getAdminSupabase()

  // 1. Coletar motoristas únicos pelo CodMotorista
  const motoristasMap = new Map<string, { nome: string; telefone: string; celular: string; tipoCod: string; tipoDesc: string }>()
  for (const row of rows) {
    const cod = row.CodMotorista ? String(row.CodMotorista).trim() : null
    if (!cod || motoristasMap.has(cod)) continue
    const nome = row.NomeMotorista ? String(row.NomeMotorista).trim() : cod
    motoristasMap.set(cod, {
      nome,
      telefone: cleanPhone(row.Telefone),
      celular:  cleanPhone(row.Celular),
      tipoCod:  row.TipoMotoristaCodigo ? String(row.TipoMotoristaCodigo).trim() : '',
      tipoDesc: row.TipoMotoristaDesc   ? String(row.TipoMotoristaDesc).trim()   : '',
    })
  }

  // 2. Upsert motoristas em lotes
  // Pedido do Marcelo (11/08/26, item 1): motorista nasce ativo por padrão
  // quando tipo motorista = 03/TAC ([TAB TIPMOT], campo TIPMOT em
  // [TAB DE MOTORISTAS] — confirmado no SIAT em 14/08/26). Os demais tipos
  // (ou sem tipo) entram inativos e podem ser ativados manualmente na Frota.
  const motoristasPayload = Array.from(motoristasMap.entries()).map(([cod, m]) => ({
    codigo_siat:    cod,
    nome:           m.nome,
    telefone:       m.telefone,
    celular:        m.celular,
    sigla:          deriveSigla(m.nome),
    tipo_motorista: m.tipoCod ? `${m.tipoCod}/${m.tipoDesc || '?'}` : null,
    ativo:          m.tipoCod === '03',
  }))

  for (const chunk of chunked(motoristasPayload, 500)) {
    const { error } = await admin
      .from('motoristas')
      .upsert(chunk, { onConflict: 'codigo_siat' })
    if (error) throw new Error(`Erro ao sincronizar motoristas: ${error.message}`)
  }

  // 3. Buscar IDs dos motoristas inseridos/atualizados
  const motoristaIdMap = new Map<string, string>()
  for (const chunk of chunked(Array.from(motoristasMap.keys()), 500)) {
    const { data, error } = await admin
      .from('motoristas')
      .select('id, codigo_siat')
      .in('codigo_siat', chunk)
    if (error) throw new Error(`Erro ao buscar motoristas: ${error.message}`)
    for (const m of data ?? []) {
      if (m.codigo_siat) motoristaIdMap.set(String(m.codigo_siat), String(m.id))
    }
  }

  // 4. Upsert veículos em lotes (INNER JOIN garante que rows já têm motorista)
  const veiculosPayload = rows
    .filter(r => r.Placa)
    .map(row => {
      const cod = row.CodMotorista ? String(row.CodMotorista).trim() : null
      const tipoFroCod  = row.TipoFrotaCodigo ? String(row.TipoFrotaCodigo).trim() : ''
      const tipoFroDesc = row.TipoFrotaDesc   ? String(row.TipoFrotaDesc).trim()   : ''
      return {
        placa:                 String(row.Placa!).trim().toUpperCase(),
        modelo:                row.Modelo        ? String(row.Modelo)        : null,
        categoria:             row.Categoria     ? String(row.Categoria)     : null,
        tipo_veiculo:          row.TipoVeiculo   ? String(row.TipoVeiculo)   : null,
        tipo_carroceria:       row.TipoCarroceria ? String(row.TipoCarroceria) : null,
        capacidade_kg:         typeof row.CapacidadeKg === 'number' ? row.CapacidadeKg : null,
        pbt:                   typeof row.PBT      === 'number'     ? row.PBT          : null,
        volume_m3:             typeof row.VolumeM3 === 'number'     ? row.VolumeM3     : null,
        situacao_siat:         row.Situacao      ? String(row.Situacao)      : null,
        codigo_siat_motorista: cod,
        motorista_id:          cod ? (motoristaIdMap.get(cod) ?? null) : null,
        // Pedido do Marcelo (11/08/26, item 2): veículo nasce ativo por padrão
        // quando tipo de frota = 005/Disponível ([TAB TIPFRO], campo TIPFRO em
        // [TAB DE VEICULOS] — confirmado no SIAT em 14/08/26). É o código que
        // o Marcelo usa para marcar a frota real do projeto.
        tipo_frota:            tipoFroCod ? `${tipoFroCod}/${tipoFroDesc || '?'}` : null,
        ativo:                 tipoFroCod === '005',
        updated_at:            new Date().toISOString(),
      }
    })

  for (const chunk of chunked(veiculosPayload, 500)) {
    const { error } = await admin
      .from('veiculos')
      .upsert(chunk, { onConflict: 'placa' })
    if (error) throw new Error(`Erro ao sincronizar veículos: ${error.message}`)
  }

  // 5. Seed disponibilidade do dia com sugestão do SIAT
  const disponibilidade = await seedDisponibilidadeHoje(rows, admin)

  return { motoristas: motoristasPayload.length, veiculos: veiculosPayload.length, disponibilidade }
}
