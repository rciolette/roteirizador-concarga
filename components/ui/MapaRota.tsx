'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer } from '@react-google-maps/api'
import type { NotaFiscal } from '@/types'
import { cn } from '@/lib/utils'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
// Fora do componente para evitar recarregamento da API a cada render
const LIBRARIES: ('places' | 'geometry')[] = []
const BH_CENTER = { lat: -19.9167, lng: -43.9345 }
const MAX_PINS = 25

// Cache de sessão: evita chamadas repetidas à Geocoding API para o mesmo endereço
const geocodeCache = new Map<string, { lat: number; lng: number } | null>()

interface LatLng { lat: number; lng: number }

export interface MapaRotaProps {
  nfs: NotaFiscal[]
  height?: string
  className?: string
}

export function MapaRota({ nfs, height = '280px', className }: MapaRotaProps) {
  if (!API_KEY) {
    return (
      <div
        style={{ height }}
        className={cn(
          'rounded-lg bg-cream flex items-center justify-center border border-[0.5px] border-[var(--border-subtle)]',
          className,
        )}
      >
        <p className="text-[11px] text-muted text-center px-4">
          Mapa indisponível — configure{' '}
          <code className="font-mono bg-cream-hover px-1 py-px rounded text-[10px]">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </code>{' '}
          no .env.local
        </p>
      </div>
    )
  }

  if (nfs.length === 0) return null

  return <MapaRotaInner nfs={nfs.slice(0, MAX_PINS)} height={height} className={className} />
}

function MapaRotaInner({ nfs, height = '280px', className }: MapaRotaProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  })

  const mapRef = useRef<google.maps.Map | null>(null)
  const [coords, setCoords]       = useState<(LatLng | null)[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [activePin, setActivePin] = useState<number | null>(null)

  const onLoad    = useCallback((map: google.maps.Map) => { mapRef.current = map }, [])
  const onUnmount = useCallback(() => { mapRef.current = null }, [])

  // Geocodifica endereços usando municipio + bairro + cep (com cache de sessão)
  useEffect(() => {
    if (!isLoaded || nfs.length === 0) return

    setGeocoding(true)
    setCoords([])
    setDirections(null)
    setActivePin(null)

    const geocoder = new google.maps.Geocoder()

    const promises = nfs.map(nf => {
      const address = [nf.municipio, nf.bairro, nf.cep].filter(Boolean).join(', ')

      if (geocodeCache.has(address)) {
        const cached = geocodeCache.get(address)
        return Promise.resolve(cached ?? null)
      }

      return new Promise<LatLng | null>(resolve => {
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const loc = results[0].geometry.location
            const result: LatLng = { lat: loc.lat(), lng: loc.lng() }
            geocodeCache.set(address, result)
            resolve(result)
          } else {
            geocodeCache.set(address, null)
            resolve(null)
          }
        })
      })
    })

    Promise.all(promises).then(results => {
      setCoords(results)
      setGeocoding(false)

      const valid = results.filter((c): c is LatLng => c !== null)
      if (valid.length > 0 && mapRef.current) {
        const bounds = new google.maps.LatLngBounds()
        valid.forEach(c => bounds.extend(c))
        mapRef.current.fitBounds(bounds, 48)
      }
    })
  }, [isLoaded, nfs])

  // Traça rota (silencioso se a chave não tiver permissão para Directions API)
  useEffect(() => {
    const valid = coords.filter((c): c is LatLng => c !== null)
    if (!isLoaded || valid.length < 2) return

    const service = new google.maps.DirectionsService()
    service.route(
      {
        origin:           valid[0],
        destination:      valid[valid.length - 1],
        waypoints:        valid.slice(1, -1).slice(0, 23).map(loc => ({ location: loc, stopover: true })),
        travelMode:       google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === 'OK' && result) setDirections(result)
      },
    )
  }, [isLoaded, coords])

  // ── Skeleton enquanto carrega API ou geocodifica ───────────────────────────
  if (loadError) {
    return (
      <div
        style={{ height }}
        className={cn(
          'rounded-lg bg-cream flex items-center justify-center border border-[0.5px] border-[var(--border-subtle)]',
          className,
        )}
      >
        <p className="text-[11px] text-danger text-center px-4">Erro ao carregar o Google Maps.</p>
      </div>
    )
  }

  if (!isLoaded || geocoding) {
    return (
      <div
        style={{ height }}
        className={cn(
          'rounded-lg bg-cream-hover animate-pulse border border-[0.5px] border-[var(--border-subtle)]',
          className,
        )}
      />
    )
  }

  const center = coords.find((c): c is LatLng => c !== null) ?? BH_CENTER

  return (
    <div className={cn('relative rounded-lg overflow-hidden border border-[0.5px] border-[var(--border-subtle)]', className)}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height }}
        center={center}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          mapTypeControl:    false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl:       true,
          clickableIcons:    false,
        }}
      >
        {/* Polyline da rota — sem os markers padrão A/B/C */}
        {directions && (
          <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />
        )}

        {/* Markers numerados: coords[i] pode ser null se geocodificação falhou */}
        {coords.map((coord, i) => {
          if (!coord) return null
          return (
            <Marker
              key={i}
              position={coord}
              label={{ text: String(i + 1), color: 'white', fontWeight: 'bold', fontSize: '11px' }}
              onClick={() => setActivePin(prev => (prev === i ? null : i))}
            />
          )
        })}

        {/* InfoWindow ao clicar num pin */}
        {activePin !== null && coords[activePin] && (
          <InfoWindow position={coords[activePin]!} onCloseClick={() => setActivePin(null)}>
            <div style={{ fontSize: '12px', lineHeight: '1.6', maxInlineSize: '200px' }}>
              <div style={{ fontWeight: 700, marginBlockEnd: '2px' }}>
                NF {nfs[activePin].numnfs}
              </div>
              <div style={{ color: '#374151' }}>{nfs[activePin].destinatario}</div>
              <div style={{ color: '#6B7280', fontSize: '11px', marginBlockStart: '2px' }}>
                {nfs[activePin].endereco}
                {nfs[activePin].bairro ? `, ${nfs[activePin].bairro}` : ''}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  )
}
