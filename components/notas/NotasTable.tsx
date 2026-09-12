'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useNotasFiscais, filtrosPadrao, type PageSize, type NotasFiltros, type FonteNotas } from '@/hooks/useNotasFiscais'
import { Segmentador, PainelSegmentadores } from '@/components/ui/Segmentadores'
import { useColunasRedimensionaveis, type ColunaDef } from '@/hooks/useColunasRedimensionaveis'

import { useAppData } from '@/components/providers/AppDataProvider'
import { useAuth } from '@/components/providers/AuthProvider'
import { salvarRotaManual, type VeiculoLivre } from '@/lib/webhooks'
import { listarCapacidades, type CapacidadeVeiculo } from '@/lib/frota'
import { formatPeso, formatarCep } from '@/lib/utils'
import type { NotaFiscal } from '@/types'

const MapaNotasInline = dynamic(
  () => import('@/components/notas/MapaNotasDialog').then(m => m.MapaNotasInline),
  { ssr: false },
)

const COND_CLS: Record<string, string> = {
  vermelho: 'bg-danger-bg text-danger',
  laranja:  'bg-warn-bg text-warn-mid',
  ok:       'bg-success-bg text-success-dark',
}

const COND_DOT: Record<string, string> = {
  vermelho: 'bg-cond-err',
  laranja:  'bg-cond-warn',
  ok:       'bg-cond-ok',
}

