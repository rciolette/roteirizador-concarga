'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api'
import type { NotaFiscal } from '@/types'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
// Definido fora do componente para evitar recarregamento da API
const LIBRARIES: ('places' | 'geometry')[] = []
const BH_CENTER = { lat: -19.9167, lng: -43.9345 }

interface LatLng { lat: number; lng: number }

export interface MapaRotaProps {
  nfs: NotaFiscal[]
  height?: string
}

export function MapaRota({ nfs, height = '300px' }: MapaRotaProps) {
  if (!API_KEY) {
    return (
      <div
        style={{ height }}
        className="rounded-lg bg-cream flex items-center justify-center border border-[0.5px] border-[var(--border-subtle)]"
      >
        <p className="text-[11px] text-muted text-center px-4">
          Configure{' '}
          <code className="font-mono bg-cream-hover px-1 py-px rounded text-[10px]">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </code>{' '}
          no .env para ativar o mapa.
        </p>
      </div>
    )
  }

  if (nfs.length === 0) return null

  return <MapaRotaInner nfs={nfs} height={height} />
}

function MapaRotaInner({ nfs, height }: Required<MapaRotaProps>) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  })

  const mapRef = useRef<google.maps.Map | null>(null)
  const [coords, setCoords] = useState<(LatLng | null)[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  const onUnmount = useCallback(() => {
    mapRef.current = null
  }, [])

  // Geocodifica endereços ao carregar o mapa
  useEffect(() => {
    if (!isLoaded || nfs.length === 0) return

    setGeocoding(true)
    setCoords([])
    setDirections(null)

    const geocoder = new google.maps.Geocoder()

    const promises = nfs.map(nf => {
      const parts = [nf.endereco, nf.bairro, nf.municipio, 'MG, Brasil'].filter(Boolean)
      const address = parts.join(', ')
      return new Promise<LatLng | null>(resolve => {
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const loc = results[0].geometry.location
            resolve({ lat: loc.lat(), lng: loc.lng() })
          } else {
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

  // Traça a rota após geocodificar (silencioso se a chave não tiver permissão)
  useEffect(() => {
    const valid = coords.filter((c): c is LatLng => c !== null)
    if (!isLoaded || valid.length < 2) return

    const service = new google.maps.DirectionsService()
    service.route(
      {
        origin: valid[0],
        destination: valid[valid.length - 1],
        waypoints: valid.slice(1, -1).slice(0, 23).map(loc => ({ location: loc, stopover: true })),
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === 'OK' && result) setDirections(result)
      }
    )
  }, [isLoaded, coords])

  if (loadError) {
    return (
      <div
        style={{ height }}
        className="rounded-lg bg-cream flex items-center justify-center border border-[0.5px] border-[var(--border-subtle)]"
      >
        <p className="text-[11px] text-danger text-center px-4">Erro ao carregar o Google Maps.</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div
        style={{ height }}
        className="rounded-lg bg-cream-hover animate-pulse border border-[0.5px] border-[var(--border-subtle)]"
      />
    )
  }

  const validCoords = coords.filter((c): c is LatLng => c !== null)
  const center = validCoords[0] ?? BH_CENTER

  return (
    <div className="relative rounded-lg overflow-hidden border border-[0.5px] border-[var(--border-subtle)]">
      {geocoding && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-white/90 dark:bg-[#1E1E1C]/90 px-2.5 py-1 rounded-full text-[10px] text-muted shadow-sm pointer-events-none">
          Geocodificando endereços...
        </div>
      )}
      <GoogleMap
        mapContainerStyle={{ width: '100%', height }}
        center={center}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          clickableIcons: false,
        }}
      >
        {/* Polyline da rota, sem os markers padrão A/B/C */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{ suppressMarkers: true }}
          />
        )}

        {/* Markers numerados na ordem da lista de NFs */}
        {validCoords.map((coord, i) => (
          <Marker
            key={i}
            position={coord}
            label={{
              text: String(i + 1),
              color: 'white',
              fontWeight: 'bold',
              fontSize: '11px',
            }}
          />
        ))}
      </GoogleMap>
    </div>
  )
}
