'use client'
import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { cn } from '@/lib/utils'
import { Btn, Card, CardHeader, TextInput, Select } from '@/components/ui'
import { useAppData } from '@/components/providers/AppDataProvider'
import type { NotaFiscal } from '@/types'

const PAGE_SIZE = 100

interface NfRow {
  id: string
  n_nfs: number | null
  remetente: string | null
  destinatario: string | null
  bairro_dest: string | null
  bairro: string | null
  municipio_dest: string | null
  municipio: string | null
  tipo_cliente: string | null
  peso_bruto: number | null
  peso_kg: number | null
  cond: string | null
  grade: string | null
  placa: string | null
  reentrega: boolean | null
  sac: string | number | null
  regiao: string | null
  observacao: string | null
}

function ObsBadge({ obs }: { obs: string | null | undefined }) {
  if (!obs) return null
  const upper = obs.toUpperCase()
  const isRestr = upper.includes('RESTR') || upper.includes('RES DESC') || upper.includes('RES.DESC')
  const isSac   = upper.includes('SAC') || upper.includes('SOL SAC') || upper.includes('SOLUÇÃO')
  const cls = isRestr
    ? 'bg-danger-bg text-danger border-[0.5px] border-danger/20'
    : isSac
      ? 'bg-warn-bg text-warn border-[0.5px] border-warn/20'
      : 'bg-cream text-muted border-[0.5px] border-[var(--border-subtle)]'
  const label = isRestr ? 'Res' : isSac ? 'SAC' : 'Obs'
  return (
    <span
      className={cn('inline-flex items-center px-1.5 py-px rounded text-[9px] font-medium cursor-default whitespace-nowrap', cls)}
      title={obs}
    >
      {label}
    </span>
  )
}

function CondBadge({ cond }: { cond: string | null | undefined }) {
  const c = (cond ?? '').toLowerCase()
  if (c === 'vermelho') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-danger-bg text-danger whitespace-nowrap">
        <span className="w-[5px] h-[5px] rounded-full bg-cond-err shrink-0" />
        Vermelho
      </span>
    )
  }
  if (c === 'laranja') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-warn-bg text-warn whitespace-nowrap">
        <span className="w-[5px] h-[5px] rounded-full bg-cond-warn shrink-0" />
        Laranja
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-cream text-muted">
      OK
    </span>
  )
}

function nfToRow(nf: NotaFiscal): NfRow {
  return {
    id:            nf.id,
    n_nfs:         parseInt(nf.numnfs, 10) || null,
    remetente:     null,
    destinatario:  nf.destinatario,
    bairro_dest:   nf.bairro   !== '—' ? nf.bairro   : null,
    bairro:        nf.bairro   !== '—' ? nf.bairro   : null,
    municipio_dest: nf.municipio !== '—' ? nf.municipio : null,
    municipio:     nf.municipio !== '—' ? nf.municipio : null,
    tipo_cliente:  nf.tipoCliente,
    peso_bruto:    nf.peso,
    peso_kg:       nf.peso,
    cond:          nf.cond,
    grade:         nf.grade && nf.grade !== '—' ? nf.grade : null,
    placa:         null,
    reentrega:     nf.indRee,
    sac:           nf.sac ?? null,
    regiao:        nf.rota && nf.rota !== '—' ? nf.rota : null,
    observacao:    nf.observacao ?? null,
  }
}

function TipoBadge({ tipo }: { tipo: string | null | undefined }) {
  const t = (tipo ?? '').toUpperCase()
  const cls =
    t === 'CD'        ? 'bg-primary-bg text-primary-dark' :
    t === 'REDE'      ? 'bg-purple-bg text-purple' :
    t === 'VAREJO'    ? 'bg-teal-bg text-[#085041]' :
    t === 'COZINHA'   ? 'bg-warn-bg text-warn' :
    t === 'REENTREGA' ? 'bg-warn-bg text-warn' :
                        'bg-cream text-mid'
  if (!tipo) return <span className="text-[10px] text-subtle">—</span>
  return <span className={cn('text-[10px] px-1.5 py-px rounded-full font-medium', cls)}>{tipo}</span>
}

