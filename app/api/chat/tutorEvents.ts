import { createAdminClient } from '@/utils/supabase/admin'

// Observability (roadmap stap 3): per beurt vastleggen welke laag
// antwoordde. Voedt kwaliteitsbewaking, de roadmap (welke vragen vallen
// door naar de LLM?) en later het ouderdashboard.
export type TutorEventRoute = 'canon' | 'grammar' | 'policy' | 'llm' | 'error'

export type TutorEvent = {
  userId: string
  sessionId?: string | null
  route: TutorEventRoute
  canonKind?: string | null
  step?: string | null
  result?: string | null // 'start' | 'continue' | 'done' | 'stuck' | null
  userText?: string | null
  assistantText?: string | null
}

const clip = (s: unknown, max = 300): string | null => {
  const t = typeof s === 'string' ? s.trim() : ''
  if (!t) return null
  return t.length > max ? t.slice(0, max) : t
}

export function looksStuck(s: string): boolean {
  return /\b(weet (ik|het) niet|ik weet het niet|geen idee|snap (het|t) niet|ik kom er niet uit|lukt niet|help)\b/i.test(
    String(s || '')
  )
}

export async function logTutorEvent(ev: TutorEvent): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('tutor_events').insert({
      user_id: ev.userId,
      session_id: ev.sessionId || null,
      route: ev.route,
      canon_kind: ev.canonKind || null,
      step: ev.step || null,
      result: ev.result || null,
      user_text: clip(ev.userText),
      assistant_text: clip(ev.assistantText),
    })
    if (error) throw error
  } catch (e) {
    // Observability mag de chat nooit breken.
    console.warn('[tutor_events] insert failed:', (e as any)?.message || String(e))
  }
}
