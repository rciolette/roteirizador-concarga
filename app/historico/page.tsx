'use client'
import { useState } from 'react'
import { Topbar, Card, StatusPill, Btn, CondDot } from '@/components/ui'
import { HISTORICO_DIAS, formatPeso } from '@/lib/data'
import { Rota } from '@/types'

function DetalheModal({ rota, onClose }: { rota: Rota; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copyNFs() {
    if (rota.nfsConcatenadas) {
      navigator.clipboard.writeText(rota.nfsConcatenadas).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="animate-fade-in" style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(44,44,42,0.15)', width: 600, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(44,44,42,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{rota.codigoRota}</div>
            <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>
              {rota.motorista?.nome} · {rota.veiculo?.tipo} {rota.veiculo?.placa} · {formatPeso(rota.pesoTotal)} · {rota.qtdNotas} NFs
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusPill status={rota.status} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888780', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {rota.enviadoEm && (
            <div style={{ fontSize: 11, color: '#3B6D11', background: '#EAF3DE', border: '0.5px solid #97C459', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
              Enviada ao motorista às {new Date(rota.enviadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {rota.nfsConcatenadas && (
            <div style={{ fontSize: 11, color: '#888780', marginBottom: 12, fontFamily: 'var(--font-mono)', background: '#F8F8F6', padding: '8px 12px', borderRadius: 8 }}>
              NFs: {rota.nfsConcatenadas}
            </div>
          )}

          {rota.notasFiscais.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#F8F8F6' }}>
                  {['Nº NFS', 'Cond', 'Destinatário', 'Município / Bairro', 'Peso', 'Tipo'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, color: '#888780', fontWeight: 500, borderBottom: '0.5px solid rgba(44,44,42,0.1)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rota.notasFiscais.map((nf, i) => (
                  <tr key={nf.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                    <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', borderBottom: '0.5px solid rgba(44,44,42,0.06)' }}>{nf.numnfs}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '0.5px solid rgba(44,44,42,0.06)' }}><CondDot cond={nf.cond} label /></td>
                    <td style={{ padding: '5px 8px', borderBottom: '0.5px solid rgba(44,44,42,0.06)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nf.destinatario}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '0.5px solid rgba(44,44,42,0.06)', color: '#888780' }}>{nf.municipio} / {nf.bairro}</td>
                    <td style={{ padding: '5px 8px', borderBottom: '0.5px solid rgba(44,44,42,0.06)', whiteSpace: 'nowrap' }}>{nf.peso}kg</td>
                    <td style={{ padding: '5px 8px', borderBottom: '0.5px solid rgba(44,44,42,0.06)' }}>
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
            <p style={{ fontSize: 12, color: '#888780', textAlign: 'center', padding: '24px 0' }}>
              Detalhes das NFs não disponíveis para este registro.
            </p>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(44,44,42,0.1)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {rota.nfsConcatenadas && (
            <Btn size="sm" onClick={copyNFs}>{copied ? '✓ Copiado!' : 'Copiar NFs (;)'}</Btn>
          )}
          {rota.linkMaps && (
            <Btn size="sm" onClick={() => window.open(rota.linkMaps, '_blank')}>
              <svg style={{ width: 11, height: 11 }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2C5.8 2 4 3.8 4 6c0 3.3 4 8 4 8s4-4.7 4-8c0-2.2-1.8-4-4-4z"/><circle cx="8" cy="6" r="1.5"/>
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
