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
  /** Data de emissão (YYYY-MM-DD) — coluna Emissão (Marcelo, 21/08). */
  emissao: string | null
  /** Data de agendamento (YYYY-MM-DD) — importante p/ prioridade (Marcelo, 21/08). */
  agenda: string | null
  /** Endereço de ENTREGA (já considera o alternativo p/ Cozinha). */
  endereco: string
  /** Nº de vezes que a NF retornou; 0 = nunca (coluna Reent., Marcelo 21/08). */
  indice_reentrega: number
  /** Placa (ou código) da rota já montada que contém esta NF — null se em nenhuma. */
  em_rota: string | null
  /** true quando a NF tem Solução SAC preenchida ≠ reentrega — analisar antes de incluir em rota (Marcelo, 17/08). */
  alertaSac: boolean
  /** false quando o operador desmarcou a nota da roteirização (item 8). */
  selecionada: boolean
  /** true quando esta linha repete o destinatário da anterior, já ordenado (item 10). */
  mesmoDestAnterior: boolean
  /** Quantas NFs da página vão para o MESMO destinatário (1 = entrega única). */
  qtdMesmoDest: number
}

// Filtros MULTI-SELEÇÃO (Marcelo, 21/08): cada campo aceita várias opções ao
// mesmo tempo, como os slicers da planilha. Array vazio = sem filtro.
export interface NotasFiltros {
  solucaoSac:   string[]
  tipoCarga:    string[]
  rota:         string[]
  municipio:    string[]
  bairro:       string[]
  tipoCliente:  string[]
  remetente:    string[]
  /** Segmentadores acrescentados pelo Marcelo na planilha (03/09). */
  destinatario: string[]
  placa:        string[]
  reentrega:    string[]
  /** Região continua no código (mapa/futuro), mas SEM UI — Marcelo 21/08. */
  regiao:       string[]
}

/** Opção de um segmentador, com quantas notas do recorte atual ela cobre. */
export interface OpcaoFiltro {
  valor: string
  count: number
}

/** Opção especial do filtro Solução SAC: notas SEM solução preenchida. */
export const SAC_VAZIO = '(Vazio)'

// Segmentação PADRÃO da rotina (Marcelo, 21/08): SAC Vazio + Reentrega.
// "Limpar filtros" volta para ESTE padrão — nunca limpa a segmentação do SAC.
export function filtrosPadrao(): NotasFiltros {
  return {
    solucaoSac: [SAC_VAZIO, 'REENTREGA'],
    tipoCarga: [], rota: [], municipio: [], bairro: [], tipoCliente: [], remetente: [], regiao: [],
    destinatario: [], placa: [], reentrega: [],
  }
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
  /** Liga/desliga uma opção de um filtro multi-seleção. */
  toggleFiltro: (campo: keyof NotasFiltros, valor: string) => void
  /** Limpa um campo específico do filtro. */
  limparFiltro: (campo: keyof NotasFiltros) => void
  /** Volta TODOS os filtros ao padrão (SAC Vazio+Reentrega preservado). */
  limparFiltros: () => void
  opcoesFiltro: Record<keyof NotasFiltros, OpcaoFiltro[]>
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
  /** Incluir rotas parciais 996/999 na listagem (padrão: ocultas). */
  incluirParciais: boolean
  setIncluirParciais: (v: boolean) => void
}

function opcoesUnicas(valores: (string | undefined)[]): string[] {
  return [...new Set(valores.filter((v): v is string => Boolean(v) && v !== '—'))].sort()
}

/** Rotas parciais 996/999 ficam fora da listagem padrão (Marcelo, 17/08). */
function isRotaParcial(rota: string | undefined): boolean {
  const cod = (rota ?? '').trim()
  return cod.startsWith('996') || cod.startsWith('999')
}

/** Solução SAC preenchida que não é reentrega → alerta "analisar antes de incluir". */
function temAlertaSac(n: { solucaoSac?: string; indRee: boolean }): boolean {
  if (!n.solucaoSac) return false
  if (n.indRee) return false
  return n.solucaoSac.trim().toUpperCase() !== 'REENTREGA'
}

const norm = (s: string | undefined) => (s ?? '').trim().toUpperCase()

