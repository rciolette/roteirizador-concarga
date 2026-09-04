'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useNotasFiscais, filtrosPadrao, type PageSize, type NotasFiltros } from '@/hooks/useNotasFiscais'
import { Segmentador, PainelSegmentadores } from '@/components/ui/Segmentadores'

import { useAppData } from '@/components/providers/AppDataProvider'
import { salvarRotasSupabase } from '@/lib/webhooks'
import type { Rota, NotaFiscal } from '@/types'

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

  const longo = texto.length > 28

  return (
    <div className="relative flex items-center gap-1 min-w-0" ref={ref}>
      <span className="truncate whitespace-nowrap" title={texto}>{texto}</span>
      {longo && (
        <button
          onClick={() => setAberto(v => !v)}
          title="Ver observação completa"
          className="shrink-0 text-[9px] px-1 rounded border border-[0.5px] border-[var(--border-input)] text-muted hover:bg-cream dark:hover:bg-hover cursor-pointer"
        >
          ⤢
        </button>
      )}
      {aberto && (
        <div className="absolute z-40 top-full right-0 mt-1 w-[320px] max-h-[220px] overflow-y-auto bg-surface border border-[0.5px] border-[var(--border-light)] rounded-lg shadow-lg p-2.5">
          <div className="text-[10px] text-muted mb-1 font-medium">Observação</div>
          <div className="text-[11px] text-base whitespace-pre-wrap break-words">{texto}</div>
        </div>
      )}
    </div>
  )
}

// Filtros na barra (Marcelo, 21/08): Solução SAC em PRIMEIRO; Região fora da
// UI (o campo continua no código). Multi-seleção em todos.
const CAMPOS_UI = ['solucaoSac', 'tipoCarga', 'rota', 'municipio', 'bairro', 'tipoCliente',
                   'remetente', 'destinatario', 'placa', 'reentrega'] as const

const FILTRO_LABELS: Record<(typeof CAMPOS_UI)[number], string> = {
  solucaoSac:  'Solução SAC',
  tipoCarga:   'Tipo Carga',
  rota:        'Rota de Entrega',
  municipio:   'Município',
  bairro:      'Bairro',
  tipoCliente: 'Tipo Cliente',
  remetente:   'Remetente',
  destinatario:'Destinatário',
  placa:       'Placa',
  reentrega:   'Reentrega (nº saídas)',
}

