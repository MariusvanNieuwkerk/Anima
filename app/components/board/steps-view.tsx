'use client'

export type StepsSpec = {
  title: string
  lines: Array<{ text: string; note?: string }>
  conclusion: string
}

// Uitgewerkt bord: titel, stappen regel voor regel, conclusie onderaan.
// Twee soorten regels:
// - rekenstappen ("7 × 10 = 70"): één regel, cijfer-uitlijning, notitie ernaast
// - leestekst/taalregels (lange zinnen): netjes afbreken, notitie eronder
const isProse = (t: string) => t.length > 32 && !t.includes('=')

export default function StepsView({ steps }: { steps: StepsSpec }) {
  if (!steps || !Array.isArray(steps.lines) || steps.lines.length === 0) return null

  const anyProse = steps.lines.some((l) => isProse(l.text))

  return (
    <div className="w-full h-full flex overflow-auto p-4">
      {/* m-auto centreert als het past en laat scrollen als het niet past */}
      <div
        className={`w-full ${anyProse ? 'max-w-[640px]' : 'max-w-[560px]'} m-auto rounded-2xl bg-white border border-stone-200 shadow-sm p-6 md:p-8`}
      >
        <div className="text-2xl md:text-3xl font-semibold text-stone-900 tracking-tight mb-1">{steps.title}</div>
        <div className="h-px bg-stone-200 my-4" />

        <ol className="space-y-3">
          {steps.lines.map((line, i) => (
            <li key={i} className="flex items-baseline gap-3">
              <span className="text-xs text-stone-400 w-5 shrink-0 text-right tabular-nums">{i + 1}.</span>
              {isProse(line.text) ? (
                <div className="min-w-0">
                  <div className="text-base md:text-lg text-stone-900 leading-relaxed">{line.text}</div>
                  {line.note ? (
                    <div className="text-sm text-stone-500 italic leading-snug mt-1">{line.note}</div>
                  ) : null}
                </div>
              ) : (
                <>
                  <span className="text-lg md:text-xl text-stone-900 tabular-nums whitespace-nowrap">{line.text}</span>
                  {line.note ? (
                    <span className="text-sm text-stone-500 italic leading-snug min-w-0">{line.note}</span>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ol>

        <div className="h-px bg-stone-200 my-4" />
        <div className="flex items-baseline gap-2">
          <span className="text-lg md:text-xl font-semibold text-emerald-700 min-w-0">{steps.conclusion}</span>
          <span className="text-emerald-600 shrink-0" aria-hidden>
            ✓
          </span>
        </div>
      </div>
    </div>
  )
}
