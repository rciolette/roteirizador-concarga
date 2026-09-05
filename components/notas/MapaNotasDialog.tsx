'use client'

// Prévia no mapa da SEGMENTAÇÃO de notas (Marcelo, 17/08): mostra no mapa as
// notas filtradas na tabela, coloridas por TIPO DE CARGA (21/08), para o
// roteirizador ver o recorte antes de gerar as rotas. Desmarcadas esmaecidas.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleMap, useJsApiLoader, Marker, MarkerClustererF, InfoWindow } from '@react-google-maps/api'
import type { NotaFiscal } from '@/types'
import { geocodeMany, addrKeyNota, type LatLng } from '@/lib/geocode'

const API_KEY   = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
const LIBRARIES: ('places' | 'geometry')[] = []
const BH_CENTER = { lat: -19.9167, lng: -43.9345 }
const CLUSTER_THRESHOLD = 40

// Paleta por TIPO DE CARGA (Marcelo, 21/08 — região não se usa na roteirização)
const TIPO_COLORS = [
  '#1B4F8A', '#E55934', '#2E8B57', '#9333EA',
  '#B8860B', '#0891B2', '#E11D48', '#059669',
]
const SEM_TIPO_COLOR = '#6B7280'

interface PinNota {
  nf:          NotaFiscal
  coord:       LatLng
  selecionada: boolean
}

export interface MapaNotasDialogProps {
  notas:       NotaFiscal[]
  desmarcadas: Set<string>
  onClose:     () => void
}

