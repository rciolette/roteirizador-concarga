// Tipos e utilitários para o payload do webhook n8n Execute-SQL-SIAT.
// O webhook retorna duas fontes mescladas: linhas de NF + linhas de veículo.
// Após a correção do node "Edit Fields" (includeOtherFields: true) no WF-A,
// os aliases reais do SQL são repassados diretamente.

import type { Rota, NotaFiscal, Veiculo, Motorista, ClientType, CondStatus } from '@/types'

// ── Campos de NF (aliases do SQL do WF-A) ────────────────────────────────────
export interface SiatRow {
  // Identificação da NF
  NUMNFS?:           number | string | null
  ROTA?:             string | null
  NFSSIT?:           number | string | null

  // Dados da NF
  PesoBruto?:        number | null
  Volume?:           number | null
  Qtd?:              number | null
  Valor?:            number | null
  Destinatario?:     string | null
  DataEmissao?:      string | null
  DataAgendamento?:  string | null
  HoraAgendamento?:  string | null
  Reentrega?:        number | boolean | null  // IND_REE: 0/1 no SQL Server
  SAC?:              string | null
  Observacao?:       string | null
  TipoOperacao?:     number | null

  // Endereço do destinatário
  CNPJDestinatario?: string | null
  Cep?:              string | null
  Bairro?:           string | null
  Endereco?:         string | null
  Numero?:           string | null
  TipoCliente?:      string | null
  Regiao?:           string | null
  TipoCarga?:        string | null
  Municipio?:        string | null
  UF?:               string | null

  // Endereço alternativo (quando LOCENT_SIT <> 0)
  EnderecoFinal?:    string | null
  MunicipioFinal?:   string | null
  BairroFinal?:      string | null
  UFFinal?:          string | null

  // Campos de veículo (linhas de veículo no mesmo payload mesclado)
  Situacao?:         string | null
  Placa?:            string | null
  Modelo?:           string | null
  Categoria?:        string | null
  TipoVeiculo?:      string | null
  TipoCarroceria?:   string | null
  CapacidadeKg?:     number | null
  PBT?:              number | null
  VolumeM3?:         number | null
  CodMotorista?:     string | null
  NomeMotorista?:    string | null
  Telefone?:         string | null
  Celular?:          string | null
  Capacidade?:       number | null   // alias legado
  Volume_M3?:        number | null   // alias legado
  Motorista?:        string | null   // alias legado

  [extra: string]: unknown
}

export interface SiatFilters {
  dataInicio?: string  // YYYY-MM-DD (filtro DATEMI)
  dataFim?:    string  // YYYY-MM-DD
  situacao?:   string  // ex: "DISPONÍVEL"
  codigoRota?: string  // ex: "34.1"
  qtdMaxima?:  number  // limite de NFs retornadas
}

export interface SiatSummary {
  totalLinhas:        number
  totalNFs:           number  // NUMNFS únicos
  pesoTotalKg:        number  // soma de PesoBruto
  pesoTotalToneladas: number
  veiculosUnicos:     number  // Placa única
  rotasUnicas:        number  // ROTA única
  motoristasUnicos:   number  // CodMotorista único
  nfsVermelho:        number
  nfsLaranja:         number
}

// ── derivarCond ───────────────────────────────────────────────────────────────
// Regras de criticidade derivadas dos campos do SIAT (sem campo nativo de cond):
//   vermelho — agendamento preenchido e <= hoje (agendada hoje ou atrasada)
//   laranja  — SAC aberto ou reentrega
//   ok       — demais casos
export function derivarCond(row: SiatRow): CondStatus {
  const hoje = new Date().toISOString().slice(0, 10)

  if (row.DataAgendamento) {
    const agenda = String(row.DataAgendamento).slice(0, 10)
    if (agenda <= hoje) return 'vermelho'
  }

  if (row.SAC || row.Reentrega) return 'laranja'

  return 'ok'
}

// ── Normalização de envelope ──────────────────────────────────────────────────
// n8n às vezes muda envelope (array puro, {data:[]}, {rows:[]} etc).
export function normalizeSiatPayload(raw: unknown): SiatRow[] {
  if (Array.isArray(raw)) return raw as SiatRow[]
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.data))    return obj.data    as SiatRow[]
    if (Array.isArray(obj.rows))    return obj.rows    as SiatRow[]
    if (Array.isArray(obj.results)) return obj.results as SiatRow[]
    if (Array.isArray(obj.items))   return obj.items   as SiatRow[]
    return [obj as SiatRow]
  }
  return []
}

// ── Helpers de tipo ───────────────────────────────────────────────────────────

export function tipoVeiculoFromSiat(tipo: string | null): Veiculo['tipo'] {
  if (!tipo) return 'VUC'
  const t = tipo.toLowerCase()
  if (t.includes('fiorin'))            return 'Fiorino'
  if (t.includes('3/4'))              return '3/4'
  if (t.includes('truck') || t.includes('caminhão')) return 'Truck'
  if (t.includes('carreta') || t.includes('bitrem')) return 'Carreta'
  return 'VUC'
}

