'use client'
import { useState, useEffect } from 'react'
import {
  Topbar, Card, CardHeader, Btn, StatusPill, WeightBar,
  ImportBar, ConfirmDialog, ConfirmAction, TextArea, Select,
} from '@/components/ui'
import { NotasFiscaisTable } from '@/components/ui/NotasFiscaisTable'
import { ImportarSIATButton } from '@/components/ui/ImportarSIATButton'
import { SiatImportDialog } from '@/components/ui/SiatImportDialog'
import { webhookGerarRotas, mapRetornoGerarRotas, salvarRotasSupabase, salvarNfsNaoAlocadas, atualizarStatusRota, webhookEnviarMotorista, Prioridade, MotoristaPayload } from '@/lib/webhooks'
import { listarMotoristas, criarMotorista, atualizarMotorista, removerMotorista, importarMotoristas } from '@/lib/motoristas'
import { cn, formatPeso } from '@/lib/utils'
import { useCopyToClipboard } from '@/lib/hooks'
import { useAppData } from '@/components/providers/AppDataProvider'
import { Rota, RouteStatus, RetornoGerarRotas } from '@/types'

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
  { label: 'Rascunho',   value: 'rascunho' },
  { label: 'Aguardando', value: 'aguardando' },
  { label: 'Aprovadas',  value: 'aprovada' },
  { label: 'Enviadas',   value: 'enviada' },
  { label: 'Rejeitadas', value: 'rejeitada' },
]

// ── Gerar Rotas Dialog ────────────────────────────────────────────────────────
type GerarRotasFormState = {
  data: string
  observacoes: string
  veiculosBloqueados: string
  restricoesExtras: string
  prioridade: string
}

type RosterItem = {
  _key:     string
  id?:      string
  nome:     string
  telefone: string
  placa:    string
  status:   'disponivel' | 'ausente'
}

