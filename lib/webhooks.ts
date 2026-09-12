import type { Rota, RetornoGerarRotas, ClientType, RouteStatus, NotaFiscal, Veiculo } from '@/types'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { tipoVeiculoFromSiat, capKgFromSiat } from '@/lib/siat'
import { rotuloVeiculo } from '@/lib/utils'

const sb = () => getSupabaseBrowser()

export type Prioridade = 'padrao' | 'vermelho' | 'menos-veiculos' | 'menor-distancia'

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
  veiculoId:  string
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

/** Aprovar / enviar / rejeitar. Rejeitar libera NFs, rotas de entrega e veículo (trigger). */
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

// ── Geração por IA (WF-B / engine interno) ───────────────────────────────────

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
  timeoutMs?:   number
  intervaloMs?: number
  onTick?:      (segundos: number, encontradas: number) => void
}

/**
 * Espera o WF-B terminar de gravar as rotas do dia (compara IDs, não relógio).
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
        sigla: '—',
        status: 'disponivel' as const,
      } : undefined,
      veiculo: r.veiculo ? {
        id: `v-${r.veiculo}`,
        placa: r.veiculo,
        modelo: r.veiculo,
        tipo: 'VUC' as const,
        capacidadeKg,
        sigla: '—',
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

/**
 * Persistência do retorno SÍNCRONO legado do WF-B (rotas já montadas pela IA).
 * O fluxo manual NÃO usa esta função — usa `salvarRotaManual` (RPC transacional).
 * Os triggers de reserva do banco valem aqui também: uma rota da IA que
 * conflite com reserva existente falha e fica visível sem persistência.
 */
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
      const { error: e2 } = await sb().from('notas_fiscais').insert(
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
            rota_entrega:     nf.rota && nf.rota !== '—' ? nf.rota : null,
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
      if (e2) {
        // Conflito de reserva: a rota não pode ficar sem NFs no banco.
        await sb().from('rotas').delete().eq('id', row.id)
        resultado.push({ ...rota, alertas: [...(rota.alertas ?? []), `Não persistida: ${e2.message}`] })
        continue
      }
    }

    resultado.push({ ...rota, id: row.id, data })
  }

  return resultado
}

export async function salvarNfsNaoAlocadas(nfs: number[], data: string, motivo: string): Promise<void> {
  if (nfs.length === 0) return
  await sb().from('nfs_nao_alocadas').insert(
    nfs.map(n => ({ data, n_nfs: n, motivo }))
  )
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
  for (const id of ids) {
    await atualizarStatusRota(id, 'rejeitada', 'Rascunho descartado na re-importação')
  }
}
