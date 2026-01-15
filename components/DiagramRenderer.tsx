'use client'

import { useMemo } from 'react'
import SvgDisplay from './SvgDisplay'
import { diagramTemplates } from './diagramTemplates'
import type { DiagramSpec } from './diagramTypes'

function applyDiagramSpec(templateSvg: string, spec: DiagramSpec): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(templateSvg, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) return templateSvg

  // Apply highlights (by element id)
  const highlights = spec.highlights || []
  for (const h of highlights) {
    const el = doc.getElementById(h.id)
    if (!el) continue
    const color = h.color || '#f97316' // orange
    // Emphasize stroke/fill without destroying existing styling
    el.setAttribute('stroke', color)
    const sw = el.getAttribute('stroke-width')
    el.setAttribute('stroke-width', sw ? String(Math.max(3, Number(sw))) : '3')
    if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none') {
      el.setAttribute('fill', color)
      el.setAttribute('fill-opacity', '0.18')
    }
  }

  // Overlay group for labels
  const labels = spec.labels || []
  if (labels.length) {
    const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.setAttribute('id', 'anima-labels')

    for (const lab of labels) {
      const t = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
      t.setAttribute('x', String(lab.x))
      t.setAttribute('y', String(lab.y))
      t.setAttribute('font-size', '14')
      t.setAttribute('font-family', 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial')
      t.setAttribute('fill', lab.color || '#0f172a')
      t.textContent = lab.text
      g.appendChild(t)
    }

    svg.appendChild(g)
  }

  return svg.outerHTML
}

export default function DiagramRenderer({ spec }: { spec: DiagramSpec }) {
  const base = diagramTemplates[spec.templateId]
  const rendered = useMemo(() => {
    if (!base) return null
    try {
      return applyDiagramSpec(base, spec)
    } catch {
      return base
    }
  }, [base, spec])

  if (!rendered) return null

  // Re-use SvgDisplay sanitization + sizing
  return <SvgDisplay content={rendered} />
}


