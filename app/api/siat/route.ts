import type { SiatFilters } from '@/lib/siat'

const N8N_WEBHOOK = process.env.SIAT_WEBHOOK_URL
  ?? 'https://n8n.rcdigitais.com.br/webhook/Execute-SQL-SIAT'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const filters: SiatFilters = {}
  const dataInicio = searchParams.get('dataInicio')
  const dataFim    = searchParams.get('dataFim')
  const situacao   = searchParams.get('situacao')
  const codigoRota = searchParams.get('codigoRota')
  const qtdMaxima  = searchParams.get('qtdMaxima')

  if (dataInicio) filters.dataInicio = dataInicio
  if (dataFim)    filters.dataFim    = dataFim
  if (situacao)   filters.situacao   = situacao
  if (codigoRota) filters.codigoRota = codigoRota
  if (qtdMaxima && Number.isFinite(Number(qtdMaxima))) filters.qtdMaxima = Number(qtdMaxima)

  try {
    const upstream = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.keys(filters).length > 0 ? filters : {}),
      signal: AbortSignal.timeout(30_000),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      let error = `n8n ${upstream.status}`
      if (upstream.status === 404) error = 'n8n 404 — workflow não publicado (ative o toggle no editor n8n)'
      else if (upstream.status >= 500) error = `n8n ${upstream.status} — erro interno no workflow`
      console.error('[siat] upstream error', upstream.status, text.slice(0, 500))
      return Response.json({ error, detail: text.slice(0, 500) }, { status: 502 })
    }

    return Response.json(await upstream.json())
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
