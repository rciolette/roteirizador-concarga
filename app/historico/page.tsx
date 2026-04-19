'use client'
import { useState } from 'react'
import { Topbar, Card, StatusPill, Btn, CondDot } from '@/components/ui'
import { HISTORICO_DIAS, formatPeso } from '@/lib/data'
import { Rota } from '@/types'

function cn(...cls: (string | false | undefined | null)[]) {
  return cls.filter(Boolean).join(' ')
}

const TIPO_CLASSES: Record<string, string> = {
  CD:        'bg-primary-bg text-primary-dark',
  Rede:      'bg-purple-bg text-purple',
  Reentrega: 'bg-warn-bg text-warn',
}
const TIPO_DEFAULT = 'bg-cream text-mid'

// ── Detalhe Modal ─────────────────────────────────────────────────────────────
function DetalheModal({ rota, onClose }: { rota: Rota; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copyNFs() {
    if (!rota.nfsConcatenadas) return
    navigator.clipboard.writeText(rota.nfsConcatenadas).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="animate-fade-in bg-white rounded-xl border border-[0.5px] border-[rgba(44,44,42,0.15)] w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col shadow-[0_8px_32px_rgba(44,44,42,0.12)]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[0.5px] border-[rgba(44,44,42,0.1)] flex items-center justify-between shrink-0">
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
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-page">
                  {['Nº NFS', 'Cond', 'Destinatário', 'Município / Bairro', 'Peso', 'Tipo'].map(h => (
                    <th key={h} className="text-left px-2 py-1.5 text-[10px] text-muted font-medium border-b border-[0.5px] border-[rgba(44,44,42,0.1)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rota.notasFiscais.map((nf, i) => (
                  <tr key={nf.id} className={i % 2 === 0 ? 'bg-white' : 'bg-page'}>
                    <td className="px-2 py-[5px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)] font-mono">{nf.numnfs}</td>
                    <td className="px-2 py-[5px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)]"><CondDot cond={nf.cond} label /></td>
                    <td className="px-2 py-[5px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)] max-w-[160px] truncate">{nf.destinatario}</td>
                    <td className="px-2 py-[5px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)] text-muted">{nf.municipio} / {nf.bairro}</td>
                    <td className="px-2 py-[5px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)] whitespace-nowrap">{nf.peso}kg</td>
                    <td className="px-2 py-[5px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)]">
                      <span className={cn('text-[10px] px-1.5 py-px rounded-full font-medium', TIPO_CLASSES[nf.tipoCliente] ?? TIPO_DEFAULT)}>
                        {nf.tipoCliente}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-muted text-center py-6">Detalhes das NFs não disponíveis para este registro.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[0.5px] border-[rgba(44,44,42,0.1)] flex gap-2 justify-end shrink-0">
          {rota.nfsConcatenadas && (
            <Btn size="sm" onClick={copyNFs}>{copied ? '✓ Copiado!' : 'Copiar NFs (;)'}</Btn>
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
export default function HistoricoPage() {
  const [diaIdx,          setDiaIdx]          = useState(0)
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null)

  const dia = HISTORICO_DIAS[diaIdx]

  return (
    <div className="flex flex-col h-screen bg-page">
      <Topbar title="Histórico" sub="Rotas finalizadas por dia" />

      {/* Filtros de data */}
      <div className="flex gap-2 px-5 pt-3 overflow-x-auto shrink-0 pb-px">
        {HISTORICO_DIAS.map((d, i) => (
          <button
            key={d.data}
            onClick={() => setDiaIdx(i)}
            className={cn(
              'shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer border border-[0.5px]',
              'transition-colors duration-100',
              i === diaIdx
                ? 'bg-base text-white border-base'
                : 'bg-white text-base border-[rgba(44,44,42,0.2)] hover:bg-cream',
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Métricas do dia */}
      <div className="flex gap-3 px-5 py-3 shrink-0">
        {[
          { label: 'Rotas',  value: dia.rotas },
          { label: 'NFs',    value: dia.nfs },
          { label: 'Peso',   value: formatPeso(dia.peso) },
        ].map(m => (
          <div key={m.label} className="flex-1 bg-white border border-[0.5px] border-[rgba(44,44,42,0.11)] rounded-lg px-3.5 py-2.5">
            <div className="text-[11px] text-muted">{m.label}</div>
            <div className="text-xl font-semibold mt-0.5">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <Card>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-page">
                {['Rota', 'Motorista', 'Veículo', 'Peso', 'NFs', 'Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] text-muted font-medium border-b border-[0.5px] border-[rgba(44,44,42,0.1)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dia.items.map((rota, i) => (
                <tr
                  key={rota.id}
                  onClick={() => setRotaSelecionada(rota)}
                  className={cn(
                    'cursor-pointer transition-colors duration-100',
                    i % 2 === 0 ? 'bg-white hover:bg-page' : 'bg-page hover:bg-cream',
                  )}
                >
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)] font-mono font-medium">{rota.codigoRota}</td>
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)]">{rota.motorista?.nome ?? '—'}</td>
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)] text-muted">{rota.veiculo?.tipo} {rota.veiculo?.placa}</td>
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)] whitespace-nowrap">{formatPeso(rota.pesoTotal)}</td>
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)]">{rota.qtdNotas}</td>
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[rgba(44,44,42,0.06)]"><StatusPill status={rota.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {rotaSelecionada && (
        <DetalheModal rota={rotaSelecionada} onClose={() => setRotaSelecionada(null)} />
      )}
    </div>
  )
}
