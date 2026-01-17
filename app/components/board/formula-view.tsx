'use client'

import MarkdownMessage from '@/components/MarkdownMessage'

export default function FormulaView({
  latex,
  title,
}: {
  latex: string
  title?: string
}) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-full max-w-[520px] rounded-2xl bg-white border border-stone-200 shadow-sm p-6">
        {title ? <div className="text-sm text-stone-600 mb-3 text-center">{title}</div> : null}
        <div className="text-lg text-stone-900 text-center">
          <MarkdownMessage content={latex} />
        </div>
      </div>
    </div>
  )
}


