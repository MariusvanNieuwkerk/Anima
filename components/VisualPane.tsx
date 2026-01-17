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
import ImageView from '@/app/components/board/image-view'
import FormulaView from '@/app/components/board/formula-view'

type Message = {
  role: 'user' | 'assistant'
  content: string
  map?: MapSpec
  diagram?: DiagramSpec
  remoteImage?: RemoteImageSpec
  graph?: { expressions: string[]; points?: Array<{ x: number; y: number; label?: string; color?: string }> }
  image?: { url: string; caption?: string; sourceUrl?: string }
}

type BoardState =
  | { kind: 'graph'; graph: NonNullable<Message['graph']> }
  | { kind: 'image'; image: NonNullable<Message['image']> }
  | { kind: 'formula'; latex: string }
  | { kind: 'svg'; svg: string }
  | { kind: 'empty' }

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

function extractLatexForBoard(text: string): string | null {
  const t = String(text || '')
  if (!t.trim()) return null

  // Prefer block math
  const block = t.match(/\$\$[\s\S]*?\$\$/)
  if (block) return block[0]

  // Otherwise collect inline math and promote to block
  const inline: string[] = []
  const re = /\$([^$\n]+?)\$/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const inner = (m[1] || '').trim()
    if (inner) inline.push(inner)
    if (inline.length >= 3) break
  }
  if (inline.length > 0) return `$$\n${inline.join('\\n')}\n$$`
  return null
}

export default function VisualPane({
  messages,
  boardState,
}: {
  messages: Message[]
  boardState?: BoardState | null
}) {
  const latest = useMemo(() => {
    // If a boardState is provided, it is the source of truth (prevents "state persistence").
    if (boardState) return boardState
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      // Prefer assistant visuals (maps/diagrams), but also allow user-uploaded images as fallback.

      if ((msg as any).graph && Array.isArray((msg as any).graph.expressions) && (msg as any).graph.expressions.length) {
        return { kind: 'graph' as const, graph: (msg as any).graph as { expressions: string[] } }
      }

      if ((msg as any).image && typeof (msg as any).image.url === 'string' && (msg as any).image.url.trim()) {
        return { kind: 'image' as const, image: (msg as any).image as { url: string; caption?: string; sourceUrl?: string } }
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

        const latex = extractLatexForBoard(msg.content || '')
        if (latex) return { kind: 'formula' as const, latex }
      }
    }
    return { kind: 'empty' as const }
  }, [messages, boardState])

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

        {latest.kind === 'image' && (latest as any).image?.url ? (
          <div className="w-full h-full rounded-2xl shadow-lg bg-white p-3">
            <ImageView url={(latest as any).image.url} caption={(latest as any).image.caption} />
          </div>
        ) : null}

        {latest.kind === 'formula' && (latest as any).latex ? (
          <FormulaView latex={(latest as any).latex} />
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


