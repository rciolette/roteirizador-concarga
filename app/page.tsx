'use client'
import { useMemo, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Topbar, MetricCard, Card, CardHeader, Btn, ImportBar, Select } from '@/components/ui'
import { ImportarSIATButton } from '@/components/ui/ImportarSIATButton'
import { SiatImportDialog } from '@/components/ui/SiatImportDialog'
import { NfsPendentesTable } from '@/components/ui/NfsPendentesTable'
import { formatPeso } from '@/lib/utils'
import { useAppData } from '@/components/providers/AppDataProvider'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import type { ClientType } from '@/types'

export default function Page() {
  const { nfImportState, importarNFs, dismissNFImport, rotas, veiculos, loadingRotas, nfsPendentes } = useAppData()
  const [importDialog, setImportDialog] = useState(false)

  // ── Filtros de NFs ──────────────────────────────────────────────────────────
  const [situacao,    setSituacao]    = useState('')
  const [dtAgend,     setDtAgend]     = useState('')
  const [dataEmissao, setDataEmissao] = useState('')

  type FilteredData = { totalNFs: number; pesoTotal: number; porTipoCliente: { tipo: ClientType; count: number }[]; loading: boolean }
  const [filteredData, setFilteredData] = useState<FilteredData | null>(null)

  const hasFilters = !!(situacao || dtAgend || dataEmissao)

  function clearFilters() { setSituacao(''); setDtAgend(''); setDataEmissao('') }

  useEffect(() => {
    if (!hasFilters) { setFilteredData(null); return }

    let cancelled = false
    setFilteredData(prev => prev ? { ...prev, loading: true } : { totalNFs: 0, pesoTotal: 0, porTipoCliente: [], loading: true })

    async function fetchFiltered() {
      const sb = getSupabaseBrowser()
      let q = sb
        .from('notas_fiscais')
        .select('id, tipo_cliente, peso_bruto, peso_kg, reentrega, sac, dt_agend, data_emissao, rota_id')

      switch (situacao) {
        case 'Aguardando':
        case 'S/Rota':
          q = q.is('rota_id', null); break
        case 'SAC aberto':
          q = q.not('sac', 'is', null).neq('sac', '').neq('sac', '0'); break
        case 'Reentrega':
          q = q.eq('reentrega', true); break
        case 'Agendada':
          q = q.not('dt_agend', 'is', null); break
      }

      if (dtAgend)     q = q.eq('dt_agend',     dtAgend)
      if (dataEmissao) q = q.eq('data_emissao', dataEmissao)

      type NfRow = { peso_bruto: number | null; peso_kg: number | null; tipo_cliente: string | null; reentrega: boolean | null }
      const { data } = await q.limit(5000)

      if (!cancelled && data) {
        const rows = data as NfRow[]
        const pesoTotal = rows.reduce((s: number, n: NfRow) => s + ((n.peso_bruto ?? n.peso_kg) ?? 0), 0)
        const up = (v: string | null) => (v ?? '').toUpperCase()
        const porTipoCliente: { tipo: ClientType; count: number }[] = [
          { tipo: 'CD',        count: rows.filter((n: NfRow) => up(n.tipo_cliente) === 'CD').length },
          { tipo: 'Rede',      count: rows.filter((n: NfRow) => up(n.tipo_cliente) === 'REDE').length },
          { tipo: 'Varejo',    count: rows.filter((n: NfRow) => up(n.tipo_cliente) === 'VAREJO').length },
          { tipo: 'Reentrega', count: rows.filter((n: NfRow) => n.reentrega === true || up(n.tipo_cliente) === 'REENTREGA').length },
        ]
        setFilteredData({ totalNFs: rows.length, pesoTotal, porTipoCliente, loading: false })
      }
    }

    fetchFiltered()
    return () => { cancelled = true }
  }, [situacao, dtAgend, dataEmissao, hasFilters])

  const summary = nfImportState.summary
  const importResult = summary
    ? { nfs: summary.totalNFs, peso: summary.pesoTotalToneladas, veiculos: summary.veiculosUnicos }
    : undefined

  // ── Métricas calculadas de dados reais ──────────────────────────────────────
  const metrics = useMemo(() => {
    const rotasRascunho  = rotas.filter(r => r.status === 'rascunho').length
    const rotasAguardando = rotas.filter(r => r.status === 'aguardando').length
    const rotasAprovadas = rotas.filter(r => r.status === 'aprovada').length
    const rotasEnviadas  = rotas.filter(r => r.status === 'enviada').length
    const totalNFs       = rotas.reduce((s, r) => s + r.qtdNotas, 0)
    const pesoTotal      = rotas.reduce((s, r) => s + r.pesoTotal, 0)

    const todasNFs = rotas.flatMap(r => r.notasFiscais)
    const nfsVermelho = todasNFs.filter(n => n.cond === 'vermelho').length
    const hoje = new Date().toISOString().slice(0, 10)
    const agendamentosHoje = todasNFs.filter(n => n.dataAgendamento === hoje).length

    const rotasCapacidadeAlta = rotas.filter(r => (r.ocupacaoPercent ?? 0) > 95)

    const porTipoCliente: { tipo: ClientType; count: number }[] = [
      { tipo: 'CD',        count: todasNFs.filter(n => n.tipoCliente === 'CD').length },
      { tipo: 'Rede',      count: todasNFs.filter(n => n.tipoCliente === 'Rede').length },
      { tipo: 'Varejo',    count: todasNFs.filter(n => n.tipoCliente === 'Varejo').length },
      { tipo: 'Reentrega', count: todasNFs.filter(n => n.tipoCliente === 'Reentrega').length },
    ]

    const veiculosDisponiveis = veiculos.filter(v => v.disponivel_hoje).length
    const veiculosTotal       = veiculos.length

    return {
      rotasRascunho, rotasAguardando, rotasAprovadas, rotasEnviadas,
      totalNFs, pesoTotal, nfsVermelho, agendamentosHoje,
      rotasCapacidadeAlta, porTipoCliente,
      veiculosDisponiveis, veiculosTotal,
    }
  }, [rotas, veiculos])

  const rotasTotal = metrics.rotasRascunho + metrics.rotasAguardando + metrics.rotasAprovadas + metrics.rotasEnviadas

  // ── Popover de veículos ─────────────────────────────────────────────────────
  const [showVeiculos, setShowVeiculos] = useState(false)
  const veiculosRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showVeiculos) return
    function handleClick(e: MouseEvent) {
      if (veiculosRef.current && !veiculosRef.current.contains(e.target as Node)) {
        setShowVeiculos(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showVeiculos])

  // ── Alertas dinâmicos ───────────────────────────────────────────────────────
  const alertas = useMemo(() => {
    const list: { color: string; text: string; meta: string }[] = []

    // NFs pendentes (ainda não roteirizadas) com cond derivado do SIAT
    const pendentesVermelho = nfsPendentes.filter(n => n.cond === 'vermelho').length
    const pendentesLaranja  = nfsPendentes.filter(n => n.cond === 'laranja').length
    if (pendentesVermelho > 0)
      list.push({ color: 'bg-cond-err', text: `${pendentesVermelho} NFs pendentes com agendamento vencido ou hoje`, meta: 'urgente' })
    if (pendentesLaranja > 0)
      list.push({ color: 'bg-cond-warn', text: `${pendentesLaranja} NFs pendentes com SAC aberto ou reentrega`, meta: 'atenção' })

    // Alertas de rotas já geradas
    if (metrics.nfsVermelho > 0)
      list.push({ color: 'bg-cond-err', text: `${metrics.nfsVermelho} NFs vermelho em rotas geradas`, meta: 'rotas' })
    for (const r of metrics.rotasCapacidadeAlta)
      list.push({ color: 'bg-cond-warn', text: `Rota ${r.codigoRota} acima de ${r.ocupacaoPercent}% capacidade`, meta: 'peso' })
    if (metrics.agendamentosHoje > 0)
      list.push({ color: 'bg-cond-warn', text: `${metrics.agendamentosHoje} NFs com agendamento hoje em rotas`, meta: 'GRADE' })

    return list
  }, [metrics, nfsPendentes])

  const criticos = alertas.filter(a => a.color === 'bg-cond-err').length

  return (
    <div>
      <div className="sticky top-0 z-10">
        <Topbar
          title="Dashboard"
          sub={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        >
          <ImportarSIATButton onClick={() => setImportDialog(true)} running={nfImportState.running} />
        </Topbar>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3 pb-20">
        <ImportBar running={nfImportState.running} step={nfImportState.step} progress={nfImportState.progress} result={importResult} onClose={dismissNFImport} />

        {/* Barra de filtros */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-muted uppercase tracking-[0.05em] pl-0.5">Situação</span>
            <Select value={situacao} onChange={setSituacao} className="w-auto min-w-[150px]">
              <option value="">Todas</option>
              <option value="Aguardando">Aguardando</option>
              <option value="SAC aberto">SAC aberto</option>
              <option value="Reentrega">Reentrega</option>
              <option value="Agendada">Agendada</option>
              <option value="S/Rota">S/Rota</option>
              <option value="Em análise">Em análise</option>
              <option value="Devolver ao fornecedor">Devolver ao fornecedor</option>
            </Select>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-muted uppercase tracking-[0.05em] pl-0.5">Data de Entrega</span>
            <input
              type="date"
              value={dtAgend}
              onChange={e => setDtAgend(e.target.value)}
              className="h-8 border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-2 text-xs font-sans outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-muted uppercase tracking-[0.05em] pl-0.5">Data de Emissão</span>
            <input
              type="date"
              value={dataEmissao}
              onChange={e => setDataEmissao(e.target.value)}
              className="h-8 border border-[0.5px] border-[var(--border-input)] rounded-lg bg-page px-2 text-xs font-sans outline-none focus:border-primary transition-colors"
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="h-8 px-2 text-[11px] text-muted hover:text-danger transition-colors cursor-pointer bg-transparent border-none self-end"
            >
              Limpar filtros
            </button>
          )}
          {hasFilters && filteredData?.loading && (
            <svg className="w-3.5 h-3.5 text-primary animate-spin-slow self-end mb-2" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round"/>
            </svg>
          )}
        </div>

        {/* Alertas + Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div role="region" aria-label="Alertas de prioridade">
            <Card>
              <CardHeader>
                <span className="text-xs font-medium">Alertas de prioridade</span>
                {criticos > 0
                  ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-cond-err text-white font-medium">{criticos} crítico{criticos > 1 ? 's' : ''}</span>
                  : <span className="text-[11px] px-2 py-0.5 rounded-full bg-cond-ok text-white font-medium">sem alertas</span>
                }
              </CardHeader>
              {alertas.length > 0 ? alertas.map((a, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3.5 py-2 text-xs border-b border-[0.5px] border-[var(--border-faint)]">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.color}`} />
                  <span className="flex-1">{a.text}</span>
                  <span className="text-[11px] text-muted shrink-0">{a.meta}</span>
                </div>
              )) : (
                <div className="px-3.5 py-3 text-xs text-muted">
                  {loadingRotas ? 'Carregando dados...' : 'Nenhum alerta para hoje.'}
                </div>
              )}
              <div className="flex items-center gap-2 px-3.5 py-1 border-b border-[0.5px] border-[var(--border-faint)]">
                <span className="text-[9px] text-muted uppercase tracking-[0.06em]">veículos</span>
                <div className="flex-1 h-px bg-[var(--border-faint)]" />
              </div>
              <div className="flex items-center gap-2.5 px-3.5 py-2 text-xs opacity-70">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${metrics.veiculosDisponiveis > 0 ? 'bg-cond-ok' : 'bg-subtle'}`} />
                <span className="flex-1">{metrics.veiculosDisponiveis} veículos disponíveis hoje</span>
                <span className="text-[11px] shrink-0">{metrics.veiculosTotal} total</span>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <span className="text-xs font-medium">Status das rotas — hoje</span>
              <span className="text-[11px] text-muted">{rotasTotal} total</span>
            </CardHeader>
            {rotasTotal === 0 ? (
              <div className="px-3.5 py-6 text-xs text-muted text-center">
                {loadingRotas ? 'Carregando rotas...' : 'Nenhuma rota para hoje.'}
              </div>
            ) : [
              { dot: 'bg-subtle',    label: 'Rascunho',              value: metrics.rotasRascunho,   vc: 'text-base' },
              { dot: 'bg-cond-warn', label: 'Aguardando aprovação',  value: metrics.rotasAguardando, vc: 'text-warn-mid' },
              { dot: 'bg-cond-ok',   label: 'Aprovadas',             value: metrics.rotasAprovadas,  vc: 'text-success' },
              { dot: 'bg-primary',   label: 'Enviadas ao motorista', value: metrics.rotasEnviadas,   vc: 'text-primary' },
            ].map((s, i, arr) => (
              <div key={i} className={`flex items-center gap-2.5 px-3.5 py-2.5 text-xs ${i < arr.length - 1 ? 'border-b border-[0.5px] border-[var(--border-faint)]' : ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                <span className="w-[108px] shrink-0 text-[11px]">{s.label}</span>
                <div className="flex-1 h-[3px] bg-cream-hover rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.dot}`} style={{ width: `${Math.round((s.value / rotasTotal) * 100)}%` }} />
                </div>
                <span className={`text-xs font-medium shrink-0 ml-2 ${s.vc}`}>{s.value}</span>
              </div>
            ))}
          </Card>
        </div>

        {/* Métricas */}
        <section aria-label="Métricas operacionais" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricCard
            label={hasFilters ? 'NFs filtradas' : 'NFs no dia'}
            value={hasFilters && filteredData ? filteredData.totalNFs : (summary ? summary.totalNFs : metrics.totalNFs)}
            sub={hasFilters
              ? (filteredData?.loading ? 'consultando...' : `${filteredData?.totalNFs ?? 0} resultado${(filteredData?.totalNFs ?? 0) !== 1 ? 's' : ''}`)
              : (summary
                ? `${summary.rotasUnicas} rotas · ${summary.totalLinhas} linhas SIAT`
                : metrics.totalNFs > 0 ? `${rotas.length} rotas geradas` : 'sem dados SIAT hoje')}
          />
          <MetricCard
            label={hasFilters ? 'Peso filtrado' : 'Peso total'}
            value={hasFilters && filteredData ? formatPeso(filteredData.pesoTotal) : (summary ? `${summary.pesoTotalToneladas}t` : formatPeso(metrics.pesoTotal))}
            sub={hasFilters
              ? (filteredData?.loading ? 'consultando...' : `${(filteredData?.pesoTotal ?? 0).toLocaleString('pt-BR')} kg`)
              : (summary
                ? `${summary.pesoTotalKg.toLocaleString('pt-BR')} kg`
                : metrics.pesoTotal > 0 ? `${metrics.pesoTotal.toLocaleString('pt-BR')} kg` : undefined)}
            gradientBar={hasFilters ? (filteredData?.pesoTotal ?? 0) > 0 : metrics.pesoTotal > 0}
          />
          <div ref={veiculosRef} className="relative">
            <div onClick={() => setShowVeiculos(v => !v)} className="cursor-pointer">
              <MetricCard
                label="Veículos disponíveis"
                value={metrics.veiculosDisponiveis}
                sub={`${metrics.veiculosTotal} na frota · clique para ver`}
                capacity={metrics.veiculosTotal > 0
                  ? { used: metrics.veiculosDisponiveis, total: metrics.veiculosTotal, label: `${metrics.veiculosDisponiveis} / ${metrics.veiculosTotal} hoje` }
                  : undefined}
                valueColor="#3B6D11"
              />
            </div>
            {showVeiculos && (
              <div className="absolute top-full left-0 mt-1 z-50 w-[340px] rounded-xl border border-[0.5px] border-[var(--border-subtle)] bg-page shadow-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-[0.5px] border-[var(--border-faint)] flex items-center justify-between">
                  <span className="text-[11px] font-medium">Veículos da frota</span>
                  <button onClick={() => setShowVeiculos(false)} className="text-muted hover:text-base transition-colors text-xs leading-none cursor-pointer bg-transparent border-none">✕</button>
                </div>
                {veiculos.length === 0 ? (
                  <div className="px-3 py-4 text-[11px] text-muted text-center">
                    Nenhum veículo cadastrado. Configure em{' '}
                    <Link href="/configuracoes" className="text-primary underline" onClick={() => setShowVeiculos(false)}>Configurações</Link>.
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-page sticky top-0">
                          <th className="px-2.5 py-1.5 text-left text-[10px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)]">Placa</th>
                          <th className="px-2.5 py-1.5 text-left text-[10px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)]">Tipo</th>
                          <th className="px-2.5 py-1.5 text-left text-[10px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)]">Motorista</th>
                          <th className="px-2.5 py-1.5 text-right text-[10px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)]">Cap.(kg)</th>
                          <th className="px-2.5 py-1.5 text-center text-[10px] text-muted font-medium border-b border-[0.5px] border-[var(--border-subtle)]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {veiculos.map((v, i) => {
                          const statusDot =
                            v.status === 'disponivel'   ? 'bg-cond-ok' :
                            v.status === 'manutencao'   ? 'bg-cond-err' :
                                                          'bg-subtle'
                          const statusLabel =
                            v.status === 'disponivel'   ? 'Disp.' :
                            v.status === 'manutencao'   ? 'Manu.' :
                                                          'Indisp.'
                          return (
                            <tr key={v.id} className={i % 2 === 0 ? 'bg-white dark:bg-[#1E1E1C]' : 'bg-page'}>
                              <td className="px-2.5 py-1.5 font-mono whitespace-nowrap border-b border-[0.5px] border-[var(--border-faint)]">{v.placa}</td>
                              <td className="px-2.5 py-1.5 text-muted border-b border-[0.5px] border-[var(--border-faint)]">{v.tipo}</td>
                              <td className="px-2.5 py-1.5 max-w-[90px] truncate text-muted border-b border-[0.5px] border-[var(--border-faint)]" title={v.motoristaNome ?? ''}>{v.motoristaNome ?? '—'}</td>
                              <td className="px-2.5 py-1.5 text-right tabular-nums border-b border-[0.5px] border-[var(--border-faint)]">{v.capacidadeKg.toLocaleString('pt-BR')}</td>
                              <td className="px-2.5 py-1.5 border-b border-[0.5px] border-[var(--border-faint)]">
                                <span className="flex items-center justify-center gap-1">
                                  <span className={`w-[5px] h-[5px] rounded-full shrink-0 ${statusDot}`} />
                                  <span className="text-[10px] text-muted">{statusLabel}</span>
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
          <MetricCard
            label="Rotas aguardando"
            value={metrics.rotasAguardando}
            sub={metrics.rotasAguardando > 0 ? 'aguardando aprovação' : rotas.length > 0 ? 'todas processadas' : 'sem rotas hoje'}
            valueColor="#854F0B"
            className="border-t-2 border-t-primary"
            cta={{ label: 'Revisar →', href: '/rotas/acoes' }}
          />
        </section>

        {/* Tipo de cliente */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Resumo por tipo de cliente</span>
            <span className="text-[11px] text-muted">{hasFilters ? 'filtrado' : 'hoje'}</span>
          </CardHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {(hasFilters && filteredData ? filteredData.porTipoCliente : metrics.porTipoCliente).map((t, i, arr) => (
              <div key={t.tipo} className={`px-3.5 py-2.5 ${i < arr.length - 1 ? 'border-r border-[0.5px] border-[var(--border-faint)]' : ''}`}>
                <div className="text-[11px] text-muted mb-1">{t.tipo}</div>
                <div className={`text-[18px] font-medium ${filteredData?.loading ? 'opacity-40' : ''} ${t.tipo === 'Reentrega' ? 'text-warn-mid' : 'text-base'}`}>{t.count}</div>
                <div className="text-[11px] text-muted">NFs</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Notas fiscais pendentes */}
        <NfsPendentesTable />

        {/* CTA */}
        <Link href={metrics.rotasAguardando > 0 ? '/rotas/acoes' : '/rotas'}>
          <Btn style={{ width: '100%', justifyContent: 'center' }}>
            {metrics.rotasAguardando > 0
              ? `Ver ${metrics.rotasAguardando} rotas aguardando aprovação →`
              : 'Ver rotas do dia →'}
          </Btn>
        </Link>
      </div>

      {importDialog && (
        <SiatImportDialog
          onClose={() => setImportDialog(false)}
          onConfirm={f => { setImportDialog(false); importarNFs(f) }}
        />
      )}
    </div>
  )
}
