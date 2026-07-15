import { getAdminClient, type SessaoServidor } from '@/lib/auth-server'

export type EventoLog = 'login' | 'logout' | 'criar' | 'editar' | 'excluir'
export type AreaLog   = 'sessao' | 'usuarios' | 'convites' | 'empresa' | 'configuracoes' | 'webhooks'

interface RegistrarLogParams {
  sessao:      SessaoServidor
  evento:      EventoLog
  area?:       AreaLog
  entidadeId?: string
  descricao?:  string
  dados?:      unknown
  req?:        Request
}

function extrairIp(req?: Request): string | null {
  if (!req) return null
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}

// Nunca lança — uma falha ao gravar o log não pode derrubar a ação principal.
export async function registrarLog({ sessao, evento, area, entidadeId, descricao, dados, req }: RegistrarLogParams): Promise<void> {
  try {
    const sb = getAdminClient()
    await sb.from('logs_atividade').insert({
      user_id:     sessao.userId,
      user_email:  sessao.email,
      user_perfil: sessao.perfil,
      evento,
      area:        area ?? null,
      entidade_id: entidadeId ?? null,
      descricao:   descricao ?? null,
      dados:       dados ?? null,
      ip:          extrairIp(req),
      user_agent:  req?.headers.get('user-agent') ?? null,
    })
  } catch {
    // silencioso — log não pode quebrar a ação principal
  }
}
