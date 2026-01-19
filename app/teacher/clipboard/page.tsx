'use client'

import { useEffect, useMemo, useState } from 'react'
import { LogOut, Search, AlertTriangle, HelpCircle, CheckCircle2, Lock } from 'lucide-react'
import StudentDetailSheet from '@/components/StudentDetailSheet'
import { supabase } from '@/utils/supabase'
import { getTeacherStudents } from '@/app/actions/dashboard-actions'

const MOCK_STUDENTS = [
  { id: 1, name: 'Emma de Vries', activity: 'Breuken Oefenen', status: 'flow', time: '12 min', deep_read: false },
  { id: 2, name: 'Liam Bakker', activity: 'Begrijpend Lezen', status: 'stuck', time: '25 min', deep_read: true },
  { id: 3, name: 'Sophie Janssen', activity: 'Tijdrekenen', status: 'focus', time: '40 min', deep_read: false },
  { id: 4, name: 'Noah Visser', activity: 'Spelling', status: 'flow', time: '8 min', deep_read: false },
  { id: 5, name: 'Lucas Smit', activity: 'Geschiedenis', status: 'stuck', time: '3 min', deep_read: true },
] as const

type MockStudent = (typeof MOCK_STUDENTS)[number]

export default function TeacherClipboardPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [teacherName, setTeacherName] = useState<string>('Leraar')
  const [students, setStudents] = useState<
    Array<{ id: string; name: string; activity: string; status: 'flow' | 'focus' | 'inactive'; deep_read: boolean }>
  >([])
  const [dataHint, setDataHint] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData?.user?.id
        if (!userId) return
        const resp = await fetch('/api/auth/get-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        const json = await resp.json().catch(() => null)
        const prof = json?.profile
        if (!mounted || !prof) return
        const name = prof.teacher_name || prof.display_name || prof.parent_name || prof.student_name
        if (typeof name === 'string' && name.trim()) setTeacherName(name.trim())
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const res = await getTeacherStudents()
      if (!mounted) return
      if (!res.ok) {
        setDataHint(res.error)
        setStudents([])
        return
      }
      if (res.requiresMigration) {
        setDataHint('Nog geen activiteit-data (run migratie 009/010 en laat een leerling even chatten).')
      } else {
        setDataHint(null)
      }
      setStudents(
        res.students.map((s) => ({
          id: s.id,
          name: s.name,
          activity: s.activityLabel,
          status: s.status,
          deep_read: s.deep_read_mode,
        }))
      )
    })()
    return () => {
      mounted = false
    }
  }, [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      window.location.href = '/login'
    }
  }

  const source = students.length > 0 ? students : [...MOCK_STUDENTS]

  const stuckCount = useMemo(() => source.filter((s: any) => s.status === 'inactive').length, [source])
  const focusCount = useMemo(() => source.filter((s: any) => s.status === 'focus').length, [source])
  const flowCount = useMemo(() => source.filter((s: any) => s.status === 'flow').length, [source])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return [...source]
    return source.filter((s: any) => s.name.toLowerCase().includes(q))
  }, [searchQuery, source])

  const today = new Date()
  const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
  const dateString = `${today.getDate()} ${months[today.getMonth()]}`

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  const statusBadge = (s: any) => {
    if (s === 'flow') return 'bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium'
    if (s === 'inactive') return 'bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-medium'
    return 'bg-stone-200 text-stone-700 px-3 py-1 rounded-full text-xs font-medium'
  }

  const statusLabel = (s: any) => {
    if (s === 'flow') return 'Flow'
    if (s === 'inactive') return 'Hulp nodig'
    return 'Focus'
  }

  return (
    <div
      className="min-h-screen bg-stone-50"
      style={{
        backgroundImage: 'radial-gradient(rgba(120,113,108,0.10) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div className="max-w-7xl mx-auto mt-4 md:mt-12 p-4 md:p-8">
        {/* Header */}
        <div className="mb-5 md:mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-stone-900 mb-1.5 md:mb-2 leading-tight">
                Goedemorgen, {teacherName}.
              </h1>
              <p className="text-stone-600 text-xs md:text-base font-medium">
                Overzicht Groep 6B - {dateString}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="mt-1 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
              title="Uitloggen"
            >
              <LogOut className="h-4 w-4" />
              Uitloggen
            </button>
          </div>
        </div>

        {/* Top 3 cards */}
        <div className="mb-5 md:mb-8">
          <h2 className="text-lg md:text-xl font-bold text-stone-900 mb-3 md:mb-4">Top 3 Knelpunten</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* Knelpunt */}
            <div className="bg-white rounded-2xl border-2 p-4 md:p-5 shadow-md flex items-center justify-between border-orange-400 ring-2 ring-orange-100">
              <div className="flex-1 min-w-0">
                <AlertTriangle className="w-4 h-4 text-orange-500 mb-1" strokeWidth={2} />
                <h3 className="font-bold text-stone-900 text-base md:text-lg mb-0.5 md:mb-1">Hulp Nodig</h3>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-600">KRITIEK KNELPUNT</p>
              </div>
              <div className="flex flex-col items-end ml-3 md:ml-4 flex-shrink-0">
                <div className="text-2xl md:text-3xl font-black tracking-tight text-orange-600">{stuckCount}</div>
                <div className="text-xs text-stone-500 font-medium">Leerlingen</div>
              </div>
            </div>

            {/* Focus */}
            <div className="bg-white rounded-2xl border-2 p-4 md:p-5 shadow-md flex items-center justify-between border-stone-400">
              <div className="flex-1 min-w-0">
                <HelpCircle className="w-4 h-4 text-stone-400 mb-1" strokeWidth={2} />
                <h3 className="font-bold text-stone-900 text-base md:text-lg mb-0.5 md:mb-1">In Focus</h3>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-600">STABIEL</p>
              </div>
              <div className="flex flex-col items-end ml-3 md:ml-4 flex-shrink-0">
                <div className="text-2xl md:text-3xl font-black tracking-tight text-stone-600">{focusCount}</div>
                <div className="text-xs text-stone-500 font-medium">Leerlingen</div>
              </div>
            </div>

            {/* Flow */}
            <div className="bg-white rounded-2xl border-2 p-4 md:p-5 shadow-md flex items-center justify-between border-emerald-400 ring-2 ring-emerald-100">
              <div className="flex-1 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-1" strokeWidth={2} />
                <h3 className="font-bold text-stone-900 text-base md:text-lg mb-0.5 md:mb-1">Flow</h3>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-600">GING GOED</p>
              </div>
              <div className="flex flex-col items-end ml-3 md:ml-4 flex-shrink-0">
                <div className="text-2xl md:text-3xl font-black tracking-tight text-emerald-600">{flowCount}</div>
                <div className="text-xs text-stone-500 font-medium">Leerlingen</div>
              </div>
            </div>
          </div>
        </div>

        {/* Klassenlijst */}
        <div className="bg-white rounded-2xl md:rounded-3xl border-2 border-stone-300 shadow-md p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-stone-900 mb-3 md:mb-4">Klassenlijst</h2>
          {dataHint ? <div className="mb-3 text-sm text-stone-500">{dataHint}</div> : null}

          <div className="mb-4 md:mb-6">
            <div className="relative">
              <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-stone-500" strokeWidth={2} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek leerling..."
                className="w-full pl-10 md:pl-12 pr-3 md:pr-4 py-2.5 md:py-3 bg-stone-100 border border-stone-300 rounded-xl md:rounded-2xl shadow-inner text-sm md:text-base text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-stone-500 focus:bg-white transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5 md:space-y-2 max-h-[600px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-stone-500 text-sm py-8 text-center">Geen studenten gevonden</div>
            ) : (
              filtered.map((student: any) => (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudent(student.name)}
                  className="w-full p-3 md:p-4 flex items-center gap-3 md:gap-4 rounded-xl md:rounded-2xl transition-all hover:bg-stone-50 hover:shadow-sm border border-stone-200 hover:border-stone-300 cursor-pointer group text-left bg-white"
                >
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-stone-300 flex items-center justify-center text-stone-800 font-bold text-xs md:text-sm flex-shrink-0 border border-stone-400">
                    {getInitials(student.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-stone-900 text-sm md:text-base mb-0.5 md:mb-1 flex items-center gap-2">
                      {student.name}
                      {student.deep_read && (
                        <span title="Diep-Lees Modus aan" className="text-stone-400">
                          <Lock className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs md:text-sm text-stone-600 truncate font-medium">{student.activity}</div>
                  </div>

                  <div className="flex flex-col md:flex-row items-end md:items-center gap-1.5 md:gap-3 flex-shrink-0">
                    <div className="text-xs md:text-sm text-stone-600 hidden md:block font-medium">{student.activity}</div>
                    <span className={statusBadge(student.status)}>{statusLabel(student.status)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedStudent && (
        <StudentDetailSheet studentName={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}

      {/* Role badge */}
      <div className="fixed bottom-4 right-4 z-[60]">
        <div className="rounded-full bg-stone-700 text-white text-xs px-3 py-1 shadow-sm border border-stone-500">
          teacher
        </div>
      </div>
    </div>
  )
}


