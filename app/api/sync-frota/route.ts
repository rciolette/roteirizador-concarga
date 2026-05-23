import { syncFrotaDoSiat } from '@/lib/sync-frota'
import { exigirPermissao } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const auth = await exigirPermissao('importar')
    if (auth instanceof Response) return auth

    const { motoristas, veiculos } = await syncFrotaDoSiat()
    return Response.json({ ok: true, motoristas, veiculos })
  } catch (err) {
    const error = err instanceof Error ? err.message : 'erro interno'
    console.error('[sync-frota]', error)
    return Response.json({ error }, { status: 502 })
  }
}
