'use client'

// Cache de sessão (em memória) + cache persistente via /api/geocode.
// O cache de sessão evita chamadas repetidas na mesma aba; o Supabase persiste entre sessões.

import { normalizarCep, formatarCep } from '@/lib/utils'

export interface LatLng { lat: number; lng: number }

const sessionCache = new Map<string, LatLng | null>()

const UFS = new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])

/** Só aceita UF real de 2 letras — um bairro chamado "Pernambuco" nunca vira UF. */
export function ufValida(uf: string | null | undefined): string | null {
  const u = (uf ?? '').trim().toUpperCase()
  return UFS.has(u) ? u : null
}

/**
 * Monta a chave de geocoding a partir dos campos de endereço da NF.
 * Filtra vazios e '—'.
 */
export function addrKey(parts: (string | undefined | null)[]): string {
  return parts
    .filter((p): p is string => Boolean(p) && p !== '—')
    .join(', ')
}

/**
 * Chave de geocoding de uma NF (espec Rotas do Dia, item 5):
 * rua + número + bairro + município/UF + CEP. O CEP é referência, não a única
 * fonte; a UF só entra quando é uma sigla válida, para um bairro nunca ser lido
 * como estado. Exemplo validado: `Rua Dois, 51, Pernambuco, Bocaiúva - MG, 33390-000`.
 *
 * Cozinha (EA): `nf.endereco` já vem do endereço ALTERNATIVO do SIAT (ENDALT) —
 * é ele que manda, nunca o endereço do remetente/cadastro.
 */
export function addrKeyNota(nf: {
  tipoCliente?: string
  endereco?: string
  numero?: string
  municipio?: string
  bairro?: string
  uf?: string
  cep?: string
}): string {
  const rua       = nf.endereco && nf.endereco !== '—' ? nf.endereco.trim() : ''
  const numero    = nf.numero && nf.numero !== '—' ? nf.numero.trim() : ''
  const logradouro = rua ? (numero && !rua.includes(numero) ? `${rua}, ${numero}` : rua) : ''
  const uf        = ufValida(nf.uf)
  const municipio = nf.municipio && nf.municipio !== '—' ? nf.municipio.trim() : ''
  const cidadeUf  = municipio ? (uf ? `${municipio} - ${uf}` : municipio) : (uf ?? '')
  const cep       = normalizarCep(nf.cep) ? formatarCep(nf.cep) : ''
  const bairro    = nf.bairro && nf.bairro !== '—' ? nf.bairro.trim() : ''

  const chave = addrKey([logradouro, bairro, cidadeUf, cep])
  return chave ? `${chave}, Brasil` : ''
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
