import type { Rota, ClientType, RouteStatus, NotaFiscal, Veiculo } from '@/types'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { tipoVeiculoFromSiat, capKgFromSiat } from '@/lib/siat'
import { rotuloVeiculo } from '@/lib/utils'

const sb = () => getSupabaseBrowser()


// ── Leitura de rotas ──────────────────────────────────────────────────────────
// Um único SELECT/mapper para o dia e para o período: antes eram duas cópias
// que caíam em 'VUC'/1500 kg e sigla derivada da placa. Agora tipo, capacidade
// e sigla vêm do banco (rotas.veiculo_tipo / motorista_sigla + joins).

const SELECT_ROTA = `id, data, codigo_rota, regiao, status, motorista_id, motorista_nome, motorista_celular, motorista_sigla,
  veiculo_id, veiculo_placa, veiculo_tipo, peso_total, volume_total, caixas_total, ocupacao_percent, qtd_notas, link_maps, alertas,
  observacoes, criado_em, aprovado_em, enviado_em,
  veiculos!rotas_veiculo_id_fkey(capacidade_kg, tipo_veiculo, volume_m3, modelo, motoristas(sigla)),
  notas_fiscais!notas_fiscais_rota_id_fkey(id, n_nfs, destinatario, municipio, bairro, endereco, numero, uf, cep, peso_kg, volume_m3, quantidade, valor_nf,
    tipo_cliente, cond, grade, regiao, rota_entrega, agendamento, hora_agendamento, reentrega, ind_reentrega, sac, solucao_sac,
    observacao, restricoes, restricao_desc, remetente, cnpj_destinatario, data_emissao, sequencia)`

function mapNota(nf: Record<string, unknown>, codigoRota: string, veiculoRotulo?: string): NotaFiscal {
  const str = (k: string) => (nf[k] as string | null) ?? undefined
  return {
    id:              nf.id as string,
    numnfs:          String(nf.n_nfs),
    destinatario:    (nf.destinatario as string) ?? '—',
    municipio:       (nf.municipio   as string) ?? '—',
    bairro:          (nf.bairro      as string) ?? '—',
    endereco:        (nf.endereco    as string) ?? '—',
    numero:          str('numero'),
    uf:              str('uf'),
    cep:             (nf.cep         as string) ?? '',
    peso:            Number(nf.peso_kg ?? 0),
    volume:          nf.volume_m3 != null ? Number(nf.volume_m3) : undefined,
    qtd:             (nf.quantidade as number) ?? 1,
    valor:           nf.valor_nf != null ? Number(nf.valor_nf) : undefined,
    tipoCliente:     ((nf.tipo_cliente as ClientType) ?? 'Varejo'),
    cond:            ((nf.cond as 'ok' | 'laranja' | 'vermelho') ?? 'ok'),
    grade:           (nf.grade       as string) ?? '',
    regiao:          str('regiao'),
    rota:            (nf.rota_entrega as string) || codigoRota,
    dataEmissao:     (nf.data_emissao as string) ?? '',
    dataAgendamento: str('agendamento'),
    horaAgendamento: str('hora_agendamento'),
    observacao:      str('observacao'),
    restricoes:      str('restricao_desc') ?? str('restricoes'),
    sac:             str('sac'),
    solucaoSac:      str('solucao_sac'),
    remetente:       str('remetente'),
    cnpjDestinatario: str('cnpj_destinatario'),
    indRee:          (nf.reentrega as boolean) ?? false,
    indiceReentrega: (nf.ind_reentrega as number) ?? undefined,
    sequencia:       (nf.sequencia as number) ?? undefined,
    veiculoRotulo,
  }
}

