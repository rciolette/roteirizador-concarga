import { createClient } from '@supabase/supabase-js'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: Request) {
  const sb = adminClient()
  if (!sb) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurado' }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'payload inválido' }, { status: 400 })

  const { error } = await sb
    .from('configuracoes')
    .upsert({ chave: 'webhooks', valor: body }, { onConflict: 'chave' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
