import type { EnviarMotoristaPayload } from '@/lib/webhooks'
import { resolveWebhookUrl } from '@/lib/config-store'

const ENVIAR_MOTORISTA_DEFAULT = 'https://n8n.rcdigitais.com.br/webhook/enviar-motorista'

export async function POST(req: Request) {
  let payload: EnviarMotoristaPayload
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'payload inválido' }, { status: 400 })
  }

  const webhookUrl = await resolveWebhookUrl('enviarMotoristaWebhookUrl', 'ENVIAR_MOTORISTA_WEBHOOK_URL', ENVIAR_MOTORISTA_DEFAULT)

  try {
    const upstream = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(15_000),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      let error = `n8n ${upstream.status}`
      if (upstream.status === 404) error = `n8n 404 — webhook não encontrado (URL: ${webhookUrl})`
      else if (upstream.status >= 500) error = `n8n ${upstream.status} — erro interno no workflow`
      console.error('[enviar-motorista] upstream error', upstream.status, webhookUrl, text.slice(0, 500))
      return Response.json({ error, detail: text.slice(0, 500) }, { status: 502 })
    }

    return Response.json({ ok: true })
  } catch (err) {
    let error: string
    if (err instanceof Error && err.name === 'AbortError') {
      error = 'Timeout: n8n não respondeu em 15s'
    } else if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
      error = 'n8n indisponível (conexão recusada)'
    } else {
      error = err instanceof Error ? err.message : 'erro desconhecido'
    }
    console.error('[enviar-motorista] fetch error', error)
    return Response.json({ error }, { status: 502 })
  }
}
