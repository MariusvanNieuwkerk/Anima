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

type BoardView = 'none' | 'graph' | 'image' | 'formula' | 'map'
type BoardContent = { view: BoardView; data: any }

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
  boardContent,
}: {
  messages: Message[]
  boardContent?: BoardContent | null
}) {
  const content = useMemo(() => {
    // Centralized board content is the source of truth.
    if (boardContent) return boardContent
    // Fallback (should be rare): infer formula from latest assistant message.
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role !== 'assistant') continue
      const latex = extractLatexForBoard(msg.content || '')
      if (latex) return { view: 'formula' as const, data: { latex } }
      break
    }
    return { view: 'none' as const, data: null }
  }, [messages, boardContent])

  return (
    <div
      className="h-full flex flex-col bg-stone-100 border border-stone-200 rounded-3xl overflow-hidden shadow-sm"
      style={{ backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <div className="flex-1 relative flex items-center justify-center p-6 overflow-hidden">
        {content.view === 'graph' && (content as any).data?.expressions?.length ? (
          <div className="w-full h-full rounded-2xl shadow-lg bg-white p-3 overflow-hidden">
            <InlineErrorBoundary>
              <GraphView expressions={(content as any).data.expressions} points={(content as any).data.points} />
            </InlineErrorBoundary>
          </div>
        ) : null}

        {content.view === 'image' && (content as any).data?.url ? (
          <div className="w-full h-full rounded-2xl shadow-lg bg-white p-3 overflow-hidden">
            <ImageView url={(content as any).data.url} caption={(content as any).data.caption} />
          </div>
        ) : null}

        {content.view === 'formula' && (content as any).data?.latex ? (
          <FormulaView latex={(content as any).data.latex} title={(content as any).data.title} />
        ) : null}

        {content.view === 'map' && (content as any).data ? (
          <div className="w-full h-full">
            <MapPane spec={(content as any).data} />
          </div>
        ) : null}

        {content.view === 'none' && (
          <div className="text-stone-600 flex flex-col items-center gap-3">
            <Pencil className="w-12 h-12" strokeWidth={1.5} />
            <p className="font-serif italic text-stone-600">Ik wacht op je idee...</p>
          </div>
        )}
      </div>
    </div>
  )
}


