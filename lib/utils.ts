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

/**
 * Data de HOJE na operação, no fuso de Brasília, como `YYYY-MM-DD`.
 *
 * Nunca use `new Date().toISOString().slice(0, 10)` para isso: aquilo devolve a
 * data em UTC e, como o Brasil está em UTC−3, a partir das 21h o painel passava
 * a considerar o dia seguinte — dentro da janela de operação, que vai até 23h.
 * O efeito era o painel "virar o dia" sozinho à noite: as rotas montadas
 * sumiam da tela, o badge zerava e a frota do dia aparecia vazia
 * (Raphael, 02/11).
 *
 * O fuso é fixo em America/Sao_Paulo de propósito: a data operacional é a da
 * Concarga, não a do computador de quem abre o painel.
 */
export function hojeISO(): string {
  // 'en-CA' formata como YYYY-MM-DD, que é o formato que o banco usa.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}
