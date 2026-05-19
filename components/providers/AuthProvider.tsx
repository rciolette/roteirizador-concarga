'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { getUsuarioAtual, signOut as authSignOut, type UsuarioSessao, type Perfil, temPermissao } from '@/lib/auth'

interface AuthCtx {
  usuario:     UsuarioSessao | null
  loading:     boolean
  signOut:     () => Promise<void>
  pode:        (acao: string) => boolean
}

const AuthContext = createContext<AuthCtx | null>(null)

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}

const PUBLIC_PATHS = ['/login']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario,  setUsuario]  = useState<UsuarioSessao | null>(null)
  const [loading,  setLoading]  = useState(true)
  const router   = useRouter()
  const pathname = usePathname()

  const carregarUsuario = useCallback(async () => {
    setLoading(true)
    try {
      const u = await getUsuarioAtual()
      setUsuario(u)
      if (!u && !PUBLIC_PATHS.includes(pathname)) {
        router.replace('/login')
      }
    } catch {
      setUsuario(null)
    } finally {
      setLoading(false)
    }
  }, [pathname, router])

  useEffect(() => {
    carregarUsuario()

    const sb = getSupabaseBrowser()
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN')  carregarUsuario()
      if (event === 'SIGNED_OUT') { setUsuario(null); router.replace('/login') }
    })
    return () => subscription.unsubscribe()
  }, [carregarUsuario, router])

  const signOut = useCallback(async () => {
    await authSignOut()
    setUsuario(null)
    router.replace('/login')
  }, [router])

  const pode = useCallback((acao: string): boolean => {
    if (!usuario) return false
    return temPermissao(usuario.perfil as Perfil, acao)
  }, [usuario])

  // Redireciona para login se não autenticado em rota protegida
  if (!loading && !usuario && !PUBLIC_PATHS.includes(pathname)) {
    return null
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, signOut, pode }}>
      {children}
    </AuthContext.Provider>
  )
}
