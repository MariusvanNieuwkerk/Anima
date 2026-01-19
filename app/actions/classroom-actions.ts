'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/utils/supabase/admin'

type TeacherClassroom = { id: number; name: string; join_code: string; created_at: string }

type TeacherClassroomsResult =
  | { ok: true; classrooms: TeacherClassroom[] }
  | { ok: false; error: string }

type CreateClassroomResult =
  | { ok: true; classroom: TeacherClassroom }
  | { ok: false; error: string }

type JoinClassroomResult =
  | { ok: true; classroomId: number; classroomName: string }
  | { ok: false; error: string }

type ApprovedStudent = { id: string; name: string; username?: string | null; deep_read_mode: boolean; approved_at: string }

type ApprovedStudentsResult =
  | { ok: true; students: ApprovedStudent[] }
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

function normalizeJoinCode(raw: string) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function generateJoinCode(len = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O/0/I/1
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export async function teacherListClassrooms(): Promise<TeacherClassroomsResult> {
  try {
    const supabase = createCookieServerClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return { ok: false, error: 'Niet ingelogd. Log opnieuw in.' }

    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if ((prof as any)?.role !== 'teacher') return { ok: false, error: 'Alleen leraren kunnen klassen beheren.' }

    const res = await supabase
      .from('classrooms')
      .select('id, name, join_code, created_at')
      .eq('teacher_profile_id', user.id)
      .order('created_at', { ascending: false })

    if (res.error) return { ok: false, error: res.error.message || 'Kon klassen niet laden.' }
    const classrooms = (Array.isArray(res.data) ? res.data : []).filter(Boolean).map((c: any) => ({
      id: Number(c.id),
      name: String(c.name || 'Klas'),
      join_code: String(c.join_code || ''),
      created_at: String(c.created_at || new Date().toISOString()),
    }))
    return { ok: true, classrooms }
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return { ok: false, error: 'Server mist SUPABASE_SERVICE_ROLE_KEY. Voeg deze toe aan .env.local en Vercel env.' }
    }
    return { ok: false, error: 'Er ging iets mis. Probeer opnieuw.' }
  }
}

export async function teacherCreateClassroom(input: { name: string }): Promise<CreateClassroomResult> {
  try {
    const name = String(input.name || '').trim() || 'Mijn klas'
    const supabase = createCookieServerClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return { ok: false, error: 'Niet ingelogd. Log opnieuw in.' }

    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if ((prof as any)?.role !== 'teacher') return { ok: false, error: 'Alleen leraren kunnen klassen maken.' }

    // Try a few times in case of join_code collision
    let lastErr: any = null
    for (let attempt = 0; attempt < 4; attempt++) {
      const join_code = generateJoinCode()
      const ins = await supabase
        .from('classrooms')
        .insert({ name, teacher_profile_id: user.id, join_code })
        .select('id, name, join_code, created_at')
        .single()
      if (!ins.error && ins.data) {
        return {
          ok: true,
          classroom: {
            id: Number((ins.data as any).id),
            name: String((ins.data as any).name || name),
            join_code: String((ins.data as any).join_code || join_code),
            created_at: String((ins.data as any).created_at || new Date().toISOString()),
          },
        }
      }
      lastErr = ins.error
      const msg = String(ins.error?.message || '')
      if (!/duplicate|unique/i.test(msg)) break
    }
    return { ok: false, error: String(lastErr?.message || 'Kon klas niet maken.') }
  } catch (e: any) {
    const msg = String(e?.message || '')
    return { ok: false, error: msg || 'Er ging iets mis. Probeer opnieuw.' }
  }
}

