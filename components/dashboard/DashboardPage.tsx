'use client'
import Link from 'next/link'
import { Topbar, MetricCard, Card, CardHeader, Btn, ImportBar } from '@/components/ui'
import { MOCK_METRICS, formatPeso } from '@/lib/data'
import { useImport } from '@/lib/useImport'

export default function DashboardPage() {
  const imp = useImport()
  const m = MOCK_METRICS

  return (
    <>
      <Topbar
        title="Dashboard"
        sub={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      >
        <Btn variant="teal" onClick={imp.runImport} disabled={imp.running}>
          <svg style={{ width: 13, height: 13 }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
          </svg>
          {imp.running ? 'Importando...' : 'Importar SIAT'}
        </Btn>
        <Link href="/configuracoes"><Btn>Configurações</Btn></Link>
        <Link href="/rotas"><Btn variant="primary">+ Gerar rotas</Btn></Link>
      </Topbar>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        <ImportBar running={imp.running} step={imp.step} progress={imp.progress} result={imp.result} onClose={imp.reset} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
          <MetricCard label="NFs pendentes" value={imp.result ? imp.result.nfs : m.totalNFs}
            sub={`última import. ${new Date(m.ultimaImportacao!).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`} />
          <MetricCard label="Peso total" value={imp.result ? `${imp.result.peso}t` : formatPeso(m.pesoTotal)} sub="capacidade: 71t" />
          <MetricCard label="Veículos disponíveis" value={imp.result ? imp.result.veiculos : m.veiculosDisponiveis}
            sub={`de ${m.veiculosTotal} ativos`} valueColor="#3B6D11" />
          <MetricCard label="Rotas p/ aprovar" value={m.rotasPendentes} sub="aguardando operador" valueColor="#854F0B" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <Card>
            <CardHeader>
              <span style={{ fontSize: 12, fontWeight: 500 }}>Alertas de prioridade</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#FAEEDA', color: '#633806', fontWeight: 500 }}>3 críticos</span>
            </CardHeader>
            {[
              { color: '#E24B4A', text: `${m.nfsVermelho} NFs em vermelho sem rota atribuída`, meta: 'urgente' },
              { color: '#EF9F27', text: 'Rota 30.12 Barreiro acima de 95% capacidade', meta: 'peso' },
              { color: '#EF9F27', text: '5 agendamentos para hoje sem veículo', meta: 'GRADE' },
              { color: '#639922', text: 'DOUGLAS B confirmou disponibilidade', meta: 'ok' },
            ].map((a, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', fontSize:12, borderBottom: i<3?'0.5px solid rgba(44,44,42,0.08)':'none' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:a.color, flexShrink:0 }} />
                <span style={{ flex:1 }}>{a.text}</span>
                <span style={{ fontSize:10, color:'#888780' }}>{a.meta}</span>
              </div>
            ))}
          </Card>

          <Card>
            <CardHeader><span style={{ fontSize:12, fontWeight:500 }}>Status das rotas — hoje</span></CardHeader>
            {[
              { color:'#888780', label:'Rascunho', value:m.rotasRascunho, vc:'#2C2C2A' },
              { color:'#EF9F27', label:'Aguardando aprovação', value:m.rotasPendentes, vc:'#854F0B' },
              { color:'#639922', label:'Aprovadas', value:m.rotasAprovadas, vc:'#3B6D11' },
              { color:'#185FA5', label:'Enviadas ao motorista', value:m.rotasEnviadas, vc:'#185FA5' },
            ].map((s,i,arr) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', fontSize:12, borderBottom:i<arr.length-1?'0.5px solid rgba(44,44,42,0.08)':'none' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:s.color, flexShrink:0 }} />
                <span style={{ flex:1 }}>{s.label}</span>
                <span style={{ fontSize:12, fontWeight:500, color:s.vc }}>{s.value} rotas</span>
              </div>
            ))}
          </Card>
        </div>

        <Card>
          <CardHeader>
            <span style={{ fontSize:12, fontWeight:500 }}>Resumo por tipo de cliente</span>
            <span style={{ fontSize:11, color:'#888780' }}>hoje</span>
          </CardHeader>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))' }}>
            {m.porTipoCliente.map((t,i,arr) => (
              <div key={t.tipo} style={{ padding:'10px 14px', borderRight:i<arr.length-1?'0.5px solid rgba(44,44,42,0.08)':'none' }}>
                <div style={{ fontSize:10, color:'#888780', marginBottom:4 }}>{t.tipo}</div>
                <div style={{ fontSize:18, fontWeight:500, color:t.tipo==='Reentrega'?'#854F0B':'#2C2C2A' }}>{t.count}</div>
                <div style={{ fontSize:10, color:'#888780' }}>NFs</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display:'flex', gap:8 }}>
          <Link href="/rotas" style={{ flex:1, textDecoration:'none' }}>
            <Btn variant="primary" style={{ width:'100%', justifyContent:'center' }}>+ Gerar rotas com IA</Btn>
          </Link>
          <Link href="/rotas" style={{ flex:1, textDecoration:'none' }}>
            <Btn style={{ width:'100%', justifyContent:'center' }}>Ver rotas pendentes ({m.rotasPendentes})</Btn>
          </Link>
        </div>

      </div>
    </>
  )
}
