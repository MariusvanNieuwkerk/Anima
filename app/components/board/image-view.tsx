'use client'

import { useState } from 'react'

export default function ImageView({
  url,
  caption,
}: {
  url: string
  caption?: string
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="w-full h-full rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 relative bg-stone-50">
          {!loaded && !failed ? (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-stone-100 to-stone-50" />
          ) : null}
          {failed ? (
            <div className="absolute inset-0 flex items-center justify-center text-stone-600">
              <p className="font-serif italic">Afbeelding kon niet laden.</p>
            </div>
          ) : null}
          <img
            src={url}
            alt={caption || 'Wikimedia afbeelding'}
            className={`w-full h-full object-contain transition-opacity duration-300 ${loaded && !failed ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>

        {caption ? (
          <div className="px-4 py-3 border-t border-stone-200 bg-white">
            <p className="text-sm text-stone-700 text-center">{caption}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}