export function useNotasFiscais(defaultPageSize: PageSize = 25): UseNotasFiscaisResult {
  const { nfsPendentes, nfImportState, nfsDesmarcadas, toggleNfDesmarcada, limparNfsDesmarcadas, setNfsDesmarcadasBulk, rotas } = useAppData()

  // Coluna Placa (Marcelo, 21/08): em qual rota já montada a NF está — para o
  // operador ver e poder tirar/mover na aprovação.
  const rotaPorNf = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rotas) {
      if (r.status === 'rejeitada') continue
      const marcador = r.veiculo?.placa || r.codigoRota
      for (const nf of r.notasFiscais) {
        if (!m.has(nf.numnfs)) m.set(nf.numnfs, marcador)
      }
    }
    return m
  }, [rotas])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSizeState] = useState<PageSize>(defaultPageSize)
  const [filtros, setFiltros] = useState<NotasFiltros>(filtrosPadrao)
  // Rotas 996/999 (parciais) só entram quando o operador pedir (Marcelo, 17/08).
  const [incluirParciais, setIncluirParciais] = useState(false)

  // Base da listagem: sem as rotas parciais, a menos que o operador inclua.
  const base = useMemo(
    () => incluirParciais ? nfsPendentes : nfsPendentes.filter(n => !isRotaParcial(n.rota)),
    [nfsPendentes, incluirParciais],
  )

  // Predicado de um filtro individual (multi-seleção; array vazio = passa tudo).
  // Solução SAC tem a opção especial "(Vazio)" = notas sem solução preenchida.
  const passa = useMemo(() => {
    const multi = (sel: string[], valor: string | undefined) =>
      sel.length === 0 || sel.some(s => norm(s) === norm(valor))
    return {
      solucaoSac: (n: typeof base[number]) => {
        if (filtros.solucaoSac.length === 0) return true
        if (!n.solucaoSac) return filtros.solucaoSac.includes(SAC_VAZIO)
        return filtros.solucaoSac.some(s => s !== SAC_VAZIO && norm(s) === norm(n.solucaoSac))
      },
      tipoCarga:   (n: typeof base[number]) => multi(filtros.tipoCarga,   n.grade),
      rota:        (n: typeof base[number]) => multi(filtros.rota,        n.rota),
      municipio:   (n: typeof base[number]) => multi(filtros.municipio,   n.municipio),
      bairro:      (n: typeof base[number]) => multi(filtros.bairro,      n.bairro),
      tipoCliente: (n: typeof base[number]) => multi(filtros.tipoCliente, n.tipoCliente),
      remetente:   (n: typeof base[number]) => multi(filtros.remetente,   n.remetente),
      regiao:      (n: typeof base[number]) => multi(filtros.regiao,      n.regiao),
      destinatario:(n: typeof base[number]) => multi(filtros.destinatario, n.destinatario),
      placa:       (n: typeof base[number]) => multi(filtros.placa,       rotaPorNf.get(n.numnfs) ?? undefined),
      reentrega:   (n: typeof base[number]) => multi(filtros.reentrega,   String(n.indiceReentrega ?? 0)),
    }
  }, [filtros])

  // Filtros em CASCATA (Marcelo, 17/08): as opções de cada seletor são
  // calculadas sobre as notas que passam em todos os OUTROS filtros.
  const opcoesFiltro = useMemo(() => {
    const campos = Object.keys(passa) as (keyof NotasFiltros)[]
    const valor: Record<keyof NotasFiltros, (n: typeof base[number]) => string | undefined> = {
      solucaoSac:  n => n.solucaoSac,
      tipoCarga:   n => n.grade,
      rota:        n => n.rota,
      municipio:   n => n.municipio,
      bairro:      n => n.bairro,
      tipoCliente: n => n.tipoCliente,
      remetente:   n => n.remetente,
      regiao:      n => n.regiao,
      destinatario:n => n.destinatario,
      placa:       n => rotaPorNf.get(n.numnfs) ?? undefined,
      reentrega:   n => String(n.indiceReentrega ?? 0),
    }
    const out = {} as Record<keyof NotasFiltros, OpcaoFiltro[]>
    for (const campo of campos) {
      const outros = campos.filter(c => c !== campo)
      const subset = base.filter(n => outros.every(c => passa[c](n)))

      // Universo = TODAS as opções que existem na base, mesmo fora do recorte.
      // Sem isso, uma opção some do card assim que outro filtro a exclui e o
      // operador não consegue mais alcançá-la (Marcelo, 03/09: em Solução SAC
      // todas as opções devem estar disponíveis).
      const universo = opcoesUnicas(base.map(valor[campo]))
      const contagem = new Map<string, number>()
      for (const n of subset) {
        const v = valor[campo](n)
        if (v) contagem.set(norm(v), (contagem.get(norm(v)) ?? 0) + 1)
      }
      out[campo] = universo.map(v => ({ valor: v, count: contagem.get(norm(v)) ?? 0 }))
    }
    // "(Vazio)" sempre no topo do filtro de Solução SAC.
    const semSac = base.filter(n =>
      !n.solucaoSac && campos.filter(c => c !== 'solucaoSac').every(c => passa[c](n))).length
    out.solucaoSac = [{ valor: SAC_VAZIO, count: semSac }, ...out.solucaoSac]
    return out
  }, [base, passa, rotaPorNf])

  const filtradas = useMemo(() => {
    const campos = Object.keys(passa) as (keyof NotasFiltros)[]
    return base.filter(n => campos.every(c => passa[c](n)))
  }, [base, passa])

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
    () => {
    const pagina = sorted.slice(from, from + pageSize)
    // Contagem por destinatário na página: o destaque precisa cobrir o GRUPO
    // inteiro. Antes só marcava "repete a anterior", então a primeira nota do
    // grupo ficava sem cor e parecia outra entrega (Marcelo, 03/09).
    const porDest = new Map<string, number>()
    for (const nf of pagina) {
      const k = (nf.destinatario ?? '').trim().toUpperCase()
      if (k) porDest.set(k, (porDest.get(k) ?? 0) + 1)
    }
    return pagina.map((nf, i, arr) => ({
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
      emissao:           nf.dataEmissao && nf.dataEmissao !== '—' ? nf.dataEmissao : null,
      agenda:            nf.dataAgendamento ?? null,
      endereco:          nf.endereco,
      indice_reentrega:  nf.indiceReentrega ?? 0,
      em_rota:           rotaPorNf.get(nf.numnfs) ?? null,
      alertaSac:         temAlertaSac(nf),
      selecionada:       !nfsDesmarcadas.has(nf.numnfs),
      mesmoDestAnterior: i > 0 && arr[i - 1].destinatario === nf.destinatario,
      qtdMesmoDest:      porDest.get((nf.destinatario ?? '').trim().toUpperCase()) ?? 1,
    }))
    },
    [sorted, from, pageSize, nfsDesmarcadas, rotaPorNf],
  )

  function handleSetPage(p: number) {
    setPage(Math.max(0, p))
  }

  function handleSetPageSize(s: PageSize) {
    setPageSizeState(s)
    setPage(0)
  }

  function toggleFiltro(campo: keyof NotasFiltros, valor: string) {
    setFiltros(prev => {
      const atual = prev[campo]
      const next = atual.includes(valor) ? atual.filter(v => v !== valor) : [...atual, valor]
      return { ...prev, [campo]: next }
    })
    setPage(0)
  }

  function limparFiltro(campo: keyof NotasFiltros) {
    setFiltros(prev => ({ ...prev, [campo]: campo === 'solucaoSac' ? filtrosPadrao().solucaoSac : [] }))
    setPage(0)
  }

  // "Limpar filtros" volta ao PADRÃO — a segmentação do SAC (Vazio+Reentrega)
  // é da rotina e NUNCA é limpa (Marcelo, 21/08).
  function limparFiltros() {
    setFiltros(filtrosPadrao())
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
    toggleFiltro,
    limparFiltro,
    limparFiltros,
    opcoesFiltro,
    toggleSelecionada: toggleNfDesmarcada,
    limparDesmarcacoes: limparNfsDesmarcadas,
    totalFiltradasSelecionadas,
    marcarFiltradas,
    desmarcarFiltradas,
    notasFiltradas: sorted,
    desmarcadas: nfsDesmarcadas,
    incluirParciais,
    setIncluirParciais,
  }
}
