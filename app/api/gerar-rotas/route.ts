import type { GerarRotasPayload } from '@/lib/webhooks'
import { resolveWebhookUrl } from '@/lib/config-store'
import { exigirPermissao } from '@/lib/auth-server'

const GERAR_ROTAS_DEFAULT = 'https://n8n.rcdigitais.com.br/webhook/gerar-rotas'

export async function POST(req: Request) {
  let webhookUrl = GERAR_ROTAS_DEFAULT
  try {
    const auth = await exigirPermissao('gerar')
    if (auth instanceof Response) return auth

    let payload: GerarRotasPayload
    try {
      payload = await req.json()
    } catch {
      return Response.json({ error: 'payload inválido' }, { status: 400 })
    }

    webhookUrl = await resolveWebhookUrl('gerarRotasWebhookUrl', 'GERAR_ROTAS_WEBHOOK_URL', GERAR_ROTAS_DEFAULT)

    let upstream: globalThis.Response
    try {
      upstream = await fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(60_000),
      })
    } catch (fetchErr) {
      let error: string
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        error = 'Timeout: n8n não respondeu em 60s'
      } else if (fetchErr instanceof Error && (fetchErr as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
        error = 'n8n indisponível (conexão recusada)'
      } else {
        error = fetchErr instanceof Error ? fetchErr.message : 'erro de rede'
      }
      console.error('[gerar-rotas] fetch error', error)
      return Response.json({ error }, { status: 502 })
    }

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      let error = `n8n ${upstream.status}`
      if (upstream.status === 404) error = `n8n 404 — webhook não encontrado (URL: ${webhookUrl})`
      else if (upstream.status >= 500) error = `n8n ${upstream.status} — erro interno no workflow`
      console.error('[gerar-rotas] upstream error', upstream.status, webhookUrl, text.slice(0, 500))
      return Response.json({ error, detail: text.slice(0, 500) }, { status: 502 })
    }

    const body = await upstream.json().catch(() => null)
    if (body === null) return Response.json({ error: 'n8n retornou resposta inválida' }, { status: 502 })
    return Response.json(body)

  } catch (err) {
    const error = err instanceof Error ? err.message : 'erro interno'
    console.error('[gerar-rotas] handler error', webhookUrl, error)
    return Response.json({ error: `Erro interno: ${error}` }, { status: 500 })
  }
}