export async function parentJoinClassroomByCode(input: { childId: string; code: string }): Promise<JoinClassroomResult> {
  try {
    const childId = String(input.childId || '').trim()
    const code = normalizeJoinCode(input.code)
    if (!childId) return { ok: false, error: 'Kies eerst een kind.' }
    if (!code || code.length < 4) return { ok: false, error: 'Vul een geldige klascode in.' }

    const supabase = createCookieServerClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return { ok: false, error: 'Niet ingelogd. Log opnieuw in.' }

    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if ((prof as any)?.role !== 'parent') return { ok: false, error: 'Alleen ouders kunnen een kind koppelen aan school.' }

    // Ownership check (RLS safe, via family_links policies)
    const { data: linkRow } = await supabase
      .from('family_links')
      .select('id')
      .eq('parent_id', user.id)
      .eq('child_id', childId)
      .maybeSingle()
    if (!linkRow) return { ok: false, error: 'Dit kind is niet gekoppeld aan dit ouder-account.' }

    const admin = createAdminClient()
    const classroomRes = await admin
      .from('classrooms')
      .select('id, name')
      .ilike('join_code', code)
      .maybeSingle()
    if (classroomRes.error) return { ok: false, error: classroomRes.error.message || 'Kon klas niet vinden.' }
    if (!classroomRes.data?.id) return { ok: false, error: 'Onbekende klascode.' }

    const classroomId = Number((classroomRes.data as any).id)
    const classroomName = String((classroomRes.data as any).name || 'Klas')

    // Insert link; approval happens here (parent confirms).
    const ins = await supabase.from('classroom_students').insert({
      classroom_id: classroomId,
      student_id: childId,
      parent_id: user.id,
      approved_at: new Date().toISOString(),
    })
    if (ins.error) {
      const msg = String(ins.error.message || '')
      if (/duplicate|unique/i.test(msg)) return { ok: false, error: 'Dit kind is al gekoppeld aan deze klas.' }
      return { ok: false, error: ins.error.message || 'Kon koppeling niet opslaan.' }
    }

    return { ok: true, classroomId, classroomName }
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return { ok: false, error: 'Server mist SUPABASE_SERVICE_ROLE_KEY. Voeg deze toe aan .env.local en Vercel env.' }
    }
    return { ok: false, error: 'Er ging iets mis. Probeer opnieuw.' }
  }
}

export async function teacherListApprovedStudents(input: { classroomId: number }): Promise<ApprovedStudentsResult> {
  try {
    const classroomId = Number(input.classroomId)
    if (!Number.isFinite(classroomId) || classroomId <= 0) return { ok: false, error: 'Ongeldige klas.' }

    const supabase = createCookieServerClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return { ok: false, error: 'Niet ingelogd. Log opnieuw in.' }

    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if ((prof as any)?.role !== 'teacher') return { ok: false, error: 'Alleen leraren kunnen dit zien.' }

    // Ensure teacher owns this classroom (RLS-safe)
    const { data: cls } = await supabase
      .from('classrooms')
      .select('id')
      .eq('id', classroomId)
      .eq('teacher_profile_id', user.id)
      .maybeSingle()
    if (!cls) return { ok: false, error: 'Geen toegang tot deze klas.' }

    // Get approved links (RLS policy already enforces approved_at not null for teachers)
    const links = await supabase
      .from('classroom_students')
      .select('student_id, approved_at')
      .eq('classroom_id', classroomId)
      .not('approved_at', 'is', null)
      .order('approved_at', { ascending: false })

    if (links.error) return { ok: false, error: links.error.message || 'Kon leerlingen niet laden.' }
    const studentIds = (Array.isArray(links.data) ? links.data : []).map((r: any) => r.student_id).filter(Boolean)
    if (studentIds.length === 0) return { ok: true, students: [] }

    // Profiles may be RLS-restricted; use admin client but only for these ids.
    const admin = createAdminClient()
    const profs = await admin.from('profiles').select('id, student_name, display_name, username, deep_read_mode').in('id', studentIds)
    if (profs.error) return { ok: false, error: profs.error.message || 'Kon profielen niet laden.' }

    const byId = new Map<string, any>()
    for (const p of Array.isArray(profs.data) ? profs.data : []) byId.set(String((p as any).id), p)

    const students: ApprovedStudent[] = (Array.isArray(links.data) ? links.data : []).map((l: any) => {
      const sid = String(l.student_id)
      const p = byId.get(sid) || {}
      return {
        id: sid,
        name: String(p.display_name || p.student_name || 'Leerling'),
        username: p.username ?? null,
        deep_read_mode: p.deep_read_mode === true,
        approved_at: String(l.approved_at || ''),
      }
    })

    return { ok: true, students }
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return { ok: false, error: 'Server mist SUPABASE_SERVICE_ROLE_KEY. Voeg deze toe aan .env.local en Vercel env.' }
    }
    return { ok: false, error: 'Er ging iets mis. Probeer opnieuw.' }
  }
}


