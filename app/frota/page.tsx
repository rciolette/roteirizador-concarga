'use client'
import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { Topbar, Card, CardHeader, TextInput, Select, Btn } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  listarMotoristas, listarVeiculos, listarVinculados,
  atualizarAtivoMotorista, atualizarAtivoVeiculo,
  atualizarDisponivelHoje, resetarDisponivelHoje,
  marcarDisponiveisHoje, desmarcarDisponiveisHoje,
  atualizarAtivoBulkMotoristas, atualizarAtivoBulkVeiculos,
  type MotoristaDaFrota, type VeiculoDaFrota, type VinculadoDaFrota,
} from '@/lib/frota'

type Tab = 'motoristas' | 'veiculos' | 'vinculados'

const PAGE_SIZE_DEFAULT = 100
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200]

// ── Paginacao ──────────────────────────────────────────────────────────���──────
function Paginacao({
  page, totalItems, totalPages, pageSize, onPageSizeChange, onChange,
}: {
  page: number; totalItems: number; totalPages: number; onChange: (p: number) => void
  pageSize?: number; onPageSizeChange?: (s: number) => void
}) {
  const ps = pageSize ?? PAGE_SIZE_DEFAULT
  if (totalPages <= 1 && !onPageSizeChange) return null
  const from = totalItems === 0 ? 0 : page * ps + 1
  const to   = Math.min((page + 1) * ps, totalItems)
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-[0.5px] border-[var(--border-faint)] flex-wrap gap-2">
      <span className="text-[11px] text-muted">
        {totalItems === 0 ? '0 registros' : `${from}–${to} de ${totalItems}`}
      </span>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted whitespace-nowrap">por página</span>
            <select
              value={ps}
              onChange={e => onPageSizeChange(Number(e.target.value))}
              className="h-6 border border-[0.5px] border-[var(--border-input)] rounded text-[11px] text-base bg-page px-1.5 cursor-pointer outline-none focus:border-primary"
            >
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex gap-1.5 items-center">
            <Btn size="sm" onClick={() => onChange(page - 1)} disabled={page === 0}>← Ant.</Btn>
            <span className="text-[11px] text-muted tabular-nums whitespace-nowrap">{page + 1} / {totalPages}</span>
            <Btn size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}>Próx. →</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, color = 'primary' }: {
  checked: boolean; onChange: (v: boolean) => void; color?: 'primary' | 'teal'
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer items-center rounded-full border-0 transition-colors duration-200',
        checked ? color === 'teal' ? 'bg-teal' : 'bg-primary' : 'bg-[var(--border-input)]',
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block h-[13px] w-[13px] rounded-full bg-white shadow-sm transition-transform duration-200',
        checked ? 'translate-x-[16px]' : 'translate-x-[2px]',
      )} />
    </button>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────
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

function VeiculoStatusBadge({ situacaoSiat, disponivelHoje }: { situacaoSiat: string; disponivelHoje: boolean }) {
  if (disponivelHoje) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap bg-teal-bg text-[#085041]">
        <span className="w-[5px] h-[5px] rounded-full shrink-0 bg-teal" />
        Disponível hoje
      </span>
    )
  }
  if (!situacaoSiat) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap bg-cream text-muted">
        <span className="w-[5px] h-[5px] rounded-full shrink-0 bg-subtle" />—
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap bg-cream text-muted">
      <span className="w-[5px] h-[5px] rounded-full shrink-0 bg-subtle" />
      {situacaoSiat}
    </span>
  )
}

// ── TableSkeleton ─────────────────────────────────────────────────────────────
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

const TH = ({ children, check }: { children?: React.ReactNode; check?: boolean }) => (
  <th className={cn('text-left px-4 py-2.5 text-[11px] text-muted font-medium whitespace-nowrap', check && 'w-9 px-3')}>{children}</th>
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

// ── CSV/XLSX parser ───────────────────────────────────────────────────────────
async function parseArquivoVeiculos(file: File): Promise<string[]> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return new Promise(resolve => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, string>[]
          resolve(rows
            .map(r => r.placa ?? r.Placa ?? r.PLACA ?? String(Object.values(r)[0] ?? ''))
            .map(p => p.trim().toUpperCase())
            .filter(Boolean))
        },
      })
    })
  }
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]
  return rows
    .map(r => String(r.placa ?? r.Placa ?? r.PLACA ?? Object.values(r)[0] ?? ''))
    .map(p => p.trim().toUpperCase())
    .filter(Boolean)
}

