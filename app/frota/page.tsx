'use client'
import { useState, useEffect, useCallback } from 'react'
import { Topbar, Card, CardHeader, TextInput, Select } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  listarMotoristas, listarVeiculos, listarVinculados,
  atualizarAtivoMotorista, atualizarAtivoVeiculo,
  type MotoristaDaFrota, type VeiculoDaFrota, type VinculadoDaFrota,
} from '@/lib/frota'

type Tab = 'motoristas' | 'veiculos' | 'vinculados'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer items-center rounded-full border-0 transition-colors duration-200',
        checked ? 'bg-primary' : 'bg-[var(--border-input)]',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-[13px] w-[13px] rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[16px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

function AtivoBadge({ ativo }: { ativo: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
      ativo ? 'bg-success-bg text-success-dark' : 'bg-cream text-muted',
    )}>
      <span className={cn('w-[5px] h-[5px] rounded-full shrink-0', ativo ? 'bg-cond-ok' : 'bg-subtle')} />
      {ativo ? 'ativo' : 'inativo'}
    </span>
  )
}

function SituacaoBadge({ situacao }: { situacao: string }) {
  const norm = situacao.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const isDisp = norm === 'DISPONIVEL'
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap',
      isDisp ? 'bg-success-bg text-success-dark' : 'bg-cream text-muted',
    )}>
      <span className={cn('w-[5px] h-[5px] rounded-full shrink-0', isDisp ? 'bg-cond-ok' : 'bg-subtle')} />
      {situacao || '—'}
    </span>
  )
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="animate-pulse px-4 py-6 flex flex-col gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-3 bg-cream rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

const TH = ({ children }: { children: React.ReactNode }) => (
  <th className="text-left px-4 py-2.5 text-[11px] text-muted font-medium whitespace-nowrap">{children}</th>
)

const TD = ({ children, mono, medium }: { children: React.ReactNode; mono?: boolean; medium?: boolean }) => (
  <td className={cn('px-4 py-2.5 text-xs', mono ? 'font-mono' : '', medium ? 'font-medium text-base' : 'text-muted')}>
    {children}
  </td>
)

const TABS: { id: Tab; label: string }[] = [
  { id: 'motoristas', label: 'Motoristas' },
  { id: 'veiculos',   label: 'Veículos' },
  { id: 'vinculados', label: 'Vinculados' },
]

