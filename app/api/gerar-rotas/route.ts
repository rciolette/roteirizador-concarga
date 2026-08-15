import { after } from 'next/server'
import type { GerarRotasPayload } from '@/lib/webhooks'
import { resolveWebhookUrl } from '@/lib/config-server'
import { exigirPermissao } from '@/lib/auth-server'
import { executarRoteirizacaoInterna } from '@/lib/roteirizador/engine'
import { resolveEngineConfig } from '@/lib/roteirizador/config'

const GERAR_ROTAS_DEFAULT = 'https://n8n.rcdigitais.com.br/webhook/gerar-rotas'

// Engine interno roda a IA dentro desta função (após responder o 202) — a
// roteirização leva minutos, então estendemos o orçamento da função na Vercel.
export const maxDuration = 300

// O aceite responde na hora (202) e o processamento segue em background,
// gravando as rotas direto no Supabase. O painel acompanha por polling.
const TIMEOUT_ACEITE_MS = 45_000

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

    const config = await resolveEngineConfig()

    // ── Engine INTERNO: IA roda no próprio app; prompt mestre no repositório ──
    if (config.engine === 'interno') {
      if (!process.env.OPENAI_API_KEY) {
        return Response.json(
          { error: 'Engine interno ativado mas OPENAI_API_KEY não está configurada na Vercel' },
          { status: 500 },
        )
      }
      // Responde o aceite imediatamente e processa depois da resposta.
      after(async () => {
        try {
          await executarRoteirizacaoInterna(payload, config.modelo)
        } catch { /* já logado no engine */ }
      })
      return Response.json(
        { aceito: true, engine: 'interno', recebidoEm: new Date().toISOString() },
        { status: 202 },
      )
    }

    // ── Engine n8n (legado): proxy para o webhook do WF-B ────────────────────
    webhookUrl = await resolveWebhookUrl('gerarRotasWebhookUrl', 'GERAR_ROTAS_WEBHOOK_URL', GERAR_ROTAS_DEFAULT)

    let upstream: globalThis.Response
    try {
      upstream = await fetch(webhookUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(TIMEOUT_ACEITE_MS),
      })
    } catch (fetchErr) {
      let error: string
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        error = 'Timeout: o n8n não confirmou o recebimento em 45s'
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

    const rotasNoCorpo = Array.isArray((body as { rotas?: unknown }).rotas)
    return Response.json({ ...body, aceito: !rotasNoCorpo }, { status: 202 })

  } catch (err) {
    const error = err instanceof Error ? err.message : 'erro interno'
    console.error('[gerar-rotas] handler error', webhookUrl, error)
    return Response.json({ error: `Erro interno: ${error}` }, { status: 500 })
  }
}
