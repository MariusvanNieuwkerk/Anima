import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

// Duimpje-omlaag: de gebruiker schenkt bewust deze ENE beurt zodat wij
// het antwoord kunnen verbeteren. Dit is de enige route waarlangs
// gespreksinhoud bij ons terechtkomt — altijd expliciet, per geval.
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag.' }, { status: 400 })
  }

  const clip = (s: unknown, max = 2000) => {
    const t = typeof s === 'string' ? s.trim() : ''
    return t ? t.slice(0, max) : null
  }

  const assistantText = clip(body?.assistantText)
  const userText = clip(body?.userText)
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.slice(0, 100) : null

  if (!assistantText) {
    return NextResponse.json({ error: 'Geen bericht om te melden.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('feedback_reports').insert({
    user_id: user.id,
    session_id: sessionId,
    user_text: userText,
    assistant_text: assistantText,
  })

  if (error) {
    console.warn('[feedback] insert failed:', error.message)
    return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