function CondBadge({ cond }: { cond: string | null | undefined }) {
  const c = (cond ?? '').toLowerCase()
  const cls = COND_CLS[c] ?? 'bg-cream text-muted'
  const dot = COND_DOT[c]
  const label = c === 'vermelho' ? 'Vermelho' : c === 'laranja' ? 'Laranja' : c === 'ok' ? 'OK' : c || '—'
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap', cls)}>
      {dot && <span className={cn('w-[5px] h-[5px] rounded-full shrink-0', dot)} />}
      {label}
    </span>
  )
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className={i % 2 === 0 ? 'bg-page' : 'bg-cream/40 dark:bg-[#1A1918]/60'}>
          {[24, 26, 55, 40, 40, 110, 110, 80, 55, 45, 70, 70, 45].map((w, j) => (
            <td key={j} className="px-3 py-2">
              <div className="h-3 rounded animate-pulse bg-cream dark:bg-hover" style={{ width: w }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

const PAGE_SIZES: PageSize[] = [25, 50, 100]

/** YYYY-MM-DD → DD/MM (colunas Emissão/Agenda). */
function fmtData(iso: string | null): string {
  if (!iso) return ''
  const [, m, d] = iso.slice(0, 10).split('-')
  return d && m ? `${d}/${m}` : iso
}

/**
 * Observação: a linha da tabela NUNCA quebra — o texto fica numa única linha
 * truncada. Quando não cabe, um botão abre o conteúdo completo num popover,
 * porque observação carrega instrução de entrega que o operador precisa ler
 * inteira (Marcelo/Raphael, 03/09).
 */
function ObservacaoCelula({ texto }: { texto: string | null }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function fecha(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fecha)
    return () => document.removeEventListener('mousedown', fecha)
  }, [aberto])

  if (!texto || texto === '—') return <span className="text-subtle">—</span>

  return (
    <div className="relative flex items-center gap-1 min-w-0" ref={ref}>
      {/* Botão sempre visível quando há texto (espec, item 1): o balão mostra o conteúdo integral. */}
      <button
        onClick={() => setAberto(v => !v)}
        title="Ver observação completa"
        className={cn(
          'shrink-0 text-[9px] px-1 rounded border border-[0.5px] cursor-pointer font-medium',
          aberto ? 'bg-primary text-white border-primary' : 'border-warn-mid/60 text-warn bg-warn-bg hover:brightness-95',
        )}
      >
        ⤢
      </button>
      <span className="truncate whitespace-nowrap">{texto}</span>
      {aberto && (
        <div className="absolute z-40 top-full right-0 mt-1 w-[320px] max-h-[220px] overflow-y-auto bg-surface border border-[0.5px] border-[var(--border-light)] rounded-lg shadow-lg p-2.5">
          <div className="text-[10px] text-muted mb-1 font-medium">Observação</div>
          <div className="text-[11px] text-base whitespace-pre-wrap break-words">{texto}</div>
        </div>
      )}
    </div>
  )
}

/** Alça de arraste na borda direita do cabeçalho — 5px, fácil de pegar. */
function AlcaResize({ onMouseDown, ativo }: { onMouseDown: (e: React.MouseEvent) => void; ativo: boolean }) {
  return (
    <span
      onMouseDown={onMouseDown}
      onClick={e => e.stopPropagation()}
      title="Arraste para ajustar a largura"
      className={cn(
        'absolute top-0 right-0 h-full w-[5px] cursor-col-resize select-none',
        'hover:bg-primary/40',
        ativo && 'bg-primary/60',
      )}
    />
  )
}

const TITULO_COLUNA: Record<string, string | undefined> = {
  ree:   'Índice de reentrega: 0 = nunca saiu; 1/2/3 = vezes que a NF voltou',
  placa: 'Veículo (Placa | Sigla | Tipo) da rota ativa que contém esta NF',
}

// Colunas da tabela: a chave é estável e a largura é o padrão em px. O
// operador ajusta arrastando a borda do cabeçalho e a preferência fica salva
// no navegador dele (Raphael, 04/09).
const COLUNAS: ColunaDef[] = [
  { key: 'sel',          label: '',                 largura: 34,  min: 34 },
  { key: 'ree',          label: 'Ree',              largura: 40,  min: 34 },
  { key: 'nf',           label: 'NF',               largura: 82,  min: 60 },
  { key: 'emissao',      label: 'Emissão',          largura: 70,  min: 56 },
  { key: 'agenda',       label: 'Agenda',           largura: 70,  min: 56 },
  { key: 'remetente',    label: 'Remetente',        largura: 150, min: 70 },
  { key: 'destinatario', label: 'Destinatário',     largura: 200, min: 80 },
  { key: 'endereco',     label: 'Endereço',         largura: 190, min: 80 },
  { key: 'numero',       label: 'Nº',               largura: 52,  min: 40 },
  { key: 'bairro',       label: 'Bairro',           largura: 120, min: 70 },
  { key: 'municipio',    label: 'Município',        largura: 120, min: 70 },
  { key: 'uf',           label: 'UF',               largura: 42,  min: 36 },
  { key: 'cep',          label: 'CEP',              largura: 78,  min: 70 },
  { key: 'tipo',         label: 'Tipo',             largura: 80,  min: 56 },
  { key: 'peso',         label: 'Peso',             largura: 80,  min: 56 },
  { key: 'volume',       label: 'Vol. m³',          largura: 62,  min: 50 },
  { key: 'caixas',       label: 'Cx',               largura: 48,  min: 40 },
  { key: 'valor',        label: 'Valor',            largura: 90,  min: 60 },
  { key: 'rota',         label: 'Rota de Entrega',  largura: 130, min: 70 },
  { key: 'restricoes',   label: 'Restrições',       largura: 140, min: 70 },
  { key: 'observacao',   label: 'Observação',       largura: 200, min: 80 },
  { key: 'placa',        label: 'Placa | Sigla | Tipo', largura: 170, min: 90 },
]

// Filtros na barra (Marcelo, 21/08): Solução SAC em PRIMEIRO; Região fora da
// UI (o campo continua no código). Multi-seleção em todos.
// Linha 1: SAC, Tipo Carga, Rota, Município, Bairro, Tipo Cliente.
// Linha 2: bloco Placa (veículos livres) + Remetente + Destinatário.
// Reentrega saiu (Raphael, 12/09); Placa virou seletor do veículo da rota.
const CAMPOS_UI = ['solucaoSac', 'tipoCarga', 'rota', 'municipio', 'bairro', 'tipoCliente'] as const
const CAMPOS_LINHA2 = ['remetente', 'destinatario'] as const
type CampoUI = (typeof CAMPOS_UI)[number] | (typeof CAMPOS_LINHA2)[number]

const FILTRO_LABELS: Record<CampoUI, string> = {
  solucaoSac:  'Solução SAC',
  tipoCarga:   'Tipo Carga',
  rota:        'Rota de Entrega',
  municipio:   'Município',
  bairro:      'Bairro',
  tipoCliente: 'Tipo Cliente',
  remetente:   'Remetente',
  destinatario:'Destinatário',
}
const TODOS_CAMPOS: CampoUI[] = [...CAMPOS_UI, ...CAMPOS_LINHA2]

/** Ordem fixa de exibição dos grupos de veículo (espec, item 4). */
const TIPOS_ORDEM = ['Fiorino', 'VUC', '3/4', 'Truck', 'Carreta'] as const

/**
 * Bloco Placa (espec, item 2): mesmo card dos segmentadores, listando SÓ
 * veículos livres hoje como `Placa | Sigla | Tipo`, agrupados por tipo.
 * Seleção única — é o veículo que recebe a rota ao salvar.
 */
function BlocoPlaca({ veiculos, selecionado, onSelect, pesoKg, capacidades, loading, onRefresh }: {
  veiculos:    VeiculoLivre[]
  selecionado: string | null
  onSelect:    (id: string | null) => void
  pesoKg:      number
  capacidades: CapacidadeVeiculo[]
  loading:     boolean
  onRefresh:   () => void
}) {
  const [q, setQ] = useState('')
  const termo = q.trim().toLowerCase()
  const lista = termo ? veiculos.filter(v => v.rotulo.toLowerCase().includes(termo) || (v.motoristaNome ?? '').toLowerCase().includes(termo)) : veiculos
  const grupos = TIPOS_ORDEM.map(t => ({ tipo: t, itens: lista.filter(v => v.tipo === t) })).filter(g => g.itens.length)
  // Sugestão: menor tipo cuja capacidade × limite comporta o peso E que tenha veículo livre.
  const sugerido = pesoKg > 0
    ? [...capacidades].sort((a, b) => a.capacidade_kg - b.capacidade_kg)
        .find(c => pesoKg <= c.capacidade_kg * (c.ocupacao_max_percent ?? 95) / 100 && veiculos.some(v => v.tipo === c.tipo))?.tipo ?? null
    : null
  const sel = veiculos.find(v => v.id === selecionado)
  const ocup = sel && sel.capacidadeKg > 0 ? Math.round(pesoKg / sel.capacidadeKg * 100) : null
  return (
    <div className={cn('flex flex-col rounded-lg border border-[0.5px] bg-surface overflow-hidden', selecionado ? 'border-primary' : 'border-[var(--border-subtle)]')}>
      <div className="flex items-center gap-1 px-2 py-1 bg-page border-b border-[0.5px] border-[var(--border-faint)]">
        <span className="text-[10px] font-medium text-muted truncate flex-1">Placa</span>
        <span className="text-[9px] text-subtle tabular-nums" title="Veículos livres hoje (disponíveis, com motorista, sem rota ativa)">{veiculos.length} livres</span>
        <button onClick={onRefresh} title="Atualizar" className="text-[10px] text-muted hover:text-base cursor-pointer px-0.5">↻</button>
        {selecionado && <button onClick={() => onSelect(null)} title="Limpar" className="text-[11px] leading-none text-muted hover:text-danger-mid px-0.5 cursor-pointer">×</button>}
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrar…"
        className="mx-1 mt-1 h-6 px-1.5 text-[10px] font-sans rounded border border-[0.5px] border-[var(--border-input)] bg-page outline-none focus:border-primary" />
      <div className="flex flex-col overflow-y-auto max-h-[124px] p-1 gap-px">
        {loading ? <span className="text-[10px] text-subtle px-1 py-1">Carregando…</span>
          : grupos.length === 0 ? <span className="text-[10px] text-subtle px-1 py-1">{termo ? 'Nada encontrado' : 'Nenhum veículo livre hoje — marque a disponibilidade em Frota'}</span>
          : grupos.map(g => (
            <div key={g.tipo}>
              <div className={cn('text-[9px] uppercase tracking-[0.06em] px-1.5 pt-1 pb-0.5 font-medium', sugerido === g.tipo ? 'text-primary' : 'text-subtle')}>
                {g.tipo} · {g.itens.length}{sugerido === g.tipo ? ' · sugerido' : ''}
              </div>
              {g.itens.map(v => {
                const ativo = v.id === selecionado
                return (
                  <button key={v.id} onClick={() => onSelect(ativo ? null : v.id)} title={`${v.rotulo} · ${v.motoristaNome ?? ''} · ${formatPeso(v.capacidadeKg)}`}
                    className={cn('flex items-center gap-1 px-1.5 py-[3px] rounded text-[10px] text-left transition-colors cursor-pointer w-full',
                      ativo ? 'bg-primary text-white font-medium' : 'text-base hover:bg-cream dark:hover:bg-hover')}>
                    <span className="font-mono truncate flex-1">{v.rotulo}</span>
                    <span className={cn('tabular-nums shrink-0 text-[9px]', ativo ? 'text-white/80' : 'text-subtle')}>{formatPeso(v.capacidadeKg)}</span>
                  </button>
                )
              })}
            </div>
          ))}
      </div>
      <div className={cn('px-2 py-1 text-[9px] border-t border-[0.5px] border-[var(--border-faint)] truncate', ocup !== null && sel && ocup > (capacidades.find(c => c.tipo === sel.tipo)?.ocupacao_max_percent ?? 95) ? 'text-danger' : 'text-muted')}
        title={sel ? `${sel.rotulo} · ${formatPeso(pesoKg)} / ${formatPeso(sel.capacidadeKg)}` : undefined}>
        {sel ? `${sel.rotulo} · ${ocup}% de ${formatPeso(sel.capacidadeKg)}` : sugerido ? `Sugestão: ${sugerido} para ${formatPeso(pesoKg)}` : 'Escolha o veículo da rota'}
      </div>
    </div>
  )
}

function FiltrosAplicados({ filtros, incluirParciais, onRemover, onRemoverParciais }: {
  filtros:           NotasFiltros
  incluirParciais:   boolean
  onRemover:         (campo: CampoUI, valor: string) => void
  onRemoverParciais: () => void
}) {
  const tags = TODOS_CAMPOS.flatMap(campo =>
    filtros[campo].map(valor => ({ campo, valor })))
  if (tags.length === 0 && !incluirParciais) return null

  return (
    <div className="flex flex-wrap items-center gap-1 mt-2">
      <span className="text-[10px] text-muted uppercase tracking-[0.06em] font-medium mr-0.5">
        Filtros aplicados
      </span>
      {tags.map(({ campo, valor }) => (
        <span
          key={`${campo}|${valor}`}
          className="inline-flex items-center gap-1 text-[10px] pl-2 pr-1 py-0.5 rounded-full bg-primary/8 border border-primary/25 text-primary whitespace-nowrap max-w-[220px]"
        >
          <span className="opacity-70">{FILTRO_LABELS[campo]}:</span>
          <span className="font-medium truncate" title={valor}>{valor}</span>
          <button
            onClick={() => onRemover(campo, valor)}
            className="cursor-pointer rounded-full hover:bg-primary/15 w-3.5 h-3.5 leading-none inline-flex items-center justify-center"
            title="Remover este filtro"
          >
            ×
          </button>
        </span>
      ))}
      {incluirParciais && (
        <span className="inline-flex items-center gap-1 text-[10px] pl-2 pr-1 py-0.5 rounded-full bg-warn-bg border border-warn-mid/40 text-warn-mid whitespace-nowrap">
          <span className="font-medium">Rotas PARCIAIS incluídas</span>
          <button
            onClick={onRemoverParciais}
            className="cursor-pointer rounded-full hover:bg-warn-mid/15 w-3.5 h-3.5 leading-none inline-flex items-center justify-center"
            title="Voltar a ocultar 996/999"
          >
            ×
          </button>
        </span>
      )}
    </div>
  )
}

// Resumo do RECORTE (Raphael, 24/08): mini-cards que preenchem o espaço em
// branco sob a barra — visão do conjunto filtrado (inclui as desmarcadas).
function ResumoRecorte({ notas }: { notas: NotaFiscal[] }) {
  if (notas.length === 0) return null
  const pesoKg    = notas.reduce((acc, n) => acc + n.peso, 0)
  const municipios = new Set(notas.map(n => n.municipio).filter(m => m && m !== '—')).size
  const destinos   = new Set(notas.map(n => n.destinatario)).size
  const comAgenda  = notas.filter(n => n.dataAgendamento).length
  const alertasSac = notas.filter(n =>
    n.solucaoSac && !n.indRee && n.solucaoSac.trim().toUpperCase() !== 'REENTREGA').length

  const cards: [string, string, boolean?][] = [
    ['Peso do recorte', `${pesoKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`],
    ['NFs no recorte',  String(notas.length)],
    ['Municípios',      String(municipios)],
    ['Destinatários',   String(destinos)],
    ['Com agenda',      String(comAgenda)],
    ['⚠ SAC pendente',  String(alertasSac), alertasSac > 0],
  ]

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {cards.map(([label, valor, destaque]) => (
        <div
          key={label}
          className={cn(
            'px-2.5 py-1 rounded-md border border-[0.5px] bg-surface min-w-[86px]',
            destaque ? 'border-warn-mid/50 bg-warn-bg' : 'border-[var(--border-subtle)]',
          )}
        >
          <div className={cn('text-[9px] uppercase tracking-[0.05em] font-medium', destaque ? 'text-warn-mid' : 'text-muted')}>
            {label}
          </div>
          <div className={cn('text-[13px] font-semibold tabular-nums leading-tight', destaque ? 'text-warn-mid' : 'text-base')}>
            {valor}
          </div>
        </div>
      ))}
    </div>
  )
}

// Resumo da SELEÇÃO ao lado do mapa (Marcelo, 21/08) — espelha o quadro da
// planilha (PESO / ENTREGA / REDES / CD / RESTRIÇÕES / REENTREGA), mais completo.
// Cabeçalho do mapa (espec, item 7 + Raphael 12/09): só peso, rota e NFs.
// Os contadores Entregas/Redes/CD/Varejo/Cozinha/Restrições/Reentregas saíram.
function ResumoSelecao({ notas, desmarcadas, codigo }: { notas: NotaFiscal[]; desmarcadas: Set<string>; codigo: string }) {
  const sel    = notas.filter(n => !desmarcadas.has(n.numnfs))
  const pesoKg = sel.reduce((acc, n) => acc + n.peso, 0)
  return (
    <div className="w-full shrink-0 rounded-lg border border-[0.5px] border-[var(--border-subtle)] bg-primary text-white px-2.5 py-1.5 flex items-center justify-between gap-3">
      <div>
        <div className="text-[9px] uppercase tracking-[0.08em] font-medium opacity-80">Peso selecionado</div>
        <div className="text-[15px] font-semibold tabular-nums leading-tight">{pesoKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg</div>
      </div>
      <div className="text-right min-w-0">
        <div className="text-[9px] uppercase tracking-[0.08em] font-medium opacity-80">Rota</div>
        <div className="text-[11px] font-medium truncate max-w-[180px]" title={codigo}>{codigo}</div>
      </div>
      <div className="text-right">
        <div className="text-[9px] uppercase tracking-[0.08em] font-medium opacity-80">NFs</div>
        <div className="text-[15px] font-semibold tabular-nums leading-tight">{sel.length}</div>
      </div>
    </div>
  )
}

export function NotasTable({ fonte = 'livres' }: { fonte?: FonteNotas }) {
  const emUso = fonte === 'em_uso'
  const {
    rows, total, totalDesmarcadas, page, pageSize, setPage, setPageSize, loading, error,
    filtros, toggleFiltro, limparFiltro, limparFiltros, opcoesFiltro, toggleSelecionada, limparDesmarcacoes,
    totalFiltradasSelecionadas, marcarFiltradas, desmarcarFiltradas,
    notasFiltradas, desmarcadas, incluirParciais, setIncluirParciais,
  } = useNotasFiscais(25, fonte)
  const { refresh, setNfsDesmarcadasBulk, veiculosLivres, loadingVeiculosLivres, refreshVeiculosLivres } = useAppData()
  const { usuario } = useAuth()
  // Mapa visível por padrão (Raphael, 18/08) — o operador pode ocultar se quiser.
  const [mapaAberto, setMapaAberto] = useState(true)
  const colunas = useColunasRedimensionaveis('concarga:larguras:notas', COLUNAS)
  const larguraTotal = COLUNAS.reduce((t, c) => t + (colunas.larguras[c.key] ?? c.largura), 0)
  const [gerandoRota, setGerandoRota] = useState(false)
  const [msgRota, setMsgRota] = useState('')
  const [veiculoSel, setVeiculoSel] = useState<string | null>(null)
  const [capacidades, setCapacidades] = useState<CapacidadeVeiculo[]>([])
  useEffect(() => { listarCapacidades().then(setCapacidades).catch(() => {}) }, [])
  // Se outra sessão reservou o veículo escolhido, ele some da lista de livres e a escolha cai.
  const veiculoSelValido = veiculoSel && veiculosLivres.some(v => v.id === veiculoSel) ? veiculoSel : null

  const selecionadas = useMemo(() => notasFiltradas.filter(n => !desmarcadas.has(n.numnfs)), [notasFiltradas, desmarcadas])
  const pesoSel = selecionadas.reduce((acc, n) => acc + n.peso, 0)
  const codigoRota = useMemo(() => {
    if (filtros.rota.length === 1) return filtros.rota[0]
    const rotas = [...new Set(selecionadas.map(n => n.rota).filter(r => r && r !== '—'))]
    if (rotas.length === 1) return rotas[0]
    return `MONTADA ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }, [filtros.rota, selecionadas])

  // Fluxo MANUAL: filtrar → marcar → escolher Placa → Salvar rota.
  // A rota nasce "aguardando" e reserva NFs, rotas de entrega e veículo numa
  // única transação no banco (RPC rota_salvar). "Aprovar" é etapa posterior.
  async function handleGerarRota() {
    if (!selecionadas.length || gerandoRota) return
    if (!veiculoSelValido) { setMsgRota('Erro: escolha o veículo no bloco Placa (Placa | Sigla | Tipo)'); return }

    const comAlerta = selecionadas.filter(n =>
      n.solucaoSac && !n.indRee && n.solucaoSac.trim().toUpperCase() !== 'REENTREGA')
    if (comAlerta.length > 0 && !window.confirm(
      `${comAlerta.length} nota(s) selecionada(s) têm Solução SAC pendente (⚠). Incluir mesmo assim na rota?`)) {
      return
    }

    setGerandoRota(true)
    setMsgRota('')
    try {
      const codigo = codigoRota
      const regiao = filtros.regiao[0] || selecionadas.find(n => n.regiao)?.regiao || ''
      const hoje   = new Date().toISOString().slice(0, 10)
      await salvarRotaManual({ data: hoje, codigo, regiao, veiculoId: veiculoSelValido, notas: selecionadas, usuario: usuario?.email ?? undefined })
      // As NFs salvas saem do universo livre ao recarregar as rotas (reserva no banco).
      setNfsDesmarcadasBulk(selecionadas.map(n => n.numnfs), false)
      setVeiculoSel(null)
      await refresh()
      setMsgRota(`✓ Rota "${codigo}" salva (${selecionadas.length} NFs) — aguardando aprovação`)
    } catch (err) {
      setMsgRota(`Erro: ${err instanceof Error ? err.message : 'falha ao salvar a rota'}`)
      refresh().catch(() => {})
    } finally {
      setGerandoRota(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)
  // "Ativo" = qualquer coisa diferente do PADRÃO (SAC Vazio+Reentrega é o padrão).
  const padrao = filtrosPadrao()
  const filtrosAtivos = (Object.keys(filtros) as (keyof NotasFiltros)[]).some(campo =>
    [...filtros[campo]].sort().join('|') !== [...padrao[campo]].sort().join('|'))

  // Checkbox-mestre do cabeçalho: marcado quando todas as NFs filtradas estão
  // selecionadas, indeterminado quando só parte delas está.
  const todasSelecionadas = total > 0 && totalFiltradasSelecionadas === total
  const algumaSelecionada = totalFiltradasSelecionadas > 0 && !todasSelecionadas
  const masterRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = algumaSelecionada
  }, [algumaSelecionada])

  return (
    <div className="flex flex-col min-h-0">
      {error && (
        <div className="px-4 py-2 text-[12px] text-danger bg-danger-bg rounded-lg mb-2">
          Erro ao carregar NFs: {error}
        </div>
      )}

      {/* Barra de trabalho: segmentadores, ações e mapa. NÃO é sticky — com os
          cards expostos o bloco é alto e, preso no topo, sobrepunha a lista.
          Quem fica congelado agora é o cabeçalho da tabela, dentro da própria
          área de rolagem dela (Raphael, 04/09). */}
      <div className="bg-[var(--color-page)] pb-2 pt-1">
        <div className="flex gap-3 items-start">
          <div className="flex-1 min-w-0">
            <PainelSegmentadores
              temFiltro={filtrosAtivos}
              onLimparTudo={limparFiltros}
              resumo={
                <span className="text-[10px] text-subtle">
                  clique nas opções para filtrar · seleção múltipla
                </span>
              }
            >
              {CAMPOS_UI.map(campo => (
                <Segmentador
                  key={campo}
                  titulo={FILTRO_LABELS[campo]}
                  opcoes={opcoesFiltro[campo]}
                  selecionados={new Set(filtros[campo])}
                  onToggle={valor => toggleFiltro(campo, valor)}
                  onLimpar={() => limparFiltro(campo)}
                  comBusca
                />
              ))}
              {/* Linha 2 (Raphael, 12/09): Placa (veículos livres) + Remetente + Destinatário, largura dupla */}
              {!emUso && (
                <div className="col-span-2">
                  <BlocoPlaca
                    veiculos={veiculosLivres}
                    selecionado={veiculoSelValido}
                    onSelect={setVeiculoSel}
                    pesoKg={pesoSel}
                    capacidades={capacidades}
                    loading={loadingVeiculosLivres}
                    onRefresh={refreshVeiculosLivres}
                  />
                </div>
              )}
              {CAMPOS_LINHA2.map(campo => (
                <Segmentador
                  key={campo}
                  className="col-span-2"
                  titulo={FILTRO_LABELS[campo]}
                  opcoes={opcoesFiltro[campo]}
                  selecionados={new Set(filtros[campo])}
                  onToggle={valor => toggleFiltro(campo, valor)}
                  onLimpar={() => limparFiltro(campo)}
                  comBusca
                />
              ))}
            </PainelSegmentadores>

            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {filtrosAtivos && (
                <button
                  onClick={limparFiltros}
                  className="text-[11px] px-2 py-1 rounded-md text-primary hover:underline"
                  title="Volta ao padrão da rotina — a segmentação do SAC (Vazio + Reentrega) é preservada"
                >
                  Limpar filtros
                </button>
              )}
              <button
                onClick={() => setIncluirParciais(!incluirParciais)}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded-md font-medium cursor-pointer border border-transparent',
                  incluirParciais
                    ? 'bg-warn-mid text-white'
                    : 'bg-warn-bg text-warn-mid hover:brightness-95',
                )}
                title="Rotas parciais (996/999) ficam ocultas por padrão — clique para incluir"
              >
                {incluirParciais ? '✓ PARCIAL incluídas' : 'Incluir PARCIAL'}
              </button>
              <button
                onClick={() => setMapaAberto(v => !v)}
                className="text-[11px] px-2 py-1 rounded-md border border-[var(--border-input)] bg-surface text-mid hover:text-base cursor-pointer"
                title="Prévia no mapa das notas filtradas (cores por região)"
              >
                {mapaAberto ? 'Ocultar mapa' : '🗺 Ver no mapa'}
              </button>
              {colunas.alterado && (
                <button
                  onClick={colunas.restaurar}
                  className="text-[11px] px-2 py-1 rounded-md border border-[var(--border-input)] text-muted hover:bg-cream dark:hover:bg-hover cursor-pointer"
                  title="Volta as colunas para a largura padrão"
                >
                  Restaurar larguras
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {total > 0 && !emUso && (
                <button
                  onClick={handleGerarRota}
                  disabled={gerandoRota || totalFiltradasSelecionadas === 0 || !veiculoSelValido}
                  className="text-[11px] px-3 py-1.5 rounded-md bg-primary text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title={veiculoSelValido ? 'Salva a rota em "aguardando" e reserva NFs, rotas de entrega e veículo' : 'Escolha o veículo no bloco Placa para salvar'}
                >
                  {gerandoRota ? 'Salvando rota…' : `💾 Salvar rota (${totalFiltradasSelecionadas} NFs)`}
                </button>
              )}
              <span className="text-[11px] text-muted flex items-center gap-2">
                {total > 0 && (
                  <span className={cn(totalFiltradasSelecionadas < total && 'text-warn font-medium')}>
                    {totalFiltradasSelecionadas}/{total} selecionada{totalFiltradasSelecionadas !== 1 ? 's' : ''}
                  </span>
                )}
                {totalDesmarcadas > 0 && (
                  <button onClick={limparDesmarcacoes} className="text-primary hover:underline">restaurar todas</button>
                )}
                {msgRota && (
                  <span className={cn('font-medium', msgRota.startsWith('Erro') ? 'text-danger' : 'text-success-dark')}>
                    {msgRota}
                  </span>
                )}
              </span>
            </div>

            {/* Espaço sob a barra: filtros aplicados visíveis + resumo do recorte */}
            <FiltrosAplicados
              filtros={filtros}
              incluirParciais={incluirParciais}
              onRemover={(campo, valor) => toggleFiltro(campo, valor)}
              onRemoverParciais={() => setIncluirParciais(false)}
            />
            {!loading && <ResumoRecorte notas={notasFiltradas} />}
          </div>

          {/* Resumo em cima, mapa embaixo: empilhados o bloco usa a altura
              disponível e o mapa fica maior (Raphael, 04/09). */}
          {mapaAberto && (
            <div className="hidden lg:flex flex-col gap-2 shrink-0 w-[400px]">
              <ResumoSelecao notas={notasFiltradas} desmarcadas={desmarcadas} codigo={codigoRota} />
              <MapaNotasInline notas={notasFiltradas} desmarcadas={desmarcadas} height={340} />
            </div>
          )}
        </div>
      </div>

      {/* Tabela com scroll PRÓPRIO: sem altura máxima o `overflow-auto` não
          criava contexto de rolagem, a página inteira rolava e o cabeçalho
          sticky escapava para cima da lista. */}
      <div className="overflow-auto rounded-xl border border-[var(--border-card)] bg-surface max-h-[calc(100vh-260px)] min-h-[320px]">
        {/* table-fixed: sem isso o browser recalcula a largura pelo conteúdo e
            o arraste do operador seria ignorado. As larguras vêm do colgroup. */}
        <table className="text-[12px] border-collapse table-fixed" style={{ width: larguraTotal }}>
          <colgroup>
            {COLUNAS.map(c => (
              <col key={c.key} style={{ width: colunas.larguras[c.key] ?? c.largura }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-cream dark:bg-hover border-b border-[var(--border-light)]">
              {COLUNAS.map(c => (
                <th
                  key={c.key}
                  className={cn(
                    'relative py-2 font-medium text-muted whitespace-nowrap',
                    c.key === 'sel' || c.key === 'ree' ? 'px-1 text-center' : 'px-2',
                    c.key === 'peso' ? 'text-right' : c.key === 'sel' || c.key === 'ree' ? '' : 'text-left',
                  )}
                  title={TITULO_COLUNA[c.key]}
                >
                  {c.key === 'sel' ? (
                    <input
                      ref={masterRef}
                      type="checkbox"
                      checked={todasSelecionadas}
                      onChange={() => (todasSelecionadas ? desmarcarFiltradas() : marcarFiltradas())}
                      title={todasSelecionadas ? 'Desmarcar todas as filtradas' : 'Marcar todas as filtradas'}
                    />
                  ) : (
                    <span className="block truncate">{c.label}</span>
                  )}
                  <AlcaResize
                    ativo={colunas.arrastando === c.key}
                    onMouseDown={e => colunas.iniciarArraste(c.key, e)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <Skeleton rows={pageSize > 25 ? 25 : pageSize} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS.length} className="px-4 py-8 text-center text-muted text-[12px]">
                  {emUso ? 'Nenhuma NF reservada por rota ativa' : 'Nenhuma NF pendente'}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-[var(--border-faint)] last:border-0',
                    // Cor na LINHA (Marcelo 21/08, coluna Cond. eliminada):
                    // reentrega/COND vermelho → linha vermelha; COND laranja →
                    // linha laranja; destinatário repetido → verde; senão zebra.
                    row.ind_ree || row.cond === 'vermelho'
                      ? 'bg-danger-bg'
                      : row.cond === 'laranja'
                        ? 'bg-warn-bg'
                        : row.mesmoDestAnterior
                          ? 'bg-success-bg'
                          : (i % 2 === 0 ? 'bg-surface' : 'bg-cream/30 dark:bg-[#1A1918]/40'),
                  )}
                >
                  <td className="overflow-hidden px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.selecionada}
                      disabled={emUso}
                      onChange={() => toggleSelecionada(row.n_nfs)}
                      title={emUso ? (row.motivo_uso ?? 'Em uso') : row.selecionada ? 'Desmarcar da roteirização' : 'Marcar para roteirização'}
                    />
                  </td>
                  <td className="overflow-hidden px-2 py-2 text-center font-mono text-[11px] tabular-nums" title="Vezes que a NF retornou (reentrega)">
                    <span className={row.indice_reentrega > 0 ? 'text-warn font-medium' : 'text-subtle'}>
                      {row.indice_reentrega}
                    </span>
                  </td>
                  <td className="overflow-hidden px-3 py-2 font-mono text-[11px] text-base whitespace-nowrap">
                    {row.alertaSac && (
                      <span
                        className="text-warn mr-1 cursor-help"
                        title={`Solução SAC: ${row.solucao_sac ?? ''} — analisar antes de incluir em uma rota/entrega`}
                      >
                        ⚠
                      </span>
                    )}
                    {row.n_nfs ?? '—'}
                  </td>
                  <td className="overflow-hidden px-2 py-2 text-mid whitespace-nowrap tabular-nums">
                    {fmtData(row.emissao)}
                  </td>
                  <td className={cn('overflow-hidden px-2 py-2 whitespace-nowrap tabular-nums', row.agenda ? 'text-base font-medium' : 'text-muted')}>
                    {fmtData(row.agenda)}
                  </td>
                  <td className="overflow-hidden px-3 py-2 text-mid truncate" title={row.remetente ?? undefined}>
                    {row.remetente ?? '—'}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 ',
                      // Grupo inteiro destacado — antes só as linhas que repetiam
                      // a anterior ficavam verdes e a 1ª parecia outra entrega.
                      row.qtdMesmoDest > 1 ? 'text-success-dark font-medium' : 'text-base',
                    )}
                    title={row.destinatario ?? undefined}
                  >
                    <span className="flex items-center gap-1">
                      <span className="truncate">{row.destinatario ?? '—'}</span>
                      {row.qtdMesmoDest > 1 && (
                        <span
                          className="shrink-0 text-[9px] px-1 rounded bg-success text-white font-medium tabular-nums"
                          title={`${row.qtdMesmoDest} NFs para este destinatário`}
                        >
                          {row.qtdMesmoDest}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="overflow-hidden px-3 py-2 text-mid truncate" title={row.endereco !== '—' ? row.endereco : undefined}>
                    {row.endereco ?? '—'}
                  </td>
                  <td className="overflow-hidden px-2 py-2 text-mid whitespace-nowrap">{row.numero ?? ''}</td>
                  <td className="overflow-hidden px-3 py-2 text-mid truncate" title={row.bairro !== '—' ? row.bairro : undefined}>
                    {row.bairro ?? '—'}
                  </td>
                  <td
                    className="px-3 py-2 text-mid truncate"
                    title={row.municipio_dest ?? row.municipio ?? undefined}
                  >
                    {row.municipio_dest ?? row.municipio ?? '—'}
                  </td>
                  <td className="overflow-hidden px-2 py-2 text-mid">{row.uf ?? ''}</td>
                  <td className="overflow-hidden px-2 py-2 text-mid font-mono text-[10px] whitespace-nowrap">{formatarCep(row.cep)}</td>
                  <td className="overflow-hidden px-2 py-2 text-mid whitespace-nowrap truncate" title={row.tipo_cliente ?? undefined}>
                    {row.tipo_cliente ?? '—'}
                  </td>
                  <td className="overflow-hidden px-3 py-2 text-right text-mid tabular-nums whitespace-nowrap">
                    {row.peso_kg != null
                      ? `${row.peso_kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`
                      : '—'}
                  </td>
                  <td className="overflow-hidden px-2 py-2 text-right text-mid tabular-nums">{row.volume != null ? row.volume.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : ''}</td>
                  <td className="overflow-hidden px-2 py-2 text-right text-mid tabular-nums">{row.caixas ?? ''}</td>
                  <td className="overflow-hidden px-2 py-2 text-right text-mid tabular-nums whitespace-nowrap">{row.valor != null ? row.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}</td>
                  <td className="overflow-hidden px-3 py-2 text-mid whitespace-nowrap">
                    {row.rota ?? '—'}
                  </td>
                  <td className="overflow-hidden px-3 py-2 text-mid">
                    <ObservacaoCelula texto={row.restricoes} />
                  </td>
                  <td className="overflow-hidden px-3 py-2 text-mid ">
                    <ObservacaoCelula texto={row.observacao} />
                  </td>
                  <td className="overflow-hidden px-2 py-2 font-mono text-[11px] whitespace-nowrap" title={row.motivo_uso ?? undefined}>
                    {row.em_rota ?? ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Rodapé de paginação */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-[11px] text-muted">
          {total === 0 ? '0 NFs' : `${from}–${to} de ${total} NFs`}
        </span>

        <div className="flex items-center gap-3">
          {/* Seletor de tamanho de página */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted">por página</span>
            <div className="flex rounded-md overflow-hidden border border-[var(--border-input)]">
              {PAGE_SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => setPageSize(s)}
                  className={cn(
                    'px-2 py-0.5 text-[11px] transition-colors',
                    s === pageSize
                      ? 'bg-primary text-white font-medium'
                      : 'bg-surface text-muted hover:text-base hover:bg-cream dark:hover:bg-hover',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Prev / Next */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="px-2.5 py-1 rounded-md text-[11px] border border-[var(--border-input)] bg-surface text-muted hover:text-base disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Ant.
            </button>
            <span className="text-[11px] text-muted px-1">
              {page + 1}/{totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1 rounded-md text-[11px] border border-[var(--border-input)] bg-surface text-muted hover:text-base disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Próx. →
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
