import { supabase } from '@/lib/supabase'
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

const PAGE = 1000

async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => ReturnType<ReturnType<typeof supabase.from>['select']>,
): Promise<T[]> {
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
  const rows = await fetchAllPages<Record<string, unknown>>(
    (from, to) => supabase
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
  const rows = await fetchAllPages<Record<string, unknown>>(
    (from, to) => supabase
      .from('veiculos')
      .select('*, motoristas(nome, celular, sigla)')
      .order('placa', { ascending: true })
      .range(from, to),
  )

  return rows.map(row => ({
    id:              row.id as string,
    placa:           row.placa as string,
    modelo:          (row.modelo          as string | null) ?? '',
    categoria:       (row.categoria       as string | null) ?? '',
    tipo_veiculo:    (row.tipo_veiculo    as string | null) ?? '',
    tipo_carroceria: (row.tipo_carroceria as string | null) ?? '',
    capacidade_kg:   parseFloat(String(row.capacidade_kg ?? '0')) || 0,
    pbt:             row.pbt      != null ? parseFloat(String(row.pbt))      : null,
    volume_m3:       row.volume_m3 != null ? parseFloat(String(row.volume_m3)) : null,
    situacao_siat:   (row.situacao_siat   as string | null) ?? '',
    motorista_id:    (row.motorista_id    as string | null) ?? null,
    motorista_nome:  (row.motoristas as { nome?: string } | null)?.nome ?? null,
    ativo:           (row.ativo           as boolean | null) ?? true,
    disponivel_hoje: (row.disponivel_hoje as boolean | null) ?? false,
  }))
}

export async function listarVinculados(): Promise<VinculadoDaFrota[]> {
  const rows = await fetchAllPages<Record<string, unknown>>(
    (from, to) => supabase
      .from('veiculos')
      .select('*, motoristas(nome, celular, sigla)')
      .eq('ativo', true)
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
  const { error } = await supabase.from('motoristas').update({ ativo }).eq('id', id)
  if (error) throw error
}

export async function atualizarAtivoVeiculo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('veiculos').update({ ativo }).eq('id', id)
  if (error) throw error
}

export async function atualizarDisponivelHoje(id: string, disponivel: boolean): Promise<void> {
  const { error } = await supabase.from('veiculos').update({ disponivel_hoje: disponivel }).eq('id', id)
  if (error) throw error
}

export async function resetarDisponivelHoje(): Promise<void> {
  const { error } = await supabase.from('veiculos').update({ disponivel_hoje: false }).not('id', 'is', null)
  if (error) throw error
}

export async function marcarDisponiveisHoje(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('veiculos').update({ disponivel_hoje: true }).in('id', ids)
  if (error) throw error
}
