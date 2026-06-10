import { queryVeiculosDisponiveis } from '@/lib/siat-db'
import { seedDisponibilidadeHoje } from '@/lib/sync-frota'
import { exigirPermissao } from '@/lib/auth-server'

export async function POST() {
  const perm = await exigirPermissao('importar')
  if (perm instanceof Response) return perm
  try {
    const rows = await queryVeiculosDisponiveis()
    const seeded = await seedDisponibilidadeHoje(rows)
    return Response.json({ ok: true, seeded })
  } catch (err) {
    console.error('[seed-disponibilidade]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 502 })
  }
}
