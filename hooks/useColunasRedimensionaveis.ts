'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Larguras de coluna ajustáveis arrastando a borda do cabeçalho.
 *
 * A preferência fica no localStorage por tabela — é ajuste de quem está
 * olhando a tela, não dado de operação, então não vai para o Supabase.
 */

export interface ColunaDef {
  /** Chave estável — muda de posição sem perder a largura salva. */
  key:    string
  label:  string
  /** Largura inicial em px. */
  largura: number
  /** Abaixo disso o conteúdo vira ilegível. */
  min?:   number
}

const MIN_PADRAO = 48
const MAX        = 640

export function useColunasRedimensionaveis(storageKey: string, defs: ColunaDef[]) {
  const padrao = useCallback(
    () => Object.fromEntries(defs.map(d => [d.key, d.largura])) as Record<string, number>,
    [defs],
  )

  const [larguras, setLarguras] = useState<Record<string, number>>(padrao)
  const [arrastando, setArrastando] = useState<string | null>(null)

  // Carrega depois da montagem: no SSR não existe localStorage, e ler durante
  // o render causaria divergência de hidratação.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(storageKey)
      if (!salvo) return
      const obj = JSON.parse(salvo) as Record<string, number>
      // Só chaves conhecidas — colunas removidas do código não voltam.
      const limpo: Record<string, number> = {}
      for (const d of defs) {
        const v = obj[d.key]
        if (typeof v === 'number' && Number.isFinite(v)) {
          limpo[d.key] = Math.min(MAX, Math.max(d.min ?? MIN_PADRAO, v))
        }
      }
      if (Object.keys(limpo).length) setLarguras(l => ({ ...l, ...limpo }))
    } catch {
      // localStorage indisponível (aba privada, storage bloqueado): usa o padrão
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  const persistir = useCallback((valor: Record<string, number>) => {
    try { localStorage.setItem(storageKey, JSON.stringify(valor)) } catch { /* ignora */ }
  }, [storageKey])

  // Guardamos em ref para o listener de mousemove não recriar a cada pixel.
  const drag = useRef<{ key: string; xInicial: number; larguraInicial: number; min: number } | null>(null)

  const iniciarArraste = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const def = defs.find(d => d.key === key)
    drag.current = {
      key,
      xInicial: e.clientX,
      larguraInicial: larguras[key] ?? def?.largura ?? 120,
      min: def?.min ?? MIN_PADRAO,
    }
    setArrastando(key)
  }, [defs, larguras])

  useEffect(() => {
    if (!arrastando) return

    function mover(e: MouseEvent) {
      const d = drag.current
      if (!d) return
      const nova = Math.min(MAX, Math.max(d.min, d.larguraInicial + (e.clientX - d.xInicial)))
      setLarguras(l => (l[d.key] === nova ? l : { ...l, [d.key]: nova }))
    }
    function soltar() {
      drag.current = null
      setArrastando(null)
      setLarguras(l => { persistir(l); return l })
    }

    document.addEventListener('mousemove', mover)
    document.addEventListener('mouseup', soltar)
    // Enquanto arrasta, o cursor não deve virar "texto" ao passar pela tabela.
    const cursorAntes = document.body.style.cursor
    const selectAntes = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', mover)
      document.removeEventListener('mouseup', soltar)
      document.body.style.cursor = cursorAntes
      document.body.style.userSelect = selectAntes
    }
  }, [arrastando, persistir])

  const restaurar = useCallback(() => {
    const p = padrao()
    setLarguras(p)
    try { localStorage.removeItem(storageKey) } catch { /* ignora */ }
  }, [padrao, storageKey])

  const alterado = defs.some(d => (larguras[d.key] ?? d.largura) !== d.largura)

  return { larguras, iniciarArraste, arrastando, restaurar, alterado }
}
