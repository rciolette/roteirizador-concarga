import type { Rota, RetornoGerarRotas, ClientType, RouteStatus, NotaFiscal } from '@/types'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

const sb = () => getSupabaseBrowser()

export type Prioridade = 'padrao' | 'vermelho' | 'menos-veiculos' | 'menor-distancia'

export async function carregarRotasSupabase(data: string): Promise<Rota[]> {
  const { data: rows, error } = await sb()
    .from('rotas')
    .select(`id, data, codigo_rota, regiao, status, motorista_id, motorista_nome, motorista_celular, veiculo_id, veiculo_placa, peso_total, ocupacao_percent, qtd_notas, link_maps, alertas, criado_em, enviado_em, notas_fiscais(id, n_nfs, destinatario, municipio, bairro, endereco, cep, peso_kg, tipo_cliente, cond, grade, agendamento, hora_agendamento, reentrega, sac, observacao, sequencia)`)
    .eq('data', data)
    .order('criado_em', { ascending: false })

  if (error) throw error

  return (rows as Record<string, unknown>[] ?? []).map((r: Record<string, unknown>) => {
    const nfs: NotaFiscal[] = ((r.notas_fiscais as Record<string, unknown>[]) ?? []).map(nf => ({
      id:              nf.id as string,
      numnfs:          String(nf.n_nfs),
      destinatario:    (nf.destinatario as string) ?? '—',
      municipio:       (nf.municipio   as string) ?? '—',
      bairro:          (nf.bairro      as string) ?? '—',
      endereco:        (nf.endereco    as string) ?? '—',
      cep:             (nf.cep         as string) ?? '',
      peso:            (nf.peso_kg     as number) ?? 0,
      qtd:             1,
      tipoCliente:     ((nf.tipo_cliente as ClientType) ?? 'Varejo'),
      cond:            ((nf.cond as 'ok' | 'laranja' | 'vermelho') ?? 'ok'),
      grade:           (nf.grade       as string) ?? '',
      rota:            r.codigo_rota as string,
      dataEmissao:     '',
      dataAgendamento: (nf.agendamento      as string) ?? undefined,
      horaAgendamento: (nf.hora_agendamento as string) ?? undefined,
      observacao:      (nf.observacao       as string) ?? undefined,
      sac:             (nf.sac              as string) ?? undefined,
      indRee:          (nf.reentrega        as boolean) ?? false,
      sequencia:       (nf.sequencia        as number) ?? undefined,
    }))

    return {
      id:              r.id as string,
      data:            r.data as string,
      codigoRota:      r.codigo_rota as string,
      regiao:          r.regiao as string,
      status:          r.status as RouteStatus,
      motoristaId:     (r.motorista_id as string) ?? undefined,
      veiculoId:       (r.veiculo_id   as string) ?? undefined,
      pesoTotal:       (r.peso_total as number)       ?? 0,
      ocupacaoPercent: (r.ocupacao_percent as number) ?? 0,
      qtdNotas:        (r.qtd_notas as number)        ?? 0,
      linkMaps:        (r.link_maps as string)        ?? undefined,
      alertas:         (r.alertas  as string[])       ?? [],
      createdAt:       r.criado_em as string,
      enviadoEm:       (r.enviado_em as string)       ?? undefined,
      motorista:       r.motorista_nome ? {
        id:       (r.motorista_id as string) ?? `m-${r.motorista_nome}`,
        nome:     r.motorista_nome as string,
        telefone: (r.motorista_celular as string) ?? '',
        sigla:    (r.motorista_nome as string).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        status:   'disponivel' as const,
      } : undefined,
      veiculo: r.veiculo_placa ? {
        id:           (r.veiculo_id as string) ?? `v-${r.veiculo_placa}`,
        placa:        r.veiculo_placa as string,
        modelo:       r.veiculo_placa as string,
        tipo:         'VUC' as const,
        capacidadeKg: 1500,
        sigla:        (r.veiculo_placa as string).replace(/\W/g, '').slice(-4),
        status:       'disponivel' as const,
      } : undefined,
      notasFiscais: nfs,
      nfsConcatenadas: nfs.map(n => n.numnfs).join(';') || undefined,
    }
  })
}

export interface MotoristaPayload {
  nome:      string
  telefone?: string
  placa?:    string
  status:    'disponivel' | 'ausente'
}

export interface VeiculoDisponivel {
  placa:             string
  tipo:              string
  capacidadeKg:      number
  motoristaNome?:    string
  motoristaCelular?: string
}

