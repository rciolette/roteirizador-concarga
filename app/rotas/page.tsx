'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Topbar, Card, CardHeader, Btn, StatusPill, WeightBar,
  ImportBar, ConfirmDialog, ConfirmAction, TextArea, Select, TextInput,
} from '@/components/ui'
import { exportarCSV, exportarXLSX, rotasParaLinhas } from '@/lib/export'
import { NotasFiscaisTable } from '@/components/ui/NotasFiscaisTable'
import { NfsPendentesTable } from '@/components/ui/NfsPendentesTable'
import { AgendadosHojeTable } from '@/components/ui/AgendadosHojeTable'
import { MapaRota } from '@/components/ui/MapaRota'
import { ImportarSIATButton } from '@/components/ui/ImportarSIATButton'
import { SiatImportDialog } from '@/components/ui/SiatImportDialog'
import { webhookGerarRotas, mapRetornoGerarRotas, salvarRotasSupabase, salvarNfsNaoAlocadas, atualizarStatusRota, webhookEnviarMotorista, Prioridade, MotoristaPayload, VeiculoDisponivel } from '@/lib/webhooks'
import { derivarCond } from '@/lib/siat'
import { listarCapacidades, type CapacidadeVeiculo } from '@/lib/frota'
import type { SiatRow } from '@/lib/siat'
import type { Veiculo, Motorista, NotaFiscal } from '@/types'
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
  dataInicio: string
  dataFim:    string
  observacoes: string
  restricoesExtras: string
  prioridade: string
}

