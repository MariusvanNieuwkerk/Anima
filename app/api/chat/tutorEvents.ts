import { createAdminClient } from '@/utils/supabase/admin'

// Observability: per beurt vastleggen welke laag antwoordde. Voedt het
// leerprofiel (de moat), kwaliteitsbewaking en later het ouderdashboard.
// 'canon' en 'grammar' bestaan alleen nog als historische data; nieuwe
// oefenstappen loggen als 'practice' (reken-vangrail).
export type TutorEventRoute = 'canon' | 'grammar' | 'policy' | 'llm' | 'error' | 'explain' | 'practice'

export type TutorEvent = {
  userId: string
  sessionId?: string | null
  route: TutorEventRoute
  canonKind?: string | null
  step?: string | null
  result?: string | null // 'correct' | 'wrong' | 'stuck' | 'explain' | null
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

// Grove, anonieme categorie voor LLM-doorval: vertelt WAAR de volgende
// canon moet komen, zonder dat we de inhoud van de vraag bewaren.
function llmCategory(userText: string): string {
  const t = String(userText || '').toLowerCase()
  if (/\d/.test(t) && /[+\-*/×÷=%]/.test(t)) return 'rekenen'
  if (/\b(reken|som|breuk|procent|korting|btw|keer|gedeeld|plus|min)\b/.test(t)) return 'rekenen'
  if (/\b(zin|zinnen|woord|spelling|grammatica|werkwoord|taal|schrijf|opstel|brief|samenvatting)\b/.test(t)) return 'taal'
  if (/\b(waar ligt|hoofdstad|land|rivier|kaart|wereld)\b/.test(t)) return 'wereld'
  if (/\b(wie was|geschiedenis|oorlog|vroeger|eeuw)\b/.test(t)) return 'geschiedenis'
  if (/\b(dier|plant|lichaam|natuur|waarom|hoe werkt|fotosynthese)\b/.test(t)) return 'natuur'
  return 'overig'
}

export async function logTutorEvent(ev: TutorEvent): Promise<void> {
  // 1) Gezins-event (eigendom van het gezin, RLS).
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

  // 2) Anonieme teller (geen user_id, geen tekst): productverbetering
  //    over alle gebruikers heen, zonder aan hun data te zitten.
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('bump_anon_tutor_stat', {
      p_route: ev.route,
      p_canon_kind:
        ev.route === 'practice'
          ? ev.canonKind || ''
          : ev.route === 'llm'
            ? llmCategory(String(ev.userText || ''))
            : '',
      // Stap-teksten niet anoniem tellen: hoge cardinaliteit vervuilt de tabel.
      p_step: '',
      p_result: ev.result || '',
    })
    if (error) throw error
  } catch (e) {
    console.warn('[anon_tutor_stats] bump failed:', (e as any)?.message || String(e))
  }
}
