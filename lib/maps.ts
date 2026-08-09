import type { NotaFiscal } from '@/types'

// O Google Maps aceita origem + destino + 23 pontos intermediários numa URL
// `/dir/`. Acima disso ele ignora o excedente silenciosamente, então cortamos
// aqui e avisamos quem chamou.
export const MAX_PARADAS_MAPS = 25

export interface LinkMapsResult {
  url: string
  /** Paradas efetivamente incluídas na URL. */
  paradas: number
  /** Paradas que sobraram de fora por causa do limite do Google Maps. */
  truncadas: number
}

function enderecoDaNota(nf: NotaFiscal): string {
  return [nf.endereco, nf.bairro, nf.municipio]
    .filter(p => Boolean(p) && p !== '—')
    .join(', ')
}

/**
 * Monta o link multi-parada do Google Maps na sequência de entrega.
 *
 * Regras:
 * - respeita `sequencia` quando o roteirizador a definiu; senão mantém a ordem
 *   em que as NFs chegaram;
 * - NFs do mesmo endereço viram UMA parada (consolidação por destinatário —
 *   várias notas entregues na mesma porta não são duas paradas no mapa);
 * - a origem (CD) entra como primeiro ponto quando informada.
 */
export function gerarLinkMaps(
  nfs: NotaFiscal[],
  origem?: string | null,
  limite: number = MAX_PARADAS_MAPS,
): LinkMapsResult | null {
  const ordenadas = [...nfs].sort((a, b) => {
    const sa = a.sequencia ?? Number.MAX_SAFE_INTEGER
    const sb = b.sequencia ?? Number.MAX_SAFE_INTEGER
    return sa - sb
  })

  // Consolida mantendo a primeira ocorrência de cada endereço.
  const vistos = new Set<string>()
  const paradas: string[] = []
  for (const nf of ordenadas) {
    const addr = enderecoDaNota(nf)
    if (!addr) continue
    const chave = addr.toUpperCase()
    if (vistos.has(chave)) continue
    vistos.add(chave)
    paradas.push(addr)
  }

  if (paradas.length === 0) return null

  const incluidas = paradas.slice(0, limite)
  const pontos    = origem ? [origem, ...incluidas] : incluidas

  return {
    url: 'https://www.google.com/maps/dir/' +
      pontos.map(p => encodeURIComponent(p).replace(/%20/g, '+')).join('/'),
    paradas:   incluidas.length,
    truncadas: paradas.length - incluidas.length,
  }
}

/** Atalho para quem só quer a URL. */
export function gerarLinkMapsUrl(nfs: NotaFiscal[], origem?: string | null): string | null {
  return gerarLinkMaps(nfs, origem)?.url ?? null
}
