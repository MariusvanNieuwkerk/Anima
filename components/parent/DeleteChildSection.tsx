'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { deleteChildAccount } from '@/app/actions/parent-actions'

type Child = { id: string; displayName: string; username?: string | null }

export default function DeleteChildSection({ kids }: { kids: Child[] }) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')
  const [confirm, setConfirm] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selected = useMemo(() => kids.find((c) => c.id === selectedId) || null, [kids, selectedId])
  const expected = useMemo(() => {
    const u = selected?.username ? String(selected.username) : ''
    if (u.trim()) return u.trim()
    return selected?.displayName ? String(selected.displayName).trim() : ''
  }, [selected])

  const matches = useMemo(() => {
    const typed = String(confirm || '').trim().toLowerCase().replace(/^@/, '')
    const exp = String(expected || '').trim().toLowerCase().replace(/^@/, '')
    return Boolean(typed && exp && typed === exp)
  }, [confirm, expected])

  const onDelete = () => {
    setError(null)
    setSuccess(null)
    if (!selectedId) {
      setError('Kies eerst een kind.')
      return
    }
    startTransition(async () => {
      const res = await deleteChildAccount({ childId: selectedId, confirm })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSuccess('Kind is verwijderd.')
      // Refresh to reload linked children list
      window.setTimeout(() => window.location.reload(), 600)
    })
  }

  if (!kids.length) return null

  return (
    <section className="mt-10 pt-8 border-t border-stone-200">
      <div className="rounded-2xl border border-red-200 bg-red-50/40 shadow-sm p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-700" />
            </div>
            <div>
              <div className="text-stone-900 font-semibold">Danger zone</div>
              <div className="text-sm text-stone-600 mt-1">
                Verwijder een kind-account. Dit is permanent.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v)
              setError(null)
              setSuccess(null)
            }}
            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            {open ? 'Sluiten' : 'Verwijderen…'}
          </button>
        </div>

        {open ? (
          <div className="mt-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="space-y-1 md:col-span-1">
                <div className="text-xs font-medium text-stone-600">Kies kind</div>
                <select
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value)
                    setConfirm('')
                    setError(null)
                    setSuccess(null)
                  }}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">Selecteer…</option>
                  {kids.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                      {c.username ? ` (@${c.username})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 md:col-span-2">
                <div className="text-xs font-medium text-stone-600">
                  Typ ter bevestiging: <span className="font-semibold text-stone-900">{expected || '—'}</span>
                </div>
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Type exact (naam/gebruikersnaam)…"
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </label>
            </div>

            {error ? <div className="text-sm text-red-800">{error}</div> : null}
            {success ? <div className="text-sm text-emerald-700">{success}</div> : null}

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={onDelete}
                disabled={pending || !selectedId || !matches}
                className="inline-flex items-center gap-2 rounded-xl bg-red-700 text-white px-4 py-2 text-sm font-semibold hover:bg-red-800 disabled:opacity-50"
                title={!matches ? 'Typ de bevestiging exact over om te ontgrendelen.' : 'Verwijder definitief'}
              >
                <Trash2 className="h-4 w-4" />
                {pending ? 'Verwijderen…' : 'Verwijder definitief'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}


