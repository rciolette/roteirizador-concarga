// Tipos e utilitários para o payload do webhook n8n Execute-SQL-SIAT.
// Cada linha do payload combina dados de NF + veículo + motorista (resultado denormalizado do JOIN no SIAT).

import type { Rota, NotaFiscal, Veiculo, Motorista, ClientType } from '@/types'

export interface SiatRow {
  NUMNFS:         number | string | null
  ROTA:           string | null
  PESBRU_NFS:     number | null
  CODCLI_CLI:     string | null
  DATEMI:         string | null
  Situacao:       string | null
  Placa:          string | null
  Modelo:         string | null
  Categoria:      string | null
  TipoVeiculo:    string | null
  TipoCarroceria: string | null
  CapacidadeKg:   number | null
  PBT:            number | null
  VolumeM3:       number | null
  CodMotorista:   string | null
  NomeMotorista:  string | null
  Telefone:       string | null
  Celular:        string | null
  Capacidade:     number | null
  Volume_M3:      number | null
  Motorista:      string | null
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
  pesoTotalKg:        number  // soma de PESBRU_NFS
  pesoTotalToneladas: number
  veiculosUnicos:     number  // Placa única
  rotasUnicas:        number  // ROTA única
  motoristasUnicos:   number  // CodMotorista único
}

// n8n às vezes muda envelope (array puro, {data:[]}, {rows:[]} etc).
// Aceita as variantes mais comuns e cai no objeto único como último recurso.
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

// ── Transformer: SiatRow[] → Rota[] ──────────────────────────────────────────
// O payload do n8n retorna linhas denormalizadas em dois formatos:
//   • NF rows:      têm NUMNFS + ROTA, sem Placa
//   • Vehicle rows: têm Placa + NomeMotorista, sem NUMNFS
// Agrupamos NFs por ROTA e atribuímos veículos do pool round-robin.

function tipoVeiculoFromSiat(tipo: string | null): Veiculo['tipo'] {
  if (!tipo) return 'VUC'
  const t = tipo.toLowerCase()
  if (t.includes('fiorin'))            return 'Fiorino'
  if (t.includes('3/4'))              return '3/4'
  if (t.includes('truck') || t.includes('caminhão')) return 'Truck'
  if (t.includes('carreta') || t.includes('bitrem')) return 'Carreta'
  return 'VUC'
}

function capKgFromSiat(tipo: string | null, raw: number | null): number {
  // O SIAT retorna CapacidadeKg em toneladas; valores < 100 são inválidos em kg.
  if (typeof raw === 'number' && raw >= 100) return raw
  const t = (tipo ?? '').toLowerCase()
  if (t.includes('fiorin'))   return 700
  if (t.includes('3/4'))     return 2500
  if (t.includes('carreta')) return 15000
  if (t.includes('truck') || t.includes('cam')) return 6000
  return 1500
}

export function siatRowsToRotas(rows: SiatRow[]): Rota[] {
  const today = new Date().toISOString()

  // Separar NF rows (têm NUMNFS e ROTA) de vehicle rows (têm Placa)
  const nfRows      = rows.filter(r => r.NUMNFS != null && r.ROTA)
  const veicRows    = rows.filter(r => r.Placa && r.NomeMotorista)

  // Construir pool de veículos únicos por Placa
  const veiculoMap  = new Map<string, Veiculo>()
  const motoristaMap = new Map<string, Motorista>()

  for (const vr of veicRows) {
    if (vr.Placa && !veiculoMap.has(vr.Placa)) {
      veiculoMap.set(vr.Placa, {
        id: `v-${vr.Placa}`,
        placa: vr.Placa,
        modelo: vr.Modelo ?? '',
        tipo: tipoVeiculoFromSiat(vr.TipoVeiculo),
        capacidadeKg: capKgFromSiat(vr.TipoVeiculo, vr.CapacidadeKg),
        sigla: vr.Placa.replace(/\W/g, '').slice(-4),
        status: 'disponivel',
      })
    }
    if (vr.CodMotorista && !motoristaMap.has(vr.CodMotorista)) {
      motoristaMap.set(vr.CodMotorista, {
        id: `m-${vr.CodMotorista}`,
        nome: vr.NomeMotorista ?? vr.Motorista ?? vr.CodMotorista,
        telefone: vr.Celular && vr.Celular !== '-' ? vr.Celular : (vr.Telefone ?? '—'),
        sigla: vr.CodMotorista.slice(0, 3).toUpperCase(),
        status: 'disponivel',
      })
    }
  }

  const veiculoList   = Array.from(veiculoMap.values())
  const motoristaList = Array.from(motoristaMap.values())

  // Agrupar NF rows por ROTA
  const byRota = new Map<string, SiatRow[]>()
  for (const row of nfRows) {
    const rota = String(row.ROTA!)
    if (!byRota.has(rota)) byRota.set(rota, [])
    byRota.get(rota)!.push(row)
  }

  return Array.from(byRota.entries()).map(([codigoRota, rotaRows], idx) => {
    const veiculo   = veiculoList.length  ? veiculoList[idx % veiculoList.length]   : undefined
    const motorista = motoristaList.length ? motoristaList[idx % motoristaList.length] : undefined

    // NFs únicas dentro desta rota
    const nfNums = [...new Set(rotaRows.map(r => String(r.NUMNFS!)))]
    const pesoTotal = rotaRows.reduce(
      (acc, r) => acc + (typeof r.PESBRU_NFS === 'number' ? r.PESBRU_NFS : 0), 0,
    )

    const notasFiscais: NotaFiscal[] = nfNums.map(nf => {
      const row = rotaRows.find(r => String(r.NUMNFS) === nf)!
      const tipoCliente: ClientType = row.Situacao === 'REENTREGA' ? 'Reentrega' : 'Varejo'
      return {
        id: `nf-${nf}`,
        numnfs: nf,
        destinatario: row.CODCLI_CLI || '—',
        municipio: '—',
        bairro: '—',
        endereco: '—',
        cep: '—',
        peso: typeof row.PESBRU_NFS === 'number' ? row.PESBRU_NFS : 0,
        qtd: 1,
        tipoCliente,
        cond: 'ok',
        grade: '—',
        rota: codigoRota,
        dataEmissao: row.DATEMI ?? '—',
        indRee: false,
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

export function summarizeSiat(rows: SiatRow[]): SiatSummary {
  const nfs        = new Set<string>()
  const placas     = new Set<string>()
  const rotas      = new Set<string>()
  const motoristas = new Set<string>()
  let pesoKg = 0

  for (const r of rows) {
    if (r.NUMNFS       != null) nfs.add(String(r.NUMNFS))
    if (r.Placa)                placas.add(r.Placa)
    if (r.ROTA)                 rotas.add(r.ROTA)
    if (r.CodMotorista)         motoristas.add(r.CodMotorista)
    if (typeof r.PESBRU_NFS === 'number') pesoKg += r.PESBRU_NFS
  }

  return {
    totalLinhas:        rows.length,
    totalNFs:           nfs.size,
    pesoTotalKg:        pesoKg,
    pesoTotalToneladas: Math.round(pesoKg / 100) / 10,
    veiculosUnicos:     placas.size,
    rotasUnicas:        rotas.size,
    motoristasUnicos:   motoristas.size,
  }
}
