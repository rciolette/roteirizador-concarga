import type { Rota, RetornoGerarRotas, ClientType, RouteStatus } from '@/types'
import { supabase } from '@/lib/supabase'

export type Prioridade = 'padrao' | 'vermelho' | 'menos-veiculos' | 'menor-distancia'

export interface MotoristaPayload {
  nome:      string
  telefone?: string
  placa?:    string
  status:    'disponivel' | 'ausente'
}

export interface GerarRotasPayload {
  data:               string
  observacoes:        string
  motoristas:         MotoristaPayload[]
  veiculosBloqueados: string[]
  restricoesExtras:   string
  prioridade:         Prioridade
}

export async function webhookGerarRotas(payload: GerarRotasPayload): Promise<unknown> {
  const res = await fetch('/api/gerar-rotas', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function mapRetornoGerarRotas(retorno: RetornoGerarRotas): Rota[] {
  const now = new Date().toISOString()
  return retorno.rotas.map((r, i) => {
    const capacidadeKg = r.ocupacaoPercent > 0
      ? Math.round(r.pesoTotal / (r.ocupacaoPercent / 100))
      : 1500
    return {
      id: `ia-${r.codigoRota}-${i}`,
      data: now.slice(0, 10),
      codigoRota: r.codigoRota,
      regiao: r.regiao,
      status: 'aguardando' as const,
      pesoTotal: r.pesoTotal,
      ocupacaoPercent: r.ocupacaoPercent,
      qtdNotas: r.qtdNotas,
      alertas: r.alertas,
      linkMaps: r.linkMaps || undefined,
      createdAt: now,
      motorista: r.motorista ? {
        id: `m-${r.motorista.replace(/\s+/g, '-')}`,
        nome: r.motorista,
        telefone: r.celular,
        sigla: r.motorista.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        status: 'disponivel' as const,
      } : undefined,
      veiculo: r.veiculo ? {
        id: `v-${r.veiculo}`,
        placa: r.veiculo,
        modelo: r.veiculo,
        tipo: 'VUC' as const,
        capacidadeKg,
        sigla: r.veiculo,
        status: 'disponivel' as const,
      } : undefined,
      notasFiscais: r.notas.map((n, j) => ({
        id: `nf-${r.codigoRota}-${j}`,
        numnfs: String(n.numnfs),
        destinatario: n.destinatario,
        municipio: n.municipio,
        bairro: n.bairro,
        endereco: n.endereco,
        cep: '',
        peso: n.pesoKg,
        qtd: 1,
        tipoCliente: (n.tipoCliente as ClientType) || 'Varejo',
        cond: n.cond,
        grade: '',
        rota: r.codigoRota,
        dataEmissao: now.slice(0, 10),
        dataAgendamento: n.agendamento || undefined,
        observacao: n.observacao || undefined,
        sac: n.sac || undefined,
        indRee: n.reentrega,
      })),
      nfsConcatenadas: r.notas.map(n => n.numnfs).join(';'),
    }
  })
}

export async function salvarRotasSupabase(rotas: Rota[], data: string): Promise<Rota[]> {
  const resultado: Rota[] = []

  for (const rota of rotas) {
    const { data: row, error } = await supabase
      .from('rotas')
      .insert({
        data,
        codigo_rota:       rota.codigoRota,
        regiao:            rota.regiao,
        status:            rota.status,
        veiculo_placa:     rota.veiculo?.placa ?? null,
        motorista_nome:    rota.motorista?.nome ?? null,
        motorista_celular: rota.motorista?.telefone ?? null,
        peso_total:        rota.pesoTotal,
        ocupacao_percent:  rota.ocupacaoPercent ?? 0,
        qtd_notas:         rota.qtdNotas,
        link_maps:         rota.linkMaps ?? null,
        alertas:           rota.alertas ?? [],
      })
      .select('id')
      .single()

    if (error || !row) {
      resultado.push(rota)
      continue
    }

    if (rota.notasFiscais.length > 0) {
      await supabase.from('notas_fiscais').insert(
        rota.notasFiscais.map((nf, i) => ({
          rota_id:          row.id,
          n_nfs:            parseInt(nf.numnfs, 10),
          destinatario:     nf.destinatario,
          municipio:        nf.municipio,
          bairro:           nf.bairro,
          endereco:         nf.endereco,
          cep:              nf.cep || null,
          peso_kg:          nf.peso,
          tipo_cliente:     nf.tipoCliente,
          cond:             nf.cond,
          grade:            nf.grade || null,
          agendamento:      nf.dataAgendamento || null,
          hora_agendamento: nf.horaAgendamento || null,
          reentrega:        nf.indRee,
          sac:              nf.sac || null,
          observacao:       nf.observacao || null,
          sequencia:        i + 1,
        }))
      )
    }

    resultado.push({ ...rota, id: row.id, data })
  }

  return resultado
}

export async function salvarNfsNaoAlocadas(nfs: number[], data: string, motivo: string): Promise<void> {
  if (nfs.length === 0) return
  await supabase.from('nfs_nao_alocadas').insert(
    nfs.map(n => ({ data, n_nfs: n, motivo }))
  )
}

export async function atualizarStatusRota(id: string, status: RouteStatus): Promise<void> {
  const updates: Record<string, unknown> = { status, atualizado_em: new Date().toISOString() }
  if (status === 'aprovada') updates.aprovado_em = new Date().toISOString()
  if (status === 'enviada')  updates.enviado_em  = new Date().toISOString()

  await supabase.from('rotas').update(updates).eq('id', id)
  await supabase.from('historico_rotas').insert({
    rota_id:     id,
    status_para: status,
    usuario:     'operador',
  })
}

export interface EnviarMotoristaPayload {
  rotaId:           string
  codigoRota:       string
  motoristaNome:    string
  motoristaTel:     string
  linkMaps?:        string
  nfsConcatenadas?: string
  qtdNotas:         number
  pesoTotal:        number
}

export async function webhookEnviarMotorista(payload: EnviarMotoristaPayload): Promise<void> {
  const res = await fetch('/api/enviar-motorista', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
}

export async function limparRascunhosDoDia(data: string): Promise<void> {
  // Remove rotas rascunho do dia antes de re-importar.
  // Deleta notas_fiscais primeiro para satisfazer a FK, depois as rotas.
  // Rotas aprovadas/enviadas não são tocadas.
  const { data: rotasDia } = await supabase
    .from('rotas')
    .select('id')
    .eq('data', data)
    .eq('status', 'rascunho')

  const ids = (rotasDia ?? []).map(r => r.id)
  if (ids.length === 0) return

  await supabase.from('notas_fiscais').delete().in('rota_id', ids)
  await supabase.from('historico_rotas').delete().in('rota_id', ids)
  await supabase.from('rotas').delete().in('id', ids)
}
