'use client'
import { useState } from 'react'
import { Topbar, Card, CardHeader, Btn, StatusPill, ConfirmDialog, ConfirmAction } from '@/components/ui'
import { MOCK_ROTAS, ROTAS_GERADAS_IA, formatPeso } from '@/lib/data'
import { Rota } from '@/types'

function cn(...cls: (string | false | undefined | null)[]) {
  return cls.filter(Boolean).join(' ')
}

type LogEntry = {
  id: string
  ts: string
  tipo: 'aprovacao' | 'rejeicao' | 'envio' | 'geracao'
  rota: string
  descricao: string
  executada: boolean
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

function buildDetails(rota: Rota): { label: string; value: string }[] {
  return [
    { label: 'Código da rota',   value: rota.codigoRota },
    { label: 'Região',           value: rota.regiao },
    { label: 'Motorista',        value: rota.motorista?.nome ?? '—' },
    { label: 'Veículo',          value: `${rota.veiculo?.tipo ?? '—'} · ${rota.veiculo?.placa ?? '—'}` },
    { label: 'Peso total',       value: formatPeso(rota.pesoTotal) },
    { label: 'Qtd. NFs',         value: `${rota.qtdNotas} notas fiscais` },
    { label: 'NFs concatenadas', value: rota.nfsConcatenadas ?? '—' },
  ]
}

export default function AcoesPage() {
  const allRotas = [...MOCK_ROTAS, ...ROTAS_GERADAS_IA]
  const [rotas, setRotas] = useState<Rota[]>(allRotas)
  const [log, setLog] = useState<LogEntry[]>([])
  const [confirm, setConfirm] = useState<{ action: ConfirmAction; execute: () => void } | null>(null)

  function addLog(entry: Omit<LogEntry, 'id' | 'ts'>) {
    setLog(prev => [{
      ...entry,
      id: Date.now().toString(),
      ts: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }, ...prev])
  }

  function ask(action: ConfirmAction, execute: () => void) {
    setConfirm({ action, execute })
  }

  function aprovar(rota: Rota) {
    ask({
      title: `Aprovar rota ${rota.codigoRota}`,
      description: 'A rota será marcada como aprovada e ficará pronta para envio ao motorista.',
      details: buildDetails(rota),
      confirmLabel: 'Aprovar rota',
      confirmVariant: 'success',
    }, () => {
      setRotas(prev => prev.map(r => r.id === rota.id ? { ...r, status: 'aprovada' } : r))
      addLog({ tipo: 'aprovacao', rota: rota.codigoRota, descricao: `Rota aprovada · ${rota.motorista?.nome} · ${formatPeso(rota.pesoTotal)}`, executada: true })
    })
  }

  function rejeitar(rota: Rota) {
    ask({
      title: `Rejeitar rota ${rota.codigoRota}`,
      description: 'A rota voltará para rascunho e precisará ser revisada antes de nova submissão.',
      details: buildDetails(rota),
      confirmLabel: 'Rejeitar',
      confirmVariant: 'danger-soft',
    }, () => {
      setRotas(prev => prev.map(r => r.id === rota.id ? { ...r, status: 'rascunho' } : r))
      addLog({ tipo: 'rejeicao', rota: rota.codigoRota, descricao: `Rota rejeitada · devolvida para rascunho`, executada: true })
    })
  }

  function enviar(rota: Rota) {
    ask({
      title: `Enviar rota ao motorista`,
      description: `Uma mensagem será disparada para ${rota.motorista?.nome} (${rota.motorista?.telefone}) com a sequência de entregas.`,
      details: [
        ...buildDetails(rota),
        { label: 'Telefone', value: rota.motorista?.telefone ?? '—' },
      ],
      confirmLabel: 'Confirmar envio',
      confirmVariant: 'primary',
      warning: 'Modo simulação — nenhuma mensagem real será enviada ao motorista.',
    }, () => {
      setRotas(prev => prev.map(r => r.id === rota.id
        ? { ...r, status: 'enviada', enviadoEm: new Date().toISOString(), notasFiscais: [] }
        : r
      ))
      addLog({ tipo: 'envio', rota: rota.codigoRota, descricao: `Enviado para ${rota.motorista?.nome} · ${rota.motorista?.telefone}`, executada: true })
    })
  }

  const aguardando = rotas.filter(r => r.status === 'aguardando')
  const aprovadas  = rotas.filter(r => r.status === 'aprovada')
  const enviadas   = rotas.filter(r => r.status === 'enviada')

  return (
    <div className="flex flex-col h-screen bg-page">
      <Topbar title="Revisão de ações" sub="Confirme cada operação antes de executar" />

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">

        {/* Mock status banner */}
        <Card className="border-warn-border">
          <div className="px-4 py-3.5 flex gap-3.5 items-start">
            <div className="w-9 h-9 rounded-lg bg-warn-bg flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#854F0B" strokeWidth="1.6">
                <circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 10.5v.5"/>
              </svg>
            </div>
            <div>
              <div className="text-xs font-medium text-warn mb-1">Modo simulação ativo</div>
              <div className="text-[11px] text-warn-mid leading-relaxed">
                Todas as ações desta página são simuladas. Nenhuma função envia dados ao SIAT, banco de dados ou motoristas.<br />
                <strong>Verificado:</strong> não há <code>fetch()</code>, conexão SQL ou chamada de API em nenhum arquivo do projeto.
              </div>
              <div className="flex gap-4 mt-2.5">
                {[
                  { label: 'SIAT',         desc: 'sem conexão real' },
                  { label: 'Supabase',     desc: 'sem cliente ativo' },
                  { label: 'WhatsApp/SMS', desc: 'sem envio real' },
                  { label: 'IA externa',   desc: 'sem chamada real' },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <div className="w-[7px] h-[7px] rounded-full bg-cond-ok mx-auto mb-1" />
                    <div className="text-[10px] font-medium text-base">{item.label}</div>
                    <div className="text-[9px] text-muted">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Aguardando aprovação */}
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
            <span className="text-[11px] text-muted">revise os detalhes antes de aprovar</span>
          </CardHeader>
          {aguardando.length === 0 ? (
            <div className="px-4 py-6 text-xs text-subtle text-center">
              Nenhuma rota aguardando aprovação.
            </div>
          ) : (
            <div className="flex flex-col">
              {aguardando.map((rota, i) => (
                <div
                  key={rota.id}
                  className={cn(
                    'flex items-center gap-3.5 px-4 py-3',
                    i < aguardando.length - 1 && 'border-b border-[0.5px] border-[rgba(44,44,42,0.07)]',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium font-mono">{rota.codigoRota}</span>
                      <StatusPill status={rota.status} />
                    </div>
                    <div className="text-[11px] text-muted">
                      {rota.motorista?.nome} · {rota.veiculo?.tipo} {rota.veiculo?.placa} · {formatPeso(rota.pesoTotal)} · {rota.qtdNotas} NFs
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Btn size="sm" variant="danger-soft" onClick={() => rejeitar(rota)}>Rejeitar</Btn>
                    <Btn size="sm" variant="success" onClick={() => aprovar(rota)}>Aprovar</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Aprovadas — prontas para envio */}
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
            <div className="px-4 py-6 text-xs text-subtle text-center">
              Nenhuma rota aprovada aguardando envio.
            </div>
          ) : (
            <div className="flex flex-col">
              {aprovadas.map((rota, i) => (
                <div
                  key={rota.id}
                  className={cn(
                    'flex items-center gap-3.5 px-4 py-3',
                    i < aprovadas.length - 1 && 'border-b border-[0.5px] border-[rgba(44,44,42,0.07)]',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium font-mono">{rota.codigoRota}</span>
                      <StatusPill status={rota.status} />
                    </div>
                    <div className="text-[11px] text-muted">
                      {rota.motorista?.nome} · {rota.motorista?.telefone} · {formatPeso(rota.pesoTotal)} · {rota.qtdNotas} NFs
                    </div>
                  </div>
                  <Btn size="sm" variant="primary" onClick={() => enviar(rota)}>
                    <svg className="w-[11px] h-[11px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 8l12-6-6 12V8H2z"/>
                    </svg>
                    Enviar ao motorista
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Enviadas hoje */}
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
                    'flex items-center gap-3.5 px-4 py-2.5',
                    i < enviadas.length - 1 && 'border-b border-[0.5px] border-[rgba(44,44,42,0.07)]',
                  )}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium font-mono">{rota.codigoRota}</span>
                      <StatusPill status="enviada" />
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">
                      {rota.motorista?.nome} · {rota.enviadoEm
                        ? new Date(rota.enviadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Log de ações */}
        {log.length > 0 && (
          <Card>
            <CardHeader>
              <span className="text-xs font-medium">Log desta sessão</span>
              <Btn size="sm" onClick={() => setLog([])}>Limpar</Btn>
            </CardHeader>
            <div className="flex flex-col">
              {log.map((entry, i) => (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-2.5',
                    i < log.length - 1 && 'border-b border-[0.5px] border-[rgba(44,44,42,0.06)]',
                  )}
                >
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

      {confirm && (
        <ConfirmDialog
          action={confirm.action}
          onConfirm={confirm.execute}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
