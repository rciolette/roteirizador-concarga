import { exigirPermissao, getAdminClient } from '@/lib/auth-server'
import { registrarLog } from '@/lib/log-atividade'
import type { Perfil } from '@/lib/auth'

// GET /api/usuarios — lista usuários com perfil
export async function GET() {
  const auth = await exigirPermissao('usuarios')
  if (auth instanceof Response) return auth

  const sb = getAdminClient()

  const { data: perfis, error } = await sb
    .from('perfis_usuario')
    .select('user_id, perfil, nome, ativo, criado_em')
    .order('criado_em', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Busca e-mails via Auth Admin API
  const { data: { users }, error: usersError } = await sb.auth.admin.listUsers()
  if (usersError) return Response.json({ error: usersError.message }, { status: 500 })

  const emailPorId = Object.fromEntries(users.map(u => [u.id, u.email]))

  const usuarios = (perfis ?? []).map(p => ({
    id:       p.user_id,
    email:    emailPorId[p.user_id] ?? '',
    perfil:   p.perfil,
    nome:     p.nome,
    ativo:    p.ativo,
    criadoEm: p.criado_em,
  }))

  return Response.json({ usuarios })
}

// PATCH /api/usuarios — alterar perfil ou ativo de um usuário
export async function PATCH(req: Request) {
  const auth = await exigirPermissao('usuarios')
  if (auth instanceof Response) return auth

  const body = await req.json().catch(() => null)
  if (!body?.userId) return Response.json({ error: 'userId obrigatório' }, { status: 400 })

  const { userId, perfil, ativo } = body as { userId: string; perfil?: Perfil; ativo?: boolean }

  // Não permite alterar o owner (proteção extra além do índice único no banco)
  const sb = getAdminClient()
  const { data: alvo } = await sb
    .from('perfis_usuario')
    .select('perfil, nome')
    .eq('user_id', userId)
    .single()

  if (alvo?.perfil === 'owner') {
    return Response.json({ error: 'O perfil owner não pode ser alterado' }, { status: 403 })
  }

  // Administrador não pode modificar outro administrador (perfil ou ativo) — apenas owner
  if (alvo?.perfil === 'administrador' && auth.perfil !== 'owner') {
    return Response.json({ error: 'Sem permissão para modificar um administrador' }, { status: 403 })
  }

  // Administrador não pode promover outro a administrador — apenas owner
  if (perfil === 'administrador' && auth.perfil !== 'owner') {
    return Response.json({ error: 'Sem permissão para promover a administrador' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (perfil !== undefined) updates.perfil = perfil
  if (ativo  !== undefined) updates.ativo  = ativo

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { error } = await sb
    .from('perfis_usuario')
    .update(updates)
    .eq('user_id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const mudancas = [
    perfil !== undefined ? `perfil → ${perfil}` : null,
    ativo  !== undefined ? (ativo ? 'reativado' : 'desativado') : null,
  ].filter(Boolean).join(', ')
  await registrarLog({
    sessao: auth, evento: 'editar', area: 'usuarios', entidadeId: userId,
    descricao: `Alterou usuário ${alvo?.nome || userId}: ${mudancas}`,
    dados: { userId, perfil, ativo }, req,
  })

  return Response.json({ ok: true })
}
