'use client'

import type { RemoteImageSpec } from './remoteImageTypes'

export default function RemoteImageDisplay({ spec }: { spec: RemoteImageSpec }) {
  if (!spec?.src) return null

  const caption = spec.caption?.trim()
  const sourceUrl = spec.sourceUrl || spec.src
  const sourceLabel = spec.attribution?.source || 'Bron'
  const license = spec.attribution?.license
  const artist = spec.attribution?.artist

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-stone-200 bg-white shadow-sm">
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <img
            src={spec.src}
            alt={caption || 'Anatomie afbeelding'}
            className="max-w-full max-h-full object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="border-t border-stone-200 bg-white/90 px-4 py-3 text-xs text-stone-700">
          {caption ? <div className="font-medium text-stone-800 mb-1">{caption}</div> : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-stone-300 hover:decoration-stone-600"
            >
              {sourceLabel}
            </a>
            {license ? <span className="text-stone-500">{license}</span> : null}
            {artist ? <span className="text-stone-500">Auteur: {artist}</span> : null}
          </div>
        </div>
      </div>
    </div>
  )
}


