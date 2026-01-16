'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/utils/supabase'

type RoleChoice = 'parent' | 'teacher'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<RoleChoice>('parent')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // If we have a session immediately, set profile role optimistically.
      // If email confirmation is required, this will be null; role can be set after confirm.
      const userId = data?.user?.id
      if (userId) {
        try {
          await fetch('/api/auth/get-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          })
          await supabase.from('profiles').update({ role }).eq('id', userId)
        } catch {
          // ignore
        }
      }

      window.location.href = '/login'
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
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">Welkom bij Anima</h1>
          <p className="text-stone-600 mb-6">Maak een account om verder te gaan</p>

          <form onSubmit={handleSignup} className="space-y-4">
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

            {/* Role choice */}
            <div>
              <div className="block text-sm font-medium text-stone-700 mb-2">Ik ben een…</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('parent')}
                  className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    role === 'parent'
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                  disabled={isLoading}
                >
                  Ouder
                </button>
                <button
                  type="button"
                  onClick={() => setRole('teacher')}
                  className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                    role === 'teacher'
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                  disabled={isLoading}
                >
                  Leraar
                </button>
              </div>
              <div className="text-xs text-stone-500 mt-2">
                (Studenten worden meestal aangemaakt door een ouder/leraar.)
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-stone-800 text-white rounded-xl hover:bg-stone-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Bezig...' : 'Account aanmaken'}
            </button>

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


