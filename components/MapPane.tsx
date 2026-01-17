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
        return {
          title: typeof anySpec.title === 'string' ? anySpec.title : undefined,
          zoom: typeof anySpec.zoom === 'number' ? anySpec.zoom : 10,
          center: { lat, lon: lng },
          markers: [{ lat, lon: lng, label: typeof anySpec.title === 'string' ? anySpec.title : undefined }],
          queries: [],
        }
      }
    }
    return spec as any
  })()

  return <MapPaneInner spec={normalized as any} />
}


