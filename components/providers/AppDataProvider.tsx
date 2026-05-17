'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Motorista, Rota, Veiculo } from '@/types'
import type { SiatFilters, SiatSummary } from '@/lib/siat'
import { normalizeSiatPayload, siatRowsToRotas, summarizeSiat } from '@/lib/siat'
import { listarMotoristas } from '@/lib/motoristas'
import { listarVeiculos } from '@/lib/veiculos'
import { limparRascunhosDoDia, salvarRotasSupabase, salvarNfsNaoAlocadas } from '@/lib/webhooks'

const REFRESH_INTERVAL_MS = 10 * 60 * 1000 // 10 minutos

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function cacheKey(): string {
  return `siat-import:${todayISO()}`
}

interface ImportState {
  running:  boolean
  step:     string
  progress: number
  summary?: SiatSummary
  error?:   string
}

export interface AppData {
  motoristas:     Motorista[]
  veiculos:       Veiculo[]
  rotas:          Rota[]
  importState:    ImportState
  refresh:        (filters?: SiatFilters) => Promise<void>
  dismissImport:  () => void
  setRotas:       React.Dispatch<React.SetStateAction<Rota[]>>
}

const AppDataContext = createContext<AppData | null>(null)

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData deve ser usado dentro de AppDataProvider')
  return ctx
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [veiculos,   setVeiculos]   = useState<Veiculo[]>([])
  const [rotas,      setRotas]      = useState<Rota[]>([])
  const [importState, setImportState] = useState<ImportState>({
    running: false, step: '', progress: 0,
  })

  // Evitar duplo disparo no StrictMode
  const bootstrapped = useRef(false)

  const runImport = useCallback(async (
    filters: SiatFilters = {},
    motPool: Motorista[],
    veicPool: Veiculo[],
    forceRefresh = false,
  ) => {
    const today = todayISO()

    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey())
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { rotas: Rota[]; summary: SiatSummary }
          setRotas(parsed.rotas)
          setImportState({
            running:  false,
            step:     `Cache do dia · ${parsed.summary.totalNFs} NFs`,
            progress: 100,
            summary:  parsed.summary,
          })
          return
        } catch {
          sessionStorage.removeItem(cacheKey())
        }
      }
    }

    setImportState({ running: true, step: 'Conectando ao SIAT via n8n...', progress: 15 })

    try {
      setImportState(prev => ({ ...prev, step: 'Executando query SQL no SIAT...', progress: 40 }))

      const qs = new URLSearchParams()
      if (filters.dataInicio) qs.set('dataInicio', filters.dataInicio)
      if (filters.dataFim)    qs.set('dataFim',    filters.dataFim)
      if (filters.situacao)   qs.set('situacao',   filters.situacao)
      if (filters.codigoRota) qs.set('codigoRota', filters.codigoRota)
      if (filters.qtdMaxima)  qs.set('qtdMaxima',  String(filters.qtdMaxima))

      const url = qs.size > 0 ? `/api/siat?${qs}` : '/api/siat'
      const res = await fetch(url, { method: 'GET' })

      setImportState(prev => ({ ...prev, step: 'Processando resposta...', progress: 75 }))

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const raw     = await res.json()
      const rows    = normalizeSiatPayload(raw)
      const summary = summarizeSiat(rows)
      const rotasDia = siatRowsToRotas(rows, veicPool, motPool)

      // Persistir no Supabase
      setImportState(prev => ({ ...prev, step: 'Salvando no Supabase...', progress: 88 }))
      await limparRascunhosDoDia(today)
      const rotasSalvas = await salvarRotasSupabase(rotasDia, today)

      // NFs sem rota alocada (sem ROTA no payload)
      const nfsSemRota = rows
        .filter(r => r.NUMNFS != null && !r.ROTA)
        .map(r => Number(r.NUMNFS))
        .filter(n => !isNaN(n))
      if (nfsSemRota.length > 0) {
        await salvarNfsNaoAlocadas(nfsSemRota, today, 'Sem rota no SIAT')
      }

      setRotas(rotasSalvas)

      // Cache em sessionStorage para o dia
      sessionStorage.setItem(cacheKey(), JSON.stringify({ rotas: rotasSalvas, summary }))

      setImportState({
        running:  false,
        step:     `Importação concluída · ${summary.totalNFs} NFs · ${summary.veiculosUnicos} veículos`,
        progress: 100,
        summary,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erro desconhecido'
      setImportState({ running: false, step: `Falha: ${message}`, progress: 0, error: message })
    }
  }, [])

  const refresh = useCallback(async (filters?: SiatFilters) => {
    // Recarrega pools do Supabase antes do re-import para ter dados frescos
    const [mots, veics] = await Promise.all([listarMotoristas(), listarVeiculos()]).catch(() => [motoristas, veiculos])
    setMotoristas(mots)
    setVeiculos(veics)
    await runImport(filters ?? {}, mots, veics, true)
  }, [motoristas, veiculos, runImport])

  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    async function bootstrap() {
      const [mots, veics] = await Promise.all([
        listarMotoristas().catch(() => [] as Motorista[]),
        listarVeiculos().catch(()  => [] as Veiculo[]),
      ])
      setMotoristas(mots)
      setVeiculos(veics)
      await runImport({}, mots, veics, false)
    }

    bootstrap()
  }, [runImport])

  const dismissImport = useCallback(() => {
    setImportState({ running: false, step: '', progress: 0 })
  }, [])

  // Refresh periódico enquanto o painel está aberto
  useEffect(() => {
    const id = setInterval(() => {
      refresh()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  return (
    <AppDataContext.Provider value={{ motoristas, veiculos, rotas, importState, refresh, dismissImport, setRotas }}>
      {children}
    </AppDataContext.Provider>
  )
}
