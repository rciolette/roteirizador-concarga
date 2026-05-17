import type { GerarRotasPayload } from '@/lib/webhooks'

const N8N_WEBHOOK = process.env.GERAR_ROTAS_WEBHOOK_URL
  ?? 'https://n8n.rcdigitais.com.br/webhook/gerar-rotas'

export async function POST(req: Request) {
  let payload: GerarRotasPayload
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'payload inválido' }, { status: 400 })
  }

  try {
    const upstream = await fetch(N8N_WEBHOOK, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(60_000),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      let error = `n8n ${upstream.status}`
      if (upstream.status === 404) error = 'n8n 404 — workflow WF-B não publicado (ative o toggle no editor n8n)'
      else if (upstream.status >= 500) error = `n8n ${upstream.status} — erro interno no workflow`
      console.error('[gerar-rotas] upstream error', upstream.status, text.slice(0, 500))
      return Response.json({ error, detail: text.slice(0, 500) }, { status: 502 })
    }

    return Response.json(await upstream.json())
  } catch (err) {
    let error: string
    if (err instanceof Error && err.name === 'AbortError') {
      error = 'Timeout: n8n não respondeu em 60s'
    } else if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      error = 'n8n indisponível (conexão recusada)'
    } else {
      error = err instanceof Error ? err.message : 'erro desconhecido'
    }
    console.error('[gerar-rotas] fetch error', error)
    return Response.json({ error }, { status: 502 })
  }
}
