'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import { useAppData } from '@/components/providers/AppDataProvider'
import type { Rota, NotaFiscal } from '@/types'
import { Card, CardHeader } from '@/components/ui'
import { cn } from '@/lib/utils'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
const LIBRARIES: ('places' | 'geometry')[] = []
const BH_CENTER = { lat: -19.9167, lng: -43.9345 }
const geocodeCache = new Map<string, { lat: number; lng: number } | null>()

const ROTA_COLORS = [
  '#1B4F8A',
  '#E55934',
  '#2E8B57',
  '#9333EA',
  '#B8860B',
  '#0891B2',
  '#E11D48',
  '#059669',
]

interface LatLng { lat: number; lng: number }

interface PinInfo {
  rotaId: string
  rotaIdx: number
  nfIdx: number
  nf: NotaFiscal
  coord: LatLng
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function MapaDashboard() {
  const { rotas, loadingRotas } = useAppData()
  const today = todayISO()
  const rotasHoje = rotas.filter(r => r.data === today && r.status !== 'rascunho')

  if (!API_KEY) {
    return (
      <Card>
        <CardHeader>
          <span className="text-xs font-medium">Mapa de rotas — hoje</span>
        </CardHeader>
        <div className="flex items-center justify-center px-4 py-8 text-[11px] text-muted text-center">
          Mapa indisponível — configure{' '}
          <code className="font-mono bg-cream-hover px-1 py-px rounded text-[10px] mx-1">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          </code>{' '}
          no .env.local
        </div>
      </Card>
    )
  }

  if (loadingRotas) {
    return (
      <Card>
        <CardHeader>
          <span className="text-xs font-medium">Mapa de rotas — hoje</span>
        </CardHeader>
        <div className="h-[500px] bg-cream-hover animate-pulse rounded-b-lg" />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <span className="text-xs font-medium">Mapa de rotas — hoje</span>
        <span className="text-[11px] text-muted">
          {rotasHoje.length} rota{rotasHoje.length !== 1 ? 's' : ''}
        </span>
      </CardHeader>
      <MapaDashboardInner rotas={rotasHoje} />
    </Card>
  )
}

function MapaDashboardInner({ rotas }: { rotas: Rota[] }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  })

  const mapRef = useRef<google.maps.Map | null>(null)
  const [pins, setPins] = useState<PinInfo[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [activePin, setActivePin] = useState<PinInfo | null>(null)
  const [selectedRotaId, setSelectedRotaId] = useState<string | null>(null)

  const onLoad    = useCallback((map: google.maps.Map) => { mapRef.current = map }, [])
  const onUnmount = useCallback(() => { mapRef.current = null }, [])

  useEffect(() => {
    if (!isLoaded || rotas.length === 0) {
      setPins([])
      return
    }

    setGeocoding(true)
    setActivePin(null)

    const geocoder = new google.maps.Geocoder()
    const tasks: Promise<PinInfo | null>[] = []

    rotas.forEach((rota, rotaIdx) => {
      rota.notasFiscais.forEach((nf, nfIdx) => {
        const address = [nf.municipio, nf.bairro, nf.cep].filter(Boolean).join(', ')

        tasks.push(new Promise(resolve => {
          if (geocodeCache.has(address)) {
            const cached = geocodeCache.get(address)
            resolve(cached ? { rotaId: rota.id, rotaIdx, nfIdx, nf, coord: cached } : null)
            return
          }
          geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results?.[0]) {
              const loc = results[0].geometry.location
              const coord: LatLng = { lat: loc.lat(), lng: loc.lng() }
              geocodeCache.set(address, coord)
              resolve({ rotaId: rota.id, rotaIdx, nfIdx, nf, coord })
            } else {
              geocodeCache.set(address, null)
              resolve(null)
            }
          })
        }))
      })
    })

