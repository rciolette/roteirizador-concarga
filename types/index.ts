export type CondStatus = 'ok' | 'laranja' | 'vermelho'
export type RouteStatus = 'rascunho' | 'aguardando' | 'aprovada' | 'enviada' | 'rejeitada'
export type ClientType = 'CD' | 'Rede' | 'Varejo' | 'Reentrega'

export interface NotaFiscal {
  id: string
  numnfs: string
  destinatario: string
  municipio: string
  bairro: string
  endereco: string
  cep: string
  peso: number
  qtd: number
  tipoCliente: ClientType
  cond: CondStatus
  grade: string
  rota: string
  dataEmissao: string
  dataAgendamento?: string
  horaAgendamento?: string
  observacao?: string
  sac?: string
  indRee: boolean
  valor?: number
  /** Ordem da parada na rota, definida pelo roteirizador. */
  sequencia?: number
  /** Solução SAC (descrição da última ocorrência) — pedido do Marcelo, item 7. */
  solucaoSac?: string
  /** Código do remetente (CODCLI) — pedido do Marcelo, item 7. */
  remetente?: string
  /** Região do município (REGMUN) — segmentação por região (Marcelo, 17/08). */
  regiao?: string
}

export interface Veiculo {
  id: string
  placa: string
  modelo: string
  tipo: 'Fiorino' | 'VUC' | '3/4' | 'Truck' | 'Carreta'
  capacidadeKg: number
  volumeCubado?: number
  sigla: string
  status: 'disponivel' | 'indisponivel' | 'manutencao'
  regiaoPreferencial?: string
  codigoSiatMotorista?: string
  disponivel_hoje?: boolean
  motoristaNome?: string
  motoristaCelular?: string
}

export interface Motorista {
  id: string
  nome: string
  telefone: string
  sigla: string
  codigoSiat?: string
  placa?: string
  veiculoId?: string
  veiculo?: Veiculo
  status: 'disponivel' | 'ausente' | 'em_rota'
}

export interface Rota {
  id: string
  data: string
  codigoRota: string
  regiao: string
  status: RouteStatus
  motoristaId?: string
  motorista?: Motorista
  veiculoId?: string
  veiculo?: Veiculo
  pesoTotal: number
  qtdNotas: number
  notasFiscais: NotaFiscal[]
  linkMaps?: string
  nfsConcatenadas?: string
  alertas?: string[]
  ocupacaoPercent?: number
  createdAt: string
  enviadoEm?: string
}

export interface DashboardMetrics {
  totalNFs: number
  pesoTotal: number
  veiculosDisponiveis: number
  veiculosTotal: number
  rotasPendentes: number
  rotasAprovadas: number
  rotasEnviadas: number
  rotasRascunho: number
  nfsVermelho: number
  nfsLaranja: number
  porTipoCliente: { tipo: ClientType; count: number }[]
  ultimaImportacao?: string
}

export interface ImportStatus {
  running: boolean
  step: string
  progress: number
  result?: {
    nfs: number
    peso: number
    veiculos: number
    motoristas: number
  }
  error?: string
}

export interface SqlConfig {
  host: string
  port: string
  database: string
  user: string
  password: string
  script: string
}

export interface OperationConfig {
  inicioRoteirizacao: string
  envioMotorista: string
  saidaVeiculos: string
}

export interface PesoConfig {
  fiorino: number
  vuc: number
  tresQuartos: number
  truck: number
  carreta: number
}

export interface GradeRule {
  id: string
  nome: string
  seg: boolean
  ter: boolean
  qua: boolean
  qui: boolean
  sex: boolean
  sab: boolean
}

export interface InstrucaoRota {
  id: string
  codigoRota: string
  instrucao: string
}

export interface AppConfig {
  sql: SqlConfig
  operacao: OperationConfig
  pesos: PesoConfig
  grades: GradeRule[]
  instrucaoGlobal: string
  instrucoesPorRota: InstrucaoRota[]
}

export interface RetornoGerarRotas {
  rotas: {
    codigoRota: string
    regiao: string
    veiculo: string
    motorista: string
    celular: string
    pesoTotal: number
    ocupacaoPercent: number
    qtdNotas: number
    status: 'rascunho'
    alertas: string[]
    linkMaps: string
    notas: {
      numnfs: number
      destinatario: string
      municipio: string
      bairro: string
      endereco: string
      pesoKg: number
      cond: 'ok' | 'laranja' | 'vermelho'
      tipoCliente: string
      agendamento: string
      reentrega: boolean
      sac: string | null
      observacao: string
    }[]
  }[]
  nfsNaoAlocadas: number[]
  motivoNaoAlocacao: string
  resumo: {
    totalNfs: number
    totalRotas: number
    totalVeiculosUsados: number
    pesoTotal: number
    nfsComAlerta: number
    geradoEm: string
  }
}

export interface GerarRotasInput {
  observacoes: string
  veiculosBloqueados: string
  restricoesExtras: string
  prioridade: string
}
