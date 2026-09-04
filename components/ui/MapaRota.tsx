'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer } from '@react-google-maps/api'
import type { NotaFiscal } from '@/types'
import { cn } from '@/lib/utils'
import { geocodeMany, addrKey, addrKeyNota, type LatLng } from '@/lib/geocode'

const API_KEY   = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
const LIBRARIES: ('places' | 'geometry')[] = []
const BH_CENTER = { lat: -19.9167, lng: -43.9345 }
const MAX_PINS  = 25

export interface MapaRotaProps {
  nfs: NotaFiscal[]
  height?: string
  className?: string
  originAddress?: string
}

export function MapaRota({ nfs, height = '280px', className, originAddress }: MapaRotaProps) {
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

  return <MapaRotaInner nfs={nfs.slice(0, MAX_PINS)} height={height} className={className} originAddress={originAddress} />
}

function MapaRotaInner({ nfs, height = '280px', className, originAddress }: MapaRotaProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  })

  const mapRef = useRef<google.maps.Map | null>(null)
  const [coords, setCoords]           = useState<(LatLng | null)[]>([])
  const [originCoord, setOriginCoord] = useState<LatLng | null>(null)
  const [geocoding, setGeocoding]     = useState(false)
  const [directions, setDirections]   = useState<google.maps.DirectionsResult | null>(null)
  // Posição de entrega de cada NF (1-based) depois que o Google otimiza a ordem.
  // Sem isso o traçado seguia a rota otimizada mas os pins mostravam a ordem
  // original — número do pin não batia com a sequência real.
  const [ordemEntrega, setOrdemEntrega] = useState<Map<number, number>>(new Map())
  const [activePin, setActivePin]     = useState<number | null>(null)

  const onLoad    = useCallback((map: google.maps.Map) => { mapRef.current = map }, [])
  const onUnmount = useCallback(() => { mapRef.current = null }, [])

  // Geocodifica endereços das NFs + endereço de origem (CD) via cache persistente
  useEffect(() => {
    if (!isLoaded || nfs.length === 0) return

    setGeocoding(true)
    setCoords([])
    setOriginCoord(null)
    setDirections(null)
    setActivePin(null)

    const nfAddrs    = nfs.map(nf => addrKeyNota(nf))
    const allAddrs   = originAddress ? [originAddress, ...nfAddrs] : nfAddrs

    geocodeMany(allAddrs).then(coordMap => {
      const origCoord = originAddress ? (coordMap.get(originAddress) ?? null) : null
      const nfCoords  = nfAddrs.map(addr => coordMap.get(addr) ?? null)

      setOriginCoord(origCoord)
      setCoords(nfCoords)
      setGeocoding(false)

      const allValid: LatLng[] = []
      if (origCoord) allValid.push(origCoord)
      nfCoords.forEach(c => { if (c) allValid.push(c) })

      if (allValid.length > 0 && mapRef.current) {
        const bounds = new google.maps.LatLngBounds()
        allValid.forEach(c => bounds.extend(c))
        mapRef.current.fitBounds(bounds, 48)
      }
    })
  }, [isLoaded, nfs, originAddress])

  // Traça rota — usa originCoord como ponto de partida quando disponível
  useEffect(() => {
    const validNfs  = coords.filter((c): c is LatLng => c !== null)
    const allPoints = originCoord ? [originCoord, ...validNfs] : validNfs
    if (!isLoaded || allPoints.length < 2) return

    const service = new google.maps.DirectionsService()
    service.route(
      {
        origin:            allPoints[0],
        destination:       allPoints[allPoints.length - 1],
        waypoints:         allPoints.slice(1, -1).slice(0, 23).map(loc => ({ location: loc, stopover: true })),
        travelMode:        google.maps.TravelMode.DRIVING,
        // Origem fixa no CD; o Google reordena as paradas intermediárias pelo
        // menor trajeto (Raphael, 03/09: sair da Concarga e otimizar as entregas).
        optimizeWaypoints: true,
      },
      (result, status) => {
        if (status !== 'OK' || !result) return
        setDirections(result)

        // waypoint_order traz os waypoints reordenados; origem e destino ficam
        // fixos. Reconstruímos a posição de cada NF a partir disso.
        const ordem = result.routes[0]?.waypoint_order ?? []
        const idxValidos = coords.reduce<number[]>((acc, c, i) => {
          if (c) acc.push(i)
          return acc
        }, [])
        const posicoes = new Map<number, number>()

        if (originCoord) {
          // allPoints = [CD, ...validNfs] → waypoints = validNfs[0..n-2]
          ordem.forEach((wp, pos) => {
            const alvo = idxValidos[wp]
            if (alvo !== undefined) posicoes.set(alvo, pos + 1)
          })
          const ultimo = idxValidos[idxValidos.length - 1]
          if (ultimo !== undefined) posicoes.set(ultimo, idxValidos.length)
        } else {
          // Sem CD: a 1ª NF é a origem e os waypoints começam na 2ª
          const primeiro = idxValidos[0]
          if (primeiro !== undefined) posicoes.set(primeiro, 1)
          ordem.forEach((wp, pos) => {
            const alvo = idxValidos[wp + 1]
            if (alvo !== undefined) posicoes.set(alvo, pos + 2)
          })
          const ultimo = idxValidos[idxValidos.length - 1]
          if (ultimo !== undefined) posicoes.set(ultimo, idxValidos.length)
        }
        setOrdemEntrega(posicoes)
      },
    )
  }, [isLoaded, coords, originCoord])

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

  const center = originCoord ?? coords.find((c): c is LatLng => c !== null) ?? BH_CENTER

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

        {/* Marcador de origem (CD) */}
        {originCoord && (
          <Marker
            position={originCoord}
            label={{ text: 'CD', color: 'white', fontWeight: 'bold', fontSize: '10px' }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 14,
              fillColor: '#1B4F8A',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        )}

        {/* Markers numerados: coords[i] pode ser null se geocodificação falhou */}
        {coords.map((coord, i) => {
          if (!coord) return null
          return (
            <Marker
              key={i}
              position={coord}
              label={{ text: String(ordemEntrega.get(i) ?? i + 1), color: 'white', fontWeight: 'bold', fontSize: '11px' }}
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
