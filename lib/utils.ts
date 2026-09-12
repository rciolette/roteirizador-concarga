export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Peso sempre em KG exato (Raphael, 24/08) — nada de arredondar para toneladas.
export function formatPeso(kg: number): string {
  return `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function getPesoPercent(peso: number, capacidade: number): number {
  return Math.round((peso / capacidade) * 100)
}

/**
 * Rótulo padrão de veículo em TODA a interface (espec Rotas do Dia, item 7):
 * `Placa | Sigla do motorista | Tipo` — ex.: `AYAS712 | AYA | VUC`.
 */
export function rotuloVeiculo(v: { placa?: string | null; sigla?: string | null; tipo?: string | null } | null | undefined): string {
  if (!v || !v.placa) return '—'
  return `${v.placa} | ${v.sigla && v.sigla !== '—' ? v.sigla : '—'} | ${v.tipo ?? '—'}`
}

/** CEP com 8 dígitos, completando zeros à esquerda; null quando não há dígitos. */
export function normalizarCep(cep: string | null | undefined): string | null {
  const d = (cep ?? '').replace(/\D/g, '')
  if (!d) return null
  return d.padStart(8, '0').slice(-8)
}

/** CEP formatado 00000-000 (ou '' se vazio). */
export function formatarCep(cep: string | null | undefined): string {
  const n = normalizarCep(cep)
  return n ? `${n.slice(0, 5)}-${n.slice(5)}` : ''
}
