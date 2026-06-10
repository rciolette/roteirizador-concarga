'use client'

// Cache de sessão (em memória) + cache persistente via /api/geocode.
// O cache de sessão evita chamadas repetidas na mesma aba; o Supabase persiste entre sessões.

export interface LatLng { lat: number; lng: number }

const sessionCache = new Map<string, LatLng | null>()

/**
 * Monta a chave de geocoding a partir dos campos de endereço da NF.
 * Ordem: municipio, bairro, cep — filtra vazios e '—'.
 */
export function addrKey(parts: (string | undefined | null)[]): string {
  return parts
    .filter((p): p is string => Boolean(p) && p !== '—')
    .join(', ')
}

/**
 * Geocodifica um lote de endereços usando o cache de sessão e o cache
 * persistente do servidor. Endereços sem resultado ficam como null.
 */
export async function geocodeMany(
  addresses: string[],
): Promise<Map<string, LatLng | null>> {
  const result  = new Map<string, LatLng | null>()
  const uncached: string[] = []

  for (const addr of addresses) {
    if (sessionCache.has(addr)) {
      result.set(addr, sessionCache.get(addr)!)
    } else {
      uncached.push(addr)
    }
  }

  if (uncached.length) {
    try {
      const res = await fetch('/api/geocode', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ addresses: uncached }),
      })
      if (res.ok) {
        const data = (await res.json()) as { results: Record<string, LatLng | null> }
        for (const [addr, coord] of Object.entries(data.results)) {
          sessionCache.set(addr, coord)
          result.set(addr, coord)
        }
      }
    } catch {
      // silencioso — endereços sem resultado ficam undefined na Map
    }
  }

  return result
}
