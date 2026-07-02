import { createSupabaseServerClient } from '@/lib/supabase-server'
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
      const origem = searchParams.get('origem') // param customizado: 'convite'
      const destino =
        type === 'invite' || origem === 'convite' ? '/aceitar-convite' :
        type === 'recovery'                        ? '/redefinir-senha'  : '/'
      return NextResponse.redirect(new URL(destino, origin))
    }
  }

  return NextResponse.redirect(new URL('/login?erro=link_invalido', origin))
}
