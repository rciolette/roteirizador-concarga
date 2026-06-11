import { supabase } from '@/lib/supabase'
import { DEFAULT_CONFIG } from '@/lib/data'
import type { AppConfig } from '@/types'

const LS_KEY = 'concarga_config_v1'

// ── Leitura ──────────────────────────────────────────────────────────────────

export async function carregarConfig(): Promise<AppConfig> {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('chave, valor')

    if (error || !data || data.length === 0) {
      return fromLocalStorage()
    }

    const map: Record<string, unknown> = {}
    for (const row of data) map[row.chave] = row.valor

    return {
      sql:               DEFAULT_CONFIG.sql,
      operacao:          (map.operacao          as AppConfig['operacao'])          ?? DEFAULT_CONFIG.operacao,
      pesos:             mergePesos((map.pesos  as AppConfig['pesos'])             ?? DEFAULT_CONFIG.pesos),
      grades:            (map.grades            as AppConfig['grades'])            ?? DEFAULT_CONFIG.grades,
      instrucaoGlobal:   (map.instrucaoGlobal   as string)                         ?? DEFAULT_CONFIG.instrucaoGlobal,
      instrucoesPorRota: (map.instrucoesPorRota as AppConfig['instrucoesPorRota']) ?? DEFAULT_CONFIG.instrucoesPorRota,
    }
  } catch {
    return fromLocalStorage()
  }
}

// ── Persistência ─────────────────────────────────────────────────────────────

export async function salvarConfig(cfg: AppConfig): Promise<void> {
  // 1. Salva localmente — imediato e sem falha
  toLocalStorage(cfg)

  // 2. Tenta persistir no Supabase via API route (requer SUPABASE_SERVICE_ROLE_KEY)
  try {
    const res = await fetch('/api/config', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cfg),
    })
    if (!res.ok) {
      // Silencioso: localStorage já garantiu a persistência local
    }
  } catch {
    // Sem rede ou rota não existente — localStorage persiste
  }
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

export interface WebhookConfig {
  /** @deprecated — substituído por /api/siat direto (lib/siat-db.ts) */
  siatWebhookUrl:            string
  gerarRotasWebhookUrl:      string
  enviarMotoristaWebhookUrl: string
}

export async function carregarWebhooks(): Promise<WebhookConfig> {
  try {
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'webhooks')
      .single()

    if (data?.valor) return data.valor as WebhookConfig
  } catch { /* usa fallback */ }

  return {
    siatWebhookUrl:            '',
    gerarRotasWebhookUrl:      '',
    enviarMotoristaWebhookUrl: '',
  }
}

export async function salvarWebhooks(wh: WebhookConfig): Promise<void> {
  try {
    await fetch('/api/config/webhooks', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(wh),
    })
  } catch { /* silencioso */ }
}

// Resolução server-side: env var → Supabase config → fallback hardcoded
export async function resolveWebhookUrl(
  key: keyof WebhookConfig,
  envKey: string,
  defaultUrl: string,
): Promise<string> {
  const envUrl = process.env[envKey]
  if (envUrl) return envUrl

  try {
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'webhooks')
      .single()
    const url = (data?.valor as WebhookConfig | null)?.[key]
    if (url) return url
  } catch { /* usa fallback */ }

  return defaultUrl
}

// ── Helpers de configuração ───────────────────────────────────────────────────

// Garante que valores 0 no Supabase não sobrescrevam os defaults de capacidade.
// Isso acontece quando o usuário nunca preencheu os pesos manualmente.
function mergePesos(saved: AppConfig['pesos']): AppConfig['pesos'] {
  const d = DEFAULT_CONFIG.pesos
  return {
    fiorino:     saved.fiorino     || d.fiorino,
    vuc:         saved.vuc         || d.vuc,
    tresQuartos: saved.tresQuartos || d.tresQuartos,
    truck:       saved.truck       || d.truck,
    carreta:     saved.carreta     || d.carreta,
  }
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function fromLocalStorage(): AppConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_CONFIG
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_CONFIG
  }
}

function toLocalStorage(cfg: AppConfig): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg))
  } catch { /* storage cheio */ }
}
