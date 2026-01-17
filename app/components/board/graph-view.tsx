'use client'

import { useMemo } from 'react'
import { Mafs, CartesianCoordinates, Plot, Theme } from 'mafs'
import { compile } from 'mathjs'

export type GraphSpec = {
  expressions: string[]
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

export default function GraphView({ expressions }: { expressions: string[] }) {
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
    <div className="w-full h-full">
      <Mafs zoom pan>
        <CartesianCoordinates />
        {fns.map((item, idx) => (
          <Plot.OfX key={`${item.expr}-${idx}`} y={item.fn} color={COLORS[idx % COLORS.length]} />
        ))}
      </Mafs>
    </div>
  )
}


