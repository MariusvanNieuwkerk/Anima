// ====================================================================
// DUNNE GESPREKSREGELS
//
// Dit bestand was ooit een canon-motor van 1.500+ regels die sommen uit
// de chatgeschiedenis opgroef en gesprekken kaapte. Die motor is weg:
// rekenen en taal gaan naar de LLM, met de reken-vangrail in
// mathChecker.ts. Wat hier overblijft is alleen gespreksbesturing die
// een server beter doet dan een model:
//
//   1. Stopsignalen   → vriendelijk afsluiten, geen wedervraag
//   2. Kale ja/nee    → zonder openstaande vraag: netjes afronden
//   3. "ok"-reacties  → op een openstaande vraag: om het antwoord vragen
//   4. "Klaar"-hygiëne → geen nieuwe vraag ná een afrondingszin
//   5. applyAgeStyleText → lengte op leeftijd (laat invul-prompts met rust)
// ====================================================================

export type TutorPolicyContext = {
  userLanguage?: string
  userAge?: number
  messages?: any[]
  lastUserText?: string
}

export type TutorPayload = {
  message: string
  action?: string
  topic?: string | null
  graph?: any
  map?: any
  image?: any
  formula?: any
  [k: string]: any
}

export type TutorDebugEvent = {
  name: string
  details?: Record<string, any>
}

const strip = (s: any) => String(s || '').trim()

type AgeBand = 'junior' | 'teen' | 'student'
const getAgeBand = (age?: number): AgeBand => {
  const a = Number(age)
  if (!Number.isFinite(a)) return 'teen'
  if (a <= 12) return 'junior'
  if (a <= 16) return 'teen'
  return 'student'
}

export function applyAgeStyleText(message: string, ctx: { userAge?: number; userLanguage?: string }): string {
  const t = String(message || '').trim()
  if (!t) return t
  // Invul-prompts ("Vul in: 8×10 = __") nooit inkorten.
  if (t.includes('__')) return t

  const ageBand = getAgeBand(ctx.userAge)
  const maxSentences = ageBand === 'teen' ? 3 : 2

  const firstPara = t.split(/\n\s*\n/)[0].trim()
  const parts = firstPara.split(/(?<=[.!?])\s+/).filter(Boolean)
  if (parts.length <= maxSentences) return firstPara
  return parts.slice(0, maxSentences).join(' ').trim()
}

// ---------------------------------------------------------------
// Signalen
// ---------------------------------------------------------------

const isStopSignal = (t: string) =>
  t.length > 0 &&
  t.length <= 32 &&
  !/[?¿]/.test(t) &&
  /^(niets|nee\s+hoor|laat\s+maar|stop|klaar|geen\s+vragen|geen\s+verdere\s+vragen|that'?s\s+all|nothing|no\s+thanks)\b[!.]*$/i.test(
    t
  )

const isAckOnly = (t: string) =>
  t.length > 0 &&
  t.length <= 24 &&
  !/[?¿]/.test(t) &&
  /^(ok(é|ay)?|klopt|top|prima|goed|thanks|thank\s+you|dank(je|jewel|u)?)\b[!.]*$/i.test(t)

const isBareYesNo = (t: string) =>
  t.length > 0 && t.length <= 8 && !/[?¿]/.test(t) && /^(ja|nee|yes|no|yep|nope)\b[!.]*$/i.test(t)

const getPrevAssistantText = (messages?: any[]) => {
  const arr = Array.isArray(messages) ? messages : []
  for (let i = arr.length - 2; i >= 0; i--) {
    const m = arr[i]
    if (m?.role && m.role !== 'user') return strip(m?.content)
  }
  return ''
}

const takeFirstSentenceNoQuestion = (s: string) => {
  const t = String(s || '').trim()
  if (!t) return ''
  let out = ''
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (ch === '\n') break
    if (ch === '?' || ch === '!' || ch === '.') {
      out += ch === '?' ? '.' : ch
      break
    }
    out += ch
  }
  return out.trim()
}

