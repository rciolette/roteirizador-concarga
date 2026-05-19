import { getSupabaseBrowser } from '@/lib/supabase-browser'

export type Perfil = 'owner' | 'operador' | 'visualizador'

export interface UsuarioSessao {
  id:     string
  email:  string
  perfil: Perfil
  nome?:  string
}

export async function signIn(email: string, password: string): Promise<void> {
  const sb = getSupabaseBrowser()
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  const sb = getSupabaseBrowser()
  await sb.auth.signOut()
}

export async function getUsuarioAtual(): Promise<UsuarioSessao | null> {
  const sb = getSupabaseBrowser()
  const { data: { session } } = await sb.auth.getSession()
  if (!session?.user) return null

  const perfil = await getPerfil(session.user.id)

  return {
    id:     session.user.id,
    email:  session.user.email ?? '',
    nome:   session.user.user_metadata?.nome as string | undefined,
    perfil,
  }
}

async function getPerfil(userId: string): Promise<Perfil> {
  const sb = getSupabaseBrowser()
  const { data } = await sb
    .from('perfis_usuario')
    .select('perfil')
    .eq('user_id', userId)
    .single()

  return (data?.perfil as Perfil) ?? 'visualizador'
}

// Permissões por perfil
export const PERMISSOES = {
  owner:        ['configuracoes', 'frota', 'rotas', 'historico', 'dashboard', 'importar', 'gerar', 'aprovar', 'enviar', 'webhooks'],
  operador:     ['frota', 'rotas', 'historico', 'dashboard', 'importar', 'gerar', 'aprovar', 'enviar'],
  visualizador: ['historico', 'dashboard'],
} as const satisfies Record<Perfil, readonly string[]>

export function temPermissao(perfil: Perfil, acao: string): boolean {
  return (PERMISSOES[perfil] as readonly string[]).includes(acao)
}
