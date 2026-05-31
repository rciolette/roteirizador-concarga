import type { Rota } from '@/types'
import type { MotoristaDaFrota, VeiculoDaFrota } from '@/lib/frota'

// ── Download helpers ──────────────────────────────────────────────────────────

function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportarCSV(rows: Record<string, unknown>[], nomeArquivo: string) {
  const Papa = (await import('papaparse')).default
  const csv  = Papa.unparse(rows)
  baixarBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), `${nomeArquivo}.csv`)
}

export async function exportarXLSX(rows: Record<string, unknown>[], nomeArquivo: string) {
  const XLSX = await import('xlsx')
  const ws   = XLSX.utils.json_to_sheet(rows)
  const wb   = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  XLSX.writeFile(wb, `${nomeArquivo}.xlsx`)
}

// ── Transformadores de dados ──────────────────────────────────────────────────

export function rotasParaLinhas(rotas: Rota[]): Record<string, unknown>[] {
  return rotas.flatMap(rota =>
    rota.notasFiscais.length > 0
      ? rota.notasFiscais.map(nf => ({
          'Data':           rota.data,
          'Cód. Rota':      rota.codigoRota,
          'Região':         rota.regiao ?? '',
          'Status':         rota.status,
          'Motorista':      rota.motorista?.nome ?? '',
          'Veículo':        rota.veiculo?.placa  ?? '',
          'Peso Total (kg)': rota.pesoTotal,
          'Qtd NFs':        rota.qtdNotas,
          'NF':             nf.numnfs,
          'Destinatário':   nf.destinatario,
          'Município':      nf.municipio,
          'Bairro':         nf.bairro,
          'Endereço':       nf.endereco,
          'Peso NF (kg)':   nf.peso,
          'Tipo Cliente':   nf.tipoCliente,
          'COND':           nf.cond,
        }))
      : [{
          'Data':            rota.data,
          'Cód. Rota':       rota.codigoRota,
          'Região':          rota.regiao ?? '',
          'Status':          rota.status,
          'Motorista':       rota.motorista?.nome ?? '',
          'Veículo':         rota.veiculo?.placa  ?? '',
          'Peso Total (kg)': rota.pesoTotal,
          'Qtd NFs':         rota.qtdNotas,
          'NF': '', 'Destinatário': '', 'Município': '', 'Bairro': '',
          'Endereço': '', 'Peso NF (kg)': 0, 'Tipo Cliente': '', 'COND': '',
        }]
  )
}

export function motoristasParaLinhas(motoristas: MotoristaDaFrota[]): Record<string, unknown>[] {
  return motoristas.map(m => ({
    'Nome':       m.nome,
    'Sigla':      m.sigla,
    'Cód. SIAT':  m.codigo_siat ?? '',
    'Telefone':   m.telefone,
    'Celular':    m.celular,
    'Ativo':      m.ativo ? 'Sim' : 'Não',
  }))
}

export function veiculosParaLinhas(veiculos: VeiculoDaFrota[]): Record<string, unknown>[] {
  return veiculos.map(v => ({
    'Placa':          v.placa,
    'Modelo':         v.modelo,
    'Categoria':      v.categoria,
    'Tipo Veículo':   v.tipo_veiculo,
    'Tipo Carroceria': v.tipo_carroceria,
    'Cap. (kg)':      v.capacidade_kg,
    'PBT (kg)':       v.pbt ?? '',
    'Vol. (m³)':      v.volume_m3 ?? '',
    'Situação SIAT':  v.situacao_siat,
    'Motorista':      v.motorista_nome ?? '',
    'Ativo':          v.ativo ? 'Sim' : 'Não',
    'Disponível hoje': v.disponivel_hoje ? 'Sim' : 'Não',
  }))
}