export function NfsPendentesTable() {
  const { nfsPendentes, nfImportState } = useAppData()

  const [rows,    setRows]    = useState<NfRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(0)
  const [busca,        setBusca]        = useState('')
  const [tipoFiltro,   setTipoFiltro]   = useState('Todos')
  const [gradeFiltro,  setGradeFiltro]  = useState('Todos')
  const [condFiltro,   setCondFiltro]   = useState('Todos')
  const [apenasRee,    setApenasRee]    = useState(false)

  useEffect(() => {
    // Enquanto o SIAT está sendo importado, manter loading
    if (nfImportState.running) { setLoading(true); return }

    // Se já temos dados do SIAT, usar diretamente (sem consultar Supabase)
    if (nfsPendentes.length > 0) {
      setRows(nfsPendentes.map(nfToRow))
      setLoading(false)
      return
    }

    // Fallback: buscar NFs não alocadas salvas no Supabase
    let cancelled = false
    async function load() {
      setLoading(true)
      const sb = getSupabaseBrowser()
      const { data, error } = await sb
        .from('notas_fiscais')
        .select('id, n_nfs, remetente, destinatario, bairro_dest, bairro, municipio_dest, municipio, tipo_cliente, peso_bruto, peso_kg, cond, grade, placa, reentrega, sac, regiao')
        .is('rota_id', null)
        .order('n_nfs', { ascending: true })
        .limit(2000)
      if (!cancelled) {
        if (!error && data) setRows(data as NfRow[])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [nfsPendentes, nfImportState.running])

  const filtered = rows.filter(row => {
    if (busca) {
      const q = busca.toLowerCase()
      if (
        !(row.destinatario ?? '').toLowerCase().includes(q) &&
        !String(row.n_nfs ?? '').includes(q)
      ) return false
    }
    if (tipoFiltro !== 'Todos' && (row.tipo_cliente ?? '').toUpperCase() !== tipoFiltro) return false
    if (gradeFiltro !== 'Todos' && (row.grade ?? '').toUpperCase() !== gradeFiltro.toUpperCase()) return false
    if (condFiltro !== 'Todos') {
      const c = (row.cond ?? 'ok').toLowerCase()
      if (condFiltro === 'Vermelho' && c !== 'vermelho') return false
      if (condFiltro === 'Laranja'  && c !== 'laranja')  return false
      if (condFiltro === 'ok'       && c !== 'ok' && c !== '') return false
    }
    if (apenasRee && !row.reentrega) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const thCls = 'text-left text-[10px] text-muted font-medium px-2 py-1.5 border-b border-[0.5px] border-[var(--border-subtle)] bg-page whitespace-nowrap'
  const tdCls = 'px-2 py-[5px] border-b border-[0.5px] border-[var(--border-faint)] text-[11px]'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">Notas fiscais pendentes — {hoje}</span>
          {!loading && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cream text-muted font-medium">
              {filtered.length} NFs
            </span>
          )}
        </div>
      </CardHeader>

      {/* Filtros */}
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-2 border-b border-[0.5px] border-[var(--border-faint)]">
        <div className="flex-1 min-w-[160px] max-w-[220px]">
          <TextInput
            value={busca}
            onChange={v => { setBusca(v); setPage(0) }}
            placeholder="Buscar destinatário ou NF…"
          />
        </div>
        <Select value={tipoFiltro} onChange={v => { setTipoFiltro(v); setPage(0) }}>
          <option value="Todos">Tipo Cliente</option>
          <option value="CD">CD</option>
          <option value="REDE">REDE</option>
          <option value="VAREJO">VAREJO</option>
          <option value="COZINHA">COZINHA</option>
        </Select>
        <Select value={gradeFiltro} onChange={v => { setGradeFiltro(v); setPage(0) }}>
          <option value="Todos">Grade</option>
          <option value="DIARIO">DIARIO</option>
          <option value="DIAS ALTERNADOS">DIAS ALTERNADOS</option>
          <option value="TERÇA FEIRA">TERÇA FEIRA</option>
          <option value="QUARTA FEIRA">QUARTA FEIRA</option>
          <option value="QUINTA FEIRA">QUINTA FEIRA</option>
          <option value="SEXTA">SEXTA</option>
        </Select>
        <Select value={condFiltro} onChange={v => { setCondFiltro(v); setPage(0) }}>
          <option value="Todos">COND</option>
          <option value="Vermelho">Vermelho</option>
          <option value="Laranja">Laranja</option>
          <option value="ok">ok</option>
        </Select>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={apenasRee}
            onChange={e => { setApenasRee(e.target.checked); setPage(0) }}
            className="w-3.5 h-3.5 accent-primary"
          />
          <span className="text-[11px] text-muted whitespace-nowrap">Apenas Reentregas</span>
        </label>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted">
            <svg className="w-4 h-4 text-primary animate-spin-slow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round"/>
            </svg>
            <span className="text-[12px]">Carregando NFs...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted text-[12px]">
            {rows.length === 0
              ? 'Nenhuma NF pendente encontrada. Importe o SIAT para carregar as notas do dia.'
              : 'Nenhuma NF corresponde aos filtros selecionados.'}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>N NF</th>
                <th className={thCls}>Região</th>
                <th className={thCls}>Remetente</th>
                <th className={thCls}>Destinatário</th>
                <th className={thCls}>Bairro</th>
                <th className={thCls}>Município</th>
                <th className={thCls}>Tipo</th>
                <th className={thCls}>Peso (kg)</th>
                <th className={thCls}>COND</th>
                <th className={thCls}>GRADE</th>
                <th className={thCls}>Placa</th>
                <th className={thCls}>Ree</th>
                <th className={thCls}>SAC</th>
                <th className={thCls}>Obs</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((row, i) => (
                <tr key={row.id} className={i % 2 === 0 ? 'bg-white dark:bg-[#1E1E1C]' : 'bg-page'}>
                  <td className={cn(tdCls, 'font-mono whitespace-nowrap')}>{row.n_nfs ?? '—'}</td>
                  <td className={cn(tdCls, 'text-[10px] text-muted whitespace-nowrap')}>{row.regiao ?? '—'}</td>
                  <td className={cn(tdCls, 'max-w-[100px] truncate text-muted')} title={row.remetente ?? ''}>{row.remetente ?? '—'}</td>
                  <td className={cn(tdCls, 'max-w-[180px] truncate')} title={row.destinatario ?? ''}>{row.destinatario ?? '—'}</td>
                  <td className={cn(tdCls, 'max-w-[110px] truncate text-muted')}>{row.bairro_dest ?? row.bairro ?? '—'}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-muted')}>{row.municipio_dest ?? row.municipio ?? '—'}</td>
                  <td className={tdCls}><TipoBadge tipo={row.tipo_cliente} /></td>
                  <td className={cn(tdCls, 'whitespace-nowrap tabular-nums text-right')}>
                    {(row.peso_bruto ?? row.peso_kg) != null
                      ? String(row.peso_bruto ?? row.peso_kg)
                      : '—'}
                  </td>
                  <td className={tdCls}><CondBadge cond={row.cond} /></td>
                  <td className={cn(tdCls, 'text-[10px] text-muted whitespace-nowrap')}>{row.grade ?? '—'}</td>
                  <td className={cn(tdCls, 'font-mono text-[10px] whitespace-nowrap')}>{row.placa ?? '—'}</td>
                  <td className={cn(tdCls, 'text-center')}>
                    {row.reentrega && (
                      <span className="text-warn text-sm" title="Reentrega">↩</span>
                    )}
                  </td>
                  <td className={tdCls}>
                    {row.sac != null && Number(row.sac) > 0 && (
                      <span className="text-[10px] px-1.5 py-px rounded-full font-medium bg-warn-bg text-warn">
                        {row.sac}
                      </span>
                    )}
                  </td>
                  <td className={tdCls}>
                    <ObsBadge obs={row.observacao} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[0.5px] border-[var(--border-faint)]">
          <span className="text-[11px] text-muted">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex gap-1.5">
            <Btn size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>← Anterior</Btn>
            <Btn size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Próxima →</Btn>
          </div>
        </div>
      )}
    </Card>
  )
}
