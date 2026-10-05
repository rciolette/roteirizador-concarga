'use client'

/**
 * Relatório de separação das notas físicas (Marcelo, 02/10):
 * "Precisamos de um relatório semelhante a esse, com quebra de página por cada
 *  rota gerada, para separação das notas fiscais."
 *
 * Abre uma janela pronta para impressão (A4 paisagem), UMA PÁGINA POR CARGA.
 * Nada é enviado para servidor nenhum: o HTML é montado aqui e impresso pelo
 * próprio navegador, que também salva em PDF.
 */
import type { Rota } from '@/types'

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

const num = (n: number | null | undefined, casas = 0): string =>
  n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

const dataBR = (iso: string | null | undefined): string =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

function rotasDeEntrega(rota: Rota): string {
  const cods = [...new Set(rota.notasFiscais.map(n => (n.rota ?? '').trim()).filter(r => r && r !== '—'))]
  return cods.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).join(' · ') || rota.codigoRota
}

function paginaDaCarga(rota: Rota, emitidoEm: string): string {
  const nfs = [...rota.notasFiscais].sort((a, b) =>
    (a.sequencia ?? 0) - (b.sequencia ?? 0) ||
    a.destinatario.localeCompare(b.destinatario, 'pt-BR'))

  const entregas = new Set(nfs.map(n => (n.destinatario ?? '').trim().toUpperCase())).size
  const pesoKg   = nfs.reduce((s, n) => s + (n.peso ?? 0), 0)
  const volume   = nfs.reduce((s, n) => s + (n.volume ?? 0), 0)

  const linhas = nfs.map((n, i) => {
    const reentrega = n.indRee || (n.indiceReentrega ?? 0) > 0
    const alertaSac = Boolean(n.solucaoSac) && !n.indRee && (n.solucaoSac ?? '').trim().toUpperCase() !== 'REENTREGA'
    const cls = reentrega ? 'ree' : alertaSac ? 'sac' : ''
    const local = [n.bairro, n.municipio].filter(x => x && x !== '—').join(' / ')
    return `<tr class="${cls}">
      <td class="c">${i + 1}</td>
      <td class="mono">${esc(n.numnfs)}</td>
      <td>${esc(n.destinatario)}</td>
      <td>${esc(local)}</td>
      <td class="mono">${esc((n.rota ?? '').trim())}</td>
      <td class="c">${(n.indiceReentrega ?? 0) > 0 ? esc(n.indiceReentrega) : reentrega ? 'sim' : ''}</td>
      <td class="r">${num(n.peso, 1)}</td>
      <td class="r">${n.volume != null ? num(n.volume, 2) : ''}</td>
      <td class="r">${n.qtd != null ? num(n.qtd) : ''}</td>
      <td class="obs">${esc([n.observacao, n.solucaoSac].filter(x => x && x !== '—').join(' · '))}</td>
      <td class="check"></td>
    </tr>`
  }).join('')

  return `<section class="pagina">
    <header>
      <div class="marca">
        <span class="logo">CONCARGA</span>
        <span class="doc">Separação de notas fiscais</span>
      </div>
      <div class="emissao">Emitido em ${esc(emitidoEm)}</div>
    </header>

    <div class="identificacao">
      <div><span>Carga</span><strong>${esc(rota.codigoRota)}</strong></div>
      <div><span>Rotas de entrega</span><strong>${esc(rotasDeEntrega(rota))}</strong></div>
      <div><span>Veículo</span><strong>${esc(rota.veiculo ? `${rota.veiculo.placa} | ${rota.veiculo.tipo}` : 'placa a definir')}</strong></div>
      <div><span>Motorista</span><strong>${esc(rota.motorista?.nome ?? '—')}</strong></div>
      <div><span>Data</span><strong>${esc(dataBR(rota.data))}</strong></div>
      <div><span>Situação</span><strong>${esc(rota.status)}</strong></div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="c">#</th><th>NF</th><th>Destinatário</th><th>Bairro / Município</th>
          <th>Rota</th><th class="c">Reent.</th><th class="r">Peso (kg)</th>
          <th class="r">Vol. (m³)</th><th class="r">Qtd</th><th>Observação</th><th class="check">OK</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
      <tfoot>
        <tr>
          <td colspan="6">${nfs.length} NFs · ${entregas} entrega${entregas === 1 ? '' : 's'}</td>
          <td class="r">${num(pesoKg, 1)}</td>
          <td class="r">${volume > 0 ? num(volume, 2) : ''}</td>
          <td colspan="3"></td>
        </tr>
      </tfoot>
    </table>

    <footer>
      <div class="assinatura"><span></span>Separado por</div>
      <div class="assinatura"><span></span>Conferido por</div>
      <div class="assinatura"><span></span>Motorista — recebi as notas acima</div>
    </footer>
  </section>`
}

