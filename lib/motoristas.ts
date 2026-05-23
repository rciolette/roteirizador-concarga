import { supabase } from '@/lib/supabase'
import type { Motorista } from '@/types'
import type { MotoristaPayload } from '@/lib/webhooks'

function deriveSigla(nome: string): string {
  return nome.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 3).toUpperCase()
}

export async function listarMotoristas(): Promise<Motorista[]> {
  const { data, error } = await supabase
    .from('motoristas')
    .select('id, nome, telefone, celular, placa, sigla, status')
    .order('nome', { ascending: true })

  if (error) throw error

  return (data ?? []).map(row => ({
    id:       row.id,
    nome:     row.nome,
    telefone: row.celular || row.telefone || '',
    sigla:    row.sigla   || deriveSigla(row.nome),
    placa:    row.placa   ?? undefined,
    status:   (row.status as Motorista['status']) ?? 'disponivel',
  }))
}

export async function criarMotorista(dados: {
  nome:      string
  telefone?: string
  placa?:    string
  status:    'disponivel' | 'ausente'
}): Promise<Motorista> {
  const sigla = deriveSigla(dados.nome)
  const { data, error } = await supabase
    .from('motoristas')
    .insert({
      nome:     dados.nome,
      celular:  dados.telefone ?? '',
      telefone: dados.telefone ?? '',
      placa:    dados.placa    ?? null,
      sigla,
      status:   dados.status,
    })
    .select('id, nome, telefone, celular, placa, sigla, status')
    .single()

  if (error) throw error

  return {
    id:       data.id,
    nome:     data.nome,
    telefone: data.celular || data.telefone || '',
    sigla:    data.sigla,
    placa:    data.placa ?? undefined,
    status:   data.status as Motorista['status'],
  }
}

export async function atualizarMotorista(
  id: string,
  patch: Partial<{ nome: string; telefone: string; placa: string; status: string }>,
): Promise<void> {
  const update: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
  if (patch.nome     !== undefined) { update.nome = patch.nome; update.sigla = deriveSigla(patch.nome) }
  if (patch.telefone !== undefined) { update.celular = patch.telefone; update.telefone = patch.telefone }
  if (patch.placa    !== undefined)   update.placa  = patch.placa  || null
  if (patch.status   !== undefined)   update.status = patch.status

  const { error } = await supabase.from('motoristas').update(update).eq('id', id)
  if (error) throw error
}

export async function removerMotorista(id: string): Promise<void> {
  const { error } = await supabase.from('motoristas').update({ ativo: false }).eq('id', id)
  if (error) throw error
}

export async function importarMotoristas(arquivo: File): Promise<MotoristaPayload[]> {
  const isNomeCol   = (h: string) => h.toLowerCase() === 'nome'
  const isTelCol    = (h: string) => ['telefone', 'fone', 'celular'].includes(h.toLowerCase())
  const isPlacaCol  = (h: string) => h.toLowerCase() === 'placa'
  const isStatusCol = (h: string) => ['status', 'disponivel', 'disponível'].includes(h.toLowerCase())

  const parseStatus = (v?: string): 'disponivel' | 'ausente' => {
    const norm = (v ?? '').toLowerCase().trim()
    return ['sim', 'disponivel', 'disponível', 'ok', 's', '1'].includes(norm) ? 'disponivel' : 'ausente'
  }

  const ext = arquivo.name.split('.').pop()?.toLowerCase()
  let rows: Record<string, string>[] = []

  if (ext === 'csv') {
    const Papa   = (await import('papaparse')).default
    const text   = await arquivo.text()
    const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
    rows = result.data
  } else {
    const XLSX   = await import('xlsx')
    const buffer = await arquivo.arrayBuffer()
    const wb     = XLSX.read(buffer, { type: 'array' })
    const ws     = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
  }

  return rows
    .map(row => {
      const headers   = Object.keys(row)
      const nomeKey   = headers.find(isNomeCol)
      const telKey    = headers.find(isTelCol)
      const placaKey  = headers.find(isPlacaCol)
      const statusKey = headers.find(isStatusCol)

      return {
        nome:     (nomeKey ? row[nomeKey] : '').trim(),
        telefone: telKey    ? row[telKey]?.trim()   || undefined : undefined,
        placa:    placaKey  ? row[placaKey]?.trim()  || undefined : undefined,
        status:   statusKey ? parseStatus(row[statusKey]) : 'disponivel',
      } satisfies MotoristaPayload
    })
    .filter(m => m.nome)
}
