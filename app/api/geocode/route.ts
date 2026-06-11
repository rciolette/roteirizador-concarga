import { getSessaoServidor, getAdminClient } from '@/lib/auth-server'

// Usa chave server-side se disponível; cai na pública (funciona de servidor p/ servidor)
const GOOGLE_KEY =
  process.env.GOOGLE_MAPS_API_KEY ??
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
  ''

interface GeocodeRow {
  chave: string
  lat:   number
  lng:   number
}

type CoordResult = { lat: number; lng: number } | null

export async function POST(req: Request) {
  const sessao = await getSessaoServidor()
  if (!sessao)       return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (!sessao.ativo) return Response.json({ error: 'Usuário inativo' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.addresses)) {
    return Response.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const addresses: string[] = (body.addresses as unknown[])
    .filter((a): a is string => typeof a === 'string' && a.trim() !== '')
    .map(a => a.trim())

  if (!addresses.length) return Response.json({ results: {} })

  const sb      = getAdminClient()
  const results: Record<string, CoordResult> = {}

  // 1. Consulta o cache persistente
  const { data: cached } = await sb
    .from('geocode_cache')
    .select('chave, lat, lng')
    .in('chave', addresses)

  const cacheHits = new Set<string>()
  for (const row of (cached ?? []) as GeocodeRow[]) {
    results[row.chave] = { lat: row.lat, lng: row.lng }
    cacheHits.add(row.chave)
  }

  // 2. Geocodifica endereços ausentes via Google Geocoding API
  const missing = addresses.filter(a => !cacheHits.has(a))

  if (missing.length && GOOGLE_KEY) {
    const toInsert: GeocodeRow[] = []

    await Promise.all(
      missing.map(async (address) => {
        try {
          const url =
            `https://maps.googleapis.com/maps/api/geocode/json` +
            `?address=${encodeURIComponent(address)}&region=br&key=${GOOGLE_KEY}`

          const res  = await fetch(url, { signal: AbortSignal.timeout(8_000) })
          const json = await res.json() as {
            status:  string
            results: { geometry: { location: { lat: number; lng: number } } }[]
          }

          if (json.status === 'OK' && json.results?.[0]) {
            const loc = json.results[0].geometry.location
            results[address] = { lat: loc.lat, lng: loc.lng }
            toInsert.push({ chave: address, lat: loc.lat, lng: loc.lng })
          } else {
            results[address] = null
          }
        } catch {
          results[address] = null
        }
      }),
    )

    // 3. Persiste novos resultados no cache
    if (toInsert.length) {
      try {
        await sb.from('geocode_cache').upsert(toInsert, { onConflict: 'chave' })
      } catch { /* silencioso — cache não crítico */ }
    }
  }

  return Response.json({ results })
}
