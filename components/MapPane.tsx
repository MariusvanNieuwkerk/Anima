'use client'

import dynamic from 'next/dynamic'
import type { MapSpec } from './mapTypes'

export type { MapSpec } from './mapTypes'

const MapPaneInner = dynamic(() => import('./MapPaneInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-stone-200 bg-white shadow-sm flex items-center justify-center text-stone-500 text-sm">
      Kaart laden…
    </div>
  ),
})

export default function MapPane({ spec }: { spec: MapSpec }) {
  const anySpec: any = spec as any
  // Backwards/forwards compatibility:
  // - Some callers may provide { lat, lng, zoom, title } (tool-style)
  // - Our renderer expects MapSpec with { center: {lat, lon} } and optional markers/queries.
  const normalized: MapSpec = (() => {
    if (anySpec && typeof anySpec === 'object') {
      const lat = typeof anySpec.lat === 'number' ? anySpec.lat : undefined
      const lng = typeof anySpec.lng === 'number' ? anySpec.lng : undefined
      if (lat != null && lng != null && !anySpec.center) {
        const title = typeof anySpec.title === 'string' ? anySpec.title : undefined
        const zoom = typeof anySpec.zoom === 'number' ? anySpec.zoom : 10
        // Blueprint UX: for cities/countries/rivers, show the whole outline (GeoJSON) + fit bounds.
        // We can fetch that via /api/geocode if we have a meaningful place name.
        const canOutline = Boolean(title && title.trim() && title.trim().toLowerCase() !== 'kaart' && /[a-zA-ZÀ-ÿ]/.test(title))
        return {
          title,
          zoom,
          center: { lat, lon: lng },
          markers: [{ lat, lon: lng, label: title }],
          queries: canOutline ? [{ query: title!, label: title, withGeoJson: true }] : [],
        }
      }
    }
    return spec as any
  })()

  return <MapPaneInner spec={normalized as any} />
}


