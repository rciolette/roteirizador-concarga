import { exigirPermissao, getAdminClient } from '@/lib/auth-server'

export async function POST(req: Request) {
  const auth = await exigirPermissao('webhooks')
  if (auth instanceof Response) return auth

  const sb = getAdminClient()

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'payload inválido' }, { status: 400 })

  const { error } = await sb
    .from('configuracoes')
    .upsert({ chave: 'webhooks', valor: body }, { onConflict: 'chave' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
