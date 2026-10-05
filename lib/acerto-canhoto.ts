'use client'

/**
 * ACERTO DE CANHOTO — planilha para separação/conferência das notas físicas.
 * Reproduz o modelo que o Marcelo enviou (Notas021026.pdf, 02/10/2026), agora
 * em XLSX: UMA ABA POR CARGA, que é a "quebra de página por cada rota gerada".
 *
 * Colunas, na ordem do modelo:
 *   NF · Data · Remetente · Destinatario · Endereco Dest · Bairro Dest ·
 *   Municipio Dest · Obs Completa · PLACA · Peso · PESO · QTD.ENT
 *
 * PESO e QTD.ENT aparecem só na primeira linha: são os totais da carga
 * (peso somado e nº de ENTREGAS = destinatários distintos).
 * Linhas coloridas seguem a condição da nota: vermelha e amarela, como no modelo.
 */
import type { Rota, NotaFiscal } from '@/types'

interface ColunaDef { header: string; largura: number }

const COLUNAS: ColunaDef[] = [
  { header: 'NF',             largura: 10 },
  { header: 'Data',           largura: 11 },
  { header: 'Remetente',      largura: 30 },
  { header: 'Destinatario',   largura: 32 },
  { header: 'Endereco Dest',  largura: 34 },
  { header: 'Bairro Dest',    largura: 20 },
  { header: 'Municipio Dest', largura: 18 },
  { header: 'Obs Completa',   largura: 22 },
  { header: 'PLACA',          largura: 14 },
  { header: 'Peso',           largura: 10 },
  { header: 'PESO',           largura: 12 },
  { header: 'QTD.ENT',        largura: 9  },
]

const FMT_PESO = '#,##0.###'

/** Cores do modelo: vermelho e amarelo da condição da nota. */
const FILL_VERMELHO = 'FFF4847C'
const FONT_VERMELHO = 'FF7F0000'
const FILL_AMARELO  = 'FFFFE066'
const FONT_AMARELO  = 'FF7F6000'

const txt = (v: unknown): string => {
  const s = String(v ?? '').trim()
  return s && s !== '—' ? s : ''
}

const dataBR = (iso: string | null | undefined): string =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

/** Nome de aba válido no Excel: sem []:*?/\ e no máximo 31 caracteres. */
function nomeAba(codigo: string, usados: Set<string>): string {
  const base = (codigo || 'CARGA').replace(/[[\]:*?/\\]/g, '-').slice(0, 28).trim() || 'CARGA'
  let nome = base
  let i = 2
  while (usados.has(nome.toLowerCase())) nome = `${base.slice(0, 26)} ${i++}`
  usados.add(nome.toLowerCase())
  return nome
}

/** Condição da nota para a cor da linha (vermelho/amarelo), como no modelo. */
function corDaLinha(nf: NotaFiscal): 'vermelho' | 'amarelo' | null {
  if (nf.indRee || (nf.indiceReentrega ?? 0) > 0 || nf.cond === 'vermelho') return 'vermelho'
  if (nf.cond === 'laranja') return 'amarelo'
  const sacPendente = Boolean(nf.solucaoSac) && (nf.solucaoSac ?? '').trim().toUpperCase() !== 'REENTREGA'
  return sacPendente ? 'amarelo' : null
}

/**
 * Gera o arquivo e dispara o download. Uma aba por carga.
 * Devolve quantas abas (cargas) entraram no arquivo.
 */
