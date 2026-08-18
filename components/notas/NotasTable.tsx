'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useNotasFiscais, type PageSize, type NotasFiltros } from '@/hooks/useNotasFiscais'

const MapaNotasDialog = dynamic(
  () => import('@/components/notas/MapaNotasDialog').then(m => m.MapaNotasDialog),
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

// Pedido do Marcelo (11/08/26, item 7): filtros de seleção de notas.
const FILTRO_LABELS: Record<keyof NotasFiltros, string> = {
  regiao:      'Região',
  solucaoSac:  'Solução SAC',
  tipoCarga:   'Tipo Carga',
  rota:        'Rota de Entrega',
  municipio:   'Município',
  bairro:      'Bairro',
  tipoCliente: 'Tipo Cliente',
  remetente:   'Remetente',
}

export function NotasTable() {
  const {
    rows, total, totalDesmarcadas, page, pageSize, setPage, setPageSize, loading, error,
    filtros, setFiltro, limparFiltros, opcoesFiltro, toggleSelecionada, limparDesmarcacoes,
    totalFiltradasSelecionadas, marcarFiltradas, desmarcarFiltradas,
    notasFiltradas, desmarcadas, incluirParciais, setIncluirParciais,
  } = useNotasFiscais(25)
  const [mapaAberto, setMapaAberto] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)
  const filtrosAtivos = Object.values(filtros).some(Boolean)

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

      {/* Filtros (item 7) */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {(Object.keys(FILTRO_LABELS) as (keyof NotasFiltros)[]).map(campo => (
          <select
            key={campo}
            value={filtros[campo]}
            onChange={e => setFiltro(campo, e.target.value)}
            className="text-[11px] px-1.5 py-1 rounded-md border border-[var(--border-input)] bg-surface text-mid max-w-[150px]"
          >
            <option value="">{FILTRO_LABELS[campo]}</option>
            {opcoesFiltro[campo].map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        ))}
        {filtrosAtivos && (
          <button
            onClick={limparFiltros}
            className="text-[11px] px-2 py-1 rounded-md text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}
        <button
          onClick={() => setIncluirParciais(!incluirParciais)}
          className={cn(
            'text-[11px] px-2 py-1 rounded-md border cursor-pointer',
            incluirParciais
              ? 'border-primary text-primary bg-primary/5'
              : 'border-[var(--border-input)] bg-surface text-muted hover:text-base',
          )}
          title="Rotas parciais 996/999 ficam ocultas por padrão"
        >
          {incluirParciais ? '✓ 996/999 incluídas' : 'Incluir 996/999'}
        </button>
        {total > 0 && (
          <button
            onClick={() => setMapaAberto(true)}
            className="text-[11px] px-2 py-1 rounded-md border border-[var(--border-input)] bg-surface text-mid hover:text-base cursor-pointer"
            title="Prévia no mapa das notas filtradas (cores por região)"
          >
            🗺 Ver no mapa
          </button>
        )}
        <span className="text-[11px] text-muted ml-auto flex items-center gap-2">
          {total > 0 && (
            <span className={cn(totalFiltradasSelecionadas < total && 'text-warn font-medium')}>
              {totalFiltradasSelecionadas}/{total} selecionada{totalFiltradasSelecionadas !== 1 ? 's' : ''} p/ roteirizar
            </span>
          )}
          {totalDesmarcadas > 0 && (
            <button onClick={limparDesmarcacoes} className="text-primary hover:underline">restaurar todas</button>
          )}
        </span>
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

      {mapaAberto && (
        <MapaNotasDialog
          notas={notasFiltradas}
          desmarcadas={desmarcadas}
          onClose={() => setMapaAberto(false)}
        />
      )}
    </div>
  )
}
