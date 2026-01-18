'use client'

import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { GeoJSON, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

import type { MapSpec } from './mapTypes'

type LatLng = { lat: number; lon: number }

type GeocodeResult =
  | { found: false; query: string }
  | {
      found: true
      query: string
      display_name: string
      center: LatLng
      boundingbox: [string, string, string, string] | null
      geojson: any | null
    }

function bboxToBounds(bbox: [string, string, string, string]) {
  // Nominatim returns [south, north, west, east]
  const south = Number(bbox[0])
  const north = Number(bbox[1])
  const west = Number(bbox[2])
  const east = Number(bbox[3])
  return [
    [south, west],
    [north, east],
  ] as [[number, number], [number, number]]
}

function FitTo({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !bounds) return
    try {
      map.fitBounds(bounds, { padding: [24, 24] })
    } catch {
      // ignore
    }
  }, [map, bounds])
  return null
}

export default function MapPaneInner({ spec }: { spec: MapSpec }) {
  const [results, setResults] = useState<GeocodeResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setError(null)
        setResults(null)
        // If center/markers are provided, we skip geocoding.
        if (spec?.center && (!spec?.queries || spec.queries.length === 0)) {
          if (!cancelled) setResults([])
          return
        }
        const qs = spec?.queries || []
        const out: GeocodeResult[] = []
        for (const q of qs) {
          const resp = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: q.query,
              withGeoJson: q.withGeoJson ?? true,
            }),
          })
          const json = (await resp.json()) as GeocodeResult
          out.push(json)
        }
        if (!cancelled) setResults(out)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Map lookup failed')
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [spec])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(L.Icon.Default as any).mergeOptions({
      iconRetinaUrl: (markerIcon2x as any).src ?? (markerIcon2x as any),
      iconUrl: (markerIcon as any).src ?? (markerIcon as any),
      shadowUrl: (markerShadow as any).src ?? (markerShadow as any),
    })
  }, [])

  const centers = useMemo(() => {
    if (spec?.center) return [spec.center as LatLng]
    if (!results) return []
    return results
      .filter((r: any) => r && r.found && r.center)
      .map((r: any) => r.center as LatLng)
  }, [results, spec])

  const bounds = useMemo(() => {
    if (!results) return null
    const b = results.find((r: any) => r && r.found && r.boundingbox)?.boundingbox as
      | [string, string, string, string]
      | null
      | undefined
    if (b) return bboxToBounds(b)
    if (!centers.length) return null
    const lats = centers.map((c) => c.lat)
    const lons = centers.map((c) => c.lon)
    const south = Math.min(...lats)
    const north = Math.max(...lats)
    const west = Math.min(...lons)
    const east = Math.max(...lons)
    return [
      [south, west],
      [north, east],
    ] as [[number, number], [number, number]]
  }, [results, centers])

  const fallbackCenter: [number, number] = centers.length
    ? [centers[0].lat, centers[0].lon]
    : [52.3676, 4.9041] // Amsterdam fallback

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-stone-200 bg-white shadow-sm relative">
      <div className="h-10 px-3 flex items-center border-b border-stone-200 bg-white/80">
        <div className="text-xs font-semibold tracking-wide text-stone-700">
          {spec?.title || 'Kaart'}
        </div>
      </div>

      <div className="h-[calc(100%-40px)]">
        <MapContainer
          center={fallbackCenter}
          zoom={spec?.zoom ?? 6}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitTo bounds={bounds} />

          {results?.map((r, idx) => {
            const q = spec.queries?.[idx]
            if (!r || !(r as any).found) return null
            const rr = r as any
            const label = q?.label || rr.display_name || q?.query || rr.display_name
            const pos: [number, number] = [rr.center.lat, rr.center.lon]

            return (
              <Marker key={`${q.query}-${idx}`} position={pos}>
                <Popup>
                  <div className="text-sm font-medium">{label}</div>
                </Popup>
              </Marker>
            )
          })}

          {(spec?.markers || []).map((m, idx) => {
            const pos: [number, number] = [m.lat, m.lon]
            const label = m.label || spec?.title || 'Locatie'
            return (
              <Marker key={`m-${idx}`} position={pos}>
                <Popup>
                  <div className="text-sm font-medium">{label}</div>
                </Popup>
              </Marker>
            )
          })}

          {results?.map((r, idx) => {
            const q = spec.queries?.[idx]
            if (!r || !(r as any).found) return null
            const rr = r as any
            if (!rr.geojson) return null
            return (
              <GeoJSON
                key={`geo-${q?.query || idx}-${idx}`}
                data={rr.geojson}
                style={(feature: any) => {
                  const type = String(feature?.geometry?.type || '').toLowerCase()
                  const isLine = type.includes('line')
                  const isPoint = type.includes('point')
                  // Rivers/lines: blue stroke, no fill. Areas: subtle fill + dark border.
                  if (isLine) {
                    return { color: '#2563eb', weight: 3, fillOpacity: 0 }
                  }
                  if (isPoint) {
                    return { color: '#0f172a', weight: 2, fillOpacity: 0 }
                  }
                  return {
                    color: '#0f172a',
                    weight: 2,
                    fillColor: '#93c5fd',
                    fillOpacity: 0.15,
                  }
                }}
              />
            )
          })}
        </MapContainer>

        {error ? (
          <div className="absolute bottom-3 left-3 right-3 bg-white/90 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-700">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}