function GerarRotasDialog({ onClose, onConfirm, motoristas, veiculos }: {
  onClose:    () => void
  onConfirm:  (form: GerarRotasFormState, motoristas: MotoristaPayload[], veiculos: VeiculoDisponivel[]) => void
  motoristas: Motorista[]
  veiculos:   Veiculo[]
}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<GerarRotasFormState>({
    dataInicio: hoje, dataFim: hoje, observacoes: '', restricoesExtras: '', prioridade: 'padrao',
  })
  const [motoristasSel, setMotoristasSel] = useState<Set<string>>(
    () => new Set(motoristas.filter(m => m.status !== 'ausente').map(m => m.id))
  )
  const [veiculosSel, setVeiculosSel] = useState<Set<string>>(
    () => new Set(veiculos.filter(v => v.disponivel_hoje && v.status === 'disponivel').map(v => v.id))
  )
  const [buscaMot, setBuscaMot] = useState('')
  const [buscaVei, setBuscaVei] = useState('')
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function toggleSet(prev: Set<string>, id: string): Set<string> {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  }

  const veiDisabled = (v: Veiculo) => v.status === 'manutencao' || v.status === 'indisponivel'

  const motoristasFiltrados = motoristas.filter(m => {
    const q = buscaMot.toLowerCase()
    return !q || m.nome.toLowerCase().includes(q) || m.sigla.toLowerCase().includes(q) || m.telefone.toLowerCase().includes(q)
  })

  const veiculosFiltrados = veiculos
    .slice()
    .sort((a, b) => (b.disponivel_hoje ? 1 : 0) - (a.disponivel_hoje ? 1 : 0))
    .filter(v => {
      const q = buscaVei.toLowerCase()
      return !q || v.placa.toLowerCase().includes(q) || v.modelo.toLowerCase().includes(q)
    })

  function handleConfirmClick() {
    const veiculosNoPayload = veiculos.filter(v => veiculosSel.has(v.id) && v.disponivel_hoje)
    const placasDisponiveisNoPayload = new Set(veiculosNoPayload.map(v => v.placa))

    const motoristasPayload: MotoristaPayload[] = motoristas
      .filter(m => motoristasSel.has(m.id) && (!m.placa || placasDisponiveisNoPayload.has(m.placa)))
      .map(m => ({
        nome:     m.nome,
        telefone: m.telefone || undefined,
        placa:    m.placa    || undefined,
        status:   (m.status === 'ausente' ? 'ausente' : 'disponivel') as 'disponivel' | 'ausente',
      }))
    const veiculosPayload: VeiculoDisponivel[] = veiculosNoPayload
      .map(v => ({
        placa:            v.placa,
        tipo:             v.tipo,
        capacidadeKg:     v.capacidadeKg,
        motoristaNome:    v.motoristaNome,
        motoristaCelular: v.motoristaCelular,
      }))
    onConfirm(form, motoristasPayload, veiculosPayload)
  }

  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50">
      <div className="animate-fade-in bg-white dark:bg-[#1E1E1C] rounded-xl border border-[0.5px] border-[var(--border-light)] p-6 w-[640px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <div className="text-sm font-medium mb-1">Instrução para o agente de IA</div>
        <div className="text-[11px] text-muted mb-4">
          Estas informações serão combinadas com as regras fixas e os dados do SIAT.
        </div>

        <div className="mb-2.5 flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] text-muted mb-1">Data início</label>
            <input
              type="date"
              value={form.dataInicio}
              onChange={e => set('dataInicio', e.target.value)}
              className="w-full h-8 border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-2 text-xs font-sans outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] text-muted mb-1">Data fim</label>
            <input
              type="date"
              value={form.dataFim}
              onChange={e => set('dataFim', e.target.value)}
              className="w-full h-8 border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-2 text-xs font-sans outline-none"
            />
          </div>
        </div>

        {[
          { key: 'observacoes',      label: 'Observações',      ph: 'Instruções gerais para o roteirizador...' },
          { key: 'restricoesExtras', label: 'Restrições extras', ph: 'Ex: Não entregar no centro de BH hoje' },
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
            <span className="text-[10px] text-subtle">{motoristasSel.size} de {motoristas.length} selecionados</span>
          </div>
          <div className="mb-2">
            <TextInput value={buscaMot} onChange={setBuscaMot} placeholder="Buscar por nome, sigla ou telefone" />
          </div>
          {motoristas.length === 0 ? (
            <div className="text-[11px] text-muted py-2">Nenhum motorista ativo na frota.</div>
          ) : motoristasFiltrados.length === 0 ? (
            <div className="text-[11px] text-muted py-2">Nenhum resultado para &ldquo;{buscaMot}&rdquo;.</div>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto pr-0.5">
              {motoristasFiltrados.map(m => (
                <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-cream dark:hover:bg-[#2a2a28] cursor-pointer select-none transition-colors">
                  <input
                    type="checkbox"
                    checked={motoristasSel.has(m.id)}
                    onChange={() => setMotoristasSel(prev => toggleSet(prev, m.id))}
                    className="w-3.5 h-3.5 shrink-0 accent-primary"
                  />
                  <span className="text-[11px] font-medium flex-1 truncate">{m.nome}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-page border border-[0.5px] border-[var(--border-input)] text-subtle font-mono shrink-0">{m.sigla}</span>
                  {m.telefone && <span className="text-[10px] text-muted shrink-0">{m.telefone}</span>}
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                    m.status === 'disponivel' ? 'bg-success-bg text-success-dark' :
                    m.status === 'em_rota'    ? 'bg-primary-bg text-primary-dark' :
                                                'bg-danger-bg text-danger',
                  )}>
                    {m.status === 'disponivel' ? 'Disponível' : m.status === 'em_rota' ? 'Em rota' : 'Ausente'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ── Veículos disponíveis ── */}
        <div className="mt-4 pt-3 border-t border-[0.5px] border-[var(--border-faint)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-muted font-medium">Veículos disponíveis</span>
            <span className="text-[10px] text-subtle">{veiculosSel.size} de {veiculos.filter(v => !veiDisabled(v)).length} selecionados</span>
          </div>
          <div className="mb-2">
            <TextInput value={buscaVei} onChange={setBuscaVei} placeholder="Buscar por placa ou modelo" />
          </div>
          {veiculos.length === 0 ? (
            <div className="text-[11px] text-muted py-2">Nenhum veículo ativo na frota.</div>
          ) : veiculosFiltrados.length === 0 ? (
            <div className="text-[11px] text-muted py-2">Nenhum resultado para &ldquo;{buscaVei}&rdquo;.</div>
          ) : (
            <div className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto pr-0.5">
              {veiculosFiltrados.map(v => {
                const disabled = veiDisabled(v)
                return (
                  <label key={v.id} className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg select-none transition-colors',
                    disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-cream dark:hover:bg-[#2a2a28] cursor-pointer',
                  )}>
                    <input
                      type="checkbox"
                      checked={veiculosSel.has(v.id)}
                      disabled={disabled}
                      onChange={() => !disabled && setVeiculosSel(prev => toggleSet(prev, v.id))}
                      className="w-3.5 h-3.5 shrink-0 accent-primary"
                    />
                    <span className="text-[11px] font-medium font-mono shrink-0">{v.placa}</span>
                    <span className="text-[10px] text-muted truncate flex-1">{v.modelo}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-page border border-[0.5px] border-[var(--border-input)] text-subtle shrink-0">{v.tipo}</span>
                    <span className="text-[10px] text-muted shrink-0">{formatPeso(v.capacidadeKg)}</span>
                    {v.motoristaNome && <span className="text-[10px] text-subtle truncate max-w-[80px] shrink-0">{v.motoristaNome}</span>}
                    {v.disponivel_hoje
                      ? <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-teal-bg text-[#085041]">Disponível hoje</span>
                      : <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-warn-bg text-warn">Ativo</span>
                    }
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={handleConfirmClick}>
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

// ── Maps helpers ─────────────────────────────────────────────────────────────
function enderecoMaps(nf: NotaFiscal): string {
  const parts: string[] = []
  if (nf.endereco && nf.endereco !== '—') parts.push(nf.endereco)
  if (nf.bairro   && nf.bairro   !== '—') parts.push(nf.bairro)
  if (nf.municipio && nf.municipio !== '—') parts.push(nf.municipio)
  parts.push('MG')
  return parts.join(', ')
}

function priNF(nf: NotaFiscal, hoje: string): number {
  if (nf.dataAgendamento && nf.dataAgendamento <= hoje) return 0
  if (nf.sac || nf.indRee) return 1
  if (nf.cond === 'vermelho') return 2
  if (nf.cond === 'laranja')  return 3
  return 4
}

function gerarLinkMapsLocal(nfs: NotaFiscal[], enderecoOrigem?: string | null): string | null {
  if (!nfs.length) return null
  const hoje = new Date().toISOString().slice(0, 10)
  const sorted = [...nfs].sort((a, b) => {
    const d = priNF(a, hoje) - priNF(b, hoje)
    if (d !== 0) return d
    return a.dataEmissao.localeCompare(b.dataEmissao)
  })
  const seen = new Set<string>()
  const stops: string[] = []
  for (const nf of sorted) {
    const addr = enderecoMaps(nf)
    if (!seen.has(addr)) { seen.add(addr); stops.push(addr) }
  }
  const maxParadas = enderecoOrigem ? 24 : 25
  const sliced = stops.slice(0, maxParadas)
  if (!sliced.length) return null
  const pontos = enderecoOrigem ? [enderecoOrigem, ...sliced] : sliced
  return 'https://www.google.com/maps/dir/' + pontos.map(encodeURIComponent).join('/')
}

// ── Route Card ────────────────────────────────────────────────────────────────
const AVATAR_CLS = [
  'bg-primary-bg text-primary-dark',
  'bg-success-bg text-success-dark',
  'bg-purple-bg text-purple',
  'bg-teal-bg text-[#085041]',
  'bg-warn-bg text-warn',
]

function RouteCard({ rota, onUpdateStatus, onAskConfirm, enderecoOrigem }: {
  rota: Rota
  onUpdateStatus: (id: string, status: RouteStatus, linkMaps?: string) => void
  onAskConfirm: (action: ConfirmAction, execute: () => void) => void
  enderecoOrigem?: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const { copied, copy } = useCopyToClipboard()
  const mapsLink    = rota.linkMaps || (rota.notasFiscais.length > 0 ? gerarLinkMapsLocal(rota.notasFiscais, enderecoOrigem) : null)
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
                { label: 'Link Maps', value: mapsLink ? `${rota.notasFiscais.length} paradas` : '—' },
              ],
              confirmLabel: 'Confirmar envio',
              confirmVariant: 'primary',
            }, () => onUpdateStatus(rota.id, 'enviada', mapsLink ?? undefined))}>
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

          {rota.notasFiscais.length > 0 && (
            <div className="mt-3">
              <MapaRota nfs={rota.notasFiscais} height="260px" originAddress={enderecoOrigem ?? undefined} />
            </div>
          )}

          <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-[0.5px] border-[var(--border-subtle)] flex-wrap">
            {mapsLink && (
              <Btn size="sm" onClick={() => window.open(mapsLink, '_blank')}>
                <svg className="w-[11px] h-[11px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 2C5.8 2 4 3.8 4 6c0 3.3 4 8 4 8s4-4.7 4-8c0-2.2-1.8-4-4-4z"/>
                  <circle cx="8" cy="6" r="1.5"/>
                </svg>
                {rota.linkMaps ? 'Ver mapa (IA)' : `Ver mapa (${rota.notasFiscais.length} paradas)`}
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

// ── S/Rota Tab ────────────────────────────────────────────────────────────────
function SRotaCondBadge({ cond }: { cond: 'ok' | 'laranja' | 'vermelho' }) {
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

function SRotaTable({ rows }: { rows: SiatRow[] }) {
  const thCls = 'text-left text-[10px] text-muted font-medium px-2 py-1.5 border-b border-[0.5px] border-[var(--border-subtle)] bg-page whitespace-nowrap'
  const tdCls = 'px-2 py-[5px] border-b border-[0.5px] border-[var(--border-faint)] text-[11px]'
  const pesoTotal = rows.reduce((a, r) => a + (typeof r.PesoBruto === 'number' ? r.PesoBruto : 0), 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">S/Rota — NFs sem rota definida</span>
          {rows.length > 0 && (
            <>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-warn-bg text-warn font-medium">{rows.length} NFs</span>
              <span className="text-[10px] text-muted">{(pesoTotal / 1000).toFixed(2)} t</span>
            </>
          )}
        </div>
      </CardHeader>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px] text-muted">
          Nenhuma NF com S/Rota encontrada na importação atual.
        </div>
      ) : (
        <>
          <div className="px-3.5 py-2 text-[11px] text-warn border-b border-[0.5px] border-[var(--border-faint)]">
            NFs com ROTA = "S/ROTA" no SIAT — requerem tratamento manual antes da roteirização.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>N NF</th>
                  <th className={thCls}>Destinatário</th>
                  <th className={thCls}>Município</th>
                  <th className={thCls}>Bairro</th>
                  <th className={thCls}>Tipo</th>
                  <th className={thCls}>Peso (kg)</th>
                  <th className={thCls}>COND</th>
                  <th className={thCls}>SAC</th>
                  <th className={thCls}>Observação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={String(row.NUMNFS ?? i)} className={i % 2 === 0 ? 'bg-white dark:bg-[#1E1E1C]' : 'bg-page'}>
                    <td className={cn(thCls, 'font-mono border-b border-[0.5px] border-[var(--border-faint)] bg-transparent')}>{row.NUMNFS ?? '—'}</td>
                    <td className={cn(tdCls, 'max-w-[180px] truncate')} title={row.Destinatario ?? ''}>{row.Destinatario ?? '—'}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-muted')}>{row.MunicipioFinal ?? row.Municipio ?? '—'}</td>
                    <td className={cn(tdCls, 'max-w-[110px] truncate text-muted')}>{row.BairroFinal ?? row.Bairro ?? '—'}</td>
                    <td className={tdCls}><span className="text-[10px] text-muted">{row.TipoCliente ?? '—'}</span></td>
                    <td className={cn(tdCls, 'tabular-nums text-right whitespace-nowrap')}>
                      {typeof row.PesoBruto === 'number' ? row.PesoBruto.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className={tdCls}><SRotaCondBadge cond={derivarCond(row)} /></td>
                    <td className={tdCls}>
                      {row.SAC
                        ? <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-warn-bg text-warn">{row.SAC}</span>
                        : <span className="text-subtle">—</span>}
                    </td>
                    <td className={cn(tdCls, 'max-w-[160px] truncate text-muted')} title={row.Observacao ?? ''}>{row.Observacao ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  )
}

// ── Export Menu ───────────────────────────────────────────────────────────────
function ExportMenuRotas({ rotas }: { rotas: import('@/types').Rota[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  const hoje = new Date().toISOString().slice(0, 10)
  async function doExport(fmt: 'csv' | 'xlsx') {
    setOpen(false)
    const rows = rotasParaLinhas(rotas)
    if (!rows.length) return
    fmt === 'csv' ? exportarCSV(rows, `rotas_${hoje}`) : exportarXLSX(rows, `rotas_${hoje}`)
  }
  return (
    <div ref={ref} className="relative">
      <Btn size="sm" onClick={() => setOpen(v => !v)} disabled={!rotas.length}>
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10"/></svg>
        Exportar
        <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3l3 4 3-4H2z"/></svg>
      </Btn>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[130px] rounded-lg border border-[0.5px] border-[var(--border-subtle)] bg-white dark:bg-[#1E1E1C] shadow-lg overflow-hidden">
          <button onClick={() => doExport('csv')} className="w-full text-left px-3 py-2 text-[11px] hover:bg-cream cursor-pointer bg-transparent border-none">CSV</button>
          <button onClick={() => doExport('xlsx')} className="w-full text-left px-3 py-2 text-[11px] hover:bg-cream cursor-pointer bg-transparent border-none border-t border-[0.5px] border-[var(--border-faint)]">Excel (XLSX)</button>
        </div>
      )}
    </div>
  )
}

// ── Rotas Page ────────────────────────────────────────────────────────────────
export default function RotasPage() {
  const { nfImportState, importarNFs, dismissNFImport, nfRows, rotas: routes, setRotas: setRoutes, loadingRotas, motoristas, veiculos, config, refreshVeiculos } = useAppData()
  const [filter,         setFilter]         = useState<RouteStatus | 'todos'>('todos')
  const [busca,          setBusca]          = useState('')
  const [ordenar,        setOrdenar]        = useState('')
  const [tabPendentes,   setTabPendentes]   = useState<'pendentes' | 'srota' | 'agendados'>('pendentes')

  const sRotaNfs = useMemo(
    () => nfRows.filter(r => String(r.ROTA || '').toUpperCase().includes('S/ROTA')),
    [nfRows],
  )

  // Atualiza notas e veículos automaticamente ao abrir a página
  useEffect(() => {
    importarNFs()
    refreshVeiculos()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [showDialog,     setShowDialog]     = useState(false)
  const [generating,     setGenerating]     = useState(false)
  const [toast,          setToast]          = useState('')
  const [log,            setLog]            = useState<LogEntry[]>([])
  const [pendingConfirm, setPendingConfirm] = useState<{ action: ConfirmAction; execute: () => void } | null>(null)
  const [importDialog,   setImportDialog]   = useState(false)
  const [enderecoOrigem, setEnderecoOrigem] = useState<string | null>(null)
  const [capacidades,    setCapacidades]    = useState<CapacidadeVeiculo[]>([])
  const [showPrevisao,   setShowPrevisao]   = useState(false)

  useEffect(() => {
    fetch('/api/empresa')
      .then(r => r.json())
      .then(d => {
        const e = d.empresa
        if (!e) return
        const partes = [e.endereco, e.cidade, e.uf].filter(Boolean)
        if (partes.length) setEnderecoOrigem(partes.join(', '))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    listarCapacidades().then(setCapacidades).catch(() => {})
  }, [])

  const summary = nfImportState.summary
  const importResult = summary
    ? { nfs: summary.totalNFs, peso: summary.pesoTotalToneladas, veiculos: summary.veiculosUnicos }
    : undefined

  const filtered = useMemo(() => {
    let result = filter === 'todos' ? routes : routes.filter(r => r.status === filter)
    if (busca) {
      const q = busca.toLowerCase()
      result = result.filter(r =>
        r.codigoRota.toLowerCase().includes(q) ||
        (r.motorista?.nome ?? '').toLowerCase().includes(q) ||
        (r.veiculo?.placa ?? '').toLowerCase().includes(q) ||
        (r.regiao ?? '').toLowerCase().includes(q),
      )
    }
    if (ordenar === 'peso-desc')      result = [...result].sort((a, b) => b.pesoTotal - a.pesoTotal)
    else if (ordenar === 'nfs-desc')  result = [...result].sort((a, b) => b.qtdNotas - a.qtdNotas)
    else if (ordenar === 'ocup-desc') result = [...result].sort((a, b) => (b.ocupacaoPercent ?? 0) - (a.ocupacaoPercent ?? 0))
    else if (ordenar === 'mot-az')    result = [...result].sort((a, b) => (a.motorista?.nome ?? '').localeCompare(b.motorista?.nome ?? ''))
    return result
  }, [routes, filter, busca, ordenar])

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

  function updateRouteStatus(id: string, status: RouteStatus, linkMaps?: string) {
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
        linkMaps:        rota.linkMaps ?? linkMaps,
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

  async function handleConfirm(form: GerarRotasFormState, motoristasPayload: MotoristaPayload[], veiculosDisponiveis: VeiculoDisponivel[]) {
    setShowDialog(false)
    setGenerating(true)

    try {
      const hoje = new Date().toISOString().slice(0, 10)
      const raw = await webhookGerarRotas({
        dataInicio:          form.dataInicio || hoje,
        dataFim:             form.dataFim    || hoje,
        observacoes:         form.observacoes,
        motoristas:          motoristasPayload,
        veiculosDisponiveis,
        veiculosBloqueados:  [],
        restricoesExtras:    form.restricoesExtras,
        prioridade:          form.prioridade as Prioridade,
        instrucaoGlobal:     config.instrucaoGlobal,
        instrucoesPorRota:   config.instrucoesPorRota.map(i => ({ codigoRota: i.codigoRota, instrucao: i.instrucao })),
        pesos:               config.pesos,
        grades:              config.grades.map(g => ({ nome: g.nome, seg: g.seg, ter: g.ter, qua: g.qua, qui: g.qui, sex: g.sex, sab: g.sab })),
        horarios:            config.operacao,
        notasFiscais:        nfRows.length > 0 ? nfRows : undefined,
      }) as RetornoGerarRotas

      const novas = mapRetornoGerarRotas(raw)
      const dataRota = form.dataInicio || new Date().toISOString().slice(0, 10)

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
          <ExportMenuRotas rotas={filtered} />
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

      {/* Filtros: pills de status + busca + ordenação */}
      <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap border-b border-[0.5px] border-[var(--border-faint)]">
        <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
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
        <div className="flex items-center gap-2 shrink-0">
          <TextInput
            value={busca}
            onChange={setBusca}
            placeholder="Rota, motorista, placa…"
            style={{ width: 200 }}
          />
          <Select value={ordenar} onChange={setOrdenar} className="w-[170px]">
            <option value="">Ordenar por…</option>
            <option value="peso-desc">Peso (maior primeiro)</option>
            <option value="nfs-desc">Qtd NFs (maior primeiro)</option>
            <option value="ocup-desc">Ocupação (maior primeiro)</option>
            <option value="mot-az">Motorista (A–Z)</option>
          </Select>
          {(busca || ordenar) && (
            <button
              onClick={() => { setBusca(''); setOrdenar('') }}
              className="text-[11px] text-muted hover:text-base transition-colors cursor-pointer bg-transparent border-none whitespace-nowrap"
            >
              Limpar
            </button>
          )}
        </div>
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
              enderecoOrigem={enderecoOrigem}
            />
          ))}
        </div>

        {/* Previsão de cargas */}
        {routes.length > 0 && (() => {
          const linhas = routes
            .filter(r => r.veiculo)
            .map(r => {
              const v   = r.veiculo!
              const cap = capacidades.find(c => c.tipo === v.tipo)
              const ocup = v.capacidadeKg > 0 ? Math.round((r.pesoTotal / v.capacidadeKg) * 100) : null
              const limite = cap?.ocupacao_max_percent ?? 100
              const alerta = ocup !== null && ocup > limite
              return { rota: r, v, ocup, limite, alerta }
            })
          const nAlertas = linhas.filter(l => l.alerta).length
          return (
            <Card>
              <CardHeader>
                <button
                  onClick={() => setShowPrevisao(p => !p)}
                  className="flex items-center gap-2 text-xs font-medium text-base cursor-pointer bg-transparent border-none w-full text-left"
                >
                  <svg className={cn('w-3 h-3 text-muted transition-transform', showPrevisao && 'rotate-90')} viewBox="0 0 10 10" fill="currentColor"><path d="M3 2l4 3-4 3V2z"/></svg>
                  Previsão de cargas
                  {nAlertas > 0 && (
                    <span className="ml-1 px-1.5 py-px rounded-full text-[10px] font-medium bg-danger-bg text-danger">
                      {nAlertas} acima do limite
                    </span>
                  )}
                </button>
              </CardHeader>
              {showPrevisao && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[0.5px] border-[var(--border-subtle)]">
                        {['Rota', 'Motorista', 'Placa', 'Tipo', 'Peso (kg)', 'Cap. (kg)', '% Ocupação'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-[11px] text-muted font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map(({ rota, v, ocup, limite, alerta }, i) => (
                        <tr key={rota.id} className={cn(
                          'border-b border-[0.5px] border-[var(--border-faint)]',
                          alerta ? 'bg-danger-bg/40' : i % 2 !== 0 ? 'bg-cream/40' : '',
                        )}>
                          <td className="px-4 py-2.5 text-xs font-mono font-medium text-base">{rota.codigoRota}</td>
                          <td className="px-4 py-2.5 text-xs text-muted">{rota.motorista?.nome ?? '—'}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-base">{v.placa}</td>
                          <td className="px-4 py-2.5 text-xs text-muted">{v.tipo}</td>
                          <td className="px-4 py-2.5 text-xs tabular-nums text-right text-muted">
                            {rota.pesoTotal.toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-2.5 text-xs tabular-nums text-right text-muted">
                            {v.capacidadeKg ? v.capacidadeKg.toLocaleString('pt-BR') : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            {ocup !== null ? (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap',
                                alerta ? 'bg-danger-bg text-danger' : ocup >= limite * 0.85 ? 'bg-warn-bg text-warn' : 'bg-success-bg text-success-dark',
                              )}>
                                {alerta && <span className="w-[5px] h-[5px] rounded-full shrink-0 bg-danger" />}
                                {ocup}%{alerta ? ` (lim. ${limite}%)` : ''}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        })()}

        {routes.length === 0 && !nfImportState.running && (
          <>
            <div className="flex gap-1.5">
              {(['pendentes', 'agendados', 'srota'] as const).map(tab => {
                const active = tabPendentes === tab
                const label  = tab === 'pendentes' ? 'Pendentes' : tab === 'agendados' ? 'Agendados de hoje' : 'S/Rota'
                const count  = tab === 'srota'
                  ? sRotaNfs.length
                  : tab === 'agendados'
                    ? nfRows.filter(r => r.DataAgendamento && String(r.DataAgendamento).slice(0, 10) <= new Date().toISOString().slice(0, 10)).length
                    : 0
                return (
                  <button
                    key={tab}
                    onClick={() => setTabPendentes(tab)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-colors duration-100',
                      active ? 'bg-primary text-white' : 'bg-cream text-mid hover:bg-cream-hover hover:text-base',
                    )}
                  >
                    {label}
                    {count > 0 && (
                      <span className={cn(
                        'text-[10px] min-w-[16px] text-center px-1 rounded-full font-medium',
                        active
                          ? 'bg-white/25 text-white'
                          : tab === 'agendados'
                            ? 'bg-danger-bg text-danger'
                            : 'bg-white dark:bg-[#2A2A28] text-muted',
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {tabPendentes === 'pendentes' && <NfsPendentesTable />}
            {tabPendentes === 'agendados' && <AgendadosHojeTable />}
            {tabPendentes === 'srota'     && <SRotaTable rows={sRotaNfs} />}
          </>
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

      {showDialog && <GerarRotasDialog onClose={() => setShowDialog(false)} onConfirm={handleConfirm} motoristas={motoristas} veiculos={veiculos} />}

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
