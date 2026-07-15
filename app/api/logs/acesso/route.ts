import { getSessaoServidor } from '@/lib/auth-server'
import { registrarLog } from '@/lib/log-atividade'

// POST /api/logs/acesso — registra login/logout do usuário autenticado.
// Não é gated por permissão: qualquer usuário logado registra o próprio acesso.
export async function POST(req: Request) {
  const sessao = await getSessaoServidor()
  if (!sessao) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const evento = body?.evento === 'logout' ? 'logout' : 'login'

  await registrarLog({ sessao, evento, area: 'sessao', req })
  return Response.json({ ok: true })
}
