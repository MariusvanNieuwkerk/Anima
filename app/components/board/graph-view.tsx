'use client'

import { useMemo } from 'react'
import { Mafs, Coordinates, Plot, Point, Text, Theme } from 'mafs'
import { compile } from 'mathjs'

export type GraphSpec = {
  expressions: string[]
  points?: Array<{ x: number; y: number; label?: string; color?: string }>
}

function safeCompile(expr: string): ((x: number) => number) | null {
  const raw = String(expr || '').trim()
  if (!raw) return null

  try {
    const node = compile(raw)
    return (x: number) => {
      try {
        const y = node.evaluate({ x })
        const n = typeof y === 'number' ? y : Number(y)
        if (!Number.isFinite(n)) return NaN
        return n
      } catch {
        return NaN
      }
    }
  } catch {
    return null
  }
}

const COLORS = [Theme.blue, Theme.red, Theme.green, Theme.pink]

export default function GraphView({
  expressions,
  points,
}: {
  expressions: string[]
  points?: Array<{ x: number; y: number; label?: string; color?: string }>
}) {
  const fns = useMemo(() => {
    return (expressions || [])
      .map((expr) => ({ expr, fn: safeCompile(expr) }))
      .filter((x): x is { expr: string; fn: (x: number) => number } => Boolean(x.fn))
  }, [expressions])

  if (!fns.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-stone-600">
        <p className="font-serif italic">Geen geldige formule om te plotten.</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full mafs-light">
      {/* NOTE: Use a numeric width to avoid Mafs' ResizeObserver path (can crash on some clients). */}
      <Mafs zoom pan height={420} width={500}>
        <Coordinates.Cartesian subdivisions={false} />
        {fns.map((item, idx) => (
          <Plot.OfX key={`${item.expr}-${idx}`} y={item.fn} color={COLORS[idx % COLORS.length]} />
        ))}
        {(points || []).map((p, idx) => {
          const color = p.color || Theme.red
          return (
            <g key={`pt-${idx}`}>
              <Point x={p.x} y={p.y} color={color} />
              {p.label ? (
                <Text x={p.x} y={p.y} color={color} attach="ne" attachDistance={18} size={14}>
                  {p.label}
                </Text>
              ) : null}
            </g>
          )
        })}
      </Mafs>
    </div>
  )
}


