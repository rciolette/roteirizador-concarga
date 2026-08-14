'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Topbar, Card, StatusPill, Btn, TextInput, statusRowBg } from '@/components/ui'
import { NotasFiscaisTable } from '@/components/ui/NotasFiscaisTable'
import { MapaRota } from '@/components/ui/MapaRota'
import { cn, formatPeso } from '@/lib/utils'
import { useCopyToClipboard } from '@/lib/hooks'
import { useAppData } from '@/components/providers/AppDataProvider'
import { carregarRotasPorPeriodo } from '@/lib/webhooks'
import { gerarLinkMapsUrl } from '@/lib/maps'
import { exportarCSV, exportarXLSX, rotasParaLinhas } from '@/lib/export'
import type { Rota, RouteStatus } from '@/types'

// ── Datas ─────────────────────────────────────────────────────────────────────

function isoHoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoMenos(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Detalhe Modal ─────────────────────────────────────────────────────────────

function DetalheModal({ rota, onClose }: { rota: Rota; onClose: () => void }) {
  const { copied, copy } = useCopyToClipboard()
  return (
    <div
      className="fixed inset-0 bg-black/55 z-[100] flex items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="animate-fade-in bg-surface rounded-xl border border-[0.5px] border-[var(--border-light)] w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col">
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
            <>
              <NotasFiscaisTable notas={rota.notasFiscais} />
              <div className="mt-4">
                <MapaRota nfs={rota.notasFiscais} height="260px" />
              </div>
            </>
          ) : (
            <p className="text-xs text-muted text-center py-6">Detalhes das NFs não disponíveis para este registro.</p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-[0.5px] border-[var(--border-subtle)] flex gap-2 justify-end shrink-0">
          {rota.nfsConcatenadas && (
            <Btn size="sm" onClick={() => copy(rota.nfsConcatenadas!)}>
              {copied ? '✓ Copiado!' : 'Copiar NFs (;)'}
            </Btn>
          )}
          {(rota.linkMaps || gerarLinkMapsUrl(rota.notasFiscais)) && (
            <Btn size="sm" onClick={() => window.open(rota.linkMaps || gerarLinkMapsUrl(rota.notasFiscais)!, '_blank')}>
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

// ── Menu de exportação ────────────────────────────────────────────────────────

function ExportMenu({ rotas, nomeBase }: { rotas: Rota[]; nomeBase: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  async function doExport(fmt: 'csv' | 'xlsx') {
    setOpen(false)
    const rows = rotasParaLinhas(rotas)
    if (rows.length === 0) return
    fmt === 'csv' ? exportarCSV(rows, nomeBase) : exportarXLSX(rows, nomeBase)
  }

  return (
    <div ref={ref} className="relative">
      <Btn size="sm" onClick={() => setOpen(v => !v)} disabled={rotas.length === 0}>
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 2v8M5 7l3 3 3-3M3 12h10"/>
        </svg>
        Exportar
        <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
          <path d="M2 3l3 4 3-4H2z"/>
        </svg>
      </Btn>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[130px] rounded-lg border border-[0.5px] border-[var(--border-subtle)] bg-surface shadow-lg overflow-hidden">
          <button
            onClick={() => doExport('csv')}
            className="w-full text-left px-3 py-2 text-[11px] hover:bg-cream transition-colors cursor-pointer bg-transparent border-none"
          >
            CSV
          </button>
          <button
            onClick={() => doExport('xlsx')}
            className="w-full text-left px-3 py-2 text-[11px] hover:bg-cream transition-colors cursor-pointer bg-transparent border-none border-t border-[0.5px] border-[var(--border-faint)]"
          >
            Excel (XLSX)
          </button>
        </div>
      )}
    </div>
  )
}

// ── Status filters ────────────────────────────────────────────────────────────

const HIST_STATUS_FILTERS: { label: string; value: RouteStatus | 'todas' }[] = [
  { label: 'Todas',      value: 'todas'     },
  { label: 'Enviadas',   value: 'enviada'   },
  { label: 'Aprovadas',  value: 'aprovada'  },
  { label: 'Rejeitadas', value: 'rejeitada' },
]

// ── HistoricoPage ─────────────────────────────────────────────────────────────

export default function HistoricoPage() {
  const hoje = isoHoje()

  const [dataInicio,      setDataInicio]      = useState(isoMenos(6))
  const [dataFim,         setDataFim]         = useState(hoje)
  const [statusFilter,    setStatusFilter]    = useState<RouteStatus | 'todas'>('todas')
  const [filtroMotorista, setFiltroMotorista] = useState('')
  const [filtroVeiculo,   setFiltroVeiculo]   = useState('')
  const [rotaSelecionada, setRotaSelecionada] = useState<Rota | null>(null)
  const [rotasPeriodo,    setRotasPeriodo]    = useState<Rota[]>([])
  const [loading,         setLoading]         = useState(false)
  const [visibleCount,    setVisibleCount]    = useState(25)
  const { rotas: rotasHoje } = useAppData()

  // Carrega o período sempre que as datas mudarem (debounce 400ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const carregar = useCallback(async (inicio: string, fim: string) => {
    if (!inicio || !fim || inicio > fim) return
    setLoading(true)
    try {
      const resultado = await carregarRotasPorPeriodo(inicio, fim)
      setRotasPeriodo(resultado)
    } catch {
      setRotasPeriodo([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => carregar(dataInicio, dataFim), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [dataInicio, dataFim, carregar])

  // Dados base: período carregado (inclui hoje se no range) + rotas de hoje do provider
  const allItens: Rota[] = (() => {
    // Combina rotas do período com rotas de hoje do AppData (mais atualizadas)
    const semHoje = rotasPeriodo.filter(r => r.data !== hoje)
    const incHoje = dataInicio <= hoje && hoje <= dataFim
    return incHoje ? [...semHoje, ...rotasHoje] : semHoje
  })()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setVisibleCount(25) }, [dataInicio, dataFim, statusFilter, filtroMotorista, filtroVeiculo])

  const itens = allItens.filter(r => {
    if (statusFilter !== 'todas' && r.status !== statusFilter) return false
    if (filtroMotorista) {
      if (!(r.motorista?.nome ?? '').toLowerCase().includes(filtroMotorista.toLowerCase())) return false
    }
    if (filtroVeiculo) {
      const q = filtroVeiculo.toLowerCase()
      if (!(r.veiculo?.placa ?? '').toLowerCase().includes(q) &&
          !(r.veiculo?.tipo  ?? '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // ── KPIs do período filtrado ───────────────────────────────────────────────
  const kpiBase = allItens // KPIs sem filtro de texto/status (mostram o total do período)
  const kpiTotal    = kpiBase.length
  const kpiNfs      = kpiBase.reduce((a, r) => a + r.qtdNotas, 0)
  const kpiPeso     = kpiBase.reduce((a, r) => a + r.pesoTotal, 0)
  const kpiEnviadas = kpiBase.filter(r => r.status === 'enviada').length
  const kpiAprov    = kpiBase.filter(r => r.status === 'aprovada').length
  const kpiRej      = kpiBase.filter(r => r.status === 'rejeitada').length

  function countStatus(s: RouteStatus | 'todas') {
    return s === 'todas' ? allItens.length : allItens.filter(r => r.status === s).length
  }

  const hasTextFilter = !!(filtroMotorista || filtroVeiculo)

  // ── Nome base para exportação ─────────────────────────────────────────────
  const nomeExport = `rotas_${dataInicio}_${dataFim}`

  return (
    <div>
      <div className="sticky top-0 z-10">
        <Topbar title="Histórico" sub="Rotas por período">
          <ExportMenu rotas={itens} nomeBase={nomeExport} />
        </Topbar>
      </div>

      {/* Filtros de período */}
      <div className="px-5 pt-3 pb-0 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-muted whitespace-nowrap">Período:</span>
        <TextInput
          type="date"
          value={dataInicio}
          onChange={v => setDataInicio(v)}
          style={{ width: 150 }}
        />
        <span className="text-[11px] text-muted">até</span>
        <TextInput
          type="date"
          value={dataFim}
          onChange={v => setDataFim(v)}
          style={{ width: 150 }}
        />

        {/* Atalhos de período */}
        <div className="flex gap-1 ml-1">
          {[
            { label: 'Hoje',    fn: () => { setDataInicio(hoje);        setDataFim(hoje)        } },
            { label: '7 dias',  fn: () => { setDataInicio(isoMenos(6)); setDataFim(hoje)        } },
            { label: '30 dias', fn: () => { setDataInicio(isoMenos(29)); setDataFim(hoje)       } },
          ].map(a => (
            <button
              key={a.label}
              onClick={a.fn}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-cream text-mid hover:bg-cream-hover hover:text-base transition-colors cursor-pointer border-none"
            >
              {a.label}
            </button>
          ))}
        </div>

        {loading && <span className="text-[11px] text-muted">Carregando...</span>}
      </div>

      {/* KPIs do período */}
      <div className="flex gap-2 px-5 pt-3 pb-0 flex-wrap">
        {[
          { label: 'Rotas',      value: kpiTotal,           color: '' },
          { label: 'NFs',        value: kpiNfs,             color: '' },
          { label: 'Peso',       value: formatPeso(kpiPeso), color: '' },
          { label: 'Enviadas',   value: kpiEnviadas,        color: 'text-primary' },
          { label: 'Aprovadas',  value: kpiAprov,           color: 'text-success' },
          { label: 'Rejeitadas', value: kpiRej,             color: kpiRej > 0 ? 'text-danger' : '' },
        ].map(m => (
          <div key={m.label} className="flex-1 min-w-[80px] bg-surface border border-[0.5px] border-[var(--border-card)] rounded-lg px-3 py-2">
            <div className="text-[10px] text-muted uppercase tracking-[0.04em]">{m.label}</div>
            <div className={cn('text-lg font-medium mt-0.5', m.color)}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros de texto + status */}
      <div className="px-5 pt-2.5 flex items-center gap-2 flex-wrap">
        <TextInput
          value={filtroMotorista}
          onChange={v => setFiltroMotorista(v)}
          placeholder="Motorista..."
          style={{ width: 160 }}
        />
        <TextInput
          value={filtroVeiculo}
          onChange={v => setFiltroVeiculo(v)}
          placeholder="Placa ou tipo..."
          style={{ width: 150 }}
        />
        {hasTextFilter && (
          <button
            onClick={() => { setFiltroMotorista(''); setFiltroVeiculo('') }}
            className="h-8 px-2 text-[11px] text-muted hover:text-danger transition-colors cursor-pointer bg-transparent border-none self-center"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Pills de status */}
      <div className="flex gap-1.5 px-5 pt-2 pb-2 flex-wrap">
        {HIST_STATUS_FILTERS.map(f => {
          const count  = countStatus(f.value)
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
                  active ? 'bg-white/25 text-white' : 'bg-white dark:bg-hover text-muted',
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
        <span className="text-[11px] text-muted self-center ml-1">
          {itens.length !== allItens.length ? `${itens.length} de ${allItens.length} rotas` : `${itens.length} rota${itens.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Tabela */}
      <div className="px-5 pb-20">
        <Card>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-page">
                {['Data', 'Rota', 'Motorista', 'Veículo', 'Peso', 'NFs', 'Status'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.slice(0, visibleCount).map((rota) => (
                <tr
                  key={rota.id}
                  onClick={() => setRotaSelecionada(rota)}
                  className={cn(
                    'cursor-pointer transition-colors duration-100',
                    statusRowBg(rota.status),
                    'hover:brightness-95',
                  )}
                >
                  <td className="px-3 py-[7px] border-b border-[0.5px] border-[var(--border-faint)] text-muted tabular-nums whitespace-nowrap">{rota.data}</td>
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
                  <td colSpan={7} className="px-3 py-8 text-center text-[12px] text-muted">
                    {loading ? 'Carregando rotas...' : 'Nenhuma rota encontrada para este período.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {visibleCount < itens.length && (
            <div className="px-4 py-3 border-t border-[0.5px] border-[var(--border-faint)] flex justify-center">
              <button
                onClick={() => setVisibleCount(c => c + 25)}
                className="text-[11px] text-primary hover:underline cursor-pointer bg-transparent border-none transition-colors"
              >
                Ver mais {Math.min(25, itens.length - visibleCount)} rotas ({itens.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </Card>
      </div>

      {rotaSelecionada && (
        <DetalheModal rota={rotaSelecionada} onClose={() => setRotaSelecionada(null)} />
      )}
    </div>
  )
}
