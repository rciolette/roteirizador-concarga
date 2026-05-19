'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Motorista, NotaFiscal, Rota, Veiculo } from '@/types'
import type { AppConfig } from '@/types'
import type { SiatFilters, SiatSummary, SiatRow } from '@/lib/siat'
import { normalizeSiatPayload, summarizeSiat, siatRowsToNotasPendentes } from '@/lib/siat'
import { listarMotoristas } from '@/lib/motoristas'
import { listarVeiculos } from '@/lib/veiculos'
import { carregarRotasSupabase } from '@/lib/webhooks'
import { DEFAULT_CONFIG } from '@/lib/data'
import { carregarConfig } from '@/lib/config-store'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface NfImportState {
  running:  boolean
  step:     string
  progress: number
  summary?: SiatSummary
}

export interface AppData {
  motoristas:      Motorista[]
  veiculos:        Veiculo[]
  rotas:           Rota[]
  loadingRotas:    boolean
  nfRows:          SiatRow[]
  nfsPendentes:    NotaFiscal[]
  nfImportState:   NfImportState
  config:          AppConfig
  refresh:         () => Promise<void>
  refreshVeiculos: () => Promise<void>
  importarNFs:     (filters?: SiatFilters) => Promise<void>
  dismissNFImport: () => void
  setRotas:        React.Dispatch<React.SetStateAction<Rota[]>>
  setConfig:       React.Dispatch<React.SetStateAction<AppConfig>>
}

const AppDataContext = createContext<AppData | null>(null)

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData deve ser usado dentro de AppDataProvider')
  return ctx
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [motoristas,    setMotoristas]    = useState<Motorista[]>([])
  const [veiculos,      setVeiculos]      = useState<Veiculo[]>([])
  const [rotas,         setRotas]         = useState<Rota[]>([])
  const [loadingRotas,  setLoadingRotas]  = useState(true)
  const [nfRows,        setNfRows]        = useState<SiatRow[]>([])
  const [nfsPendentes,  setNfsPendentes]  = useState<NotaFiscal[]>([])
  const [config,        setConfig]        = useState<AppConfig>(DEFAULT_CONFIG)
  const [nfImportState, setNfImportState] = useState<NfImportState>({
    running: false, step: '', progress: 0,
  })

  const bootstrapped = useRef(false)

  const refresh = useCallback(async () => {
    setLoadingRotas(true)
    try {
      const rotasDoDia = await carregarRotasSupabase(todayISO())
      setRotas(rotasDoDia)
    } catch {
      // mantém estado atual em caso de falha
    } finally {
      setLoadingRotas(false)
    }
  }, [])

  const refreshVeiculos = useCallback(async () => {
    try {
      const veics = await listarVeiculos()
      setVeiculos(veics)
    } catch { /* silencioso — mantém estado atual */ }
  }, [])

  const importarNFs = useCallback(async (filters: SiatFilters = {}) => {
    setNfImportState({ running: true, step: 'Conectando ao SIAT via n8n...', progress: 15 })

    try {
      setNfImportState(prev => ({ ...prev, step: 'Executando query SQL no SIAT...', progress: 40 }))

      const qs = new URLSearchParams()
      if (filters.dataInicio) qs.set('dataInicio', filters.dataInicio)
      if (filters.dataFim)    qs.set('dataFim',    filters.dataFim)
      if (filters.situacao)   qs.set('situacao',   filters.situacao)
      if (filters.codigoRota) qs.set('codigoRota', filters.codigoRota)
      if (filters.qtdMaxima)  qs.set('qtdMaxima',  String(filters.qtdMaxima))

      const url = qs.size > 0 ? `/api/siat?${qs}` : '/api/siat'
      const res = await fetch(url)

      setNfImportState(prev => ({ ...prev, step: 'Processando notas fiscais...', progress: 75 }))

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
      }

      const raw     = await res.json()
      const rows    = normalizeSiatPayload(raw)
      const summary = summarizeSiat(rows)

      setNfRows(rows)
      setNfsPendentes(siatRowsToNotasPendentes(rows))
      setNfImportState({
        running:  false,
        step:     `${summary.totalNFs} notas fiscais importadas · ${summary.rotasUnicas} rotas`,
        progress: 100,
        summary,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erro desconhecido'
      setNfImportState({ running: false, step: `Falha: ${message}`, progress: 0 })
    }
  }, [])

  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    async function bootstrap() {
      const [mots, veics, cfg] = await Promise.all([
        listarMotoristas().catch(() => [] as Motorista[]),
        listarVeiculos().catch(()    => [] as Veiculo[]),
        carregarConfig().catch(()    => DEFAULT_CONFIG),
      ])
      setMotoristas(mots)
      setVeiculos(veics)
      setConfig(cfg)

      try {
        const rotasDoDia = await carregarRotasSupabase(todayISO())
        setRotas(rotasDoDia)
      } catch {
        // estado vazio em caso de erro
      } finally {
        setLoadingRotas(false)
      }

      // Carrega NFs pendentes do SIAT em background — não bloqueia o render inicial
      importarNFs()
    }

    bootstrap()
  }, [])

  const dismissNFImport = useCallback(() => {
    setNfImportState({ running: false, step: '', progress: 0 })
  }, [])

  return (
    <AppDataContext.Provider value={{
      motoristas, veiculos, rotas, loadingRotas,
      nfRows, nfsPendentes, nfImportState, config,
      refresh, refreshVeiculos, importarNFs, dismissNFImport, setRotas, setConfig,
    }}>
      {children}
    </AppDataContext.Provider>
  )
}
