import { exigirPermissao, getAdminClient } from '@/lib/auth-server'
import type { Perfil } from '@/lib/auth'

const PERFIS_CONVIDAVEIS: Perfil[] = ['administrador', 'operador', 'visualizador']

// GET /api/convites — lista convites pendentes
export async function GET() {
  const auth = await exigirPermissao('usuarios')
  if (auth instanceof Response) return auth

  const sb = getAdminClient()
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
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/callback?type=invite`

  const { data: user, error: inviteError } = await sb.auth.admin.inviteUserByEmail(body.email, {
    data: { perfil, nome: body.nome ?? '' },
    redirectTo,
  })

  if (inviteError) return Response.json({ error: inviteError.message }, { status: 500 })

  await sb.from('convites').insert({
    email:         body.email,
    perfil,
    status:        'pendente',
    convidado_por: auth.userId,
    user_id:       user.user?.id ?? null,
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
  const { error } = await sb.from('convites').update({ status: 'expirado' }).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
