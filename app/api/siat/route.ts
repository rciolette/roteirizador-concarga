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
      let error = `n8n ${upstream.status}`
      if (upstream.status === 404) error = 'n8n 404 — workflow não publicado (ative o toggle no editor n8n)'
      else if (upstream.status >= 500) error = `n8n ${upstream.status} — erro interno no workflow`
      console.error('[siat] upstream error', upstream.status, text.slice(0, 500))
      return Response.json({ error, detail: text.slice(0, 500) }, { status: 502 })
    }

    const data = await upstream.json()
    return Response.json(data)
  } catch (err) {
    let error: string
    if (err instanceof Error && err.name === 'AbortError') {
      error = 'Timeout: n8n não respondeu em 30s'
    } else if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      error = 'n8n indisponível (conexão recusada)'
    } else {
      error = err instanceof Error ? err.message : 'erro desconhecido'
    }
    console.error('[siat] fetch error', error)
    return Response.json({ error }, { status: 502 })
  }
}
