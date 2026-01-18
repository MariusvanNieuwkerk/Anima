'use client'

import { useMemo } from 'react'
import { Pencil } from 'lucide-react'
import MapPane from './MapPane'
import type { MapSpec } from './mapTypes'
import GraphView from '@/app/components/board/graph-view'
import InlineErrorBoundary from './InlineErrorBoundary'
import ImageView from '@/app/components/board/image-view'
import FormulaView from '@/app/components/board/formula-view'

type Message = {
  role: 'user' | 'assistant'
  content: string
  map?: MapSpec
  graph?: { expressions: string[]; points?: Array<{ x: number; y: number; label?: string; color?: string }> }
  image?: { url: string; caption?: string; sourceUrl?: string }
}

type BoardMode =
  | { type: 'IDLE' }
  | { type: 'MAP'; data: any }
  | { type: 'IMAGE'; data: { url: string; title: string } }
  | { type: 'GRAPH'; data: { expressions: string[]; points?: Array<{ x: number; y: number; label?: string; color?: string }> } }
  | { type: 'FORMULA'; data: { latex: string } }

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
  boardMode,
}: {
  messages: Message[]
  boardMode?: BoardMode | null
}) {
  const mode = useMemo(() => {
    if (boardMode) return boardMode
    // Fallback: infer formula from latest assistant message.
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role !== 'assistant') continue
      const latex = extractLatexForBoard(msg.content || '')
      if (latex) return { type: 'FORMULA' as const, data: { latex } }
      break
    }
    return { type: 'IDLE' as const }
  }, [messages, boardMode])

  return (
    <div
      className="h-full flex flex-col bg-stone-100 border border-stone-200 rounded-3xl overflow-hidden shadow-sm"
      style={{ backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <div className="flex-1 relative flex items-center justify-center p-6 overflow-hidden">
        {(() => {
          switch (mode.type) {
            case 'GRAPH': {
              const exprs = (mode as any).data?.expressions
              if (!Array.isArray(exprs) || exprs.length === 0) return null
              const pts = (mode as any).data?.points
              return (
                <div className="w-full h-full rounded-2xl shadow-lg bg-white p-3 overflow-hidden">
                  <InlineErrorBoundary>
                    <GraphView expressions={exprs} points={Array.isArray(pts) ? pts : undefined} />
                  </InlineErrorBoundary>
                </div>
              )
            }
            case 'IMAGE': {
              const url = (mode as any).data?.url
              if (!url) return null
              return (
                <div className="w-full h-full rounded-2xl shadow-lg bg-white p-3 overflow-hidden">
                  <ImageView url={url} caption={(mode as any).data?.title} />
                </div>
              )
            }
            case 'FORMULA': {
              const latex = (mode as any).data?.latex
              if (!latex) return null
              return <FormulaView latex={latex} />
            }
            case 'MAP': {
              const d = (mode as any).data
              if (!d) return null
              return (
                <div className="w-full h-full">
                  <MapPane spec={d} />
                </div>
              )
            }
            case 'IDLE':
            default:
              return (
                <div className="text-stone-600 flex flex-col items-center gap-3">
                  <Pencil className="w-12 h-12" strokeWidth={1.5} />
                  <p className="font-serif italic text-stone-600">Ik wacht op je idee...</p>
                </div>
              )
          }
        })()}
      </div>
    </div>
  )
}


