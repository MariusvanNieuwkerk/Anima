'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/utils/supabase/admin'

type ActionResult =
  | { ok: true; childId: string; username: string }
  | { ok: false; error: string }

function normalizeUsername(raw: string) {
  const s = String(raw || '').trim().toLowerCase()
  // Roblox-ish: letters, numbers, underscore, dash, dot. No spaces.
  const cleaned = s.replace(/[^a-z0-9._-]/g, '')
  return cleaned
}

function proxyEmailForUsername(username: string) {
  return `${username}@student.anima.app`
}

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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}

export async function createChildAccount(input: {
  username: string
  password: string
  displayName: string
}): Promise<ActionResult> {
  try {
    const username = normalizeUsername(input.username)
    const displayName = String(input.displayName || '').trim()
    const password = String(input.password || '')

    if (!username || username.length < 3) return { ok: false, error: 'Gebruikersnaam is te kort (min 3 tekens).' }
    if (username.length > 24) return { ok: false, error: 'Gebruikersnaam is te lang (max 24 tekens).' }
    if (!/^[a-z0-9]/.test(username)) return { ok: false, error: 'Gebruikersnaam moet met een letter of cijfer beginnen.' }
    if (!displayName) return { ok: false, error: 'Roepnaam is verplicht.' }
    if (password.length < 6) return { ok: false, error: 'Wachtwoord is te kort (min 6 tekens).' }

    const supabase = createCookieServerClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return { ok: false, error: 'Niet ingelogd. Log opnieuw in.' }

    const { data: parentProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileErr) return { ok: false, error: 'Kon profiel niet laden.' }
    if (!parentProfile || parentProfile.role !== 'parent') return { ok: false, error: 'Alleen ouders mogen een kind toevoegen.' }

    // Prevent username collisions (case-insensitive; we store lowercase)
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
    if (existing?.id) return { ok: false, error: 'Deze gebruikersnaam is al bezet.' }

    const email = proxyEmailForUsername(username)
    const admin = createAdminClient()

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'student', full_name: displayName },
    })
    if (createErr || !created?.user?.id) {
      return { ok: false, error: createErr?.message || 'Kon kind-account niet aanmaken.' }
    }

    const childId = created.user.id

    // Ensure a profile exists (admin bypasses RLS). Upsert keeps it safe if a trigger already created it.
    const { error: upsertErr } = await admin.from('profiles').upsert(
      {
        id: childId,
        email,
        role: 'student',
        username,
        display_name: displayName,
        student_name: displayName,
      },
      { onConflict: 'id' }
    )
    if (upsertErr) {
      return { ok: false, error: upsertErr.message || 'Kon student-profiel niet opslaan.' }
    }

    // Link parent -> child (use cookie client so RLS applies)
    const { error: linkErr } = await supabase.from('family_links').insert({ parent_id: user.id, child_id: childId })
    if (linkErr) {
      return { ok: false, error: linkErr.message || 'Kon gezinslink niet opslaan.' }
    }

    return { ok: true, childId, username }
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return { ok: false, error: 'Server mist SUPABASE_SERVICE_ROLE_KEY. Voeg deze toe aan .env.local en Vercel env.' }
    }
    return { ok: false, error: 'Er ging iets mis. Probeer opnieuw.' }
  }
}


