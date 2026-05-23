import { getSupabaseBrowser } from '@/lib/supabase-browser'

export type Perfil = 'owner' | 'administrador' | 'operador' | 'visualizador'

export interface UsuarioSessao {
  id:         string
  email:      string
  perfil:     Perfil
  nome?:      string
  username?:  string
  cargo?:     string
  telefone?:  string
  avatarUrl?: string
  ativo:      boolean
}

export const NOME_PERFIL: Record<Perfil, string> = {
  owner:         'Owner',
  administrador: 'Administrador',
  operador:      'Operador',
  visualizador:  'Visualizador',
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

  const { data } = await sb
    .from('perfis_usuario')
    .select('perfil, nome, username, cargo, telefone, avatar_url, ativo')
    .eq('user_id', session.user.id)
    .single()

  return {
    id:        session.user.id,
    email:     session.user.email ?? '',
    perfil:    (data?.perfil as Perfil) ?? 'visualizador',
    nome:      data?.nome ?? (session.user.user_metadata?.nome as string | undefined),
    username:  data?.username ?? undefined,
    cargo:     data?.cargo ?? undefined,
    telefone:  data?.telefone ?? undefined,
    avatarUrl: data?.avatar_url ?? undefined,
    ativo:     data?.ativo ?? true,
  }
}

// Permissões por perfil. owner difere de administrador apenas na ação 'webhooks'.
export const PERMISSOES = {
  owner:         ['configuracoes', 'frota', 'rotas', 'historico', 'dashboard', 'importar', 'gerar', 'aprovar', 'enviar', 'webhooks', 'usuarios', 'empresa'],
  administrador: ['configuracoes', 'frota', 'rotas', 'historico', 'dashboard', 'importar', 'gerar', 'aprovar', 'enviar', 'usuarios', 'empresa'],
  operador:      ['frota', 'rotas', 'historico', 'dashboard', 'importar', 'gerar', 'aprovar', 'enviar'],
  visualizador:  ['historico', 'dashboard'],
} as const satisfies Record<Perfil, readonly string[]>

export function temPermissao(perfil: Perfil, acao: string): boolean {
  return (PERMISSOES[perfil] as readonly string[]).includes(acao)
}
