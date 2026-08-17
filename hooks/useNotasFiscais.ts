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
  bairro: string
  tipo_cliente: string
  peso_kg: number
  cond: string
  grade: string
  rota: string
  observacao: string | null
  ind_ree: boolean
  solucao_sac: string | null
  remetente: string | null
  /** false quando o operador desmarcou a nota da roteirização (item 8). */
  selecionada: boolean
  /** true quando esta linha repete o destinatário da anterior, já ordenado (item 10). */
  mesmoDestAnterior: boolean
}

// Pedido do Marcelo (11/08/26, item 7): filtros sobre as notas pendentes antes
// de gerar as rotas.
export interface NotasFiltros {
  regiao:       string
  solucaoSac:   string
  tipoCarga:    string
  rota:         string
  municipio:    string
  bairro:       string
  tipoCliente:  string
  remetente:    string
}

const FILTROS_VAZIOS: NotasFiltros = {
  regiao: '', solucaoSac: '', tipoCarga: '', rota: '', municipio: '', bairro: '', tipoCliente: '', remetente: '',
}

interface UseNotasFiscaisResult {
  rows: NfPendenteRow[]
  total: number
  totalDesmarcadas: number
  page: number
  pageSize: PageSize
  setPage: (p: number) => void
  setPageSize: (s: PageSize) => void
  loading: boolean
  error: string | null
  filtros: NotasFiltros
  setFiltro: (campo: keyof NotasFiltros, valor: string) => void
  limparFiltros: () => void
  opcoesFiltro: Record<keyof NotasFiltros, string[]>
  toggleSelecionada: (numnfs: string) => void
  limparDesmarcacoes: () => void
  /** Seleção múltipla: quantas NFs do conjunto filtrado estão selecionadas. */
  totalFiltradasSelecionadas: number
  /** Marca todas as NFs do filtro atual para roteirização. */
  marcarFiltradas: () => void
  /** Desmarca todas as NFs do filtro atual da roteirização. */
  desmarcarFiltradas: () => void
  /** Conjunto completo (não paginado) das NFs filtradas — usado na prévia do mapa. */
  notasFiltradas: import('@/types').NotaFiscal[]
  /** NFs desmarcadas da roteirização (para o mapa esmaecer). */
  desmarcadas: Set<string>
}

function opcoesUnicas(valores: (string | undefined)[]): string[] {
  return [...new Set(valores.filter((v): v is string => Boolean(v) && v !== '—'))].sort()
}

export function useNotasFiscais(defaultPageSize: PageSize = 25): UseNotasFiscaisResult {
  const { nfsPendentes, nfImportState, nfsDesmarcadas, toggleNfDesmarcada, limparNfsDesmarcadas, setNfsDesmarcadasBulk } = useAppData()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSizeState] = useState<PageSize>(defaultPageSize)
  const [filtros, setFiltros] = useState<NotasFiltros>(FILTROS_VAZIOS)

  const opcoesFiltro = useMemo(() => ({
    regiao:      opcoesUnicas(nfsPendentes.map(n => n.regiao)),
    solucaoSac:  opcoesUnicas(nfsPendentes.map(n => n.solucaoSac)),
    tipoCarga:   opcoesUnicas(nfsPendentes.map(n => n.grade)),
    rota:        opcoesUnicas(nfsPendentes.map(n => n.rota)),
    municipio:   opcoesUnicas(nfsPendentes.map(n => n.municipio)),
    bairro:      opcoesUnicas(nfsPendentes.map(n => n.bairro)),
    tipoCliente: opcoesUnicas(nfsPendentes.map(n => n.tipoCliente)),
    remetente:   opcoesUnicas(nfsPendentes.map(n => n.remetente)),
  }), [nfsPendentes])

  const filtradas = useMemo(() => {
    return nfsPendentes.filter(n =>
      (!filtros.regiao      || n.regiao      === filtros.regiao) &&
      (!filtros.solucaoSac  || n.solucaoSac  === filtros.solucaoSac) &&
      (!filtros.tipoCarga   || n.grade       === filtros.tipoCarga) &&
      (!filtros.rota        || n.rota        === filtros.rota) &&
      (!filtros.municipio   || n.municipio   === filtros.municipio) &&
      (!filtros.bairro      || n.bairro      === filtros.bairro) &&
      (!filtros.tipoCliente || n.tipoCliente === filtros.tipoCliente) &&
      (!filtros.remetente   || n.remetente   === filtros.remetente),
    )
  }, [nfsPendentes, filtros])

  // Pedido do Marcelo (item 10): ordenado por Tipo Carga / Rota / Destinatário.
  const sorted = useMemo(() => {
    return [...filtradas].sort((a, b) =>
      (a.grade || '').localeCompare(b.grade || '') ||
      (a.rota  || '').localeCompare(b.rota  || '') ||
      a.destinatario.localeCompare(b.destinatario, undefined, { numeric: true }),
    )
  }, [filtradas])

  const total = sorted.length
  const from = page * pageSize

  const rows = useMemo<NfPendenteRow[]>(
    () => sorted.slice(from, from + pageSize).map((nf, i, arr) => ({
      id:                nf.id,
      n_nfs:             nf.numnfs,
      destinatario:      nf.destinatario,
      municipio:         nf.municipio,
      municipio_dest:    null,
      bairro:            nf.bairro,
      tipo_cliente:      nf.tipoCliente,
      peso_kg:           nf.peso,
      cond:              nf.cond,
      grade:             nf.grade,
      rota:              nf.rota,
      observacao:        nf.observacao ?? null,
      ind_ree:           nf.indRee,
      solucao_sac:       nf.solucaoSac ?? null,
      remetente:         nf.remetente ?? null,
      selecionada:       !nfsDesmarcadas.has(nf.numnfs),
      mesmoDestAnterior: i > 0 && arr[i - 1].destinatario === nf.destinatario,
    })),
    [sorted, from, pageSize, nfsDesmarcadas],
  )

  function handleSetPage(p: number) {
    setPage(Math.max(0, p))
  }

  function handleSetPageSize(s: PageSize) {
    setPageSizeState(s)
    setPage(0)
  }

  function setFiltro(campo: keyof NotasFiltros, valor: string) {
    setFiltros(prev => ({ ...prev, [campo]: valor }))
    setPage(0)
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS)
    setPage(0)
  }

  // Seleção múltipla sobre o conjunto FILTRADO inteiro (não só a página atual).
  const numsFiltradas = useMemo(() => sorted.map(n => n.numnfs), [sorted])
  const totalFiltradasSelecionadas = useMemo(
    () => numsFiltradas.reduce((acc, n) => acc + (nfsDesmarcadas.has(n) ? 0 : 1), 0),
    [numsFiltradas, nfsDesmarcadas],
  )

  function marcarFiltradas() {
    setNfsDesmarcadasBulk(numsFiltradas, false)
  }

  function desmarcarFiltradas() {
    setNfsDesmarcadasBulk(numsFiltradas, true)
  }

  return {
    rows,
    total,
    totalDesmarcadas: nfsDesmarcadas.size,
    page,
    pageSize,
    setPage: handleSetPage,
    setPageSize: handleSetPageSize,
    loading: nfImportState.running && nfsPendentes.length === 0,
    error: null,
    filtros,
    setFiltro,
    limparFiltros,
    opcoesFiltro,
    toggleSelecionada: toggleNfDesmarcada,
    limparDesmarcacoes: limparNfsDesmarcadas,
    totalFiltradasSelecionadas,
    marcarFiltradas,
    desmarcarFiltradas,
    notasFiltradas: sorted,
    desmarcadas: nfsDesmarcadas,
  }
}
