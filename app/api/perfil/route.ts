import { getSessaoServidor, getAdminClient } from '@/lib/auth-server'

// PATCH /api/perfil — atualiza nome, telefone e avatar_url do próprio perfil
// Nunca altera 'perfil' ou 'ativo' (campos sensíveis).
export async function PATCH(req: Request) {
  const sessao = await getSessaoServidor()
  if (!sessao) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!sessao.ativo) return Response.json({ error: 'Usuário inativo' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'payload inválido' }, { status: 400 })

  const campos: Record<string, unknown> = {}
  if (body.nome       !== undefined) campos.nome       = body.nome
  if (body.username   !== undefined) campos.username   = body.username
  if (body.cargo      !== undefined) campos.cargo      = body.cargo
  if (body.telefone   !== undefined) campos.telefone   = body.telefone
  if (body.avatar_url !== undefined) campos.avatar_url = body.avatar_url

  if (Object.keys(campos).length === 0) {
    return Response.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  campos.atualizado_em = new Date().toISOString()

  const sb = getAdminClient()
  const { error } = await sb
    .from('perfis_usuario')
    .update(campos)
    .eq('user_id', sessao.userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
