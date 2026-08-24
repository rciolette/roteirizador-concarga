'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  MarkerClustererF,
  InfoWindow,
} from '@react-google-maps/api'
import { useAppData } from '@/components/providers/AppDataProvider'
import type { Rota, NotaFiscal } from '@/types'
import { Card, CardHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { geocodeMany, addrKeyNota, type LatLng } from '@/lib/geocode'

const API_KEY   = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
const LIBRARIES: ('places' | 'geometry')[] = []
const BH_CENTER = { lat: -19.9167, lng: -43.9345 }

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

// NFs pendentes coloridas por TIPO DE CARGA (Marcelo 21/08 — mesma paleta da
// prévia da segmentação; COND saiu de cena junto com a coluna Cond.).
const SEM_TIPO_COLOR = '#6B7280'

// Limite de pins abaixo do qual o clustering não é necessário
const CLUSTER_THRESHOLD = 20

interface PinRota {
  kind:    'rota'
  rotaId:  string
  rotaIdx: number
  nfIdx:   number
  nf:      NotaFiscal
  coord:   LatLng
}

interface PinPendente {
  kind:  'pendente'
  nf:    NotaFiscal
  coord: LatLng
}

type PinInfo = PinRota | PinPendente

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function MapaDashboard() {
  const { rotas, loadingRotas } = useAppData()
  const today     = todayISO()
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
  const { nfsPendentes } = useAppData()

  const { isLoaded, loadError } = useJsApiLoader({
    id:              'google-map-script',
    googleMapsApiKey: API_KEY,
    libraries:       LIBRARIES,
  })

  const mapRef             = useRef<google.maps.Map | null>(null)
  const [pins, setPins]    = useState<PinInfo[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [activePin, setActivePin] = useState<PinInfo | null>(null)
  const [selectedRotaId, setSelectedRotaId] = useState<string | null>(null)

  const onLoad    = useCallback((map: google.maps.Map) => { mapRef.current = map }, [])
  const onUnmount = useCallback(() => { mapRef.current = null }, [])

  // Cor estável por tipo de carga presente nas NFs pendentes
  const corPorTipo = useMemo(() => {
    const tipos = [...new Set(nfsPendentes.map(n => n.grade).filter(t => Boolean(t) && t !== '—'))].sort()
    const map = new Map<string, string>()
    tipos.forEach((t, i) => map.set(t, ROTA_COLORS[i % ROTA_COLORS.length]))
    return map
  }, [nfsPendentes])

  useEffect(() => {
    if (!isLoaded) return

    setGeocoding(true)
    setActivePin(null)

    // Coleta todos os endereços a geocodificar
    type PendingItem =
      | { kind: 'rota'; rotaId: string; rotaIdx: number; nfIdx: number; nf: NotaFiscal; addr: string }
      | { kind: 'pendente'; nf: NotaFiscal; addr: string }

    const items: PendingItem[] = []

    if (rotas.length > 0) {
      rotas.forEach((rota, rotaIdx) => {
        rota.notasFiscais.forEach((nf, nfIdx) => {
          items.push({
            kind: 'rota', rotaId: rota.id, rotaIdx, nfIdx, nf,
            addr: addrKeyNota(nf),
          })
        })
      })
    } else {
      nfsPendentes.forEach(nf => {
        items.push({
          kind: 'pendente', nf,
          addr: addrKeyNota(nf),
        })
      })
    }

    if (!items.length) {
      setPins([])
      setGeocoding(false)
      return
    }

    const addresses = [...new Set(items.map(i => i.addr).filter(Boolean))]

    geocodeMany(addresses).then(coordMap => {
      const valid: PinInfo[] = []

      for (const item of items) {
        const coord = item.addr ? coordMap.get(item.addr) : null
        if (!coord) continue

        if (item.kind === 'rota') {
          valid.push({ kind: 'rota', rotaId: item.rotaId, rotaIdx: item.rotaIdx, nfIdx: item.nfIdx, nf: item.nf, coord })
        } else {
          valid.push({ kind: 'pendente', nf: item.nf, coord })
        }
      }

      setPins(valid)
      setGeocoding(false)

      if (valid.length > 0 && mapRef.current) {
        const bounds = new google.maps.LatLngBounds()
        valid.forEach(p => bounds.extend(p.coord))
        mapRef.current.fitBounds(bounds, 48)
      }
    })
  }, [isLoaded, rotas, nfsPendentes])

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

  const semDados = rotas.length === 0 && nfsPendentes.length === 0
  if (semDados) {
    return (
      <div className="flex items-center justify-center h-[500px] text-[13px] text-muted">
        Nenhuma rota ou NF carregada para hoje
      </div>
    )
  }

  const useClustering = pins.length >= CLUSTER_THRESHOLD

  function pinMarkerProps(pin: PinInfo) {
    const key      = pin.kind === 'rota' ? `r-${pin.rotaId}-${pin.nfIdx}` : `p-${pin.nf.id}`
    const color    = pin.kind === 'rota'
      ? ROTA_COLORS[pin.rotaIdx % ROTA_COLORS.length]
      : corPorTipo.get(pin.nf.grade) ?? SEM_TIPO_COLOR
    const label    = pin.kind === 'rota' ? String(pin.nfIdx + 1) : '·'
    const isDimmed = pin.kind === 'rota' && selectedRotaId !== null && pin.rotaId !== selectedRotaId
    return { key, color, label, isDimmed }
  }

  return (
    <div className="flex overflow-hidden rounded-b-lg" style={{ height: '500px' }}>
      {/* Sidebar com lista de rotas (só quando há rotas) */}
      {rotas.length > 0 && (
        <div className="w-[188px] shrink-0 border-r border-[0.5px] border-[var(--border-faint)] overflow-y-auto flex flex-col">
          <div className="px-3 py-[7px] border-b border-[0.5px] border-[var(--border-faint)] sticky top-0 bg-surface">
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
            const color      = ROTA_COLORS[idx % ROTA_COLORS.length]
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
      )}

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
          {useClustering ? (
            <MarkerClustererF>
              {(clusterer) => (
                <>
                  {pins.map(pin => {
                    const { key, color, label, isDimmed } = pinMarkerProps(pin)
                    return (
                      <Marker
                        key={key}
                        position={pin.coord}
                        opacity={isDimmed ? 0.2 : 1}
                        clusterer={clusterer}
                        label={{ text: label, color: 'white', fontWeight: 'bold', fontSize: '11px' }}
                        icon={{
                          path:         google.maps.SymbolPath.CIRCLE,
                          fillColor:    color,
                          fillOpacity:  1,
                          strokeColor:  'white',
                          strokeWeight: 2,
                          scale:        14,
                          labelOrigin:  new google.maps.Point(0, 0),
                        }}
                        onClick={() => setActivePin(prev => prev === pin ? null : pin)}
                      />
                    )
                  })}
                </>
              )}
            </MarkerClustererF>
          ) : (
            pins.map(pin => {
              const { key, color, label, isDimmed } = pinMarkerProps(pin)
              return (
                <Marker
                  key={key}
                  position={pin.coord}
                  opacity={isDimmed ? 0.2 : 1}
                  label={{ text: label, color: 'white', fontWeight: 'bold', fontSize: '11px' }}
                  icon={{
                    path:         google.maps.SymbolPath.CIRCLE,
                    fillColor:    color,
                    fillOpacity:  1,
                    strokeColor:  'white',
                    strokeWeight: 2,
                    scale:        14,
                    labelOrigin:  new google.maps.Point(0, 0),
                  }}
                  onClick={() => setActivePin(prev => prev === pin ? null : pin)}
                />
              )
            })
          )}

          {activePin && (
            <InfoWindow position={activePin.coord} onCloseClick={() => setActivePin(null)}>
              <div style={{ fontSize: '12px', lineHeight: '1.6', maxWidth: '200px' }}>
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                  NF {activePin.nf.numnfs}
                </div>
                {activePin.kind === 'rota' && (
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}>
                    Seq. {activePin.nfIdx + 1} · {activePin.nf.municipio}
                  </div>
                )}
                {activePin.kind === 'pendente' && (
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}>
                    Pendente · {activePin.nf.municipio}
                  </div>
                )}
                <div style={{ color: '#374151' }}>{activePin.nf.destinatario}</div>
                {activePin.nf.endereco && activePin.nf.endereco !== '—' && (
                  <div style={{ color: '#6B7280', fontSize: '11px', marginTop: '2px' }}>
                    {activePin.nf.endereco}
                    {activePin.nf.bairro && activePin.nf.bairro !== '—' ? `, ${activePin.nf.bairro}` : ''}
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* Legenda por tipo de carga (só quando exibindo NFs pendentes) */}
        {rotas.length === 0 && nfsPendentes.length > 0 && (
          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 bg-surface/90 rounded-lg px-2.5 py-1.5 text-[10px] shadow-sm max-w-[70%]">
            {[...corPorTipo.entries()].map(([tipo, cor]) => (
              <span key={tipo} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: cor }} />
                {tipo}
              </span>
            ))}
            {nfsPendentes.some(n => !n.grade || n.grade === '—') && (
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: SEM_TIPO_COLOR }} />
                Sem tipo
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