function mapRota(r: Record<string, unknown>): Rota {
  const vj  = r.veiculos as { capacidade_kg?: number | string | null; tipo_veiculo?: string | null; volume_m3?: number | null; modelo?: string | null; motoristas?: { sigla?: string | null } | null } | null
  const tipoSiat = vj?.tipo_veiculo ?? null
  const tipo  = (r.veiculo_tipo as Veiculo['tipo'] | null) ?? tipoVeiculoFromSiat(tipoSiat)
  const sigla = (r.motorista_sigla as string | null) || vj?.motoristas?.sigla || '—'
  // Capacidade: a mesma que o banco usou para calcular ocupacao_percent
  // (veiculo_capacidade_efetiva) — evita 700 no card e 800 no banco.
  const pesoTotal = Number(r.peso_total ?? 0)
  const ocup = Number(r.ocupacao_percent ?? 0)
  const capDb = pesoTotal > 0 && ocup > 0 ? Math.round(pesoTotal / ocup * 100) : null
  const veiculo: Veiculo | undefined = r.veiculo_placa ? {
    id:           (r.veiculo_id as string) ?? `v-${r.veiculo_placa}`,
    placa:        r.veiculo_placa as string,
    modelo:       vj?.modelo ?? (r.veiculo_placa as string),
    tipo,
    tipoSiat:     tipoSiat ?? undefined,
    capacidadeKg: capDb ?? capKgFromSiat(tipoSiat, vj?.capacidade_kg != null ? Number(vj.capacidade_kg) : null),
    volumeCubado: vj?.volume_m3 != null ? Number(vj.volume_m3) : undefined,
    sigla,
    status:       'disponivel' as const,
    motoristaNome:    (r.motorista_nome as string) ?? undefined,
    motoristaCelular: (r.motorista_celular as string) ?? undefined,
  } : undefined
  const rotulo = veiculo ? rotuloVeiculo(veiculo) : undefined
  const nfs = ((r.notas_fiscais as Record<string, unknown>[]) ?? [])
    .slice()
    .sort((a, b) => ((a.sequencia as number) ?? 0) - ((b.sequencia as number) ?? 0))
    .map(nf => mapNota(nf, r.codigo_rota as string, rotulo))

  return {
    id:              r.id as string,
    data:            r.data as string,
    codigoRota:      r.codigo_rota as string,
    regiao:          r.regiao as string,
    status:          r.status as RouteStatus,
    motoristaId:     (r.motorista_id as string) ?? undefined,
    veiculoId:       (r.veiculo_id   as string) ?? undefined,
    pesoTotal:       Number(r.peso_total ?? 0),
    volumeTotal:     r.volume_total != null ? Number(r.volume_total) : undefined,
    caixasTotal:     (r.caixas_total as number) ?? undefined,
    ocupacaoPercent: Number(r.ocupacao_percent ?? 0),
    qtdNotas:        (r.qtd_notas as number) ?? 0,
    linkMaps:        (r.link_maps as string) ?? undefined,
    alertas:         (r.alertas  as string[]) ?? [],
    createdAt:       r.criado_em as string,
    enviadoEm:       (r.enviado_em as string) ?? undefined,
    motorista:       r.motorista_nome ? {
      id:       (r.motorista_id as string) ?? `m-${r.motorista_nome}`,
      nome:     r.motorista_nome as string,
      telefone: (r.motorista_celular as string) ?? '',
      sigla,
      status:   'disponivel' as const,
    } : undefined,
    veiculo,
    notasFiscais:    nfs,
    nfsConcatenadas: [...new Set(nfs.map(n => n.numnfs))].join(';') || undefined,
  }
}

export async function carregarRotasSupabase(data: string): Promise<Rota[]> {
  const { data: rows, error } = await sb()
    .from('rotas')
    .select(SELECT_ROTA)
    .eq('data', data)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return ((rows ?? []) as unknown as Record<string, unknown>[]).map(mapRota)
}

export async function carregarRotasPorPeriodo(dataInicio: string, dataFim: string): Promise<Rota[]> {
  const { data: rows, error } = await sb()
    .from('rotas')
    .select(SELECT_ROTA)
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false })
  if (error) throw error
  return ((rows ?? []) as unknown as Record<string, unknown>[]).map(mapRota)
}

