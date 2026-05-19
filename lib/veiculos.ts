import { supabase } from '@/lib/supabase'
import type { Veiculo } from '@/types'
import { tipoVeiculoFromSiat, capKgFromSiat } from '@/lib/siat'

export async function listarVeiculos(): Promise<Veiculo[]> {
  const { data, error } = await supabase
    .from('veiculos')
    .select('id, placa, modelo, tipo_veiculo, capacidade_kg, situacao, situacao_siat, motorista_id, codigo_siat_motorista, disponivel_hoje, motoristas(nome, celular)')
    .eq('ativo', true)
    .order('placa', { ascending: true })

  if (error) throw error

  return (data ?? []).map(row => {
    const mot = row.motoristas as { nome?: string; celular?: string } | null
    return {
      id:               row.id,
      placa:            row.placa,
      modelo:           row.modelo ?? '',
      tipo:             tipoVeiculoFromSiat(row.tipo_veiculo),
      capacidadeKg:     capKgFromSiat(row.tipo_veiculo, row.capacidade_kg ? Number(row.capacidade_kg) : null),
      sigla:            row.placa.replace(/\W/g, '').slice(-4),
      status:           mapSituacao(row.situacao_siat ?? row.situacao),
      codigoSiatMotorista: row.codigo_siat_motorista ?? undefined,
      disponivel_hoje:  (row.disponivel_hoje as boolean | null) ?? false,
      motoristaNome:    mot?.nome   ?? undefined,
      motoristaCelular: mot?.celular ?? undefined,
    }
  })
}

function mapSituacao(situacao: string | null): Veiculo['status'] {
  if (!situacao) return 'disponivel'
  const s = situacao.toUpperCase()
  if (s.includes('MANUT') || s.includes('MANUTENÇÃO')) return 'manutencao'
  if (s.includes('INDISPON') || s.includes('BLOQ')) return 'indisponivel'
  return 'disponivel'
}
