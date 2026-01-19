'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/utils/supabase'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const normalizeUsername = (raw: string) => {
    const s = String(raw || '').trim().toLowerCase()
    return s.replace(/[^a-z0-9._-]/g, '')
  }

  const toLoginEmail = (rawIdentifier: string) => {
    const raw = String(rawIdentifier || '').trim()
    if (!raw) return ''
    if (raw.includes('@')) return raw.toLowerCase()
    const username = normalizeUsername(raw)
    if (!username) return ''
    return `${username}@student.anima.app`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const email = toLoginEmail(identifier)
      if (!email) {
        setError('Vul een e-mailadres of gebruikersnaam in.')
        setIsLoading(false)
        return
      }
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
        const roleHome = (role?: string | null) => {
          if (role === 'parent') return '/parent/dashboard'
          if (role === 'teacher') return '/teacher/clipboard'
          return '/student/desk'
        }

        // Respect redirect query if present (e.g. user tried to open a protected page)
        const redirectParam =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('redirect')
            : null

        try {
          const resp = await fetch('/api/auth/get-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.session.user.id }),
          })
          const json = await resp.json().catch(() => null)
          const role = json?.profile?.role ?? null

          // Prefer explicit redirect param, otherwise go to role home.
          window.location.href = redirectParam || roleHome(role)
          return
        } catch {
          // ignore - fall back to role lookup below
        }

        // Fallback: lookup role via client and go to role home.
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.session.user.id)
            .single()
          window.location.href = redirectParam || roleHome(prof?.role)
        } catch {
          window.location.href = redirectParam || '/student/desk'
        }
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
              <label htmlFor="identifier" className="block text-sm font-medium text-stone-700 mb-2">
                E-mailadres of gebruikersnaam
              </label>
              <input
                id="identifier"
                type="text"
                inputMode="email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-stone-500 transition-all"
                placeholder="ouder@email.nl of gebruikersnaam"
                disabled={isLoading}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <div className="mt-2 text-xs text-stone-500">
                Leerling? Gebruik je <span className="font-medium text-stone-700">gebruikersnaam</span>. Ouder/leraar? Gebruik je{' '}
                <span className="font-medium text-stone-700">e-mailadres</span>.
              </div>
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
