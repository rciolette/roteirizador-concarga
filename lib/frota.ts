import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { tipoVeiculoFromSiat } from '@/lib/siat'
import type { Veiculo, Motorista } from '@/types'

export interface MotoristaDaFrota {
  id: string
  codigo_siat: string | null
  nome: string
  sigla: string
  telefone: string
  celular: string
  ativo: boolean
}

export interface VeiculoDaFrota {
  id: string
  placa: string
  modelo: string
  categoria: string
  tipo_veiculo: string
  tipo_carroceria: string
  capacidade_kg: number
  pbt: number | null
  volume_m3: number | null
  situacao_siat: string
  motorista_id: string | null
  motorista_nome: string | null
  ativo: boolean
  disponivel_hoje: boolean
  disponibilidade_origem: 'siat_sugerido' | 'operador' | null
}

export interface VinculadoDaFrota {
  id: string
  placa: string
  modelo: string
  capacidade_kg: number
  situacao_siat: string
  motorista_nome: string | null
  motorista_celular: string | null
  motorista_sigla: string | null
}

export interface CapacidadeVeiculo {
  tipo: string
  capacidade_kg: number
  ocupacao_max_percent: number
}

const PAGE = 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllPages<T>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  const result: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE - 1)
    if (error) throw error
    result.push(...((data ?? []) as T[]))
    if ((data ?? []).length < PAGE) break
    from += PAGE
  }
  return result
}

export async function listarMotoristas(): Promise<MotoristaDaFrota[]> {
  const sb = getSupabaseBrowser()
  const rows = await fetchAllPages<Record<string, unknown>>(
    (from, to) => sb
      .from('motoristas')
      .select('*')
      .order('nome', { ascending: true })
      .range(from, to),
  )

  return rows.map(row => ({
    id:          row.id as string,
    codigo_siat: (row.codigo_siat as string | null) ?? null,
    nome:        row.nome as string,
    sigla:       (row.sigla    as string | null) ?? '',
    telefone:    (row.telefone as string | null) ?? '',
    celular:     (row.celular  as string | null) ?? '',
    ativo:       (row.ativo    as boolean | null) ?? true,
  }))
}

export async function listarVeiculos(): Promise<VeiculoDaFrota[]> {
  const sb = getSupabaseBrowser()
  const hoje = new Date().toISOString().slice(0, 10)

  const [rows, dispResult] = await Promise.all([
    fetchAllPages<Record<string, unknown>>(
      (from, to) => sb
        .from('veiculos')
        .select('*, motoristas(nome, celular, sigla)')
        .order('placa', { ascending: true })
        .range(from, to),
    ),
    sb.from('veiculo_disponibilidade')
      .select('veiculo_id, disponivel, origem')
      .eq('data', hoje),
  ])

  const dispMap = new Map<string, { disponivel: boolean; origem: 'siat_sugerido' | 'operador' }>()
  for (const d of dispResult.data ?? []) {
    dispMap.set(d.veiculo_id as string, {
      disponivel: d.disponivel as boolean,
      origem: d.origem as 'siat_sugerido' | 'operador',
    })
  }

  return rows.map(row => {
    const disp = dispMap.get(row.id as string)
    return {
      id:                     row.id as string,
      placa:                  row.placa as string,
      modelo:                 (row.modelo          as string | null) ?? '',
      categoria:              (row.categoria       as string | null) ?? '',
      tipo_veiculo:           (row.tipo_veiculo    as string | null) ?? '',
      tipo_carroceria:        (row.tipo_carroceria as string | null) ?? '',
      capacidade_kg:          parseFloat(String(row.capacidade_kg ?? '0')) || 0,
      pbt:                    row.pbt      != null ? parseFloat(String(row.pbt))      : null,
      volume_m3:              row.volume_m3 != null ? parseFloat(String(row.volume_m3)) : null,
      situacao_siat:          (row.situacao_siat   as string | null) ?? '',
      motorista_id:           (row.motorista_id    as string | null) ?? null,
      motorista_nome:         (row.motoristas as { nome?: string } | null)?.nome ?? null,
      ativo:                  (row.ativo           as boolean | null) ?? true,
      disponivel_hoje:        disp?.disponivel ?? false,
      disponibilidade_origem: disp?.origem ?? null,
    }
  })
}

export async function listarVinculados(): Promise<VinculadoDaFrota[]> {
  const sb = getSupabaseBrowser()
  const rows = await fetchAllPages<Record<string, unknown>>(
    (from, to) => sb
      .from('veiculos')
      .select('*, motoristas(nome, celular, sigla)')
      .eq('ativo', true)
      .not('motorista_id', 'is', null)
      .order('placa', { ascending: true })
      .range(from, to),
  )

  return rows.map(row => {
    const m = row.motoristas as { nome?: string; celular?: string; sigla?: string } | null
    return {
      id:                row.id as string,
      placa:             row.placa as string,
      modelo:            (row.modelo       as string | null) ?? '',
      capacidade_kg:     (row.capacidade_kg as number | null) ?? 0,
      situacao_siat:     (row.situacao_siat as string | null) ?? '',
      motorista_nome:    m?.nome    ?? null,
      motorista_celular: m?.celular ?? null,
      motorista_sigla:   m?.sigla   ?? null,
    }
  })
}