    Promise.all(tasks).then(results => {
      const valid = results.filter((p): p is PinInfo => p !== null)
      setPins(valid)
      setGeocoding(false)

      if (valid.length > 0 && mapRef.current) {
        const bounds = new google.maps.LatLngBounds()
        valid.forEach(p => bounds.extend(p.coord))
        mapRef.current.fitBounds(bounds, 48)
      }
    })
  }, [isLoaded, rotas])

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <p className="text-[11px] text-danger text-center px-4">Erro ao carregar o Google Maps.</p>
      </div>
    )
  }

  if (!isLoaded || geocoding) {
    return <div className="h-[500px] bg-cream-hover animate-pulse rounded-b-lg" />
  }

  if (rotas.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] text-[13px] text-muted">
        Nenhuma rota gerada para hoje
      </div>
    )
  }

  return (
    <div className="flex overflow-hidden rounded-b-lg" style={{ height: '500px' }}>
      {/* Sidebar com lista de rotas */}
      <div className="w-[188px] shrink-0 border-r border-[0.5px] border-[var(--border-faint)] overflow-y-auto flex flex-col">
        <div className="px-3 py-[7px] border-b border-[0.5px] border-[var(--border-faint)] sticky top-0 bg-white dark:bg-[#1E1E1C]">
          <span className="text-[10px] uppercase tracking-[0.06em] text-muted font-medium">Rotas do dia</span>
        </div>
        <button
          className={cn(
            'w-full text-left px-3 py-2 text-[11px] border-b border-[0.5px] border-[var(--border-faint)] transition-colors cursor-pointer bg-transparent',
            selectedRotaId === null
              ? 'bg-primary-bg text-primary font-medium'
              : 'text-muted hover:bg-cream',
          )}
          onClick={() => setSelectedRotaId(null)}
        >
          Todas as rotas
        </button>
        {rotas.map((rota, idx) => {
          const color = ROTA_COLORS[idx % ROTA_COLORS.length]
          const isSelected = selectedRotaId === rota.id
          return (
            <button
              key={rota.id}
              className={cn(
                'w-full text-left px-3 py-2 border-b border-[0.5px] border-[var(--border-faint)] transition-colors cursor-pointer bg-transparent flex items-center gap-2',
                isSelected ? 'bg-cream text-base font-medium' : 'text-muted hover:bg-cream',
              )}
              onClick={() => setSelectedRotaId(prev => prev === rota.id ? null : rota.id)}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0 text-[11px]">
                <div className="truncate">{rota.codigoRota}</div>
                {rota.motorista?.nome && (
                  <div className="text-[10px] text-muted truncate">{rota.motorista.nome}</div>
                )}
              </div>
              <span className="text-[10px] text-muted shrink-0">{rota.qtdNotas}</span>
            </button>
          )
        })}
      </div>

      {/* Área do mapa */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={BH_CENTER}
          zoom={11}
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
          {pins.map(pin => {
            const color    = ROTA_COLORS[pin.rotaIdx % ROTA_COLORS.length]
            const isDimmed = selectedRotaId !== null && pin.rotaId !== selectedRotaId

            return (
              <Marker
                key={`${pin.rotaId}-${pin.nfIdx}`}
                position={pin.coord}
                opacity={isDimmed ? 0.2 : 1}
                label={{
                  text:       String(pin.nfIdx + 1),
                  color:      'white',
                  fontWeight: 'bold',
                  fontSize:   '11px',
                }}
                icon={{
                  path:        google.maps.SymbolPath.CIRCLE,
                  fillColor:   color,
                  fillOpacity: 1,
                  strokeColor: 'white',
                  strokeWeight: 2,
                  scale:       14,
                  labelOrigin: new google.maps.Point(0, 0),
                }}
                onClick={() => setActivePin(prev => prev === pin ? null : pin)}
              />
            )
          })}

          {activePin && (
            <InfoWindow position={activePin.coord} onCloseClick={() => setActivePin(null)}>
              <div style={{ fontSize: '12px', lineHeight: '1.6', maxWidth: '200px' }}>
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                  NF {activePin.nf.numnfs}
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}>
                  Seq. {activePin.nfIdx + 1} · {activePin.nf.municipio}
                </div>
                <div style={{ color: '#374151' }}>{activePin.nf.destinatario}</div>
                {activePin.nf.endereco && (
                  <div style={{ color: '#6B7280', fontSize: '11px', marginTop: '2px' }}>
                    {activePin.nf.endereco}
                    {activePin.nf.bairro ? `, ${activePin.nf.bairro}` : ''}
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  )
}
