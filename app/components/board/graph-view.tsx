'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default function GraphView({
  expressions,
  points,
}: {
  expressions: string[]
  points?: Array<{ x: number; y: number; label?: string; color?: string }>
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  const fns = useMemo(() => {
    return (expressions || [])
      .map((expr) => ({ expr, fn: safeCompile(expr) }))
      .filter((x): x is { expr: string; fn: (x: number) => number } => Boolean(x.fn))
  }, [expressions])

  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const update = () => {
      const rect = el.getBoundingClientRect()
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height)
      setSize({ w: Number.isFinite(w) ? w : 0, h: Number.isFinite(h) ? h : 0 })
    }

    update()

    if (typeof ResizeObserver === 'undefined') {
      const id = window.setInterval(update, 250)
      return () => window.clearInterval(id)
    }

    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!fns.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-stone-600">
        <p className="font-serif italic">Geen geldige formule om te plotten.</p>
      </div>
    )
  }

  return (
    <div ref={hostRef} className="w-full h-full mafs-light">
      {/* Pass numeric width/height (responsive) while avoiding Mafs' own ResizeObserver ("auto" width). */}
      {size.w > 0 && size.h > 0 ? (
        <Mafs zoom pan height={clamp(size.h, 260, 900)} width={clamp(size.w, 280, 900)}>
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
      ) : (
        <div className="w-full h-full flex items-center justify-center text-stone-500 text-sm">
          Grafiek laden…
        </div>
      )}
    </div>
  )
}


