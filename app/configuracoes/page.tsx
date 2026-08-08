'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Topbar, Card, CardHeader, Btn, ImportBar, TextInput, TextArea } from '@/components/ui'
import { ImportarSIATButton } from '@/components/ui/ImportarSIATButton'
import { SiatImportDialog } from '@/components/ui/SiatImportDialog'
import { DEFAULT_CONFIG } from '@/lib/data'
import { AppConfig, InstrucaoRota } from '@/types'
import { useAppData } from '@/components/providers/AppDataProvider'
import { useAuth } from '@/components/providers/AuthProvider'
import { salvarConfig, salvarWebhooks, carregarWebhooks, type WebhookConfig } from '@/lib/config-store'
import { cn } from '@/lib/utils'
import { GradeCidadesTable } from '@/components/ui/GradeCidadesTable'
import { RotasCadastradasTable } from '@/components/ui/RotasCadastradasTable'
import { LogsAtividadeTable } from '@/components/ui/LogsAtividadeTable'
import type { Perfil } from '@/lib/auth'

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const
const DIAS_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const PRIORIDADES = [
  'Agendamentos (DATAGE preenchida)',
  'SAC e reentregas ativas',
  'Clientes COND Vermelho',
  'Clientes COND Laranja',
  'Varejo por data de chegada',
]

type ConfigTab = 'operacao' | 'cidades' | 'rotas' | 'acessos' | 'logs' | 'avancado'

const PERFIL_LABELS: Record<Perfil, string> = {
  owner:         'Owner',
  administrador: 'Administrador',
  operador:      'Operador',
  visualizador:  'Visualizador',
}

const OWNER_EMAIL = 'rciolette@gmail.com'

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] text-muted mb-1">{children}</label>
}

interface Empresa {
  razao_social:  string | null
  nome_fantasia: string | null
  cnpj:          string | null
  endereco:      string | null
  cidade:        string | null
  uf:            string | null
  telefone:      string | null
  email:         string | null
}

interface UsuarioItem {
  id:       string
  email:    string
  perfil:   Perfil
  nome:     string | null
  ativo:    boolean
  criadoEm: string
}

interface ConviteItem {
  id:        string
  email:     string
  perfil:    Perfil
  status:    string
  criado_em: string
  aceito_em: string | null
}

