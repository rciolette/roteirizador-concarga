import type { AppConfig } from '@/types'
import { exigirPermissao, getAdminClient } from '@/lib/auth-server'

export async function POST(req: Request) {
  const auth = await exigirPermissao('webhooks')
  if (auth instanceof Response) return auth

  const sb = getAdminClient()

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

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