export async function baixarAcertoDeCanhoto(rotas: Rota[]): Promise<number> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Roteirizador Concarga'
  wb.created = new Date()

  const agora = new Date()
  const emitidoEm = agora.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const usados = new Set<string>()

  for (const rota of rotas) {
    const ws = wb.addWorksheet(nomeAba(rota.codigoRota, usados), {
      pageSetup: {
        orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.6, header: 0.2, footer: 0.3 },
        printTitlesRow: '4:4',
      },
      headerFooter: {
        oddFooter: '&L&"Calibri,Bold"&9OBSERVAÇÕES:&R&9ASS.MOTORISTA______________________     ASS.CONCARGA______________________     DATA:_____/_____/_____',
      },
    })

    COLUNAS.forEach((c, i) => { ws.getColumn(i + 1).width = c.largura })

    // ── Cabeçalho: marca, título e emissão ──────────────────────────────────
    const logo = ws.getCell('A1')
    logo.value = 'CONCARGA'
    logo.font = { bold: true, size: 16, color: { argb: 'FF00A651' }, name: 'Calibri' }
    ws.getCell('A2').value = 'LOGÍSTICA'
    ws.getCell('A2').font = { bold: true, size: 8, color: { argb: 'FF4B5C6E' } }

    ws.mergeCells('D1:G1')
    const titulo = ws.getCell('D1')
    titulo.value = 'ACERTO DE CANHOTO'
    titulo.font = { bold: true, size: 11 }
    titulo.alignment = { horizontal: 'center' }

    ws.mergeCells('K1:L1')
    const emissao = ws.getCell('K1')
    emissao.value = emitidoEm
    emissao.font = { size: 8, color: { argb: 'FF4B5C6E' } }
    emissao.alignment = { horizontal: 'right' }

    // Identificação da carga — o modelo traz a placa em cada linha; aqui fica
    // também no topo porque uma carga pode ter várias rotas de entrega.
    const codsEntrega = [...new Set(rota.notasFiscais.map(n => txt(n.rota)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }))
    ws.mergeCells('A3:G3')
    const ident = ws.getCell('A3')
    ident.value = `Carga ${rota.codigoRota}`
      + (codsEntrega.length ? `   ·   Rotas de entrega: ${codsEntrega.join(' · ')}` : '')
      + `   ·   ${rota.veiculo ? `${rota.veiculo.placa} | ${rota.veiculo.tipo}` : 'placa a definir'}`
      + `   ·   ${rota.motorista?.nome ?? '—'}`
      + `   ·   ${dataBR(rota.data)}`
    ident.font = { size: 9, color: { argb: 'FF17222E' } }

    // ── Cabeçalho da tabela (linha 4) ───────────────────────────────────────
    const header = ws.getRow(4)
    COLUNAS.forEach((c, i) => {
      const cel = header.getCell(i + 1)
      cel.value = c.header
      cel.font = { bold: true, size: 9 }
      cel.border = { bottom: { style: 'thin' }, top: { style: 'thin' } }
    })
    header.height = 15

    // ── Linhas das notas ────────────────────────────────────────────────────
    const nfs = [...rota.notasFiscais].sort((a, b) =>
      (a.sequencia ?? 0) - (b.sequencia ?? 0)
      || txt(a.destinatario).localeCompare(txt(b.destinatario), 'pt-BR'))

    const pesoTotal = nfs.reduce((s, n) => s + (n.peso ?? 0), 0)
    const entregas  = new Set(nfs.map(n => txt(n.destinatario).toUpperCase())).size

    nfs.forEach((nf, i) => {
      const linha = ws.getRow(5 + i)
      const valores: (string | number | null)[] = [
        Number(nf.numnfs) || txt(nf.numnfs),
        dataBR(nf.dataEmissao),
        txt(nf.remetente),
        txt(nf.destinatario),
        txt(nf.endereco),
        txt(nf.bairro),
        txt(nf.municipio),
        txt(nf.observacao) || '-',
        rota.veiculo ? rota.veiculo.placa : 'A DEFINIR',
        nf.peso ?? null,
        i === 0 ? pesoTotal : null,
        i === 0 ? entregas  : null,
      ]
      valores.forEach((v, c) => { if (v !== null && v !== '') linha.getCell(c + 1).value = v })

      linha.font = { size: 9 }
      linha.getCell(1).font = { size: 9, bold: true }
      linha.getCell(10).numFmt = FMT_PESO
      linha.getCell(11).numFmt = FMT_PESO
      linha.getCell(11).font = { size: 9, bold: true }
      linha.getCell(12).font = { size: 9, bold: true }

      const cor = corDaLinha(nf)
      if (cor) {
        const fill = cor === 'vermelho' ? FILL_VERMELHO : FILL_AMARELO
        const font = cor === 'vermelho' ? FONT_VERMELHO : FONT_AMARELO
        for (let c = 1; c <= COLUNAS.length; c++) {
          const cel = linha.getCell(c)
          cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
          cel.font = { size: 9, bold: c === 1, color: { argb: font } }
        }
        linha.getCell(10).numFmt = FMT_PESO
        linha.getCell(11).numFmt = FMT_PESO
      }
    })

    // Fecha a caixa da tabela, como no modelo.
    const ultima = ws.getRow(4 + nfs.length)
    for (let c = 1; c <= COLUNAS.length; c++) {
      ultima.getCell(c).border = { ...(ultima.getCell(c).border ?? {}), bottom: { style: 'thin' } }
    }
    for (let r = 4; r <= 4 + nfs.length; r++) {
      ws.getRow(r).getCell(1).border = { ...(ws.getRow(r).getCell(1).border ?? {}), left: { style: 'thin' } }
      ws.getRow(r).getCell(COLUNAS.length).border = {
        ...(ws.getRow(r).getCell(COLUNAS.length).border ?? {}), right: { style: 'thin' },
      }
    }
  }

  const dd = String(agora.getDate()).padStart(2, '0')
  const mm = String(agora.getMonth() + 1).padStart(2, '0')
  const aa = String(agora.getFullYear()).slice(-2)

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Notas${dd}${mm}${aa}.xlsx`
  a.click()
  URL.revokeObjectURL(url)

  return rotas.length
}
