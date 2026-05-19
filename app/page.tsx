'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Topbar, MetricCard, Card, CardHeader, Btn, ImportBar } from '@/components/ui'
import { ImportarSIATButton } from '@/components/ui/ImportarSIATButton'
import { SiatImportDialog } from '@/components/ui/SiatImportDialog'
import { formatPeso } from '@/lib/utils'
import { useAppData } from '@/components/providers/AppDataProvider'
import type { ClientType } from '@/types'

export default function Page() {
  const { nfImportState, importarNFs, dismissNFImport, rotas, veiculos, loadingRotas, nfsPendentes } = useAppData()
  const [importDialog, setImportDialog] = useState(false)

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
            label="NFs no dia"
            value={summary ? summary.totalNFs : metrics.totalNFs}
            sub={summary
              ? `${summary.rotasUnicas} rotas · ${summary.totalLinhas} linhas SIAT`
              : metrics.totalNFs > 0 ? `${rotas.length} rotas geradas` : 'sem dados SIAT hoje'}
          />
          <MetricCard
            label="Peso total"
            value={summary ? `${summary.pesoTotalToneladas}t` : formatPeso(metrics.pesoTotal)}
            sub={summary
              ? `${summary.pesoTotalKg.toLocaleString('pt-BR')} kg`
              : metrics.pesoTotal > 0 ? `${metrics.pesoTotal.toLocaleString('pt-BR')} kg` : undefined}
            gradientBar={metrics.pesoTotal > 0}
          />
          <MetricCard
            label="Veículos disponíveis"
            value={metrics.veiculosDisponiveis}
            sub={`${metrics.veiculosTotal} na frota`}
            capacity={metrics.veiculosTotal > 0
              ? { used: metrics.veiculosDisponiveis, total: metrics.veiculosTotal, label: `${metrics.veiculosDisponiveis} / ${metrics.veiculosTotal} hoje` }
              : undefined}
            valueColor="#3B6D11"
          />
          <MetricCard
            label="Rotas aguardando"
            value={metrics.rotasAguardando}
            sub={metrics.rotasAguardando > 0 ? 'aguardando aprovação' : rotas.length > 0 ? 'todas processadas' : 'sem rotas hoje'}
            valueColor="#854F0B"
            className="border-t-2 border-t-primary"
            cta={{ label: 'Revisar →', href: '/rotas' }}
          />
        </section>

        {/* Tipo de cliente */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Resumo por tipo de cliente</span>
            <span className="text-[11px] text-muted">hoje</span>
          </CardHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {metrics.porTipoCliente.map((t, i, arr) => (
              <div key={t.tipo} className={`px-3.5 py-2.5 ${i < arr.length - 1 ? 'border-r border-[0.5px] border-[var(--border-faint)]' : ''}`}>
                <div className="text-[11px] text-muted mb-1">{t.tipo}</div>
                <div className={`text-[18px] font-medium ${t.tipo === 'Reentrega' ? 'text-warn-mid' : 'text-base'}`}>{t.count}</div>
                <div className="text-[11px] text-muted">NFs</div>
              </div>
            ))}
          </div>
        </Card>

        {/* CTA */}
        <Link href="/rotas">
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
