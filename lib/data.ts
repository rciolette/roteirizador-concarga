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
  // Grades REAIS da operação Concarga (grade_cidades usa estes nomes).
  grades: [
    { id: 'g1',  nome: 'DIARIO',           seg: true,  ter: true,  qua: true,  qui: true,  sex: true,  sab: true  },
    { id: 'g2',  nome: 'SEGUNDA FEIRA',    seg: true,  ter: false, qua: false, qui: false, sex: false, sab: false },
    { id: 'g3',  nome: 'TERÇA FEIRA',      seg: false, ter: true,  qua: false, qui: false, sex: false, sab: false },
    { id: 'g4',  nome: 'QUARTA FEIRA',     seg: false, ter: false, qua: true,  qui: false, sex: false, sab: false },
    { id: 'g5',  nome: 'QUINTA FEIRA',     seg: false, ter: false, qua: false, qui: true,  sex: false, sab: false },
    { id: 'g6',  nome: 'SEXTA',            seg: false, ter: false, qua: false, qui: false, sex: true,  sab: false },
    { id: 'g7',  nome: 'TERÇA E QUINTA',   seg: false, ter: true,  qua: false, qui: true,  sex: false, sab: false },
    { id: 'g8',  nome: 'DIAS ALTERNADOS',  seg: true,  ter: false, qua: true,  qui: false, sex: true,  sab: false },
    { id: 'g9',  nome: 'QUINZENAL',        seg: true,  ter: true,  qua: true,  qui: true,  sex: true,  sab: false },
    { id: 'g10', nome: 'DEDICADO',         seg: true,  ter: true,  qua: true,  qui: true,  sex: true,  sab: false },
    { id: 'g11', nome: 'FLAY RETIRA',      seg: false, ter: false, qua: false, qui: false, sex: false, sab: false },
  ],
  instrucaoGlobal: `A Concarga opera de segunda a sábado com saída dos veículos às 03h. Ordem de prioridade das entregas: 1) Agendamentos (DATAGE preenchida); 2) SAC e reentregas ativas; 3) Clientes COND Vermelho; 4) Clientes COND Laranja; 5) Varejo por data de chegada. Não ultrapassar 95% da capacidade de peso por veículo. Consolidar NFs do mesmo destinatário no mesmo veículo. Agrupar entregas por região geográfica para minimizar quilometragem. Respeitar a grade de dias de cada cidade. Rotas QUINZENAL alternam semanas — incluir as NFs e sinalizar no campo de alertas para o operador confirmar a semana. Rotas FLAY RETIRA não são roteirizadas: o cliente retira no CD — mover essas NFs para nfsExcluidas com motivo "retira". Tempos médios de descarga: CD e Redes 15 minutos, Varejo 8 minutos. Gerar link Google Maps com a sequência otimizada de entregas para cada veículo.`,
  instrucoesPorRota: [],
}
