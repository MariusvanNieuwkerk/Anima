'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/utils/supabase/admin'

type ParentChildSummary =
  | {
      ok: true
      requiresMigration?: boolean
      focus: Array<{ name: string; value: number; color: string }>
      flow: Array<{ name: string; label: string; value: number; color: string }>
      totalMinutes7d: number
      messageCount7d: number
      lastActiveAt?: string | null
    }
  | { ok: false; error: string }

type TeacherStudentRow = {
  id: string
  name: string
  username?: string | null
  deep_read_mode: boolean
  last_active_at?: string | null
  status: 'flow' | 'focus' | 'inactive'
  activityLabel: string
}

type TeacherDashboardResult =
  | { ok: true; requiresMigration?: boolean; students: TeacherStudentRow[] }
  | { ok: false; error: string }

function createCookieServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase env vars ontbreken (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  }
  const cookieStore = cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
        cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: any }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}

function isMissingColumn(errMsg: string, col: string, table: string) {
  const safe = String(errMsg || '')
  return new RegExp(`column\\s+${table}\\.${col}\\s+does\\s+not\\s+exist`, 'i').test(safe) || new RegExp(`${col}\\s+does\\s+not\\s+exist`, 'i').test(safe)
}

function clamp01(x: number) {
  if (x < 0) return 0
  if (x > 1) return 1
  return x
}

function minutesFromMessageCount(n: number) {
  // crude but stable: 1 message ≈ 2 minutes of “learning time”
  return Math.max(0, Math.round(n * 2))
}

function topicColor(i: number) {
  const palette = ['#a8a29e', '#d6d3d1', '#e7e5e4'] // stone-400/300/200
  return palette[i % palette.length]
}

function flowColor(i: number) {
  const palette = ['#f6caa2', '#5b5b5b', '#a8a29e']
  return palette[i % palette.length]
}

function labelForMinutes(mins: number) {
  if (mins >= 45) return 'Pittig'
  if (mins >= 20) return 'Stabiel'
  return 'Rustig'
}

export async function getParentChildSummary(input: { childId: string }): Promise<ParentChildSummary> {
  try {
    const childId = String(input.childId || '').trim()
    if (!childId) return { ok: false, error: 'Kies eerst een kind.' }

    const supabase = createCookieServerClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return { ok: false, error: 'Niet ingelogd. Log opnieuw in.' }

    const { data: parentProfile } = await supabase.from('profiles').select('id, role').eq('id', user.id).maybeSingle()
    if (!parentProfile || (parentProfile as any).role !== 'parent') return { ok: false, error: 'Alleen ouders kunnen dit dashboard zien.' }

    // Ownership check (RLS-safe)
    const { data: linkRow } = await supabase
      .from('family_links')
      .select('id')
      .eq('parent_id', user.id)
      .eq('child_id', childId)
      .maybeSingle()
    if (!linkRow) return { ok: false, error: 'Dit kind is niet gekoppeld aan dit ouder-account.' }

    const admin = createAdminClient()
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Pull messages for this child (requires migration 009)
    const msgs = await admin
      .from('messages')
      .select('role, topic, created_at')
      .eq('user_id', childId)
      .gte('created_at', since)

    if (msgs.error) {
      const m = String(msgs.error.message || '')
      if (isMissingColumn(m, 'user_id', 'messages') || isMissingColumn(m, 'topic', 'messages')) {
        return {
          ok: true,
          requiresMigration: true,
          focus: [],
          flow: [],
          totalMinutes7d: 0,
          messageCount7d: 0,
          lastActiveAt: null,
        }
      }
      return { ok: false, error: msgs.error.message || 'Kon berichten niet laden.' }
    }

    const rows = Array.isArray(msgs.data) ? msgs.data : []
    const messageCount7d = rows.length
    const totalMinutes7d = minutesFromMessageCount(messageCount7d)

    // Topic minutes from assistant messages (fallback to "Overig")
    const topicCount = new Map<string, number>()
    for (const r of rows) {
      if ((r as any).role !== 'assistant') continue
      const t = typeof (r as any).topic === 'string' ? (r as any).topic.trim() : ''
      if (!t) continue
      topicCount.set(t, (topicCount.get(t) || 0) + 1)
    }

    const sortedTopics = Array.from(topicCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    const focus =
      sortedTopics.length > 0
        ? sortedTopics.map(([name, count], idx) => ({ name, value: minutesFromMessageCount(count), color: topicColor(idx) }))
        : []

    // Flow bars: reuse top topics and normalize
    const max = Math.max(1, ...focus.map((f) => f.value))
    const flow =
      focus.length > 0
        ? focus.map((f, idx) => ({
            name: f.name,
            label: labelForMinutes(f.value),
            value: clamp01(f.value / max),
            color: flowColor(idx),
          }))
        : []

    // last_active_at optional (requires migration 010)
    let lastActiveAt: string | null = null
    const prof1 = await admin.from('profiles').select('last_active_at, updated_at').eq('id', childId).maybeSingle()
    if (!prof1.error && prof1.data) {
      lastActiveAt = (prof1.data as any).last_active_at || (prof1.data as any).updated_at || null
    } else if (prof1.error) {
      const msg = String(prof1.error.message || '')
      if (isMissingColumn(msg, 'last_active_at', 'profiles')) {
        const prof2 = await admin.from('profiles').select('updated_at').eq('id', childId).maybeSingle()
        lastActiveAt = (prof2.data as any)?.updated_at || null
      }
    }

    return { ok: true, focus, flow, totalMinutes7d, messageCount7d, lastActiveAt }
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return { ok: false, error: 'Server mist SUPABASE_SERVICE_ROLE_KEY. Voeg deze toe aan .env.local en Vercel env.' }
    }
    return { ok: false, error: 'Er ging iets mis. Probeer opnieuw.' }
  }
}

