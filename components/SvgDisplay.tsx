'use client'

import { useMemo } from 'react'

type SvgDisplayProps = {
  content: string
}

function sanitizeSvg(raw: string): string | null {
  if (!raw) return null

  // Basic fast-path cleanup
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Extract <svg>...</svg> if wrapped with other text
  const svgMatch = trimmed.match(/<svg[\s\S]*?<\/svg>/i)
  const svgCandidate = (svgMatch ? svgMatch[0] : trimmed).trim()
  if (!/^<svg[\s>]/i.test(svgCandidate)) return null

  // DOM-based sanitize (client-only)
  if (typeof window === 'undefined') return svgCandidate

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgCandidate, 'image/svg+xml')
    const svgEl = doc.querySelector('svg')
    if (!svgEl) return null

    // Remove potentially dangerous elements
    const blockedSelectors = [
      'script',
      'foreignObject',
      'iframe',
      'object',
      'embed',
    ]
    doc.querySelectorAll(blockedSelectors.join(',')).forEach((n) => n.remove())

    // Remove event handler attrs + javascript: URLs
    const walker = doc.createTreeWalker(svgEl, NodeFilter.SHOW_ELEMENT)
    let node: Node | null = walker.currentNode
    while (node) {
      const el = node as Element
      ;[...el.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase()
        const value = (attr.value || '').trim().toLowerCase()

        if (name.startsWith('on')) {
          el.removeAttribute(attr.name)
          return
        }

        if ((name === 'href' || name === 'xlink:href') && value.startsWith('javascript:')) {
          el.removeAttribute(attr.name)
          return
        }

        // Block HTML injection via data: URLs (keep images if needed later, but safe-mode default)
        if ((name === 'href' || name === 'xlink:href') && value.startsWith('data:text/html')) {
          el.removeAttribute(attr.name)
          return
        }
      })

      node = walker.nextNode()
    }

    const serializer = new XMLSerializer()
    return serializer.serializeToString(svgEl)
  } catch {
    // If parsing fails, refuse to render
    return null
  }
}

export default function SvgDisplay({ content }: SvgDisplayProps) {
  const safeSvg = useMemo(() => sanitizeSvg(content), [content])

  if (!safeSvg) return null

  return (
    <div className="bg-white p-4 rounded-xl border shadow-sm mx-auto max-w-full">
      <div
        className="flex justify-center max-w-full [&_svg]:max-w-full [&_svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: safeSvg }}
      />
    </div>
  )
}


