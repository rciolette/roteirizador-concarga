import { AppConfig } from '@/types'

export const DEFAULT_CONFIG: AppConfig = {
  sql: {
    host: '',
    port: '10143',
    database: 'SiatWeb_Concarga',
    user: '',
    password: '',
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