// ── Cargas excluídas no período ───────────────────────────────────────────────
// O histórico sobrevive à exclusão (Raphael, 14/10): rota_excluir grava uma
// linha 'excluida' em historico_rotas com código/data/placa/qtd congelados, e
// a FK vira NULL quando a rota some. Isto lê essa trilha.

export interface CargaExcluida {
  id:        string
  codigo:    string | null
  data:      string | null
  placa:     string | null
  qtdNotas:  number | null
  statusDe:  string | null
  usuario:   string | null
  excluidaEm: string
}

export async function listarCargasExcluidas(dataInicio: string, dataFim: string): Promise<CargaExcluida[]> {
  const { data: rows, error } = await sb()
    .from('historico_rotas')
    .select('id, codigo_rota, data, veiculo_placa, qtd_notas, status_de, usuario, criado_em')
    .eq('status_para', 'excluida')
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return ((rows ?? []) as Record<string, unknown>[]).map(r => ({
    id:         String(r.id),
    codigo:     (r.codigo_rota as string) ?? null,
    data:       (r.data as string) ?? null,
    placa:      (r.veiculo_placa as string) ?? null,
    qtdNotas:   (r.qtd_notas as number) ?? null,
    statusDe:   (r.status_de as string) ?? null,
    usuario:    (r.usuario as string) ?? null,
    excluidaEm: String(r.criado_em),
  }))
}

// ── Veículos livres do dia (RPC veiculos_livres) ──────────────────────────────
// Só veículos ativos, disponíveis na data, com motorista e SEM rota ativa.
// O banco é a fonte: a lista já reflete reservas feitas por outras sessões.

export interface VeiculoLivre {
  id:               string
  placa:            string
  sigla:            string
  tipo:             Veiculo['tipo']
  tipoSiat:         string | null
  modelo:           string | null
  capacidadeKg:     number
  volumeM3:         number | null
  motoristaId:      string | null
  motoristaNome:    string | null
  motoristaCelular: string | null
  situacaoSiat:     string | null
  /** `Placa | Sigla | Tipo` pronto para exibir. */
  rotulo:           string
}

export async function listarVeiculosLivres(data: string): Promise<VeiculoLivre[]> {
  const { data: rows, error } = await sb().rpc('veiculos_livres', { p_data: data })
  if (error) throw new Error(error.message)
  return ((rows ?? []) as Record<string, unknown>[]).map(r => {
    const base = {
      id:               r.id as string,
      placa:            r.placa as string,
      sigla:            (r.sigla as string) || '—',
      tipo:             (r.tipo as Veiculo['tipo']) ?? 'VUC',
      tipoSiat:         (r.tipo_siat as string | null) ?? null,
      modelo:           (r.modelo as string | null) ?? null,
      capacidadeKg:     Number(r.capacidade_kg ?? 0),
      volumeM3:         r.volume_m3 != null ? Number(r.volume_m3) : null,
      motoristaId:      (r.motorista_id as string | null) ?? null,
      motoristaNome:    (r.motorista_nome as string | null) ?? null,
      motoristaCelular: (r.motorista_celular as string | null) ?? null,
      situacaoSiat:     (r.situacao_siat as string | null) ?? null,
    }
    return { ...base, rotulo: rotuloVeiculo(base) }
  })
}

// ── Fluxo manual: salvar rota (RPC rota_salvar) ──────────────────────────────
// Cria a rota em `aguardando` e reserva NFs, rotas de entrega e veículo na
// MESMA transação. Se outra sessão já reservou qualquer um deles, o banco
// devolve erro e nada é gravado.

export interface SalvarRotaInput {
  data:       string
  codigo:     string
  regiao?:    string
  /** null = carga criada com "placa a definir" (Marcelo, 02/10). */
  veiculoId:  string | null
  notas:      NotaFiscal[]
  usuario?:   string
}