// ── Barra de ação bulk ────────────────────────────────────────────────────────
function BulkBar({ count, busy, actions, onClear }: {
  count: number
  busy: boolean
  actions: { label: string; variant?: 'primary' | 'teal' | 'danger-soft'; onClick: () => void }[]
  onClear: () => void
}) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary-bg border-b border-[0.5px] border-[#B5D4F4] dark:border-[#1A3A5C] flex-wrap">
      <span className="text-[11px] font-medium text-primary flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="12" height="12" rx="2" opacity=".2"/>
          <path d="M5 8l2.5 2.5L11 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {count} selecionado{count !== 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {actions.map(a => (
          <Btn key={a.label} size="sm" variant={a.variant ?? 'default'} onClick={a.onClick} disabled={busy}>
            {busy ? '...' : a.label}
          </Btn>
        ))}
        <button
          onClick={onClear}
          className="text-[11px] text-muted hover:text-base transition-colors cursor-pointer bg-transparent border-none px-1"
        >
          Limpar seleção
        </button>
      </div>
    </div>
  )
}

// ── Checkbox ────────────────────────────────────────────────────────────────��─
function Checkbox({ checked, onChange, indeterminate }: {
  checked: boolean; onChange: (v: boolean) => void; indeterminate?: boolean
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'w-4 h-4 rounded border border-[0.5px] flex items-center justify-center transition-colors cursor-pointer shrink-0',
        checked || indeterminate
          ? 'bg-primary border-primary'
          : 'bg-page border-[var(--border-input)] hover:border-primary',
      )}
    >
      {checked && (
        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {indeterminate && !checked && (
        <span className="w-2 h-px bg-white block" />
      )}
    </button>
  )
}

