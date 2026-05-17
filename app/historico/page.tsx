'use client'
import { useState } from 'react'
import { Topbar, Card, StatusPill, Btn, ImportBar } from '@/components/ui'
import { ImportarSIATButton } from '@/components/ui/ImportarSIATButton'
import { SiatImportDialog } from '@/components/ui/SiatImportDialog'
import { NotasFiscaisTable } from '@/components/ui/NotasFiscaisTable'
import { HISTORICO_DIAS } from '@/lib/data'
import { cn, formatPeso } from '@/lib/utils'
import { useCopyToClipboard } from '@/lib/hooks'
import { useAppData } from '@/components/providers/AppDataProvider'
import { Rota, RouteStatus } from '@/types'

// ── Detalhe Modal ─────────────────────────────────────────────────────────────
function DetalheModal({ rota, onClose }: { rota: Rota; onClose: () => void }) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <div
      className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="animate-fade-in bg-white dark:bg-[#1E1E1C] rounded-xl border border-[0.5px] border-[var(--border-light)] w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[0.5px] border-[var(--border-subtle)] flex items-center justify-between shrink-0">
          <div>
            <div className="text-[13px] font-medium">{rota.codigoRota}</div>
            <div className="text-[11px] text-muted mt-0.5">
              {rota.motorista?.nome} · {rota.veiculo?.tipo} {rota.veiculo?.placa} · {formatPeso(rota.pesoTotal)} · {rota.qtdNotas} NFs
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={rota.status} />
            <button
              onClick={onClose}
              className="bg-transparent border-none cursor-pointer text-muted text-xl leading-none px-1 hover:text-base transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {rota.enviadoEm && (
            <div className="text-[11px] text-success-dark bg-success-bg border border-[0.5px] border-success-border rounded-lg px-3 py-2 mb-3">
              Enviada ao motorista às {new Date(rota.enviadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {rota.nfsConcatenadas && (
            <div className="text-[11px] text-muted mb-3 font-mono bg-page px-3 py-2 rounded-lg">
              NFs: {rota.nfsConcatenadas}
            </div>
          )}

          {rota.notasFiscais.length > 0 ? (
            <NotasFiscaisTable notas={rota.notasFiscais} />
          ) : (
            <p className="text-xs text-muted text-center py-6">Detalhes das NFs não disponíveis para este registro.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[0.5px] border-[var(--border-subtle)] flex gap-2 justify-end shrink-0">
          {rota.nfsConcatenadas && (
            <Btn size="sm" onClick={() => copy(rota.nfsConcatenadas!)}>
              {copied ? '✓ Copiado!' : 'Copiar NFs (;)'}
            </Btn>
          )}
          {rota.linkMaps && (
            <Btn size="sm" onClick={() => window.open(rota.linkMaps, '_blank')}>
              <svg className="w-[11px] h-[11px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2C5.8 2 4 3.8 4 6c0 3.3 4 8 4 8s4-4.7 4-8c0-2.2-1.8-4-4-4z"/>
                <circle cx="8" cy="6" r="1.5"/>
              </svg>
              Ver mapa
            </Btn>
          )}
          <Btn size="sm" onClick={onClose}>Fechar</Btn>
        </div>
      </div>
    </div>
  )
}

// ── Historico Page ────────────────────────────────────────────────────────────
// HISTORICO_DIAS[0] = hoje (dados mock substituídos pelo SIAT após import)
// Demais dias permanecem como referência histórica até persistência em BD.

const HIST_STATUS_FILTERS: { label: string; value: RouteStatus | 'todas' }[] = [
  { label: 'Todas',     value: 'todas' },
  { label: 'Enviadas',  value: 'enviada' },
  { label: 'Aprovadas', value: 'aprovada' },
  { label: 'Rejeitadas', value: 'rejeitada' },
]

export default function HistoricoPage() {
  const { importState, refresh, dismissImport, rotas } = useAppData()
  const [diaIdx,          setDiaIdx]          = useState(0)
  const [statusFilter,    setStatusFilter]    = useState<RouteStatus | 'todas'>('todas')
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null)
  const [importDialog,    setImportDialog]    = useState(false)

  const summary = importState.summary
  const importResult = summary
    ? { nfs: summary.totalNFs, peso: summary.pesoTotalToneladas, veiculos: summary.veiculosUnicos }
    : undefined

  const dia      = HISTORICO_DIAS[diaIdx]
  const isHoje   = diaIdx === 0
  // Hoje: usa as rotas do provider (importadas do SIAT); outros dias: mock histórico
  const hojeRotas = rotas.length > 0 ? rotas : null
  const allItens = isHoje && hojeRotas ? hojeRotas : dia.items
  const itens    = statusFilter === 'todas' ? allItens : allItens.filter(r => r.status === statusFilter)
  const rotasQtd = isHoje && hojeRotas ? hojeRotas.length        : dia.rotas
  const nfsQtd   = isHoje && hojeRotas ? hojeRotas.reduce((a, r) => a + r.qtdNotas, 0) : dia.nfs
  const pesoQtd  = isHoje && hojeRotas ? hojeRotas.reduce((a, r) => a + r.pesoTotal, 0) : dia.peso

  function countStatus(s: RouteStatus | 'todas') {
    return s === 'todas' ? allItens.length : allItens.filter(r => r.status === s).length
  }

  return (
    <div>
      <div className="sticky top-0 z-10">
        <Topbar title="Histórico" sub="Rotas finalizadas por dia">
          <ImportarSIATButton
            onClick={() => setImportDialog(true)}
            running={importState.running}
            label="Importar hoje"
            loadingLabel="Importando..."
          />
        </Topbar>
      </div>

      <div className="px-5 pt-3">
        <ImportBar running={importState.running} step={importState.step} progress={importState.progress} result={importResult} onClose={dismissImport} />
      </div>

      {/* Filtros de data */}
      <div className="flex gap-2 px-5 pt-2 overflow-x-auto pb-px">
        {HISTORICO_DIAS.map((d, i) => (
          <button
            key={d.data}
            onClick={() => setDiaIdx(i)}
            className={cn(
              'shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-[0.5px]',
              'transition-colors duration-100',
              i === diaIdx
                ? 'bg-base text-white border-base'
                : 'bg-white dark:bg-[#1E1E1C] text-base border-[var(--border-mid)] hover:bg-cream',
            )}
          >
            {d.label}{i === 0 && hojeRotas ? ' · SIAT' : ''}
          </button>
        ))}
      </div>

      {/* Filtro de status */}
      <div className="flex gap-1.5 px-5 pt-2 pb-1 flex-wrap">
        {HIST_STATUS_FILTERS.map(f => {
          const count = countStatus(f.value)
          const active = statusFilter === f.value
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-colors duration-100',
                active
                  ? 'bg-primary text-white'
                  : 'bg-cream text-mid hover:bg-cream-hover hover:text-base',
              )}
            >
              {f.label}
              {count > 0 && (
                <span className={cn(
                  'text-[10px] min-w-[16px] text-center px-1 rounded-full font-medium',
                  active ? 'bg-white/25 text-white' : 'bg-white dark:bg-[#2A2A28] text-muted',
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Métricas do dia */}
      <div className="flex gap-3 px-5 py-3">
        {[
          { label: 'Rotas', value: rotasQtd },
          { label: 'NFs',   value: nfsQtd },
          { label: 'Peso',  value: formatPeso(pesoQtd) },
        ].map(m => (
          <div key={m.label} className="flex-1 bg-white dark:bg-[#1E1E1C] border border-[0.5px] border-[var(--border-card)] rounded-lg px-3.5 py-2.5">
            <div className="text-[11px] text-muted">{m.label}</div>
            <div className="text-xl font-medium mt-0.5">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="px-5 pb-20">
        <Card>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-page">
                {['Rota', 'Motorista', 'Veículo', 'Peso', 'NFs', 'Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((rota, i) => (
                <tr
                  key={rota.id}
                  onClick={() => setRotaSelecionada(rota)}
                  className={cn(
                    'cursor-pointer transition-colors duration-100',
                    i % 2 === 0 ? 'bg-white dark:bg-[#1E1E1C] hover:bg-page' : 'bg-page hover:bg-cream',
                  )}
                >
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[var(--border-faint)] font-mono font-medium">{rota.codigoRota}</td>
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[var(--border-faint)]">{rota.motorista?.nome ?? '—'}</td>
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[var(--border-faint)] text-muted">{rota.veiculo?.tipo} {rota.veiculo?.placa}</td>
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[var(--border-faint)] whitespace-nowrap">{formatPeso(rota.pesoTotal)}</td>
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[var(--border-faint)]">{rota.qtdNotas}</td>
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[var(--border-faint)]"><StatusPill status={rota.status} /></td>
                </tr>
              ))}
              {itens.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-muted">
                    Importe o SIAT para ver as rotas de hoje.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {importDialog && (
        <SiatImportDialog
          onClose={() => setImportDialog(false)}
          onConfirm={f => { setImportDialog(false); refresh(f) }}
        />
      )}

      {rotaSelecionada && (
        <DetalheModal rota={rotaSelecionada} onClose={() => setRotaSelecionada(null)} />
      )}
    </div>
  )
}