function FiltrosAplicados({ filtros, incluirParciais, onRemover, onRemoverParciais }: {
  filtros:           NotasFiltros
  incluirParciais:   boolean
  onRemover:         (campo: (typeof CAMPOS_UI)[number], valor: string) => void
  onRemoverParciais: () => void
}) {
  const tags = CAMPOS_UI.flatMap(campo =>
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
function ResumoSelecao({ notas, desmarcadas }: { notas: NotaFiscal[]; desmarcadas: Set<string> }) {
  const sel        = notas.filter(n => !desmarcadas.has(n.numnfs))
  const pesoKg     = sel.reduce((acc, n) => acc + n.peso, 0)
  const entregas   = new Set(sel.map(n => n.destinatario)).size
  const porTipo    = (t: string) => sel.filter(n => n.tipoCliente === t).length
  const reentregas = sel.filter(n => n.indRee).length
  const restricoes = sel.filter(n => n.observacao && n.observacao !== '—').length

  const linhas: [string, number][] = [
    ['Entregas',   entregas],
    ['Redes',      porTipo('Rede')],
    ['CD',         porTipo('CD')],
    ['Varejo',     porTipo('Varejo')],
    ['Cozinha',    porTipo('Cozinha')],
    ['Restrições', restricoes],
    ['Reentregas', reentregas],
  ]

  return (
    <div className="w-[170px] shrink-0 rounded-lg border border-[0.5px] border-[var(--border-subtle)] bg-surface overflow-hidden">
      <div className="px-2.5 py-1.5 bg-primary text-white">
        <div className="text-[9px] uppercase tracking-[0.08em] font-medium opacity-80">Peso selecionado</div>
        <div className="text-[15px] font-semibold tabular-nums leading-tight">
          {pesoKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
        </div>
        <div className="text-[9px] opacity-80">{sel.length} NFs selecionadas</div>
      </div>
      <div className="px-2.5 py-1">
        {linhas.map(([label, valor]) => (
          <div key={label} className={cn(
            'flex items-center justify-between text-[10px] py-[3px] border-b border-[var(--border-faint)] last:border-0',
            (label === 'Restrições' || label === 'Reentregas') && valor > 0 ? 'text-danger font-medium' : 'text-mid',
          )}>
            <span>{label}</span>
            <span className="tabular-nums font-medium">{valor}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function NotasTable() {
  const {
    rows, total, totalDesmarcadas, page, pageSize, setPage, setPageSize, loading, error,
    filtros, toggleFiltro, limparFiltro, limparFiltros, opcoesFiltro, toggleSelecionada, limparDesmarcacoes,
    totalFiltradasSelecionadas, marcarFiltradas, desmarcarFiltradas,
    notasFiltradas, desmarcadas, incluirParciais, setIncluirParciais,
  } = useNotasFiscais(25)
  const { refresh, setNfsDesmarcadasBulk } = useAppData()
  // Mapa visível por padrão (Raphael, 18/08) — o operador pode ocultar se quiser.
  const [mapaAberto, setMapaAberto] = useState(true)
  const [gerandoRota, setGerandoRota] = useState(false)
  const [msgRota, setMsgRota] = useState('')

  // Fluxo MANUAL (Marcelo 17/08): filtrar → marcar → Gerar rota. Sem IA.
  // A rota nasce "aguardando" e vai para a aprovação, onde o operador define
  // veículo/motorista e pode remover ou mover NFs.
  async function handleGerarRota() {
    const selecionadas = notasFiltradas.filter(n => !desmarcadas.has(n.numnfs))
    if (!selecionadas.length || gerandoRota) return

    const comAlerta = selecionadas.filter(n =>
      n.solucaoSac && !n.indRee && n.solucaoSac.trim().toUpperCase() !== 'REENTREGA')
    if (comAlerta.length > 0 && !window.confirm(
      `${comAlerta.length} nota(s) selecionada(s) têm Solução SAC pendente (⚠). Incluir mesmo assim na rota?`)) {
      return
    }

    setGerandoRota(true)
    setMsgRota('')
    try {
      const agora  = new Date()
      const codigo = filtros.rota.length === 1
        ? filtros.rota[0]
        : `MONTADA ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      const regiao = filtros.regiao[0] || selecionadas.find(n => n.regiao)?.regiao || ''
      const hoje   = agora.toISOString().slice(0, 10)
      const rota: Rota = {
        id:              `manual-${agora.getTime()}`,
        data:            hoje,
        codigoRota:      codigo,
        regiao,
        status:          'aguardando',
        pesoTotal:       selecionadas.reduce((acc, n) => acc + n.peso, 0),
        qtdNotas:        selecionadas.length,
        notasFiscais:    selecionadas,
        nfsConcatenadas: selecionadas.map(n => n.numnfs).join(';'),
        createdAt:       hoje,
      }
      await salvarRotasSupabase([rota], hoje)
      // As NFs usadas saem da seleção para não entrarem duas vezes em rotas.
      setNfsDesmarcadasBulk(selecionadas.map(n => n.numnfs), true)
      await refresh()
      setMsgRota(`✓ Rota "${codigo}" montada (${selecionadas.length} NFs) — aguardando aprovação`)
    } catch {
      setMsgRota('Erro ao montar a rota — tente novamente')
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

      {/* Barra de trabalho STICKY (Marcelo 17/08): filtros congelados no topo,
          mapa compacto ao lado, notas abaixo. */}
      <div className="sticky top-[36px] z-20 bg-[var(--color-page)] pb-2 pt-1">
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
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {total > 0 && (
                <button
                  onClick={handleGerarRota}
                  disabled={gerandoRota || totalFiltradasSelecionadas === 0}
                  className="text-[11px] px-3 py-1.5 rounded-md bg-primary text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Monta uma rota com as NFs selecionadas no filtro atual e envia para aprovação"
                >
                  {gerandoRota ? 'Montando rota…' : `➕ Gerar rota (${totalFiltradasSelecionadas} NFs)`}
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

          {mapaAberto && (
            <div className="hidden lg:flex gap-2 shrink-0 items-start">
              <ResumoSelecao notas={notasFiltradas} desmarcadas={desmarcadas} />
              <div className="w-[400px]">
                <MapaNotasInline notas={notasFiltradas} desmarcadas={desmarcadas} height={190} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabela com scroll */}
      <div className="overflow-auto rounded-xl border border-[var(--border-card)] bg-surface">
        <table className="w-full text-[12px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-cream dark:bg-hover border-b border-[var(--border-light)]">
              <th className="px-2 py-2 text-center font-medium text-muted whitespace-nowrap w-8">
                <input
                  ref={masterRef}
                  type="checkbox"
                  checked={todasSelecionadas}
                  onChange={() => (todasSelecionadas ? desmarcarFiltradas() : marcarFiltradas())}
                  title={todasSelecionadas ? 'Desmarcar todas as filtradas' : 'Marcar todas as filtradas'}
                />
              </th>
              <th className="px-2 py-2 text-center font-medium text-muted whitespace-nowrap" title="Índice de reentrega: vazio = nunca retornou; 1/2/3 = vezes que a NF voltou">Reent.</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">NF</th>
              <th className="px-2 py-2 text-left font-medium text-muted whitespace-nowrap">Emissão</th>
              <th className="px-2 py-2 text-left font-medium text-muted whitespace-nowrap">Agenda</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Remetente</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Destinatário</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Endereço</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Município</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Tipo</th>
              <th className="px-3 py-2 text-right font-medium text-muted whitespace-nowrap">Peso</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Rota de Entrega</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Observação</th>
              <th className="px-2 py-2 text-left font-medium text-muted whitespace-nowrap" title="Placa/rota já montada que contém esta NF">Placa</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <Skeleton rows={pageSize > 25 ? 25 : pageSize} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-muted text-[12px]">
                  Nenhuma NF pendente
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
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.selecionada}
                      onChange={() => toggleSelecionada(row.n_nfs)}
                      title={row.selecionada ? 'Desmarcar da roteirização' : 'Marcar para roteirização'}
                    />
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-[11px] tabular-nums" title="Vezes que a NF retornou (reentrega)">
                    <span className={row.indice_reentrega > 0 ? 'text-warn font-medium' : 'text-subtle'}>
                      {row.indice_reentrega}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-base whitespace-nowrap">
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
                  <td className="px-2 py-2 text-mid whitespace-nowrap tabular-nums">
                    {fmtData(row.emissao)}
                  </td>
                  <td className={cn('px-2 py-2 whitespace-nowrap tabular-nums', row.agenda ? 'text-base font-medium' : 'text-muted')}>
                    {fmtData(row.agenda)}
                  </td>
                  <td className="px-3 py-2 text-mid max-w-[150px] truncate" title={row.remetente ?? undefined}>
                    {row.remetente ?? '—'}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 max-w-[180px]',
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
                  <td className="px-3 py-2 text-mid max-w-[180px] truncate" title={row.endereco !== '—' ? row.endereco : undefined}>
                    {row.endereco ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-mid whitespace-nowrap">
                    {row.municipio_dest ?? row.municipio ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-mid whitespace-nowrap">
                    {row.tipo_cliente ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-mid tabular-nums whitespace-nowrap">
                    {row.peso_kg != null
                      ? `${row.peso_kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-mid whitespace-nowrap">
                    {row.rota ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-mid max-w-[220px] min-w-[140px]">
                    <ObservacaoCelula texto={row.observacao} />
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px] whitespace-nowrap">
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
