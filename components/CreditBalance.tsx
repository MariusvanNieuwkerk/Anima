'use client'

import { useEffect, useState } from 'react'
import { Image as ImageIcon, Sparkles } from 'lucide-react'
import { supabase } from '../utils/supabase'

type CreditState =
  | { status: 'loading' }
  | { status: 'hidden' } // no user
  | { status: 'ready'; isPremium: boolean; imageCredits: number | null }
  | { status: 'error' }

export default function CreditBalance() {
  const [state, setState] = useState<CreditState>({ status: 'loading' })
  const [demoPremium, setDemoPremium] = useState(false)

  useEffect(() => {
    let isMounted = true
    try {
      const cookieHit = typeof document !== 'undefined' && document.cookie.includes('anima_demo_premium=1')
      const localHit = typeof window !== 'undefined' && localStorage.getItem('anima_demo_premium') === '1'
      if (cookieHit || localHit) setDemoPremium(true)
    } catch {
      // ignore
    }

    async function load() {
      try {
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData?.user?.id
        if (!userId) {
          if (isMounted) setState({ status: 'hidden' })
          return
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('image_credits,is_premium')
          .eq('id', userId)
          .single()

        if (error || !profile) {
          if (isMounted) setState({ status: 'error' })
          return
        }

        const isPremium = profile.is_premium === true
        const imageCredits = typeof profile.image_credits === 'number' ? profile.image_credits : null
        if (isMounted) setState({ status: 'ready', isPremium, imageCredits })
      } catch {
        if (isMounted) setState({ status: 'error' })
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  if (state.status === 'hidden') return null

  const baseClass =
    'inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600'

  if (state.status === 'loading') {
    return (
      <div className={`${baseClass} animate-pulse`}>
        <div className="h-4 w-4 rounded bg-stone-200" />
        <div className="h-3 w-12 rounded bg-stone-200" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className={baseClass} title="Kon credits niet laden">
        <ImageIcon className="h-4 w-4" strokeWidth={2} />
        <span>—</span>
      </div>
    )
  }

  if (demoPremium || state.isPremium) {
    return (
      <div className={baseClass} title={demoPremium ? 'Demo Premium: onbeperkte visuals (test)' : 'Premium: onbeperkte visuals (fair use)'}>
        <Sparkles className="h-4 w-4" strokeWidth={2} />
        <span>Premium</span>
        <span className="text-sm leading-none">∞</span>
      </div>
    )
  }

  return (
    <div className={baseClass} title="Image credits">
      <ImageIcon className="h-4 w-4" strokeWidth={2} />
      <span>{state.imageCredits ?? 0}</span>
    </div>
  )
}


