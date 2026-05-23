'use client'
import { useState, useEffect } from 'react'
import { Topbar, Card, CardHeader, Btn, StatusPill, TextArea } from '@/components/ui'
import { useAppData } from '@/components/providers/AppDataProvider'
import { atualizarStatusRota, reprocessarRota } from '@/lib/webhooks'
import { formatPeso, cn } from '@/lib/utils'
import type { Rota, RouteStatus, NotaFiscal } from '@/types'
import { MapaRota } from '@/components/ui/MapaRota'

// ── Helpers ───────────────────────────────────────────────────────────────────

function CondBadge({ cond }: { cond: string }) {
  const c = cond.toLowerCase()
  if (c === 'vermelho')
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-danger-bg text-danger whitespace-nowrap">
        <span className="w-[5px] h-[5px] rounded-full bg-cond-err shrink-0" />Vermelho
      </span>
    )
  if (c === 'laranja')
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-warn-bg text-warn whitespace-nowrap">
        <span className="w-[5px] h-[5px] rounded-full bg-cond-warn shrink-0" />Laranja
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-cream text-muted">OK</span>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function RouteDrawer({ rota, onClose, onAprovar, onRejeitar }: {
  rota: Rota
  onClose:   () => void
  onAprovar: (obs: string) => void
  onRejeitar:(obs: string) => void
}) {
  const [obs, setObs] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const capacidade = rota.veiculo?.capacidadeKg ?? 1500
  const pct        = rota.ocupacaoPercent ?? Math.min(100, Math.round((rota.pesoTotal / capacidade) * 100))
  const barColor   = pct > 95 ? 'bg-cond-err' : pct > 80 ? 'bg-cond-warn' : 'bg-cond-ok'
  const isActionable = rota.status === 'aguardando' || rota.status === 'rascunho'

  const thCls = 'text-left text-[10px] text-muted font-medium px-2 py-1.5 border-b border-[0.5px] border-[var(--border-subtle)] bg-page whitespace-nowrap sticky top-0'
  const tdCls = 'px-2 py-[5px] border-b border-[0.5px] border-[var(--border-faint)] text-[11px]'

  function restricao(nf: NotaFiscal): string | null {
    if (nf.observacao) return nf.observacao
    if (nf.sac && Number(nf.sac) > 0) return `SAC ${nf.sac}`
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="animate-slide-in-right fixed top-0 right-0 h-full w-[480px] max-w-full bg-page z-50 flex flex-col border-l border-[0.5px] border-[var(--border-subtle)] shadow-2xl">

        {/* Cabeçalho */}
        <div className="px-5 py-4 border-b border-[0.5px] border-[var(--border-faint)] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold font-mono">{rota.codigoRota}</span>
              {rota.regiao && <span className="text-[11px] text-muted">{rota.regiao}</span>}
              <StatusPill status={rota.status} />
            </div>
            <div className="text-[11px] text-muted leading-relaxed">
              {rota.motorista?.nome ?? '—'}
              {rota.veiculo && (
                <> &nbsp;·&nbsp; {rota.veiculo.tipo} &nbsp;·&nbsp; <span className="font-mono">{rota.veiculo.placa}</span></>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-muted hover:text-base hover:bg-cream transition-colors cursor-pointer bg-transparent border-none mt-0.5"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M2 2l12 12M14 2L2 14"/>
            </svg>
          </button>
        </div>

        {/* Barra de capacidade */}
        <div className="px-5 py-3 border-b border-[0.5px] border-[var(--border-faint)] shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted">Peso total</span>
            <span className="text-[11px] font-medium tabular-nums">
              {formatPeso(rota.pesoTotal)} / {formatPeso(capacidade)} &nbsp;·&nbsp; {pct}%
            </span>
          </div>
          <div className="h-2 bg-cream-hover rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-[width]', barColor)} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto">

          {/* Mapa de destinos */}
          {rota.notasFiscais.length > 0 && (
            <div className="px-5 pt-3.5 pb-3 border-b border-[0.5px] border-[var(--border-faint)]">
              <MapaRota nfs={rota.notasFiscais} height="220px" />
            </div>
          )}

          {/* Lista de NFs */}
          <div className="px-5 pt-3.5 pb-3">
            <div className="text-[11px] text-muted font-medium mb-2">
              {rota.qtdNotas} nota{rota.qtdNotas !== 1 ? 's' : ''} fiscal{rota.qtdNotas !== 1 ? 'is' : ''}
            </div>
            {rota.notasFiscais.length === 0 ? (
              <p className="text-[11px] text-muted py-2">
                NFs não carregadas nesta sessão — clique em expandir na lista principal para ver detalhes.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[0.5px] border-[var(--border-subtle)]">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      <th className={thCls}>NF</th>
                      <th className={thCls}>Destinatário</th>
                      <th className={thCls}>Endereço</th>
                      <th className={cn(thCls, 'text-right')}>Peso</th>
                      <th className={thCls}>COND</th>
                      <th className={thCls}>Restrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rota.notasFiscais.map((nf, i) => {
                      const res = restricao(nf)
                      return (
                        <tr key={nf.id} className={i % 2 === 0 ? 'bg-white dark:bg-[#1E1E1C]' : 'bg-page'}>
                          <td className={cn(tdCls, 'font-mono whitespace-nowrap')}>{nf.numnfs}</td>
                          <td className={cn(tdCls, 'max-w-[120px] truncate')} title={nf.destinatario}>{nf.destinatario}</td>
                          <td className={cn(tdCls, 'max-w-[100px] truncate text-muted')} title={`${nf.endereco} ${nf.bairro} ${nf.municipio}`}>
                            {nf.bairro || nf.municipio || '—'}
                          </td>
                          <td className={cn(tdCls, 'text-right tabular-nums whitespace-nowrap')}>{formatPeso(nf.peso)}</td>
                          <td className={tdCls}><CondBadge cond={nf.cond} /></td>
                          <td className={tdCls}>
                            {res ? (
                              <span className="flex items-center gap-1 text-[10px] text-warn">
                                <span>⚠</span>
                                <span className="truncate max-w-[80px]" title={res}>{res}</span>
                              </span>
                            ) : <span className="text-subtle">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Observação do aprovador */}
          {isActionable && (
            <div className="px-5 py-3 border-t border-[0.5px] border-[var(--border-faint)]">
              <label className="block text-[11px] text-muted mb-1.5">Observação do aprovador</label>
              <TextArea
                value={obs}
                onChange={setObs}
                placeholder="Adicione uma observação antes de aprovar ou rejeitar…"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Rodapé fixo com ações */}
        {isActionable && (
          <div className="px-5 py-3.5 border-t border-[0.5px] border-[var(--border-subtle)] flex gap-2 justify-end shrink-0 bg-page">
            <Btn variant="danger-soft" onClick={() => onRejeitar(obs)}>Rejeitar</Btn>
            <Btn variant="success" onClick={() => onAprovar(obs)}>
              <svg className="w-[11px] h-[11px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8l3.5 3.5L13 5"/>
              </svg>
              <span className="font-semibold">Aprovar rota</span>
            </Btn>
          </div>
        )}
      </div>
    </>
  )
}

// ── Log ───────────────────────────────────────────────────────────────────────

type LogEntry = {
  id:        string
  ts:        string
  tipo:      'aprovacao' | 'rejeicao' | 'envio' | 'reprocessamento'
  rota:      string
  descricao: string
}

const TIPO_LABELS: Record<LogEntry['tipo'], string> = {
  aprovacao:       'Aprovação',
  rejeicao:        'Rejeição',
  envio:           'Envio ao motorista',
  reprocessamento: 'Reprocessamento',
}

const TIPO_PILL: Record<LogEntry['tipo'], string> = {
  aprovacao:       'bg-success-bg text-success-dark',
  rejeicao:        'bg-danger-bg text-danger',
  envio:           'bg-primary-bg text-primary-dark',
  reprocessamento: 'bg-purple-bg text-purple',
}

// ── AprovacoesPage ────────────────────────────────────────────────────────────

export default function AprovacoesPage() {
  const { rotas, setRotas } = useAppData()
  const [drawerRota,   setDrawerRota]   = useState<Rota | null>(null)
  const [reprocessing, setReprocessing] = useState<Set<string>>(new Set())
  const [log,          setLog]          = useState<LogEntry[]>([])
  const [toast,        setToast]        = useState('')

  function addLog(tipo: LogEntry['tipo'], rota: string, descricao: string) {
    setLog(prev => [{
      tipo, rota, descricao,
      id: Date.now().toString(),
      ts: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }, ...prev])
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  function updateStatus(id: string, status: RouteStatus, obs?: string) {
    const rota = rotas.find(r => r.id === id)
    setRotas(prev => prev.map(r =>
      r.id === id
        ? { ...r, status, ...(status === 'enviada' ? { enviadoEm: new Date().toISOString(), notasFiscais: [] } : {}) }
        : r
    ))
    atualizarStatusRota(id, status, obs).catch(() => {})
    setDrawerRota(null)
    if (rota) {
      const msgs: Partial<Record<RouteStatus, string>> = {
        aprovada:  `✓ Rota ${rota.codigoRota} aprovada`,
        rejeitada: `Rota ${rota.codigoRota} rejeitada`,
        enviada:   `✓ Rota ${rota.codigoRota} enviada ao motorista`,
      }
      showToast(msgs[status] || '')
      if (status === 'aprovada')
        addLog('aprovacao', rota.codigoRota, `Aprovada · ${rota.motorista?.nome ?? '—'} · ${formatPeso(rota.pesoTotal)}${obs ? ` · "${obs}"` : ''}`)
      else if (status === 'rejeitada')
        addLog('rejeicao', rota.codigoRota, `Rejeitada${obs ? ` · "${obs}"` : ''}`)
      else if (status === 'enviada')
        addLog('envio', rota.codigoRota, `Enviado para ${rota.motorista?.nome ?? '—'} · ${rota.motorista?.telefone ?? '—'}`)
    }
  }

  async function handleReprocessar(rota: Rota) {
    setReprocessing(prev => new Set(prev).add(rota.id))
    try {
      await reprocessarRota(rota.id)
      showToast(`✓ Reprocessamento solicitado para ${rota.codigoRota}`)
      addLog('reprocessamento', rota.codigoRota, `Reprocessamento solicitado via webhook IA`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido'
      showToast(`Falha ao reprocessar ${rota.codigoRota}: ${msg}`)
    } finally {
      setReprocessing(prev => { const n = new Set(prev); n.delete(rota.id); return n })
    }
  }

  const aguardando = rotas.filter(r => r.status === 'aguardando')
  const aprovadas  = rotas.filter(r => r.status === 'aprovada')
  const enviadas   = rotas.filter(r => r.status === 'enviada')
  const toastOk    = toast.startsWith('✓')

  return (
    <div>
      <div className="sticky top-0 z-10">
        <Topbar
          title="Aprovações"
          sub={`${aguardando.length} aguardando · ${aprovadas.length} aprovadas · ${enviadas.length} enviadas`}
        />
      </div>

      <div className="px-5 py-4 flex flex-col gap-3 pb-20">

        {toast && (
          <div className={cn(
            'animate-fade-in rounded-lg px-4 py-2.5 text-xs font-medium border border-[0.5px]',
            toastOk
              ? 'bg-success-bg border-success-border text-success-dark'
              : 'bg-warn-bg border-warn-border text-warn',
          )}>
            {toast}
          </div>
        )}

        {/* ── Aguardando aprovação ── */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">
              Aguardando aprovação
              {aguardando.length > 0 && (
                <span className="ml-2 text-[10px] font-medium bg-warn-bg text-warn px-2 py-px rounded-full">
                  {aguardando.length}
                </span>
              )}
            </span>
            <span className="text-[11px] text-muted">clique na rota para ver detalhes</span>
          </CardHeader>
          {aguardando.length === 0 ? (
            <div className="px-4 py-6 text-xs text-subtle text-center">Nenhuma rota aguardando aprovação.</div>
          ) : (
            <div className="flex flex-col">
              {aguardando.map((rota, i) => {
                const isReprocessing = reprocessing.has(rota.id)
                return (
                  <div
                    key={rota.id}
                    className={cn(
                      'flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-cream dark:hover:bg-[#28282A] transition-colors',
                      i < aguardando.length - 1 && 'border-b border-[0.5px] border-[var(--border-faint)]',
                    )}
                    onClick={e => {
                      // Não abrir drawer ao clicar nos botões
                      if ((e.target as HTMLElement).closest('button')) return
                      setDrawerRota(rota)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium font-mono">{rota.codigoRota}</span>
                        {rota.regiao && <span className="text-[10px] text-muted">{rota.regiao}</span>}
                        <StatusPill status={rota.status} />
                        {(rota.alertas?.length ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-danger-bg text-danger text-[10px] font-medium">
                            <span className="w-[5px] h-[5px] rounded-full bg-cond-err shrink-0" />
                            {rota.alertas!.length}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted">
                        {rota.motorista?.nome ?? '—'} · {rota.veiculo?.tipo ?? '—'} {rota.veiculo?.placa ?? ''} · {formatPeso(rota.pesoTotal)} · {rota.qtdNotas} NFs
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <Btn
                        size="sm"
                        disabled={isReprocessing}
                        onClick={() => handleReprocessar(rota)}
                      >
                        {isReprocessing ? (
                          <svg className="w-3 h-3 animate-spin-slow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round"/>
                          </svg>
                        ) : '↺'}
                        {isReprocessing ? 'Processando…' : 'Reprocessar'}
                      </Btn>
                      <Btn size="sm" variant="danger-soft" onClick={() => updateStatus(rota.id, 'rejeitada')}>Rejeitar</Btn>
                      <Btn size="sm" variant="success" onClick={() => updateStatus(rota.id, 'aprovada')}>Aprovar</Btn>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* ── Aprovadas — prontas para envio ── */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">
              Aprovadas — prontas para envio
              {aprovadas.length > 0 && (
                <span className="ml-2 text-[10px] font-medium bg-primary-bg text-primary-dark px-2 py-px rounded-full">
                  {aprovadas.length}
                </span>
              )}
            </span>
            <span className="text-[11px] text-muted">confirme antes de disparar ao motorista</span>
          </CardHeader>
          {aprovadas.length === 0 ? (
            <div className="px-4 py-6 text-xs text-subtle text-center">Nenhuma rota aprovada aguardando envio.</div>
          ) : (
            <div className="flex flex-col">
              {aprovadas.map((rota, i) => (
                <div
                  key={rota.id}
                  className={cn(
                    'flex items-center gap-3.5 px-4 py-3 cursor-pointer hover:bg-cream dark:hover:bg-[#28282A] transition-colors',
                    i < aprovadas.length - 1 && 'border-b border-[0.5px] border-[var(--border-faint)]',
                  )}
                  onClick={e => {
                    if ((e.target as HTMLElement).closest('button')) return
                    setDrawerRota(rota)
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium font-mono">{rota.codigoRota}</span>
                      {rota.regiao && <span className="text-[10px] text-muted">{rota.regiao}</span>}
                      <StatusPill status={rota.status} />
                    </div>
                    <div className="text-[11px] text-muted">
                      {rota.motorista?.nome ?? '—'} · {rota.motorista?.telefone ?? '—'} · {formatPeso(rota.pesoTotal)} · {rota.qtdNotas} NFs
                    </div>
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    <Btn size="sm" variant="primary" onClick={() => updateStatus(rota.id, 'enviada')}>
                      <svg className="w-[11px] h-[11px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 8l12-6-6 12V8H2z"/>
                      </svg>
                      Enviar ao motorista
                    </Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Enviadas hoje ── */}
        {enviadas.length > 0 && (
          <Card>
            <CardHeader>
              <span className="text-xs font-medium">Enviadas hoje</span>
              <span className="text-[11px] text-muted">{enviadas.length} rotas</span>
            </CardHeader>
            <div className="flex flex-col">
              {enviadas.map((rota, i) => (
                <div
                  key={rota.id}
                  className={cn(
                    'flex items-center gap-3.5 px-4 py-2.5 cursor-pointer hover:bg-cream dark:hover:bg-[#28282A] transition-colors',
                    i < enviadas.length - 1 && 'border-b border-[0.5px] border-[var(--border-faint)]',
                  )}
                  onClick={() => setDrawerRota(rota)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium font-mono">{rota.codigoRota}</span>
                      <StatusPill status="enviada" />
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      {rota.motorista?.nome ?? '—'} · {rota.enviadoEm
                        ? new Date(rota.enviadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Log da sessão ── */}
        {log.length > 0 && (
          <Card>
            <CardHeader>
              <span className="text-xs font-medium">Log desta sessão</span>
              <Btn size="sm" onClick={() => setLog([])}>Limpar</Btn>
            </CardHeader>
            <div className="flex flex-col">
              {log.map((entry, i) => (
                <div key={entry.id} className={cn('flex items-center gap-2.5 px-4 py-2.5', i < log.length - 1 && 'border-b border-[0.5px] border-[var(--border-faint)]')}>
                  <span className={cn('text-[10px] font-medium px-2 py-px rounded-full whitespace-nowrap shrink-0', TIPO_PILL[entry.tipo])}>
                    {TIPO_LABELS[entry.tipo]}
                  </span>
                  <span className="text-[11px] flex-1 text-mid truncate">{entry.descricao}</span>
                  <span className="text-[10px] text-subtle shrink-0 font-mono">{entry.ts}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* ── Drawer ── */}
      {drawerRota && (
        <RouteDrawer
          rota={drawerRota}
          onClose={() => setDrawerRota(null)}
          onAprovar={obs => updateStatus(drawerRota.id, 'aprovada', obs || undefined)}
          onRejeitar={obs => updateStatus(drawerRota.id, 'rejeitada', obs || undefined)}
        />
      )}
    </div>
  )
}
