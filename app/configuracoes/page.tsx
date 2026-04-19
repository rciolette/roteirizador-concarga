'use client'
import { useState } from 'react'
import { Topbar, Card, CardHeader, Btn, FieldRow, ImportBar } from '@/components/ui'
import { DEFAULT_CONFIG } from '@/lib/data'
import { AppConfig, InstrucaoRota } from '@/types'
import { useImport } from '@/lib/useImport'

function cn(...cls: (string | false | undefined | null)[]) {
  return cls.filter(Boolean).join(' ')
}

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const
const DIAS_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const PRIORIDADES = [
  'Agendamentos (DATAGE preenchida)',
  'SAC e reentregas ativas',
  'Clientes COND Vermelho',
  'Clientes COND Laranja',
  'Varejo por data de chegada',
]

const inputCls = 'flex-1 h-[30px] border border-[0.5px] border-[rgba(44,44,42,0.2)] rounded-lg bg-page px-2.5 text-xs text-base outline-none focus:border-primary focus:bg-white transition-colors'
const monoCls  = 'font-mono text-[11px]'

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

  return (
    <>
      <Topbar title="Configurações" sub="Conexão, regras, frota e instruções da IA">
        <Btn variant="teal" onClick={imp.runImport} disabled={imp.running}>
          <svg className="w-[13px] h-[13px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
          </svg>
          {imp.running ? 'Importando...' : 'Testar e importar SIAT'}
        </Btn>
        <Btn variant="primary" onClick={handleSave}>
          {saved ? '✓ Salvo!' : 'Salvar configurações'}
        </Btn>
      </Topbar>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        <ImportBar running={imp.running} step={imp.step} progress={imp.progress} result={imp.result} onClose={imp.reset} />

        {/* SQL Credentials */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Conexão SQL — SIAT</span>
            <div className="flex gap-2 items-center">
              {imp.result && <span className="text-[11px] text-success">conexão ok</span>}
              <Btn size="sm" onClick={imp.runImport} disabled={imp.running}>Testar conexão</Btn>
            </div>
          </CardHeader>
          <div className="px-3.5 py-3 flex flex-col gap-2.5">
            {[
              { label: 'Host',           key: 'host'     as const, mono: true },
              { label: 'Porta',          key: 'port'     as const, mono: true },
              { label: 'Banco de dados', key: 'database' as const, mono: true },
              { label: 'Usuário',        key: 'user'     as const, mono: true },
              { label: 'Senha',          key: 'password' as const, mono: true, type: 'password' },
            ].map(f => (
              <FieldRow key={f.key} label={f.label}>
                <input
                  type={f.type ?? 'text'}
                  value={cfg.sql[f.key]}
                  onChange={e => setSql(f.key, e.target.value)}
                  className={cn(inputCls, f.mono && monoCls)}
                />
              </FieldRow>
            ))}
          </div>
        </Card>

        {/* SQL Script */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Script SQL — query de importação</span>
            <Btn size="sm" onClick={imp.runImport} disabled={imp.running}>Executar agora</Btn>
          </CardHeader>
          <div className="px-3.5 py-3">
            <textarea
              value={cfg.sql.script}
              onChange={e => setSql('script', e.target.value)}
              rows={10}
              className="w-full border border-[0.5px] border-[rgba(44,44,42,0.2)] rounded-lg bg-page px-2.5 py-2 text-[10px] text-base leading-relaxed font-mono resize-y outline-none focus:border-primary focus:bg-white transition-colors"
            />
          </div>
        </Card>

        {/* Horários */}
        <Card>
          <CardHeader><span className="text-xs font-medium">Horários de operação</span></CardHeader>
          <div className="px-3.5 py-3 flex flex-col gap-2.5">
            {[
              { label: 'Início roteirização', key: 'inicioRoteirizacao' as const },
              { label: 'Envio ao motorista',  key: 'envioMotorista'    as const },
              { label: 'Saída dos veículos',  key: 'saidaVeiculos'     as const },
            ].map(f => (
              <FieldRow key={f.key} label={f.label}>
                <input
                  type="time"
                  value={cfg.operacao[f.key]}
                  onChange={e => setOp(f.key, e.target.value)}
                  className={cn(inputCls, 'max-w-[110px]')}
                />
              </FieldRow>
            ))}
          </div>
        </Card>

        {/* GRADE */}
        <Card>
          <CardHeader><span className="text-xs font-medium">Regras de GRADE — dias de entrega</span></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-page">
                  <th className="text-left px-3.5 py-1.5 text-[10px] text-muted font-medium border-b border-[0.5px] border-[rgba(44,44,42,0.08)]">
                    Rota / Tipo
                  </th>
                  {DIAS_LABELS.map(d => (
                    <th key={d} className="px-2.5 py-1.5 text-[10px] text-muted font-medium border-b border-[0.5px] border-[rgba(44,44,42,0.08)] text-center">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cfg.grades.map((g, i) => (
                  <tr key={g.id} className={i < cfg.grades.length - 1 ? 'border-b border-[0.5px] border-[rgba(44,44,42,0.06)]' : ''}>
                    <td className="px-3.5 py-[7px] text-xs">{g.nome}</td>
                    {DIAS.map(d => (
                      <td key={d} className="px-2.5 py-[7px] text-center">
                        <input
                          type="checkbox"
                          checked={g[d]}
                          onChange={() => toggleGrade(g.id, d)}
                          className="w-3.5 h-3.5 accent-primary cursor-pointer"
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
            <span className="text-xs font-medium">Prioridades de roteirização</span>
            <span className="text-[11px] text-muted">ordem de alocação</span>
          </CardHeader>
          <div className="px-3.5 py-3 flex flex-col gap-1.5">
            {PRIORIDADES.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-[7px] bg-page border border-[0.5px] border-[rgba(44,44,42,0.1)] rounded-lg text-xs">
                <div className="w-5 h-5 rounded-full bg-primary text-primary-bg text-[10px] font-medium flex items-center justify-center shrink-0">
                  {i + 1}
                </div>
                {p}
              </div>
            ))}
          </div>
        </Card>

        {/* Pesos */}
        <Card>
          <CardHeader><span className="text-xs font-medium">Parâmetros de peso por tipo de veículo</span></CardHeader>
          <div className="px-3.5 py-3 flex flex-col gap-2.5">
            {[
              { label: 'Fiorino', key: 'fiorino'     as const },
              { label: 'VUC',     key: 'vuc'         as const },
              { label: '3/4',     key: 'tresQuartos' as const },
              { label: 'Truck',   key: 'truck'       as const },
              { label: 'Carreta', key: 'carreta'     as const },
            ].map(f => (
              <FieldRow key={f.key} label={f.label}>
                <input
                  type="number"
                  value={cfg.pesos[f.key]}
                  onChange={e => setPeso(f.key, e.target.value)}
                  className={cn(inputCls, 'max-w-[100px]')}
                />
                <span className="text-[11px] text-muted">kg máx.</span>
              </FieldRow>
            ))}
          </div>
        </Card>

        {/* Instrução global IA */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Instruções globais para o agente de IA</span>
          </CardHeader>
          <div className="px-3.5 py-3">
            <p className="text-[11px] text-muted mb-2">
              Este texto é inserido fixo no system prompt toda vez que o agente gera rotas.
            </p>
            <textarea
              value={cfg.instrucaoGlobal}
              onChange={e => setCfg(p => ({ ...p, instrucaoGlobal: e.target.value }))}
              rows={5}
              className="w-full border border-[0.5px] border-[rgba(44,44,42,0.2)] rounded-lg bg-page px-2.5 py-2 text-xs text-base leading-relaxed resize-y outline-none focus:border-primary focus:bg-white transition-colors"
            />
          </div>
        </Card>

        {/* Instruções por rota */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Instruções por rota específica</span>
            <Btn size="sm" onClick={addInstrucaoRota}>+ Adicionar rota</Btn>
          </CardHeader>
          <div className="px-3.5 py-3 flex flex-col gap-2">
            {cfg.instrucoesPorRota.map(ir => (
              <div key={ir.id} className="flex gap-2 items-center">
                <input
                  value={ir.codigoRota}
                  onChange={e => updateInstrucaoRota(ir.id, 'codigoRota', e.target.value)}
                  placeholder="Código da rota"
                  className={cn(inputCls, monoCls, 'max-w-[150px]')}
                />
                <input
                  value={ir.instrucao}
                  onChange={e => updateInstrucaoRota(ir.id, 'instrucao', e.target.value)}
                  placeholder="Instrução específica para esta rota..."
                  className={inputCls}
                />
                <button
                  onClick={() => removeInstrucaoRota(ir.id)}
                  className="bg-transparent border-none cursor-pointer text-muted text-xl leading-none px-1 hover:text-base transition-colors shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
            {cfg.instrucoesPorRota.length === 0 && (
              <p className="text-[11px] text-muted">Nenhuma instrução por rota configurada.</p>
            )}
          </div>
        </Card>

      </div>
    </>
  )
}
