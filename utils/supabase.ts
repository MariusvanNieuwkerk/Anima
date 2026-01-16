// IMPORTANT: Browser client must use cookies so Next.js middleware can read the session.
// This aligns login/session with role-based routing.
'use client'

import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL of Anon Key mist in .env.local')
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

