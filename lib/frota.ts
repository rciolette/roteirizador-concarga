import { supabase } from '@/lib/supabase'

export interface MotoristaDaFrota {
  id: string
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
  capacidade_kg: number
  situacao_siat: string
  motorista_id: string | null
  motorista_nome: string | null
  ativo: boolean
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

export async function listarMotoristas(): Promise<MotoristaDaFrota[]> {
  const { data, error } = await supabase
    .from('motoristas')
    .select('*')
    .order('nome', { ascending: true })

  if (error) throw error

  return (data ?? []).map(row => ({
    id:       row.id,
    nome:     row.nome,
    sigla:    row.sigla    ?? '',
    telefone: row.telefone ?? '',
    celular:  row.celular  ?? '',
    ativo:    row.ativo    ?? true,
  }))
}

export async function listarVeiculos(): Promise<VeiculoDaFrota[]> {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*, motoristas(nome, celular, sigla)')
    .order('placa', { ascending: true })

  if (error) throw error

  return (data ?? []).map(row => ({
    id:            row.id,
    placa:         row.placa,
    modelo:        row.modelo       ?? '',
    categoria:     row.categoria    ?? '',
    tipo_veiculo:  row.tipo_veiculo ?? '',
    capacidade_kg: row.capacidade_kg ?? 0,
    situacao_siat: row.situacao_siat ?? '',
    motorista_id:  row.motorista_id  ?? null,
    motorista_nome: (row.motoristas as { nome?: string } | null)?.nome ?? null,
    ativo:         row.ativo ?? true,
  }))
}

export async function listarVinculados(): Promise<VinculadoDaFrota[]> {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*, motoristas(nome, celular, sigla)')
    .eq('ativo', true)
    .order('placa', { ascending: true })

  if (error) throw error

  return (data ?? []).map(row => {
    const m = row.motoristas as { nome?: string; celular?: string; sigla?: string } | null
    return {
      id:               row.id,
      placa:            row.placa,
      modelo:           row.modelo       ?? '',
      capacidade_kg:    row.capacidade_kg ?? 0,
      situacao_siat:    row.situacao_siat ?? '',
      motorista_nome:   m?.nome   ?? null,
      motorista_celular: m?.celular ?? null,
      motorista_sigla:  m?.sigla  ?? null,
    }
  })
}

export async function atualizarAtivoMotorista(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('motoristas').update({ ativo }).eq('id', id)
  if (error) throw error
}

export async function atualizarAtivoVeiculo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('veiculos').update({ ativo }).eq('id', id)
  if (error) throw error
}
