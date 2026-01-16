'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Sun, LogOut } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

// NOTE: We use Supabase SSR's browser client so auth is cookie-based (works with middleware).
// This function name matches the intent of "createClientComponentClient" without adding extra deps.
function createClientComponentClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars ontbreken')
  return createBrowserClient(url, key)
}

export default function ParentDashboardPage() {
  const supabase = useMemo(() => createClientComponentClient(), [])

  const [deepReadMode, setDeepReadMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setError(null)
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData?.user?.id
        if (!userId) {
          // Middleware should already protect this, but fail safe.
          window.location.href = '/login'
          return
        }

        const { data, error: profileErr } = await supabase
          .from('profiles')
          .select('deep_read_mode')
          .eq('id', userId)
          .single()

        if (!mounted) return
        if (profileErr) {
          setError('Kon instellingen niet laden.')
          setIsLoading(false)
          return
        }

        setDeepReadMode(data?.deep_read_mode === true)
        setIsLoading(false)
      } catch {
        if (!mounted) return
        setError('Kon instellingen niet laden.')
        setIsLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [supabase])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      window.location.href = '/login'
    }
  }

  const toggleDeepReadMode = async () => {
    setError(null)
    const next = !deepReadMode
    setDeepReadMode(next) // optimistic

    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id
      if (!userId) {
        window.location.href = '/login'
        return
      }

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ deep_read_mode: next })
        .eq('id', userId)

      if (updateErr) throw updateErr
    } catch {
      // revert
      setDeepReadMode(!next)
      setError('Kon instelling niet opslaan. Probeer opnieuw.')
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
          <div className="text-stone-800 font-semibold text-lg">Anima Ouderportaal</div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Uitloggen
          </button>
        </div>
      </header>

      {/* Container */}
      <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">
        {/* Kaart 1: Glow Feed */}
        <section className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200">
              <Sparkles className="h-5 w-5 text-stone-700" />
            </div>
            <h2 className="text-stone-800 font-semibold text-lg">Vandaag in focus</h2>
          </div>
          <p className="text-stone-600 leading-relaxed">
            Rens heeft vandaag 20 minuten gewerkt aan &apos;Tijdrekenen&apos;. Hij toonde veel
            doorzettingsvermogen bij het omrekenen van analoge naar digitale tijd.
          </p>
        </section>

        {/* Kaart 2: Instellingen */}
        <section className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200">
              <Sun className="h-5 w-5 text-stone-700" />
            </div>
            <h2 className="text-stone-800 font-semibold text-lg">Begeleiding &amp; Focus</h2>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-stone-800">Diep-Lees Modus</div>
              <div className="text-sm text-stone-600 mt-1">
                Schakelt de camera uit bij het kind. Dwingt vertragen en typen.
              </div>
              {error && <div className="text-sm text-red-700 mt-3">{error}</div>}
            </div>

            {/* Toggle */}
            <button
              type="button"
              onClick={toggleDeepReadMode}
              disabled={isLoading}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors ${
                deepReadMode ? 'bg-stone-800 border-stone-800' : 'bg-stone-200 border-stone-200'
              } ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-pressed={deepReadMode}
              aria-label="Toggle Diep-Lees Modus"
              title={isLoading ? 'Laden...' : deepReadMode ? 'Aan' : 'Uit'}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  deepReadMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}


