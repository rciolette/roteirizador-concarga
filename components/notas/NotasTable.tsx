'use client'
import { cn } from '@/lib/utils'
import { useNotasFiscais, type PageSize } from '@/hooks/useNotasFiscais'

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
          {[40, 120, 90, 70, 60, 55, 55].map((w, j) => (
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

export function NotasTable() {
  const { rows, total, page, pageSize, setPage, setPageSize, loading, error } = useNotasFiscais(25)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)

  return (
    <div className="flex flex-col min-h-0">
      {error && (
        <div className="px-4 py-2 text-[12px] text-danger bg-danger-bg rounded-lg mb-2">
          Erro ao carregar NFs: {error}
        </div>
      )}

      {/* Tabela com scroll */}
      <div className="overflow-auto rounded-xl border border-[var(--border-card)] bg-surface">
        <table className="w-full text-[12px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-cream dark:bg-hover border-b border-[var(--border-light)]">
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">NF</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Destinatário</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Município</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Tipo</th>
              <th className="px-3 py-2 text-right font-medium text-muted whitespace-nowrap">Peso</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Cond.</th>
              <th className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">Grade</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <Skeleton rows={pageSize > 25 ? 25 : pageSize} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted text-[12px]">
                  Nenhuma NF pendente
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-[var(--border-faint)] last:border-0',
                    i % 2 === 0 ? 'bg-surface' : 'bg-cream/30 dark:bg-[#1A1918]/40',
                  )}
                >
                  <td className="px-3 py-2 font-mono text-[11px] text-base whitespace-nowrap">
                    {row.n_nfs ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-base max-w-[200px] truncate" title={row.destinatario ?? undefined}>
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
