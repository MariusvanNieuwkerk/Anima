'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/utils/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session))
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Gebruik minimaal 8 tekens.')
      return
    }
    if (password !== confirm) {
      setError('De wachtwoorden zijn niet hetzelfde.')
      return
    }

    setIsLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      setDone(true)
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)
    } catch (err: any) {
      setError(err?.message || 'Er is iets misgegaan.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main
      className="min-h-screen bg-stone-50 flex items-center justify-center px-4"
      style={{
        backgroundImage: 'radial-gradient(rgba(120,113,108,0.10) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">Nieuw wachtwoord</h1>

          {hasSession === false ? (
            <div className="space-y-4">
              <p className="text-stone-600">
                Deze herstel-link is verlopen of al gebruikt. Vraag een nieuwe aan.
              </p>
              <Link
                href="/forgot-password"
                className="block w-full py-3 px-4 bg-stone-800 text-white rounded-xl hover:bg-stone-900 transition-colors font-medium text-center"
              >
                Nieuwe herstel-link aanvragen
              </Link>
            </div>
          ) : (
            <>
              <p className="text-stone-600 mb-6">Kies een nieuw wachtwoord voor je account.</p>

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-2">
                    Nieuw wachtwoord
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-stone-500 transition-all"
                    placeholder="••••••••"
                    disabled={isLoading || done}
                  />
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-stone-700 mb-2">
                    Herhaal wachtwoord
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-stone-500 transition-all"
                    placeholder="••••••••"
                    disabled={isLoading || done}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || done}
                  className="w-full py-3 px-4 bg-stone-800 text-white rounded-xl hover:bg-stone-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Bezig...' : 'Wachtwoord opslaan'}
                </button>

                {done && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
                    Gelukt! Je wordt doorgestuurd naar het inlogscherm…
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                    {error}
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
