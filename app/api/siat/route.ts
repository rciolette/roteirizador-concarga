import { queryNFsPendentes, queryVeiculosDisponiveis } from '@/lib/siat-db'
import { normalizeSiatPayload } from '@/lib/siat'
import { exigirPermissao } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await exigirPermissao('importar')
    if (auth instanceof Response) return auth

    const [nfs, veiculos] = await Promise.all([
      queryNFsPendentes(),
      queryVeiculosDisponiveis(),
    ])

    const rows = normalizeSiatPayload([...nfs, ...veiculos])
    return Response.json(rows)

  } catch (err) {
    const error = err instanceof Error ? err.message : 'erro interno'
    console.error('[siat-direct]', error)
    return Response.json({ error }, { status: 502 })
  }
}
