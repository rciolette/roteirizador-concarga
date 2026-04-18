import { Rota, DashboardMetrics, NotaFiscal, Veiculo, Motorista, AppConfig } from '@/types'

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatPeso(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`
  return `${kg}kg`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function getPesoPercent(peso: number, capacidade: number): number {
  return Math.round((peso / capacidade) * 100)
}

export const MOCK_VEICULOS: Veiculo[] = [
  { id: 'v1', placa: 'ABC-1234', modelo: 'Ford Cargo', tipo: 'Truck', capacidadeKg: 6000, sigla: 'LT1', status: 'disponivel', regiaoPreferencial: 'Barreiro' },
  { id: 'v2', placa: 'DEF-5678', modelo: 'VW Delivery', tipo: 'VUC', capacidadeKg: 1500, sigla: 'ED', status: 'disponivel', regiaoPreferencial: 'Leste' },
  { id: 'v3', placa: 'GHI-9012', modelo: 'Fiat Fiorino', tipo: 'Fiorino', capacidadeKg: 700, sigla: 'MF', status: 'disponivel', regiaoPreferencial: 'Oeste' },
  { id: 'v4', placa: 'JKL-3456', modelo: 'Ford Cargo 1317', tipo: 'Truck', capacidadeKg: 6000, sigla: 'PL', status: 'disponivel', regiaoPreferencial: 'Central' },
  { id: 'v5', placa: 'MNO-7890', modelo: 'VW 3/4', tipo: '3/4', capacidadeKg: 2500, sigla: 'RS', status: 'manutencao' },
  { id: 'v6', placa: 'PQR-1122', modelo: 'Mercedes Sprinter', tipo: 'VUC', capacidadeKg: 1500, sigla: 'GS', status: 'disponivel', regiaoPreferencial: 'Norte' },
  { id: 'v7', placa: 'STU-3344', modelo: 'Ford Cargo 2429', tipo: 'Truck', capacidadeKg: 6000, sigla: 'AB', status: 'disponivel', regiaoPreferencial: 'Sul' },
]

export const MOCK_MOTORISTAS: Motorista[] = [
  { id: 'm1', nome: 'Douglas B', telefone: '31999990001', sigla: 'DB', veiculoId: 'v1', status: 'disponivel' },
  { id: 'm2', nome: 'Eduardo 3/4', telefone: '31999990002', sigla: 'ED', veiculoId: 'v2', status: 'disponivel' },
  { id: 'm3', nome: 'Marcelo F', telefone: '31999990003', sigla: 'MF', veiculoId: 'v3', status: 'disponivel' },
  { id: 'm4', nome: 'Paulinho', telefone: '31999990004', sigla: 'PL', veiculoId: 'v4', status: 'disponivel' },
  { id: 'm5', nome: 'Rosana', telefone: '31999990005', sigla: 'RS', status: 'ausente' },
  { id: 'm6', nome: 'Gustavo S', telefone: '31999990006', sigla: 'GS', veiculoId: 'v6', status: 'disponivel' },
  { id: 'm7', nome: 'Anderson B', telefone: '31999990007', sigla: 'AB', veiculoId: 'v7', status: 'disponivel' },
]

export const MOCK_NFS: NotaFiscal[] = [
  { id: 'n1', numnfs: '474952', destinatario: 'Taiguara Alimentos S.A', municipio: 'Belo Horizonte', bairro: 'Pampulha', endereco: 'Av. Pres. Carlos Luz, 4055', cep: '31310250', peso: 134, qtd: 17, tipoCliente: 'Varejo', cond: 'vermelho', grade: 'DIARIO', rota: '30.12 BARREIRO', dataEmissao: '2026-04-18', indRee: false },
  { id: 'n2', numnfs: '474106', destinatario: 'Mult. Format. BH Com.', municipio: 'Belo Horizonte', bairro: 'Tirol', endereco: 'Rua Eustáquio Piazza, 2725', cep: '30310100', peso: 61, qtd: 4, tipoCliente: 'Rede', cond: 'laranja', grade: 'DIARIO', rota: '30.12 BARREIRO', dataEmissao: '2026-04-17', indRee: false },
  { id: 'n3', numnfs: '474238', destinatario: 'Taiguara Alimentos S.A', municipio: 'Belo Horizonte', bairro: 'Bom Despacho', endereco: 'Av. Alberto Lima, 1855', cep: '30310200', peso: 58, qtd: 2, tipoCliente: 'Varejo', cond: 'ok', grade: 'DIARIO', rota: '30.12 BARREIRO', dataEmissao: '2026-04-18', indRee: false },
  { id: 'n4', numnfs: '317941', destinatario: 'Mart Minas Distrib.', municipio: 'Gabiroba', bairro: 'Centro', endereco: 'Av. Alberto Lima, 1282', cep: '38900000', peso: 135, qtd: 21, tipoCliente: 'CD', cond: 'ok', grade: 'DIARIO', rota: '30.12 BARREIRO', dataEmissao: '2026-04-18', indRee: false, dataAgendamento: '2026-04-18', horaAgendamento: '09:00' },
  { id: 'n5', numnfs: '473372', destinatario: 'Laticínios Gala LT', municipio: 'Contagem', bairro: 'Esplanada', endereco: 'Av. Columbia, 670', cep: '32000000', peso: 63, qtd: 6, tipoCliente: 'CD', cond: 'ok', grade: 'DIARIO', rota: '30.41 LESTE3', dataEmissao: '2026-04-18', indRee: false },
  { id: 'n6', numnfs: '474305', destinatario: 'Coleta Canhoto Retido', municipio: 'Fonte Grande', bairro: 'Centro', endereco: 'R. Joaquim José, 943', cep: '35000000', peso: 56, qtd: 3, tipoCliente: 'Varejo', cond: 'ok', grade: 'DIARIO', rota: '30.41 LESTE3', dataEmissao: '2026-04-18', indRee: true },
  { id: 'n7', numnfs: '474601', destinatario: 'Supermercado BH Norte', municipio: 'Belo Horizonte', bairro: 'Venda Nova', endereco: 'Av. Vilarinho, 2001', cep: '31610000', peso: 210, qtd: 28, tipoCliente: 'Rede', cond: 'vermelho', grade: 'DIARIO', rota: '30.55 NORTE1', dataEmissao: '2026-04-18', indRee: false },
  { id: 'n8', numnfs: '474602', destinatario: 'Atacadão Venda Nova', municipio: 'Belo Horizonte', bairro: 'Venda Nova', endereco: 'Av. Vilarinho, 3400', cep: '31610100', peso: 450, qtd: 52, tipoCliente: 'CD', cond: 'laranja', grade: 'DIARIO', rota: '30.55 NORTE1', dataEmissao: '2026-04-18', indRee: false, dataAgendamento: '2026-04-18', horaAgendamento: '10:00' },
  { id: 'n9', numnfs: '474603', destinatario: 'Mercearia São Paulo', municipio: 'Contagem', bairro: 'Cinco', endereco: 'Rua João Pessoa, 512', cep: '32000100', peso: 88, qtd: 9, tipoCliente: 'Varejo', cond: 'ok', grade: 'DIARIO', rota: '30.55 NORTE1', dataEmissao: '2026-04-18', indRee: false },
  { id: 'n10', numnfs: '474701', destinatario: 'Comércio Central BH', municipio: 'Belo Horizonte', bairro: 'Funcionários', endereco: 'Av. Brasil, 1200', cep: '30140000', peso: 175, qtd: 19, tipoCliente: 'Varejo', cond: 'ok', grade: 'DIARIO', rota: '30.33 CENTRO2', dataEmissao: '2026-04-18', indRee: false },
  { id: 'n11', numnfs: '474702', destinatario: 'Rede Epa Savassi', municipio: 'Belo Horizonte', bairro: 'Savassi', endereco: 'Rua Pernambuco, 450', cep: '30130150', peso: 320, qtd: 38, tipoCliente: 'Rede', cond: 'laranja', grade: 'DIARIO', rota: '30.33 CENTRO2', dataEmissao: '2026-04-18', indRee: false },
  { id: 'n12', numnfs: '474801', destinatario: 'Distribuidora Sul Minas', municipio: 'Belo Horizonte', bairro: 'Bom Jesus', endereco: 'Av. Raja Gabaglia, 800', cep: '30441000', peso: 290, qtd: 33, tipoCliente: 'CD', cond: 'ok', grade: 'DIARIO', rota: '30.47 SUL4', dataEmissao: '2026-04-18', indRee: false },
]

export const MOCK_ROTAS: Rota[] = [
  {
    id: 'r1', data: '2026-04-18', codigoRota: '30.12 BARREIRO', regiao: 'Barreiro / BH Sul',
    status: 'aguardando', motoristaId: 'm1', motorista: MOCK_MOTORISTAS[0],
    veiculoId: 'v1', veiculo: MOCK_VEICULOS[0],
    pesoTotal: 1420, qtdNotas: 18,
    notasFiscais: MOCK_NFS.filter(n => n.rota === '30.12 BARREIRO'),
    nfsConcatenadas: '474952;474106;474238;317941',
    createdAt: '2026-04-18T13:15:00Z',
    linkMaps: 'https://www.google.com/maps/dir/Av.+Pres.+Carlos+Luz,+4055,+Pampulha,+BH/Rua+Eustáquio+Piazza,+2725,+Tirol,+BH/Av.+Alberto+Lima,+1855,+BH',
  },
  {
    id: 'r2', data: '2026-04-18', codigoRota: '30.41 LESTE3', regiao: 'Leste / Contagem',
    status: 'aprovada', motoristaId: 'm2', motorista: MOCK_MOTORISTAS[1],
    veiculoId: 'v2', veiculo: MOCK_VEICULOS[1],
    pesoTotal: 980, qtdNotas: 14,
    notasFiscais: MOCK_NFS.filter(n => n.rota === '30.41 LESTE3'),
    nfsConcatenadas: '473372;474305',
    createdAt: '2026-04-18T13:16:00Z',
    linkMaps: 'https://www.google.com/maps/dir/Av.+Columbia,+670,+Contagem/R.+Joaquim+José,+943,+Fonte+Grande',
  },
  {
    id: 'r3', data: '2026-04-18', codigoRota: '30.23 OESTE4', regiao: 'Oeste / BH',
    status: 'enviada', motoristaId: 'm3', motorista: MOCK_MOTORISTAS[2],
    veiculoId: 'v3', veiculo: MOCK_VEICULOS[2],
    pesoTotal: 620, qtdNotas: 11,
    notasFiscais: [],
    nfsConcatenadas: '474050;474051;474052',
    createdAt: '2026-04-18T13:17:00Z',
    enviadoEm: '2026-04-18T20:34:00Z',
  },
]

export const ROTAS_GERADAS_IA: Rota[] = [
  {
    id: 'g1', data: '2026-04-18', codigoRota: '30.55 NORTE1', regiao: 'Norte / Venda Nova',
    status: 'aguardando', motoristaId: 'm4', motorista: MOCK_MOTORISTAS[3],
    veiculoId: 'v4', veiculo: MOCK_VEICULOS[3],
    pesoTotal: 2810, qtdNotas: 21,
    notasFiscais: MOCK_NFS.filter(n => n.rota === '30.55 NORTE1'),
    nfsConcatenadas: '474601;474602;474603',
    createdAt: '',
    linkMaps: 'https://www.google.com/maps/dir/Av.+Vilarinho,+2001,+Venda+Nova,+BH/Av.+Vilarinho,+3400,+BH/Rua+João+Pessoa,+512,+Contagem',
  },
  {
    id: 'g2', data: '2026-04-18', codigoRota: '30.33 CENTRO2', regiao: 'Centro / Savassi',
    status: 'aguardando', motoristaId: 'm6', motorista: MOCK_MOTORISTAS[5],
    veiculoId: 'v6', veiculo: MOCK_VEICULOS[5],
    pesoTotal: 1180, qtdNotas: 16,
    notasFiscais: MOCK_NFS.filter(n => n.rota === '30.33 CENTRO2'),
    nfsConcatenadas: '474701;474702',
    createdAt: '',
    linkMaps: 'https://www.google.com/maps/dir/Av.+Brasil,+1200,+Funcionários,+BH/Rua+Pernambuco,+450,+Savassi,+BH',
  },
  {
    id: 'g3', data: '2026-04-18', codigoRota: '30.47 SUL4', regiao: 'Sul / Bom Jesus',
    status: 'aguardando', motoristaId: 'm7', motorista: MOCK_MOTORISTAS[6],
    veiculoId: 'v7', veiculo: MOCK_VEICULOS[6],
    pesoTotal: 580, qtdNotas: 9,
    notasFiscais: MOCK_NFS.filter(n => n.rota === '30.47 SUL4'),
    nfsConcatenadas: '474801',
    createdAt: '',
    linkMaps: 'https://www.google.com/maps/dir/Av.+Raja+Gabaglia,+800,+Bom+Jesus,+BH',
  },
]

export const MOCK_METRICS: DashboardMetrics = {
  totalNFs: 412,
  pesoTotal: 63400,
  veiculosDisponiveis: 43,
  veiculosTotal: 48,
  rotasPendentes: 5,
  rotasAprovadas: 26,
  rotasEnviadas: 21,
  rotasRascunho: 12,
  nfsVermelho: 18,
  nfsLaranja: 24,
  porTipoCliente: [
    { tipo: 'CD', count: 47 },
    { tipo: 'Rede', count: 89 },
    { tipo: 'Varejo', count: 241 },
    { tipo: 'Reentrega', count: 35 },
  ],
  ultimaImportacao: '2026-04-18T13:02:00Z',
}

export const HISTORICO_DIAS = [
  {
    data: '2026-04-18', label: '18/04/2026 — hoje',
    rotas: 43, nfs: 412, peso: 63400,
    items: MOCK_ROTAS.map(r => ({ ...r, status: 'enviada' as const })),
  },
  {
    data: '2026-04-17', label: '17/04/2026 — quinta',
    rotas: 41, nfs: 388, peso: 59100,
    items: [
      { ...MOCK_ROTAS[0], id: 'h1', data: '2026-04-17', codigoRota: '30.12 BARREIRO', qtdNotas: 16, pesoTotal: 1310, status: 'enviada' as const, enviadoEm: '2026-04-17T20:28:00Z', notasFiscais: MOCK_NFS.filter(n => n.rota === '30.12 BARREIRO'), nfsConcatenadas: '473100;473101;473102;473103' },
      { ...MOCK_ROTAS[1], id: 'h2', data: '2026-04-17', codigoRota: '30.29 CENTRAL', regiao: 'Central / BH', qtdNotas: 22, pesoTotal: 1800, status: 'enviada' as const, enviadoEm: '2026-04-17T20:31:00Z', notasFiscais: [], nfsConcatenadas: '473110;473111;473112' },
      { ...MOCK_ROTAS[2], id: 'h3', data: '2026-04-17', codigoRota: '30.41 LESTE3', qtdNotas: 14, pesoTotal: 920, status: 'enviada' as const, enviadoEm: '2026-04-17T20:29:00Z', notasFiscais: MOCK_NFS.filter(n => n.rota === '30.41 LESTE3'), nfsConcatenadas: '473120;473121' },
    ],
  },
  {
    data: '2026-04-16', label: '16/04/2026 — quarta',
    rotas: 38, nfs: 362, peso: 55200,
    items: [
      { ...MOCK_ROTAS[0], id: 'h4', data: '2026-04-16', qtdNotas: 15, pesoTotal: 1250, status: 'enviada' as const, enviadoEm: '2026-04-16T20:35:00Z', notasFiscais: MOCK_NFS.filter(n => n.rota === '30.12 BARREIRO'), nfsConcatenadas: '472900;472901;472902' },
      { ...MOCK_ROTAS[2], id: 'h5', data: '2026-04-16', codigoRota: '30.23 OESTE4', qtdNotas: 9, pesoTotal: 580, status: 'enviada' as const, enviadoEm: '2026-04-16T20:22:00Z', notasFiscais: [], nfsConcatenadas: '472910;472911' },
      { ...MOCK_ROTAS[1], id: 'h6', data: '2026-04-16', codigoRota: '30.55 NORTE1', regiao: 'Norte / Venda Nova', qtdNotas: 19, pesoTotal: 2400, status: 'enviada' as const, enviadoEm: '2026-04-16T20:40:00Z', notasFiscais: MOCK_NFS.filter(n => n.rota === '30.55 NORTE1'), nfsConcatenadas: '472920;472921;472922' },
    ],
  },
  {
    data: '2026-04-15', label: '15/04/2026 — terça',
    rotas: 39, nfs: 374, peso: 57800,
    items: [
      { ...MOCK_ROTAS[0], id: 'h7', data: '2026-04-15', qtdNotas: 17, pesoTotal: 1380, status: 'enviada' as const, enviadoEm: '2026-04-15T20:30:00Z', notasFiscais: MOCK_NFS.filter(n => n.rota === '30.12 BARREIRO'), nfsConcatenadas: '472700;472701' },
      { ...MOCK_ROTAS[1], id: 'h8', data: '2026-04-15', codigoRota: '30.33 CENTRO2', regiao: 'Centro / Savassi', qtdNotas: 20, pesoTotal: 1600, status: 'enviada' as const, enviadoEm: '2026-04-15T20:38:00Z', notasFiscais: MOCK_NFS.filter(n => n.rota === '30.33 CENTRO2'), nfsConcatenadas: '472710;472711' },
    ],
  },
  {
    data: '2026-04-14', label: '14/04/2026 — segunda',
    rotas: 44, nfs: 421, peso: 65100,
    items: [
      { ...MOCK_ROTAS[0], id: 'h9', data: '2026-04-14', qtdNotas: 19, pesoTotal: 1520, status: 'enviada' as const, enviadoEm: '2026-04-14T20:25:00Z', notasFiscais: MOCK_NFS.filter(n => n.rota === '30.12 BARREIRO'), nfsConcatenadas: '472500;472501;472502' },
      { ...MOCK_ROTAS[2], id: 'h10', data: '2026-04-14', codigoRota: '30.47 SUL4', regiao: 'Sul / Bom Jesus', qtdNotas: 11, pesoTotal: 720, status: 'enviada' as const, enviadoEm: '2026-04-14T20:20:00Z', notasFiscais: MOCK_NFS.filter(n => n.rota === '30.47 SUL4'), nfsConcatenadas: '472510;472511' },
      { ...MOCK_ROTAS[1], id: 'h11', data: '2026-04-14', codigoRota: '30.29 CENTRAL', regiao: 'Central / BH', qtdNotas: 24, pesoTotal: 2100, status: 'enviada' as const, enviadoEm: '2026-04-14T20:42:00Z', notasFiscais: [], nfsConcatenadas: '472520;472521;472522' },
    ],
  },
  {
    data: '2026-04-12', label: '12/04/2026 — sábado',
    rotas: 28, nfs: 241, peso: 36800,
    items: [
      { ...MOCK_ROTAS[0], id: 'h12', data: '2026-04-12', qtdNotas: 12, pesoTotal: 950, status: 'enviada' as const, enviadoEm: '2026-04-12T20:15:00Z', notasFiscais: [], nfsConcatenadas: '472300;472301' },
      { ...MOCK_ROTAS[1], id: 'h13', data: '2026-04-12', qtdNotas: 9, pesoTotal: 680, status: 'enviada' as const, enviadoEm: '2026-04-12T20:18:00Z', notasFiscais: [], nfsConcatenadas: '472310;472311' },
    ],
  },
  {
    data: '2026-04-11', label: '11/04/2026 — sexta',
    rotas: 42, nfs: 401, peso: 61200,
    items: [
      { ...MOCK_ROTAS[0], id: 'h14', data: '2026-04-11', qtdNotas: 18, pesoTotal: 1450, status: 'enviada' as const, enviadoEm: '2026-04-11T20:32:00Z', notasFiscais: [], nfsConcatenadas: '472100;472101;472102' },
      { ...MOCK_ROTAS[1], id: 'h15', data: '2026-04-11', codigoRota: '30.55 NORTE1', regiao: 'Norte / Venda Nova', qtdNotas: 20, pesoTotal: 2600, status: 'enviada' as const, enviadoEm: '2026-04-11T20:39:00Z', notasFiscais: [], nfsConcatenadas: '472110;472111;472112' },
      { ...MOCK_ROTAS[2], id: 'h16', data: '2026-04-11', qtdNotas: 10, pesoTotal: 640, status: 'enviada' as const, enviadoEm: '2026-04-11T20:21:00Z', notasFiscais: [], nfsConcatenadas: '472120;472121' },
    ],
  },
]

export const DEFAULT_CONFIG: AppConfig = {
  sql: {
    host: 'siat.dyndns.info',
    port: '10143',
    database: 'SiatWeb_Concarga',
    user: 'SIAT_BI',
    password: 'SIAT_BI',
    script: `set dateformat YMD;
WITH UltimaOcorrenciaSAC AS (
  select a.COD_SAC as SAC, b.NUMITE as UltimaOcorrenciaSAC, c.DES_SOL as Descricao
  from [TAB LG SAC] a
  left join [TAB LG SAC OCO] b ON b.COD_SAC = a.COD_SAC
  left join [TAB LG SOL] c ON c.COD_SOL = b.COD_SOL
  where a.DATATE >= '2024-01-01 00:00:00.000'
    and b.NUMITE = (select MAX(b2.NUMITE) from [TAB LG SAC OCO] b2 where b2.COD_SAC = a.COD_SAC)
)
select
  b.NUMNFS as 'N NFS', b.ROTA as Rota, b.PESBRU_NFS as 'Peso Bruto',
  b.QTDVOL_NFS as Qtd, b.DATAGE_NFS as DtAgend, b.HORAGE_NFS as HrAgend,
  g.CEP as 'Cep Dest', g.BAIRRO as 'Bairro Dest', g.[END] as 'Endereco Dest',
  g.END_NUM as 'Numero Dest', q.NOME as 'Municipio Dest', r.UF,
  h.TIPCLI_FRE_D as 'Tipo Cliente', p.TIPCARGA as TpCarga, p.REGMUN as Regiao,
  b.IND_REE as 'Ind Ree', b.OBS as Observacao, t.SAC, t.Descricao as 'Solucao SAC',
  CASE WHEN b.LOCENT_SIT <> 0 THEN y.ENDALT ELSE g.[END] END as 'End Entrega'
from [TAB DIS ROM NF] a
left join [TAB NFS] b on b.EMPRESA = a.EMPRESA and b.FILIAL = a.FILIAL and b.NFSDOC = a.NFSDOC
left join [TAB DE DESTINATARIO] g on g.DESTINATARIO = b.CODCLI_CLI
left join [TAB TIPCLI_FRE] h on h.TIPCLI_FRE = g.TIPCLI_FRE
left join [TAB MUNICIPIO] p on p.MUNICIPIO = g.MUNICIPIO
left join [TAB CODMUN IBGE] q on q.CODMUN = p.CODMUN
left join [TAB CODUF IBGE] r on r.CODUF = q.CODUF
left join UltimaOcorrenciaSAC t on t.SAC = b.COD_SAC
left join [TAB CADGER ENDALT] y on y.CADGER = b.CODCLI_CLI and y.COD_ENDALT = b.LOCENT_COD_ENDALT
where b.DATEMI >= CAST(GETDATE() AS DATE)
  and b.NFSDOC_REE_ATU = 1
  and b.TIPOPE_L <> 3
  and a.NFSSIT = 0
order by b.NUMNFS`,
  },
  operacao: {
    inicioRoteirizacao: '13:00',
    envioMotorista: '20:30',
    saidaVeiculos: '03:00',
  },
  pesos: { fiorino: 700, vuc: 1500, tresQuartos: 2500, truck: 6000, carreta: 15000 },
  grades: [
    { id: 'g1', nome: 'Rotas DIÁRIO', seg: true, ter: true, qua: true, qui: true, sex: true, sab: false },
    { id: 'g2', nome: 'Dias alternados', seg: true, ter: false, qua: true, qui: false, sex: true, sab: false },
    { id: 'g3', nome: 'Terça-feira', seg: false, ter: true, qua: false, qui: false, sex: false, sab: false },
    { id: 'g4', nome: 'Quinzenal A', seg: true, ter: false, qua: false, qui: false, sex: false, sab: false },
    { id: 'g5', nome: 'Quinzenal B', seg: false, ter: false, qua: false, qui: true, sex: false, sab: false },
  ],
  instrucaoGlobal: `A Concarga opera de segunda a sábado com saída dos veículos às 03h. Priorizar sempre entregas agendadas (DATAGE preenchida) e clientes com COND Vermelho. Não ultrapassar 95% da capacidade de peso por veículo. Agrupar entregas por região geográfica para minimizar quilometragem. CD e Redes têm tempo médio de descarga de 15 minutos, Varejo 8 minutos. Reentregas (IND_REE = true) têm prioridade média. Gerar link Google Maps com a sequência otimizada de entregas para cada veículo.`,
  instrucoesPorRota: [
    { id: 'ir1', codigoRota: '30.12 BARREIRO', instrucao: 'Não exceder 18 paradas. Cliente Atacadão só recebe até 11h.' },
    { id: 'ir2', codigoRota: '30.41 LESTE3', instrucao: 'Priorizar CD Lagoa da Prata. Quinzenal grupo A nas semanas pares.' },
    { id: 'ir3', codigoRota: '30.29 CENTRAL', instrucao: 'Rota viagem — saída às 02h. Não agrupar com rotas urbanas.' },
  ],
}
