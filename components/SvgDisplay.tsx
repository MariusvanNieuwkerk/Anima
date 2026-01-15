'use client'

function extractAndSanitizeSvg(input: string): string | null {
  const raw = (input || '').trim()
  if (!raw) return null

  // Only render actual <svg>...</svg> to avoid arbitrary HTML injection.
  const svgMatch = raw.match(/<svg[\s\S]*?<\/svg>/i)
  if (!svgMatch) return null

  let svg = svgMatch[0]

  // Very small safety net: strip scripts/foreignObject and inline event handlers.
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, '')
  svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
  svg = svg.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')

  // Make rendering robust: ensure the SVG has usable sizing.
  // - Force a responsive style so it doesn't collapse to 0px
  // - Add preserveAspectRatio
  // - Add a viewBox fallback if missing (common model mistake)
  svg = svg.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    const hasViewBox = /\bviewBox\s*=\s*(['"])/i.test(attrs)
    const hasPreserve = /\bpreserveAspectRatio\s*=\s*(['"])/i.test(attrs)
    const hasStyle = /\bstyle\s*=\s*(['"])/i.test(attrs)

    const extraAttrs: string[] = []
    if (!hasViewBox) extraAttrs.push("viewBox='0 0 300 300'")
    if (!hasPreserve) extraAttrs.push("preserveAspectRatio='xMidYMid meet'")
    if (!hasStyle) extraAttrs.push("style='width:100%;height:auto;display:block;'")

    return `<svg${attrs}${extraAttrs.length ? ' ' + extraAttrs.join(' ') : ''}>`
  })

  return svg.trim()
}

export default function SvgDisplay({ content }: { content: string }) {
  if (!content) return null

  const safeSvg = extractAndSanitizeSvg(content)
  if (!safeSvg) return null

  return (
    <div className="w-full min-h-[100px] max-h-[420px] overflow-auto p-4 bg-white border rounded-md">
      <div dangerouslySetInnerHTML={{ __html: safeSvg }} />
    </div>
  )
}