export default function FrotaPage() {
  const [tab, setTab] = useState<Tab>('motoristas')

  const [motoristas, setMotoristas]   = useState<MotoristaDaFrota[]>([])
  const [veiculos, setVeiculos]       = useState<VeiculoDaFrota[]>([])
  const [vinculados, setVinculados]   = useState<VinculadoDaFrota[]>([])

  const [loadingM, setLoadingM] = useState(false)
  const [loadingV, setLoadingV] = useState(false)
  const [loadingVi, setLoadingVi] = useState(false)

  const [busca, setBusca]         = useState('')
  const [filtroSiat, setFiltroSiat] = useState('')

  useEffect(() => {
    if (tab === 'motoristas' && motoristas.length === 0 && !loadingM) {
      setLoadingM(true)
      listarMotoristas().then(setMotoristas).catch(console.error).finally(() => setLoadingM(false))
    }
    if (tab === 'veiculos' && veiculos.length === 0 && !loadingV) {
      setLoadingV(true)
      listarVeiculos().then(setVeiculos).catch(console.error).finally(() => setLoadingV(false))
    }
    if (tab === 'vinculados' && vinculados.length === 0 && !loadingVi) {
      setLoadingVi(true)
      listarVinculados().then(setVinculados).catch(console.error).finally(() => setLoadingVi(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const toggleMotorista = useCallback(async (id: string, ativo: boolean) => {
    setMotoristas(prev => prev.map(m => m.id === id ? { ...m, ativo } : m))
    try {
      await atualizarAtivoMotorista(id, ativo)
    } catch {
      setMotoristas(prev => prev.map(m => m.id === id ? { ...m, ativo: !ativo } : m))
    }
  }, [])

  const toggleVeiculo = useCallback(async (id: string, ativo: boolean) => {
    setVeiculos(prev => prev.map(v => v.id === id ? { ...v, ativo } : v))
    try {
      await atualizarAtivoVeiculo(id, ativo)
    } catch {
      setVeiculos(prev => prev.map(v => v.id === id ? { ...v, ativo: !ativo } : v))
    }
  }, [])

  const motoristasFiltrados = motoristas.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()),
  )

  const situacoesSiat = [...new Set(veiculos.map(v => v.situacao_siat).filter(Boolean))]
  const veiculosFiltrados = filtroSiat
    ? veiculos.filter(v => v.situacao_siat === filtroSiat)
    : veiculos

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10">
        <Topbar title="Frota" sub="Motoristas, veículos e vínculos" />
      </div>

      <div className="px-5 pt-4 pb-2">
        <div className="flex gap-1 bg-cream rounded-lg p-1 w-fit border border-[0.5px] border-[var(--border-subtle)]">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer',
                tab === t.id
                  ? 'bg-white dark:bg-[#1E1E1C] text-base shadow-sm border border-[0.5px] border-[var(--border-subtle)]'
                  : 'text-muted hover:text-base',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-3 pb-20">

        {/* ── Motoristas ── */}
        {tab === 'motoristas' && (
          <Card>
            <CardHeader>
              <div className="text-xs font-medium text-base">
                Motoristas
                {motoristas.length > 0 && (
                  <span className="ml-2 text-[10px] font-normal text-muted">
                    {motoristasFiltrados.length} de {motoristas.length}
                  </span>
                )}
              </div>
              <TextInput
                value={busca}
                onChange={setBusca}
                placeholder="Buscar por nome..."
                style={{ width: 200 }}
              />
            </CardHeader>

            {loadingM ? (
              <TableSkeleton cols={6} />
            ) : motoristasFiltrados.length === 0 ? (
              <div className="py-10 text-center text-subtle text-[13px]">
                {busca ? 'Nenhum motorista encontrado para essa busca.' : 'Nenhum motorista cadastrado.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[0.5px] border-[var(--border-subtle)]">
                      <TH>Nome</TH>
                      <TH>Sigla</TH>
                      <TH>Telefone</TH>
                      <TH>Celular</TH>
                      <TH>Status</TH>
                      <TH>Ativo</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {motoristasFiltrados.map((m, i) => (
                      <tr
                        key={m.id}
                        className={cn(
                          'border-b border-[0.5px] border-[var(--border-faint)] transition-colors',
                          i % 2 !== 0 && 'bg-cream/40 dark:bg-white/[0.02]',
                          'hover:bg-primary-bg/30 dark:hover:bg-primary/10',
                        )}
                      >
                        <TD medium>{m.nome}</TD>
                        <TD mono>{m.sigla || '—'}</TD>
                        <TD>{m.telefone || '—'}</TD>
                        <TD>{m.celular || '—'}</TD>
                        <td className="px-4 py-2.5">
                          <AtivoBadge ativo={m.ativo} />
                        </td>
                        <td className="px-4 py-2.5">
                          <Toggle checked={m.ativo} onChange={v => toggleMotorista(m.id, v)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ── Veículos ── */}
        {tab === 'veiculos' && (
          <Card>
            <CardHeader>
              <div className="text-xs font-medium text-base">
                Veículos
                {veiculos.length > 0 && (
                  <span className="ml-2 text-[10px] font-normal text-muted">
                    {veiculosFiltrados.length} de {veiculos.length}
                  </span>
                )}
              </div>
              <Select value={filtroSiat} onChange={setFiltroSiat} className="w-[170px]">
                <option value="">Todas as situações</option>
                {situacoesSiat.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </CardHeader>

            {loadingV ? (
              <TableSkeleton cols={8} />
            ) : veiculosFiltrados.length === 0 ? (
              <div className="py-10 text-center text-subtle text-[13px]">
                {filtroSiat ? 'Nenhum veículo com essa situação.' : 'Nenhum veículo cadastrado.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[0.5px] border-[var(--border-subtle)]">
                      <TH>Placa</TH>
                      <TH>Modelo</TH>
                      <TH>Categoria</TH>
                      <TH>Tipo</TH>
                      <TH>Capacidade</TH>
                      <TH>Situação SIAT</TH>
                      <TH>Motorista</TH>
                      <TH>Ativo</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {veiculosFiltrados.map((v, i) => (
                      <tr
                        key={v.id}
                        className={cn(
                          'border-b border-[0.5px] border-[var(--border-faint)] transition-colors',
                          i % 2 !== 0 && 'bg-cream/40 dark:bg-white/[0.02]',
                          'hover:bg-primary-bg/30 dark:hover:bg-primary/10',
                        )}
                      >
                        <td className="px-4 py-2.5 text-xs font-mono font-medium text-base">{v.placa}</td>
                        <TD medium>{v.modelo || '—'}</TD>
                        <TD>{v.categoria || '—'}</TD>
                        <TD>{v.tipo_veiculo || '—'}</TD>
                        <TD>
                          {v.capacidade_kg
                            ? `${v.capacidade_kg.toLocaleString('pt-BR')} kg`
                            : '—'}
                        </TD>
                        <td className="px-4 py-2.5">
                          <SituacaoBadge situacao={v.situacao_siat} />
                        </td>
                        <TD>{v.motorista_nome || <span className="italic">—</span>}</TD>
                        <td className="px-4 py-2.5">
                          <Toggle checked={v.ativo} onChange={val => toggleVeiculo(v.id, val)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ── Vinculados ── */}
        {tab === 'vinculados' && (
          <Card>
            <CardHeader>
              <div className="text-xs font-medium text-base">
                Vinculados
                {vinculados.length > 0 && (
                  <span className="ml-2 text-[10px] font-normal text-muted">
                    {vinculados.length} registros
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted">Veículos ativos ordenados por placa</div>
            </CardHeader>

            {loadingVi ? (
              <TableSkeleton cols={6} />
            ) : vinculados.length === 0 ? (
              <div className="py-10 text-center text-subtle text-[13px]">
                Nenhum vínculo ativo encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[0.5px] border-[var(--border-subtle)]">
                      <TH>Placa</TH>
                      <TH>Modelo</TH>
                      <TH>Capacidade</TH>
                      <TH>Motorista</TH>
                      <TH>Celular</TH>
                      <TH>Situação SIAT</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {vinculados.map((v, i) => (
                      <tr
                        key={v.id}
                        className={cn(
                          'border-b border-[0.5px] border-[var(--border-faint)] transition-colors',
                          i % 2 !== 0 && 'bg-cream/40 dark:bg-white/[0.02]',
                          'hover:bg-primary-bg/30 dark:hover:bg-primary/10',
                        )}
                      >
                        <td className="px-4 py-2.5 text-xs font-mono font-medium text-base">{v.placa}</td>
                        <TD medium>{v.modelo || '—'}</TD>
                        <TD>
                          {v.capacidade_kg
                            ? `${v.capacidade_kg.toLocaleString('pt-BR')} kg`
                            : '—'}
                        </TD>
                        <td className="px-4 py-2.5 text-xs font-medium text-base">
                          {v.motorista_nome ?? (
                            <span className="italic text-subtle">sem motorista</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted">
                          {v.motorista_celular || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <SituacaoBadge situacao={v.situacao_siat} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
