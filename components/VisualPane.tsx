'use client'

import { useMemo } from 'react'
import { Pencil } from 'lucide-react'
import SvgDisplay from './SvgDisplay'
import MapPane from './MapPane'
import type { MapSpec } from './mapTypes'
import DiagramRenderer from './DiagramRenderer'
import type { DiagramSpec } from './diagramTypes'
import RemoteImageDisplay from './RemoteImageDisplay'
import type { RemoteImageSpec } from './remoteImageTypes'
import GraphView from '@/app/components/board/graph-view'
import InlineErrorBoundary from './InlineErrorBoundary'

type Message = {
  role: 'user' | 'assistant'
  content: string
  map?: MapSpec
  diagram?: DiagramSpec
  remoteImage?: RemoteImageSpec
  graph?: { expressions: string[]; points?: Array<{ x: number; y: number; label?: string; color?: string }> }
}

function extractSvg(text: string): string | null {
  if (!text) return null

  // Prefer fenced xml blocks
  const fenced = text.match(/```xml\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) {
    const inner = fenced[1].trim()
    const svgMatch = inner.match(/<svg[\s\S]*?<\/svg>/i)
    if (svgMatch) return svgMatch[0].trim()
  }

  // Fallback: raw inline svg
  const raw = text.match(/<svg[\s\S]*?<\/svg>/i)
  if (raw) return raw[0].trim()

  return null
}

export default function VisualPane({ messages }: { messages: Message[] }) {
  const latest = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      // Prefer assistant visuals (maps/diagrams), but also allow user-uploaded images as fallback.

      if ((msg as any).graph && Array.isArray((msg as any).graph.expressions) && (msg as any).graph.expressions.length) {
        return { kind: 'graph' as const, graph: (msg as any).graph as { expressions: string[] } }
      }

      if ((msg as any).remoteImage && ((msg as any).remoteImage.src || (msg as any).remoteImage.query)) {
        return { kind: 'remoteImage' as const, remoteImage: (msg as any).remoteImage as RemoteImageSpec, diagram: null as DiagramSpec | null, map: null as MapSpec | null, svg: null as string | null, imageUrl: null as string | null }
      }

      if ((msg as any).map && (msg as any).map.queries?.length) {
        return { kind: 'map' as const, map: (msg as any).map as MapSpec, svg: null as string | null, imageUrl: null as string | null }
      }

      if ((msg as any).diagram && (msg as any).diagram.templateId) {
        return { kind: 'diagram' as const, diagram: (msg as any).diagram as DiagramSpec, map: null as MapSpec | null, svg: null as string | null, imageUrl: null as string | null }
      }

      if (msg.role === 'assistant') {
        const svg = extractSvg(msg.content || '')
        if (svg) return { kind: 'svg' as const, svg, imageUrl: null as string | null }
      }
    }
    return { kind: 'empty' as const, diagram: null as DiagramSpec | null, map: null as MapSpec | null, svg: null as string | null, imageUrl: null as string | null }
  }, [messages])

  return (
    <div
      className="h-full flex flex-col bg-stone-100 border border-stone-200 rounded-3xl overflow-hidden shadow-sm"
      style={{ backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <div className="flex-1 relative flex items-center justify-center p-6 overflow-hidden">
        {latest.kind === 'graph' && (latest as any).graph?.expressions?.length ? (
          <div className="w-full h-full rounded-2xl shadow-lg bg-white p-3">
            <InlineErrorBoundary>
              <GraphView expressions={(latest as any).graph.expressions} points={(latest as any).graph.points} />
            </InlineErrorBoundary>
          </div>
        ) : null}

        {latest.kind === 'svg' && latest.svg && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-full max-w-full max-h-full rounded-2xl shadow-lg bg-white p-4">
              <SvgDisplay content={latest.svg} />
            </div>
          </div>
        )}

        {latest.kind === 'map' && (latest as any).map && (
          <div className="w-full h-full">
            <MapPane spec={(latest as any).map} />
          </div>
        )}

        {latest.kind === 'remoteImage' && (latest as any).remoteImage?.src && (
          <div className="w-full h-full">
            <RemoteImageDisplay spec={(latest as any).remoteImage} />
          </div>
        )}

        {latest.kind === 'diagram' && (latest as any).diagram && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-full max-w-full max-h-full rounded-2xl shadow-lg bg-white p-4">
              <DiagramRenderer spec={(latest as any).diagram} />
            </div>
          </div>
        )}

        {latest.kind === 'empty' && (
          <div className="text-stone-600 flex flex-col items-center gap-3">
            <Pencil className="w-12 h-12" strokeWidth={1.5} />
            <p className="font-serif italic text-stone-600">Ik wacht op je idee...</p>
          </div>
        )}
      </div>
    </div>
  )
}


