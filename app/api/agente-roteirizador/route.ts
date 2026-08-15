import { getSessaoServidor } from '@/lib/auth-server'
import {
  ADMIN_AGENTE_EMAIL,
  resolveEngineConfig,
  salvarEngineConfig,
  type AgenteRoteirizadorConfig,
} from '@/lib/roteirizador/config'

// Configuração do agente roteirizador — RESTRITA ao rciolette@gmail.com.
// Nem administradores/owners de outros e-mails enxergam ou alteram: o gate é
// pelo e-mail da sessão, não pelo perfil RBAC.
async function exigirAdminAgente(): Promise<Response | null> {
  const sessao = await getSessaoServidor()
  if (!sessao) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (sessao.email?.toLowerCase() !== ADMIN_AGENTE_EMAIL) {
    return Response.json({ error: 'Acesso restrito' }, { status: 403 })
  }
  return null
}

export async function GET() {
  const bloqueio = await exigirAdminAgente()
  if (bloqueio) return bloqueio

  const config = await resolveEngineConfig()
  return Response.json({
    ...config,
    envOverride: process.env.GERAR_ROTAS_ENGINE === 'interno' || process.env.GERAR_ROTAS_ENGINE === 'n8n',
    openaiConfigurada: Boolean(process.env.OPENAI_API_KEY),
  })
}

export async function POST(req: Request) {
  const bloqueio = await exigirAdminAgente()
  if (bloqueio) return bloqueio

  let body: AgenteRoteirizadorConfig
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'payload inválido' }, { status: 400 })
  }
  if (body.engine !== 'interno' && body.engine !== 'n8n') {
    return Response.json({ error: 'engine deve ser "interno" ou "n8n"' }, { status: 400 })
  }
  if (body.engine === 'interno' && !process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'Configure OPENAI_API_KEY na Vercel antes de ativar o engine interno' },
      { status: 400 },
    )
  }

  try {
    await salvarEngineConfig({ engine: body.engine, modelo: body.modelo || undefined })
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'erro ao salvar' }, { status: 500 })
  }
}