export interface GerarRotasPayload {
  dataInicio:          string
  dataFim:             string
  observacoes:         string
  motoristas:          MotoristaPayload[]
  veiculosDisponiveis: VeiculoDisponivel[]
  // Complemento da seleção do operador. O WF-B monta a frota a partir do
  // Supabase e aplica estas duas listas como exclusão — é por elas que a
  // escolha feita no diálogo chega ao roteirizador.
  veiculosBloqueados:  string[]
  motoristasAusentes:  string[]
  restricoesExtras:    string
  prioridade:          Prioridade
  instrucaoGlobal:     string
  instrucoesPorRota:   { codigoRota: string; instrucao: string }[]
  pesos:               { fiorino: number; vuc: number; tresQuartos: number; truck: number; carreta: number }
  grades:              { nome: string; seg: boolean; ter: boolean; qua: boolean; qui: boolean; sex: boolean; sab: boolean }[]
  horarios:            { inicioRoteirizacao: string; envioMotorista: string; saidaVeiculos: string }
  notasFiscais?:       unknown[]
}

export interface AceiteGerarRotas {
  /** true = o WF-B aceitou o job e vai gravar as rotas no Supabase depois. */
  aceito: boolean
  /** Presente apenas no modo síncrono legado. */
  rotas?: unknown[]
  [chave: string]: unknown
}

export async function webhookGerarRotas(payload: GerarRotasPayload): Promise<AceiteGerarRotas> {
  const res = await fetch('/api/gerar-rotas', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<AceiteGerarRotas>
}

export class GeracaoTimeout extends Error {
  constructor(minutos: number) {
    super(`A geração passou de ${minutos} min sem devolver rotas`)
    this.name = 'GeracaoTimeout'
  }
}

export interface AguardarOpts {
  /** Desiste depois disso. A roteirização costuma levar 1–3 min. */
  timeoutMs?:   number
  intervaloMs?: number
  /** Chamado a cada ciclo com os segundos decorridos e as rotas já vistas. */
  onTick?:      (segundos: number, encontradas: number) => void
}

/**
 * Espera o WF-B terminar de gravar as rotas do dia.
 *
 * Compara contra os IDs que já existiam antes do disparo em vez de comparar
 * timestamps: o `criado_em` é gerado pelo Postgres e o relógio do navegador
 * pode estar adiantado, o que faria rotas legítimas serem descartadas.
 *
 * Como o WF-B insere uma rota por vez, só devolve quando a contagem para de
 * crescer entre dois ciclos — assim o painel não mostra um resultado parcial.
 */
export async function aguardarRotasGeradas(
  data:      string,
  idsAntes:  Set<string>,
  opts:      AguardarOpts = {},
): Promise<Rota[]> {
  const timeoutMs   = opts.timeoutMs   ?? 10 * 60_000
  const intervaloMs = opts.intervaloMs ?? 5_000
  const inicio      = Date.now()

  let anterior = 0

  while (Date.now() - inicio < timeoutMs) {
    await new Promise(r => setTimeout(r, intervaloMs))

    let novas: Rota[] = []
    try {
      const todas = await carregarRotasSupabase(data)
      novas = todas.filter(r => !idsAntes.has(r.id))
    } catch {
      // Falha de rede num ciclo não aborta a espera — tenta de novo.
      continue
    }

    opts.onTick?.(Math.round((Date.now() - inicio) / 1000), novas.length)

    if (novas.length > 0 && novas.length === anterior) return novas
    anterior = novas.length
  }

  throw new GeracaoTimeout(Math.round(timeoutMs / 60_000))
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

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)
}

