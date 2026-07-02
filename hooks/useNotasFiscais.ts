'use client'
import { useMemo, useState } from 'react'
import { useAppData } from '@/components/providers/AppDataProvider'

export type PageSize = 25 | 50 | 100

export interface NfPendenteRow {
  id: string
  n_nfs: string
  destinatario: string
  municipio: string
  municipio_dest: string | null
  tipo_cliente: string
  peso_kg: number
  cond: string
  grade: string
}

interface UseNotasFiscaisResult {
  rows: NfPendenteRow[]
  total: number
  page: number
  pageSize: PageSize
  setPage: (p: number) => void
  setPageSize: (s: PageSize) => void
  loading: boolean
  error: string | null
}

const COND_ORDEM: Record<string, number> = { vermelho: 0, laranja: 1, ok: 2 }

export function useNotasFiscais(defaultPageSize: PageSize = 25): UseNotasFiscaisResult {
  const { nfsPendentes, nfImportState } = useAppData()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSizeState] = useState<PageSize>(defaultPageSize)

  const sorted = useMemo(() => {
    return [...nfsPendentes].sort((a, b) => {
      const condA = COND_ORDEM[a.cond] ?? 3
      const condB = COND_ORDEM[b.cond] ?? 3
      if (condA !== condB) return condA - condB
      return a.numnfs.localeCompare(b.numnfs, undefined, { numeric: true })
    })
  }, [nfsPendentes])

  const total = sorted.length
  const from = page * pageSize

  const rows = useMemo<NfPendenteRow[]>(
    () => sorted.slice(from, from + pageSize).map(nf => ({
      id:             nf.id,
      n_nfs:          nf.numnfs,
      destinatario:   nf.destinatario,
      municipio:      nf.municipio,
      municipio_dest: null,
      tipo_cliente:   nf.tipoCliente,
      peso_kg:        nf.peso,
      cond:           nf.cond,
      grade:          nf.grade,
    })),
    [sorted, from, pageSize],
  )

  function handleSetPage(p: number) {
    setPage(Math.max(0, p))
  }

  function handleSetPageSize(s: PageSize) {
    setPageSizeState(s)
    setPage(0)
  }

  return {
    rows,
    total,
    page,
    pageSize,
    setPage: handleSetPage,
    setPageSize: handleSetPageSize,
    loading: nfImportState.running && nfsPendentes.length === 0,
    error: null,
  }
}
