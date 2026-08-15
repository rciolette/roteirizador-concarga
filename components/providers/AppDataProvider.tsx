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
import type { MotoristaAtividade } from '@/lib/siat'
import { listarMotoristas } from '@/lib/motoristas'
import { listarVeiculos } from '@/lib/veiculos'
import { carregarRotasSupabase } from '@/lib/webhooks'
import { DEFAULT_CONFIG } from '@/lib/data'
import { carregarConfig } from '@/lib/config-store'
import { useAuth } from '@/components/providers/AuthProvider'

// Atividade recente dos motoristas, direto do SIAT. Falha em silêncio: é um
// recurso de ordenação, não pode impedir a tela de carregar.
async function carregarAtividadeMotoristas(): Promise<MotoristaAtividade[]> {
  try {
    const res = await fetch('/api/siat/motoristas')
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data as MotoristaAtividade[] : []
  } catch {
    return []
  }
}

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
  motoristasAtividade: MotoristaAtividade[]
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
  /** Pedido do Marcelo (11/08/26, item 8): números de NF desmarcados pelo
   *  operador — ficam de fora da próxima geração de rotas mesmo que tenham
   *  vindo do SIAT. */
  nfsDesmarcadas:    Set<string>
  toggleNfDesmarcada: (numnfs: string) => void
  limparNfsDesmarcadas: () => void
  /** Marca ou desmarca várias NFs de uma vez (seleção múltipla no grid). */
  setNfsDesmarcadasBulk: (numnfs: string[], desmarcar: boolean) => void
}

const AppDataContext = createContext<AppData | null>(null)

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData deve ser usado dentro de AppDataProvider')
  return ctx
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth()

  const [motoristas,    setMotoristas]    = useState<Motorista[]>([])
  const [motoristasAtividade, setMotoristasAtividade] = useState<MotoristaAtividade[]>([])
  const [veiculos,      setVeiculos]      = useState<Veiculo[]>([])
  const [rotas,         setRotas]         = useState<Rota[]>([])
  const [loadingRotas,  setLoadingRotas]  = useState(true)
  const [nfRows,        setNfRows]        = useState<SiatRow[]>([])
  const [nfsPendentes,  setNfsPendentes]  = useState<NotaFiscal[]>([])
  const [config,        setConfig]        = useState<AppConfig>(DEFAULT_CONFIG)
  const [nfImportState, setNfImportState] = useState<NfImportState>({
    running: false, step: '', progress: 0,
  })
  const [nfsDesmarcadas, setNfsDesmarcadas] = useState<Set<string>>(new Set())

  const toggleNfDesmarcada = useCallback((numnfs: string) => {
    setNfsDesmarcadas(prev => {
      const next = new Set(prev)
      if (next.has(numnfs)) next.delete(numnfs)
      else next.add(numnfs)
      return next
    })
  }, [])

  const limparNfsDesmarcadas = useCallback(() => setNfsDesmarcadas(new Set()), [])

  const setNfsDesmarcadasBulk = useCallback((numnfs: string[], desmarcar: boolean) => {
    setNfsDesmarcadas(prev => {
      const next = new Set(prev)
      for (const n of numnfs) {
        if (desmarcar) next.add(n)
        else next.delete(n)
      }
      return next
    })
  }, [])

  const bootstrapped   = useRef(false)
  const nfImportedRef  = useRef(false)

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
      console.log('[NF DEBUG] total rows:', rows.length)
      console.log('[NF DEBUG] keys:', Object.keys(rows[0] ?? {}))
      console.log('[NF DEBUG] row[0]:', JSON.stringify(rows[0]))
      console.log('[NF DEBUG] pendentes:', siatRowsToNotasPendentes(rows).length)
      const summary = summarizeSiat(rows)

      const pendentes = siatRowsToNotasPendentes(rows)
      setNfRows(rows)
      setNfsPendentes(pendentes)
      setNfsDesmarcadas(new Set()) // nova importação zera as desmarcações anteriores

      // Pré-aquece o cache de geocoding em background (fire-and-forget)
      const addrs = pendentes
        .map(nf => [nf.municipio, nf.bairro, nf.cep].filter(p => p && p !== '—').join(', '))
        .filter(Boolean)
      if (addrs.length) {
        fetch('/api/geocode', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ addresses: addrs }),
        }).catch(() => {})
      }

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

  // Bootstrap só depois da autenticação: motoristas, veículos e configurações
  // vivem atrás de RLS liberado apenas para o role `authenticated`. Rodar antes
  // da sessão existir devolvia listas vazias em silêncio (RLS filtra linhas sem
  // gerar erro), deixando o diálogo "Gerar rotas" sem motorista nem veículo.
  useEffect(() => {
    if (!usuario || bootstrapped.current) return
    bootstrapped.current = true

    async function bootstrap() {
      const [mots, veics, cfg, atividade] = await Promise.all([
        listarMotoristas().catch(() => [] as Motorista[]),
        listarVeiculos().catch(()    => [] as Veiculo[]),
        carregarConfig().catch(()    => DEFAULT_CONFIG),
        carregarAtividadeMotoristas(),
      ])
      setMotoristas(mots)
      setVeiculos(veics)
      setConfig(cfg)
      setMotoristasAtividade(atividade)

      try {
        const rotasDoDia = await carregarRotasSupabase(todayISO())
        setRotas(rotasDoDia)
      } catch {
        // estado vazio em caso de erro
      } finally {
        setLoadingRotas(false)
      }
    }

    bootstrap()
  }, [usuario])

  // Dispara a consulta ao SIAT assim que o usuário estiver autenticado,
  // garantindo que a sessão já está disponível no servidor ao chamar /api/siat.
  useEffect(() => {
    if (!usuario || nfImportedRef.current) return
    nfImportedRef.current = true
    importarNFs()
  }, [usuario, importarNFs])

  const dismissNFImport = useCallback(() => {
    setNfImportState({ running: false, step: '', progress: 0 })
  }, [])

  return (
    <AppDataContext.Provider value={{
      motoristas, motoristasAtividade, veiculos, rotas,
      // sem sessão o bootstrap nem roda — não faz sentido exibir spinner
      loadingRotas: usuario ? loadingRotas : false,
      nfRows, nfsPendentes, nfImportState, config,
      refresh, refreshVeiculos, importarNFs, dismissNFImport, setRotas, setConfig,
      nfsDesmarcadas, toggleNfDesmarcada, limparNfsDesmarcadas, setNfsDesmarcadasBulk,
    }}>
      {children}
    </AppDataContext.Provider>
  )
}
