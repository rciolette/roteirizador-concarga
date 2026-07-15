import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getAdminClient } from '@/lib/auth-server'
import { registrarLog } from '@/lib/log-atividade'
import type { Perfil } from '@/lib/auth'
import { NextResponse, type NextRequest } from 'next/server'

// Recebe o code do link de e-mail (convite ou recuperação de senha)
// e troca por uma sessão. Redireciona para /redefinir-senha quando
// o tipo for 'invite' ou 'recovery', ou para / nas demais situações.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type') // 'invite' | 'recovery' | 'signup' | etc.

  if (code) {
    const sb = await createSupabaseServerClient()
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (!error) {
      // Este é o único ponto de entrada de sessão via link de e-mail (convite/recovery) —
      // não passa por signIn() em lib/auth.ts, por isso o login precisa ser registrado aqui.
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const admin = getAdminClient()
        const { data: perfilRow } = await admin.from('perfis_usuario').select('perfil').eq('user_id', user.id).single()
        await registrarLog({
          sessao: { userId: user.id, email: user.email ?? '', perfil: (perfilRow?.perfil as Perfil) ?? 'visualizador', ativo: true },
          evento: 'login', area: 'sessao', req: request,
        })
      }

      const origem = searchParams.get('origem') // param customizado: 'convite'
      const destino =
        type === 'invite' || origem === 'convite' ? '/aceitar-convite' :
        type === 'recovery'                        ? '/redefinir-senha'  : '/'
      return NextResponse.redirect(new URL(destino, origin))
    }
  }

  return NextResponse.redirect(new URL('/login?erro=link_invalido', origin))
}