const stripAfterFirstQuestion = (s: string) => {
  const t = String(s || '').trim()
  if (!t) return ''
  const q = t.indexOf('?')
  if (q === -1) return t
  const before = t.slice(0, q).trim()
  return (before.endsWith(':') ? before.slice(0, -1) : before).trim() + '.'
}

// ---------------------------------------------------------------
// Policy
// ---------------------------------------------------------------

export function applyTutorPolicy(payload: TutorPayload, ctx: TutorPolicyContext): TutorPayload {
  return applyTutorPolicyWithDebug(payload, ctx).payload
}

export function applyTutorPolicyWithDebug(
  payload: TutorPayload,
  ctx: TutorPolicyContext
): { payload: TutorPayload; debug: TutorDebugEvent[] } {
  const out: TutorPayload = { ...payload }
  const debug: TutorDebugEvent[] = []
  const mark = (name: string, details?: Record<string, any>) => debug.push({ name, details })

  const lang = String(ctx.userLanguage || 'nl')
  const lastUser = strip(ctx.lastUserText)
  const messages = Array.isArray(ctx.messages) ? ctx.messages : []
  const prevAssistant = getPrevAssistantText(messages)
  const turn = messages.filter((m: any) => m?.role === 'user').length
  const v = ((turn % 3) + 3) % 3

  const closuresNl = [
    'Top. Als je nog iets wilt weten, typ het maar.',
    'Helder. Je mag altijd een nieuwe vraag sturen.',
    'Oké. Zeg het maar als je nog iets nodig hebt.',
  ]
  const closuresEn = [
    'Got it. If you have another question, just type it.',
    'Clear. Feel free to ask a new question anytime.',
    'Okay. Tell me if you need anything else.',
  ]
  const closure = () => (lang === 'en' ? closuresEn[v] : closuresNl[v])

  // 1) Stopsignalen: de leerling bepaalt wanneer het klaar is.
  if (lastUser && isStopSignal(lastUser)) {
    mark('stop_signal', { lastUser })
    const byeNl = ['Oké. Tot later.', 'Helemaal goed. Tot zo.', 'Prima. Laat maar weten als je nog iets hebt.']
    const byeEn = ['Okay. See you later.', 'All good. Talk soon.', 'Sure. Let me know if you need anything else.']
    out.message = lang === 'en' ? byeEn[v] : byeNl[v]
    out.action = out.action || 'none'
    return { payload: out, debug }
  }

  // 2) Kale ja/nee zonder openstaande vraag: afronden, geen wedervraag.
  if (lastUser && isBareYesNo(lastUser) && !/\?\s*$/.test(prevAssistant)) {
    mark('bare_yes_no_close', { lastUser })
    out.message = closure()
    out.action = out.action || 'none'
    return { payload: out, debug }
  }

  // 3) "ok" op een openstaande vraag: vraag om het echte antwoord; anders afronden.
  if (lastUser && isAckOnly(lastUser)) {
    if (/\?\s*$/.test(prevAssistant)) {
      mark('ack_only_answer_last_q')
      out.message =
        lang === 'en' ? `Got it. What’s your answer to my last question?` : `Top. Wat is jouw antwoord op mijn laatste vraag?`
    } else {
      mark('ack_only_close')
      out.message = closure()
    }
    out.action = out.action || 'none'
    return { payload: out, debug }
  }

  // 4) "Klaar"-hygiëne: meldt het model dat het af is, dan geen nieuwe vraag erachteraan.
  const msg = String(out?.message || '')
  const hasCompletionMarker = /\b(we\s+zijn\s+klaar|klaar\.?$|dat\s+is\s+het|that'?s\s+it|we'?re\s+done|done\.)\b/i.test(
    msg.toLowerCase()
  )
  if (hasCompletionMarker && /\?/.test(msg)) {
    mark('strip_question_after_completion')
    out.message = stripAfterFirstQuestion(msg) || takeFirstSentenceNoQuestion(msg) || (lang === 'en' ? 'Done.' : 'Klaar.')
    out.action = out.action || 'none'
    return { payload: out, debug }
  }

  mark('no_policy_change')
  return { payload: out, debug }
}
