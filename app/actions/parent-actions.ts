'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/utils/supabase/admin'

type ActionResult =
  | { ok: true; childId: string; username: string }
  | { ok: false; error: string }

type DeleteResult =
  | { ok: true; childId: string }
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
      setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
        cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: any }) => {
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

export async function deleteChildAccount(input: { childId: string; confirm: string }): Promise<DeleteResult> {
  try {
    const childId = String(input.childId || '').trim()
    const confirm = String(input.confirm || '').trim()
    if (!childId) return { ok: false, error: 'Kies eerst een kind.' }
    if (!confirm) return { ok: false, error: 'Typ de naam/gebruikersnaam om te bevestigen.' }

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
    if (!parentProfile || parentProfile.role !== 'parent') return { ok: false, error: 'Alleen ouders mogen een kind verwijderen.' }

    // Ownership check: only delete if this child is linked to this parent
    const { data: linkRow, error: linkErr } = await supabase
      .from('family_links')
      .select('id')
      .eq('parent_id', user.id)
      .eq('child_id', childId)
      .maybeSingle()
    if (linkErr) return { ok: false, error: 'Kon gezinslink niet controleren.' }
    if (!linkRow) return { ok: false, error: 'Dit kind is niet gekoppeld aan dit ouder-account.' }

    const admin = createAdminClient()
    const { data: childProfile } = await admin
      .from('profiles')
      .select('display_name, username')
      .eq('id', childId)
      .maybeSingle()

    const expectedUsername = typeof (childProfile as any)?.username === 'string' ? String((childProfile as any).username) : ''
    const expectedName = typeof (childProfile as any)?.display_name === 'string' ? String((childProfile as any).display_name) : ''

    const norm = (s: string) => String(s || '').trim().toLowerCase()
    const typed = norm(confirm).replace(/^@/, '')
    const okMatch =
      (expectedUsername && typed === norm(expectedUsername)) || (expectedName && typed === norm(expectedName))

    if (!okMatch) {
      return {
        ok: false,
        error: expectedUsername
          ? `Bevestiging klopt niet. Typ exact: ${expectedUsername}`
          : expectedName
            ? `Bevestiging klopt niet. Typ exact: ${expectedName}`
            : 'Bevestiging klopt niet. Typ de naam van het kind precies over.',
      }
    }

    // 1) Remove the link row (RLS safe)
    const { error: delLinkErr } = await supabase
      .from('family_links')
      .delete()
      .eq('parent_id', user.id)
      .eq('child_id', childId)
    if (delLinkErr) return { ok: false, error: delLinkErr.message || 'Kon koppeling niet verwijderen.' }

    // 2) Delete auth user (service role). This keeps the parent logged in.
    const { error: delAuthErr } = await admin.auth.admin.deleteUser(childId)
    if (delAuthErr && !/not\s+found/i.test(delAuthErr.message || '')) {
      return { ok: false, error: delAuthErr.message || 'Kon auth user niet verwijderen.' }
    }

    // 3) Best-effort: remove profile row if it still exists.
    await admin.from('profiles').delete().eq('id', childId)

    return { ok: true, childId }
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return { ok: false, error: 'Server mist SUPABASE_SERVICE_ROLE_KEY. Voeg deze toe aan .env.local en Vercel env.' }
    }
    return { ok: false, error: 'Er ging iets mis. Probeer opnieuw.' }
  }
}


