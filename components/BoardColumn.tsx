'use client'

import { useState, useEffect } from 'react'
import { Pencil, Image as ImageIcon } from 'lucide-react'

interface BoardColumnProps {
  imageUrl?: string | null;
  topic?: string | null;
}

export default function BoardColumn({ imageUrl, topic }: BoardColumnProps) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Blueprint V5.3: Primair - Dynamische Unsplash API (imageUrl)
    // Secundair - Stijlvolle tekst-placeholder als fallback
    if (imageUrl) {
      setCurrentUrl(imageUrl)
      setIsLoading(false)
    } else {
      setCurrentUrl(null)
      setIsLoading(false)
    }
  }, [imageUrl])

  return (
    <div className="h-full flex flex-col bg-stone-100 border border-stone-200 rounded-3xl overflow-hidden shadow-sm" style={{ backgroundImage: 'radial-gradient(#ccc 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      <div className="flex-1 relative flex items-center justify-center p-6">
        {/* PRIMAIR: Dynamische Unsplash API afbeelding */}
        {currentUrl && !isLoading && (
          <img 
            src={currentUrl} 
            alt={topic || 'Visual'} 
            className="max-w-full max-h-full object-contain rounded-2xl shadow-lg bg-white p-4 animate-in fade-in zoom-in duration-500"
          />
        )}

        {/* SECUNDAIR: Stijlvolle tekst-placeholder (Blueprint V5.3) */}
        {!currentUrl && !isLoading && topic && (
          <div className="bg-white p-12 rounded-3xl shadow-sm border border-stone-200 text-center max-w-sm animate-in fade-in slide-in-from-bottom-4">
            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ImageIcon className="w-8 h-8 text-stone-300" />
            </div>
            <h3 className="text-stone-400 uppercase tracking-widest text-xs font-bold mb-2">Concept</h3>
            <p className="text-3xl font-serif font-medium text-stone-900 capitalize">
              {topic}
            </p>
            <div className="h-1 w-12 bg-amber-200 mx-auto mt-6 rounded-full"></div>
          </div>
        )}

        {/* EMPTY STATE */}
        {!currentUrl && !topic && !isLoading && (
          <div className="text-stone-600 flex flex-col items-center gap-3">
            <Pencil className="w-12 h-12" strokeWidth={1.5} />
            <p className="font-serif italic text-stone-600">Ik wacht op je idee...</p>
          </div>
        )}
      </div>
    </div>
  )
}