export function capKgFromSiat(tipo: string | null, raw: number | null): number {
  if (typeof raw === 'number' && raw >= 100) return raw
  const t = (tipo ?? '').toLowerCase()
  if (t.includes('fiorin'))   return 700
  if (t.includes('3/4'))     return 2500
  if (t.includes('carreta')) return 15000
  if (t.includes('truck') || t.includes('cam')) return 6000
  return 1500
}

function normalizarTipoCliente(tipo: string | null | undefined): ClientType {
  if (!tipo) return 'Varejo'
  const t = tipo.toLowerCase()
  if (t.includes('reentre'))                            return 'Reentrega'
  if (t.includes('rede') || t.includes('network'))      return 'Rede'
  if (t.includes(' cd') || t.startsWith('cd') || t.includes('centro') || t.includes('distribu')) return 'CD'
  return 'Varejo'
}

function getNF(r: SiatRow): string | null {
  const v = r.NUMNFS ?? r['NumNFS'] ?? r['numnfs'] ?? r['NF'] ?? r['N_NF'] ?? r['Numnfs']
  return v != null ? String(v) : null
}

function getRota(r: SiatRow): string | null {
  const v = r.ROTA ?? r['Rota'] ?? r['rota'] ?? r['CODIGO_ROTA'] ?? r['CodigoRota'] ?? r['CodRota']
  const s = v != null ? String(v).trim() : ''
  return s || null
}

// ── siatRowsToNotasPendentes ──────────────────────────────────────────────────
// Converte NF rows do SIAT em NotaFiscal[] plana (sem agrupar por rota).
// Usada para exibir as NFs pendentes de roteirização.
// Nota: NFs sem zona de entrega (ROTA null) são incluídas — a zona é campo de
// exibição, não de elegibilidade. Apenas NUMNFS é obrigatório.
export function siatRowsToNotasPendentes(rows: SiatRow[]): NotaFiscal[] {
  const nfRows = rows.filter(r => getNF(r) != null)
  const seen   = new Set<string>()
  const result: NotaFiscal[] = []

  for (const row of nfRows) {
    const nf = getNF(row)!
    if (seen.has(nf)) continue
    seen.add(nf)

    const reentrega = Boolean(row.Reentrega)
    const tipoCliente: ClientType = reentrega
      ? 'Reentrega'
      : normalizarTipoCliente(row.TipoCliente)

    result.push({
      id:               `siat-${nf}`,
      numnfs:           nf,
      destinatario:     row.Destinatario   || '—',
      municipio:        row.MunicipioFinal || row.Municipio  || '—',
      bairro:           row.BairroFinal    || row.Bairro     || '—',
      endereco:         row.EnderecoFinal  || row.Endereco   || '—',
      cep:              row.Cep            || '—',
      peso:             typeof row.PesoBruto === 'number' ? row.PesoBruto : 0,
      qtd:              typeof row.Qtd     === 'number'   ? row.Qtd      : 1,
      tipoCliente,
      cond:             derivarCond(row),
      grade:            row.TipoCarga      || '—',
      rota:             getRota(row) ?? '—',
      dataEmissao:      row.DataEmissao    ? String(row.DataEmissao).slice(0, 10) : '—',
      dataAgendamento:  row.DataAgendamento ? String(row.DataAgendamento).slice(0, 10) : undefined,
      horaAgendamento:  row.HoraAgendamento ? String(row.HoraAgendamento) : undefined,
      observacao:       row.Observacao     ?? undefined,
      sac:              row.SAC            ?? undefined,
      indRee:           reentrega,
      valor:            typeof row.Valor === 'number' ? row.Valor : undefined,
    })
  }

  return result
}

