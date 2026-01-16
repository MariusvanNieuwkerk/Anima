'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/utils/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setIsLoading(false)
        return
      }

      if (data?.session) {
        // Ensure profile exists (service role route auto-creates if missing)
        try {
          await fetch('/api/auth/get-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.session.user.id }),
          })
        } catch {
          // ignore - middleware will still route with default student role
        }

        // Let middleware route by role
        window.location.href = '/'
      } else {
        setError('Inloggen mislukt. Probeer het opnieuw.')
        setIsLoading(false)
      }
    } catch (err: any) {
      setError(err?.message || 'Er is een fout opgetreden bij het inloggen.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8">
          <h1 className="text-3xl font-semibold text-stone-900 mb-2">Welkom bij Anima</h1>
          <p className="text-stone-600 mb-6">Log in om verder te gaan</p>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-2">
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-stone-500 transition-all"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            {/* Wachtwoord vergeten */}
            <div className="-mt-1 text-right">
              <Link href="/forgot-password" className="text-xs text-stone-500 hover:text-stone-800">
                Wachtwoord vergeten?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-stone-800 text-white rounded-xl hover:bg-stone-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Inloggen...' : 'Inloggen'}
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
                {error}
              </div>
            )}

            {/* Signup link */}
            <div className="pt-2 text-center text-sm text-stone-600">
              Nog geen account?{' '}
              <Link href="/signup" className="font-semibold text-stone-800 hover:underline">
                Meld je aan.
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
