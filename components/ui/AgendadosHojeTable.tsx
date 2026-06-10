'use client'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/ui'
import { useAppData } from '@/components/providers/AppDataProvider'

function fmtHora(raw: string | undefined): string {
  if (!raw) return '—'
  // Aceita HH:MM:SS, HH:MM:SS.nnn, HH:MM
  return raw.slice(0, 5)
}

function fmtData(iso: string | undefined): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function CondDot({ cond }: { cond: string }) {
  if (cond === 'vermelho') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-danger-bg text-danger whitespace-nowrap">
      <span className="w-[5px] h-[5px] rounded-full bg-cond-err shrink-0" />Vermelho
    </span>
  )
  if (cond === 'laranja') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-warn-bg text-warn whitespace-nowrap">
      <span className="w-[5px] h-[5px] rounded-full bg-cond-warn shrink-0" />Laranja
    </span>
  )
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-cream text-muted">OK</span>
}

export function AgendadosHojeTable() {
  const { nfsPendentes } = useAppData()
  const hoje = new Date().toISOString().slice(0, 10)

  const agendados = useMemo(() => {
    return nfsPendentes
      .filter(nf => nf.dataAgendamento && nf.dataAgendamento.slice(0, 10) <= hoje)
      .sort((a, b) => {
        const ha = a.horaAgendamento ?? '23:59'
        const hb = b.horaAgendamento ?? '23:59'
        if (ha !== hb) return ha.localeCompare(hb)
        return (a.dataAgendamento ?? '').localeCompare(b.dataAgendamento ?? '')
      })
  }, [nfsPendentes, hoje])

  const thCls = 'text-left text-[10px] text-muted font-medium px-2 py-1.5 border-b border-[0.5px] border-[var(--border-subtle)] bg-page whitespace-nowrap'
  const tdCls = 'px-2 py-[5px] border-b border-[0.5px] border-[var(--border-faint)] text-[11px]'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Agendados de hoje</span>
          {agendados.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger-bg text-danger font-medium">
              {agendados.length} NFs
            </span>
          )}
        </div>
      </CardHeader>

      {agendados.length === 0 ? (
        <div className="px-4 py-10 text-center text-[12px] text-muted">
          {nfsPendentes.length === 0
            ? 'Importe o SIAT para ver os agendamentos do dia.'
            : 'Nenhuma NF agendada para hoje ou com data vencida.'}
        </div>
      ) : (
        <>
          <div className="px-3.5 py-2 text-[11px] text-warn border-b border-[0.5px] border-[var(--border-faint)]">
            NFs com data de agendamento ≤ hoje — ordenadas por hora de entrega
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>Hora</th>
                  <th className={thCls}>Dt Agend</th>
                  <th className={thCls}>N NF</th>
                  <th className={thCls}>Destinatário</th>
                  <th className={thCls}>Bairro</th>
                  <th className={thCls}>Município</th>
                  <th className={thCls}>Tipo</th>
                  <th className={cn(thCls, 'text-right')}>Peso (kg)</th>
                  <th className={thCls}>COND</th>
                  <th className={thCls}>Rota</th>
                </tr>
              </thead>
              <tbody>
                {agendados.map((nf, i) => (
                  <tr key={nf.id} className={i % 2 === 0 ? 'bg-white dark:bg-[#1E1E1C]' : 'bg-page'}>
                    <td className={cn(tdCls, 'font-mono font-medium whitespace-nowrap text-primary-dark')}>
                      {fmtHora(nf.horaAgendamento)}
                    </td>
                    <td className={cn(tdCls, 'tabular-nums text-muted whitespace-nowrap')}>
                      {fmtData(nf.dataAgendamento)}
                    </td>
                    <td className={cn(tdCls, 'font-mono whitespace-nowrap')}>{nf.numnfs}</td>
                    <td className={cn(tdCls, 'max-w-[200px] truncate font-medium')} title={nf.destinatario}>{nf.destinatario}</td>
                    <td className={cn(tdCls, 'max-w-[110px] truncate text-muted')}>{nf.bairro !== '—' ? nf.bairro : '—'}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-muted')}>{nf.municipio !== '—' ? nf.municipio : '—'}</td>
                    <td className={cn(tdCls, 'text-[10px] text-muted whitespace-nowrap')}>{nf.tipoCliente}</td>
                    <td className={cn(tdCls, 'tabular-nums text-right whitespace-nowrap')}>
                      {nf.peso > 0 ? nf.peso.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className={tdCls}><CondDot cond={nf.cond} /></td>
                    <td className={cn(tdCls, 'text-[10px] text-muted whitespace-nowrap')}>{nf.rota !== '—' ? nf.rota : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border-subtle)] bg-cream">
                  <td colSpan={7} className={cn(tdCls, 'font-medium text-muted')}>{agendados.length} agendados</td>
                  <td className={cn(tdCls, 'tabular-nums text-right font-medium')}>
                    {agendados.reduce((s, nf) => s + nf.peso, 0).toLocaleString('pt-BR')}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Card>
  )
}
