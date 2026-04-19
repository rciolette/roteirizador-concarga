'use client'
import { useState } from 'react'
import {
  Topbar, Card, Btn, StatusPill, CondDot, WeightBar,
  ImportBar, ConfirmDialog, ConfirmAction,
} from '@/components/ui'
import { MOCK_ROTAS, ROTAS_GERADAS_IA, formatPeso } from '@/lib/data'
import { Rota, RouteStatus } from '@/types'
import { useImport } from '@/lib/useImport'

function cn(...cls: (string | false | undefined | null)[]) {
  return cls.filter(Boolean).join(' ')
}

const STATUS_FILTERS: { label: string; value: RouteStatus | 'todos' }[] = [
  { label: 'Todas',      value: 'todos' },
  { label: 'Aguardando', value: 'aguardando' },
  { label: 'Aprovadas',  value: 'aprovada' },
  { label: 'Enviadas',   value: 'enviada' },
  { label: 'Rascunho',   value: 'rascunho' },
]

const TIPO_CLASSES: Record<string, string> = {
  CD:        'bg-primary-bg text-primary-dark',
  Rede:      'bg-purple-bg text-purple',
  Reentrega: 'bg-warn-bg text-warn',
}
const TIPO_DEFAULT = 'bg-cream text-mid'

// ── Gerar Rotas Dialog ────────────────────────────────────────────────────────
function GerarRotasDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [form, setForm] = useState({
    observacoes: '', motoristasAusentes: '', veiculosBloqueados: '',
    restricoesExtras: '', prioridade: 'padrao',
  })
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const inputCls = cn(
    'w-full border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page',
    'px-[11px] py-[7px] text-xs text-base font-sans resize-y outline-none',
    'focus:border-primary transition-colors duration-100',
  )

  return (
    <div className="absolute inset-0 bg-black/55 flex items-center justify-center z-50 rounded-lg">
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
            <textarea
              value={(form as Record<string, string>)[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.ph}
              rows={2}
              className={inputCls}
            />
          </div>
        ))}

        <div className="mb-2.5">
          <label className="block text-[11px] text-muted mb-1">Prioridade especial</label>
          <select
            value={form.prioridade}
            onChange={e => set('prioridade', e.target.value)}
            className={cn(
              'w-full h-8 border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page',
              'px-[11px] text-xs text-base font-sans outline-none cursor-pointer',
              'focus:border-primary transition-colors duration-100',
            )}
          >
            <option value="padrao">Padrão (agendados → SAC → varejo → data)</option>
            <option value="vermelho">Forçar prioridade Vermelho primeiro</option>
            <option value="menos-veiculos">Priorizar menor número de veículos</option>
            <option value="menor-distancia">Priorizar menor distância total</option>
          </select>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={onConfirm}>
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
  const [copied,   setCopied]   = useState(false)
  const capacidade = rota.veiculo?.capacidadeKg || 1500

  function copyNFs() {
    if (!rota.nfsConcatenadas) return
    navigator.clipboard.writeText(rota.nfsConcatenadas).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const avatarCls = AVATAR_CLS[rota.id.charCodeAt(1) % 5]
  const initials  = rota.motorista?.sigla || '??'

  const detalhes = [
    { label: 'Motorista', value: rota.motorista?.nome ?? '—' },
    { label: 'Veículo',   value: `${rota.veiculo?.tipo} · ${rota.veiculo?.placa}` },
    { label: 'Peso',      value: formatPeso(rota.pesoTotal) },
    { label: 'NFs',       value: `${rota.qtdNotas} notas` },
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
            <table className="w-full border-collapse text-[11px]" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {['Nº NFS', 'Cond', 'Destinatário', 'Município', 'Peso', 'Tipo'].map((h, i) => (
                    <th
                      key={h}
                      className="text-left text-[10px] text-muted font-medium px-1.5 py-1 border-b border-[0.5px] border-[var(--border-subtle)]"
                      style={{ width: i === 0 ? 68 : i === 1 ? 60 : i === 3 ? 90 : i === 4 ? 55 : i === 5 ? 58 : undefined }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rota.notasFiscais.map(nf => (
                  <tr key={nf.id}>
                    <td className="px-1.5 py-1 border-b border-[0.5px] border-[var(--border-faint)] font-mono">{nf.numnfs}</td>
                    <td className="px-1.5 py-1 border-b border-[0.5px] border-[var(--border-faint)]"><CondDot cond={nf.cond} label /></td>
                    <td className="px-1.5 py-1 border-b border-[0.5px] border-[var(--border-faint)] truncate">{nf.destinatario}</td>
                    <td className="px-1.5 py-1 border-b border-[0.5px] border-[var(--border-faint)] truncate">{nf.municipio}</td>
                    <td className="px-1.5 py-1 border-b border-[0.5px] border-[var(--border-faint)] whitespace-nowrap">{nf.peso}kg</td>
                    <td className="px-1.5 py-1 border-b border-[0.5px] border-[var(--border-faint)]">
                      <span className={cn('text-[10px] px-1.5 py-px rounded-full font-medium', TIPO_CLASSES[nf.tipoCliente] ?? TIPO_DEFAULT)}>
                        {nf.tipoCliente}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <Btn size="sm" onClick={copyNFs}>{copied ? '✓ Copiado!' : 'Copiar NFs (;)'}</Btn>
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
                    { label: 'NFs',      value: rota.nfsConcatenadas ?? `${rota.qtdNotas} notas` },
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
  const [routes,         setRoutes]         = useState<Rota[]>(MOCK_ROTAS)
  const [filter,         setFilter]         = useState<RouteStatus | 'todos'>('todos')
  const [showDialog,     setShowDialog]     = useState(false)
  const [generating,     setGenerating]     = useState(false)
  const [toast,          setToast]          = useState('')
  const [pendingConfirm, setPendingConfirm] = useState<{ action: ConfirmAction; execute: () => void } | null>(null)
  const imp = useImport()

  const filtered  = filter === 'todos' ? routes : routes.filter(r => r.status === filter)
  const pendentes = routes.filter(r => r.status === 'aguardando').length

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
    }
  }

  function handleConfirm() {
    setShowDialog(false)
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      const now   = new Date().toISOString()
      const novas = ROTAS_GERADAS_IA.map(r => ({ ...r, createdAt: now }))
      setRoutes(prev => {
        const ids = new Set(prev.map(r => r.id))
        return [...prev, ...novas.filter(r => !ids.has(r.id))]
      })
      showToast(`✓ IA gerou ${ROTAS_GERADAS_IA.length} novas rotas — aguardando aprovação`)
      setFilter('aguardando')
    }, 3500)
  }

  const toastOk = toast.startsWith('✓')

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="Rotas do dia"
        sub={`${routes.length} rotas · ${routes.reduce((a, r) => a + r.qtdNotas, 0)} NFs · ${new Date().toLocaleDateString('pt-BR')}`}
      >
        <Btn variant="teal" onClick={imp.runImport} disabled={imp.running}>
          <svg className="w-[13px] h-[13px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v8M5 7l3 3 3-3M3 13h10"/>
          </svg>
          {imp.running ? 'Atualizando...' : 'Atualizar SIAT'}
        </Btn>

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

      <div className="flex-1 overflow-y-auto p-4 px-5 flex flex-col gap-2.5">
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

        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted text-[13px]">Nenhuma rota com este filtro.</div>
        )}
      </div>

      {showDialog && <GerarRotasDialog onClose={() => setShowDialog(false)} onConfirm={handleConfirm} />}

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
