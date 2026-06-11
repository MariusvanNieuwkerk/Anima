import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/utils/supabase/server'

// Wisselt de Supabase auth-code (PKCE) in voor een sessie.
// Gebruikt door e-mail flows zoals wachtwoord-herstel.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  // Alleen interne paden toestaan als redirect-doel (geen open redirect).
  const nextRaw = url.searchParams.get('next') || '/'
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/'

  if (code) {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
  }

  return NextResponse.redirect(new URL('/login?error=link_verlopen', url.origin))
}
