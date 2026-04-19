'use client'
import { useState } from 'react'
import { Topbar, Card, CardHeader, Btn, ImportBar } from '@/components/ui'
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

const inputCls = [
  'w-full h-8 border border-[0.5px] border-[var(--border-input)] rounded-lg',
  'bg-page px-3 text-xs text-base outline-none',
  'focus:border-primary dark:focus:bg-cream transition-colors',
].join(' ')

const monoInputCls = inputCls + ' font-mono text-[11px]'

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] text-muted mb-1">{children}</label>
}

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

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        <ImportBar running={imp.running} step={imp.step} progress={imp.progress} result={imp.result} onClose={imp.reset} />

        {/* ── Conexão SQL ── */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Conexão SQL — SIAT</span>
            <div className="flex gap-2 items-center">
              {imp.result && <span className="text-[11px] text-success">conexão ok</span>}
              <Btn size="sm" onClick={imp.runImport} disabled={imp.running}>Testar conexão</Btn>
            </div>
          </CardHeader>
          <div className="px-4 py-3.5 flex flex-col gap-3">
            {/* Host + Porta */}
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div>
                <Label>Host</Label>
                <input type="text" value={cfg.sql.host} onChange={e => setSql('host', e.target.value)} className={monoInputCls} />
              </div>
              <div>
                <Label>Porta</Label>
                <input type="text" value={cfg.sql.port} onChange={e => setSql('port', e.target.value)} className={monoInputCls} />
              </div>
            </div>
            {/* Banco + Usuário */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Banco de dados</Label>
                <input type="text" value={cfg.sql.database} onChange={e => setSql('database', e.target.value)} className={monoInputCls} />
              </div>
              <div>
                <Label>Usuário</Label>
                <input type="text" value={cfg.sql.user} onChange={e => setSql('user', e.target.value)} className={monoInputCls} />
              </div>
            </div>
            {/* Senha */}
            <div className="max-w-xs">
              <Label>Senha</Label>
              <input type="password" value={cfg.sql.password} onChange={e => setSql('password', e.target.value)} className={monoInputCls} />
            </div>
          </div>
        </Card>

        {/* ── Script SQL ── */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Script SQL — query de importação</span>
            <Btn size="sm" onClick={imp.runImport} disabled={imp.running}>Executar agora</Btn>
          </CardHeader>
          <div className="px-4 py-3.5">
            <textarea
              value={cfg.sql.script}
              onChange={e => setSql('script', e.target.value)}
              rows={10}
              className="w-full border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-3 py-2 text-[10px] text-base leading-relaxed font-mono resize-y outline-none focus:border-primary dark:focus:bg-cream transition-colors min-h-[160px]"
            />
          </div>
        </Card>

        {/* ── Horários ── */}
        <Card>
          <CardHeader><span className="text-xs font-medium">Horários de operação</span></CardHeader>
          <div className="px-4 py-3.5">
            <div className="flex gap-6 flex-wrap">
              {[
                { label: 'Início roteirização', key: 'inicioRoteirizacao' as const },
                { label: 'Envio ao motorista',  key: 'envioMotorista'    as const },
                { label: 'Saída dos veículos',  key: 'saidaVeiculos'     as const },
              ].map(f => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <input
                    type="time"
                    value={cfg.operacao[f.key]}
                    onChange={e => setOp(f.key, e.target.value)}
                    className={cn(inputCls, 'w-[120px]')}
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── GRADE ── */}
        <Card>
          <CardHeader><span className="text-xs font-medium">Regras de GRADE — dias de entrega</span></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-page">
                  <th className="text-left px-4 py-2 text-[10px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)] uppercase tracking-wide">
                    Rota / Tipo
                  </th>
                  {DIAS_LABELS.map(d => (
                    <th key={d} className="px-3 py-2 text-[10px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)] text-center uppercase tracking-wide">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-faint)]">
                {cfg.grades.map((g, i) => (
                  <tr key={g.id} className={cn('transition-colors', i % 2 === 0 ? 'bg-white dark:bg-[#1E1E1C] hover:bg-page' : 'bg-page hover:bg-cream')}>
                    <td className="px-4 py-2.5 text-xs text-base">{g.nome}</td>
                    {DIAS.map(d => (
                      <td key={d} className="px-3 py-2.5 text-center">
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

        {/* ── Prioridades ── */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Prioridades de roteirização</span>
            <span className="text-[11px] text-muted">ordem de alocação</span>
          </CardHeader>
          <div className="px-4 py-3.5">
            <ol className="flex flex-col gap-2">
              {PRIORIDADES.map((p, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2.5 bg-page border border-[0.5px] border-[var(--border-card)] rounded-lg text-xs text-base">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-bg text-[10px] font-medium flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ol>
          </div>
        </Card>

        {/* ── Pesos ── */}
        <Card>
          <CardHeader><span className="text-xs font-medium">Parâmetros de peso por tipo de veículo</span></CardHeader>
          <div className="px-4 py-3.5">
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Fiorino', key: 'fiorino'     as const },
                { label: 'VUC',     key: 'vuc'         as const },
                { label: '3/4',     key: 'tresQuartos' as const },
                { label: 'Truck',   key: 'truck'       as const },
                { label: 'Carreta', key: 'carreta'     as const },
              ].map(f => (
                <div key={f.key} className="bg-page border border-[0.5px] border-[var(--border-card)] rounded-lg p-3">
                  <Label>{f.label}</Label>
                  <input
                    type="number"
                    value={cfg.pesos[f.key]}
                    onChange={e => setPeso(f.key, e.target.value)}
                    className="w-full border-b border-[var(--border-input)] bg-transparent text-xs text-base outline-none py-1 focus:border-primary transition-colors"
                  />
                  <span className="text-[10px] text-muted mt-1 block">kg máx.</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Instrução global IA ── */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Instruções globais para o agente de IA</span>
          </CardHeader>
          <div className="px-4 py-3.5">
            <p className="text-[11px] text-muted mb-2.5">
              Este texto é inserido fixo no system prompt toda vez que o agente gera rotas.
            </p>
            <textarea
              value={cfg.instrucaoGlobal}
              onChange={e => setCfg(p => ({ ...p, instrucaoGlobal: e.target.value }))}
              rows={5}
              className="w-full border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-3 py-2 text-xs text-base leading-relaxed resize-y outline-none focus:border-primary dark:focus:bg-cream transition-colors"
            />
          </div>
        </Card>

        {/* ── Instruções por rota ── */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Instruções por rota específica</span>
            <Btn size="sm" onClick={addInstrucaoRota}>+ Adicionar rota</Btn>
          </CardHeader>
          <div className="px-4 py-3.5 flex flex-col gap-2.5">
            {cfg.instrucoesPorRota.map(ir => (
              <div key={ir.id} className="flex gap-2 items-start">
                <div className="w-[140px] shrink-0">
                  <input
                    value={ir.codigoRota}
                    onChange={e => updateInstrucaoRota(ir.id, 'codigoRota', e.target.value)}
                    placeholder="Código da rota"
                    className={monoInputCls + ' w-full'}
                  />
                </div>
                <textarea
                  value={ir.instrucao}
                  onChange={e => updateInstrucaoRota(ir.id, 'instrucao', e.target.value)}
                  placeholder="Instrução específica para esta rota..."
                  rows={2}
                  className="flex-1 border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-3 py-1.5 text-xs text-base outline-none focus:border-primary dark:focus:bg-cream transition-colors resize-y min-h-[60px]"
                />
                <button
                  onClick={() => removeInstrucaoRota(ir.id)}
                  className="mt-1 bg-transparent border-none cursor-pointer text-muted text-xl leading-none px-1 hover:text-danger transition-colors shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
            {cfg.instrucoesPorRota.length === 0 && (
              <p className="text-[11px] text-muted py-1">Nenhuma instrução por rota configurada.</p>
            )}
          </div>
        </Card>

      </div>
    </>
  )
}
