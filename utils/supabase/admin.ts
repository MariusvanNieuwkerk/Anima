import 'server-only'

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!serviceRoleKey) {
    // IMPORTANT: must be set on server (.env.local + Vercel env). Never expose to client.
    throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}


