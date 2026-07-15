import { exigirPermissao, getAdminClient } from '@/lib/auth-server'
import { registrarLog } from '@/lib/log-atividade'
import type { Perfil } from '@/lib/auth'

const PERFIS_CONVIDAVEIS: Perfil[] = ['administrador', 'operador', 'visualizador']

// GET /api/convites — lista convites; auto-expira pendentes com mais de 7 dias
export async function GET() {
  const auth = await exigirPermissao('usuarios')
  if (auth instanceof Response) return auth

  const sb = getAdminClient()

  // Auto-expira convites pendentes com mais de 7 dias
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await sb.from('convites')
    .update({ status: 'expirado' })
    .eq('status', 'pendente')
    .lt('criado_em', seteDiasAtras)

  const { data, error } = await sb
    .from('convites')
    .select('id, email, perfil, status, criado_em, aceito_em')
    .order('criado_em', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ convites: data })
}

// POST /api/convites — enviar convite por e-mail
export async function POST(req: Request) {
  const auth = await exigirPermissao('usuarios')
  if (auth instanceof Response) return auth

  const body = await req.json().catch(() => null)
  if (!body?.email || !body?.perfil) {
    return Response.json({ error: 'email e perfil são obrigatórios' }, { status: 400 })
  }

  const perfil: Perfil = body.perfil
  if (!PERFIS_CONVIDAVEIS.includes(perfil)) {
    return Response.json({ error: 'perfil inválido' }, { status: 400 })
  }

  // Administrador não pode convidar outro administrador — apenas owner pode
  if (perfil === 'administrador' && auth.perfil !== 'owner') {
    return Response.json({ error: 'Sem permissão para convidar administradores' }, { status: 403 })
  }

  const sb = getAdminClient()
  // Deriva a URL absoluta dos headers da requisição — não depende de NEXT_PUBLIC_APP_URL
  const host = req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const redirectTo = `${proto}://${host}/auth/callback?type=invite`

  const { data: user, error: inviteError } = await sb.auth.admin.inviteUserByEmail(body.email, {
    data: { perfil, nome: body.nome ?? '' },
    redirectTo,
  })

  if (inviteError) return Response.json({ error: inviteError.message }, { status: 500 })

  const userId = user.user?.id ?? null

  // Cria perfil imediatamente para que o usuário tenha o perfil correto ao aceitar o convite
  if (userId) {
    await sb.from('perfis_usuario').upsert(
      { user_id: userId, perfil, nome: body.nome ?? '', ativo: true },
      { onConflict: 'user_id', ignoreDuplicates: true },
    )
  }

  await sb.from('convites').insert({
    email:         body.email,
    perfil,
    status:        'pendente',
    convidado_por: auth.userId,
    user_id:       userId,
  })

  await registrarLog({
    sessao: auth, evento: 'criar', area: 'convites', entidadeId: userId ?? undefined,
    descricao: `Convidou ${body.email} como ${perfil}`,
    dados: { email: body.email, perfil }, req,
  })

  return Response.json({ ok: true })
}

// PUT /api/convites — reenviar convite (expira o antigo e envia novo)
export async function PUT(req: Request) {
  const auth = await exigirPermissao('usuarios')
  if (auth instanceof Response) return auth

  const body = await req.json().catch(() => null)
  if (!body?.id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

  const sb = getAdminClient()

  // Busca o convite existente
  const { data: convite, error: fetchErr } = await sb
    .from('convites')
    .select('id, email, perfil, user_id')
    .eq('id', body.id)
    .eq('status', 'pendente')
    .single()

  if (fetchErr || !convite) {
    return Response.json({ error: 'Convite não encontrado ou já processado' }, { status: 404 })
  }

  const host = req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const redirectTo = `${proto}://${host}/auth/callback?type=invite`

  // Reenvia o convite pelo Supabase Auth
  const { error: inviteError } = await sb.auth.admin.inviteUserByEmail(convite.email, {
    data: { perfil: convite.perfil },
    redirectTo,
  })

  if (inviteError) return Response.json({ error: inviteError.message }, { status: 500 })

  // Atualiza data de envio no registro existente
  await sb.from('convites').update({ criado_em: new Date().toISOString() }).eq('id', convite.id)

  await registrarLog({
    sessao: auth, evento: 'editar', area: 'convites', entidadeId: convite.id,
    descricao: `Reenviou convite para ${convite.email}`,
    req,
  })

  return Response.json({ ok: true })
}

// DELETE /api/convites?id=... — cancelar/expirar convite
export async function DELETE(req: Request) {
  const auth = await exigirPermissao('usuarios')
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

  const sb = getAdminClient()
  const { data, error } = await sb.from('convites').update({ status: 'expirado' }).eq('id', id).select('email').single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await registrarLog({
    sessao: auth, evento: 'editar', area: 'convites', entidadeId: id,
    descricao: `Cancelou convite de ${data?.email ?? id}`,
    req,
  })

  return Response.json({ ok: true })
}
