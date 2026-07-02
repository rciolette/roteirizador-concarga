'use client'
import { useState, useEffect, useRef } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

export type PageSize = 25 | 50 | 100

export interface NfPendenteRow {
  id: string
  n_nfs: number | null
  destinatario: string | null
  municipio: string | null
  municipio_dest: string | null
  bairro: string | null
  bairro_dest: string | null
  tipo_cliente: string | null
  peso_kg: number | null
  peso_bruto: number | null
  cond: string | null
  grade: string | null
  reentrega: boolean | null
  sac: string | number | null
  regiao: string | null
  placa: string | null
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
  reload: () => void
}

export function useNotasFiscais(defaultPageSize: PageSize = 25): UseNotasFiscaisResult {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<PageSize>(defaultPageSize)
  const [rows, setRows] = useState<NfPendenteRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const prevRows = useRef<NfPendenteRow[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const from = page * pageSize
    const to = from + pageSize - 1

    getSupabaseBrowser()
      .from('notas_fiscais')
      .select(
        'id, n_nfs, destinatario, municipio, municipio_dest, bairro, bairro_dest, tipo_cliente, peso_kg, peso_bruto, cond, grade, reentrega, sac, regiao, placa',
        { count: 'exact' },
      )
      .is('rota_id', null)
      .order('cond', { ascending: false })
      .order('n_nfs', { ascending: true })
      .range(from, to)
      .then(({ data, count, error: err }: { data: NfPendenteRow[] | null; count: number | null; error: { message: string } | null }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }
        prevRows.current = (data ?? []) as NfPendenteRow[]
        setRows(prevRows.current)
        setTotal(count ?? 0)
        setError(null)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [page, pageSize, tick])

  function handleSetPageSize(s: PageSize) {
    setPageSize(s)
    setPage(0)
  }

  return {
    rows,
    total,
    page,
    pageSize,
    setPage,
    setPageSize: handleSetPageSize,
    loading,
    error,
    reload: () => setTick(t => t + 1),
  }
}
