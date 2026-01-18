import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Safe health check: verifies SUPABASE_SERVICE_ROLE_KEY works without returning user lists.
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: 'Missing env vars', hasUrl: Boolean(supabaseUrl), hasServiceKey: Boolean(serviceKey) },
        { status: 200 }
      )
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Lightweight call (does not expose data)
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 })
  }
}


