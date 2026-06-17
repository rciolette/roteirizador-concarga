import { supabase } from '@/lib/supabase'
import type { Veiculo } from '@/types'
import { tipoVeiculoFromSiat, capKgFromSiat } from '@/lib/siat'

// Retorna apenas veículos ativos com motorista vinculado, com disponibilidade
// do dia lida de veiculo_disponibilidade (fonte de verdade).
export async function listarVeiculos(): Promise<Veiculo[]> {
  const hoje = new Date().toISOString().slice(0, 10)

  const [veicResult, dispResult] = await Promise.all([
    supabase
      .from('veiculos')
      .select('id, placa, modelo, tipo_veiculo, capacidade_kg, situacao_siat, motorista_id, codigo_siat_motorista, disponivel_hoje, motoristas(nome, celular)')
      .eq('ativo', true)
      .eq('disponivel_hoje', true)
      .not('motorista_id', 'is', null)
      .order('placa', { ascending: true }),
    supabase
      .from('veiculo_disponibilidade')
      .select('veiculo_id, disponivel')
      .eq('data', hoje),
  ])

  if (veicResult.error) throw veicResult.error

  const dispMap = new Map<string, boolean>()
  for (const d of dispResult.data ?? []) {
    dispMap.set(d.veiculo_id as string, d.disponivel as boolean)
  }

  return (veicResult.data ?? []).map(row => {
    const mot = row.motoristas as { nome?: string; celular?: string } | null
    const dispHoje = dispMap.has(row.id)
      ? dispMap.get(row.id)!
      : ((row.disponivel_hoje as boolean | null) ?? false)

    return {
      id:                  row.id,
      placa:               row.placa,
      modelo:              row.modelo ?? '',
      tipo:                tipoVeiculoFromSiat(row.tipo_veiculo),
      capacidadeKg:        capKgFromSiat(row.tipo_veiculo, row.capacidade_kg ? Number(row.capacidade_kg) : null),
      sigla:               row.placa.replace(/\W/g, '').slice(-4),
      status:              mapSituacao(row.situacao_siat),
      codigoSiatMotorista: row.codigo_siat_motorista ?? undefined,
      disponivel_hoje:     dispHoje,
      motoristaNome:       mot?.nome   ?? undefined,
      motoristaCelular:    mot?.celular ?? undefined,
    }
  })
}

function mapSituacao(situacao: string | null): Veiculo['status'] {
  if (!situacao) return 'disponivel'
  const s = situacao.toUpperCase()
  if (s.includes('MANUT') || s.includes('MANUTENÇÃO')) return 'manutencao'
  if (s.includes('INDISPON') || s.includes('BLOQ'))     return 'indisponivel'
  return 'disponivel'
}
