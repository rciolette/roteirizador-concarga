import { queryVeiculosDisponiveis } from '@/lib/siat-db'
import { getAdminClient } from '@/lib/auth-server'

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

export async function syncFrotaDoSiat(): Promise<{ motoristas: number; veiculos: number }> {
  const rows = await queryVeiculosDisponiveis()
  const admin = getAdminClient()

  // 1. Coletar motoristas únicos pelo CodMotorista
  const motoristasMap = new Map<string, { nome: string; telefone: string; celular: string }>()
  for (const row of rows) {
    const cod = row.CodMotorista ? String(row.CodMotorista).trim() : null
    if (!cod || motoristasMap.has(cod)) continue
    const nome = row.NomeMotorista ? String(row.NomeMotorista).trim() : cod
    motoristasMap.set(cod, {
      nome,
      telefone: cleanPhone(row.Telefone),
      celular:  cleanPhone(row.Celular),
    })
  }

  // 2. Upsert motoristas em lotes
  const motoristasPayload = Array.from(motoristasMap.entries()).map(([cod, m]) => ({
    codigo_siat: cod,
    nome:        m.nome,
    telefone:    m.telefone,
    celular:     m.celular,
    sigla:       deriveSigla(m.nome),
    ativo:       true,
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

  // 4. Upsert veículos em lotes
  const veiculosPayload = rows
    .filter(r => r.Placa)
    .map(row => {
      const cod = row.CodMotorista ? String(row.CodMotorista).trim() : null
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
        ativo:                 true,
      }
    })

  for (const chunk of chunked(veiculosPayload, 500)) {
    const { error } = await admin
      .from('veiculos')
      .upsert(chunk, { onConflict: 'placa' })
    if (error) throw new Error(`Erro ao sincronizar veículos: ${error.message}`)
  }

  return { motoristas: motoristasPayload.length, veiculos: veiculosPayload.length }
}
