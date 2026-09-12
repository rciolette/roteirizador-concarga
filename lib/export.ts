import type { Rota } from '@/types'
import type { MotoristaDaFrota, VeiculoDaFrota } from '@/lib/frota'
import { rotuloVeiculo } from '@/lib/utils'

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

// ── Exportação de rotas APROVADAS (espec Rotas do Dia, item 9) ────────────────
// Uma linha por rota, NFs concatenadas sem repetição. Rejeitadas/rascunho/
// aguardando ficam de fora. Se houver NF ou veículo repetido entre as rotas
// exportadas, a exportação é bloqueada com a lista do que está inconsistente.

export class ExportacaoInconsistente extends Error {
  constructor(public problemas: string[]) {
    super(`Exportação bloqueada: ${problemas.join(' · ')}`)
    this.name = 'ExportacaoInconsistente'
  }
}

export interface OpcoesExportRotas {
  /** `enviada` é subconjunto de aprovada — entra por padrão. */
  incluirEnviadas?: boolean
}

export function rotasParaLinhasAprovadas(rotas: Rota[], opts: OpcoesExportRotas = {}): Record<string, unknown>[] {
  const incluirEnviadas = opts.incluirEnviadas ?? true
  const aprovadas = rotas.filter(r => r.status === 'aprovada' || (incluirEnviadas && r.status === 'enviada'))

  const problemas: string[] = []
  const nfVista  = new Map<string, string>()
  const veicVisto = new Map<string, string>()
  for (const r of aprovadas) {
    const chaveVeic = r.veiculoId ?? r.veiculo?.placa
    if (chaveVeic) {
      const outra = veicVisto.get(chaveVeic)
      if (outra) problemas.push(`veículo ${r.veiculo?.placa ?? chaveVeic} em ${outra} e ${r.codigoRota}`)
      else veicVisto.set(chaveVeic, r.codigoRota)
    }
    for (const nf of new Set(r.notasFiscais.map(n => n.numnfs))) {
      const outra = nfVista.get(nf)
      if (outra) problemas.push(`NF ${nf} em ${outra} e ${r.codigoRota}`)
      else nfVista.set(nf, r.codigoRota)
    }
    if (!r.veiculo?.placa) problemas.push(`rota ${r.codigoRota} sem veículo`)
    if (r.notasFiscais.length === 0) problemas.push(`rota ${r.codigoRota} sem NFs carregadas`)
  }
  if (problemas.length) throw new ExportacaoInconsistente(problemas)

  return aprovadas.map(r => {
    const nfs = [...new Set(r.notasFiscais.map(n => n.numnfs))]
    const rotasEntrega = [...new Set(r.notasFiscais.map(n => n.rota).filter(x => x && x !== '—'))]
    return {
      'Data':              r.data,
      'Cód. Rota':         r.codigoRota,
      'Rotas de Entrega':  rotasEntrega.join(';'),
      'Região':            r.regiao ?? '',
      'Status':            r.status,
      'Veículo':           rotuloVeiculo(r.veiculo),
      'Placa':             r.veiculo?.placa ?? '',
      'Sigla':             r.veiculo?.sigla ?? r.motorista?.sigla ?? '',
      'Tipo':              r.veiculo?.tipo ?? '',
      'Motorista':         r.motorista?.nome ?? '',
      'Celular':           r.motorista?.telefone ?? '',
      'Peso Total (kg)':   r.pesoTotal,
      'Volume (m³)':       r.volumeTotal ?? '',
      'Caixas':            r.caixasTotal ?? '',
      'Cap. (kg)':         r.veiculo?.capacidadeKg ?? '',
      'Ocupação %':        r.ocupacaoPercent ?? '',
      'Qtd NFs':           nfs.length,
      'NFs':               nfs.join(';'),
      'Aprovada em':       r.status === 'aprovada' || r.status === 'enviada' ? (r.enviadoEm ?? '') : '',
    }
  })
}