// ── siatRowsToRotas ───────────────────────────────────────────────────────────
// Agrupa NF rows por ROTA e atribui veículos do pool round-robin.
// Usado para pré-visualização imediata antes de acionar o agente de IA.
export function siatRowsToRotas(
  rows: SiatRow[],
  veiculoPool: Veiculo[]    = [],
  motoristaPool: Motorista[] = [],
): Rota[] {
  const today = new Date().toISOString()
  const nfRows = rows.filter(r => getNF(r) != null && getRota(r) != null)
  const veiculoByPlaca = new Map(veiculoPool.map(v => [v.placa.toUpperCase(), v]))

  const byRota = new Map<string, SiatRow[]>()
  for (const row of nfRows) {
    const rota = getRota(row)!
    if (!byRota.has(rota)) byRota.set(rota, [])
    byRota.get(rota)!.push(row)
  }

  const veiculosDisponiveis = veiculoPool.filter(v => v.status === 'disponivel')
  const veiculoList  = veiculosDisponiveis.length ? veiculosDisponiveis : veiculoPool
  const motoristaList = motoristaPool.filter(m => m.status === 'disponivel')

  return Array.from(byRota.entries()).map(([codigoRota, rotaRows], idx) => {
    const primeiraPlaca = rotaRows.find(r => r.Placa)?.Placa?.toUpperCase()
    const veiculo =
      (primeiraPlaca && veiculoByPlaca.get(primeiraPlaca)) ||
      (veiculoList.length ? veiculoList[idx % veiculoList.length] : undefined)

    // CodMotorista e Placa só chegam via queryVeiculosDisponiveis() (SIAT direto).
    // Pelo webhook n8n Execute-SQL-SIAT esses campos vêm undefined — o fallback
    // round-robin abaixo assume o pool completo nesse caso.
    const codSiat = rotaRows.find(r => r.CodMotorista)?.CodMotorista
    const motoristaDoVeiculo = codSiat
      ? motoristaPool.find(m => m.codigoSiat === codSiat)
      : undefined
    const motorista =
      motoristaDoVeiculo ||
      (motoristaList.length ? motoristaList[idx % motoristaList.length] : undefined)

    const nfNums  = [...new Set(rotaRows.map(r => getNF(r)!))]
    const pesoTotal = rotaRows.reduce(
      (acc, r) => acc + (typeof r.PesoBruto === 'number' ? r.PesoBruto : 0), 0,
    )

    const notasFiscais: NotaFiscal[] = nfNums.map(nf => {
      const row = rotaRows.find(r => getNF(r) === nf)!
      const reentrega    = Boolean(row.Reentrega)
      const tipoCliente: ClientType = reentrega ? 'Reentrega' : normalizarTipoCliente(row.TipoCliente)
      return {
        id:              `nf-${nf}`,
        numnfs:          nf,
        destinatario:    row.Destinatario   || '—',
        municipio:       row.MunicipioFinal || row.Municipio  || '—',
        bairro:          row.BairroFinal    || row.Bairro     || '—',
        endereco:        row.EnderecoFinal  || row.Endereco   || '—',
        cep:             row.Cep            || '—',
        peso:            typeof row.PesoBruto === 'number' ? row.PesoBruto : 0,
        qtd:             typeof row.Qtd === 'number' ? row.Qtd : 1,
        tipoCliente,
        cond:            derivarCond(row),
        grade:           row.TipoCarga      || '—',
        rota:            codigoRota,
        dataEmissao:     row.DataEmissao    ? String(row.DataEmissao).slice(0, 10) : '—',
        dataAgendamento: row.DataAgendamento ? String(row.DataAgendamento).slice(0, 10) : undefined,
        horaAgendamento: row.HoraAgendamento ? String(row.HoraAgendamento) : undefined,
        observacao:      row.Observacao     ?? undefined,
        sac:             row.SAC            ?? undefined,
        indRee:          reentrega,
        valor:           typeof row.Valor === 'number' ? row.Valor : undefined,
      }
    })

    return {
      id: `siat-${codigoRota.replace(/\W+/g, '-')}`,
      data: today,
      codigoRota,
      regiao: codigoRota.split(' ').slice(1).join(' ') || codigoRota,
      status: 'rascunho' as const,
      veiculo,
      veiculoId: veiculo?.id,
      motorista,
      motoristaId: motorista?.id,
      pesoTotal,
      qtdNotas: nfNums.length,
      notasFiscais,
      nfsConcatenadas: nfNums.join(';'),
      createdAt: today,
    }
  })
}

// ── summarizeSiat ─────────────────────────────────────────────────────────────
export function summarizeSiat(rows: SiatRow[]): SiatSummary {
  const nfs        = new Set<string>()
  const placas     = new Set<string>()
  const rotas      = new Set<string>()
  const motoristas = new Set<string>()
  let pesoKg     = 0
  let nfsVermelho = 0
  let nfsLaranja  = 0

  for (const r of rows) {
    const nf = getNF(r)
    if (nf != null) {
      if (!nfs.has(nf)) {
        nfs.add(nf)
        const cond = derivarCond(r)
        if (cond === 'vermelho') nfsVermelho++
        else if (cond === 'laranja') nfsLaranja++
      }
    }
    if (r.Placa)            placas.add(r.Placa)
    const rota = getRota(r)
    if (rota)               rotas.add(rota)
    if (r.CodMotorista)     motoristas.add(r.CodMotorista)
    if (typeof r.PesoBruto === 'number') pesoKg += r.PesoBruto
  }

  return {
    totalLinhas:        rows.length,
    totalNFs:           nfs.size,
    pesoTotalKg:        pesoKg,
    pesoTotalToneladas: Math.round(pesoKg / 100) / 10,
    veiculosUnicos:     placas.size,
    rotasUnicas:        rotas.size,
    motoristasUnicos:   motoristas.size,
    nfsVermelho,
    nfsLaranja,
  }
}
