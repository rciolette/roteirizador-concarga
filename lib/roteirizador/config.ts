// Configuração do agente roteirizador (engine interno vs n8n).
// A EDIÇÃO desta configuração é restrita ao Raphael (rciolette@gmail.com) —
// ver app/api/agente-roteirizador/route.ts. Server-only.
import { getAdminClient } from '@/lib/auth-server'

export type EngineRoteirizador = 'n8n' | 'interno'

export interface AgenteRoteirizadorConfig {
  engine:  EngineRoteirizador
  modelo?: string
}

/** Único e-mail autorizado a ver/editar a configuração do agente. */
export const ADMIN_AGENTE_EMAIL = 'rciolette@gmail.com'

export const CHAVE_CONFIG = 'agente_roteirizador'

// Resolve o engine: env tem precedência (GERAR_ROTAS_ENGINE); depois a config
// salva na tabela `configuracoes`; fallback n8n (comportamento atual).
export async function resolveEngineConfig(): Promise<AgenteRoteirizadorConfig> {
  const env = process.env.GERAR_ROTAS_ENGINE
  if (env === 'interno' || env === 'n8n') return { engine: env, modelo: process.env.OPENAI_MODEL }

  try {
    const admin = getAdminClient()
    const { data } = await admin
      .from('configuracoes')
      .select('valor')
      .eq('chave', CHAVE_CONFIG)
      .single()
    const valor = data?.valor as AgenteRoteirizadorConfig | null
    if (valor?.engine === 'interno' || valor?.engine === 'n8n') return valor
  } catch { /* fallback */ }

  return { engine: 'n8n' }
}

export async function salvarEngineConfig(config: AgenteRoteirizadorConfig): Promise<void> {
  const admin = getAdminClient()
  const { error } = await admin
    .from('configuracoes')
    .upsert({ chave: CHAVE_CONFIG, valor: config }, { onConflict: 'chave' })
  if (error) throw new Error(error.message)
}
