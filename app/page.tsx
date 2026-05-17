'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Topbar, MetricCard, Card, CardHeader, Btn, ImportBar } from '@/components/ui'
import { ImportarSIATButton } from '@/components/ui/ImportarSIATButton'
import { SiatImportDialog } from '@/components/ui/SiatImportDialog'
import { MOCK_METRICS } from '@/lib/data'
import { formatPeso } from '@/lib/utils'
import { useImport } from '@/lib/hooks'

export default function Page() {
  const imp = useImport()
  const m   = MOCK_METRICS
  const rotasTotal = m.rotasRascunho + m.rotasPendentes + m.rotasAprovadas + m.rotasEnviadas
  const [importDialog, setImportDialog] = useState(false)

  return (
    <div>
      <div className="sticky top-0 z-10">
        <Topbar
          title="Dashboard"
          sub={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        >
          <ImportarSIATButton onClick={() => setImportDialog(true)} running={imp.running} />
          <Link href="/rotas"><Btn variant="primary">+ Gerar rotas com IA</Btn></Link>
        </Topbar>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3 pb-20">
        <ImportBar running={imp.running} step={imp.step} progress={imp.progress} result={imp.result} onClose={imp.reset} />

        {/* Alertas + Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div role="region" aria-label="Alertas de prioridade">
            <Card>
              <CardHeader>
                <span className="text-xs font-medium">Alertas de prioridade</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cond-err text-white font-medium">3 críticos</span>
              </CardHeader>
              {[
                { color: 'bg-cond-err',  text: `${m.nfsVermelho} NFs em vermelho sem rota atribuída`, meta: 'urgente' },
                { color: 'bg-cond-warn', text: 'Rota 30.12 Barreiro acima de 95% capacidade',         meta: 'peso' },
                { color: 'bg-cond-warn', text: '5 agendamentos para hoje sem veículo',                 meta: 'GRADE' },
              ].map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs border-b border-[0.5px] border-[var(--border-faint)]"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.color}`} />
                  <span className="flex-1">{a.text}</span>
                  <span className="text-[11px] text-muted shrink-0">{a.meta}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 px-3.5 py-1 border-b border-[0.5px] border-[var(--border-faint)]">
                <span className="text-[9px] text-muted uppercase tracking-[0.06em]">informações</span>
                <div className="flex-1 h-px bg-[var(--border-faint)]" />
              </div>
              <div className="flex items-center gap-2.5 px-3.5 py-2 text-xs opacity-60">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-cond-ok" />
                <span className="flex-1">DOUGLAS B confirmou disponibilidade</span>
                <span className="text-[11px] shrink-0">ok</span>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <span className="text-xs font-medium">Status das rotas — hoje</span>
              <span className="text-[11px] text-muted">{rotasTotal} total</span>
            </CardHeader>
            {[
              { dot: 'bg-subtle',    label: 'Rascunho',              value: m.rotasRascunho,  vc: 'text-base' },
              { dot: 'bg-cond-warn', label: 'Aguardando aprovação',  value: m.rotasPendentes, vc: 'text-warn-mid' },
              { dot: 'bg-cond-ok',   label: 'Aprovadas',             value: m.rotasAprovadas, vc: 'text-success' },
              { dot: 'bg-primary',   label: 'Enviadas ao motorista', value: m.rotasEnviadas,  vc: 'text-primary' },
            ].map((s, i, arr) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 text-xs ${i < arr.length - 1 ? 'border-b border-[0.5px] border-[var(--border-faint)]' : ''}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                <span className="w-[108px] shrink-0 text-[11px]">{s.label}</span>
                <div className="flex-1 h-[3px] bg-cream-hover rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.dot}`}
                    style={{ width: `${Math.round((s.value / rotasTotal) * 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-medium shrink-0 ml-2 ${s.vc}`}>{s.value}</span>
              </div>
            ))}
          </Card>
        </div>

        {/* Métricas */}
        <section aria-label="Métricas operacionais" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricCard
            label="NFs pendentes"
            value={imp.result ? imp.result.summary.totalNFs : m.totalNFs}
            sub={imp.result
              ? `${imp.result.summary.rotasUnicas} rotas · ${imp.result.summary.totalLinhas} linhas SIAT`
              : `última import. ${new Date(m.ultimaImportacao!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          />
          <MetricCard
            label="Peso total"
            value={imp.result ? `${imp.result.summary.pesoTotalToneladas}t` : formatPeso(m.pesoTotal)}
            sub={imp.result ? `${imp.result.summary.pesoTotalKg.toLocaleString('pt-BR')} kg` : undefined}
            capacity={!imp.result ? { used: m.pesoTotal, total: 71000, label: `${formatPeso(m.pesoTotal)} / 71t` } : undefined}
          />
          <MetricCard
            label="Veículos no SIAT"
            value={imp.result ? imp.result.summary.veiculosUnicos : m.veiculosDisponiveis}
            sub={imp.result ? `${imp.result.summary.motoristasUnicos} motoristas` : undefined}
            capacity={!imp.result ? { used: m.veiculosDisponiveis, total: m.veiculosTotal, label: `${m.veiculosDisponiveis} / ${m.veiculosTotal} ativos` } : undefined}
            valueColor="#3B6D11"
          />
          <MetricCard
            label="Rotas identificadas"
            value={imp.result ? imp.result.summary.rotasUnicas : m.rotasPendentes}
            sub={imp.result ? 'do SIAT — aguardando geração' : 'aguardando operador'}
            valueColor="#854F0B"
            className="border-l-2 border-l-[#854F0B]"
          />
        </section>

        {/* Tipo de cliente */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Resumo por tipo de cliente</span>
            <span className="text-[11px] text-muted">hoje</span>
          </CardHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {m.porTipoCliente.map((t, i, arr) => (
              <div
                key={t.tipo}
                className={`px-3.5 py-2.5 ${i < arr.length - 1 ? 'border-r border-[0.5px] border-[var(--border-faint)]' : ''}`}
              >
                <div className="text-[11px] text-muted mb-1">{t.tipo}</div>
                <div className={`text-[18px] font-medium ${t.tipo === 'Reentrega' ? 'text-warn-mid' : 'text-base'}`}>
                  {t.count}
                </div>
                <div className="text-[11px] text-muted">NFs</div>
              </div>
            ))}
          </div>
        </Card>

        {/* CTA */}
        <Link href="/rotas">
          <Btn style={{ width: '100%', justifyContent: 'center' }}>
            Ver {m.rotasPendentes} rotas pendentes →
          </Btn>
        </Link>
      </div>

      {importDialog && (
        <SiatImportDialog
          onClose={() => setImportDialog(false)}
          onConfirm={f => { setImportDialog(false); imp.runImport(f) }}
        />
      )}
    </div>
  )
}
