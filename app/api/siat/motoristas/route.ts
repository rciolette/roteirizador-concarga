import { queryMotoristasAtividade } from '@/lib/siat-db'
import { exigirPermissao } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

// Atividade recente dos motoristas, direto do SIAT. Alimenta a sugestão de
// motoristas no diálogo "Gerar rotas".
export async function GET(req: Request) {
  try {
    const auth = await exigirPermissao('importar')
    if (auth instanceof Response) return auth

    const raw  = new URL(req.url).searchParams.get('dias')
    const dias = Math.min(Math.max(Number(raw) || 90, 1), 365)

    return Response.json(await queryMotoristasAtividade(dias))

  } catch (err) {
    const error = err instanceof Error ? err.message : 'erro interno'
    console.error('[siat-motoristas]', error)
    return Response.json({ error }, { status: 502 })
  }
}
