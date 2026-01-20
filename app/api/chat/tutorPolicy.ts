export type TutorPolicyContext = {
  userLanguage?: string
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

const strip = (s: any) => String(s || '').trim()

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

const getLastNonTrivialUserText = (messages?: any[]) => {
  const arr = Array.isArray(messages) ? messages : []
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i]
    if (m?.role !== 'user') continue
    const t = strip(m?.content)
    if (!t) continue
    if (/^(ja|nee|yes|no|yep|nope|ok(é|ay)?|top|klopt|prima|goed|thanks|thank\s+you|dank(je|jewel|u)?)\b/i.test(t))
      continue
    if (isStopSignal(t)) continue
    return t
  }
  return ''
}

const normalizeForRepeat = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[“”"']/g, '')
    .replace(/[^a-z0-9\s:.,!?€$]/g, '')
    .replace(/^(?:super|precies|juist|exact|helemaal\s+goed|goed\s+zo|top|ok[ée]?|oke|klopt)\b[!.,:;\-–— ]*/i, '')
    .trim()

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

const parseNum = (s: string) => {
  const n = Number(String(s || '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

const extractSimpleOp = (text: string): { a: number; b: number; op: '+' | '-' | '*' | '/' } | null => {
  const t = String(text || '')
  const m =
    t.match(/(?:wat\s+is|what\s+is)\s+(-?\d+(?:[.,]\d+)?)\s*([+\-*/:])\s*(-?\d+(?:[.,]\d+)?)/i) ||
    t.match(/(-?\d+(?:[.,]\d+)?)\s*([+\-*/:])\s*(-?\d+(?:[.,]\d+)?)/)
  if (!m) return null
  const a = parseNum(m[1])
  const rawOp = m[2]
  const b = parseNum(m[3])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const op = rawOp === ':' ? '/' : (rawOp as any)
  if (op !== '+' && op !== '-' && op !== '*' && op !== '/') return null
  return { a, b, op }
}

const evalOp = (op: { a: number; b: number; op: '+' | '-' | '*' | '/' }) => {
  if (op.op === '+') return op.a + op.b
  if (op.op === '-') return op.a - op.b
  if (op.op === '*') return op.a * op.b
  if (op.op === '/') return op.b === 0 ? NaN : op.a / op.b
  return NaN
}

const isComprehensionCheck = (t: string) =>
  /(\bsnap\s+je\b|\bbegrijp\s+je\b|\bis\s+dat\s+duidelijk\b|\bvolg\s+je\b|\bmake\s+sense\b|\bdo\s+you\s+understand\b)/i.test(
    String(t || '')
  )

const isPraiseOnly = (t: string) => {
  const s = strip(t).toLowerCase()
  if (!s) return false
  // Very short confirmations/praise that often prematurely end a thread.
  if (s.length <= 18 && /^(juist|exact|precies|top|super|helemaal\s+goed|goed\s+zo|ok|oke|okay|exactly)\b[!.]*$/.test(s))
    return true
  // Also treat "Oké." + nothing else.
  if (s.length <= 8 && /^(ok[ée]?|oke|okay)\b[!.]*$/.test(s)) return true
  return false
}

const inferConcreteStep = (lang: string, messages: any[], lastUserText: string) => {
  const prevAssistant = getPrevAssistantText(messages)
  const lastNonTrivialUser = getLastNonTrivialUserText(messages)
  const lastUser = strip(lastUserText)

  // If the conversation is about a division like "184/16", prefer the stable first micro-step.
  const frac = lastNonTrivialUser.match(/(\d+)\s*\/\s*(\d+)/)
  if (frac) {
    const b = frac[2]
    return lang === 'en' ? `Start with: **${b} × 10 = __**. What is it?` : `Begin met: **${b} × 10 = __**. Wat is dat?`
  }

  // Remainder/leftover prompts: suggest a direct subtraction fill-blank.
  if (/\b(hoeveel\s+houd\s+je\s+over|houd\s+je\s+over|remainder|rest)\b/i.test(prevAssistant)) {
    const nums = (messages || [])
      .slice(-8)
      .flatMap((m: any) => String(m?.content || '').match(/\d+/g) || [])
      .map((n: string) => Number(n))
      .filter((n: number) => Number.isFinite(n))
    const uniq = Array.from(new Set(nums))
    const big = uniq.sort((a, b) => b - a)[0]
    const small = uniq.sort((a, b) => b - a)[1]
    if (Number.isFinite(big) && Number.isFinite(small)) {
      return lang === 'en'
        ? `Fill in: **${big} − ${small} = __**.`
        : `Vul in: **${big} − ${small} = __**.`
    }
    return lang === 'en' ? `Fill in: **(total) − (used) = __**.` : `Vul in: **(totaal) − (gebruikt) = __**.`
  }

  // Generic fallback: ask for one computed blank (avoid "write your calculation" meta).
  if (/^\d+([.,]\d+)?$/.test(lastUser)) {
    return lang === 'en' ? `Fill in: **__** (one next number).` : `Vul in: **__** (één volgend getal).`
  }
  return lang === 'en' ? `Fill in: **__**.` : `Vul in: **__**.`
}

export function applyTutorPolicy(payload: TutorPayload, ctx: TutorPolicyContext): TutorPayload {
  const out: TutorPayload = { ...payload }
  const lang = String(ctx.userLanguage || 'nl')
  const lastUser = strip(ctx.lastUserText)
  const messages = Array.isArray(ctx.messages) ? ctx.messages : []
  const prevAssistant = getPrevAssistantText(messages)

  // 1) Stop signals (student control)
  if (lastUser && isStopSignal(lastUser)) {
    const closuresNl = ['Oké. Tot later.', 'Helemaal goed. Tot zo.', 'Prima. Laat maar weten als je nog iets hebt.']
    const closuresEn = ['Okay. See you later.', 'All good. Talk soon.', 'Sure. Let me know if you need anything else.']
    const turn = messages.filter((m: any) => m?.role === 'user').length
    const v = ((turn % 3) + 3) % 3
    out.message = lang === 'en' ? closuresEn[v] : closuresNl[v]
    out.action = out.action || 'none'
    return out
  }

  // 2) Bare yes/no with no pending question: treat as "we're done" (no wedervraag).
  if (lastUser && isBareYesNo(lastUser) && !/\?\s*$/.test(prevAssistant)) {
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
    const turn = messages.filter((m: any) => m?.role === 'user').length
    const v = ((turn % 3) + 3) % 3
    out.message = lang === 'en' ? closuresEn[v] : closuresNl[v]
    out.action = out.action || 'none'
    return out
  }

  // 3) ACK-only handling: if previous assistant asked a question, re-ask for the answer; else close.
  if (lastUser && isAckOnly(lastUser)) {
    if (/\?\s*$/.test(prevAssistant)) {
      out.message =
        lang === 'en' ? `Got it. What’s your answer to my last question?` : `Top. Wat is jouw antwoord op mijn laatste vraag?`
      out.action = out.action || 'none'
      return out
    }
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
    const turn = messages.filter((m: any) => m?.role === 'user').length
    const v = ((turn % 3) + 3) % 3
    out.message = lang === 'en' ? closuresEn[v] : closuresNl[v]
    out.action = out.action || 'none'
    return out
  }

  // 3b) If the assistant asked a comprehension check and the student answers yes/no,
  // do NOT end with praise-only. Continue with a concrete next step instead.
  if (lastUser && isBareYesNo(lastUser) && /\?\s*$/.test(prevAssistant) && isComprehensionCheck(prevAssistant)) {
    if (isPraiseOnly(out.message)) {
      out.message = inferConcreteStep(lang, messages, lastUser)
      out.action = out.action || 'none'
      return out
    }
  }

  // 4) Stop guardrail: if model claims completion, do not end with a new question.
  const hasCompletionMarker = (() => {
    const m = String(out?.message || '').toLowerCase()
    return /\b(we\s+zijn\s+klaar|klaar\.?$|dat\s+is\s+het|that'?s\s+it|we'?re\s+done|done\.)\b/i.test(m)
  })()
  if (hasCompletionMarker && /\?/.test(String(out?.message || ''))) {
    out.message =
      stripAfterFirstQuestion(String(out.message || '')) ||
      takeFirstSentenceNoQuestion(String(out.message || '')) ||
      (lang === 'en' ? 'Done.' : 'Klaar.')
    out.action = out.action || 'none'
    return out
  }

  // 5) Direct arithmetic: if the previous assistant asked a simple arithmetic question and user answered with a number, stop if correct.
  const prevOp = extractSimpleOp(prevAssistant)
  const userIsNumber = /^\s*\d+([.,]\d+)?\s*$/.test(lastUser)
  if (prevOp && userIsNumber) {
    const expected = evalOp(prevOp)
    const userN = parseNum(lastUser)
    if (Number.isFinite(expected) && Number.isFinite(userN)) {
      if (Math.abs(userN - expected) < 1e-9) {
        out.message = lang === 'en' ? 'Exactly.' : 'Juist.'
        out.action = out.action || 'none'
        return out
      }
      out.message =
        lang === 'en'
          ? `Almost. Fill in: **${prevOp.a} ${prevOp.op} ${prevOp.b} = __**.`
          : `Bijna. Vul in: **${prevOp.a} ${prevOp.op} ${prevOp.b} = __**.`
      out.action = out.action || 'none'
      return out
    }
  }

  // 6) Anti-parrot: rewrite re-asking a division question into a micro-step.
  const lastNonTrivialUser = getLastNonTrivialUserText(messages)
  const fracFromUser = (() => {
    const t = String(lastNonTrivialUser || '')
    const m = t.match(/(\d+)\s*\/\s*(\d+)/)
    if (!m) return null
    return { a: m[1], b: m[2] }
  })()

  // 6b) Generic division prompt: if user gave a fraction/division and the assistant replies with a vague
  // "what is the result/outcome?" (without a compute/fill-blank move), rewrite to the stable first micro-step.
  const looksLikeGenericOutcomePrompt = (() => {
    if (!fracFromUser) return false
    const m = strip(out.message)
    if (!m) return false
    // If it already contains a blank or a concrete compute expression, leave it.
    if (m.includes('__')) return false
    if (/\b\d+\s*[×x*:+/\-]\s*\d+\b/.test(m)) return false
    // Vague prompts that cause the "parrot" UX.
    if (/\b(uitkomst|antwoord|resultaat)\b/i.test(m) && /\?\s*$/.test(m)) return true
    if (/^(l(aten|et’s)\s+we|we\s+gaan)\b/i.test(m) && /\?\s*$/.test(m)) return true
    return false
  })()
  if (looksLikeGenericOutcomePrompt) {
    out.message = inferConcreteStep(lang, messages, lastUser)
    out.action = out.action || 'none'
    return out
  }

  const looksLikeParrotedDivisionQuestion = (() => {
    if (!fracFromUser) return false
    const msg = String(out?.message || '')
    const low = msg.toLowerCase()
    if (!/\?\s*$/.test(msg.trim())) return false
    if (!low.includes(fracFromUser.a) || !low.includes(fracFromUser.b)) return false
    if (!/(gedeeld\s+door|delen\s+door|\/)/.test(low)) return false
    if (!/(wat\s+is|uitkomst|hoeveel|what\s+is|result)/.test(low)) return false
    return true
  })()
  if (looksLikeParrotedDivisionQuestion) {
    const { b } = fracFromUser!
    out.message =
      lang === 'en'
        ? `Start with: **${b} × 10 = __**. What is it?`
        : `Begin met: **${b} × 10 = __**. Wat is dat?`
    out.action = out.action || 'none'
    return out
  }

  // 7) Low-friction linter: eliminate guess/meta questions (policy-first) into concrete compute/fill-blank.
  const msg = strip(out.message)
  const bannedGuess = /(schat|schatten|meer\s+of\s+minder|denk\s+je\s+dat|zou\s+het\s+kunnen|past\s+.*\b(vaker|meer)\b)/i.test(msg)
  const bannedMeta =
    /(schrijf\s+je\s+berekening|wat\s+is\s+je\s+volgende\s+stap|volgende\s+stap\s*\(1\s*korte\s*zin\))/i.test(msg)
  if (bannedGuess || bannedMeta) {
    out.message = inferConcreteStep(lang, messages, lastUser)
    out.action = out.action || 'none'
    return out
  }

  // 8) Final anti-repeat: if assistant repeats itself, replace with a concrete next step.
  const lastAssistantInHistory = prevAssistant
  const nowMsg = typeof out.message === 'string' ? out.message : ''
  if (lastAssistantInHistory && normalizeForRepeat(nowMsg) && normalizeForRepeat(nowMsg) === normalizeForRepeat(lastAssistantInHistory)) {
    out.message = inferConcreteStep(lang, messages, lastUser)
    out.action = out.action || 'none'
    return out
  }

  return out
}

