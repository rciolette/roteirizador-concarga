import { syncFrotaDoSiat } from '@/lib/sync-frota'
import { exigirPermissao } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function executar() {
  const { motoristas, veiculos } = await syncFrotaDoSiat()
  return Response.json({ ok: true, motoristas, veiculos })
}

function erro(err: unknown) {
  const msg = err instanceof Error ? err.message : 'erro interno'
  console.error('[sync-frota]', msg)
  return Response.json({ error: msg }, { status: 502 })
}

// Disparo manual pelo painel — exige sessão com permissão de importar.
export async function POST() {
  try {
    const auth = await exigirPermissao('importar')
    if (auth instanceof Response) return auth
    return await executar()
  } catch (err) {
    return erro(err)
  }
}

// Disparo pelo Vercel Cron. O cron não tem sessão, então a autorização é por
// segredo: a Vercel injeta `Authorization: Bearer $CRON_SECRET` automaticamente
// quando a env var CRON_SECRET existe no projeto. Sem CRON_SECRET configurado a
// rota fica fechada — não cai para "aberta".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET não configurado' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }
  try {
    return await executar()
  } catch (err) {
    return erro(err)
  }
}
