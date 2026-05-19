import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { temPermissao, type Perfil } from '@/lib/auth'

export interface SessaoServidor {
  userId: string
  email:  string
  perfil: Perfil
  ativo:  boolean
}

export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function getSessaoServidor(): Promise<SessaoServidor | null> {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const admin = getAdminClient()
  const { data } = await admin
    .from('perfis_usuario')
    .select('perfil, ativo')
    .eq('user_id', user.id)
    .single()

  return {
    userId: user.id,
    email:  user.email ?? '',
    perfil: (data?.perfil as Perfil) ?? 'visualizador',
    ativo:  data?.ativo ?? true,
  }
}

// Retorna a sessão ou uma Response de erro (401/403).
// Uso: const sessao = await exigirPermissao('gerar'); if (sessao instanceof Response) return sessao;
export async function exigirPermissao(acao: string): Promise<SessaoServidor | Response> {
  const sessao = await getSessaoServidor()
  if (!sessao) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (!sessao.ativo) {
    return Response.json({ error: 'Usuário inativo' }, { status: 403 })
  }
  if (!temPermissao(sessao.perfil, acao)) {
    return Response.json({ error: 'Sem permissão' }, { status: 403 })
  }
  return sessao
}
