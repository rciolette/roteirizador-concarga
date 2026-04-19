'use client'
import { useState } from 'react'
import { Topbar, Card, CardHeader, Btn, StatusPill, ConfirmDialog, ConfirmAction } from '@/components/ui'
import { MOCK_ROTAS, ROTAS_GERADAS_IA, formatPeso } from '@/lib/data'
import { Rota, RouteStatus } from '@/types'

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
const TIPO_COLORS: Record<LogEntry['tipo'], { bg: string; color: string }> = {
  aprovacao: { bg: '#EAF3DE', color: '#27500A' },
  rejeicao:  { bg: '#FCEBEB', color: '#791F1F' },
  envio:     { bg: '#E6F1FB', color: '#0C447C' },
  geracao:   { bg: '#EEEDFE', color: '#3C3489' },
}

function buildDetails(rota: Rota): { label: string; value: string }[] {
  return [
    { label: 'Código da rota',  value: rota.codigoRota },
    { label: 'Região',          value: rota.regiao },
    { label: 'Motorista',       value: rota.motorista?.nome ?? '—' },
    { label: 'Veículo',         value: `${rota.veiculo?.tipo ?? '—'} · ${rota.veiculo?.placa ?? '—'}` },
    { label: 'Peso total',      value: formatPeso(rota.pesoTotal) },
    { label: 'Qtd. NFs',        value: `${rota.qtdNotas} notas fiscais` },
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8F8F6' }}>
      <Topbar title="Revisão de ações" sub="Confirme cada operação antes de executar" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Resumo do modo mock */}
        <Card style={{ border: '0.5px solid #FAC775' }}>
          <div style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: '#FAEEDA',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#854F0B" strokeWidth="1.6">
                <circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 10.5v.5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#633806', marginBottom: 4 }}>
                Modo simulação ativo
              </div>
              <div style={{ fontSize: 11, color: '#854F0B', lineHeight: 1.6 }}>
                Todas as ações desta página são simuladas. Nenhuma função envia dados ao SIAT, banco de dados ou motoristas.<br />
                <strong>Verificado:</strong> não há <code>fetch()</code>, conexão SQL ou chamada de API em nenhum arquivo do projeto.
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                {[
                  { label: 'SIAT', ok: true, desc: 'sem conexão real' },
                  { label: 'Supabase', ok: true, desc: 'sem cliente ativo' },
                  { label: 'WhatsApp/SMS', ok: true, desc: 'sem envio real' },
                  { label: 'IA externa', ok: true, desc: 'sem chamada real' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#639922', margin: '0 auto 3px',
                    }} />
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#2C2C2A' }}>{item.label}</div>
                    <div style={{ fontSize: 9, color: '#888780' }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Aguardando aprovação */}
        <Card>
          <CardHeader>
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              Aguardando aprovação
              {aguardando.length > 0 && (
                <span style={{
                  marginLeft: 8, fontSize: 10, fontWeight: 600,
                  background: '#FAEEDA', color: '#633806',
                  padding: '1px 7px', borderRadius: 20,
                }}>{aguardando.length}</span>
              )}
            </span>
            <span style={{ fontSize: 11, color: '#888780' }}>revise os detalhes antes de aprovar</span>
          </CardHeader>
          {aguardando.length === 0 ? (
            <div style={{ padding: '24px', fontSize: 12, color: '#B4B2A9', textAlign: 'center' }}>
              Nenhuma rota aguardando aprovação.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {aguardando.map((rota, i) => (
                <div key={rota.id} style={{
                  padding: '12px 18px',
                  borderBottom: i < aguardando.length - 1 ? '0.5px solid rgba(44,44,42,0.07)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{rota.codigoRota}</span>
                      <StatusPill status={rota.status} />
                    </div>
                    <div style={{ fontSize: 11, color: '#888780' }}>
                      {rota.motorista?.nome} · {rota.veiculo?.tipo} {rota.veiculo?.placa} · {formatPeso(rota.pesoTotal)} · {rota.qtdNotas} NFs
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
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
            <span style={{ fontSize: 12, fontWeight: 600 }}>
              Aprovadas — prontas para envio
              {aprovadas.length > 0 && (
                <span style={{
                  marginLeft: 8, fontSize: 10, fontWeight: 600,
                  background: '#E6F1FB', color: '#0C447C',
                  padding: '1px 7px', borderRadius: 20,
                }}>{aprovadas.length}</span>
              )}
            </span>
            <span style={{ fontSize: 11, color: '#888780' }}>confirme antes de disparar ao motorista</span>
          </CardHeader>
          {aprovadas.length === 0 ? (
            <div style={{ padding: '24px', fontSize: 12, color: '#B4B2A9', textAlign: 'center' }}>
              Nenhuma rota aprovada aguardando envio.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {aprovadas.map((rota, i) => (
                <div key={rota.id} style={{
                  padding: '12px 18px',
                  borderBottom: i < aprovadas.length - 1 ? '0.5px solid rgba(44,44,42,0.07)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{rota.codigoRota}</span>
                      <StatusPill status={rota.status} />
                    </div>
                    <div style={{ fontSize: 11, color: '#888780' }}>
                      {rota.motorista?.nome} · {rota.motorista?.telefone} · {formatPeso(rota.pesoTotal)} · {rota.qtdNotas} NFs
                    </div>
                  </div>
                  <Btn size="sm" variant="primary" onClick={() => enviar(rota)}>
                    <svg style={{ width: 11, height: 11 }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
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
              <span style={{ fontSize: 12, fontWeight: 600 }}>Enviadas hoje</span>
              <span style={{ fontSize: 11, color: '#888780' }}>{enviadas.length} rotas</span>
            </CardHeader>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {enviadas.map((rota, i) => (
                <div key={rota.id} style={{
                  padding: '10px 18px',
                  borderBottom: i < enviadas.length - 1 ? '0.5px solid rgba(44,44,42,0.07)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{rota.codigoRota}</span>
                      <StatusPill status="enviada" />
                    </div>
                    <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>
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

        {/* Log de ações executadas */}
        {log.length > 0 && (
          <Card>
            <CardHeader>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Log desta sessão</span>
              <Btn size="sm" onClick={() => setLog([])}>Limpar</Btn>
            </CardHeader>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {log.map((entry, i) => {
                const c = TIPO_COLORS[entry.tipo]
                return (
                  <div key={entry.id} style={{
                    padding: '9px 18px',
                    borderBottom: i < log.length - 1 ? '0.5px solid rgba(44,44,42,0.06)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px',
                      borderRadius: 20, background: c.bg, color: c.color,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>{TIPO_LABELS[entry.tipo]}</span>
                    <span style={{ fontSize: 11, flex: 1, color: '#5F5E5A' }}>{entry.descricao}</span>
                    <span style={{ fontSize: 10, color: '#B4B2A9', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{entry.ts}</span>
                  </div>
                )
              })}
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
