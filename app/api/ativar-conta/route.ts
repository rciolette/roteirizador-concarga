import { getAdminClient } from '@/lib/auth-server'

const ESPECIAL = /[^a-zA-Z0-9]/

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body?.email || !body?.password) {
    return Response.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 })
  }

  const { email, password } = body as { email: string; password: string }

  if (password.length < 8)      return Response.json({ error: 'A senha deve ter no mínimo 8 caracteres.' }, { status: 400 })
  if (!ESPECIAL.test(password)) return Response.json({ error: 'A senha deve conter pelo menos um caractere especial.' }, { status: 400 })

  const sb = getAdminClient()

  // Busca convite pendente para esse e-mail
  const { data: convite, error: conviteErr } = await sb
    .from('convites')
    .select('id, user_id')
    .eq('email', email.toLowerCase().trim())
    .eq('status', 'pendente')
    .single()

  if (conviteErr || !convite?.user_id) {
    return Response.json({ error: 'Nenhum convite pendente encontrado para este e-mail. Solicite ao administrador.' }, { status: 404 })
  }

  // Define a senha do usuário via admin (sem precisar de magic link)
  const { error: updateErr } = await sb.auth.admin.updateUserById(convite.user_id, {
    password,
    email_confirm: true, // garante que o email fica confirmado
  })

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

  // Marca convite como aceito
  await sb.from('convites').update({
    status:    'aceito',
    aceito_em: new Date().toISOString(),
  }).eq('id', convite.id)

  return Response.json({ ok: true })
}
