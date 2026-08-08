import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { fetchAllPages } from '@/lib/supabase-paginate'
import type { Veiculo } from '@/types'
import { tipoVeiculoFromSiat, capKgFromSiat } from '@/lib/siat'

// Retorna apenas veículos ativos com motorista vinculado, com disponibilidade
// do dia lida de veiculo_disponibilidade (fonte de verdade).
export async function listarVeiculos(): Promise<Veiculo[]> {
  const hoje = new Date().toISOString().slice(0, 10)
  const sb   = getSupabaseBrowser()

  const [veicRows, dispRows] = await Promise.all([
    fetchAllPages<Record<string, unknown>>(
      (from, to) => sb
        .from('veiculos')
        .select('id, placa, modelo, tipo_veiculo, capacidade_kg, situacao_siat, motorista_id, codigo_siat_motorista, disponivel_hoje, motoristas(nome, celular)')
        .eq('ativo', true)
        .eq('disponivel_hoje', true)
        .not('motorista_id', 'is', null)
        .order('placa', { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<Record<string, unknown>>(
      (from, to) => sb
        .from('veiculo_disponibilidade')
        .select('veiculo_id, disponivel')
        .eq('data', hoje)
        .range(from, to),
    ),
  ])

  const dispMap = new Map<string, boolean>()
  for (const d of dispRows) {
    dispMap.set(d.veiculo_id as string, d.disponivel as boolean)
  }

  return veicRows.map(row => {
    const mot   = row.motoristas as { nome?: string; celular?: string } | null
    const id    = row.id    as string
    const placa = row.placa as string
    const tipoSiat = row.tipo_veiculo as string
    const dispHoje = dispMap.has(id)
      ? dispMap.get(id)!
      : ((row.disponivel_hoje as boolean | null) ?? false)

    return {
      id,
      placa,
      modelo:              (row.modelo as string) ?? '',
      tipo:                tipoVeiculoFromSiat(tipoSiat),
      capacidadeKg:        capKgFromSiat(tipoSiat, row.capacidade_kg ? Number(row.capacidade_kg) : null),
      sigla:               placa.replace(/\W/g, '').slice(-4),
      status:              mapSituacao(row.situacao_siat as string | null),
      codigoSiatMotorista: (row.codigo_siat_motorista as string | null) ?? undefined,
      disponivel_hoje:     dispHoje,
      motoristaNome:       mot?.nome    ?? undefined,
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