function nfParaRpc(nf: NotaFiscal) {
  const limpo = (v: string | undefined) => (v && v !== '—' ? v : null)
  return {
    numnfs:           nf.numnfs,
    destinatario:     limpo(nf.destinatario),
    municipio:        limpo(nf.municipio),
    bairro:           limpo(nf.bairro),
    endereco:         limpo(nf.endereco),
    numero:           limpo(nf.numero),
    uf:               limpo(nf.uf),
    cep:              limpo(nf.cep),
    peso:             nf.peso,
    volume:           nf.volume ?? null,
    qtd:              nf.qtd ?? null,
    valor:            nf.valor ?? null,
    tipoCliente:      nf.tipoCliente,
    cond:             nf.cond,
    grade:            limpo(nf.grade),
    regiao:           limpo(nf.regiao),
    rota:             limpo(nf.rota),
    dataAgendamento:  nf.dataAgendamento ?? null,
    horaAgendamento:  nf.horaAgendamento ?? null,
    indRee:           nf.indRee,
    indiceReentrega:  nf.indiceReentrega ?? 0,
    sac:              limpo(nf.sac),
    solucaoSac:       limpo(nf.solucaoSac),
    observacao:       limpo(nf.observacao),
    restricaoDesc:    limpo(nf.restricoes),
    remetente:        limpo(nf.remetente),
    cnpjDestinatario: limpo(nf.cnpjDestinatario),
    dataEmissao:      limpo(nf.dataEmissao),
  }
}

export async function salvarRotaManual(input: SalvarRotaInput): Promise<string> {
  const { data, error } = await sb().rpc('rota_salvar', {
    p_data:       input.data,
    p_codigo:     input.codigo,
    p_regiao:     input.regiao ?? null,
    p_veiculo_id: input.veiculoId,
    p_nfs:        input.notas.map(nfParaRpc),
    p_usuario:    input.usuario ?? null,
  })
  if (error) throw new Error(error.message)
  return data as string
}

// ── Edição da rota (RPCs) ────────────────────────────────────────────────────

/** Desvincula NFs da rota — a NF NUNCA é apagada; volta ao conjunto disponível. */
export async function desvincularNotasDaRota(rotaId: string, nfIds: string[]): Promise<number> {
  const { data, error } = await sb().rpc('rota_desvincular_nfs', { p_rota_id: rotaId, p_nf_ids: nfIds })
  if (error) throw new Error(error.message)
  return (data as number) ?? 0
}

/** @deprecated use desvincularNotasDaRota — mantido por compatibilidade. */
export async function removerNotaDaRota(rotaId: string, nfId: string): Promise<void> {
  await desvincularNotasDaRota(rotaId, [nfId])
}

/** Move NFs para outra rota ativa do mesmo dia (bloqueia duplicidade no banco). */
export async function moverNotasParaRota(origemId: string, destinoId: string, nfIds: string[]): Promise<number> {
  const { data, error } = await sb().rpc('rota_mover_nfs', { p_origem: origemId, p_destino: destinoId, p_nf_ids: nfIds })
  if (error) throw new Error(error.message)
  return (data as number) ?? 0
}

/** @deprecated use moverNotasParaRota. */
export async function moverNotaParaRota(origemId: string, destinoId: string, nfId: string): Promise<void> {
  await moverNotasParaRota(origemId, destinoId, [nfId])
}

/** Define/substitui o veículo (e o motorista vinculado) — o banco recusa veículo com rota ativa. */
export async function definirVeiculoDaRota(
  rotaId: string,
  veiculo: string | { veiculoId?: string; placa: string; motoristaNome?: string; motoristaCelular?: string },
  usuario?: string,
): Promise<void> {
  const veiculoId = typeof veiculo === 'string' ? veiculo : veiculo.veiculoId
  if (!veiculoId) throw new Error('Veículo sem id — selecione um veículo cadastrado')
  const { error } = await sb().rpc('rota_definir_veiculo', { p_rota_id: rotaId, p_veiculo_id: veiculoId, p_usuario: usuario ?? null })
  if (error) throw new Error(error.message)
}

