'use client'

import { useEffect, useMemo, useState } from 'react'
import { LogOut, MessageCircle } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import AddChildForm from '@/components/parent/AddChildForm'
import DeleteChildSection from '@/components/parent/DeleteChildSection'
import { listMyChildren, setChildDeepReadMode } from '@/app/actions/parent-actions'

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

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [parentName, setParentName] = useState<string>('Ouder')
  const [children, setChildren] = useState<Array<{ id: string; displayName: string; username?: string | null; deep_read_mode: boolean }>>([])

  // Hardcoded “newsletter” data for now (as requested).
  const focusData = useMemo(
    () => [
      { name: 'Wiskunde', value: 45, color: '#a8a29e' }, // stone-400
      { name: 'Geschiedenis', value: 30, color: '#d6d3d1' }, // stone-300
      { name: 'Engels', value: 25, color: '#e7e5e4' }, // stone-200
    ],
    []
  )
  const totalMinutes = useMemo(() => focusData.reduce((sum, it) => sum + it.value, 0), [focusData])

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
          .select('deep_read_mode, display_name, student_name')
          .eq('id', userId)
          .single()

        if (!mounted) return
        if (profileErr) {
          // Some DBs don't have profiles.display_name yet → retry without it.
          const msg = String((profileErr as any)?.message || '')
          if (
            /display_name\s+does\s+not\s+exist/i.test(msg) ||
            /column\s+profiles\.display_name/i.test(msg) ||
            /could\s+not\s+find\s+the\s+'display_name'\s+column\s+of\s+'profiles'\s+in\s+the\s+schema\s+cache/i.test(msg)
          ) {
            const retry = await supabase.from('profiles').select('deep_read_mode, student_name').eq('id', userId).single()
            if (retry.error) {
              setError('Kon instellingen niet laden.')
              setIsLoading(false)
              return
            }
            setParentName((retry.data?.student_name as string) || 'Ouder')
          } else {
            setError('Kon instellingen niet laden.')
            setIsLoading(false)
            return
          }
        }
        if (profileErr) {
          // handled above
        } else {
          setParentName(((data?.display_name as string) || (data?.student_name as string)) || 'Ouder')
        }

        // Load linked children via server action (works even if RLS blocks direct selects).
        const res = await listMyChildren()
        if (res.ok) {
          setChildren(res.children)
          if (!selectedChildId) {
            setSelectedChildId(res.children[0]?.id ?? null)
          }
        } else {
          setChildren([])
        }
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

  const selectedChild = useMemo(() => children.find((c) => c.id === selectedChildId) ?? null, [children, selectedChildId])

  const toggleDeepReadMode = async () => {
    setError(null)
    if (!selectedChildId) {
      setError('Koppel eerst een kind om Diep-Lees Modus te kunnen gebruiken.')
      return
    }
    const current = children.find((c) => c.id === selectedChildId)?.deep_read_mode === true
    const next = !current

    // optimistic update
    setChildren((prev) => prev.map((c) => (c.id === selectedChildId ? { ...c, deep_read_mode: next } : c)))

    const res = await setChildDeepReadMode({ childId: selectedChildId, enabled: next })
    if (!res.ok) {
      // revert
      setChildren((prev) => prev.map((c) => (c.id === selectedChildId ? { ...c, deep_read_mode: current } : c)))
      setError(res.error)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div
        className="min-h-screen"
        style={{
          backgroundImage: 'radial-gradient(rgba(120,113,108,0.10) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
          {/* Header */}
          <header className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-stone-900">
                {children.length > 0
                  ? `Hoi ${parentName}, hier is de update van ${children[0].displayName}.`
                  : `Hoi ${parentName}, hier is je ouderoverzicht.`}
              </h1>
              <div className="mt-2 text-stone-500">Maandag 12 januari</div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-1 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
              title="Uitloggen"
            >
              <LogOut className="h-4 w-4" />
              Uitloggen
            </button>
          </header>

          {/* Cards row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Focus card */}
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
              <div className="text-stone-800 font-semibold text-lg">Focus</div>
              <div className="mt-6 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={focusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={72}
                      outerRadius={96}
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={2}
                      stroke="white"
                      strokeWidth={4}
                    >
                      {focusData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none -mt-[168px] flex flex-col items-center justify-center">
                  <div className="text-3xl font-semibold text-stone-900">{totalMinutes}</div>
                  <div className="text-sm text-stone-500">min</div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {focusData.map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-stone-600">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      <span>{row.name}</span>
                    </div>
                    <span className="text-stone-700">{row.value} min</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Flow card */}
            <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
              <div className="text-stone-800 font-semibold text-lg">Flow</div>

              <div className="mt-6 space-y-6">
                {[
                  { name: 'Wiskunde', label: 'Pittig', value: 0.25, color: '#f6caa2' },
                  { name: 'Geschiedenis', label: 'In de zone', value: 0.92, color: '#5b5b5b' },
                  { name: 'Engels', label: 'Stabiel', value: 0.55, color: '#a8a29e' },
                ].map((row) => (
                  <div key={row.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-stone-800 font-semibold">{row.name}</div>
                      <div className="text-stone-500">{row.label}</div>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round(row.value * 100)}%`, backgroundColor: row.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Tip card */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <div className="flex items-center gap-3 text-stone-500 text-sm font-semibold tracking-wide uppercase">
              <MessageCircle className="h-4 w-4" />
              Tip voor aan tafel
            </div>
            <div className="mt-3 text-lg font-semibold text-stone-900">
              Vraag {children[0]?.displayName || 'je kind'} hoe hij/zij die moeilijke som met breuken uiteindelijk toch heeft opgelost.
            </div>
          </section>

          {/* Deep Read Mode card */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <div className="text-stone-800 font-semibold text-lg">Diep-Lees Modus</div>

            <div className="mt-4 flex items-start justify-between gap-8">
              <div>
                <div className="text-stone-800 font-medium">Diep-Lees Modus</div>
                <div className="text-sm text-stone-400 mt-2 max-w-xl">
                  Activeer dit om de camera uit te schakelen. Dit dwingt je kind om de vraag rustig over te
                  typen. Dit bevordert begrijpend lezen en vertraagt de haast.
                </div>
                {children.length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <div className="text-xs font-medium text-stone-600">Voor:</div>
                    <select
                      value={selectedChildId ?? ''}
                      onChange={(e) => setSelectedChildId(e.target.value || null)}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
                    >
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.displayName}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-stone-500">{selectedChild?.username ? `@${selectedChild.username}` : null}</div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-stone-500">Koppel eerst een kind (Gezinsaccount) om deze knop te gebruiken.</div>
                )}
                {error && <div className="text-sm text-red-700 mt-3">{error}</div>}
              </div>

              <button
                type="button"
                onClick={toggleDeepReadMode}
                disabled={isLoading || !selectedChildId}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors ${
                  selectedChild?.deep_read_mode ? 'bg-stone-800 border-stone-800' : 'bg-stone-200 border-stone-200'
                } ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                aria-pressed={selectedChild?.deep_read_mode === true}
                aria-label="Toggle Diep-Lees Modus"
                title={isLoading ? 'Laden...' : selectedChild?.deep_read_mode ? 'Aan' : 'Uit'}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    selectedChild?.deep_read_mode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Gezinsaccount (collapsible): manage children without dominating the dashboard */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm">
            <details className="group" open={children.length === 0}>
              <summary className="cursor-pointer list-none px-6 py-5 flex items-center justify-between">
                <div>
                  <div className="text-stone-800 font-semibold text-lg">Gezinsaccount</div>
                  <div className="text-sm text-stone-500 mt-1">
                    {children.length > 0
                      ? `${children.length} kind(eren) gekoppeld`
                      : 'Koppel of maak een kind-account aan om te starten.'}
                  </div>
                </div>
                <div className="text-stone-500 group-open:rotate-180 transition-transform">⌄</div>
              </summary>
              <div className="px-6 pb-6 space-y-5">
                {children.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-stone-700">Kinderen</div>
                    <div className="space-y-2">
                      {children.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2"
                        >
                          <div className="text-sm text-stone-800 font-medium">{c.displayName}</div>
                          <div className="text-xs text-stone-500">{c.username ? `@${c.username}` : null}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <AddChildForm />

                {/* Danger zone (double confirmation) */}
                <DeleteChildSection children={children} />
              </div>
            </details>
          </section>

          {/* Role badge */}
          <div className="fixed bottom-4 right-4">
            <div className="rounded-full bg-stone-700 text-white text-xs px-3 py-1 shadow-sm">
              parent
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}


