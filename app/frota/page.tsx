'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { Topbar, Card, CardHeader, TextInput, Select, Btn } from '@/components/ui'
import { Checkbox, BulkBar } from '@/components/ui/SelectionControls'
import { cn } from '@/lib/utils'
import { exportarCSV, exportarXLSX, veiculosParaLinhas } from '@/lib/export'
import {
  listarVeiculos,
  atualizarAtivoVeiculo,
  atualizarDisponivelHoje, resetarDisponivelHoje,
  marcarDisponiveisHoje, desmarcarDisponiveisHoje,
  atualizarAtivoBulkVeiculos,
  type VeiculoDaFrota,
} from '@/lib/frota'

// Decisão do Raphael (15/08/26): a Frota tem UMA aba só — Veículos — que
// absorveu as colunas do antigo "Vinculados" (ANTT/CPF/Fornecedor/TAG, item 3
// do Marcelo) e o botão de frota padrão. As abas Motoristas e Vinculados foram
// removidas.

const PAGE_SIZE_DEFAULT = 100
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200]


// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, color = 'primary', disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; color?: 'primary' | 'teal'; disabled?: boolean
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full border-0 transition-colors duration-200',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
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



const SITUACAO_BADGE: Record<string, string> = {
  'DISPONÍVEL':  'bg-green-100 text-green-800',
  'RESERVADO':   'bg-yellow-100 text-yellow-800',
  'CARREGADO':   'bg-blue-100 text-blue-800',
  'VIAJANDO':    'bg-purple-100 text-purple-800',
  'MANUTENÇÃO':  'bg-red-100 text-red-800',
}

