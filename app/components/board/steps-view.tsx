'use client'

export type StepsSpec = {
  title: string
  lines: Array<{ text: string; note?: string }>
  conclusion: string
}

// Uitgewerkte bordsom: titel, stappen regel voor regel met een korte
// waarom-notitie ernaast, en de conclusie onderaan.
export default function StepsView({ steps }: { steps: StepsSpec }) {
  if (!steps || !Array.isArray(steps.lines) || steps.lines.length === 0) return null

  return (
    <div className="w-full h-full flex items-center justify-center overflow-auto">
      <div className="w-full max-w-[560px] rounded-2xl bg-white border border-stone-200 shadow-sm p-6 md:p-8">
        <div className="text-2xl md:text-3xl font-semibold text-stone-900 tracking-tight mb-1 tabular-nums">
          {steps.title}
        </div>
        <div className="h-px bg-stone-200 my-4" />

        <ol className="space-y-3">
          {steps.lines.map((line, i) => (
            <li key={i} className="flex items-baseline gap-3">
              <span className="text-xs text-stone-400 w-5 shrink-0 text-right tabular-nums">{i + 1}.</span>
              <span className="text-lg md:text-xl text-stone-900 tabular-nums whitespace-nowrap">{line.text}</span>
              {line.note ? (
                <span className="text-sm text-stone-500 italic leading-snug min-w-0">{line.note}</span>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="h-px bg-stone-200 my-4" />
        <div className="flex items-center gap-2">
          <span className="text-lg md:text-xl font-semibold text-emerald-700 tabular-nums">{steps.conclusion}</span>
          <span className="text-emerald-600" aria-hidden>
            ✓
          </span>
        </div>
      </div>
    </div>
  )
}
