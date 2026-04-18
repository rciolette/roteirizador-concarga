'use client'
import { useState } from 'react'
import { Topbar, Card, Btn, StatusPill, CondDot, WeightBar, ImportBar } from '@/components/ui'
import { MOCK_ROTAS, ROTAS_GERADAS_IA } from '@/lib/data'
import { Rota, RouteStatus } from '@/types'
import { useImport } from '@/lib/useImport'

const STATUS_FILTERS: { label: string; value: RouteStatus | 'todos' }[] = [
  { label: 'Todas', value: 'todos' },
  { label: 'Aguardando', value: 'aguardando' },
  { label: 'Aprovadas', value: 'aprovada' },
  { label: 'Enviadas', value: 'enviada' },
  { label: 'Rascunho', value: 'rascunho' },
]

function GerarRotasDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [form, setForm] = useState({
    observacoes: '', motoristasAusentes: '', veiculosBloqueados: '',
    restricoesExtras: '', prioridade: 'padrao',
  })
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, borderRadius: 8,
    }}>
      <div className="animate-fade-in" style={{
        background: '#fff', borderRadius: 12,
        border: '0.5px solid rgba(44,44,42,0.15)',
        padding: 24, width: 440, maxWidth: '90vw',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Instrução para o agente de IA</div>
        <div style={{ fontSize: 11, color: '#888780', marginBottom: 16 }}>
          Estas informações serão combinadas com as regras fixas e os dados do SIAT.
        </div>

        {[
          { key: 'observacoes', label: 'Observações do dia', placeholder: 'Ex: Priorizar região Norte, evitar Contagem até 10h...' },
          { key: 'motoristasAusentes', label: 'Motoristas ausentes hoje', placeholder: 'Ex: Douglas B, Rosana' },
          { key: 'veiculosBloqueados', label: 'Veículos bloqueados / em manutenção', placeholder: 'Ex: ABC-1234, XYZ-5678' },
          { key: 'restricoesExtras', label: 'Restrições extras', placeholder: 'Ex: Atacadão só recebe até 11h hoje.' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#888780', marginBottom: 4 }}>{f.label}</label>
            <textarea
              value={(form as any)[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={2}
              style={{
                width: '100%', border: '0.5px solid rgba(44,44,42,0.2)',
                borderRadius: 8, background: '#F8F8F6',
                padding: '7px 10px', fontSize: 12, color: '#2C2C2A',
                fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none',
              }}
            />
          </div>
        ))}

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, color: '#888780', marginBottom: 4 }}>Prioridade especial</label>
          <select
            value={form.prioridade}
            onChange={e => set('prioridade', e.target.value)}
            style={{
              width: '100%', height: 32,
              border: '0.5px solid rgba(44,44,42,0.2)', borderRadius: 8,
              background: '#F8F8F6', padding: '0 10px', fontSize: 12,
              color: '#2C2C2A', fontFamily: 'var(--font-sans)', outline: 'none',
            }}
          >
            <option value="padrao">Padrão (agendados → SAC → varejo → data)</option>
            <option value="vermelho">Forçar prioridade Vermelho primeiro</option>
            <option value="menos-veiculos">Priorizar menor número de veículos</option>
            <option value="menor-distancia">Priorizar menor distância total</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" onClick={onConfirm}>
            <svg style={{ width: 13, height: 13 }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" /><path d="M8 5v3l2 2" />
            </svg>
            Acionar IA e gerar rotas
          </Btn>
        </div>
      </div>
    </div>
  )
}

function RouteCard({ rota, onUpdateStatus }: { rota: Rota; onUpdateStatus: (id: string, status: RouteStatus) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const capacidade = rota.veiculo?.capacidadeKg || 1500

  function copyNFs() {
    if (rota.nfsConcatenadas) {
      navigator.clipboard.writeText(rota.nfsConcatenadas).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function openMaps() {
    if (rota.linkMaps) {
      window.open(rota.linkMaps, '_blank')
    }
  }

  const initials = rota.motorista?.sigla || '??'
  const bgColors = ['#E6F1FB', '#EAF3DE', '#EEEDFE', '#E1F5EE', '#FAEEDA']
  const txtColors = ['#0C447C', '#27500A', '#3C3489', '#085041', '#633806']
  const idx = rota.id.charCodeAt(1) % 5

  return (
    <div style={{
      background: '#fff',
      border: rota.status === 'aguardando' ? '1.5px solid #185FA5' : '0.5px solid rgba(44,44,42,0.12)',
      borderRadius: 8, overflow: 'hidden',
      transition: 'border 0.15s',
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: bgColors[idx], color: txtColors[idx],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 500,
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {rota.codigoRota}
          </div>
          <div style={{ fontSize: 10, color: '#888780', marginTop: 1 }}>
            {rota.motorista?.nome} · {rota.veiculo?.placa} · {rota.veiculo?.tipo}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
          <WeightBar peso={rota.pesoTotal} capacidade={capacidade} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{rota.qtdNotas}</div>
            <div style={{ fontSize: 10, color: '#888780' }}>NFs</div>
          </div>
          <StatusPill status={rota.status} />
          <svg
            style={{ width: 14, height: 14, color: '#888780', transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'none' }}
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="animate-fade-in" style={{ borderTop: '0.5px solid rgba(44,44,42,0.08)', background: '#F8F8F6', padding: '12px 14px' }}>
          {rota.notasFiscais.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {['Nº NFS', 'Cond', 'Destinatário', 'Município', 'Peso', 'Tipo'].map((h, i) => (
                    <th key={h} style={{
                      textAlign: 'left', color: '#888780', fontWeight: 500,
                      padding: '3px 6px', borderBottom: '0.5px solid rgba(44,44,42,0.1)',
                      fontSize: 10, width: i === 0 ? 68 : i === 1 ? 60 : i === 3 ? 90 : i === 4 ? 55 : i === 5 ? 58 : 'auto',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rota.notasFiscais.map(nf => (
                  <tr key={nf.id}>
                    <td style={{ padding: '4px 6px', borderBottom: '0.5px solid rgba(44,44,42,0.06)', fontFamily: 'var(--font-mono)' }}>{nf.numnfs}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '0.5px solid rgba(44,44,42,0.06)' }}>
                      <CondDot cond={nf.cond} label />
                    </td>
                    <td style={{ padding: '4px 6px', borderBottom: '0.5px solid rgba(44,44,42,0.06)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nf.destinatario}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '0.5px solid rgba(44,44,42,0.06)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nf.municipio}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '0.5px solid rgba(44,44,42,0.06)' }}>{nf.peso}kg</td>
                    <td style={{ padding: '4px 6px', borderBottom: '0.5px solid rgba(44,44,42,0.06)' }}>
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 500,
                        background: nf.tipoCliente === 'CD' ? '#E6F1FB' : nf.tipoCliente === 'Rede' ? '#EEEDFE' : nf.tipoCliente === 'Reentrega' ? '#FAEEDA' : '#F1EFE8',
                        color: nf.tipoCliente === 'CD' ? '#0C447C' : nf.tipoCliente === 'Rede' ? '#3C3489' : nf.tipoCliente === 'Reentrega' ? '#633806' : '#444441',
                      }}>{nf.tipoCliente}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 11, color: '#888780', padding: '4px 0' }}>
              {rota.status === 'enviada'
                ? `Rota enviada ao motorista às ${rota.enviadoEm ? new Date(rota.enviadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}. Confirmação recebida.`
                : 'Nenhuma NF carregada nesta rota.'}
            </p>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '0.5px solid rgba(44,44,42,0.08)', flexWrap: 'wrap' }}>
            <Btn size="sm" onClick={openMaps} disabled={!rota.linkMaps}>
              <svg style={{ width: 11, height: 11 }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2C5.8 2 4 3.8 4 6c0 3.3 4 8 4 8s4-4.7 4-8c0-2.2-1.8-4-4-4z"/><circle cx="8" cy="6" r="1.5"/>
              </svg>
              Ver mapa
            </Btn>
            {rota.status !== 'enviada' && <Btn size="sm">Editar NFs</Btn>}
            {rota.nfsConcatenadas && (
              <Btn size="sm" onClick={copyNFs}>
                {copied ? '✓ Copiado!' : 'Copiar NFs (;)'}
              </Btn>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {rota.status === 'aguardando' && (
                <>
                  <Btn size="sm" variant="danger-soft" onClick={() => onUpdateStatus(rota.id, 'rascunho')}>Rejeitar</Btn>
                  <Btn size="sm" variant="success" onClick={() => onUpdateStatus(rota.id, 'aprovada')}>Aprovar rota</Btn>
                </>
              )}
              {rota.status === 'aprovada' && (
                <Btn size="sm" variant="primary" onClick={() => onUpdateStatus(rota.id, 'enviada')}>
                  <svg style={{ width: 11, height: 11 }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 8l12-6-6 12V8H2z"/>
                  </svg>
                  Enviar ao motorista agora
                </Btn>
              )}
              {rota.status === 'rascunho' && (
                <Btn size="sm" variant="warn-soft" onClick={() => onUpdateStatus(rota.id, 'aguardando')}>Submeter para aprovação</Btn>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RotasPage() {
  const [routes, setRoutes] = useState<Rota[]>(MOCK_ROTAS)
  const [filter, setFilter] = useState<RouteStatus | 'todos'>('todos')
  const [showDialog, setShowDialog] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState('')
  const imp = useImport()

  const filtered = filter === 'todos' ? routes : routes.filter(r => r.status === filter)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function updateRouteStatus(id: string, status: RouteStatus) {
    const rota = routes.find(r => r.id === id)
    setRoutes(prev => prev.map(r =>
      r.id === id ? {
        ...r, status,
        ...(status === 'enviada' ? { enviadoEm: new Date().toISOString(), notasFiscais: [] } : {}),
      } : r
    ))
    if (rota) {
      const msgs: Partial<Record<RouteStatus, string>> = {
        aprovada: `✓ Rota ${rota.codigoRota} aprovada`,
        rascunho: `Rota ${rota.codigoRota} rejeitada — voltou para rascunho`,
        enviada: `✓ Rota ${rota.codigoRota} enviada ao motorista`,
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
      const now = new Date().toISOString()
      const novas = ROTAS_GERADAS_IA.map(r => ({ ...r, createdAt: now }))
      setRoutes(prev => {
        const existingIds = new Set(prev.map(r => r.id))
        return [...prev, ...novas.filter(r => !existingIds.has(r.id))]
      })
      showToast(`✓ IA gerou ${ROTAS_GERADAS_IA.length} novas rotas — aguardando aprovação`)
      setFilter('aguardando')
    }, 3500)
  }

  const pendentes = routes.filter(r => r.status === 'aguardando').length

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Topbar title="Rotas do dia" sub={`${routes.length} rotas · ${routes.reduce((a, r) => a + r.qtdNotas, 0)} NFs · ${new Date().toLocaleDateString('pt-BR')}`}>
        <Btn variant="teal" onClick={imp.runImport} disabled={imp.running}>
          <svg style={{ width: 13, height: 13 }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
          </svg>
          {imp.running ? 'Atualizando...' : 'Atualizar SIAT'}
        </Btn>

        <select
          value={filter}
          onChange={e => setFilter(e.target.value as any)}
          style={{
            height: 28, border: '0.5px solid rgba(44,44,42,0.2)', borderRadius: 8,
            background: '#fff', padding: '0 8px', fontSize: 12, color: '#2C2C2A',
            fontFamily: 'var(--font-sans)', outline: 'none',
          }}
        >
          {STATUS_FILTERS.map(f => (
            <option key={f.value} value={f.value}>
              {f.label}{f.value === 'aguardando' && pendentes > 0 ? ` (${pendentes})` : ''}
            </option>
          ))}
        </select>

        {generating ? (
          <Btn variant="primary" disabled>
            <svg style={{ width: 12, height: 12 }} className="animate-spin-slow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round" />
            </svg>
            Gerando rotas...
          </Btn>
        ) : (
          <Btn variant="primary" onClick={() => setShowDialog(true)}>+ Gerar rotas</Btn>
        )}
      </Topbar>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ImportBar running={imp.running} step={imp.step} progress={imp.progress} result={imp.result} onClose={imp.reset} />

        {toast && (
          <div className="animate-fade-in" style={{
            background: toast.startsWith('✓') ? '#EAF3DE' : '#FAEEDA',
            border: `0.5px solid ${toast.startsWith('✓') ? '#97C459' : '#FAC775'}`,
            borderRadius: 8, padding: '10px 16px', fontSize: 12, fontWeight: 500,
            color: toast.startsWith('✓') ? '#27500A' : '#633806',
          }}>
            {toast}
          </div>
        )}

        {generating && (
          <div className="animate-fade-in" style={{
            background: '#E6F1FB', border: '0.5px solid #B5D4F4', borderRadius: 8,
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <svg style={{ width: 16, height: 16, color: '#185FA5' }} className="animate-spin-slow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round" />
            </svg>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#0C447C' }}>Agente de IA processando as rotas...</div>
              <div style={{ fontSize: 11, color: '#185FA5', marginTop: 2 }}>Analisando {routes.reduce((a, r) => a + r.qtdNotas, 0)} NFs · aplicando regras GRADE/COND · alocando nos veículos</div>
            </div>
          </div>
        )}

        {filtered.map(rota => (
          <RouteCard key={rota.id} rota={rota} onUpdateStatus={updateRouteStatus} />
        ))}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#888780', fontSize: 13 }}>
            Nenhuma rota com este filtro.
          </div>
        )}
      </div>

      {showDialog && <GerarRotasDialog onClose={() => setShowDialog(false)} onConfirm={handleConfirm} />}
    </div>
  )
}