function GerarRotasDialog({ onClose, onConfirm }: {
  onClose:    () => void
  onConfirm:  (form: GerarRotasFormState, motoristas: MotoristaPayload[]) => void
}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<GerarRotasFormState>({
    data: hoje, observacoes: '', veiculosBloqueados: '', restricoesExtras: '', prioridade: 'padrao',
  })
  const [roster,    setRoster]    = useState<RosterItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [importMsg, setImportMsg] = useState('')
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    listarMotoristas()
      .then(list => setRoster(list.map(m => ({
        _key:     m.id,
        id:       m.id,
        nome:     m.nome,
        telefone: m.telefone,
        placa:    m.placa ?? '',
        status:   m.status === 'em_rota' ? 'disponivel' : m.status,
      }))))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function addLine() {
    setRoster(p => [...p, { _key: Date.now().toString(), nome: '', telefone: '', placa: '', status: 'disponivel' }])
  }

  function removeLine(key: string) {
    const item = roster.find(r => r._key === key)
    setRoster(p => p.filter(r => r._key !== key))
    if (item?.id) removerMotorista(item.id).catch(() => {})
  }

  function updateField(key: string, field: keyof RosterItem, value: string) {
    setRoster(p => p.map(r => r._key === key ? { ...r, [field]: value } : r))
  }

  function toggleStatus(key: string) {
    setRoster(p => p.map(r => {
      if (r._key !== key) return r
      const next = r.status === 'disponivel' ? 'ausente' : 'disponivel'
      if (r.id) atualizarMotorista(r.id, { status: next }).catch(() => {})
      return { ...r, status: next }
    }))
  }

  function onBlurSave(item: RosterItem) {
    if (!item.nome.trim()) return
    if (item.id) {
      atualizarMotorista(item.id, { nome: item.nome, telefone: item.telefone, placa: item.placa }).catch(() => {})
    } else {
      criarMotorista({ nome: item.nome, telefone: item.telefone || undefined, placa: item.placa || undefined, status: item.status })
        .then(saved => setRoster(p => p.map(r => r._key === item._key ? { ...r, id: saved.id } : r)))
        .catch(() => {})
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const imported      = await importarMotoristas(file)
      const existingNames = new Set(roster.map(r => r.nome.toLowerCase()))
      const novos         = imported.filter(m => !existingNames.has(m.nome.toLowerCase()))
      const novasLinhas: RosterItem[] = novos.map(m => ({
        _key:     `${Date.now()}-${Math.random()}`,
        nome:     m.nome,
        telefone: m.telefone ?? '',
        placa:    m.placa    ?? '',
        status:   m.status,
      }))
      setRoster(p => [...p, ...novasLinhas])
      showImportMsg(`${novos.length} motorista${novos.length !== 1 ? 's' : ''} importado${novos.length !== 1 ? 's' : ''}`)
      novasLinhas.forEach((line, i) => {
        const src = novos[i]
        criarMotorista({ nome: src.nome, telefone: src.telefone, placa: src.placa, status: src.status })
          .then(saved => setRoster(p => p.map(r => r._key === line._key ? { ...r, id: saved.id } : r)))
          .catch(() => {})
      })
    } catch {
      showImportMsg('Erro ao importar arquivo')
    }
    e.target.value = ''
  }

  function showImportMsg(msg: string) {
    setImportMsg(msg)
    setTimeout(() => setImportMsg(''), 3000)
  }

  const toPayload = (r: RosterItem): MotoristaPayload => ({
    nome:     r.nome,
    telefone: r.telefone || undefined,
    placa:    r.placa    || undefined,
    status:   r.status,
  })

  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50">
      <div className="animate-fade-in bg-white dark:bg-[#1E1E1C] rounded-xl border border-[0.5px] border-[var(--border-light)] p-6 w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <div className="text-sm font-medium mb-1">Instrução para o agente de IA</div>
        <div className="text-[11px] text-muted mb-4">
          Estas informações serão combinadas com as regras fixas e os dados do SIAT.
        </div>

        <div className="mb-2.5">
          <label className="block text-[11px] text-muted mb-1">Data das rotas</label>
          <input
            type="date"
            value={form.data}
            onChange={e => set('data', e.target.value)}
            className="w-full h-8 border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-2 text-xs font-sans outline-none"
          />
        </div>

        {[
          { key: 'observacoes',        label: 'Observações',        ph: 'Instruções gerais para o roteirizador...' },
          { key: 'veiculosBloqueados', label: 'Veículos bloqueados', ph: 'Ex: ABC-1234, XYZ-5678' },
          { key: 'restricoesExtras',   label: 'Restrições extras',   ph: 'Ex: Não entregar no centro de BH hoje' },
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
          <label className="block text-[11px] text-muted mb-1">Prioridade</label>
          <Select value={form.prioridade} onChange={v => set('prioridade', v)}>
            <option value="padrao">Padrão — balancear peso e distância</option>
            <option value="vermelho">🔴 Prioridade COND vermelho</option>
            <option value="menos-veiculos">Menos veículos possível</option>
            <option value="menor-distancia">Menor distância total</option>
          </Select>
        </div>

        {/* ── Motoristas do dia ── */}
        <div className="mt-4 pt-3 border-t border-[0.5px] border-[var(--border-faint)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-muted font-medium">Motoristas do dia</span>
            <div className="flex gap-1.5 items-center">
              <label className="cursor-pointer inline-flex items-center gap-1 h-6 px-2 rounded-md border border-[0.5px] border-[var(--border-input)] text-[11px] text-mid hover:bg-cream transition-colors">
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
                Importar CSV/XLSX
              </label>
              <Btn size="sm" onClick={addLine}>+ Adicionar</Btn>
            </div>
          </div>

          {importMsg && (
            <div className={cn(
              'mb-2 text-[11px] rounded px-2 py-1',
              importMsg.startsWith('Erro') ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success-dark',
            )}>
              {importMsg}
            </div>
          )}

          {loading ? (
            <div className="text-[11px] text-muted py-2">Carregando...</div>
          ) : roster.length === 0 ? (
            <div className="text-[11px] text-muted py-2">Nenhum motorista. Adicione ou importe.</div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="grid grid-cols-[1fr_110px_72px_86px_24px] gap-1 px-0.5 mb-0.5">
                {['Nome', 'Telefone', 'Placa', 'Status', ''].map(h => (
                  <span key={h} className="text-[10px] text-subtle">{h}</span>
                ))}
              </div>
              {roster.map(item => (
                <div key={item._key} className="grid grid-cols-[1fr_110px_72px_86px_24px] gap-1 items-center">
                  <input
                    value={item.nome}
                    onChange={e => updateField(item._key, 'nome', e.target.value)}
                    onBlur={() => onBlurSave(item)}
                    placeholder="Nome"
                    className="h-7 border border-[0.5px] border-[var(--border-input)] rounded-md bg-page px-2 text-[11px] outline-none w-full min-w-0"
                  />
                  <input
                    value={item.telefone}
                    onChange={e => updateField(item._key, 'telefone', e.target.value)}
                    onBlur={() => onBlurSave(item)}
                    placeholder="Telefone"
                    className="h-7 border border-[0.5px] border-[var(--border-input)] rounded-md bg-page px-2 text-[11px] outline-none w-full min-w-0"
                  />
                  <input
                    value={item.placa}
                    onChange={e => updateField(item._key, 'placa', e.target.value)}
                    onBlur={() => onBlurSave(item)}
                    placeholder="Placa"
                    className="h-7 border border-[0.5px] border-[var(--border-input)] rounded-md bg-page px-2 text-[11px] outline-none w-full min-w-0"
                  />
                  <button
                    onClick={() => toggleStatus(item._key)}
                    className={cn(
                      'h-7 px-1.5 rounded-md text-[10px] font-medium transition-colors whitespace-nowrap',
                      item.status === 'disponivel' ? 'bg-success-bg text-success-dark' : 'bg-danger-bg text-danger',
                    )}
                  >
                    {item.status === 'disponivel' ? 'Disponível' : 'Ausente'}
                  </button>
                  <button
                    onClick={() => removeLine(item._key)}
                    className="h-6 w-6 flex items-center justify-center text-subtle hover:text-danger transition-colors rounded"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 4l8 8M12 4l-8 8"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={() => onConfirm(form, roster.filter(r => r.nome.trim()).map(toPayload))}>
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
  const capacidade  = rota.veiculo?.capacidadeKg || 1500
  const pct         = rota.ocupacaoPercent ?? Math.min(100, Math.round((rota.pesoTotal / capacidade) * 100))
  const barColor    = pct >= 95 ? 'bg-danger-mid' : pct >= 80 ? 'bg-warn-mid' : 'bg-primary'
  const avatarCls   = AVATAR_CLS[rota.id.charCodeAt(1) % 5]
  const initials    = rota.motorista?.sigla || '??'
  const temAlertas  = (rota.alertas?.length ?? 0) > 0
  const isActionable = rota.status === 'rascunho' || rota.status === 'aguardando'

  const detalhes = [
    { label: 'Código da rota',   value: rota.codigoRota },
    { label: 'Região',           value: rota.regiao },
    { label: 'Motorista',        value: rota.motorista?.nome ?? '—' },
    { label: 'Veículo',          value: `${rota.veiculo?.tipo ?? '—'} · ${rota.veiculo?.placa ?? '—'}` },
    { label: 'Peso total',       value: `${formatPeso(rota.pesoTotal)} — ${pct}%` },
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
      {/* 1. TÍTULO */}
      <div
        className="flex items-center gap-2.5 px-3.5 pt-[10px] pb-1 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={cn('w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-medium', avatarCls)}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">{rota.codigoRota}</span>
            {rota.regiao && <span className="text-[10px] text-muted shrink-0">· {rota.regiao}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {temAlertas && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-danger-bg text-danger text-[10px] font-medium">
              <span className="w-[5px] h-[5px] rounded-full bg-cond-err shrink-0" />
              {rota.alertas!.length}
            </span>
          )}
          <StatusPill status={rota.status} />
          <svg
            className={cn('w-3.5 h-3.5 text-muted transition-transform duration-150', expanded && 'rotate-180')}
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
          >
            <path d="M4 6l4 4 4-4"/>
          </svg>
        </div>
      </div>

      {/* 2. MOTORISTA / VEÍCULO */}
      <div className="flex items-center px-3.5 pb-2">
        <div className="w-[42px] shrink-0" />
        <div className="text-[10px] text-muted flex-1 truncate min-w-0">
          {rota.motorista?.nome ?? '—'} · {rota.veiculo?.tipo ?? '—'} {rota.veiculo?.placa ?? ''}
        </div>
        <div className="text-right shrink-0 ml-2">
          <span className="text-xs font-medium">{rota.qtdNotas}</span>
          <span className="text-[10px] text-muted"> NFs · {formatPeso(rota.pesoTotal)}</span>
        </div>
      </div>

      {/* 3. BARRA DE CAPACIDADE */}
      <div className="px-3.5 pb-2.5">
        <div className="h-[3px] bg-cream-hover rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-[width] duration-300', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[10px] text-muted mt-0.5">{pct}% · {formatPeso(capacidade)} cap.</div>
      </div>

      {/* 4. BOTÕES */}
      {(isActionable || rota.status === 'aprovada') && (
        <div className="px-3.5 pb-2.5 pt-2 flex gap-1.5 justify-end border-t border-[0.5px] border-[var(--border-faint)]">
          {isActionable && (
            <>
              <button
                onClick={() => onAskConfirm({
                  title: `Rejeitar rota ${rota.codigoRota}`,
                  description: 'A rota será marcada como rejeitada e não poderá mais ser enviada.',
                  details: detalhes,
                  confirmLabel: 'Rejeitar rota',
                  confirmVariant: 'danger-soft',
                }, () => onUpdateStatus(rota.id, 'rejeitada'))}
                className="px-3 py-[5px] text-[11px] text-muted hover:text-danger transition-colors cursor-pointer bg-transparent border-none"
              >
                Rejeitar
              </button>
              <Btn size="sm" variant="success" onClick={() => onAskConfirm({
                title: `Aprovar rota ${rota.codigoRota}`,
                description: 'A rota será aprovada e ficará pronta para envio ao motorista.',
                details: detalhes,
                confirmLabel: 'Aprovar rota',
                confirmVariant: 'success',
              }, () => onUpdateStatus(rota.id, 'aprovada'))}>
                <svg className="w-[11px] h-[11px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8l3.5 3.5L13 5"/>
                </svg>
                <span className="font-semibold">Aprovar</span>
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
            }, () => onUpdateStatus(rota.id, 'enviada'))}>
              <svg className="w-[11px] h-[11px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 8l12-6-6 12V8H2z"/>
              </svg>
              Enviar ao motorista
            </Btn>
          )}
        </div>
      )}

      {/* EXPANDED: alertas + NFs + ações extras */}
      {expanded && (
        <div className="animate-fade-in border-t border-[0.5px] border-[var(--border-subtle)] bg-page px-3.5 py-3">
          {temAlertas && (
            <div className="mb-3 flex flex-col gap-1">
              {rota.alertas!.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-danger">
                  <span className="w-1.5 h-1.5 rounded-full bg-cond-err shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          )}

          {rota.notasFiscais.length > 0 ? (
            <NotasFiscaisTable notas={rota.notasFiscais} compact />
          ) : (
            <p className="text-[11px] text-muted py-1">
              {rota.status === 'enviada'
                ? `Rota enviada ao motorista às ${rota.enviadoEm ? new Date(rota.enviadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}. Confirmação recebida.`
                : 'Nenhuma NF carregada nesta rota.'}
            </p>
          )}

          <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-[0.5px] border-[var(--border-subtle)] flex-wrap">
            {(rota.status === 'aprovada' || rota.status === 'enviada') && (
              <Btn size="sm" onClick={() => rota.linkMaps && window.open(rota.linkMaps, '_blank')} disabled={!rota.linkMaps}>
                <svg className="w-[11px] h-[11px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 2C5.8 2 4 3.8 4 6c0 3.3 4 8 4 8s4-4.7 4-8c0-2.2-1.8-4-4-4z"/>
                  <circle cx="8" cy="6" r="1.5"/>
                </svg>
                Ver mapa
              </Btn>
            )}
            {rota.status === 'enviada' && rota.nfsConcatenadas && (
              <Btn size="sm" onClick={() => copy(rota.nfsConcatenadas!)}>
                {copied ? '✓ Copiado!' : 'Copiar NFs'}
              </Btn>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Rotas Page ────────────────────────────────────────────────────────────────
export default function RotasPage() {
  const { nfImportState, importarNFs, dismissNFImport, nfRows, rotas: routes, setRotas: setRoutes, loadingRotas } = useAppData()
  const [filter,         setFilter]         = useState<RouteStatus | 'todos'>('todos')
  const [showDialog,     setShowDialog]     = useState(false)
  const [generating,     setGenerating]     = useState(false)
  const [toast,          setToast]          = useState('')
  const [log,            setLog]            = useState<LogEntry[]>([])
  const [pendingConfirm, setPendingConfirm] = useState<{ action: ConfirmAction; execute: () => void } | null>(null)
  const [importDialog,   setImportDialog]   = useState(false)

  const summary = nfImportState.summary
  const importResult = summary
    ? { nfs: summary.totalNFs, peso: summary.pesoTotalToneladas, veiculos: summary.veiculosUnicos }
    : undefined

  const filtered  = filter === 'todos' ? routes : routes.filter(r => r.status === filter)

  function countByStatus(s: RouteStatus | 'todos') {
    return s === 'todos' ? routes.length : routes.filter(r => r.status === s).length
  }

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

  function updateRouteStatus(id: string, status: RouteStatus) {
    const rota = routes.find(r => r.id === id)
    setRoutes(prev => prev.map(r =>
      r.id === id
        ? { ...r, status, ...(status === 'enviada' ? { enviadoEm: new Date().toISOString(), notasFiscais: [] } : {}) }
        : r
    ))
    atualizarStatusRota(id, status).catch(() => {})
    if (status === 'enviada' && rota?.motorista?.telefone) {
      webhookEnviarMotorista({
        rotaId:          id,
        codigoRota:      rota.codigoRota,
        motoristaNome:   rota.motorista.nome,
        motoristaTel:    rota.motorista.telefone,
        linkMaps:        rota.linkMaps,
        nfsConcatenadas: rota.nfsConcatenadas,
        qtdNotas:        rota.qtdNotas,
        pesoTotal:       rota.pesoTotal,
      }).catch(() => {})
    }
    if (rota) {
      const msgs: Partial<Record<RouteStatus, string>> = {
        aprovada:  `✓ Rota ${rota.codigoRota} aprovada`,
        rejeitada: `Rota ${rota.codigoRota} rejeitada`,
        enviada:   `✓ Rota ${rota.codigoRota} enviada ao motorista`,
      }
      showToast(msgs[status] || '')

      if (status === 'aprovada')
        addLog('aprovacao', rota.codigoRota, `Rota aprovada · ${rota.motorista?.nome} · ${formatPeso(rota.pesoTotal)}`)
      else if (status === 'rejeitada')
        addLog('rejeicao', rota.codigoRota, 'Rota rejeitada')
      else if (status === 'enviada')
        addLog('envio', rota.codigoRota, `Enviado para ${rota.motorista?.nome} · ${rota.motorista?.telefone}`)
    }
  }

  async function handleConfirm(form: GerarRotasFormState, motoristas: MotoristaPayload[]) {
    setShowDialog(false)
    setGenerating(true)

    try {
      const raw = await webhookGerarRotas({
        data:               form.data || new Date().toISOString().slice(0, 10),
        observacoes:        form.observacoes,
        motoristas,
        veiculosBloqueados: form.veiculosBloqueados.split(',').map(x => x.trim()).filter(Boolean),
        restricoesExtras:   form.restricoesExtras,
        prioridade:         form.prioridade as Prioridade,
        notasFiscais:       nfRows.length > 0 ? nfRows : undefined,
      }) as RetornoGerarRotas

      const novas = mapRetornoGerarRotas(raw)
      const dataRota = form.data || new Date().toISOString().slice(0, 10)

      let rotasSalvas = novas
      try {
        rotasSalvas = await salvarRotasSupabase(novas, dataRota)
      } catch {
        // falha silenciosa — rotas ficam visíveis mas sem persistência
      }

      setRoutes(prev => {
        const ids = new Set(prev.map(r => r.id))
        return [...prev, ...rotasSalvas.filter(r => !ids.has(r.id))]
      })
      showToast(`✓ IA gerou ${novas.length} rotas — aguardando aprovação`)
      setFilter('aguardando')
      addLog('geracao', '—', `IA gerou ${novas.length} rotas — aguardando aprovação`)

      if (raw.nfsNaoAlocadas?.length > 0) {
        salvarNfsNaoAlocadas(raw.nfsNaoAlocadas, dataRota, raw.motivoNaoAlocacao).catch(() => {})
        setTimeout(() => {
          showToast(`Atenção: ${raw.nfsNaoAlocadas.length} NFs não alocadas — ${raw.motivoNaoAlocacao}`)
        }, 4200)
      }
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
      {loadingRotas && routes.length === 0 && (
        <div className="fixed inset-0 bg-page/80 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-[#1E1E1C] rounded-xl border border-[0.5px] border-[var(--border-card)] px-8 py-6 flex flex-col items-center gap-3 text-center shadow-lg">
            <svg className="w-6 h-6 text-primary animate-spin-slow" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20"/>
            </svg>
            <div className="text-sm font-medium">Carregando rotas do dia...</div>
            <div className="text-[11px] text-muted">Consultando Supabase</div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-10">
        <Topbar
          title="Rotas do dia"
          sub={routes.length
            ? `${routes.length} rotas · ${routes.reduce((a, r) => a + r.qtdNotas, 0)} NFs · ${new Date().toLocaleDateString('pt-BR')}`
            : `Importe o SIAT para carregar as rotas de hoje · ${new Date().toLocaleDateString('pt-BR')}`}
        >
          <ImportarSIATButton onClick={() => setImportDialog(true)} running={nfImportState.running} label="Importar NFs" loadingLabel="Importando..." />

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

      {/* Filtro em pills */}
      <div className="px-5 py-2.5 flex gap-1.5 flex-wrap border-b border-[0.5px] border-[var(--border-faint)]">
        {STATUS_FILTERS.map(f => {
          const count = countByStatus(f.value)
          const active = filter === f.value
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
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

      <div className="px-5 py-4 flex flex-col gap-2.5 pb-20">
        <ImportBar running={nfImportState.running} step={nfImportState.step} progress={nfImportState.progress} result={importResult} onClose={dismissNFImport} />

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

        <div className="flex flex-col gap-2.5">
          {filtered.map(rota => (
            <RouteCard
              key={rota.id}
              rota={rota}
              onUpdateStatus={updateRouteStatus}
              onAskConfirm={(action, execute) => setPendingConfirm({ action, execute })}
            />
          ))}
        </div>

        {routes.length === 0 && !importState.running && (
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

      {showDialog && <GerarRotasDialog onClose={() => setShowDialog(false)} onConfirm={(form, motoristas) => handleConfirm(form, motoristas)} />}

      {importDialog && (
        <SiatImportDialog
          onClose={() => setImportDialog(false)}
          onConfirm={f => { setImportDialog(false); importarNFs(f) }}
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
