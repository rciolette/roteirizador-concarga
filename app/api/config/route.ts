import { createClient } from '@supabase/supabase-js'
import type { AppConfig } from '@/types'

// Requer SUPABASE_SERVICE_ROLE_KEY em .env.local para gravar (ignora RLS)
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: Request) {
  const sb = adminClient()
  if (!sb) {
    return Response.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY não configurado — configurações salvas apenas localmente' },
      { status: 503 },
    )
  }

  let cfg: AppConfig
  try {
    cfg = await req.json()
  } catch {
    return Response.json({ error: 'payload inválido' }, { status: 400 })
  }

  const rows = [
    { chave: 'operacao',          valor: cfg.operacao },
    { chave: 'pesos',             valor: cfg.pesos },
    { chave: 'grades',            valor: cfg.grades },
    { chave: 'instrucaoGlobal',   valor: cfg.instrucaoGlobal },
    { chave: 'instrucoesPorRota', valor: cfg.instrucoesPorRota },
  ]

  const { error } = await sb
    .from('configuracoes')
    .upsert(rows, { onConflict: 'chave' })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
