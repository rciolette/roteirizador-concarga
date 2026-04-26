// Tipos e utilitários para o payload do webhook n8n Execute-SQL-SIAT.
// Cada linha do payload combina dados de NF + veículo + motorista (resultado denormalizado do JOIN no SIAT).

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