/** Consolida 2+ rotas ativas numa nova (as originais viram `rejeitada`). */
export async function consolidarRotas(rotaIds: string[], veiculoId: string, codigo: string, usuario?: string): Promise<string> {
  const { data, error } = await sb().rpc('rota_consolidar', {
    p_rota_ids: rotaIds, p_veiculo_id: veiculoId, p_codigo: codigo, p_usuario: usuario ?? null,
  })
  if (error) throw new Error(error.message)
  return data as string
}

/**
 * Exclui de vez uma rota rascunho/aguardando (Raphael, 16/09): rota, NFs copiadas,
 * histórico e reservas somem do banco — nada fica salvo. Aprovadas/enviadas não
 * podem ser excluídas (o banco recusa).
 */
export async function excluirRota(id: string, usuario?: string): Promise<void> {
  const { error } = await sb().rpc('rota_excluir', { p_rota_id: id, p_usuario: usuario ?? null })
  if (error) throw new Error(error.message)
}

/** Aprovar / enviar / rejeitar. Rejeitar uma rota não aprovada = excluir (nada fica salvo). */
export async function atualizarStatusRota(id: string, status: RouteStatus, observacao?: string, usuario?: string): Promise<void> {
  const { error } = await sb().rpc('rota_mudar_status', {
    p_rota_id: id, p_status: status, p_usuario: usuario ?? null, p_obs: observacao ?? null,
  })
  if (error) throw new Error(error.message)
}

// ── Importação parcial de disponibilidade (RPC) ──────────────────────────────

export interface ItemDisponibilidade { placa: string; disponivel: boolean }

export async function importarDisponibilidade(data: string, itens: ItemDisponibilidade[]): Promise<{ atualizadas: number; naoEncontradas: string[] }> {
  const { data: res, error } = await sb().rpc('disponibilidade_importar', { p_data: data, p_itens: itens })
  if (error) throw new Error(error.message)
  const r = (res ?? {}) as { atualizadas?: number; nao_encontradas?: string[] }
  return { atualizadas: r.atualizadas ?? 0, naoEncontradas: r.nao_encontradas ?? [] }
}

// ── Importação de motoristas por arquivo (lib/motoristas.ts) ────────────────

export interface MotoristaPayload {
  nome:      string
  telefone?: string
  placa?:    string
  status:    'disponivel' | 'ausente'
}

/**
 * Limpa rascunhos do dia antes de re-importar. Rascunhos da IA são descartáveis
 * (não passaram por nenhum operador). As NFs desses rascunhos são desvinculadas
 * — nunca apagadas — e a rota vira `rejeitada` para liberar as reservas.
 */
export async function limparRascunhosDoDia(data: string): Promise<void> {
  const { data: rotasDia } = await sb()
    .from('rotas')
    .select('id')
    .eq('data', data)
    .eq('status', 'rascunho')

  const ids = ((rotasDia ?? []) as { id: string }[]).map(r => r.id)
  for (const id of ids) await excluirRota(id)
}

/**
 * Resetar o dia (Marcelo, 02/10): apaga de uma vez as cargas rascunho/aguardando
 * da data e devolve NFs, rotas de entrega e veículos para a roteirização.
 * Aprovadas/enviadas são preservadas — para apagá-las, reabra a carga antes.
 * Devolve quantas cargas foram apagadas.
 */
export async function resetarDia(data: string, usuario?: string): Promise<number> {
  const { data: n, error } = await sb().rpc('dia_resetar', { p_data: data, p_usuario: usuario ?? null })
  if (error) throw new Error(error.message)
  return (n as number) ?? 0
}
