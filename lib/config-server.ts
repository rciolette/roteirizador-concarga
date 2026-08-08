// Configuração lida no servidor. Fica separado de `lib/config-store.ts` porque
// depende de next/headers — se estivesse lá, o Turbopack arrastaria next/headers
// para o bundle de cliente (config-store é importado por componentes 'use client').

import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { WebhookConfig } from '@/lib/config-store'

// Ordem de resolução: env var → tabela `configuracoes` no Supabase → fallback.
// Usa o client de servidor (cookies da sessão) porque o RLS de `configuracoes`
// só libera o role `authenticated`; o client anônimo devolvia zero linhas em
// silêncio e a configuração salva no painel nunca era aplicada.
export async function resolveWebhookUrl(
  key: keyof WebhookConfig,
  envKey: string,
  defaultUrl: string,
): Promise<string> {
  const envUrl = process.env[envKey]
  if (envUrl) return envUrl

  try {
    const sb = await createSupabaseServerClient()
    const { data } = await sb
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'webhooks')
      .single()
    const url = (data?.valor as WebhookConfig | null)?.[key]
    if (url) return url
  } catch { /* usa fallback */ }

  return defaultUrl
}
