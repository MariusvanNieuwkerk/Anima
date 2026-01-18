'use client'

import { useState, useTransition } from 'react'
import { createChildAccount } from '@/app/actions/parent-actions'
import { UserPlus } from 'lucide-react'

export default function AddChildForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const onSubmit = () => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const res = await createChildAccount({ username, password, displayName })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSuccess(`Kind-account aangemaakt: ${res.username}`)
      setUsername('')
      setPassword('')
      setDisplayName('')
    })
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-2xl bg-stone-100 flex items-center justify-center border border-stone-200">
          <UserPlus className="h-5 w-5 text-stone-700" />
        </div>
        <div>
          <div className="text-stone-800 font-semibold">Kind toevoegen</div>
          <div className="text-xs text-stone-500">Maak een kind-account aan met gebruikersnaam + wachtwoord.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="space-y-1">
          <div className="text-xs font-medium text-stone-600">Gebruikersnaam</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="rens123"
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>

        <label className="space-y-1">
          <div className="text-xs font-medium text-stone-600">Wachtwoord</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimaal 6 tekens"
            type="password"
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </label>

        <label className="space-y-1">
          <div className="text-xs font-medium text-stone-600">Roepnaam</div>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Roepnaam"
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </label>
      </div>

      {error ? (
        <div className="mt-3 text-sm text-red-700">
          {error === 'Database error creating new user'
            ? 'Kon geen nieuw kind-account aanmaken. Check: bestaat de gebruikersnaam al, en staat SUPABASE_SERVICE_ROLE_KEY in Vercel env?'
            : error}
        </div>
      ) : null}
      {success ? <div className="mt-3 text-sm text-emerald-700">{success}</div> : null}

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending || !username.trim() || !password || !displayName.trim()}
          className="rounded-xl bg-stone-800 text-white px-4 py-2 text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
        >
          {pending ? 'Aanmaken…' : 'Kind aanmaken'}
        </button>
      </div>
    </div>
  )
}


