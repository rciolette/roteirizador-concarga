import sql from 'mssql'
import type { SiatRow } from '@/lib/siat'

const config: sql.config = {
  server:   process.env.SIAT_HOST     ?? '',
  port:     Number(process.env.SIAT_PORT     ?? 10143),
  database: process.env.SIAT_DATABASE ?? 'SiatWeb_Concarga',
  user:     process.env.SIAT_USER     ?? '',
  password: process.env.SIAT_PASSWORD ?? '',
  options: {
    encrypt:                false,
    trustServerCertificate: true,
    connectTimeout:         15_000,
    requestTimeout:         60_000,
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
  const result = await db.request().batch<SiatRow>(`
    SET DATEFORMAT YMD;

    WITH UltimaOcorrenciaSAC AS (
      SELECT
        a.COD_SAC AS SAC,
        b.NUMITE  AS UltimaOcorrenciaSAC,
        c.DES_SOL AS Descricao
      FROM [TAB LG SAC] a
      LEFT JOIN [TAB LG SAC OCO] b ON b.COD_SAC = a.COD_SAC
      LEFT JOIN [TAB LG SOL] c     ON c.COD_SOL = b.COD_SOL
      WHERE a.DATATE >= '2024-01-01 00:00:00.000'
        AND b.NUMITE = (
          SELECT MAX(b2.NUMITE)
          FROM [TAB LG SAC OCO] b2
          WHERE b2.COD_SAC = a.COD_SAC
        )
    )

    SELECT
      a.NFSSIT                                                          AS NFSSIT,
      b.NUMNFS                                                          AS NUMNFS,
      b.ROTA                                                            AS ROTA,
      b.PESBRU_NFS                                                      AS PesoBruto,
      b.VOLUME_NFS                                                      AS Volume,
      b.QTDVOL_NFS                                                      AS Qtd,
      b.VALTOT                                                          AS Valor,
      b.CODCLI_CLI                                                      AS Destinatario,
      b.DATEMI                                                          AS DataEmissao,
      b.DATAGE_NFS                                                      AS DataAgendamento,
      b.HORAGE_NFS                                                      AS HoraAgendamento,
      b.IND_REE                                                         AS Reentrega,
      b.COD_SAC                                                         AS CodigoSAC,
      b.OBS                                                             AS Observacao,
      g.CGC                                                             AS CNPJDestinatario,
      g.CEP                                                             AS Cep,
      g.BAIRRO                                                          AS Bairro,
      g.[END]                                                           AS Endereco,
      g.END_NUM                                                         AS Numero,
      h.TIPCLI_FRE_D                                                    AS TipoCliente,
      p.REGMUN                                                          AS Regiao,
      p.TIPCARGA                                                        AS TipoCarga,
      q.NOME                                                            AS Municipio,
      q.CODMUN                                                          AS CodigoMunicipio,
      r.UF                                                              AS UF,
      CASE WHEN b.LOCENT_SIT <> 0 THEN y.ENDALT ELSE g.[END]   END     AS EnderecoFinal,
      CASE WHEN b.LOCENT_SIT <> 0 THEN y.MUNALT ELSE q.NOME    END     AS MunicipioFinal,
      CASE WHEN b.LOCENT_SIT <> 0 THEN y.BAIALT ELSE g.BAIRRO  END     AS BairroFinal,
      CASE WHEN b.LOCENT_SIT <> 0 THEN y.UFALT  ELSE r.UF      END     AS UFFinal,
      a.ROMEXP                                                          AS RomExp,
      b.EMP_RESP                                                        AS EmpResp,
      b.FIL_RESP                                                        AS FilResp,
      COUNT(l.CODRES)                                                   AS QtdRestricoes,
      STRING_AGG(l.RESTRICAO, ',')                                      AS RestricaoDesc,
      b.REX_ORI                                                         AS RomOri,
      t.SAC                                                             AS SAC,
      t.Descricao                                                       AS SolucaoSAC,
      n.NUMDOC_1                                                        AS CtrcOrt,
      z.UF                                                              AS UFDestCTE,
      n.[DAT-EMI]                                                       AS DtEmissaoCTE,
      n.[DAT-PREENT]                                                    AS PrazoEntCTE,
      SUM(n.[C-TOTAL])                                                  AS ValorCTeOrt,
      n.PAGADOR                                                         AS PagadorCTe,
      b.CODCLI                                                          AS Remetente,
      d.CGC                                                             AS CNPJRemetente,
      b.TIPTER                                                          AS TipoTerceiro,
      b.TIPTER_CADGER                                                   AS TipoTerceiroCadger,
      o.CHAVE                                                           AS ChaveAcessoCTe,
      b.NUMREF                                                          AS NumRef,
      b.CHAVEACESSO                                                     AS ChaveAcessoNFe,
      b.NFSDOC                                                          AS NFSDOC,
      a.DIS_ROM                                                         AS RomSep,
      a.ROMFOR                                                          AS RomFor,
      b.TIPOPE_L                                                        AS TipoOperacao,
      n.TIPDOC                                                          AS TipoDoc,
      b.EMPRESA                                                         AS Empresa,
      b.FILIAL                                                          AS Filial,
      n.EMP_SIG                                                         AS EmpSig,
      n.FIL_SIG                                                         AS FilSig
    FROM [TAB DIS ROM NF] a
    LEFT JOIN [TAB NFS] b
      ON b.EMPRESA = a.EMPRESA AND b.FILIAL = a.FILIAL AND b.NFSDOC = a.NFSDOC
    LEFT JOIN [TAB DE DESTINATARIO] d  ON d.DESTINATARIO = b.CODCLI
    LEFT JOIN [TAB LG ROMEXP] e        ON e.ROMEXP = a.ROMEXP
    LEFT JOIN [TAB DE MOTORISTAS] f    ON f.MOTORISTA = e.MOTORISTA
    LEFT JOIN [TAB DE DESTINATARIO] g  ON g.DESTINATARIO = b.CODCLI_CLI
    LEFT JOIN [TAB TIPCLI_FRE] h       ON h.TIPCLI_FRE = g.TIPCLI_FRE
    LEFT JOIN [TAB CADGER RES] k       ON k.CADGER = b.CODCLI_CLI
    LEFT JOIN [TAB CADGER CAD RES] l   ON l.CODRES = k.CODRES
    LEFT JOIN [TAB CON NFS] m
      ON m.NUMDOC = b.NUMDOC AND m.EMPRESA = b.EMPRESA AND m.FILIAL = b.FILIAL AND m.NFSDOC = b.NFSDOC_REE
    LEFT JOIN [TAB DE CONHECIMENTO] n
      ON n.NUMDOC = m.NUMDOC AND n.EMPRESA = m.EMPRESA AND n.FILIAL = m.FILIAL
    LEFT JOIN [TAB DOCE] o
      ON o.NUMDOC = n.NUMDOC AND o.TIPDOC = n.TIPDOC AND o.EMPRESA = n.EMPRESA AND o.FILIAL = n.FILIAL
    LEFT JOIN [TAB MUNICIPIO] p        ON p.MUNICIPIO = g.MUNICIPIO
    LEFT JOIN [TAB CODMUN IBGE] q      ON q.CODMUN = p.CODMUN
    LEFT JOIN [TAB CODUF IBGE] r       ON r.CODUF = q.CODUF
    LEFT JOIN UltimaOcorrenciaSAC t    ON t.SAC = b.COD_SAC
    LEFT JOIN [TAB MUNICIPIO] v        ON v.MUNICIPIO = n.ENTREGA
    LEFT JOIN [TAB CODMUN IBGE] x      ON x.CODMUN = v.CODMUN
    LEFT JOIN [TAB CODUF IBGE] z       ON z.CODUF = x.CODUF
    LEFT JOIN [TAB CADGER ENDALT] y
      ON y.CADGER = b.CODCLI_CLI AND y.COD_ENDALT = b.LOCENT_COD_ENDALT
    WHERE b.DATEMI   >= '2024-01-01 00:00:00.000'
      AND b.NFSDOC_REE_ATU = 1
      AND b.TIPOPE_L <> 3
      AND a.NFSSIT    = 0
    GROUP BY
      a.NFSSIT,
      b.NUMNFS,   b.CODCLI,      b.CODCLI_CLI,  b.DATEMI,
      b.TIPTER,   b.TIPTER_CADGER,
      b.CTMS_CODOCO_01, b.CTMS_CODOCO_02, b.DATENT_CLI,
      b.DATAGE_NFS, b.EMP_RESP, b.FIL_RESP,
      a.ROMEXP,   f.NOME,
      q.NOME,     r.UF,          b.OBS,
      t.SAC,      t.Descricao,   b.HORCHE,
      b.ROTA,     b.PESBRU_NFS,  b.VOLUME_NFS,  b.QTDVOL_NFS,
      b.VALTOT,   b.HORAGE_NFS,  b.IND_REE,     b.REX_ORI,
      n.NUMDOC_1, z.UF,          n.[DAT-EMI],   n.[DAT-PREENT],
      n.PAGADOR,  d.CGC,         g.CGC,
      h.TIPCLI_FRE_D,
      o.CHAVE,    q.CODMUN,      g.CEP,
      g.BAIRRO,   g.[END],       g.END_NUM,
      b.NUMREF,   b.CHAVEACESSO, b.NFSDOC,
      p.TIPCARGA, p.REGMUN,
      a.DIS_ROM,  a.ROMFOR,
      b.LOCENT_SIT, y.UFALT, y.MUNALT, y.BAIALT, y.ENDALT,
      b.TIPOPE_L, n.TIPDOC,
      b.EMPRESA,  b.FILIAL,      n.EMP_SIG,     n.FIL_SIG,
      b.COD_SAC
    ORDER BY b.NUMNFS
  `)
  return result.recordset
}

export async function queryVeiculosDisponiveis(): Promise<SiatRow[]> {
  const db = await getSiatPool()
  const result = await db.request().batch<SiatRow>(`
    SET DATEFORMAT YMD;

    SELECT
      d.VEISIT_D                           AS Situacao,
      a.PLACA                              AS Placa,
      a.MODELO                             AS Modelo,
      CASE
        WHEN a.CATEGORIA = 1 THEN 'Cavalo Mecânico'
        WHEN a.CATEGORIA = 2 THEN 'Caminhão'
        WHEN a.CATEGORIA = 3 THEN 'Semirreboque'
        WHEN a.CATEGORIA = 4 THEN 'Utilitário'
        ELSE 'Outros'
      END                                  AS Categoria,
      a.TIPVEI                             AS TipoVeiculoCodigo,
      e.DESCRICAO                          AS TipoVeiculo,
      a.TIPCAR                             AS TipoCarroceriaCodigo,
      f.DESCRICAO                          AS TipoCarroceria,
      a.CAPACIDADE                         AS CapacidadeKg,
      a.PBT                                AS PBT,
      a.CUBAGEM_P                          AS VolumeM3,
      c.MOTORISTA                          AS CodMotorista,
      c.NOME                               AS NomeMotorista,
      CONCAT(c.FONE_DDD,    '-', c.FONE)   AS Telefone,
      CONCAT(c.CELULAR_DDD, '-', c.CELULAR) AS Celular
    FROM [TAB DE VEICULOS] a
    LEFT JOIN [TAB MOT ADM] b         ON b.PLACA_VEI = a.PLACA
    LEFT JOIN [TAB DE MOTORISTAS] c   ON c.MOTORISTA = b.MOTORISTA
    LEFT JOIN [TAB VEISIT] d          ON d.VEISIT    = a.VEISIT
    LEFT JOIN [TAB TIPO VEICULO] e    ON e.TIPVEI    = a.TIPVEI
    LEFT JOIN [TAB TIPO CARROCERIA] f ON f.TIPCAR    = a.TIPCAR
    ORDER BY a.PLACA
  `)
  return result.recordset
}
