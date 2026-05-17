'use client'
import { useState, useRef, useEffect } from 'react'
import { Topbar, Card, CardHeader, Btn, ImportBar, TextInput, TextArea } from '@/components/ui'
import { ImportarSIATButton } from '@/components/ui/ImportarSIATButton'
import { SiatImportDialog } from '@/components/ui/SiatImportDialog'
import { DEFAULT_CONFIG } from '@/lib/data'
import { AppConfig, InstrucaoRota } from '@/types'
import { useAppData } from '@/components/providers/AppDataProvider'
import { cn } from '@/lib/utils'

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const
const DIAS_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const PRIORIDADES = [
  'Agendamentos (DATAGE preenchida)',
  'SAC e reentregas ativas',
  'Clientes COND Vermelho',
  'Clientes COND Laranja',
  'Varejo por data de chegada',
]

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] text-muted mb-1">{children}</label>
}

export default function ConfiguracoesPage() {
  const [cfg, setCfg] = useState<AppConfig>(DEFAULT_CONFIG)
  const [saved, setSaved] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [importDialog, setImportDialog] = useState(false)
  const initialRender = useRef(true)

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false
      return
    }
    setHasChanges(true)
  }, [cfg])
  const { importState, refresh, dismissImport } = useAppData()
  const summary = importState.summary
  const importResult = summary
    ? { nfs: summary.totalNFs, peso: summary.pesoTotalToneladas, veiculos: summary.veiculosUnicos }
    : undefined

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

  function handleDiscard() {
    setCfg(DEFAULT_CONFIG)
    setHasChanges(false)
    initialRender.current = true
  }

  function handleSave() {
    setSaved(true)
    setHasChanges(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      {/* Topbar fica sticky enquanto o main rola */}
      <div className="sticky top-0 z-10">
        <Topbar title="Configurações" sub="Conexão, regras, frota e instruções da IA">
          <ImportarSIATButton onClick={() => setImportDialog(true)} running={importState.running} label="Testar e importar SIAT" />
          <Btn variant="primary" onClick={handleSave}>
            {saved ? '✓ Salvo!' : 'Salvar configurações'}
          </Btn>
        </Topbar>
      </div>

      {/* Conteúdo em bloco normal — cresce com o conteúdo, main scrolla */}
      <div className="px-5 py-5 flex flex-col gap-6 pb-20">
        <ImportBar running={importState.running} step={importState.step} progress={importState.progress} result={importResult} onClose={dismissImport} />

        {/* ── Horários ── */}
        <Card>
          <CardHeader><span className="text-xs font-medium">Horários de operação</span></CardHeader>
          <div className="px-4 py-4">
            <div className="flex gap-6 flex-wrap">
              {[
                { label: 'Início roteirização', key: 'inicioRoteirizacao' as const },
                { label: 'Envio ao motorista',  key: 'envioMotorista'    as const },
                { label: 'Saída dos veículos',  key: 'saidaVeiculos'     as const },
              ].map(f => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <TextInput type="time" value={cfg.operacao[f.key]} onChange={v => setOp(f.key, v)} style={{ width: 120 }} />
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
          <div className="px-4 py-4">
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
          <div className="px-4 py-4">
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
          <div className="px-4 py-4">
            <p className="text-[11px] text-muted mb-2.5">
              Este texto é inserido fixo no system prompt toda vez que o agente gera rotas.
            </p>
            <TextArea rows={6} value={cfg.instrucaoGlobal} onChange={v => setCfg(p => ({ ...p, instrucaoGlobal: v }))} />
          </div>
        </Card>

        {/* ── Instruções por rota ── */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Instruções por rota específica</span>
            <Btn size="sm" onClick={addInstrucaoRota}>+ Adicionar rota</Btn>
          </CardHeader>
          <div className="px-4 py-4 flex flex-col gap-2.5">
            {cfg.instrucoesPorRota.map(ir => (
              <div key={ir.id} className="flex gap-2 items-start">
                <div className="w-[140px] shrink-0">
                  <TextInput
                    mono
                    value={ir.codigoRota}
                    onChange={v => updateInstrucaoRota(ir.id, 'codigoRota', v)}
                    placeholder="Código da rota"
                  />
                </div>
                <div className="flex-1">
                  <TextArea
                    rows={2}
                    value={ir.instrucao}
                    onChange={v => updateInstrucaoRota(ir.id, 'instrucao', v)}
                    placeholder="Instrução específica para esta rota..."
                  />
                </div>
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

      {importDialog && (
        <SiatImportDialog
          onClose={() => setImportDialog(false)}
          onConfirm={f => { setImportDialog(false); refresh(f) }}
        />
      )}

      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-end gap-3 px-6 py-3 bg-white dark:bg-[#1E1E1C] border-t border-[0.5px] border-[var(--border-subtle)] shadow-lg">
          <span className="text-xs text-muted">Alterações não salvas</span>
          <button
            onClick={handleDiscard}
            className="px-3.5 py-[5px] text-xs text-muted hover:text-base transition-colors cursor-pointer bg-transparent border-none"
          >
            Descartar
          </button>
          <Btn variant="primary" onClick={handleSave}>Salvar configurações</Btn>
        </div>
      )}
    </div>
  )
}
