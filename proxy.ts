import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { temPermissao, type Perfil } from '@/lib/auth'
import { permissaoDaRota } from '@/lib/rbac'

// Rotas públicas que não exigem sessão
const PUBLIC_PATHS = ['/login', '/esqueci-senha', '/redefinir-senha', '/auth/callback']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { session } } = await sb.auth.getSession()

  const { pathname } = request.nextUrl
  const isPublicPath = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isApiRoute   = pathname.startsWith('/api/')

  // API routes: sem redirect — handlers retornam 401/403
  if (isApiRoute) return response

  // Sem sessão → login (exceto rotas públicas)
  if (!session) {
    if (isPublicPath) return response
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Com sessão na página de login → home
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Verificação de perfil por rota (checagem otimista — enforcement real nas API routes)
  const acao = permissaoDaRota(pathname)
  if (acao !== undefined && acao !== null) {
    const { data: perfilData } = await sb
      .from('perfis_usuario')
      .select('perfil, ativo')
      .eq('user_id', session.user.id)
      .single()

    const perfil = (perfilData?.perfil as Perfil) ?? 'visualizador'
    const ativo  = perfilData?.ativo ?? true

    // Usuário inativo → signOut + login
    if (!ativo) {
      await sb.auth.signOut()
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Sem permissão para a rota → home
    if (!temPermissao(perfil, acao)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
