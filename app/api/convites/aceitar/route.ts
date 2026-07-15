import { getSessaoServidor, getAdminClient } from '@/lib/auth-server'
import { registrarLog } from '@/lib/log-atividade'

// POST /api/convites/aceitar — marca como aceito o convite pendente do usuário logado.
// Chamado por /aceitar-convite (fluxo de link de e-mail) após definir a senha — esse fluxo,
// ao contrário de /api/ativar-conta, nunca atualizava a tabela `convites`.
export async function POST() {
  const sessao = await getSessaoServidor()
  if (!sessao) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  const sb = getAdminClient()
  const { data, error } = await sb
    .from('convites')
    .update({ status: 'aceito', aceito_em: new Date().toISOString() })
    .eq('user_id', sessao.userId)
    .eq('status', 'pendente')
    .select('id')
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (data) {
    await registrarLog({
      sessao, evento: 'editar', area: 'convites', entidadeId: data.id,
      descricao: 'Aceitou convite (definiu senha via link de e-mail)',
    })
  }

  return Response.json({ ok: true })
}
