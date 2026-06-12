import { createAdminClient } from '@/utils/supabase/admin'

// ====================================================================
// LEERPROFIEL (de moat): wat weet Anima al over dit kind?
//
// Geen aparte tabel, geen migratie: het profiel wordt per beurt vers
// afgeleid uit tutor_events (de gezinsdata, RLS-beschermd). Het resultaat
// is een compact tekstblok dat in elke LLM-prompt meegaat, zodat de tutor
// kan aansluiten op wat het kind al oefende en waar het vastliep.
//
// Eigendom: de events zijn van het gezin (RLS), het profiel verlaat de
// server alleen als promptcontext — het wordt nergens apart opgeslagen.
// ====================================================================

const KIND_LABELS: Record<string, string> = {
  div: 'delen (staartdeling)',
  frac: 'breuken vereenvoudigen',
  add: 'optellen',
  sub: 'aftrekken',
  mul: 'vermenigvuldigen',
  percent: 'procenten',
  order_ops: 'rekenvolgorde',
  arith_unit: 'rekenen met eenheden',
  dec_muldiv: 'kommagetallen vermenigvuldigen en delen',
  round: 'afronden',
  ratio: 'verhoudingen en schaal',
  money_change: 'rekenen met geld (wisselgeld)',
  money_fee: 'rekenen met geld (kosten erbij)',
  money_split: 'rekenen met geld (eerlijk verdelen)',
  money_discount_total: 'korting berekenen',
  money_discount_vat: 'korting en btw',
  money_change_rate: 'prijs per kilo/liter',
  negatives: 'negatieve getallen',
  unknown: 'sommen met een onbekende (x)',
  units: 'eenheden omrekenen',
  frac_addsub: 'breuken optellen en aftrekken',
  frac_muldiv: 'breuken vermenigvuldigen en delen',
  percent_word: 'verhaaltjessommen met procenten',
  convert: 'maten omrekenen',
}

const labelFor = (kind: string): string => KIND_LABELS[kind] || kind.replace(/_/g, ' ')

function daysAgoText(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'vandaag'
  if (days === 1) return 'gisteren'
  if (days < 14) return `${days} dagen geleden`
  return `${Math.round(days / 7)} weken geleden`
}

type SkillAgg = {
  starts: number
  dones: number
  stucks: number
  lastAt: string
}

// Compact tekstblok voor in de prompt, of null als er nog niets bekend is.
// Mag nooit de chat breken: elke fout → null.
export async function buildLearnerProfileBlock(userId: string): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
    const { data, error } = await admin
      .from('tutor_events')
      .select('created_at, route, canon_kind, result, user_text')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(400)
    if (error) throw error
    const rows = Array.isArray(data) ? data : []
    if (rows.length === 0) return null

    const skills = new Map<string, SkillAgg>()
    const explainTopics: string[] = []
    let stuckRecent = 0

    for (const r of rows) {
      const result = String(r.result || '')
      if (result === 'stuck') stuckRecent++

      if (r.route === 'canon' && r.canon_kind) {
        const kind = String(r.canon_kind)
        const agg = skills.get(kind) || { starts: 0, dones: 0, stucks: 0, lastAt: String(r.created_at) }
        // rows zijn aflopend gesorteerd: de eerste keer dat we deze skill
        // zien is meteen de recentste activiteit.
        if (!skills.has(kind)) agg.lastAt = String(r.created_at)
        if (result === 'start') agg.starts++
        if (result === 'done') agg.dones++
        if (result === 'stuck') agg.stucks++
        skills.set(kind, agg)
      }

      if (r.route === 'explain' && explainTopics.length < 3) {
        const q = String(r.user_text || '').trim()
        if (q && !explainTopics.includes(q)) explainTopics.push(q)
      }
    }

    const lines: string[] = []

    const ordered = [...skills.entries()].sort(
      (a, b) => new Date(b[1].lastAt).getTime() - new Date(a[1].lastAt).getTime()
    )
    for (const [kind, agg] of ordered.slice(0, 6)) {
      const total = Math.max(agg.starts, agg.dones)
      if (total === 0 && agg.stucks === 0) continue
      const parts: string[] = []
      if (agg.starts > 0) parts.push(`${agg.starts} ${agg.starts === 1 ? 'som' : 'sommen'} geoefend`)
      if (agg.dones > 0) parts.push(`${agg.dones} afgemaakt`)
      if (agg.stucks > 0) parts.push(`${agg.stucks}× vastgelopen`)
      const when = daysAgoText(agg.lastAt)
      lines.push(`- ${labelFor(kind)}: ${parts.join(', ')}${when ? ` (laatst: ${when})` : ''}`)
    }

    if (explainTopics.length > 0) {
      lines.push(`- vroeg recent uitleg over: ${explainTopics.map((t) => `"${t.slice(0, 80)}"`).join(', ')}`)
    }

    if (lines.length === 0) return null
    if (stuckRecent >= 3) {
      lines.push(`- liep de afgelopen tijd ${stuckRecent}× vast — extra geduld en kleinere stappen helpen`)
    }
    return lines.join('\n')
  } catch (e) {
    console.warn('[learner_profile] build failed:', (e as any)?.message || String(e))
    return null
  }
}
