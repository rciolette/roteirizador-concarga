import { exigirPermissao, getAdminClient } from '@/lib/auth-server'

const RETENCAO_DIAS = 90
const LIMITE_PADRAO  = 50

// GET /api/logs — resumo de acessos por usuário + eventos de auditoria (owner-only)
export async function GET(req: Request) {
  const auth = await exigirPermissao('logs')
  if (auth instanceof Response) return auth

  const sb = getAdminClient()

  // Retenção de 90 dias — limpeza oportunista (sem pg_cron instalado no projeto)
  const limiteRetencao = new Date(Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000).toISOString()
  await sb.from('logs_atividade').delete().lt('criado_em', limiteRetencao)

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const area   = searchParams.get('area')
  const desde  = searchParams.get('desde')
  const ate    = searchParams.get('ate')
  const limit  = Math.min(200, Number(searchParams.get('limit')) || LIMITE_PADRAO)
  const offset = Number(searchParams.get('offset')) || 0

  // ── Resumo por usuário: perfis + e-mails (Auth Admin API) + primeiro/último login ──
  const { data: perfis, error: perfisError } = await sb
    .from('perfis_usuario')
    .select('user_id, perfil, nome, ativo, criado_em')
    .order('criado_em', { ascending: true })
  if (perfisError) return Response.json({ error: perfisError.message }, { status: 500 })

  const { data: { users }, error: usersError } = await sb.auth.admin.listUsers()
  if (usersError) return Response.json({ error: usersError.message }, { status: 500 })
  const userPorId = Object.fromEntries(users.map(u => [u.id, u]))

  const { data: logins } = await sb
    .from('logs_atividade')
    .select('user_id, criado_em')
    .eq('evento', 'login')

  const primeiroPorUsuario: Record<string, string> = {}
  const ultimoPorUsuario:   Record<string, string> = {}
  for (const l of logins ?? []) {
    if (!l.user_id) continue
    if (!primeiroPorUsuario[l.user_id] || l.criado_em < primeiroPorUsuario[l.user_id]) primeiroPorUsuario[l.user_id] = l.criado_em
    if (!ultimoPorUsuario[l.user_id]   || l.criado_em > ultimoPorUsuario[l.user_id])   ultimoPorUsuario[l.user_id] = l.criado_em
  }

  const usuarios = (perfis ?? []).map(p => {
    const u = userPorId[p.user_id]
    return {
      id:             p.user_id,
      email:          u?.email ?? '',
      nome:           p.nome,
      perfil:         p.perfil,
      ativo:          p.ativo,
      criadoEm:       u?.created_at ?? p.criado_em,
      // Fallback para dados nativos do Supabase Auth enquanto o histórico próprio (logs_atividade) ainda não acumulou eventos.
      primeiroAcesso: primeiroPorUsuario[p.user_id] ?? u?.confirmed_at ?? null,
      ultimoAcesso:   ultimoPorUsuario[p.user_id]   ?? u?.last_sign_in_at ?? null,
    }
  })

  // ── Eventos (paginado, com filtros) ──
  let query = sb
    .from('logs_atividade')
    .select('id, user_id, user_email, user_perfil, evento, area, entidade_id, descricao, ip, user_agent, criado_em', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(offset, offset + limit - 1)

  if (userId) query = query.eq('user_id', userId)
  if (area)   query = query.eq('area', area)
  if (desde)  query = query.gte('criado_em', desde)
  if (ate)    query = query.lte('criado_em', ate)

  const { data: eventos, count, error: eventosError } = await query
  if (eventosError) return Response.json({ error: eventosError.message }, { status: 500 })

  return Response.json({ usuarios, eventos, totalEventos: count ?? 0 })
}