export async function salvarRotasSupabase(rotas: Rota[], data: string): Promise<Rota[]> {
  const resultado: Rota[] = []

  for (const rota of rotas) {
    const { data: row, error } = await sb()
      .from('rotas')
      .insert({
        data,
        codigo_rota:       rota.codigoRota,
        regiao:            rota.regiao,
        status:            rota.status,
        veiculo_placa:     rota.veiculo?.placa ?? null,
        motorista_nome:    rota.motorista?.nome ?? null,
        motorista_celular: rota.motorista?.telefone ?? null,
        motorista_id:      isUuid(rota.motoristaId) ? rota.motoristaId : null,
        veiculo_id:        isUuid(rota.veiculoId)   ? rota.veiculoId   : null,
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
      await sb().from('notas_fiscais').insert(
        rota.notasFiscais.map((nf, i) => {
          const agenda   = nf.dataAgendamento || null
          const emissao  = nf.dataEmissao && nf.dataEmissao !== '—' ? nf.dataEmissao : null
          const cepVal   = nf.cep && nf.cep !== '—' ? nf.cep : null
          return {
            rota_id:          row.id,
            n_nfs:            parseInt(nf.numnfs, 10),
            destinatario:     nf.destinatario,
            municipio:        nf.municipio,
            municipio_dest:   nf.municipio,
            bairro:           nf.bairro,
            bairro_dest:      nf.bairro,
            endereco:         nf.endereco,
            endereco_dest:    nf.endereco,
            cep:              cepVal,
            cep_dest:         cepVal,
            peso_kg:          nf.peso,
            peso_bruto:       nf.peso,
            tipo_cliente:     nf.tipoCliente,
            cond:             nf.cond,
            grade:            nf.grade || null,
            agendamento:      agenda,
            dt_agend:         agenda,
            hora_agendamento: nf.horaAgendamento || null,
            reentrega:        nf.indRee,
            ind_reentrega:    nf.indRee ? 1 : 0,
            sac:              nf.sac || null,
            observacao:       nf.observacao || null,
            sequencia:        i + 1,
            data_emissao:     emissao,
            placa:            rota.veiculo?.placa ?? null,
            regiao:           rota.regiao ?? null,
          }
        })
      )
    }

    resultado.push({ ...rota, id: row.id, data })
  }

  return resultado
}

// ── Edição manual da rota na aprovação (Marcelo, 17/08) ──────────────────────

/** Recalcula peso_total e qtd_notas de uma rota a partir das NFs vinculadas. */
async function recalcularRota(rotaId: string): Promise<void> {
  const { data: nfs } = await sb()
    .from('notas_fiscais')
    .select('peso_kg')
    .eq('rota_id', rotaId)
  const lista = (nfs ?? []) as { peso_kg: number | null }[]
  await sb().from('rotas').update({
    peso_total:    lista.reduce((acc, n) => acc + (n.peso_kg ?? 0), 0),
    qtd_notas:     lista.length,
    atualizado_em: new Date().toISOString(),
  }).eq('id', rotaId)
}

/** Remove uma NF da rota (a nota volta a ficar sem rota — não é excluída do SIAT). */
export async function removerNotaDaRota(rotaId: string, nfId: string): Promise<void> {
  const { error } = await sb().from('notas_fiscais').delete().eq('id', nfId).eq('rota_id', rotaId)
  if (error) throw new Error(error.message)
  await recalcularRota(rotaId)
}

/** Move uma NF desta rota para outra rota do dia. */
export async function moverNotaParaRota(origemId: string, destinoId: string, nfId: string): Promise<void> {
  const { error } = await sb()
    .from('notas_fiscais')
    .update({ rota_id: destinoId })
    .eq('id', nfId)
    .eq('rota_id', origemId)
  if (error) throw new Error(error.message)
  await recalcularRota(origemId)
  await recalcularRota(destinoId)
}

/** Define/troca o veículo e o motorista de uma rota (etapa de aprovação). */
export async function definirVeiculoDaRota(rotaId: string, veiculo: {
  veiculoId?:        string
  placa:             string
  motoristaNome?:    string
  motoristaCelular?: string
}): Promise<void> {
  const { error } = await sb().from('rotas').update({
    veiculo_id:        isUuid(veiculo.veiculoId) ? veiculo.veiculoId : null,
    veiculo_placa:     veiculo.placa || null,
    motorista_nome:    veiculo.motoristaNome    ?? null,
    motorista_celular: veiculo.motoristaCelular ?? null,
    atualizado_em:     new Date().toISOString(),
  }).eq('id', rotaId)
  if (error) throw new Error(error.message)
}

export async function salvarNfsNaoAlocadas(nfs: number[], data: string, motivo: string): Promise<void> {
  if (nfs.length === 0) return
  await sb().from('nfs_nao_alocadas').insert(
    nfs.map(n => ({ data, n_nfs: n, motivo }))
  )
}

export async function atualizarStatusRota(id: string, status: RouteStatus, observacao?: string): Promise<void> {
  const updates: Record<string, unknown> = { status, atualizado_em: new Date().toISOString() }
  if (status === 'aprovada') updates.aprovado_em = new Date().toISOString()
  if (status === 'enviada')  updates.enviado_em  = new Date().toISOString()
  if (observacao)            updates.observacoes = observacao

  await sb().from('rotas').update(updates).eq('id', id)
  await sb().from('historico_rotas').insert({
    rota_id:     id,
    status_para: status,
    usuario:     'operador',
  })
}

export async function reprocessarRota(rotaId: string): Promise<void> {
  const hoje = new Date().toISOString().slice(0, 10)
  const res = await fetch('/api/gerar-rotas', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      rotaId,
      dataInicio:        hoje,
      dataFim:           hoje,
      observacoes:       `Reprocessar rota ${rotaId}`,
      motoristas:        [],
      veiculosDisponiveis: [],
      veiculosBloqueados:  [],
      motoristasAusentes:  [],
      restricoesExtras:  '',
      prioridade:        'padrao',
      instrucaoGlobal:   '',
      instrucoesPorRota: [],
      pesos:             { fiorino: 700, vuc: 1200, tresQuartos: 2500, truck: 5000, carreta: 12000 },
      grades:            [],
      horarios:          { inicioRoteirizacao: '06:00', envioMotorista: '07:00', saidaVeiculos: '08:00' },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
  }
}

export async function limparRascunhosDoDia(data: string): Promise<void> {
  // Remove rotas rascunho do dia antes de re-importar.
  // Deleta notas_fiscais primeiro para satisfazer a FK, depois as rotas.
  // Rotas aprovadas/enviadas não são tocadas.
  const { data: rotasDia } = await sb()
    .from('rotas')
    .select('id')
    .eq('data', data)
    .eq('status', 'rascunho')

  const ids = ((rotasDia ?? []) as { id: string }[]).map(r => r.id)
  if (ids.length === 0) return

  await sb().from('notas_fiscais').delete().in('rota_id', ids)
  await sb().from('historico_rotas').delete().in('rota_id', ids)
  await sb().from('rotas').delete().in('id', ids)
}

export async function carregarRotasPorPeriodo(dataInicio: string, dataFim: string): Promise<Rota[]> {
  const { data: rows, error } = await sb()
    .from('rotas')
    .select(`id, data, codigo_rota, regiao, status, motorista_id, motorista_nome, motorista_celular, veiculo_id, veiculo_placa, peso_total, ocupacao_percent, qtd_notas, link_maps, alertas, criado_em, enviado_em, notas_fiscais(id, n_nfs, destinatario, municipio, bairro, endereco, cep, peso_kg, tipo_cliente, cond, grade, agendamento, hora_agendamento, reentrega, sac, observacao, sequencia)`)
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false })

  if (error) throw error

  return (rows as Record<string, unknown>[] ?? []).map((r: Record<string, unknown>) => {
    const nfs: NotaFiscal[] = ((r.notas_fiscais as Record<string, unknown>[]) ?? []).map(nf => ({
      id:              nf.id as string,
      numnfs:          String(nf.n_nfs),
      destinatario:    (nf.destinatario as string) ?? '—',
      municipio:       (nf.municipio   as string) ?? '—',
      bairro:          (nf.bairro      as string) ?? '—',
      endereco:        (nf.endereco    as string) ?? '—',
      cep:             (nf.cep         as string) ?? '',
      peso:            (nf.peso_kg     as number) ?? 0,
      qtd:             1,
      tipoCliente:     ((nf.tipo_cliente as ClientType) ?? 'Varejo'),
      cond:            ((nf.cond as 'ok' | 'laranja' | 'vermelho') ?? 'ok'),
      grade:           (nf.grade       as string) ?? '',
      rota:            r.codigo_rota as string,
      dataEmissao:     '',
      dataAgendamento: (nf.agendamento      as string) ?? undefined,
      horaAgendamento: (nf.hora_agendamento as string) ?? undefined,
      observacao:      (nf.observacao       as string) ?? undefined,
      sac:             (nf.sac              as string) ?? undefined,
      indRee:          (nf.reentrega        as boolean) ?? false,
      sequencia:       (nf.sequencia        as number) ?? undefined,
    }))

    return {
      id:              r.id as string,
      data:            r.data as string,
      codigoRota:      r.codigo_rota as string,
      regiao:          r.regiao as string,
      status:          r.status as RouteStatus,
      motoristaId:     (r.motorista_id as string) ?? undefined,
      veiculoId:       (r.veiculo_id   as string) ?? undefined,
      pesoTotal:       (r.peso_total as number)       ?? 0,
      ocupacaoPercent: (r.ocupacao_percent as number) ?? 0,
      qtdNotas:        (r.qtd_notas as number)        ?? 0,
      linkMaps:        (r.link_maps as string)        ?? undefined,
      alertas:         (r.alertas  as string[])       ?? [],
      createdAt:       r.criado_em as string,
      enviadoEm:       (r.enviado_em as string)       ?? undefined,
      motorista:       r.motorista_nome ? {
        id:       (r.motorista_id as string) ?? `m-${r.motorista_nome}`,
        nome:     r.motorista_nome as string,
        telefone: (r.motorista_celular as string) ?? '',
        sigla:    (r.motorista_nome as string).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
        status:   'disponivel' as const,
      } : undefined,
      veiculo: r.veiculo_placa ? {
        id:           (r.veiculo_id as string) ?? `v-${r.veiculo_placa}`,
        placa:        r.veiculo_placa as string,
        modelo:       r.veiculo_placa as string,
        tipo:         'VUC' as const,
        capacidadeKg: 1500,
        sigla:        (r.veiculo_placa as string).replace(/\W/g, '').slice(-4),
        status:       'disponivel' as const,
      } : undefined,
      notasFiscais: nfs,
      nfsConcatenadas: nfs.map(n => n.numnfs).join(';') || undefined,
    }
  })
}
