'use client'
import Link from 'next/link'
import { Topbar, MetricCard, Card, CardHeader, Btn, ImportBar } from '@/components/ui'
import { MOCK_METRICS, formatPeso } from '@/lib/data'
import { useImport } from '@/lib/useImport'

export default function DashboardPage() {
  const imp = useImport()
  const m   = MOCK_METRICS

  return (
    <>
      <Topbar
        title="Dashboard"
        sub={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      >
        <Btn variant="teal" onClick={imp.runImport} disabled={imp.running}>
          <svg className="w-[13px] h-[13px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
          </svg>
          {imp.running ? 'Importando...' : 'Importar SIAT'}
        </Btn>
        <Link href="/configuracoes"><Btn>Configurações</Btn></Link>
        <Link href="/rotas"><Btn variant="primary">+ Gerar rotas</Btn></Link>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-4 px-5 flex flex-col gap-3">
        <ImportBar running={imp.running} step={imp.step} progress={imp.progress} result={imp.result} onClose={imp.reset} />

        {/* Métricas */}
        <div className="grid grid-cols-4 gap-2">
          <MetricCard
            label="NFs pendentes"
            value={imp.result ? imp.result.nfs : m.totalNFs}
            sub={`última import. ${new Date(m.ultimaImportacao!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          />
          <MetricCard
            label="Peso total"
            value={imp.result ? `${imp.result.peso}t` : formatPeso(m.pesoTotal)}
            sub="capacidade: 71t"
          />
          <MetricCard
            label="Veículos disponíveis"
            value={imp.result ? imp.result.veiculos : m.veiculosDisponiveis}
            sub={`de ${m.veiculosTotal} ativos`}
            valueColor="#3B6D11"
          />
          <MetricCard
            label="Rotas p/ aprovar"
            value={m.rotasPendentes}
            sub="aguardando operador"
            valueColor="#854F0B"
          />
        </div>

        {/* Alertas + Status */}
        <div className="grid grid-cols-2 gap-2.5">
          <Card>
            <CardHeader>
              <span className="text-xs font-medium">Alertas de prioridade</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-warn-bg text-warn font-medium">3 críticos</span>
            </CardHeader>
            {[
              { color: 'bg-cond-err',  text: `${m.nfsVermelho} NFs em vermelho sem rota atribuída`, meta: 'urgente' },
              { color: 'bg-cond-warn', text: 'Rota 30.12 Barreiro acima de 95% capacidade',         meta: 'peso' },
              { color: 'bg-cond-warn', text: '5 agendamentos para hoje sem veículo',                 meta: 'GRADE' },
              { color: 'bg-cond-ok',   text: 'DOUGLAS B confirmou disponibilidade',                 meta: 'ok' },
            ].map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs border-b border-[0.5px] border-[rgba(44,44,42,0.07)] last:border-0"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.color}`} />
                <span className="flex-1">{a.text}</span>
                <span className="text-[10px] text-muted shrink-0">{a.meta}</span>
              </div>
            ))}
          </Card>

          <Card>
            <CardHeader>
              <span className="text-xs font-medium">Status das rotas — hoje</span>
            </CardHeader>
            {[
              { dot: 'bg-subtle',    label: 'Rascunho',              value: m.rotasRascunho,  vc: 'text-base' },
              { dot: 'bg-cond-warn', label: 'Aguardando aprovação',  value: m.rotasPendentes, vc: 'text-warn-mid' },
              { dot: 'bg-cond-ok',   label: 'Aprovadas',             value: m.rotasAprovadas, vc: 'text-success' },
              { dot: 'bg-primary',   label: 'Enviadas ao motorista', value: m.rotasEnviadas,  vc: 'text-primary' },
            ].map((s, i, arr) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 px-3.5 py-2 text-xs ${i < arr.length - 1 ? 'border-b border-[0.5px] border-[rgba(44,44,42,0.07)]' : ''}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                <span className="flex-1">{s.label}</span>
                <span className={`text-xs font-medium ${s.vc}`}>{s.value} rotas</span>
              </div>
            ))}
          </Card>
        </div>

        {/* Tipo de cliente */}
        <Card>
          <CardHeader>
            <span className="text-xs font-medium">Resumo por tipo de cliente</span>
            <span className="text-[11px] text-muted">hoje</span>
          </CardHeader>
          <div className="grid grid-cols-4">
            {m.porTipoCliente.map((t, i, arr) => (
              <div
                key={t.tipo}
                className={`px-3.5 py-2.5 ${i < arr.length - 1 ? 'border-r border-[0.5px] border-[rgba(44,44,42,0.07)]' : ''}`}
              >
                <div className="text-[10px] text-muted mb-1">{t.tipo}</div>
                <div className={`text-[18px] font-medium ${t.tipo === 'Reentrega' ? 'text-warn-mid' : 'text-base'}`}>
                  {t.count}
                </div>
                <div className="text-[10px] text-muted">NFs</div>
              </div>
            ))}
          </div>
        </Card>

        {/* CTAs */}
        <div className="flex gap-2">
          <Link href="/rotas" className="flex-1">
            <Btn variant="primary" style={{ width: '100%', justifyContent: 'center' }}>+ Gerar rotas com IA</Btn>
          </Link>
          <Link href="/rotas" className="flex-1">
            <Btn style={{ width: '100%', justifyContent: 'center' }}>Ver rotas pendentes ({m.rotasPendentes})</Btn>
          </Link>
        </div>
      </div>
    </>
  )
}
