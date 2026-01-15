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
  return <MapPaneInner spec={spec as any} />
}


