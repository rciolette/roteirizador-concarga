// O PostgREST do Supabase devolve no máximo 1000 linhas por requisição.
// Tabelas como `motoristas` (1.6k) e `veiculos` (2k) passam disso, então toda
// listagem completa precisa paginar com .range() — senão a lista chega truncada
// silenciosamente, sem erro.

const PAGE = 1000

interface PageResult { data: unknown[] | null; error: unknown }

export async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<PageResult>,
): Promise<T[]> {
  const result: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    result.push(...rows)
    if (rows.length < PAGE) break
    from += PAGE
  }
  return result
}