export default function ConfiguracoesPage() {
  const { nfImportState, importarNFs, dismissNFImport, config: globalConfig, setConfig: setGlobalConfig } = useAppData()
  const { pode, usuario, loading } = useAuth()
  const router = useRouter()

  const [tab, setTab] = useState<ConfigTab>('operacao')
  const [cfg, setCfg] = useState<AppConfig>(globalConfig)
  const [empresa, setEmpresa] = useState<Empresa>({ razao_social: '', nome_fantasia: '', cnpj: '', endereco: '', cidade: '', uf: '', telefone: '', email: '' })
  const [savingEmpresa, setSavingEmpresa] = useState(false)
  const [msgEmpresa, setMsgEmpresa] = useState('')
  const [webhooks, setWebhooks] = useState<WebhookConfig>({ gerarRotasWebhookUrl: '' })
  const [saved, setSaved] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [importDialog, setImportDialog] = useState(false)
  const initialRender = useRef(true)

  // Acessos
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([])
  const [convites, setConvites] = useState<ConviteItem[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(false)
  const [convidandoEmail, setConvidandoEmail] = useState('')
  const [convidandoPerfil, setConvidandoPerfil] = useState<Perfil>('operador')
  const [convidandoNome, setConvidandoNome] = useState('')
  const [enviandoConvite, setEnviandoConvite] = useState(false)
  const [msgAcessos, setMsgAcessos] = useState('')

  // Proteção de rota + leitura de ?tab= da URL
  useEffect(() => {
    if (loading) return
    if (!usuario || !pode('configuracoes')) { router.replace('/'); return }
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab') as ConfigTab | null
    if (tabParam && ['operacao', 'cidades', 'rotas', 'acessos', 'logs', 'avancado'].includes(tabParam)) {
      const gated: Record<string, boolean> = { acessos: pode('usuarios'), logs: pode('logs'), avancado: pode('webhooks') }
      if (!(tabParam in gated) || gated[tabParam]) {
        setTab(tabParam)
      }
    }
  }, [loading, usuario, pode, router])

  useEffect(() => {
    carregarWebhooks().then(setWebhooks).catch(() => {})
    fetch('/api/empresa').then(r => r.json()).then(d => { if (d.empresa) setEmpresa(d.empresa) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (initialRender.current) { initialRender.current = false; return }
    setHasChanges(true)
  }, [cfg])

  async function loadAcessos() {
    setLoadingUsuarios(true)
    try {
      const [uRes, cRes] = await Promise.all([
        fetch('/api/usuarios').then(r => r.json()),
        fetch('/api/convites').then(r => r.json()),
      ])
      setUsuarios((uRes.usuarios ?? []).filter((u: UsuarioItem) => u.email !== OWNER_EMAIL && u.perfil !== 'owner'))
      setConvites(cRes.convites ?? [])
    } catch { /* ignore */ } finally {
      setLoadingUsuarios(false)
    }
  }

  useEffect(() => {
    if (tab === 'acessos' && pode('usuarios')) loadAcessos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const summary = nfImportState.summary
  const importResult = summary
    ? { nfs: summary.totalNFs, peso: summary.pesoTotalToneladas, veiculos: summary.veiculosUnicos }
    : undefined

  const setOp = (k: keyof AppConfig['operacao'], v: string) =>
    setCfg(p => ({ ...p, operacao: { ...p.operacao, [k]: v } }))
  const setPeso = (k: keyof AppConfig['pesos'], v: string) =>
    setCfg(p => ({ ...p, pesos: { ...p.pesos, [k]: Number(v) } }))

  function toggleGrade(id: string, dia: typeof DIAS[number]) {
    setCfg(p => ({ ...p, grades: p.grades.map(g => g.id === id ? { ...g, [dia]: !g[dia] } : g) }))
  }
  function addInstrucaoRota() {
    setCfg(p => ({ ...p, instrucoesPorRota: [...p.instrucoesPorRota, { id: Date.now().toString(), codigoRota: '', instrucao: '' }] }))
  }
  function removeInstrucaoRota(id: string) {
    setCfg(p => ({ ...p, instrucoesPorRota: p.instrucoesPorRota.filter(i => i.id !== id) }))
  }
  function updateInstrucaoRota(id: string, k: keyof InstrucaoRota, v: string) {
    setCfg(p => ({ ...p, instrucoesPorRota: p.instrucoesPorRota.map(i => i.id === id ? { ...i, [k]: v } : i) }))
  }
  function handleDiscard() {
    setCfg(DEFAULT_CONFIG); setHasChanges(false); initialRender.current = true
  }
  function handleRestaurarPadrao() {
    setCfg(DEFAULT_CONFIG); setGlobalConfig(DEFAULT_CONFIG); salvarConfig(DEFAULT_CONFIG)
    setHasChanges(false); initialRender.current = true
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }
  function handleSave() {
    setGlobalConfig(cfg); salvarConfig(cfg); salvarWebhooks(webhooks)
    setSaved(true); setHasChanges(false); setTimeout(() => setSaved(false), 2000)
  }

  async function handleAlterarPerfil(userId: string, novoPerfil: Perfil) {
    const res = await fetch('/api/usuarios', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, perfil: novoPerfil }),
    })
    if (res.ok) setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, perfil: novoPerfil } : u))
  }

  async function handleToggleAtivo(userId: string, ativo: boolean) {
    const res = await fetch('/api/usuarios', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ativo }),
    })
    if (res.ok) setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, ativo } : u))
  }

  async function handleConvidar() {
    if (!convidandoEmail) return
    setEnviandoConvite(true); setMsgAcessos('')
    const res = await fetch('/api/convites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: convidandoEmail, perfil: convidandoPerfil, nome: convidandoNome }),
    })
    const data = await res.json()
    if (res.ok) {
      setMsgAcessos('Convite enviado!'); setConvidandoEmail(''); setConvidandoNome('')
      loadAcessos()
    } else {
      setMsgAcessos(data.error ?? 'Erro ao enviar convite')
    }
    setEnviandoConvite(false)
  }

  async function handleCancelarConvite(id: string) {
    await fetch(`/api/convites?id=${id}`, { method: 'DELETE' })
    setConvites(prev => prev.filter(c => c.id !== id))
  }

  async function handleReenviarConvite(id: string) {
    setMsgAcessos('')
    const res = await fetch('/api/convites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const data = await res.json()
    setMsgAcessos(res.ok ? 'Convite reenviado!' : (data.error ?? 'Erro ao reenviar convite'))
  }

  const perfisConvidaveis: Perfil[] = usuario?.perfil === 'owner'
    ? ['administrador', 'operador', 'visualizador']
    : ['operador', 'visualizador']

  const tabs: { id: ConfigTab; label: string; visible: boolean }[] = [
    { id: 'operacao', label: 'Operação',   visible: true },
    { id: 'cidades',  label: 'Cidades',    visible: true },
    { id: 'rotas',    label: 'Rotas',      visible: true },
    { id: 'acessos',  label: 'Acessos',    visible: pode('usuarios') },
    { id: 'logs',     label: 'Logs',       visible: pode('logs') },
    { id: 'avancado', label: 'Avançado',   visible: pode('webhooks') },
  ]

  return (
    <div>
      <div className="sticky top-0 z-10">
        <Topbar title="Configurações" sub="Conexão, regras, frota e instruções da IA">
          <ImportarSIATButton onClick={() => setImportDialog(true)} running={nfImportState.running} label="Importar NFs" loadingLabel="Importando..." />
          <Btn onClick={handleRestaurarPadrao}>Restaurar padrões</Btn>
          <Btn variant="primary" onClick={handleSave}>{saved ? '✓ Salvo!' : 'Salvar configurações'}</Btn>
        </Topbar>

        {/* Abas */}
        <div className="flex gap-0 border-b border-[0.5px] border-[var(--border-subtle)] bg-surface px-5">
          {tabs.filter(t => t.visible).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer bg-transparent',
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-base',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5 flex flex-col gap-6 pb-20">
        <ImportBar running={nfImportState.running} step={nfImportState.step} progress={nfImportState.progress} result={importResult} onClose={dismissNFImport} />

        {/* ── Aba Operação ── */}
        {tab === 'operacao' && (
          <>
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
                      <tr key={g.id} className={cn('transition-colors', i % 2 === 0 ? 'bg-surface hover:bg-page' : 'bg-page hover:bg-cream')}>
                        <td className="px-4 py-2.5 text-xs text-base">{g.nome}</td>
                        {DIAS.map(d => (
                          <td key={d} className="px-3 py-2.5 text-center">
                            <input type="checkbox" checked={g[d]} onChange={() => toggleGrade(g.id, d)} className="w-3.5 h-3.5 accent-primary cursor-pointer" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ── Aba Cidades ── */}
        {tab === 'cidades' && <GradeCidadesTable />}

        {/* ── Aba Rotas ── */}
        {tab === 'rotas' && <RotasCadastradasTable />}

        {/* ── Aba Acessos ── */}
        {tab === 'acessos' && pode('usuarios') && (
          <>
            <Card>
              <CardHeader><span className="text-xs font-medium">Convidar novo usuário</span></CardHeader>
              <div className="px-4 py-4 flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Nome (opcional)</Label>
                    <TextInput value={convidandoNome} onChange={setConvidandoNome} placeholder="Nome do usuário" />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <TextInput value={convidandoEmail} onChange={setConvidandoEmail} placeholder="email@empresa.com.br" />
                  </div>
                  <div>
                    <Label>Perfil</Label>
                    <select
                      value={convidandoPerfil}
                      onChange={e => setConvidandoPerfil(e.target.value as Perfil)}
                      className="w-full border border-[var(--border-input)] rounded-lg text-xs py-2 px-2.5 bg-surface text-base outline-none focus:border-primary transition-colors"
                    >
                      {perfisConvidaveis.map(p => (
                        <option key={p} value={p}>{PERFIL_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Btn variant="primary" size="sm" onClick={handleConvidar}>
                    {enviandoConvite ? 'Enviando...' : 'Enviar convite'}
                  </Btn>
                  {msgAcessos && (
                    <span className={cn('text-[11px]', msgAcessos.startsWith('Erro') ? 'text-red-500' : 'text-primary')}>
                      {msgAcessos}
                    </span>
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <span className="text-xs font-medium">Usuários</span>
                <Btn size="sm" onClick={loadAcessos}>Atualizar</Btn>
              </CardHeader>
              <div>
                {loadingUsuarios ? (
                  <div className="px-4 py-6 text-xs text-muted">Carregando...</div>
                ) : usuarios.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-muted">Nenhum usuário cadastrado.</div>
                ) : (
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-page">
                        {['Nome', 'E-mail', 'Perfil', 'Ativo'].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-[10px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)] uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-faint)]">
                      {usuarios.map(u => {
                        const isAdminRow = u.perfil === 'administrador'
                        const podeEditar = usuario?.perfil === 'owner' || !isAdminRow
                        return (
                          <tr key={u.id} className="hover:bg-page transition-colors">
                            <td className="px-4 py-2.5 text-xs text-base">{u.nome || '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-muted">{u.email}</td>
                            <td className="px-4 py-2.5">
                              {podeEditar ? (
                                <select
                                  value={u.perfil}
                                  onChange={e => handleAlterarPerfil(u.id, e.target.value as Perfil)}
                                  className="border border-[var(--border-input)] rounded text-[11px] py-1 px-1.5 bg-surface text-base outline-none focus:border-primary"
                                >
                                  {(['administrador', 'operador', 'visualizador'] as Perfil[]).map(p => (
                                    <option key={p} value={p} disabled={p === 'administrador' && usuario?.perfil !== 'owner'}>
                                      {PERFIL_LABELS[p]}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-[11px] text-muted">{PERFIL_LABELS[u.perfil]}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                type="checkbox"
                                checked={u.ativo}
                                onChange={e => podeEditar && handleToggleAtivo(u.id, e.target.checked)}
                                disabled={!podeEditar}
                                className="w-3.5 h-3.5 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            {convites.filter(c => c.status === 'pendente').length > 0 && (
              <Card>
                <CardHeader><span className="text-xs font-medium">Convites pendentes</span></CardHeader>
                <div>
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-page">
                        {['E-mail', 'Perfil', 'Enviado em', ''].map((h, i) => (
                          <th key={i} className="text-left px-4 py-2 text-[10px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)] uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-faint)]">
                      {convites.filter(c => c.status === 'pendente').map(c => (
                        <tr key={c.id} className="hover:bg-page transition-colors">
                          <td className="px-4 py-2.5 text-xs text-muted">{c.email}</td>
                          <td className="px-4 py-2.5 text-xs text-base">{PERFIL_LABELS[c.perfil]}</td>
                          <td className="px-4 py-2.5 text-xs text-muted">{new Date(c.criado_em).toLocaleDateString('pt-BR')}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button onClick={() => handleReenviarConvite(c.id)} className="text-[11px] text-primary hover:underline transition-colors bg-transparent border-none cursor-pointer">
                                Reenviar
                              </button>
                              <button onClick={() => handleCancelarConvite(c.id)} className="text-[11px] text-muted hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer">
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {pode('empresa') && (
              <Card>
                <CardHeader><span className="text-xs font-medium">Dados da empresa</span></CardHeader>
                <div className="px-4 py-4 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { label: 'Razão social',  key: 'razao_social'  as const },
                      { label: 'Nome fantasia', key: 'nome_fantasia' as const },
                      { label: 'CNPJ',          key: 'cnpj'          as const },
                      { label: 'Telefone',      key: 'telefone'      as const },
                      { label: 'E-mail',        key: 'email'         as const },
                    ] as const).map(f => (
                      <div key={f.key}>
                        <Label>{f.label}</Label>
                        <TextInput value={empresa[f.key] ?? ''} onChange={v => setEmpresa(p => ({ ...p, [f.key]: v }))} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label>Endereço completo (logradouro, número, bairro)</Label>
                    <TextInput value={empresa.endereco ?? ''} onChange={v => setEmpresa(p => ({ ...p, endereco: v }))} placeholder="Ex: Av. Oiapoque, 1234, Bairro Industrial" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Cidade</Label>
                      <TextInput value={empresa.cidade ?? ''} onChange={v => setEmpresa(p => ({ ...p, cidade: v }))} />
                    </div>
                    <div>
                      <Label>UF</Label>
                      <TextInput value={empresa.uf ?? ''} onChange={v => setEmpresa(p => ({ ...p, uf: v }))} />
                    </div>
                  </div>
                  {msgEmpresa && <p className="text-[11px] text-primary">{msgEmpresa}</p>}
                  <div>
                    <Btn
                      variant="primary" size="sm"
                      onClick={async () => {
                        setSavingEmpresa(true); setMsgEmpresa('')
                        const res = await fetch('/api/empresa', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(empresa) })
                        setMsgEmpresa(res.ok ? 'Dados salvos.' : 'Erro ao salvar.')
                        setSavingEmpresa(false)
                      }}
                    >
                      {savingEmpresa ? 'Salvando...' : 'Salvar empresa'}
                    </Btn>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── Aba Logs ── */}
        {tab === 'logs' && pode('logs') && <LogsAtividadeTable />}

        {/* ── Aba Avançado ── */}
        {tab === 'avancado' && pode('webhooks') && (
          <>
            <Card>
              <CardHeader>
                <span className="text-xs font-medium">Prioridades de roteirização</span>
                <span className="text-[11px] text-muted">ordem de alocação</span>
              </CardHeader>
              <div className="px-4 py-4">
                <ol className="flex flex-col gap-2">
                  {PRIORIDADES.map((p, i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2.5 bg-page border border-[0.5px] border-[var(--border-card)] rounded-lg text-xs text-base">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-bg text-[10px] font-medium flex items-center justify-center shrink-0">{i + 1}</span>
                      {p}
                    </li>
                  ))}
                </ol>
              </div>
            </Card>

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
                      <input type="number" value={cfg.pesos[f.key]} onChange={e => setPeso(f.key, e.target.value)} className="w-full border-b border-[var(--border-input)] bg-transparent text-xs text-base outline-none py-1 focus:border-primary transition-colors" />
                      <span className="text-[10px] text-muted mt-1 block">kg máx.</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader><span className="text-xs font-medium">Instruções globais para o agente de IA</span></CardHeader>
              <div className="px-4 py-4">
                <p className="text-[11px] text-muted mb-2.5">Este texto é inserido fixo no system prompt toda vez que o agente gera rotas.</p>
                <TextArea rows={6} value={cfg.instrucaoGlobal} onChange={v => setCfg(p => ({ ...p, instrucaoGlobal: v }))} />
              </div>
            </Card>

            <Card>
              <CardHeader>
                <span className="text-xs font-medium">Instruções por rota específica</span>
                <Btn size="sm" onClick={addInstrucaoRota}>+ Adicionar rota</Btn>
              </CardHeader>
              <div className="px-4 py-4 flex flex-col gap-2.5">
                {cfg.instrucoesPorRota.map(ir => (
                  <div key={ir.id} className="flex gap-2 items-start">
                    <div className="w-[140px] shrink-0">
                      <TextInput mono value={ir.codigoRota} onChange={v => updateInstrucaoRota(ir.id, 'codigoRota', v)} placeholder="Código da rota" />
                    </div>
                    <div className="flex-1">
                      <TextArea rows={2} value={ir.instrucao} onChange={v => updateInstrucaoRota(ir.id, 'instrucao', v)} placeholder="Instrução específica para esta rota..." />
                    </div>
                    <button onClick={() => removeInstrucaoRota(ir.id)} className="mt-1 bg-transparent border-none cursor-pointer text-muted text-xl leading-none px-1 hover:text-danger transition-colors shrink-0">×</button>
                  </div>
                ))}
                {cfg.instrucoesPorRota.length === 0 && <p className="text-[11px] text-muted py-1">Nenhuma instrução por rota configurada.</p>}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <span className="text-xs font-medium">Integrações — Webhooks n8n</span>
                <span className="text-[11px] text-muted">editável pelo owner</span>
              </CardHeader>
              <div className="px-4 py-4 flex flex-col gap-3">
                <p className="text-[11px] text-muted">
                  Alterações aqui são salvas no banco. Para ter efeito imediato no servidor, adicione também{' '}
                  <code className="font-mono bg-page px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> ao{' '}
                  <code className="font-mono bg-page px-1 rounded">.env.local</code>.
                </p>
                {([
                  { label: 'Webhook — Gerar Rotas (agente IA)', key: 'gerarRotasWebhookUrl' as const },
                ] as const).map(f => (
                  <div key={f.key}>
                    <Label>{f.label}</Label>
                    <TextInput mono value={webhooks[f.key]} onChange={v => { setWebhooks(p => ({ ...p, [f.key]: v })); setHasChanges(true) }} placeholder="https://n8n.exemplo.com.br/webhook/..." />
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>

      {importDialog && (
        <SiatImportDialog onClose={() => setImportDialog(false)} onConfirm={f => { setImportDialog(false); importarNFs(f) }} />
      )}

      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-end gap-3 px-6 py-3 bg-surface border-t border-[0.5px] border-[var(--border-subtle)] shadow-lg">
          <span className="text-xs text-muted">Alterações não salvas</span>
          <button onClick={handleDiscard} className="px-3.5 py-[5px] text-xs text-muted hover:text-base transition-colors cursor-pointer bg-transparent border-none">
            Descartar
          </button>
          <Btn variant="primary" onClick={handleSave}>Salvar configurações</Btn>
        </div>
      )}
    </div>
  )
}
