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

type LinkResult =
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

function isMissingDisplayNameColumn(errMsg: string) {
  return (
    /column\s+profiles\.display_name\s+does\s+not\s+exist/i.test(errMsg) ||
    /display_name\s+does\s+not\s+exist/i.test(errMsg) ||
    /could\s+not\s+find\s+the\s+'display_name'\s+column\s+of\s+'profiles'\s+in\s+the\s+schema\s+cache/i.test(errMsg)
  )
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

    const email = proxyEmailForUsername(username)
    const admin = createAdminClient()

    // Prevent collisions (admin bypasses RLS, so this is the real source of truth).
    // - username must be unique (case-insensitive index)
    // - proxy email must not already exist
    const { data: existingByUsername, error: existingUserErr } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (existingUserErr) return { ok: false, error: existingUserErr.message || 'Kon gebruikersnaam niet controleren.' }
    if (existingByUsername?.id) return { ok: false, error: 'Deze gebruikersnaam is al bezet.' }

    // NOTE: Some deployments don't have profiles.email yet. We do NOT pre-check proxy-email via profiles.
    // If the auth email already exists, createUser will return a clear error.

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'student', full_name: displayName },
    })
    if (createErr || !created?.user?.id) {
      const raw = String(createErr?.message || 'Kon kind-account niet aanmaken.')
      if (/already|exists|registered|duplicate/i.test(raw)) {
        return { ok: false, error: 'Deze gebruikersnaam bestaat al (proxy-email is al geregistreerd). Kies een andere.' }
      }
      // Supabase sometimes returns a generic message; give an actionable hint.
      if (/database error creating new user/i.test(raw)) {
        return {
          ok: false,
          error:
            'Kon geen nieuw kind-account aanmaken door een database-trigger in Supabase.\n\nMeest voorkomend: je `profiles` schema mist kolommen die de standaard “create profile on auth user” trigger verwacht (bij jou ontbrak `profiles.email`).\n\nFix:\n- Voer migratie `006_profiles_email.sql` uit in Supabase (SQL Editor)\n- Redeploy in Vercel\n- Probeer opnieuw met een nieuwe username',
        }
      }
      return { ok: false, error: raw }
    }

    const childId = created.user.id

    // Ensure a profile exists (admin bypasses RLS). Upsert keeps it safe if a trigger already created it.
    const profileBaseWithDisplayName: any = {
      id: childId,
      role: 'student',
      username,
      display_name: displayName,
      student_name: displayName,
    }
    const profileBaseNoDisplayName: any = {
      id: childId,
      role: 'student',
      username,
      student_name: displayName,
    }
    // Try with email first (preferred), but fall back if the column doesn't exist.
    const tryUpsert = async (row: any) => admin.from('profiles').upsert(row, { onConflict: 'id' })
    const up1 = await tryUpsert({ ...profileBaseWithDisplayName, email })
    if (up1.error) {
      const msg1 = String(up1.error.message || '')

      // Remove email if column is missing
      if (/column\\s+profiles\\.email\\s+does\\s+not\\s+exist/i.test(msg1) || /email\\s+does\\s+not\\s+exist/i.test(msg1)) {
        const up2 = await tryUpsert(profileBaseWithDisplayName)
        if (up2.error) {
          const msg2 = String(up2.error.message || '')
          if (isMissingDisplayNameColumn(msg2)) {
            const up3 = await tryUpsert(profileBaseNoDisplayName)
            if (up3.error) return { ok: false, error: up3.error.message || 'Kon student-profiel niet opslaan.' }
          } else {
            return { ok: false, error: up2.error.message || 'Kon student-profiel niet opslaan.' }
          }
        }
      } else if (isMissingDisplayNameColumn(msg1)) {
        // Remove display_name if column is missing
        const up2 = await tryUpsert({ ...profileBaseNoDisplayName, email })
        if (up2.error) {
          const msg2 = String(up2.error.message || '')
          if (/column\\s+profiles\\.email\\s+does\\s+not\\s+exist/i.test(msg2) || /email\\s+does\\s+not\\s+exist/i.test(msg2)) {
            const up3 = await tryUpsert(profileBaseNoDisplayName)
            if (up3.error) return { ok: false, error: up3.error.message || 'Kon student-profiel niet opslaan.' }
          } else {
            return { ok: false, error: up2.error.message || 'Kon student-profiel niet opslaan.' }
          }
        }
      } else {
        return { ok: false, error: up1.error.message || 'Kon student-profiel niet opslaan.' }
      }
    }

    // Link parent -> child (use cookie client so RLS applies)
    const { error: linkErr } = await supabase.from('family_links').insert({ parent_id: user.id, child_id: childId })
    if (linkErr) {
      // Roll back created auth user to avoid orphan accounts.
      try {
        await admin.auth.admin.deleteUser(childId)
        await admin.from('profiles').delete().eq('id', childId)
      } catch {
        // ignore rollback errors
      }
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
    // Some DBs don't have profiles.display_name → fall back to student_name.
    let childProfile: any = null
    const sel1 = await admin.from('profiles').select('display_name, username, student_name').eq('id', childId).maybeSingle()
    if (sel1.error && isMissingDisplayNameColumn(String(sel1.error.message || ''))) {
      const sel2 = await admin.from('profiles').select('student_name, username').eq('id', childId).maybeSingle()
      childProfile = sel2.data
    } else {
      childProfile = sel1.data
    }

    const expectedUsername = typeof (childProfile as any)?.username === 'string' ? String((childProfile as any).username) : ''
    const expectedName =
      typeof (childProfile as any)?.display_name === 'string'
        ? String((childProfile as any).display_name)
        : typeof (childProfile as any)?.student_name === 'string'
          ? String((childProfile as any).student_name)
          : ''

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

export async function linkExistingChildByUsername(input: { username: string }): Promise<LinkResult> {
  try {
    const username = normalizeUsername(input.username)
    if (!username) return { ok: false, error: 'Vul een gebruikersnaam in.' }

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
    if (!parentProfile || parentProfile.role !== 'parent') return { ok: false, error: 'Alleen ouders mogen een kind koppelen.' }

    const admin = createAdminClient()
    // Find the child profile by username (preferred) or by proxy email.
    const proxyEmail = proxyEmailForUsername(username)

    // Some DBs don't have profiles.display_name → fall back to student_name.
    let childProfile: any = null
    const q1 = await admin
      .from('profiles')
      .select('id, role, username, display_name, student_name, email')
      .or(`username.eq.${username},email.eq.${proxyEmail}`)
      .maybeSingle()
    if (q1.error && isMissingDisplayNameColumn(String(q1.error.message || ''))) {
      const q2 = await admin
        .from('profiles')
        .select('id, role, username, student_name, email')
        .or(`username.eq.${username},email.eq.${proxyEmail}`)
        .maybeSingle()
      childProfile = q2.data
      if (q2.error) return { ok: false, error: q2.error.message || 'Kon kind-profiel niet vinden.' }
    } else {
      childProfile = q1.data
      if (q1.error) return { ok: false, error: q1.error.message || 'Kon kind-profiel niet vinden.' }
    }
    if (!childProfile?.id) return { ok: false, error: 'Geen bestaand kind-account gevonden met deze gebruikersnaam.' }
    if ((childProfile as any).role !== 'student') return { ok: false, error: 'Dit account is geen student-account.' }

    const childId = String((childProfile as any).id)

    // Insert family link (RLS applies)
    const { error: linkErr } = await supabase.from('family_links').insert({ parent_id: user.id, child_id: childId })
    if (linkErr) {
      const msg = String(linkErr.message || '')
      if (/duplicate|unique|already/i.test(msg)) {
        return { ok: false, error: 'Dit kind is al gekoppeld.' }
      }
      return { ok: false, error: msg || 'Kon koppeling niet opslaan.' }
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