// ═══════════════════════════���══════════════════════════��════════════════════════
export default function FrotaPage() {
  const [tab, setTab] = useState<Tab>('motoristas')

  const [motoristas, setMotoristas] = useState<MotoristaDaFrota[]>([])
  const [veiculos,   setVeiculos]   = useState<VeiculoDaFrota[]>([])
  const [vinculados, setVinculados] = useState<VinculadoDaFrota[]>([])

  const [loadingM,  setLoadingM]  = useState(false)
  const [loadingV,  setLoadingV]  = useState(false)
  const [loadingVi, setLoadingVi] = useState(false)
  const [toastV,    setToastV]    = useState('')
  const [toastM,    setToastM]    = useState('')
  const [syncingM,  setSyncingM]  = useState(false)

  // ── Filtros motoristas ────────────────────────────────────────────���─────────
  const [busca,       setBusca]       = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [pageSizeM,   setPageSizeM]   = useState(25)
  const [pageM,       setPageM]       = useState(0)

  // ── Filtros veículos ────────────────────────────────────────────────────────
  const [buscaV,     setBuscaV]     = useState('')
  const [filtroSiat, setFiltroSiat] = useState('')          // '' = todas as situações
  const [filtroAtV,  setFiltroAtV]  = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [filtroDisp, setFiltroDisp] = useState<'todos' | 'sim' | 'nao'>('todos')
  const [pageSizeV,  setPageSizeV]  = useState(25)
  const [pageV,      setPageV]      = useState(0)

  // ── Paginação vinculados ────────────────────────────────────────────────────
  const [pageVi, setPageVi] = useState(0)

  // ── Seleção ─────────────────────────────────────────────────────────────────
  const [selectedM,  setSelectedM]  = useState<Set<string>>(new Set())
  const [selectedV,  setSelectedV]  = useState<Set<string>>(new Set())
  const [bulkingM,   setBulkingM]   = useState(false)
  const [bulkingV,   setBulkingV]   = useState(false)

  // ── Carregamento por aba ────────────────────────────────────────────────────
  useEffect(() => {
    setSelectedM(new Set())
    setSelectedV(new Set())
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

  // ── Toasts ──────────────────────────────────────────────────────────────────
  function showToastV(msg: string) { setToastV(msg); setTimeout(() => setToastV(''), 3500) }
  function showToastM(msg: string) { setToastM(msg); setTimeout(() => setToastM(''), 4000) }

  // ── Sincronizar SIAT ────────────────────────────────────────────────────────
  async function handleSincronizarSIAT() {
    setSyncingM(true)
    try {
      const res  = await fetch('/api/sync-frota', { method: 'POST' })
      const json = await res.json() as { ok?: boolean; motoristas?: number; veiculos?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      const [mots, veics] = await Promise.all([listarMotoristas(), listarVeiculos()])
      setMotoristas(mots)
      setVeiculos(veics)
      showToastM(`Sincronizado: ${json.motoristas} motoristas · ${json.veiculos} veículos`)
    } catch (err) {
      showToastM(`Erro: ${err instanceof Error ? err.message : 'falha na sincronização'}`)
    } finally {
      setSyncingM(false)
    }
  }

  // ── Toggles individuais ─────────────────────────────────────────────────────
  const toggleMotorista = useCallback(async (id: string, ativo: boolean) => {
    setMotoristas(prev => prev.map(m => m.id === id ? { ...m, ativo } : m))
    try { await atualizarAtivoMotorista(id, ativo) }
    catch { setMotoristas(prev => prev.map(m => m.id === id ? { ...m, ativo: !ativo } : m)) }
  }, [])

  const toggleVeiculo = useCallback(async (id: string, ativo: boolean) => {
    setVeiculos(prev => prev.map(v => v.id === id ? { ...v, ativo } : v))
    try { await atualizarAtivoVeiculo(id, ativo) }
    catch { setVeiculos(prev => prev.map(v => v.id === id ? { ...v, ativo: !ativo } : v)) }
  }, [])

  const toggleDisponivelHoje = useCallback(async (id: string, disponivel: boolean) => {
    setVeiculos(prev => prev.map(v => v.id === id ? { ...v, disponivel_hoje: disponivel } : v))
    try { await atualizarDisponivelHoje(id, disponivel) }
    catch { setVeiculos(prev => prev.map(v => v.id === id ? { ...v, disponivel_hoje: !disponivel } : v)) }
  }, [])

  // ── Bulk motoristas ─────────────────────────────────────────────────────────
  async function handleBulkAtivoM(ativo: boolean) {
    const ids = [...selectedM]
    setBulkingM(true)
    try {
      await atualizarAtivoBulkMotoristas(ids, ativo)
      setMotoristas(prev => prev.map(m => selectedM.has(m.id) ? { ...m, ativo } : m))
      setSelectedM(new Set())
      showToastM(`${ids.length} motorista${ids.length > 1 ? 's' : ''} ${ativo ? 'ativado' : 'inativado'}${ids.length > 1 ? 's' : ''}`)
    } catch (err) {
      showToastM(`Erro: ${err instanceof Error ? err.message : 'falha'}`)
    } finally {
      setBulkingM(false)
    }
  }

  // ── Bulk veículos ───────────────────────────────────────────────────────────
  async function handleBulkDisponivelV(disponivel: boolean) {
    const ids = [...selectedV]
    setBulkingV(true)
    try {
      if (disponivel) await marcarDisponiveisHoje(ids)
      else            await desmarcarDisponiveisHoje(ids)
      setVeiculos(prev => prev.map(v => selectedV.has(v.id) ? { ...v, disponivel_hoje: disponivel } : v))
      setSelectedV(new Set())
      showToastV(`${ids.length} veículo${ids.length > 1 ? 's' : ''} ${disponivel ? 'marcado' : 'desmarcado'}${ids.length > 1 ? 's' : ''} como disponível`)
    } catch (err) {
      showToastV(`Erro: ${err instanceof Error ? err.message : 'falha'}`)
    } finally {
      setBulkingV(false)
    }
  }

  async function handleBulkAtivoV(ativo: boolean) {
    const ids = [...selectedV]
    setBulkingV(true)
    try {
      await atualizarAtivoBulkVeiculos(ids, ativo)
      setVeiculos(prev => prev.map(v => selectedV.has(v.id) ? { ...v, ativo } : v))
      setSelectedV(new Set())
      showToastV(`${ids.length} veículo${ids.length > 1 ? 's' : ''} ${ativo ? 'ativado' : 'inativado'}${ids.length > 1 ? 's' : ''}`)
    } catch (err) {
      showToastV(`Erro: ${err instanceof Error ? err.message : 'falha'}`)
    } finally {
      setBulkingV(false)
    }
  }

  // ── Importar / Resetar disponibilidade ─────────────────────────────────────
  async function handleImportarDisponibilidade(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const placas = await parseArquivoVeiculos(file)
      const placasSet = new Set(placas)
      await resetarDisponivelHoje()
      const ids = veiculos.filter(v => placasSet.has(v.placa.toUpperCase().trim())).map(v => v.id)
      await marcarDisponiveisHoje(ids)
      setVeiculos(prev => prev.map(v => ({ ...v, disponivel_hoje: placasSet.has(v.placa.toUpperCase().trim()) })))
      showToastV(`${ids.length} veículo${ids.length !== 1 ? 's' : ''} disponível${ids.length !== 1 ? 'is' : ''} hoje`)
    } catch {
      showToastV('Erro ao importar arquivo')
    }
  }

  async function handleResetarDisponibilidade() {
    try {
      await resetarDisponivelHoje()
      setVeiculos(prev => prev.map(v => ({ ...v, disponivel_hoje: false })))
      showToastV('Disponibilidade do dia resetada')
    } catch {
      showToastV('Erro ao resetar')
    }
  }

  // ── Dados filtrados e paginados ─────────────────────────────────────────────
  const motoristasFiltrados = motoristas.filter(m => {
    if (busca) {
      const q = busca.toLowerCase()
      if (!m.nome.toLowerCase().includes(q) &&
          !(m.sigla ?? '').toLowerCase().includes(q) &&
          !(m.codigo_siat ?? '').toLowerCase().includes(q)) return false
    }
    if (filtroAtivo === 'ativos'   && !m.ativo) return false
    if (filtroAtivo === 'inativos' &&  m.ativo) return false
    return true
  })
  const totalPagesM = Math.max(1, Math.ceil(motoristasFiltrados.length / pageSizeM))
  const paginatedM  = motoristasFiltrados.slice(pageM * pageSizeM, (pageM + 1) * pageSizeM)

  const situacoesSiat = [...new Set(veiculos.map(v => v.situacao_siat).filter(Boolean))].sort()
  const veiculosFiltrados = veiculos.filter(v => {
    if (buscaV) {
      const q = buscaV.toLowerCase()
      if (!v.placa.toLowerCase().includes(q) &&
          !(v.modelo ?? '').toLowerCase().includes(q) &&
          !(v.motorista_nome ?? '').toLowerCase().includes(q)) return false
    }
    if (filtroAtV === 'ativos'   && !v.ativo) return false
    if (filtroAtV === 'inativos' &&  v.ativo) return false
    if (filtroSiat && v.situacao_siat !== filtroSiat) return false
    if (filtroDisp === 'sim' && !v.disponivel_hoje) return false
    if (filtroDisp === 'nao' &&  v.disponivel_hoje) return false
    return true
  })
  const totalPagesV = Math.max(1, Math.ceil(veiculosFiltrados.length / pageSizeV))
  const paginatedV  = veiculosFiltrados.slice(pageV * pageSizeV, (pageV + 1) * pageSizeV)

  const totalPagesVi = Math.max(1, Math.ceil(vinculados.length / PAGE_SIZE_DEFAULT))
  const paginatedVi  = vinculados.slice(pageVi * PAGE_SIZE_DEFAULT, (pageVi + 1) * PAGE_SIZE_DEFAULT)

  // ── Estado da seleção ────────────────────────────────────────────────────────
  const allMSel  = motoristasFiltrados.length > 0 && motoristasFiltrados.every(m => selectedM.has(m.id))
  const someMSel = motoristasFiltrados.some(m => selectedM.has(m.id)) && !allMSel

  const allVSel  = veiculosFiltrados.length > 0 && veiculosFiltrados.every(v => selectedV.has(v.id))
  const someVSel = veiculosFiltrados.some(v => selectedV.has(v.id)) && !allVSel

  function toggleAllM() {
    if (allMSel) setSelectedM(new Set())
    else setSelectedM(new Set(motoristasFiltrados.map(m => m.id)))
  }
  function toggleAllV() {
    if (allVSel) setSelectedV(new Set())
    else setSelectedV(new Set(veiculosFiltrados.map(v => v.id)))
  }
  function toggleOneM(id: string) {
    setSelectedM(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleOneV(id: string) {
    setSelectedV(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const qtdDisponiveis = veiculos.filter(v => v.disponivel_hoje).length

  // ── Render ──────────────────────────��───────────────────────────────��───────
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10">
        <Topbar
          title="Frota"
          sub={qtdDisponiveis > 0
            ? `${qtdDisponiveis} veículo${qtdDisponiveis !== 1 ? 's' : ''} disponível${qtdDisponiveis !== 1 ? 'is' : ''} hoje`
            : 'Motoristas, veículos e vínculos'}
        />
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
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-medium text-base">Motoristas</span>
                {motoristas.length > 0 && (
                  <>
                    <span className="text-[10px] text-muted">
                      {motoristasFiltrados.length} de {motoristas.length}
                    </span>
                    <span className="text-[10px] text-muted hidden sm:inline">
                      · {motoristas.filter(m => m.ativo).length} ativos
                      · {motoristas.filter(m => !m.ativo).length} inativos
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Btn size="sm" onClick={handleSincronizarSIAT} disabled={syncingM}>
                  {syncingM ? 'Sincronizando...' : '↺ Sincronizar com SIAT'}
                </Btn>
                <Select value={filtroAtivo} onChange={v => { setFiltroAtivo(v as typeof filtroAtivo); setPageM(0) }} className="w-[130px]">
                  <option value="todos">Todos</option>
                  <option value="ativos">Somente ativos</option>
                  <option value="inativos">Somente inativos</option>
                </Select>
                <TextInput value={busca} onChange={v => { setBusca(v); setPageM(0) }} placeholder="Nome, sigla ou SIAT..." style={{ width: 200 }} />
              </div>
            </CardHeader>

            {toastM && (
              <div className={cn('mx-4 mt-3 mb-1 text-[11px] rounded-lg px-3 py-2',
                toastM.startsWith('Erro') ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success-dark')}>
                {toastM}
              </div>
            )}

            <BulkBar
              count={selectedM.size}
              busy={bulkingM}
              onClear={() => setSelectedM(new Set())}
              actions={[
                { label: 'Ativar selecionados',   variant: 'primary',      onClick: () => handleBulkAtivoM(true)  },
                { label: 'Inativar selecionados',  variant: 'danger-soft',  onClick: () => handleBulkAtivoM(false) },
              ]}
            />

            {loadingM ? <TableSkeleton cols={8} /> : motoristasFiltrados.length === 0 ? (
              <div className="py-10 text-center text-subtle text-[13px]">
                {busca || filtroAtivo !== 'todos'
                  ? 'Nenhum motorista com esses filtros.'
                  : 'Nenhum motorista cadastrado. Use "Sincronizar com SIAT".'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[0.5px] border-[var(--border-subtle)]">
                      <TH check>
                        <Checkbox checked={allMSel} indeterminate={someMSel} onChange={toggleAllM} />
                      </TH>
                      <TH>Nome</TH><TH>Sigla</TH><TH>Cód. SIAT</TH>
                      <TH>Telefone</TH><TH>Celular</TH><TH>Status</TH><TH>Ativo</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedM.map((m, i) => (
                      <tr
                        key={m.id}
                        onClick={() => toggleOneM(m.id)}
                        className={cn(
                          'border-b border-[0.5px] border-[var(--border-faint)] transition-colors cursor-pointer',
                          selectedM.has(m.id) ? 'bg-primary-bg/60 dark:bg-primary/8' : i % 2 !== 0 ? 'bg-cream/40' : '',
                          'hover:bg-primary-bg/40',
                        )}
                      >
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={selectedM.has(m.id)} onChange={() => toggleOneM(m.id)} />
                        </td>
                        <TD medium>{m.nome}</TD>
                        <TD mono>{m.sigla || '—'}</TD>
                        <TD mono>{m.codigo_siat || '—'}</TD>
                        <TD>{m.telefone || '—'}</TD>
                        <TD>{m.celular || '—'}</TD>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <AtivoBadge ativo={m.ativo} />
                        </td>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <Toggle checked={m.ativo} onChange={v => toggleMotorista(m.id, v)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Paginacao
              page={pageM} totalItems={motoristasFiltrados.length} totalPages={totalPagesM}
              onChange={setPageM} pageSize={pageSizeM}
              onPageSizeChange={s => { setPageSizeM(s); setPageM(0) }}
            />
          </Card>
        )}

        {/* ── Veículos ── */}
        {tab === 'veiculos' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-base">Veículos</span>
                {veiculos.length > 0 && (
                  <span className="text-[10px] text-muted">{veiculosFiltrados.length} de {veiculos.length}</span>
                )}
                {qtdDisponiveis > 0 && (
                  <span className="text-[10px] font-medium text-teal bg-teal-bg px-1.5 py-0.5 rounded-full">
                    {qtdDisponiveis} disponíveis hoje
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <TextInput value={buscaV} onChange={v => { setBuscaV(v); setPageV(0) }} placeholder="Placa, modelo, motorista..." style={{ width: 190 }} />
                <Select value={filtroAtV} onChange={v => { setFiltroAtV(v as typeof filtroAtV); setPageV(0) }} className="w-[130px]">
                  <option value="todos">Todos</option>
                  <option value="ativos">Somente ativos</option>
                  <option value="inativos">Somente inativos</option>
                </Select>
                <Select value={filtroDisp} onChange={v => { setFiltroDisp(v as typeof filtroDisp); setPageV(0) }} className="w-[155px]">
                  <option value="todos">Qualquer disp.</option>
                  <option value="sim">Disponíveis hoje</option>
                  <option value="nao">Não disponíveis</option>
                </Select>
                <Select value={filtroSiat} onChange={v => { setFiltroSiat(v); setPageV(0) }} className="w-[155px]">
                  <option value="">Todas as situações</option>
                  {situacoesSiat.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                <label className="cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[0.5px] border-[var(--border-input)] text-xs text-mid hover:bg-cream transition-colors whitespace-nowrap">
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 4h12M5 8h6M7 12h2"/>
                  </svg>
                  CSV/XLSX
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportarDisponibilidade} />
                </label>
                <Btn size="sm" onClick={handleResetarDisponibilidade}>Resetar dia</Btn>
              </div>
            </CardHeader>

            {toastV && (
              <div className={cn('mx-4 mt-3 mb-1 text-[11px] rounded-lg px-3 py-2',
                toastV.startsWith('Erro') ? 'bg-danger-bg text-danger' : 'bg-success-bg text-success-dark')}>
                {toastV}
              </div>
            )}

            <BulkBar
              count={selectedV.size}
              busy={bulkingV}
              onClear={() => setSelectedV(new Set())}
              actions={[
                { label: '✓ Disponível hoje',       variant: 'teal',        onClick: () => handleBulkDisponivelV(true)  },
                { label: '✗ Remover disponível',                            onClick: () => handleBulkDisponivelV(false) },
                { label: 'Ativar selecionados',      variant: 'primary',     onClick: () => handleBulkAtivoV(true)       },
                { label: 'Inativar selecionados',    variant: 'danger-soft', onClick: () => handleBulkAtivoV(false)      },
              ]}
            />

            {loadingV ? <TableSkeleton cols={13} /> : veiculosFiltrados.length === 0 ? (
              <div className="py-10 text-center text-subtle text-[13px]">
                {filtroSiat || filtroAtV !== 'todos' || filtroDisp !== 'todos' || buscaV
                  ? 'Nenhum veículo com esses filtros.'
                  : 'Nenhum veículo cadastrado. Use "Sincronizar com SIAT".'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[0.5px] border-[var(--border-subtle)]">
                      <TH check>
                        <Checkbox checked={allVSel} indeterminate={someVSel} onChange={toggleAllV} />
                      </TH>
                      <TH>Placa</TH><TH>Modelo</TH><TH>Categoria</TH><TH>Tipo</TH><TH>Carroceria</TH>
                      <TH>Cap. (kg)</TH><TH>PBT (kg)</TH><TH>Vol. (m³)</TH>
                      <TH>Situação / Disp.</TH><TH>Motorista</TH>
                      <TH>Ativo</TH><TH>Disponível hoje</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedV.map((v, i) => (
                      <tr
                        key={v.id}
                        onClick={() => toggleOneV(v.id)}
                        className={cn(
                          'border-b border-[0.5px] border-[var(--border-faint)] transition-colors cursor-pointer',
                          selectedV.has(v.id)  ? 'bg-primary-bg/60 dark:bg-primary/8'
                          : v.disponivel_hoje   ? 'bg-teal-bg/30 dark:bg-teal/5'
                          : i % 2 !== 0        ? 'bg-cream/40'
                          : '',
                          'hover:bg-primary-bg/30',
                        )}
                      >
                        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                          <Checkbox checked={selectedV.has(v.id)} onChange={() => toggleOneV(v.id)} />
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono font-medium text-base">{v.placa}</td>
                        <TD medium>{v.modelo || '—'}</TD>
                        <TD>{v.categoria || '—'}</TD>
                        <TD>{v.tipo_veiculo || '—'}</TD>
                        <TD>{v.tipo_carroceria || '—'}</TD>
                        <td className="px-4 py-2.5 text-xs text-muted tabular-nums text-right">
                          {v.capacidade_kg ? v.capacidade_kg.toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted tabular-nums text-right">
                          {v.pbt ? v.pbt.toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted tabular-nums text-right">
                          {v.volume_m3 ? v.volume_m3.toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <VeiculoStatusBadge situacaoSiat={v.situacao_siat} disponivelHoje={v.disponivel_hoje} />
                        </td>
                        <TD>{v.motorista_nome ?? <span className="italic">—</span>}</TD>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <Toggle checked={v.ativo} onChange={val => toggleVeiculo(v.id, val)} />
                        </td>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <Toggle checked={v.disponivel_hoje} onChange={val => toggleDisponivelHoje(v.id, val)} color="teal" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Paginacao
              page={pageV} totalItems={veiculosFiltrados.length} totalPages={totalPagesV}
              onChange={setPageV} pageSize={pageSizeV}
              onPageSizeChange={s => { setPageSizeV(s); setPageV(0) }}
            />
          </Card>
        )}

        {/* ── Vinculados ── */}
        {tab === 'vinculados' && (
          <Card>
            <CardHeader>
              <div className="text-xs font-medium text-base">
                Vinculados
                {vinculados.length > 0 && <span className="ml-2 text-[10px] font-normal text-muted">{vinculados.length} registros</span>}
              </div>
              <div className="text-[11px] text-muted">Todos os veículos com motorista vinculado</div>
            </CardHeader>

            {loadingVi ? <TableSkeleton cols={7} /> : vinculados.length === 0 ? (
              <div className="py-10 text-center text-subtle text-[13px]">Nenhum vínculo encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[0.5px] border-[var(--border-subtle)]">
                      <TH>Placa</TH><TH>Modelo</TH><TH>Cap. (kg)</TH>
                      <TH>Motorista</TH><TH>Sigla</TH><TH>Celular</TH><TH>Situação SIAT</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVi.map((v, i) => (
                      <tr key={v.id} className={cn('border-b border-[0.5px] border-[var(--border-faint)] transition-colors', i % 2 !== 0 && 'bg-cream/40', 'hover:bg-primary-bg/30')}>
                        <td className="px-4 py-2.5 text-xs font-mono font-medium text-base">{v.placa}</td>
                        <TD medium>{v.modelo || '—'}</TD>
                        <td className="px-4 py-2.5 text-xs text-muted tabular-nums text-right">
                          {v.capacidade_kg ? v.capacidade_kg.toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium text-base">
                          {v.motorista_nome ?? <span className="italic text-subtle">sem motorista</span>}
                        </td>
                        <TD mono>{v.motorista_sigla || '—'}</TD>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted">{v.motorista_celular || '—'}</td>
                        <td className="px-4 py-2.5"><SituacaoBadge situacao={v.situacao_siat} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Paginacao page={pageVi} totalItems={vinculados.length} totalPages={totalPagesVi} onChange={setPageVi} />
          </Card>
        )}
      </div>
    </div>
  )
}
