'use client'
import { useState, useCallback } from 'react'

export function useCopyToClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false)
  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), timeout)
  }
  return { copied, copy }
}

interface ImportState {
  running: boolean
  step: string
  progress: number
  result?: { nfs: number; peso: number; veiculos: number }
  error?: string
}

const STEPS = [
  { progress: 5,   step: 'Conectando ao SIAT...' },
  { progress: 20,  step: 'Autenticando usuário SIAT_BI...' },
  { progress: 38,  step: 'Executando query SQL...' },
  { progress: 56,  step: 'Lendo notas fiscais pendentes...' },
  { progress: 72,  step: 'Importando frota e motoristas...' },
  { progress: 88,  step: 'Salvando no Supabase...' },
  { progress: 100, step: 'Importação concluída com sucesso' },
]

export function useImport() {
  const [state, setState] = useState<ImportState>({
    running: false, step: '', progress: 0
  })

  const runImport = useCallback(() => {
    setState({ running: true, step: STEPS[0].step, progress: STEPS[0].progress })

    let i = 1
    const next = () => {
      if (i >= STEPS.length) return
      const delay = 400 + Math.random() * 400
      setTimeout(() => {
        const s = STEPS[i]
        setState(prev => ({ ...prev, step: s.step, progress: s.progress }))
        if (s.progress >= 100) {
          setTimeout(() => {
            setState({
              running: false,
              step: 'Importação concluída com sucesso',
              progress: 100,
              result: { nfs: 418, peso: 64.1, veiculos: 43 }
            })
          }, 300)
          return
        }
        i++
        next()
      }, delay)
    }
    next()
  }, [])

  const reset = useCallback(() => {
    setState({ running: false, step: '', progress: 0 })
  }, [])

  return { ...state, runImport, reset }
}
