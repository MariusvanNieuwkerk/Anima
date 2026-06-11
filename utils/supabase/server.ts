import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Cookie-based Supabase client for Route Handlers / Server Actions.
 * This is the ONLY way to read the logged-in user's session server-side.
 */
export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const cookieStore = cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component: cookie writes are not allowed there.
          // Safe to ignore; middleware refreshes the session.
        }
      },
    },
  })
}

/** Returns the authenticated Supabase user, or null when not logged in. */
export async function getAuthenticatedUser() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
