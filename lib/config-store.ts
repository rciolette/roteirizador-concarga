import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { DEFAULT_CONFIG } from '@/lib/data'
import type { AppConfig } from '@/types'

const LS_KEY = 'concarga_config_v1'

// ── Leitura ──────────────────────────────────────────────────────────────────

export async function carregarConfig(): Promise<AppConfig> {
  try {
    const { data, error } = await getSupabaseBrowser()
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
      grades:            (map.grades            as AppConfig['grades'])            ?? DEFAULT_CONFIG.grades,
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
