import type { SiatFilters } from '@/lib/siat'

const N8N_WEBHOOK = process.env.SIAT_WEBHOOK_URL
  ?? 'https://n8n.rcdigitais.com.br/webhook/Execute-SQL-SIAT'

export async function POST(req: Request) {
  let filters: SiatFilters = {}
  try {
    const body = await req.json()
    if (body && typeof body === 'object') filters = body as SiatFilters
  } catch {
    // body vazio/inválido: segue sem filtros
  }

  try {
    const upstream = await fetch(N8N_WEBHOOK, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(filters),
      signal:  AbortSignal.timeout(30_000),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return Response.json(
        { error: `n8n respondeu ${upstream.status}`, detail: text.slice(0, 500) },
        { status: 502 },
      )
    }

    const data = await upstream.json()
    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'erro desconhecido'
    return Response.json({ error: message }, { status: 502 })
  }
}
