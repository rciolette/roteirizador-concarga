'use client'
import type { NotaFiscal } from '@/types'
import { cn } from '@/lib/utils'
import { CondDot } from '@/components/ui'
import { TIPO_CLASSES, TIPO_DEFAULT } from '@/lib/constants'

export function NotasFiscaisTable({ notas, compact = false }: {
  notas: NotaFiscal[]
  compact?: boolean
}) {
  const headers = compact
    ? ['Nº NFS', 'Cond', 'Destinatário', 'Município', 'Peso', 'Tipo']
    : ['Nº NFS', 'Cond', 'Destinatário', 'Município / Bairro', 'Peso', 'Tipo']

  const colWidths = [68, 60, undefined, 90, 55, 58]

  const headCls = cn(
    'text-left text-[10px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)]',
    compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
  )
  const cellCls = cn(
    'border-b border-[0.5px] border-[var(--border-faint)]',
    compact ? 'px-1.5 py-1' : 'px-2 py-[5px]',
  )

  return (
    <table
      className="w-full border-collapse text-[11px]"
      style={compact ? { tableLayout: 'fixed' } : undefined}
    >
      <thead>
        <tr className={compact ? undefined : 'bg-page'}>
          {headers.map((h, i) => (
            <th
              key={h}
              className={headCls}
              style={compact && colWidths[i] ? { width: colWidths[i] } : undefined}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {notas.map((nf, i) => (
          <tr
            key={nf.id}
            className={compact ? undefined : (i % 2 === 0 ? 'bg-surface' : 'bg-page')}
          >
            <td className={cn(cellCls, 'font-mono')}>{nf.numnfs}</td>
            <td className={cellCls}><CondDot cond={nf.cond} label /></td>
            <td className={cn(cellCls, 'truncate', !compact && 'max-w-[160px]')}>{nf.destinatario}</td>
            <td className={cn(cellCls, !compact && 'text-muted')}>
              {compact ? nf.municipio : `${nf.municipio} / ${nf.bairro}`}
            </td>
            <td className={cn(cellCls, 'whitespace-nowrap')}>{nf.peso}kg</td>
            <td className={cellCls}>
              <span className={cn('text-[10px] px-1.5 py-px rounded-full font-medium', TIPO_CLASSES[nf.tipoCliente] ?? TIPO_DEFAULT)}>
                {nf.tipoCliente}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