function SituacaoSiatBadge({ situacao }: { situacao: string }) {
  const norm = (situacao ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const key   = Object.keys(SITUACAO_BADGE).find(k =>
    k.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() === norm
  )
  const cls = key ? SITUACAO_BADGE[key] : 'bg-gray-100 text-gray-600'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap', cls)}>
      {situacao || '—'}
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

// BulkBar e Checkbox importados de @/components/ui/SelectionControls

// ── Export Menu ───────────────────────────────────────────────────────────────
function ExportMenuFrota({ rows, nomeBase }: { rows: Record<string, unknown>[]; nomeBase: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  async function doExport(fmt: 'csv' | 'xlsx') {
    setOpen(false)
    if (!rows.length) return
    fmt === 'csv' ? exportarCSV(rows, nomeBase) : exportarXLSX(rows, nomeBase)
  }
  return (
    <div ref={ref} className="relative">
      <Btn size="sm" onClick={() => setOpen(v => !v)} disabled={!rows.length}>
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v8M5 7l3 3 3-3M3 12h10"/></svg>
        Exportar
        <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3l3 4 3-4H2z"/></svg>
      </Btn>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[130px] rounded-lg border border-[0.5px] border-[var(--border-subtle)] bg-surface shadow-lg overflow-hidden">
          <button onClick={() => doExport('csv')} className="w-full text-left px-3 py-2 text-[11px] hover:bg-cream cursor-pointer bg-transparent border-none">CSV</button>
          <button onClick={() => doExport('xlsx')} className="w-full text-left px-3 py-2 text-[11px] hover:bg-cream cursor-pointer bg-transparent border-none border-t border-[0.5px] border-[var(--border-faint)]">Excel (XLSX)</button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════���══════════════════════════��════════════════════════
export default function FrotaPage() {
  const [veiculos,   setVeiculos]   = useState<VeiculoDaFrota[]>([])

  const [loadingV,  setLoadingV]  = useState(true)
  const [toastV,    setToastV]    = useState('')
  const [syncingM,  setSyncingM]  = useState(false)
  const [seedingV,  setSeedingV]  = useState(false)

  // Filtros veiculos
  const [buscaV,          setBuscaV]         = useState('')
  const [filtroSiat,      setFiltroSiat]     = useState('')
  const [filtroAtV,       setFiltroAtV]      = useState<'todos' | 'ativos' | 'inativos'>('ativos')
  const [filtroDisp,      setFiltroDisp]     = useState<'todos' | 'sim' | 'nao'>('todos')
  const [filtroTipo,      setFiltroTipo]     = useState('')
  const [filtroCategoria, setFiltroCategoria]= useState('')
  const [filtroCarroceria,setFiltroCarroceria]=useState('')
  const [visibleCountV,   setVisibleCountV]  = useState(25)

  // Selecao
  const [selectedV,  setSelectedV]  = useState<Set<string>>(new Set())
  const [bulkingV,   setBulkingV]   = useState(false)

  // Carregamento (aba unica: Veiculos)
  useEffect(() => {
    listarVeiculos().then(setVeiculos).catch(console.error).finally(() => setLoadingV(false))
  }, [])

  // Toasts
  function showToastV(msg: string) { setToastV(msg); setTimeout(() => setToastV(''), 3500) }

  // ── Sincronizar SIAT ────────────────────────────────────────────────────────
  async function handleSincronizarSIAT() {
    setSyncingM(true)
    try {
      const res  = await fetch('/api/sync-frota', { method: 'POST' })
      const json = await res.json() as { ok?: boolean; motoristas?: number; veiculos?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      const veics = await listarVeiculos()
      setVeiculos(veics)
      showToastV(`Sincronizado: ${json.motoristas} motoristas · ${json.veiculos} veículos`)
    } catch (err) {
      showToastV(`Erro: ${err instanceof Error ? err.message : 'falha na sincronização'}`)
    } finally {
      setSyncingM(false)
    }
  }

  // ── Seed disponibilidade via SIAT ──────────────────────────────────────────
  async function handleSeedSIAT() {
    setSeedingV(true)
    try {
      const res  = await fetch('/api/seed-disponibilidade', { method: 'POST' })
      const json = await res.json() as { ok?: boolean; seeded?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      const veics = await listarVeiculos()
      setVeiculos(veics)
      showToastV(`✓ ${json.seeded} veículo${(json.seeded ?? 0) !== 1 ? 's' : ''} com sugestão SIAT aplicada`)
    } catch (err) {
      showToastV(`Erro: ${err instanceof Error ? err.message : 'falha'}`)
    } finally {
      setSeedingV(false)
    }
  }

  // ── Toggles individuais ─────────────────────────────────────────────────────


  const toggleDisponivelHoje = useCallback(async (id: string, disponivel: boolean) => {
    setVeiculos(prev => prev.map(v => v.id === id
      ? { ...v, disponivel_hoje: disponivel, disponibilidade_origem: disponivel ? 'operador' as const : null }
      : v))
    try { await atualizarDisponivelHoje(id, disponivel) }
    catch { setVeiculos(prev => prev.map(v => v.id === id
      ? { ...v, disponivel_hoje: !disponivel, disponibilidade_origem: null }
      : v)) }
  }, [])

  // ── Bulk motoristas ─────────────────────────────────────────────────────────

  // ── Bulk veículos ───────────────────────────────────────────────────────────
  async function handleBulkDisponivelV(disponivel: boolean) {
    const ids = [...selectedV]
    setBulkingV(true)
    try {
      if (disponivel) await marcarDisponiveisHoje(ids)
      else            await desmarcarDisponiveisHoje(ids)
      setVeiculos(prev => prev.map(v => selectedV.has(v.id)
        ? { ...v, disponivel_hoje: disponivel, disponibilidade_origem: disponivel ? 'operador' as const : null }
        : v))
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
      setVeiculos(prev => prev.map(v => ({
        ...v,
        disponivel_hoje: placasSet.has(v.placa.toUpperCase().trim()),
        disponibilidade_origem: placasSet.has(v.placa.toUpperCase().trim()) ? 'operador' as const : null,
      })))
      showToastV(`${ids.length} veículo${ids.length !== 1 ? 's' : ''} disponível${ids.length !== 1 ? 'is' : ''} hoje`)
    } catch {
      showToastV('Erro ao importar arquivo')
    }
  }

  // Frota padrão = veículos ativos (TIPFRO 005) com motorista vinculado —
  // absorveu o botão da antiga aba Vinculados.
  async function handleMarcarFrotaPadrao() {
    try {
      await resetarDisponivelHoje()
      const ids = veiculos.filter(v => v.ativo && v.motorista_id).map(v => v.id)
      await marcarDisponiveisHoje(ids)
      setVeiculos(prev => {
        const idSet = new Set(ids)
        return prev.map(v => ({
          ...v,
          disponivel_hoje: idSet.has(v.id),
          disponibilidade_origem: idSet.has(v.id) ? 'operador' as const : null,
        }))
      })
      showToastV(`✓ ${ids.length} veículos da frota padrão marcados como disponíveis hoje`)
    } catch {
      showToastV('Erro ao marcar frota padrão')
    }
  }

  async function handleResetarDisponibilidade() {
    try {
      await resetarDisponivelHoje()
      setVeiculos(prev => prev.map(v => ({ ...v, disponivel_hoje: false, disponibilidade_origem: null })))
      showToastV('Disponibilidade do dia resetada')
    } catch {
      showToastV('Erro ao resetar')
    }
  }

  // ── Dados filtrados e paginados ─────────────────────────────────────────────

  const situacoesSiat  = [...new Set(veiculos.map(v => v.situacao_siat).filter(Boolean))].sort()
  const tiposVeiculo   = [...new Set(veiculos.map(v => v.tipo_veiculo).filter(Boolean))].sort()
  const categorias     = [...new Set(veiculos.map(v => v.categoria).filter(Boolean))].sort()
  const carrocerias    = [...new Set(veiculos.map(v => v.tipo_carroceria).filter(Boolean))].sort()

  const veiculosFiltrados = veiculos.filter(v => {
    if (buscaV) {
      const q = buscaV.toLowerCase()
      if (!v.placa.toLowerCase().includes(q) &&
          !(v.modelo ?? '').toLowerCase().includes(q) &&
          !(v.motorista_nome ?? '').toLowerCase().includes(q) &&
          !(v.motorista_cpf ?? '').includes(q) &&
          !(v.motorista_fornecedor ?? '').toLowerCase().includes(q)) return false
    }
    if (filtroAtV === 'ativos'   && !v.ativo) return false
    if (filtroAtV === 'inativos' &&  v.ativo) return false
    if (filtroSiat      && v.situacao_siat  !== filtroSiat)      return false
    if (filtroTipo      && v.tipo_veiculo   !== filtroTipo)      return false
    if (filtroCategoria && v.categoria      !== filtroCategoria) return false
    if (filtroCarroceria && v.tipo_carroceria !== filtroCarroceria) return false
    if (filtroDisp === 'sim' && !v.disponivel_hoje) return false
    if (filtroDisp === 'nao' &&  v.disponivel_hoje) return false
    return true
  })
  const paginatedV  = veiculosFiltrados.slice(0, visibleCountV)


  // ── Estado da seleção ────────────────────────────────────────────────────────

  const allVSel  = veiculosFiltrados.length > 0 && veiculosFiltrados.every(v => selectedV.has(v.id))
  const someVSel = veiculosFiltrados.some(v => selectedV.has(v.id)) && !allVSel

  function toggleAllV() {
    if (allVSel) setSelectedV(new Set())
    else setSelectedV(new Set(veiculosFiltrados.map(v => v.id)))
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
            : 'Veículos da frota'}
        />
      </div>

      <div className="px-5 py-3 pb-20">

        {/* ── Veículos ── */}

          <Card>
            {/* Cabeçalho: título + contadores à esquerda, busca à direita */}
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
              <TextInput value={buscaV} onChange={v => { setBuscaV(v); setVisibleCountV(25) }} placeholder="Placa, motorista, CPF, fornecedor..." style={{ width: 240 }} />
            </CardHeader>

            {/* Linha de filtros — horizontal, compacta (layout revisado 15/08) */}
            <div className="px-4 py-2.5 border-b border-[0.5px] border-[var(--border-faint)]">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <Select value={filtroAtV} onChange={v => { setFiltroAtV(v as typeof filtroAtV); setVisibleCountV(25) }}>
                  <option value="todos">Ativo: todos</option>
                  <option value="ativos">Somente ativos</option>
                  <option value="inativos">Somente inativos</option>
                </Select>
                <Select value={filtroTipo} onChange={v => { setFiltroTipo(v); setVisibleCountV(25) }}>
                  <option value="">Tipo: todos</option>
                  {tiposVeiculo.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Select value={filtroCategoria} onChange={v => { setFiltroCategoria(v); setVisibleCountV(25) }}>
                  <option value="">Categoria: todas</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Select value={filtroCarroceria} onChange={v => { setFiltroCarroceria(v); setVisibleCountV(25) }}>
                  <option value="">Carroceria: todas</option>
                  {carrocerias.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Select value={filtroDisp} onChange={v => { setFiltroDisp(v as typeof filtroDisp); setVisibleCountV(25) }}>
                  <option value="todos">Disp. hoje: todas</option>
                  <option value="sim">Disponíveis hoje</option>
                  <option value="nao">Não disponíveis</option>
                </Select>
                <Select value={filtroSiat} onChange={v => { setFiltroSiat(v); setVisibleCountV(25) }}>
                  <option value="">Situação: todas</option>
                  {situacoesSiat.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
            </div>

            {/* Barra de ações — abaixo dos filtros (layout revisado 15/08) */}
            <div className="px-4 py-2.5 border-b border-[0.5px] border-[var(--border-faint)] flex items-center gap-2 flex-wrap">
              <Btn size="sm" onClick={handleSincronizarSIAT} disabled={syncingM}>
                {syncingM ? 'Sincronizando...' : '↺ Sincronizar com SIAT'}
              </Btn>
              <Btn
                size="sm"
                variant="primary"
                onClick={handleMarcarFrotaPadrao}
                disabled={veiculos.length === 0}
              >
                ✓ Frota padrão disponível hoje
              </Btn>
              <Btn size="sm" onClick={handleSeedSIAT} disabled={seedingV}>
                {seedingV ? 'Carregando…' : '⇩ Sugestão SIAT'}
              </Btn>
              <Btn size="sm" onClick={handleResetarDisponibilidade}>Resetar dia</Btn>
              <span className="flex-1" />
              <label className="cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[0.5px] border-[var(--border-input)] text-xs text-mid hover:bg-cream transition-colors whitespace-nowrap">
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4h12M5 8h6M7 12h2"/>
                </svg>
                Importar disponibilidade (CSV/XLSX)
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportarDisponibilidade} />
              </label>
              <ExportMenuFrota rows={veiculosParaLinhas(veiculosFiltrados)} nomeBase="veiculos" />
            </div>

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

            {loadingV ? <TableSkeleton cols={9} /> : veiculosFiltrados.length === 0 ? (
              <div className="py-10 text-center text-subtle text-[13px]">
                {filtroSiat || filtroAtV !== 'ativos' || filtroDisp !== 'todos' || buscaV || filtroTipo || filtroCategoria || filtroCarroceria
                  ? 'Nenhum veículo com esses filtros.'
                  : veiculos.length === 0
                    ? 'Nenhum veículo cadastrado. Use "Sincronizar com SIAT".'
                    : 'Nenhum veículo ativo na frota.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[0.5px] border-[var(--border-subtle)]">
                      <TH check>
                        <Checkbox checked={allVSel} indeterminate={someVSel} onChange={toggleAllV} />
                      </TH>
                      {/* Colunas do item 3 do Marcelo absorvidas do antigo Vinculados.
                          Vld.Seguro não existe no SIAT — omitida até definir a fonte. */}
                      <TH>Placa</TH><TH>Motorista</TH><TH>ANTT</TH><TH>CPF</TH>
                      <TH>Fornecedor</TH><TH>TAG</TH><TH>Tipo</TH><TH>Categoria</TH><TH>Carroceria</TH>
                      <TH>Cap. (kg)</TH><TH>Situação</TH><TH>Disponível hoje</TH>
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
                        <TD>{v.motorista_nome ?? <span className="italic text-subtle">—</span>}</TD>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted whitespace-nowrap" title={v.motorista_cert_antt_validade ? `Validade: ${v.motorista_cert_antt_validade.split('-').reverse().join('/')}` : undefined}>
                          {v.motorista_cert_antt || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted whitespace-nowrap">{v.motorista_cpf || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-muted max-w-[140px] truncate" title={v.motorista_fornecedor || undefined}>
                          {v.motorista_fornecedor || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-mono text-muted whitespace-nowrap">
                          {v.numero_tag || (v.tag_pedagio ? '✓' : '—')}
                        </td>
                        <TD>{v.tipo_veiculo || '—'}</TD>
                        <TD>{v.categoria || '—'}</TD>
                        <TD>{v.tipo_carroceria || '—'}</TD>
                        <td className="px-4 py-2.5 text-xs text-muted tabular-nums text-right">
                          {v.capacidade_kg ? v.capacidade_kg.toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          <SituacaoSiatBadge situacao={v.situacao_siat} />
                        </td>
                        <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                          {(() => {
                            const norm = (v.situacao_siat ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
                            const podeDisponivel = norm === 'DISPONIVEL'
                            return (
                              <div className="flex items-center gap-1.5">
                                <Toggle
                                  checked={v.disponivel_hoje}
                                  onChange={val => toggleDisponivelHoje(v.id, val)}
                                  color="teal"
                                  disabled={!podeDisponivel}
                                />
                                {!podeDisponivel && (
                                  <span className="text-[10px] text-muted italic">{v.situacao_siat || '—'}</span>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {paginatedV.length < veiculosFiltrados.length && (
              <div className="px-4 py-3 border-t border-[0.5px] border-[var(--border-faint)] flex justify-center">
                <button
                  onClick={() => setVisibleCountV(c => c + 25)}
                  className="text-[11px] text-primary hover:underline cursor-pointer bg-transparent border-none transition-colors"
                >
                  Ver mais {Math.min(25, veiculosFiltrados.length - paginatedV.length)} veículos ({veiculosFiltrados.length - paginatedV.length} restantes)
                </button>
              </div>
            )}
          </Card>

      </div>
    </div>
  )
}
