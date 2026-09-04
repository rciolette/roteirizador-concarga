import { exigirPermissao, getAdminClient } from '@/lib/auth-server'
import { queryEnderecoFilial } from '@/lib/siat-db'
import { registrarLog } from '@/lib/log-atividade'

// GET /api/empresa — retorna os dados da empresa
export async function GET() {
  const auth = await exigirPermissao('empresa')
  if (auth instanceof Response) return auth

  const sb = getAdminClient()
  const { data, error } = await sb
    .from('empresa')
    .select('razao_social, nome_fantasia, cnpj, endereco, cidade, uf, telefone, email, logo_url')
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // O endereço da empresa é a ORIGEM das rotas. Como o cadastro do painel
  // nasce vazio, buscamos a filial no SIAT quando ele não está preenchido —
  // sem isso o mapa começava na primeira entrega, sem o trecho CD → 1ª parada.
  let empresa = data ?? null
  if (!empresa?.endereco) {
    try {
      const filial = await queryEnderecoFilial()
      if (filial) {
        empresa = {
          ...(empresa ?? {}),
          razao_social: empresa?.razao_social ?? filial.nome,
          endereco: [filial.endereco, filial.bairro].filter(Boolean).join(', '),
          cidade:   filial.municipio,
          uf:       filial.uf,
        } as typeof empresa
      }
    } catch {
      // SIAT fora do ar não pode derrubar a tela de configurações
    }
  }

  return Response.json({ empresa })
}

// PATCH /api/empresa — atualiza os dados da empresa
export async function PATCH(req: Request) {
  const auth = await exigirPermissao('empresa')
  if (auth instanceof Response) return auth

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'payload inválido' }, { status: 400 })

  const campos = ['razao_social', 'nome_fantasia', 'cnpj', 'endereco', 'cidade', 'uf', 'telefone', 'email', 'logo_url']
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
  for (const c of campos) {
    if (body[c] !== undefined) updates[c] = body[c] || null
  }

  const sb = getAdminClient()

  // Garante que a linha singleton existe antes de atualizar
  await sb.from('empresa').upsert({ ...updates, singleton: true }, { onConflict: 'singleton' })

  await registrarLog({
    sessao: auth, evento: 'editar', area: 'empresa',
    descricao: 'Atualizou dados da empresa',
    dados: updates, req,
  })

  return Response.json({ ok: true })
}