export function MapaNotasDialog({ notas, desmarcadas, onClose }: MapaNotasDialogProps) {
  return (
    <div
      className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl shadow-xl w-[92vw] max-w-[1100px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[0.5px] border-[var(--border-subtle)]">
          <div>
            <span className="text-xs font-medium">Prévia no mapa — notas filtradas</span>
            <span className="text-[11px] text-muted ml-2">
              {notas.length} nota{notas.length !== 1 ? 's' : ''} · cores por tipo de carga · desmarcadas esmaecidas
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[12px] px-2 py-1 rounded-md text-muted hover:text-base cursor-pointer"
          >
            ✕ Fechar
          </button>
        </div>

        {!API_KEY ? (
          <div className="h-[420px] flex items-center justify-center text-[11px] text-muted px-6 text-center">
            Mapa indisponível — configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY na Vercel/.env.local.
          </div>
        ) : (
          <MapaNotasInner notas={notas} desmarcadas={desmarcadas} />
        )}
      </div>
    </div>
  )
}

/** Versão embutida (sem dialog) — mapa compacto ao lado dos filtros (Marcelo, 17/08). */
export function MapaNotasInline({ notas, desmarcadas, height = 220 }: {
  notas:       NotaFiscal[]
  desmarcadas: Set<string>
  height?:     number
}) {
  if (!API_KEY) {
    return (
      <div className="rounded-lg border border-[0.5px] border-[var(--border-subtle)] bg-cream flex items-center justify-center text-[11px] text-muted px-4 text-center" style={{ height }}>
        Mapa indisponível — configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-[0.5px] border-[var(--border-subtle)] overflow-hidden bg-surface">
      <MapaNotasInner notas={notas} desmarcadas={desmarcadas} height={height} />
    </div>
  )
}

function MapaNotasInner({ notas, desmarcadas, height = 420 }: { notas: NotaFiscal[]; desmarcadas: Set<string>; height?: number }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id:               'google-map-script',
    googleMapsApiKey: API_KEY,
    libraries:        LIBRARIES,
  })

  const mapRef                    = useRef<google.maps.Map | null>(null)
  const [pins, setPins]           = useState<PinNota[]>([])
  const [geocoding, setGeocoding] = useState(true)
  const [semCoord, setSemCoord]   = useState(0)
  const [activePin, setActivePin] = useState<PinNota | null>(null)

  const onLoad    = useCallback((map: google.maps.Map) => { mapRef.current = map }, [])
  const onUnmount = useCallback(() => { mapRef.current = null }, [])

  // Cor estável por tipo de carga presente no recorte
  const corPorTipo = useMemo(() => {
    const tipos = [...new Set(notas.map(n => n.grade).filter(t => Boolean(t) && t !== '—'))].sort()
    const map = new Map<string, string>()
    tipos.forEach((t, i) => map.set(t, TIPO_COLORS[i % TIPO_COLORS.length]))
    return map
  }, [notas])

  useEffect(() => {
    if (!isLoaded) return
    setGeocoding(true)
    setActivePin(null)

    const items = notas.map(nf => ({ nf, addr: addrKeyNota(nf) }))
    const addresses = [...new Set(items.map(i => i.addr).filter(Boolean))]

    if (!addresses.length) {
      setPins([]); setSemCoord(notas.length); setGeocoding(false)
      return
    }

    geocodeMany(addresses).then(coordMap => {
      const valid: PinNota[] = []
      let faltantes = 0
      for (const { nf, addr } of items) {
        const coord = addr ? coordMap.get(addr) : null
        if (!coord) { faltantes++; continue }
        valid.push({ nf, coord, selecionada: !desmarcadas.has(nf.numnfs) })
      }
      setPins(valid)
      setSemCoord(faltantes)
      setGeocoding(false)

      if (valid.length && mapRef.current) {
        const bounds = new google.maps.LatLngBounds()
        valid.forEach(p => bounds.extend(p.coord))
        mapRef.current.fitBounds(bounds, 48)
      }
    })
  }, [isLoaded, notas, desmarcadas])

  if (loadError) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-[11px] text-danger">
        Erro ao carregar o Google Maps.
      </div>
    )
  }

  if (!isLoaded || geocoding) {
    return <div style={{ height }} className="bg-cream-hover animate-pulse" />
  }

  function markerFor(pin: PinNota, clusterer?: import('@react-google-maps/marker-clusterer').Clusterer) {
    const color = corPorTipo.get(pin.nf.grade) ?? SEM_TIPO_COLOR
    return (
      <Marker
        key={pin.nf.id}
        position={pin.coord}
        clusterer={clusterer}
        opacity={pin.selecionada ? 1 : 0.35}
        icon={{
          path:         google.maps.SymbolPath.CIRCLE,
          fillColor:    color,
          fillOpacity:  1,
          strokeColor:  'white',
          strokeWeight: 2,
          scale:        pin.selecionada ? 9 : 7,
        }}
        onClick={() => setActivePin(prev => prev === pin ? null : pin)}
      />
    )
  }

  const useClustering = pins.length >= CLUSTER_THRESHOLD
  const totalSelecionadas = pins.filter(p => p.selecionada).length

  return (
    <div className="flex flex-col">
      <div style={{ height }}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={BH_CENTER}
          zoom={10}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: true }}
        >
          {useClustering ? (
            <MarkerClustererF>
              {clusterer => <>{pins.map(pin => markerFor(pin, clusterer))}</>}
            </MarkerClustererF>
          ) : (
            pins.map(pin => markerFor(pin))
          )}

          {activePin && (
            <InfoWindow position={activePin.coord} onCloseClick={() => setActivePin(null)}>
              <div className="text-[11px] leading-snug text-gray-900 max-w-[220px]">
                <div className="font-semibold">{activePin.nf.destinatario}</div>
                <div>NF {activePin.nf.numnfs} · {activePin.nf.peso.toLocaleString('pt-BR')} kg</div>
                <div>{activePin.nf.municipio}{activePin.nf.bairro !== '—' ? ` · ${activePin.nf.bairro}` : ''}</div>
                <div>{activePin.nf.rota}{activePin.nf.regiao ? ` · ${activePin.nf.regiao}` : ''}</div>
                {!activePin.selecionada && (
                  <div className="text-amber-600 font-medium mt-0.5">Desmarcada da roteirização</div>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Sem legenda de cores: ela ocupava altura que o mapa aproveita melhor
          (Raphael, 03/09). Fica só o contador, numa linha fina. */}
      <div className="px-4 py-1 border-t border-[0.5px] border-[var(--border-subtle)]">
        <span className="text-[10px] text-muted">
          {totalSelecionadas}/{pins.length} selecionadas no mapa
          {semCoord > 0 && ` · ${semCoord} sem endereço localizável`}
        </span>
      </div>
    </div>
  )
}
