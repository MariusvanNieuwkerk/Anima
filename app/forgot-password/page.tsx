'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/utils/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    setSent(false)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (resetError) {
        setError(resetError.message)
        setIsLoading(false)
        return
      }
      setSent(true)
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
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">Wachtwoord herstellen</h1>
          <p className="text-stone-600 mb-6">Vul je e-mailadres in. We sturen je een herstel-link.</p>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-2">
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-stone-500 transition-all"
                placeholder="jouw@email.nl"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-stone-800 text-white rounded-xl hover:bg-stone-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Bezig...' : 'Stuur herstel-link'}
            </button>

            {sent && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
                Gelukt! Check je inbox (en je spam) voor de herstel-link.
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                {error}
              </div>
            )}

            <div className="pt-2 text-center">
              <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900">
                Terug naar inloggen
              </Link>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}


