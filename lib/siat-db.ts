import sql from 'mssql'
import type { SiatRow } from '@/lib/siat'

const config: sql.config = {
  server:   process.env.SIAT_HOST     ?? 'siat.dyndns.info',
  port:     Number(process.env.SIAT_PORT     ?? 10143),
  database: process.env.SIAT_DATABASE ?? 'SiatWeb_Concarga',
  user:     process.env.SIAT_USER     ?? 'SIAT_BI',
  password: process.env.SIAT_PASSWORD ?? 'SIAT_BI',
  options: {
    encrypt:                false,
    trustServerCertificate: true,
    connectTimeout:         15_000,
    requestTimeout:         30_000,
  },
}

let pool: sql.ConnectionPool | null = null

export async function getSiatPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool
  pool = await new sql.ConnectionPool(config).connect()
  return pool
}

export async function queryNFsPendentes(): Promise<SiatRow[]> {
  const db = await getSiatPool()
  const result = await db.request().query<SiatRow>(`
    SELECT TOP 500
      a.NFSSIT,
      b.NUMNFS,
      b.ROTA,
      b.PESBRU_NFS        AS PesoBruto,
      b.VOLUME_NFS        AS Volume,
      b.QTDVOL_NFS        AS Qtd,
      b.VALTOT            AS Valor,
      b.CODCLI_CLI        AS Destinatario,
      b.DATEMI            AS DataEmissao,
      b.DATAGE_NFS        AS DataAgendamento,
      b.HORAGE_NFS        AS HoraAgendamento,
      b.IND_REE           AS Reentrega,
      b.COD_SAC           AS SAC,
      b.OBS               AS Observacao,
      g.CEP               AS Cep,
      g.BAIRRO            AS Bairro,
      g.[END]             AS Endereco,
      g.END_NUM           AS Numero,
      h.TIPCLI_FRE_D      AS TipoCliente,
      p.REGMUN            AS Regiao,
      q.NOME              AS Municipio,
      r.UF                AS UF,
      CASE WHEN b.LOCENT_SIT <> 0 THEN y.ENDALT  ELSE g.[END]   END AS EnderecoFinal,
      CASE WHEN b.LOCENT_SIT <> 0 THEN y.MUNALT  ELSE q.NOME    END AS MunicipioFinal,
      CASE WHEN b.LOCENT_SIT <> 0 THEN y.BAIALT  ELSE g.BAIRRO  END AS BairroFinal,
      CASE WHEN b.LOCENT_SIT <> 0 THEN y.UFALT   ELSE r.UF      END AS UFFinal
    FROM [TAB DIS ROM NF] a
    LEFT JOIN [TAB NFS] b
      ON b.EMPRESA = a.EMPRESA AND b.FILIAL = a.FILIAL AND b.NFSDOC = a.NFSDOC
    LEFT JOIN [TAB DE DESTINATARIO] g
      ON g.DESTINATARIO = b.CODCLI_CLI
    LEFT JOIN [TAB TIPCLI_FRE] h
      ON h.TIPCLI_FRE = g.TIPCLI_FRE
    LEFT JOIN [TAB MUNICIPIO] p
      ON p.MUNICIPIO = g.MUNICIPIO
    LEFT JOIN [TAB CODMUN IBGE] q
      ON q.CODMUN = p.CODMUN
    LEFT JOIN [TAB CODUF IBGE] r
      ON r.CODUF = q.CODUF
    LEFT JOIN [TAB CADGER ENDALT] y
      ON y.CADGER = b.CODCLI_CLI AND y.COD_ENDALT = b.LOCENT_COD_ENDALT
    WHERE a.NFSSIT = 0
      AND b.TIPOPE_L <> 3
    ORDER BY b.DATAGE_NFS ASC, b.DATEMI ASC
  `)
  return result.recordset
}

export async function queryVeiculosDisponiveis(): Promise<SiatRow[]> {
  const db = await getSiatPool()
  const result = await db.request().query<SiatRow>(`
    SELECT
      d.VEISIT_D          AS Situacao,
      a.PLACA             AS Placa,
      a.MODELO            AS Modelo,
      CASE
        WHEN a.CATEGORIA = 1 THEN 'Cavalo Mecânico'
        WHEN a.CATEGORIA = 2 THEN 'Caminhão'
        WHEN a.CATEGORIA = 3 THEN 'Semirreboque'
        WHEN a.CATEGORIA = 4 THEN 'Utilitário'
        ELSE 'Outros'
      END                 AS Categoria,
      e.DESCRICAO         AS TipoVeiculo,
      f.DESCRICAO         AS TipoCarroceria,
      a.CAPACIDADE        AS CapacidadeKg,
      a.PBT               AS PBT,
      a.CUBAGEM_P         AS VolumeM3,
      c.MOTORISTA         AS CodMotorista,
      c.NOME              AS NomeMotorista,
      CONCAT(c.FONE_DDD,'-',c.FONE)       AS Telefone,
      CONCAT(c.CELULAR_DDD,'-',c.CELULAR) AS Celular
    FROM [TAB DE VEICULOS] a
    LEFT JOIN [TAB MOT ADM] b         ON b.PLACA_VEI = a.PLACA
    LEFT JOIN [TAB DE MOTORISTAS] c   ON c.MOTORISTA = b.MOTORISTA
    LEFT JOIN [TAB VEISIT] d          ON d.VEISIT    = a.VEISIT
    LEFT JOIN [TAB TIPO VEICULO] e    ON e.TIPVEI    = a.TIPVEI
    LEFT JOIN [TAB TIPO CARROCERIA] f ON f.TIPCAR    = a.TIPCAR
    WHERE d.VEISIT_D = 'DISPONÍVEL'
    ORDER BY a.PLACA
  `)
  return result.recordset
}
