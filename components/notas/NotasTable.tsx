'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useNotasFiscais, filtrosPadrao, type PageSize, type NotasFiltros } from '@/hooks/useNotasFiscais'

import { useAppData } from '@/components/providers/AppDataProvider'
import { salvarRotasSupabase } from '@/lib/webhooks'
import type { Rota } from '@/types'

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
          {[24, 40, 120, 90, 70, 60, 55, 55, 70, 40].map((w, j) => (
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

// Filtros na barra (Marcelo, 21/08): Solução SAC em PRIMEIRO; Região fora da
// UI (o campo continua no código). Multi-seleção em todos.
const CAMPOS_UI = ['solucaoSac', 'tipoCarga', 'rota', 'municipio', 'bairro', 'tipoCliente', 'remetente'] as const

const FILTRO_LABELS: Record<(typeof CAMPOS_UI)[number], string> = {
  solucaoSac:  'Solução SAC',
  tipoCarga:   'Tipo Carga',
  rota:        'Rota de Entrega',
  municipio:   'Município',
  bairro:      'Bairro',
  tipoCliente: 'Tipo Cliente',
  remetente:   'Remetente',
}

// Chip de filtro multi-seleção (estilo slicer da planilha): botão com contador
// e dropdown de checkboxes; fecha ao clicar fora.
function MultiFiltro({ label, opcoes, selecionadas, onToggle, onLimpar }: {
  label:        string
  opcoes:       string[]
  selecionadas: string[]
  onToggle:     (valor: string) => void
  onLimpar:     () => void
}) {
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

  const ativo = selecionadas.length > 0

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAberto(v => !v)}
        className={cn(
          'text-[11px] px-2 py-1 rounded-md border cursor-pointer inline-flex items-center gap-1 whitespace-nowrap',
          ativo
            ? 'border-primary text-primary bg-primary/5 font-medium'
            : 'border-[var(--border-input)] bg-surface text-mid hover:text-base',
        )}
      >
        {label}
        {ativo && (
          <span className="bg-primary text-white rounded-full px-1.5 leading-[14px] text-[10px]">
            {selecionadas.length}
          </span>
        )}
        <svg className={cn('w-2.5 h-2.5 transition-transform', aberto && 'rotate-180')} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>

      {aberto && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-surface border border-[var(--border-card)] rounded-lg shadow-lg min-w-[210px] max-w-[300px] max-h-[280px] overflow-auto py-1">
          {ativo && (
            <button
              onClick={onLimpar}
              className="w-full text-left px-2.5 py-1 text-[11px] text-primary hover:underline cursor-pointer"
            >
              Limpar seleção
            </button>
          )}
          {opcoes.map(op => (
            <label key={op} className="flex items-center gap-2 px-2.5 py-1 text-[11px] text-base hover:bg-cream dark:hover:bg-hover cursor-pointer">
              <input
                type="checkbox"
                checked={selecionadas.includes(op)}
                onChange={() => onToggle(op)}
              />
              <span className="truncate" title={op}>{op}</span>
            </label>
          ))}
          {opcoes.length === 0 && (
            <div className="px-2.5 py-1.5 text-[11px] text-muted">Sem opções no recorte atual</div>
          )}
        </div>
      )}
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
            <div className="flex flex-wrap items-center gap-1.5">
              {CAMPOS_UI.map(campo => (
                <MultiFiltro
                  key={campo}
                  label={FILTRO_LABELS[campo]}
                  opcoes={opcoesFiltro[campo]}
                  selecionadas={filtros[campo]}
                  onToggle={valor => toggleFiltro(campo, valor)}
                  onLimpar={() => limparFiltro(campo)}
                />
              ))}
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
          </div>

          {mapaAberto && (
            <div className="w-[400px] shrink-0 hidden lg:block">
              <MapaNotasInline notas={notasFiltradas} desmarcadas={desmarcadas} height={190} />
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
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">NF</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Destinatário</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Município</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Tipo</th>
              <th className="px-3 py-2 text-right font-medium text-muted whitespace-nowrap">Peso</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Cond.</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Grade</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Observação</th>
              <th className="px-3 py-2 text-center font-medium text-muted whitespace-nowrap">Reent.</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <Skeleton rows={pageSize > 25 ? 25 : pageSize} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted text-[12px]">
                  Nenhuma NF pendente
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-[var(--border-faint)] last:border-0',
                    // Pedido do Raphael (15/08/26): a linha mantém SEMPRE sua
                    // cor normal (verde p/ destinatário repetido, zebra nas
                    // demais) — desmarcar não escurece nem esmaece nada; o
                    // estado é indicado apenas pelo checkbox.
                    row.mesmoDestAnterior
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
                  <td className={cn('px-3 py-2 max-w-[200px] truncate', row.mesmoDestAnterior ? 'text-success-dark font-medium' : 'text-base')} title={row.destinatario ?? undefined}>
                    {row.destinatario ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-mid whitespace-nowrap">
                    {row.municipio_dest ?? row.municipio ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-mid whitespace-nowrap">
                    {row.tipo_cliente ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-mid tabular-nums whitespace-nowrap">
                    {row.peso_kg != null
                      ? `${(row.peso_kg / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <CondBadge cond={row.cond} />
                  </td>
                  <td className="px-3 py-2 text-mid whitespace-nowrap">
                    {row.grade ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-mid max-w-[160px] truncate" title={row.observacao ?? undefined}>
                    {row.observacao ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.ind_ree ? '↩' : '—'}
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