const ESTILO = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #17222E; margin: 0; font-size: 10px; }
  .pagina { page-break-after: always; padding: 0 0 6mm; }
  .pagina:last-child { page-break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-end;
           border-bottom: 2px solid #1B4F8A; padding-bottom: 4px; }
  .logo { font-size: 17px; font-weight: 800; letter-spacing: .06em; color: #1B4F8A; }
  .doc { font-size: 11px; margin-left: 10px; color: #4B5C6E; }
  .emissao { font-size: 9px; color: #7C8A99; }
  .identificacao { display: flex; flex-wrap: wrap; gap: 4px 22px; margin: 6px 0 7px; }
  .identificacao div { display: flex; flex-direction: column; }
  .identificacao span { font-size: 7.5px; text-transform: uppercase; letter-spacing: .07em; color: #7C8A99; }
  .identificacao strong { font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #E9F0F7; font-size: 8px; text-transform: uppercase; letter-spacing: .05em;
       text-align: left; padding: 4px 5px; border-bottom: 1px solid #1B4F8A; color: #17222E; }
  td { padding: 3px 5px; border-bottom: 1px solid #D2DEE9; vertical-align: top; }
  tbody tr.ree { background: #F8DAD7; }
  tbody tr.sac { background: #FBEEDA; }
  tfoot td { font-weight: 700; border-top: 1.5px solid #1B4F8A; border-bottom: none; padding-top: 5px; }
  .c { text-align: center; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-family: 'SF Mono', Menlo, Consolas, monospace; white-space: nowrap; }
  .obs { font-size: 8.5px; color: #4B5C6E; max-width: 160px; }
  .check { width: 34px; border-left: 1px solid #D2DEE9; }
  tbody .check { height: 14px; }
  footer { display: flex; gap: 28px; margin-top: 12mm; }
  .assinatura { flex: 1; font-size: 8px; color: #7C8A99; text-align: center; }
  .assinatura span { display: block; border-top: 1px solid #17222E; margin-bottom: 3px; }
  @media screen {
    body { background: #E9EEF3; padding: 16px; }
    .pagina { background: #fff; padding: 14mm; margin: 0 auto 16px; max-width: 290mm; box-shadow: 0 1px 4px rgba(0,0,0,.18); }
  }
`

/**
 * Monta e abre o relatório. `rotas` deve vir já filtrada (cargas do dia que
 * valem separação). Devolve false quando o navegador bloqueou o pop-up.
 */
export function abrirRelatorioSeparacao(rotas: Rota[]): boolean {
  const emitidoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const paginas = rotas.map(r => paginaDaCarga(r, emitidoEm)).join('')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Separação de notas — ${esc(dataBR(rotas[0]?.data))}</title>
    <style>${ESTILO}</style></head><body>${paginas}
    <script>window.onload = function () { setTimeout(function () { window.print() }, 350) }<\/script>
    </body></html>`

  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(html)
  win.document.close()
  return true
}
