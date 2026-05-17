'use client'
import { useState, useEffect } from 'react'
import {
  Topbar, Card, CardHeader, Btn, StatusPill, WeightBar,
  ImportBar, ConfirmDialog, ConfirmAction, TextArea, Select,
} from '@/components/ui'
import { NotasFiscaisTable } from '@/components/ui/NotasFiscaisTable'
import { ImportarSIATButton } from '@/components/ui/ImportarSIATButton'
import { SiatImportDialog } from '@/components/ui/SiatImportDialog'
import { siatRowsToRotas, normalizeSiatPayload } from '@/lib/siat'
import { webhookGerarRotas, Prioridade } from '@/lib/webhooks'
import { cn, formatPeso } from '@/lib/utils'
import { useCopyToClipboard, useImport } from '@/lib/hooks'
import { Rota, RouteStatus } from '@/types'

// ── Log de sessão ─────────────────────────────────────────────────────────────
type LogEntry = {
  id: string
  ts: string
  tipo: 'aprovacao' | 'rejeicao' | 'envio' | 'geracao'
  rota: string
  descricao: string
}

const TIPO_LABELS: Record<LogEntry['tipo'], string> = {
  aprovacao: 'Aprovação de rota',
  rejeicao:  'Rejeição de rota',
  envio:     'Envio ao motorista',
  geracao:   'Geração por IA',
}

const TIPO_PILL: Record<LogEntry['tipo'], string> = {
  aprovacao: 'bg-success-bg text-success-dark',
  rejeicao:  'bg-danger-bg text-danger',
  envio:     'bg-primary-bg text-primary-dark',
  geracao:   'bg-purple-bg text-purple',
}

const STATUS_FILTERS: { label: string; value: RouteStatus | 'todos' }[] = [
  { label: 'Todas',      value: 'todos' },
  { label: 'Aguardando', value: 'aguardando' },
  { label: 'Aprovadas',  value: 'aprovada' },
  { label: 'Enviadas',   value: 'enviada' },
  { label: 'Rascunho',   value: 'rascunho' },
]

// ── Gerar Rotas Dialog ────────────────────────────────────────────────────────
type GerarRotasFormState = {
  observacoes: string; motoristasAusentes: string; veiculosBloqueados: string
  restricoesExtras: string; prioridade: string
}

function GerarRotasDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (form: GerarRotasFormState) => void }) {
  const [form, setForm] = useState<GerarRotasFormState>({
    observacoes: '', motoristasAusentes: '', veiculosBloqueados: '',
    restricoesExtras: '', prioridade: 'padrao',
  })
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50">
      <div className="animate-fade-in bg-white dark:bg-[#1E1E1C] rounded-xl border border-[0.5px] border-[var(--border-light)] p-6 w-[440px] max-w-[90vw]">
        <div className="text-sm font-medium mb-1">Instrução para o agente de IA</div>
        <div className="text-[11px] text-muted mb-4">
          Estas informações serão combinadas com as regras fixas e os dados do SIAT.
        </div>

        {[
          { key: 'observacoes',        label: 'Observações do dia',                  ph: 'Ex: Priorizar região Norte, evitar Contagem até 10h...' },
          { key: 'motoristasAusentes', label: 'Motoristas ausentes hoje',            ph: 'Ex: Douglas B, Rosana' },
          { key: 'veiculosBloqueados', label: 'Veículos bloqueados / em manutenção', ph: 'Ex: ABC-1234, XYZ-5678' },
          { key: 'restricoesExtras',   label: 'Restrições extras',                   ph: 'Ex: Atacadão só recebe até 11h hoje.' },
        ].map(f => (
          <div key={f.key} className="mb-2.5">
            <label className="block text-[11px] text-muted mb-1">{f.label}</label>
            <TextArea
              value={(form as Record<string, string>)[f.key]}
              onChange={v => set(f.key, v)}
              placeholder={f.ph}
              rows={2}
            />
          </div>
        ))}

        <div className="mb-2.5">
          <label className="block text-[11px] text-muted mb-1">Prioridade especial</label>
          <Select value={form.prioridade} onChange={v => set('prioridade', v)}>
            <option value="padrao">Padrão (agendados → SAC → varejo → data)</option>
            <option value="vermelho">Forçar prioridade Vermelho primeiro</option>
            <option value="menos-veiculos">Priorizar menor número de veículos</option>
            <option value="menor-distancia">Priorizar menor distância total</option>
          </Select>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={() => onConfirm(form)}>
            <svg className="w-[13px] h-[13px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/>
            </svg>
            Acionar IA e gerar rotas
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── Route Card ────────────────────────────────────────────────────────────────
const AVATAR_CLS = [
  'bg-primary-bg text-primary-dark',
  'bg-success-bg text-success-dark',
  'bg-purple-bg text-purple',
  'bg-teal-bg text-[#085041]',
  'bg-warn-bg text-warn',
]

function RouteCard({ rota, onUpdateStatus, onAskConfirm }: {
  rota: Rota
  onUpdateStatus: (id: string, status: RouteStatus) => void
  onAskConfirm: (action: ConfirmAction, execute: () => void) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { copied, copy } = useCopyToClipboard()
  const capacidade = rota.veiculo?.capacidadeKg || 1500

  const avatarCls = AVATAR_CLS[rota.id.charCodeAt(1) % 5]
  const initials  = rota.motorista?.sigla || '??'

  const detalhes = [
    { label: 'Código da rota',   value: rota.codigoRota },
    { label: 'Região',           value: rota.regiao },
    { label: 'Motorista',        value: rota.motorista?.nome ?? '—' },
    { label: 'Veículo',          value: `${rota.veiculo?.tipo ?? '—'} · ${rota.veiculo?.placa ?? '—'}` },
    { label: 'Peso total',       value: formatPeso(rota.pesoTotal) },
    { label: 'Qtd. NFs',         value: `${rota.qtdNotas} notas fiscais` },
    { label: 'NFs concatenadas', value: rota.nfsConcatenadas ?? '—' },
  ]

  return (
    <div className={cn(
      'bg-white dark:bg-[#1E1E1C] rounded-lg overflow-hidden transition-[border] duration-150',
      rota.status === 'aguardando'
        ? 'border border-[1.5px] border-primary'
        : 'border border-[0.5px] border-[var(--border-card)]',
    )}>
      {/* Header row */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-[10px] cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={cn('w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-medium', avatarCls)}>
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{rota.codigoRota}</div>
          <div className="text-[10px] text-muted mt-px">
            {rota.motorista?.nome} · {rota.veiculo?.placa} · {rota.veiculo?.tipo}
          </div>
        </div>

        <div className="flex gap-3 items-center shrink-0">
          <WeightBar peso={rota.pesoTotal} capacidade={capacidade} />
          <div className="text-right">
            <div className="text-xs font-medium">{rota.qtdNotas}</div>
            <div className="text-[10px] text-muted">NFs</div>
          </div>
          <StatusPill status={rota.status} />
          <svg
            className={cn('w-3.5 h-3.5 text-muted transition-transform duration-150', expanded && 'rotate-180')}
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
          >
            <path d="M4 6l4 4 4-4"/>
          </svg>
        </div>
      </div>

      {/* Expanded NFs */}
      {expanded && (
        <div className="animate-fade-in border-t border-[0.5px] border-[var(--border-subtle)] bg-page px-3.5 py-3">
          {rota.notasFiscais.length > 0 ? (
            <NotasFiscaisTable notas={rota.notasFiscais} compact />
          ) : (
            <p className="text-[11px] text-muted py-1">
              {rota.status === 'enviada'
                ? `Rota enviada ao motorista às ${rota.enviadoEm ? new Date(rota.enviadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}. Confirmação recebida.`
                : 'Nenhuma NF carregada nesta rota.'}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-[0.5px] border-[var(--border-subtle)] flex-wrap">
            <Btn size="sm" onClick={() => rota.linkMaps && window.open(rota.linkMaps, '_blank')} disabled={!rota.linkMaps}>
              <svg className="w-[11px] h-[11px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2C5.8 2 4 3.8 4 6c0 3.3 4 8 4 8s4-4.7 4-8c0-2.2-1.8-4-4-4z"/>
                <circle cx="8" cy="6" r="1.5"/>
              </svg>
              Ver mapa
            </Btn>
            {rota.status !== 'enviada' && <Btn size="sm">Editar NFs</Btn>}
            {rota.nfsConcatenadas && (
              <Btn size="sm" onClick={() => copy(rota.nfsConcatenadas!)}>
                {copied ? '✓ Copiado!' : 'Copiar NFs (;)'}
              </Btn>
            )}

            <div className="ml-auto flex gap-1.5">
              {rota.status === 'aguardando' && (
                <>
                  <Btn size="sm" variant="danger-soft" onClick={() => onAskConfirm({
                    title: `Rejeitar rota ${rota.codigoRota}`,
                    description: 'A rota voltará para rascunho e deverá ser revisada antes de nova submissão.',
                    details: detalhes,
                    confirmLabel: 'Rejeitar rota',
                    confirmVariant: 'danger-soft',
                  }, () => onUpdateStatus(rota.id, 'rascunho'))}>
                    Rejeitar
                  </Btn>
                  <Btn size="sm" variant="success" onClick={() => onAskConfirm({
                    title: `Aprovar rota ${rota.codigoRota}`,
                    description: 'A rota será aprovada e ficará pronta para envio ao motorista.',
                    details: detalhes,
                    confirmLabel: 'Aprovar rota',
                    confirmVariant: 'success',
                  }, () => onUpdateStatus(rota.id, 'aprovada'))}>
                    Aprovar rota
                  </Btn>
                </>
              )}
              {rota.status === 'aprovada' && (
                <Btn size="sm" variant="primary" onClick={() => onAskConfirm({
                  title: 'Enviar rota ao motorista',
                  description: `Uma mensagem será disparada para ${rota.motorista?.nome} com a sequência de entregas.`,
                  details: [
                    ...detalhes,
                    { label: 'Telefone', value: rota.motorista?.telefone ?? '—' },
                  ],
                  confirmLabel: 'Confirmar envio',
                  confirmVariant: 'primary',
                  warning: 'Modo simulação — nenhuma mensagem real será enviada ao motorista.',
                }, () => onUpdateStatus(rota.id, 'enviada'))}>
                  <svg className="w-[11px] h-[11px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 8l12-6-6 12V8H2z"/>
                  </svg>
                  Enviar ao motorista
                </Btn>
              )}
              {rota.status === 'rascunho' && (
                <Btn size="sm" variant="warn-soft" onClick={() => onAskConfirm({
                  title: `Submeter rota ${rota.codigoRota} para aprovação`,
                  description: 'A rota passará para status "aguardando" e poderá ser aprovada ou rejeitada.',
                  details: detalhes,
                  confirmLabel: 'Submeter',
                  confirmVariant: 'primary',
                }, () => onUpdateStatus(rota.id, 'aguardando'))}>
                  Submeter para aprovação
                </Btn>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Rotas Page ────────────────────────────────────────────────────────────────
export default function RotasPage() {
  const [routes,         setRoutes]         = useState<Rota[]>([])
  const [filter,         setFilter]         = useState<RouteStatus | 'todos'>('todos')
  const [showDialog,     setShowDialog]     = useState(false)
  const [generating,     setGenerating]     = useState(false)
  const [toast,          setToast]          = useState('')
  const [log,            setLog]            = useState<LogEntry[]>([])
  const [pendingConfirm, setPendingConfirm] = useState<{ action: ConfirmAction; execute: () => void } | null>(null)
  const [importDialog,   setImportDialog]   = useState(false)
  const imp = useImport()

  // Atualiza rotas com dados reais do SIAT após cada importação
  useEffect(() => {
    if (imp.result?.rows.length) {
      setRoutes(siatRowsToRotas(imp.result.rows))
    }
  }, [imp.result])

  const filtered  = filter === 'todos' ? routes : routes.filter(r => r.status === filter)
  const pendentes = routes.filter(r => r.status === 'aguardando').length

  function addLog(tipo: LogEntry['tipo'], rota: string, descricao: string) {
    setLog(prev => [{
      tipo, rota, descricao,
      id: Date.now().toString(),
      ts: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }, ...prev])
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function updateRouteStatus(id: string, status: RouteStatus) {
    const rota = routes.find(r => r.id === id)
    setRoutes(prev => prev.map(r =>
      r.id === id
        ? { ...r, status, ...(status === 'enviada' ? { enviadoEm: new Date().toISOString(), notasFiscais: [] } : {}) }
        : r
    ))
    if (rota) {
      const msgs: Partial<Record<RouteStatus, string>> = {
        aprovada:   `✓ Rota ${rota.codigoRota} aprovada`,
        rascunho:   `Rota ${rota.codigoRota} rejeitada — voltou para rascunho`,
        enviada:    `✓ Rota ${rota.codigoRota} enviada ao motorista`,
        aguardando: `Rota ${rota.codigoRota} submetida para aprovação`,
      }
      showToast(msgs[status] || '')

      if (status === 'aprovada')
        addLog('aprovacao', rota.codigoRota, `Rota aprovada · ${rota.motorista?.nome} · ${formatPeso(rota.pesoTotal)}`)
      else if (status === 'rascunho')
        addLog('rejeicao', rota.codigoRota, 'Rota rejeitada · devolvida para rascunho')
      else if (status === 'enviada')
        addLog('envio', rota.codigoRota, `Enviado para ${rota.motorista?.nome} · ${rota.motorista?.telefone}`)
    }
  }

  async function handleConfirm(form: GerarRotasFormState) {
    setShowDialog(false)
    setGenerating(true)

    const toList = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)

    try {
      const raw   = await webhookGerarRotas({
        data:               new Date().toISOString().slice(0, 10),
        observacoes:        form.observacoes,
        motoristasAusentes: toList(form.motoristasAusentes),
        veiculosBloqueados: toList(form.veiculosBloqueados),
        restricoesExtras:   form.restricoesExtras,
        prioridade:         form.prioridade as Prioridade,
      })
      const novas = siatRowsToRotas(normalizeSiatPayload(raw))
      const now   = new Date().toISOString()
      setRoutes(prev => {
        const ids = new Set(prev.map(r => r.id))
        return [...prev, ...novas
          .filter(r => !ids.has(r.id))
          .map(r => ({ ...r, status: 'aguardando' as const, createdAt: now }))]
      })
      showToast(`✓ IA gerou ${novas.length} novas rotas — aguardando aprovação`)
      setFilter('aguardando')
      addLog('geracao', '—', `IA gerou ${novas.length} novas rotas — aguardando aprovação`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido'
      showToast(`Falha ao gerar rotas: ${msg}`)
      addLog('geracao', '—', `Falha na geração por IA: ${msg}`)
    } finally {
      setGenerating(false)
    }
  }

  const toastOk = toast.startsWith('✓')

  return (
    <div>
      <div className="sticky top-0 z-10">
      <Topbar
        title="Rotas do dia"
        sub={routes.length
          ? `${routes.length} rotas · ${routes.reduce((a, r) => a + r.qtdNotas, 0)} NFs · ${new Date().toLocaleDateString('pt-BR')}`
          : `Importe o SIAT para carregar as rotas de hoje · ${new Date().toLocaleDateString('pt-BR')}`}
      >
        <ImportarSIATButton onClick={() => setImportDialog(true)} running={imp.running} label="Atualizar SIAT" loadingLabel="Atualizando..." />

        <select
          value={filter}
          onChange={e => setFilter(e.target.value as RouteStatus | 'todos')}
          className="h-7 border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-2 text-xs text-base font-sans outline-none cursor-pointer"
        >
          {STATUS_FILTERS.map(f => (
            <option key={f.value} value={f.value}>
              {f.label}{f.value === 'aguardando' && pendentes > 0 ? ` (${pendentes})` : ''}
            </option>
          ))}
        </select>

        {generating ? (
          <Btn variant="primary" disabled>
            <svg className="w-3 h-3 animate-spin-slow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round"/>
            </svg>
            Gerando rotas...
          </Btn>
        ) : (
          <Btn variant="primary" onClick={() => setShowDialog(true)}>+ Gerar rotas</Btn>
        )}
      </Topbar>
      </div>

      <div className="px-5 py-4 flex flex-col gap-2.5 pb-20">
        <ImportBar running={imp.running} step={imp.step} progress={imp.progress} result={imp.result} onClose={imp.reset} />

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

        {generating && (
          <div className="animate-fade-in bg-primary-bg border border-[0.5px] border-[#B5D4F4] dark:border-[#1A3A5C] rounded-lg px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-primary animate-spin-slow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round"/>
            </svg>
            <div>
              <div className="text-xs font-medium text-primary-dark">Agente de IA processando as rotas...</div>
              <div className="text-[11px] text-primary mt-0.5">
                Analisando {routes.reduce((a, r) => a + r.qtdNotas, 0)} NFs · aplicando regras GRADE/COND · alocando nos veículos
              </div>
            </div>
          </div>
        )}

        {filtered.map(rota => (
          <RouteCard
            key={rota.id}
            rota={rota}
            onUpdateStatus={updateRouteStatus}
            onAskConfirm={(action, execute) => setPendingConfirm({ action, execute })}
          />
        ))}

        {routes.length === 0 && !imp.running && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <svg className="w-8 h-8 text-subtle" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 12l-4-4m0 0l-4 4m4-4v12"/>
            </svg>
            <div className="text-sm font-medium">Nenhuma rota carregada</div>
            <div className="text-[12px] text-muted max-w-xs">Clique em &ldquo;Atualizar SIAT&rdquo; para importar as notas fiscais do dia e gerar as rotas.</div>
            <Btn onClick={() => setImportDialog(true)}>Importar SIAT agora</Btn>
          </div>
        )}

        {routes.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10 text-muted text-[13px]">Nenhuma rota com este filtro.</div>
        )}

        {/* Log de sessão */}
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
                  <span className="text-[11px] flex-1 text-mid">{entry.descricao}</span>
                  <span className="text-[10px] text-subtle shrink-0 font-mono">{entry.ts}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {showDialog && <GerarRotasDialog onClose={() => setShowDialog(false)} onConfirm={handleConfirm} />}

      {importDialog && (
        <SiatImportDialog
          onClose={() => setImportDialog(false)}
          onConfirm={f => { setImportDialog(false); imp.runImport(f) }}
        />
      )}

      {pendingConfirm && (
        <ConfirmDialog
          action={pendingConfirm.action}
          onConfirm={pendingConfirm.execute}
          onClose={() => setPendingConfirm(null)}
        />
      )}
    </div>
  )
}
