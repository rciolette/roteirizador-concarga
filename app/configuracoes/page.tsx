'use client'
import { useState } from 'react'
import { Topbar, Card, CardHeader, Btn, FieldRow, TextInput, TextArea, ImportBar } from '@/components/ui'
import { DEFAULT_CONFIG } from '@/lib/data'
import { AppConfig, GradeRule, InstrucaoRota } from '@/types'
import { useImport } from '@/lib/useImport'

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const
const DIAS_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const PRIORIDADES = [
  'Agendamentos (DATAGE preenchida)',
  'SAC e reentregas ativas',
  'Clientes COND Vermelho',
  'Clientes COND Laranja',
  'Varejo por data de chegada',
]

export default function ConfiguracoesPage() {
  const [cfg, setCfg] = useState<AppConfig>(DEFAULT_CONFIG)
  const [saved, setSaved] = useState(false)
  const imp = useImport()

  const setSql = (k: keyof AppConfig['sql'], v: string) =>
    setCfg(p => ({ ...p, sql: { ...p.sql, [k]: v } }))
  const setOp = (k: keyof AppConfig['operacao'], v: string) =>
    setCfg(p => ({ ...p, operacao: { ...p.operacao, [k]: v } }))
  const setPeso = (k: keyof AppConfig['pesos'], v: string) =>
    setCfg(p => ({ ...p, pesos: { ...p.pesos, [k]: Number(v) } }))

  function toggleGrade(id: string, dia: typeof DIAS[number]) {
    setCfg(p => ({
      ...p,
      grades: p.grades.map(g => g.id === id ? { ...g, [dia]: !g[dia] } : g),
    }))
  }

  function addInstrucaoRota() {
    setCfg(p => ({
      ...p,
      instrucoesPorRota: [...p.instrucoesPorRota, { id: Date.now().toString(), codigoRota: '', instrucao: '' }],
    }))
  }

  function removeInstrucaoRota(id: string) {
    setCfg(p => ({ ...p, instrucoesPorRota: p.instrucoesPorRota.filter(i => i.id !== id) }))
  }

  function updateInstrucaoRota(id: string, k: keyof InstrucaoRota, v: string) {
    setCfg(p => ({
      ...p,
      instrucoesPorRota: p.instrucoesPorRota.map(i => i.id === id ? { ...i, [k]: v } : i),
    }))
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputStyle: React.CSSProperties = {
    flex: 1, height: 30,
    border: '0.5px solid rgba(44,44,42,0.2)', borderRadius: 8,
    background: '#F8F8F6', padding: '0 10px', fontSize: 12,
    color: '#2C2C2A', fontFamily: 'var(--font-sans)', outline: 'none',
  }

  return (
    <>
      <Topbar title="Configurações" sub="Conexão, regras, frota e instruções da IA">
        <Btn variant="teal" onClick={imp.runImport} disabled={imp.running}>
          <svg style={{ width: 13, height: 13 }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
          </svg>
          {imp.running ? 'Importando...' : 'Testar e importar SIAT'}
        </Btn>
        <Btn variant="primary" onClick={handleSave}>
          {saved ? '✓ Salvo!' : 'Salvar configurações'}
        </Btn>
      </Topbar>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        <ImportBar running={imp.running} step={imp.step} progress={imp.progress} result={imp.result} onClose={imp.reset} />

        {/* SQL Credentials */}
        <Card>
          <CardHeader>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Conexão SQL — SIAT</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {imp.result && <span style={{ fontSize: 11, color: '#3B6D11' }}>conexão ok</span>}
              <Btn size="sm" onClick={imp.runImport} disabled={imp.running}>Testar conexão</Btn>
            </div>
          </CardHeader>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Host', key: 'host' as const, mono: true },
              { label: 'Porta', key: 'port' as const, mono: true },
              { label: 'Banco de dados', key: 'database' as const, mono: true },
              { label: 'Usuário', key: 'user' as const, mono: true },
              { label: 'Senha', key: 'password' as const, mono: true, type: 'password' },
            ].map(f => (
              <FieldRow key={f.key} label={f.label}>
                <input
                  type={f.type || 'text'}
                  value={cfg.sql[f.key]}
                  onChange={e => setSql(f.key, e.target.value)}
                  style={{ ...inputStyle, fontFamily: f.mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: f.mono ? 11 : 12 }}
                />
              </FieldRow>
            ))}
          </div>
        </Card>

        {/* SQL Script */}
        <Card>
          <CardHeader>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Script SQL — query de importação</span>
            <Btn size="sm" onClick={imp.runImport} disabled={imp.running}>Executar agora</Btn>
          </CardHeader>
          <div style={{ padding: '12px 14px' }}>
            <textarea
              value={cfg.sql.script}
              onChange={e => setSql('script', e.target.value)}
              rows={10}
              style={{
                width: '100%',
                border: '0.5px solid rgba(44,44,42,0.2)', borderRadius: 8,
                background: '#F8F8F6', padding: '8px 10px',
                fontSize: 10, color: '#2C2C2A', lineHeight: 1.6,
                fontFamily: 'var(--font-mono)', resize: 'vertical', outline: 'none',
              }}
            />
          </div>
        </Card>

        {/* Horários */}
        <Card>
          <CardHeader><span style={{ fontSize: 12, fontWeight: 500 }}>Horários de operação</span></CardHeader>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Início roteirização', key: 'inicioRoteirizacao' as const },
              { label: 'Envio ao motorista', key: 'envioMotorista' as const },
              { label: 'Saída dos veículos', key: 'saidaVeiculos' as const },
            ].map(f => (
              <FieldRow key={f.key} label={f.label}>
                <input type="time" value={cfg.operacao[f.key]} onChange={e => setOp(f.key, e.target.value)}
                  style={{ ...inputStyle, maxWidth: 110 }} />
              </FieldRow>
            ))}
          </div>
        </Card>

        {/* GRADE */}
        <Card>
          <CardHeader><span style={{ fontSize: 12, fontWeight: 500 }}>Regras de GRADE — dias de entrega</span></CardHeader>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#F8F8F6' }}>
                  <th style={{ textAlign: 'left', padding: '6px 14px', fontWeight: 500, color: '#888780', borderBottom: '0.5px solid rgba(44,44,42,0.08)', fontSize: 10 }}>Rota / Tipo</th>
                  {DIAS_LABELS.map(d => (
                    <th key={d} style={{ padding: '6px 10px', fontWeight: 500, color: '#888780', borderBottom: '0.5px solid rgba(44,44,42,0.08)', fontSize: 10, textAlign: 'center' }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cfg.grades.map((g, i) => (
                  <tr key={g.id} style={{ borderBottom: i < cfg.grades.length - 1 ? '0.5px solid rgba(44,44,42,0.06)' : 'none' }}>
                    <td style={{ padding: '7px 14px', fontSize: 12 }}>{g.nome}</td>
                    {DIAS.map(d => (
                      <td key={d} style={{ padding: '7px 10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={g[d]}
                          onChange={() => toggleGrade(g.id, d)}
                          style={{ width: 14, height: 14, accentColor: '#185FA5', cursor: 'pointer' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Prioridades */}
        <Card>
          <CardHeader>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Prioridades de roteirização</span>
            <span style={{ fontSize: 11, color: '#888780' }}>ordem de alocação</span>
          </CardHeader>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PRIORIDADES.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', background: '#F8F8F6',
                border: '0.5px solid rgba(44,44,42,0.1)', borderRadius: 8, fontSize: 12,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#185FA5', color: '#E6F1FB',
                  fontSize: 10, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{i + 1}</div>
                {p}
              </div>
            ))}
          </div>
        </Card>

        {/* Pesos */}
        <Card>
          <CardHeader><span style={{ fontSize: 12, fontWeight: 500 }}>Parâmetros de peso por tipo de veículo</span></CardHeader>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Fiorino', key: 'fiorino' as const },
              { label: 'VUC', key: 'vuc' as const },
              { label: '3/4', key: 'tresQuartos' as const },
              { label: 'Truck', key: 'truck' as const },
              { label: 'Carreta', key: 'carreta' as const },
            ].map(f => (
              <FieldRow key={f.key} label={f.label}>
                <input
                  type="number"
                  value={cfg.pesos[f.key]}
                  onChange={e => setPeso(f.key, e.target.value)}
                  style={{ ...inputStyle, maxWidth: 100 }}
                />
                <span style={{ fontSize: 11, color: '#888780' }}>kg máx.</span>
              </FieldRow>
            ))}
          </div>
        </Card>

        {/* Instrução global IA */}
        <Card>
          <CardHeader>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Instruções globais para o agente de IA</span>
          </CardHeader>
          <div style={{ padding: '12px 14px' }}>
            <p style={{ fontSize: 11, color: '#888780', marginBottom: 8 }}>
              Este texto é inserido fixo no system prompt toda vez que o agente gera rotas.
            </p>
            <textarea
              value={cfg.instrucaoGlobal}
              onChange={e => setCfg(p => ({ ...p, instrucaoGlobal: e.target.value }))}
              rows={5}
              style={{
                width: '100%',
                border: '0.5px solid rgba(44,44,42,0.2)', borderRadius: 8,
                background: '#F8F8F6', padding: '8px 10px',
                fontSize: 12, color: '#2C2C2A', lineHeight: 1.6,
                fontFamily: 'var(--font-sans)', resize: 'vertical', outline: 'none',
              }}
            />
          </div>
        </Card>

        {/* Instruções por rota */}
        <Card>
          <CardHeader>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Instruções por rota específica</span>
            <Btn size="sm" onClick={addInstrucaoRota}>+ Adicionar rota</Btn>
          </CardHeader>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cfg.instrucoesPorRota.map(ir => (
              <div key={ir.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={ir.codigoRota}
                  onChange={e => updateInstrucaoRota(ir.id, 'codigoRota', e.target.value)}
                  placeholder="Código da rota"
                  style={{ ...inputStyle, maxWidth: 150, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                />
                <input
                  value={ir.instrucao}
                  onChange={e => updateInstrucaoRota(ir.id, 'instrucao', e.target.value)}
                  placeholder="Instrução específica para esta rota..."
                  style={{ ...inputStyle }}
                />
                <button
                  onClick={() => removeInstrucaoRota(ir.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#888780', fontSize: 16, padding: '0 4px', lineHeight: 1, flexShrink: 0,
                  }}
                >×</button>
              </div>
            ))}
            {cfg.instrucoesPorRota.length === 0 && (
              <p style={{ fontSize: 11, color: '#888780' }}>Nenhuma instrução por rota configurada.</p>
            )}
          </div>
        </Card>

      </div>
    </>
  )
}
