'use client'
import { useState, useCallback } from 'react'
import {
  normalizeSiatPayload,
  summarizeSiat,
  type SiatRow,
  type SiatFilters,
  type SiatSummary,
} from '@/lib/siat'

export function useCopyToClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false)
  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), timeout)
  }
  return { copied, copy }
}

export interface ImportResult {
  nfs:      number  // back-compat: total de NFs únicas (= summary.totalNFs)
  peso:     number  // back-compat: peso em toneladas (= summary.pesoTotalToneladas)
  veiculos: number  // back-compat: veículos únicos (= summary.veiculosUnicos)
  rows:     SiatRow[]
  summary:  SiatSummary
}

interface ImportState {
  running:  boolean
  step:     string
  progress: number
  result?:  ImportResult
  error?:   string
}

export function useImport() {
  const [state, setState] = useState<ImportState>({
    running: false, step: '', progress: 0,
  })

  const runImport = useCallback(async (filters: SiatFilters = {}) => {
    setState({ running: true, step: 'Conectando ao SIAT via n8n...', progress: 15 })

    try {
      setState(prev => ({ ...prev, step: 'Executando query SQL no SIAT...', progress: 40 }))

      const qs = new URLSearchParams()
      if (filters.dataInicio) qs.set('dataInicio', filters.dataInicio)
      if (filters.dataFim)    qs.set('dataFim',    filters.dataFim)
      if (filters.situacao)   qs.set('situacao',   filters.situacao)
      if (filters.codigoRota) qs.set('codigoRota', filters.codigoRota)
      if (filters.qtdMaxima)  qs.set('qtdMaxima',  String(filters.qtdMaxima))

      const url = qs.size > 0 ? `/api/siat?${qs}` : '/api/siat'
      const res = await fetch(url, { method: 'GET' })

      setState(prev => ({ ...prev, step: 'Processando resposta...', progress: 75 }))

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const raw     = await res.json()
      const rows    = normalizeSiatPayload(raw)
      const summary = summarizeSiat(rows)

      setState({
        running:  false,
        step:     `Importação concluída · ${summary.totalNFs} NFs · ${summary.veiculosUnicos} veículos`,
        progress: 100,
        result: {
          nfs:      summary.totalNFs,
          peso:     summary.pesoTotalToneladas,
          veiculos: summary.veiculosUnicos,
          rows,
          summary,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erro desconhecido'
      setState({
        running:  false,
        step:     `Falha: ${message}`,
        progress: 0,
        error:    message,
      })
    }
  }, [])

  const reset = useCallback(() => {
    setState({ running: false, step: '', progress: 0 })
  }, [])

  return { ...state, runImport, reset }
}