export async function getTeacherStudents(): Promise<TeacherDashboardResult> {
  try {
    const supabase = createCookieServerClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return { ok: false, error: 'Niet ingelogd. Log opnieuw in.' }

    const { data: teacherProfile } = await supabase.from('profiles').select('id, role').eq('id', user.id).maybeSingle()
    if (!teacherProfile || (teacherProfile as any).role !== 'teacher') {
      return { ok: false, error: 'Alleen leraren kunnen dit dashboard zien.' }
    }

    const admin = createAdminClient()
    // last_active_at is optional → try with it first.
    const q1 = await admin
      .from('profiles')
      .select('id, student_name, display_name, username, deep_read_mode, last_active_at')
      .eq('role', 'student')
      .order('last_active_at', { ascending: false })
      .limit(50)

    let kids: any[] = []
    let requiresMigration = false
    if (q1.error) {
      const msg = String(q1.error.message || '')
      if (isMissingColumn(msg, 'last_active_at', 'profiles')) {
        requiresMigration = true
        const q2 = await admin
          .from('profiles')
          .select('id, student_name, display_name, username, deep_read_mode, updated_at')
          .eq('role', 'student')
          .order('updated_at', { ascending: false })
          .limit(50)
        if (q2.error) return { ok: false, error: q2.error.message || 'Kon studenten niet laden.' }
        kids = Array.isArray(q2.data) ? (q2.data as any[]) : []
      } else if (isMissingColumn(msg, 'display_name', 'profiles')) {
        const q2 = await admin
          .from('profiles')
          .select('id, student_name, username, deep_read_mode, last_active_at')
          .eq('role', 'student')
          .order('last_active_at', { ascending: false })
          .limit(50)
        if (q2.error) return { ok: false, error: q2.error.message || 'Kon studenten niet laden.' }
        kids = Array.isArray(q2.data) ? (q2.data as any[]) : []
      } else {
        return { ok: false, error: q1.error.message || 'Kon studenten niet laden.' }
      }
    } else {
      kids = Array.isArray(q1.data) ? (q1.data as any[]) : []
    }

    const now = Date.now()
    const toStatus = (last: string | null) => {
      if (!last) return { status: 'inactive' as const, label: 'Geen activiteit' }
      const dt = new Date(last).getTime()
      const mins = Math.max(0, Math.round((now - dt) / 60000))
      if (mins <= 25) return { status: 'flow' as const, label: `Vandaag, ${mins} min` }
      if (mins <= 180) return { status: 'focus' as const, label: `Vandaag, ${Math.round(mins / 5) * 5} min` }
      return { status: 'inactive' as const, label: 'Eerder vandaag' }
    }

    const students: TeacherStudentRow[] = kids.map((k: any) => {
      const name = String(k.display_name || k.student_name || 'Student')
      const last = (k.last_active_at || k.updated_at || null) as string | null
      const s = toStatus(last)
      return {
        id: String(k.id),
        name,
        username: k.username ?? null,
        deep_read_mode: k.deep_read_mode === true,
        last_active_at: last,
        status: s.status,
        activityLabel: s.label,
      }
    })

    return { ok: true, requiresMigration, students }
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return { ok: false, error: 'Server mist SUPABASE_SERVICE_ROLE_KEY. Voeg deze toe aan .env.local en Vercel env.' }
    }
    return { ok: false, error: 'Er ging iets mis. Probeer opnieuw.' }
  }
}