export async function listarCapacidades(): Promise<CapacidadeVeiculo[]> {
  const sb = getSupabaseBrowser()
  const { data, error } = await sb
    .from('veiculo_capacidades')
    .select('tipo, capacidade_kg, ocupacao_max_percent')
    .order('capacidade_kg', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    tipo:                 row.tipo as string,
    capacidade_kg:        Number(row.capacidade_kg),
    ocupacao_max_percent: Number(row.ocupacao_max_percent),
  }))
}

export async function atualizarCapacidade(tipo: string, capacidade_kg: number, ocupacao_max_percent: number): Promise<void> {
  const { error } = await getSupabaseBrowser()
    .from('veiculo_capacidades')
    .update({ capacidade_kg, ocupacao_max_percent })
    .eq('tipo', tipo)
  if (error) throw error
}

export function veiculoDaFrotaToVeiculo(v: VeiculoDaFrota): Veiculo {
  const sit = (v.situacao_siat ?? '').toUpperCase()
  const status: Veiculo['status'] =
    !v.ativo              ? 'indisponivel' :
    sit.includes('MANUT') ? 'manutencao'   :
    v.disponivel_hoje     ? 'disponivel'   :
    sit.includes('DISPON') ? 'disponivel'  :
    'indisponivel'
  return {
    id:              v.id,
    placa:           v.placa,
    modelo:          v.modelo,
    tipo:            tipoVeiculoFromSiat(v.tipo_veiculo),
    capacidadeKg:    v.capacidade_kg,
    volumeCubado:    v.volume_m3 ?? undefined,
    sigla:           v.placa,
    status,
    disponivel_hoje: v.disponivel_hoje,
    motoristaNome:   v.motorista_nome ?? undefined,
  }
}

export function motoristaDaFrotaToMotorista(m: MotoristaDaFrota): Motorista {
  return {
    id:        m.id,
    nome:      m.nome,
    telefone:  m.celular || m.telefone,
    sigla:     m.sigla,
    status:    m.ativo ? 'disponivel' : 'ausente',
    codigoSiat: m.codigo_siat ?? undefined,
  }
}

export async function atualizarAtivoMotorista(id: string, ativo: boolean): Promise<void> {
  const { error } = await getSupabaseBrowser().from('motoristas').update({ ativo }).eq('id', id)
  if (error) throw error
}

export async function atualizarAtivoVeiculo(id: string, ativo: boolean): Promise<void> {
  const { error } = await getSupabaseBrowser().from('veiculos').update({ ativo }).eq('id', id)
  if (error) throw error
}

// Grava em veiculo_disponibilidade (fonte de verdade) e sincroniza cache em veiculos.
export async function atualizarDisponivelHoje(id: string, disponivel: boolean): Promise<void> {
  const sb = getSupabaseBrowser()
  const hoje = new Date().toISOString().slice(0, 10)

  if (disponivel) {
    const { error } = await sb.from('veiculo_disponibilidade').upsert(
      { veiculo_id: id, data: hoje, disponivel: true, origem: 'operador', confirmado_em: new Date().toISOString() },
      { onConflict: 'veiculo_id,data' },
    )
    if (error) throw error
  } else {
    const { error } = await sb.from('veiculo_disponibilidade')
      .delete()
      .eq('veiculo_id', id)
      .eq('data', hoje)
    if (error) throw error
  }

  // Atualiza cache denormalizado
  const { error: cacheErr } = await sb.from('veiculos')
    .update({ disponivel_hoje: disponivel, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (cacheErr) throw cacheErr
}

// Apaga todos os registros de veiculo_disponibilidade de hoje e reseta o cache.
export async function resetarDisponivelHoje(): Promise<void> {
  const sb = getSupabaseBrowser()
  const hoje = new Date().toISOString().slice(0, 10)

  const { error: err1 } = await sb.from('veiculo_disponibilidade').delete().eq('data', hoje)
  if (err1) throw err1

  const { error: err2 } = await sb.from('veiculos').update({ disponivel_hoje: false }).not('id', 'is', null)
  if (err2) throw err2
}

export async function marcarDisponiveisHoje(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const sb = getSupabaseBrowser()
  const hoje = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()

  const payload = ids.map(id => ({
    veiculo_id: id, data: hoje, disponivel: true, origem: 'operador' as const, confirmado_em: now,
  }))

  const { error: err1 } = await sb.from('veiculo_disponibilidade')
    .upsert(payload, { onConflict: 'veiculo_id,data' })
  if (err1) throw err1

  const { error: err2 } = await sb.from('veiculos').update({ disponivel_hoje: true }).in('id', ids)
  if (err2) throw err2
}

export async function desmarcarDisponiveisHoje(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const sb = getSupabaseBrowser()
  const hoje = new Date().toISOString().slice(0, 10)

  const { error: err1 } = await sb.from('veiculo_disponibilidade')
    .delete()
    .eq('data', hoje)
    .in('veiculo_id', ids)
  if (err1) throw err1

  const { error: err2 } = await sb.from('veiculos').update({ disponivel_hoje: false }).in('id', ids)
  if (err2) throw err2
}

export async function atualizarAtivoBulkMotoristas(ids: string[], ativo: boolean): Promise<void> {
  if (ids.length === 0) return
  const { error } = await getSupabaseBrowser().from('motoristas').update({ ativo }).in('id', ids)
  if (error) throw error
}

export async function atualizarAtivoBulkVeiculos(ids: string[], ativo: boolean): Promise<void> {
  if (ids.length === 0) return
  const { error } = await getSupabaseBrowser().from('veiculos').update({ ativo }).in('id', ids)
  if (error) throw error
}
