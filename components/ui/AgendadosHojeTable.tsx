'use client'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader } from '@/components/ui'
import { useAppData } from '@/components/providers/AppDataProvider'
import type { NotaFiscal } from '@/types'

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

// Pedido do Marcelo (11/08/26, item 5): três situações de agendamento em vez
// de um filtro único de "vencidos":
//   Agendar    — NF sem data de agendamento nenhuma
//   Reagendar  — data de agendamento <= hoje (vencida ou de hoje)
//   Roteirizar — data de agendamento >= amanhã (agendamento futuro confirmado)
//
// NOTA: esta é só a classificação/visualização. Ainda não existe um caminho
// de escrita de volta ao SIAT (é SQL Server read-only aqui) nem uma tabela no
// Supabase para registrar "reagendei para X" — as ações de fato (mudar a
// data) precisam de um endpoint novo antes de virar "agendar por aqui".
type Situacao = 'agendar' | 'reagendar' | 'roteirizar'

function classificar(nf: NotaFiscal, hoje: string): Situacao {
  if (!nf.dataAgendamento) return 'agendar'
  const data = nf.dataAgendamento.slice(0, 10)
  return data <= hoje ? 'reagendar' : 'roteirizar'
}

const TABS: { key: Situacao; label: string; hint: string }[] = [
  { key: 'reagendar',  label: 'Reagendar',  hint: 'data de agendamento vencida ou de hoje' },
  { key: 'agendar',    label: 'Agendar',    hint: 'sem data de agendamento' },
  { key: 'roteirizar', label: 'Roteirizar', hint: 'agendamento confirmado a partir de amanhã' },
]

export function AgendadosHojeTable() {
  const { nfsPendentes } = useAppData()
  const hoje = new Date().toISOString().slice(0, 10)
  const [tab, setTab] = useState<Situacao>('reagendar')

  const grupos = useMemo(() => {
    const g: Record<Situacao, NotaFiscal[]> = { agendar: [], reagendar: [], roteirizar: [] }
    for (const nf of nfsPendentes) g[classificar(nf, hoje)].push(nf)
    for (const key of Object.keys(g) as Situacao[]) {
      g[key].sort((a, b) => {
        const ha = a.horaAgendamento ?? '23:59'
        const hb = b.horaAgendamento ?? '23:59'
        if (ha !== hb) return ha.localeCompare(hb)
        return (a.dataAgendamento ?? '').localeCompare(b.dataAgendamento ?? '')
      })
    }
    return g
  }, [nfsPendentes, hoje])

  const notas = grupos[tab]

  const thCls = 'text-left text-[10px] text-muted font-medium px-2 py-1.5 border-b border-[0.5px] border-[var(--border-subtle)] bg-page whitespace-nowrap'
  const tdCls = 'px-2 py-[5px] border-b border-[0.5px] border-[var(--border-faint)] text-[11px]'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1.5">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              title={t.hint}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full font-medium transition-colors',
                tab === t.key ? 'bg-primary text-white' : 'bg-cream text-muted hover:text-base dark:bg-hover',
              )}
            >
              {t.label}
              {grupos[t.key].length > 0 && (
                <span className={cn('ml-1.5 text-[10px]', tab === t.key ? 'text-white/80' : 'text-muted')}>
                  {grupos[t.key].length}
                </span>
              )}
            </button>
          ))}
        </div>
      </CardHeader>

      {notas.length === 0 ? (
        <div className="px-4 py-10 text-center text-[12px] text-muted">
          {nfsPendentes.length === 0
            ? 'Importe o SIAT para ver os agendamentos do dia.'
            : `Nenhuma NF em "${TABS.find(t => t.key === tab)?.label}".`}
        </div>
      ) : (
        <>
          <div className="px-3.5 py-2 text-[11px] text-warn border-b border-[0.5px] border-[var(--border-faint)]">
            {TABS.find(t => t.key === tab)?.hint}
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
                {notas.map((nf, i) => (
                  <tr key={nf.id} className={i % 2 === 0 ? 'bg-surface' : 'bg-page'}>
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
                  <td colSpan={7} className={cn(tdCls, 'font-medium text-muted')}>{notas.length} NFs</td>
                  <td className={cn(tdCls, 'tabular-nums text-right font-medium')}>
                    {notas.reduce((s, nf) => s + nf.peso, 0).toLocaleString('pt-BR')}
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
