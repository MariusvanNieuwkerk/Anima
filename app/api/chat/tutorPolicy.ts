import type { SupportedLang } from './grammar/i18n'
import { routeGrammarTopic } from './grammar/routeMap'
import { grammarCanonStep } from './grammar/grammarCanon'

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

const strip = (s: any) => String(s || '').trim()

export type TutorDebugEvent = {
  name: string
  details?: Record<string, any>
}

type AgeBand = 'junior' | 'teen' | 'student'
const getAgeBand = (age?: number): AgeBand => {
  const a = Number(age)
  if (!Number.isFinite(a)) return 'teen'
  if (a <= 12) return 'junior'
  if (a <= 16) return 'teen'
  return 'student'
}

const normalizeMathText = (t: string) =>
  String(t || '')
    // Normalize many hyphen/minus variants to "-"
    // - U+2212 minus, U+2010..U+2015 hyphens/dashes, U+00AD soft hyphen, U+FF0D fullwidth hyphen-minus
    .replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\u2015\u00AD\uFF0D−–—]/g, '-')
    // Normalize NBSP to space
    .replace(/\u00A0/g, ' ')
    .replace(/[×]/g, '*')
    .replace(/:/g, '/')

function parseNum(s: string) {
  const n = Number(String(s || '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

// -------------------------
// Canonical Math Script Engine (policy-first)
// -------------------------
type CanonKind =
  | 'add'
  | 'sub'
  | 'mul'
  | 'div'
  | 'frac_simplify'
  | 'percent'
  | 'units'
  | 'order_ops'
  | 'negatives'
  | 'unknown'

type CanonState = {
  kind: CanonKind
  a?: number
  b?: number
  op?: '+' | '-' | '*' | '/'
  raw?: string
  // division-specific
  divA?: number
  divB?: number
  // percent-specific
  pct?: number
  // negatives/order-of-ops can carry an expression
  expr?: string
}

const isStuckSignal = (t: string) =>
  /^(ik\s+snap\s+het\s+niet|snap\s+het\s+niet|ik\s+begrijp\s+het\s+niet|geen\s+idee|help|hulp|vast|i\s+don'?t\s+get\s+it|i\s+don'?t\s+understand)\b/i.test(
    strip(t)
  )

const looksLikeRealAttempt = (t: string) => {
  const s = strip(t)
  if (!s) return false
  if (/^(ja|nee|yes|no|ok(é|ay)?|top|klopt|prima|goed|thanks|dank)/i.test(s)) return false
  // Contains digits and some math operator / structure, or a worked statement.
  if (/\d/.test(s) && /[+\-*/:×x=]/.test(s)) return true
  // A lone number can be an attempt if preceded by a specific compute/fill prompt; we treat it as attempt anyway.
  if (/^\d+([.,]\d+)?$/.test(s)) return true
  return false
}

const countRecentAttempts = (messages: any[]) => {
  const arr = Array.isArray(messages) ? messages : []
  let n = 0
  for (let i = Math.max(0, arr.length - 10); i < arr.length; i++) {
    const m = arr[i]
    if (m?.role !== 'user') continue
    const t = strip(m?.content)
    if (looksLikeRealAttempt(t)) n++
  }
  return n
}

const userIsNumberLike = (t: string) => /^\s*\d+([.,]\d+)?\s*$/.test(strip(t))

const findLastUserNumber = (messages: any[]) => {
  const arr = Array.isArray(messages) ? messages : []
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i]
    if (m?.role !== 'user') continue
    const t = strip(m?.content)
    if (!userIsNumberLike(t)) continue
    const n = parseNum(t)
    if (Number.isFinite(n)) return n
  }
  return NaN
}

const countAssistantMatches = (messages: any[], re: RegExp) => {
  const arr = Array.isArray(messages) ? messages : []
  let n = 0
  for (let i = Math.max(0, arr.length - 14); i < arr.length; i++) {
    const m = arr[i]
    if (m?.role === 'user') continue
    const t = String(m?.content || '')
    if (re.test(t)) n++
  }
  return n
}

const findLastFractionInHistory = (messages: any[]) => {
  const arr = Array.isArray(messages) ? messages : []
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i]
    if (m?.role === 'user') continue
    const t = String(m?.content || '')
    const mm = t.match(/\b(?:Nieuwe breuk|Breuk|New fraction|Fraction)\s*:\s*(\d+)\s*\/\s*(\d+)\b/i)
    if (mm) return { a: Number(mm[1]), b: Number(mm[2]) }
  }
  return null
}

const nextSmallDivisor = (a: number, b: number) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (a % 2 === 0 && b % 2 === 0) return 2
  if (a % 3 === 0 && b % 3 === 0) return 3
  if (a % 5 === 0 && b % 5 === 0) return 5
  return null
}

const parseCanonFromText = (tRaw: string): CanonState | null => {
  const t = strip(normalizeMathText(tRaw))
  const low = t.toLowerCase()

  // Unknown / mini-algebra: "__ + 8 = 23" or "x + 8 = 23"
  const unk = t.match(/(?:__|x)\s*([+\-])\s*(\d+(?:[.,]\d+)?)\s*=\s*(\d+(?:[.,]\d+)?)/i)
  if (unk) {
    const sign = unk[1] as '+' | '-'
    const b = parseNum(unk[2])
    const c = parseNum(unk[3])
    if (Number.isFinite(b) && Number.isFinite(c)) return { kind: 'unknown', a: c, b, op: sign, raw: t }
  }

  // Percent
  if (/%/.test(t) || /\bprocent\b/i.test(t)) {
    const p = t.match(/(\d+(?:[.,]\d+)?)\s*%/)
    if (p) {
      const a = parseNum(p[1])
      if (Number.isFinite(a)) return { kind: 'percent', pct: a, raw: t }
    }
  }

  // Unit conversion time (hours/minutes)
  if (
    /\b(uur|uren|minuut|minuten|hour|hours|minute|minutes|cm|mm|m|km|kg|gram|g|liter|l|ml|euro|€|cent)\b/i.test(t) &&
    /\d/.test(t)
  ) {
    return { kind: 'units', raw: t }
  }

  // Order of ops / parentheses
  if (/[()]/.test(t) && /[+\-*/:×x]/.test(t) && /\d/.test(t)) {
    return { kind: 'order_ops', expr: t, raw: t }
  }

  // Fraction simplify
  const frac = t.match(/(\d+)\s*\/\s*(\d+)/)
  if (frac && /\b(vereenvoudig|vereenvoudigen|breuk)\b/i.test(low)) {
    return { kind: 'frac_simplify', a: Number(frac[1]), b: Number(frac[2]), raw: t }
  }
  // Division / fraction without simplify keyword: treat as division canon
  if (frac) {
    return { kind: 'div', divA: Number(frac[1]), divB: Number(frac[2]), raw: t }
  }

  // Negatives: ONLY trigger when there is an actual negative number present
  // e.g. "-3 + 7" or "5 - -2". Do NOT treat normal subtraction like "82 - 47" as negatives.
  // NOTE: Be careful with prefixes like "Los op:"; "82 - 47" is still normal subtraction.
  // We only treat it as "negatives" when:
  // - it starts with a negative number (possibly after a short prefix), OR
  // - it contains a double-minus (subtracting a negative), OR
  // - it uses +, *, /, ( with a negative operand (e.g. "5 + -2", "3 * -4", "( -3 + 7 )").
  const hasNegativeNumber =
    /^\s*(?:(?:wat|what)\s+is|los\s+op|bereken)?\s*[: ]*\s*-\s*\d/.test(t) ||
    /-\s*-\s*\d/.test(t) ||
    /[+*/(]\s*-\s*\d/.test(t)
  if (hasNegativeNumber && /[+\-*/:×x]/.test(t) && /\d/.test(t)) {
    return { kind: 'negatives', expr: t, raw: t }
  }

  // Simple arithmetic
  const expr = (() => {
    const m =
      t.match(/(?:wat\s+is|what\s+is|los\s+op|bereken)\s+(-?\d+(?:[.,]\d+)?)\s*([+\-*/:×x])\s*(-?\d+(?:[.,]\d+)?)/i) ||
      t.match(/(-?\d+(?:[.,]\d+)?)\s*([+\-*/:×x])\s*(-?\d+(?:[.,]\d+)?)/)
    if (!m) return null
    const a = parseNum(m[1])
    const rawOp = m[2]
    const b = parseNum(m[3])
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    const op = rawOp === ':' ? '/' : rawOp === '×' || rawOp.toLowerCase() === 'x' ? '*' : (rawOp as any)
    if (op !== '+' && op !== '-' && op !== '*' && op !== '/') return null
    return { a, b, op }
  })()
  if (expr) {
    const { a, b, op } = expr
    if (op === '+') return { kind: 'add', a, b, op, raw: t }
    if (op === '-') return { kind: 'sub', a, b, op, raw: t }
    if (op === '*') return { kind: 'mul', a, b, op, raw: t }
    if (op === '/') return { kind: 'div', divA: a, divB: b, raw: t }
  }

  return null
}

const canonStep = (lang: string, state: CanonState, messages: any[], lastUserText: string, ageBand: AgeBand) => {
  const lastUser = strip(lastUserText)
  const prevAssistant = getPrevAssistantText(messages)

  // Helper to force exactly one compute/fill step.
  const ask = (nl: string, en: string) => (lang === 'en' ? en : nl)

  if (state.kind === 'add' && Number.isFinite(state.a) && Number.isFinite(state.b)) {
    const a = state.a!
    const b = state.b!
    // Canon: split into tens+ones; then tens sum; then ones sum; then combine
    const aT = Math.trunc(a / 10) * 10
    const aU = a - aT
    const bT = Math.trunc(b / 10) * 10
    const bU = b - bT
    const lastAssistantBlankPrompt = (() => {
      const arr = Array.isArray(messages) ? messages : []
      for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i]
        if (m?.role === 'user') continue
        const t = String(m?.content || '')
        if (!t.includes('__')) continue
        // Only accept our canonical compute blanks
        if (new RegExp(`\\b${aT}\\s*\\+\\s*${bT}\\b`).test(t)) return `${aT} + ${bT}`
        if (new RegExp(`\\b${aU}\\s*\\+\\s*${bU}\\b`).test(t)) return `${aU} + ${bU}`
        if (new RegExp(`\\b${aT + bT}\\s*\\+\\s*${aU + bU}\\b`).test(t)) return `${aT + bT} + ${aU + bU}`
        if (new RegExp(`\\b${a}\\s*\\+\\s*${b}\\b`).test(t)) return `${a} + ${b}`
      }
      return ''
    })()

    // If the student ACKs on a compute blank, re-ask THAT same blank (do not rewind).
    if (!/^\d+/.test(lastUser) && lastAssistantBlankPrompt) {
      return ask(`Vul in: ${lastAssistantBlankPrompt} = __`, `Fill in: ${lastAssistantBlankPrompt} = __`)
    }

    const splitWasIntroduced = (() => {
      const arr = Array.isArray(messages) ? messages : []
      const re = new RegExp(`\\b${a}\\s*=\\s*${aT}\\s*\\+\\s*${aU}.*\\b${b}\\s*=\\s*${bT}\\s*\\+\\s*${bU}`, 'i')
      for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i]
        if (m?.role === 'user') continue
        const t = String(m?.content || '')
        if (re.test(t)) return true
      }
      return false
    })()

    if (!splitWasIntroduced) {
      if (ageBand === 'junior') {
        return ask(
          `Splits: ${a} = ${aT} + ${aU}. Splits: ${b} = ${bT} + ${bU}. Vul in: ${aT} + ${bT} = __`,
          `Split: ${a} = ${aT} + ${aU}. Split: ${b} = ${bT} + ${bU}. Fill in: ${aT} + ${bT} = __`
        )
      }
      if (ageBand === 'student') {
        return ask(
          `Vul in: ${aT} + ${bT} = __`,
          `Fill in: ${aT} + ${bT} = __`
        )
      }
      return ask(
        `Schrijf: ${a} = ${aT} + ${aU} en ${b} = ${bT} + ${bU}. Vul in: ${aT} + ${bT} = __`,
        `Write: ${a} = ${aT} + ${aU} and ${b} = ${bT} + ${bU}. Fill in: ${aT} + ${bT} = __`
      )
    }
    // If previous asked tens sum, continue to ones sum when user answered correctly.
    if (new RegExp(`\\b${aT}\\s*\\+\\s*${bT}\\b`).test(prevAssistant) && /^\d+/.test(lastUser)) {
      const userN = parseNum(lastUser)
      if (Math.abs(userN - (aT + bT)) < 1e-9) return ask(`Vul in: ${aU} + ${bU} = __`, `Fill in: ${aU} + ${bU} = __`)
    }
    if (new RegExp(`\\b${aU}\\s*\\+\\s*${bU}\\b`).test(prevAssistant) && /^\d+/.test(lastUser)) {
      const userN = parseNum(lastUser)
      if (Math.abs(userN - (aU + bU)) < 1e-9) return ask(`Vul in: ${(aT + bT)} + ${(aU + bU)} = __`, `Fill in: ${(aT + bT)} + ${(aU + bU)} = __`)
    }
    // Final combine: confirm and stop (no extra explanation).
    if (new RegExp(`\\b${aT + bT}\\s*\\+\\s*${aU + bU}\\b`).test(prevAssistant) && userIsNumberLike(lastUserText)) {
      const userN = parseNum(lastUser)
      const ans = a + b
      if (Math.abs(userN - ans) < 1e-9) {
        return ask(`Juist.`, `Correct.`)
      }
    }
    return ask(`Vul in: ${aT} + ${bT} = __`, `Fill in: ${aT} + ${bT} = __`)
  }

  if (state.kind === 'sub' && Number.isFinite(state.a) && Number.isFinite(state.b)) {
    const a = state.a!
    const b = state.b!
    // Canon: rewrite as a - tens - ones
    const bT = Math.trunc(b / 10) * 10
    const bU = b - bT
    const lastAssistantBlankPrompt = (() => {
      const arr = Array.isArray(messages) ? messages : []
      for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i]
        if (m?.role === 'user') continue
        const t = String(m?.content || '')
        if (!t.includes('__')) continue
        if (new RegExp(`\\b${a}\\s*[−-]\\s*${bT}\\b`).test(t)) return `${a} − ${bT}`
        if (new RegExp(`\\b${a - bT}\\s*[−-]\\s*${bU}\\b`).test(t)) return `${a - bT} − ${bU}`
      }
      return ''
    })()

    // ACK-only on a blank => re-ask same blank (do not rewind).
    if (!/^\d+/.test(lastUser) && lastAssistantBlankPrompt) {
      return ask(`Vul in: ${lastAssistantBlankPrompt} = __`, `Fill in: ${lastAssistantBlankPrompt} = __`)
    }

    if (new RegExp(`\\b${a}\\s*[−-]\\s*${bT}\\b`).test(prevAssistant) && /^\d+/.test(lastUser)) {
      const userN = parseNum(lastUser)
      if (Math.abs(userN - (a - bT)) < 1e-9) return ask(`Vul in: ${a - bT} − ${bU} = __`, `Fill in: ${a - bT} − ${bU} = __`)
    }
    if (new RegExp(`\\b${a - bT}\\s*[−-]\\s*${bU}\\b`).test(prevAssistant) && userIsNumberLike(lastUserText)) {
      const userN = parseNum(lastUser)
      const ans = a - b
      if (Math.abs(userN - ans) < 1e-9) return ask(`Juist.`, `Correct.`)
    }
    // First step (age-aware):
    // - junior/teen: explicitly show where 40 and 7 come from
    // - student: keep it compact (straight to tens subtraction)
    if (ageBand === 'student') return ask(`Vul in: ${a} − ${bT} = __`, `Fill in: ${a} − ${bT} = __`)
    return ask(
      `Splits: ${b} = ${bT} + ${bU}. Vul in: ${a} − ${bT} = __`,
      `Split: ${b} = ${bT} + ${bU}. Fill in: ${a} − ${bT} = __`
    )
  }

  if (state.kind === 'mul' && Number.isFinite(state.a) && Number.isFinite(state.b)) {
    const a = state.a!
    const b = state.b!
    // Canon: a×(tens+ones)
    const bT = Math.trunc(b / 10) * 10
    const bU = b - bT
    if (!/\(\s*\d+\s*\+\s*\d+\s*\)/.test(prevAssistant)) {
      return ask(`${a}×${b} = ${a}×(${bT}+${bU}). Vul in: ${a}×${bT} = __`, `${a}×${b} = ${a}×(${bT}+${bU}). Fill in: ${a}×${bT} = __`)
    }
    if (new RegExp(`\\b${a}\\s*[×x*]\\s*${bT}\\b`).test(prevAssistant) && /^\d+/.test(lastUser)) {
      const userN = parseNum(lastUser)
      if (Math.abs(userN - a * bT) < 1e-9) return ask(`Vul in: ${a}×${bU} = __`, `Fill in: ${a}×${bU} = __`)
    }
    if (new RegExp(`\\b${a}\\s*[×x*]\\s*${bU}\\b`).test(prevAssistant) && /^\d+/.test(lastUser)) {
      const userN = parseNum(lastUser)
      if (Math.abs(userN - a * bU) < 1e-9) return ask(`Vul in: ${a * bT} + ${a * bU} = __`, `Fill in: ${a * bT} + ${a * bU} = __`)
    }
    // If we just summed, end with a non-question check sentence (no extra user action).
    if (new RegExp(`\\b${a * bT}\\s*\\+\\s*${a * bU}\\b`).test(prevAssistant) && /^\d+/.test(lastUser)) {
      const userN = parseNum(lastUser)
      if (Math.abs(userN - a * b) < 1e-9) {
        return ask(
          `Juist. Check: ${Math.round(a)}×${Math.round(b)} ligt rond ${Math.round(Math.round(a / 10) * 10)}×${Math.round(Math.round(b / 10) * 10)}.`,
          `Correct. Check: ${Math.round(a)}×${Math.round(b)} is close to ${Math.round(Math.round(a / 10) * 10)}×${Math.round(Math.round(b / 10) * 10)}.`
        )
      }
    }
    return ask(`Vul in: ${a}×${bT} = __`, `Fill in: ${a}×${bT} = __`)
  }

  if (state.kind === 'div' && Number.isFinite(state.divA) && Number.isFinite(state.divB)) {
    const a = state.divA!
    const b = state.divB!
    // Canon chunking: start with ×10 if possible, else ×1. Then remainder, then keep adding ×1 until remainder < b.
    const k0 = Math.floor(a / b)
    const startChunk = k0 >= 10 ? 10 : 1
    const finishWithQuotientStep = (q: number, rest: number) =>
      ask(`Vul in: ${startChunk} + ${q - startChunk} = __ (quotiënt)`, `Fill in: ${startChunk} + ${q - startChunk} = __ (quotient)`)

    // Step 1: b×startChunk
    if (!/\b×\s*(10|1)\b/.test(prevAssistant) && !new RegExp(`\\b${b}\\s*[×x*]\\s*(10|1)\\b`).test(prevAssistant)) {
      return ask(`Vul in: ${b}×${startChunk} = __`, `Fill in: ${b}×${startChunk} = __`)
    }

    // If we asked b×startChunk and user answered, ask first remainder.
    if (new RegExp(`\\b${b}\\s*[×x*]\\s*${startChunk}\\b`).test(prevAssistant) && userIsNumberLike(lastUserText)) {
      const userN = parseNum(lastUser)
      const expected = b * startChunk
      if (Math.abs(userN - expected) < 1e-9) return ask(`Vul in: ${a} − ${expected} = __`, `Fill in: ${a} − ${expected} = __`)
      return ask(`Bijna. Vul in: ${b}×${startChunk} = __`, `Almost. Fill in: ${b}×${startChunk} = __`)
    }

    // If we asked a - used, and user answered remainder, decide next.
    const remMatch = prevAssistant.match(/(\d+)\s*[−-]\s*(\d+)\s*=\s*__/)
    if (remMatch && userIsNumberLike(lastUserText)) {
      const total = Number(remMatch[1])
      const used = Number(remMatch[2])
      const expectedRem = total - used
      const userN = parseNum(lastUser)
      if (Math.abs(userN - expectedRem) < 1e-9) {
        if (expectedRem >= b) {
          return ask(`Vul in: ${b}×1 = __`, `Fill in: ${b}×1 = __`)
        }
        // Finish requires an explicit quotient compute step first.
        return finishWithQuotientStep(startChunk, expectedRem)
      }
      return ask(`Vul in: ${total} − ${used} = __`, `Fill in: ${total} − ${used} = __`)
    }

    // If we asked b×1 and user answered, ask subtract from last remainder if we can find it.
    if (new RegExp(`\\b${b}\\s*[×x*]\\s*1\\b`).test(prevAssistant) && userIsNumberLike(lastUserText)) {
      const prod = parseNum(lastUser)
      if (Math.abs(prod - b) < 1e-9) {
        // Find the last remainder number in history (user's last remainder).
        const rem = findLastUserNumber(messages)
        if (Number.isFinite(rem) && rem >= b) return ask(`Vul in: ${rem} − ${b} = __`, `Fill in: ${rem} − ${b} = __`)
      }
      return ask(`Vul in: ${b}×1 = __`, `Fill in: ${b}×1 = __`)
    }

    // If we asked rem - b and user answered, either loop or finish with quotient.
    const rem2 = prevAssistant.match(/(\d+)\s*[−-]\s*(\d+)\s*=\s*__/)
    if (rem2 && userIsNumberLike(lastUserText)) {
      const r0 = Number(rem2[1])
      const sub = Number(rem2[2])
      const expected = r0 - sub
      const userN = parseNum(lastUser)
      if (Math.abs(userN - expected) < 1e-9) {
        // Determine how many ×1 steps were taken: count occurrences of "×1" prompts after start.
        const onesCount = countAssistantMatches(messages, new RegExp(`\\b${b}\\s*[×x*]\\s*1\\b`))
        const q = startChunk + onesCount
        const rest = expected
        if (rest >= b) {
          return ask(`Vul in: ${b}×1 = __`, `Fill in: ${b}×1 = __`)
        }
        return finishWithQuotientStep(q, rest)
      }
      return ask(`Vul in: ${r0} − ${sub} = __`, `Fill in: ${r0} − ${sub} = __`)
    }

    // If we asked the quotient-sum and the user answered, finalize with remainder + check (no new question).
    const qSum = prevAssistant.match(/(\d+)\s*\+\s*(\d+)\s*=\s*__\s*\((?:quotiënt|quotient)\)/i)
    if (qSum && userIsNumberLike(lastUserText)) {
      const x = Number(qSum[1])
      const y = Number(qSum[2])
      const expQ = x + y
      const userN = parseNum(lastUser)
      if (Math.abs(userN - expQ) < 1e-9) {
        // Determine current rest from the last user remainder number in the thread.
        const rest = findLastUserNumber(messages)
        if (Number.isFinite(rest)) {
          return ask(
            `Juist. Quotiënt: **${expQ}**, rest: **${rest}**. Check: ${b}×${expQ}+${rest}=${a}.`,
            `Correct. Quotient: **${expQ}**, remainder: **${rest}**. Check: ${b}×${expQ}+${rest}=${a}.`
          )
        }
        return ask(`Juist.`, `Correct.`)
      }
    }

    return ask(`Vul in: ${b}×${startChunk} = __`, `Fill in: ${b}×${startChunk} = __`)
  }

  if (state.kind === 'frac_simplify' && Number.isFinite(state.a) && Number.isFinite(state.b)) {
    // Canon iterative: always one compute per turn. We keep the current fraction explicit in the prompt.
    const current = findLastFractionInHistory(messages) || { a: state.a!, b: state.b! }
    const a = current.a
    const b = current.b
    const d = nextSmallDivisor(a, b)

    // If no divisor left, stop cleanly (no question).
    if (!d) {
      return ask(`Dit is vereenvoudigd: **${a}/${b}**.`, `This is simplified: **${a}/${b}**.`)
    }

    // If we just computed numerator division, ask denominator division.
    const numPrompt = new RegExp(`Teller:\\s*${a}\\s*[÷/:]\\s*${d}\\s*=\\s*__`, 'i')
    if (numPrompt.test(prevAssistant) && userIsNumberLike(lastUserText)) {
      const newA = parseNum(lastUser)
      if (Number.isFinite(newA) && Math.abs(newA - a / d) < 1e-9) {
        return ask(`Noemer: ${b} ÷ ${d} = __`, `Denominator: ${b} ÷ ${d} = __`)
      }
      return ask(`Teller: ${a} ÷ ${d} = __`, `Numerator: ${a} ÷ ${d} = __`)
    }
    const denPrompt = new RegExp(`Noemer:\\s*${b}\\s*[÷/:]\\s*${d}\\s*=\\s*__`, 'i')
    if (denPrompt.test(prevAssistant) && userIsNumberLike(lastUserText)) {
      const newB = parseNum(lastUser)
      if (Number.isFinite(newB) && Math.abs(newB - b / d) < 1e-9) {
        const nextA = a / d
        const nextB = b / d
        const d2 = nextSmallDivisor(nextA, nextB)
        if (!d2) return ask(`Dit is vereenvoudigd: **${nextA}/${nextB}**.`, `This is simplified: **${nextA}/${nextB}**.`)
        return ask(`Nieuwe breuk: ${nextA}/${nextB}. Teller: ${nextA} ÷ ${d2} = __`, `New fraction: ${nextA}/${nextB}. Numerator: ${nextA} ÷ ${d2} = __`)
      }
      return ask(`Noemer: ${b} ÷ ${d} = __`, `Denominator: ${b} ÷ ${d} = __`)
    }

    return ask(`Breuk: ${a}/${b}. Teller: ${a} ÷ ${d} = __`, `Fraction: ${a}/${b}. Numerator: ${a} ÷ ${d} = __`)
  }

  if (state.kind === 'percent' && Number.isFinite(state.pct)) {
    const p = state.pct!
    const pInt = p % 1 === 0 ? Number(p.toFixed(0)) : p
    // Canon: p% = p/100 -> (optional simplify) -> decimal -> check
    if (!/\/\s*100/.test(prevAssistant)) {
      return ask(`Vul in: ${pInt}% = ${pInt}/100`, `Fill in: ${pInt}% = ${pInt}/100`)
    }
    // Decimal step (one action): p/100 = __
    if (!/=\s*__/.test(prevAssistant) && !/\b0[,.]\d+/.test(prevAssistant)) {
      return ask(`Vul in: ${pInt}% = __`, `Fill in: ${pInt}% = __`)
    }
    if (userIsNumberLike(lastUserText)) {
      const userN = parseNum(lastUser)
      const exp = pInt / 100
      if (Math.abs(userN - exp) < 1e-9) return ask(`Juist. Check: ${userN}×100=${pInt}%.`, `Correct. Check: ${userN}×100=${pInt}%.`)
    }
    return ask(`Vul in: ${pInt}% = __`, `Fill in: ${pInt}% = __`)
  }

  if (state.kind === 'units') {
    const raw = state.raw || ''
    // Canon (time): h×60 then +m
    const h = (() => {
      const m = raw.match(/(\d+)\s*(?:uur|hours?|h)\b/i)
      return m ? Number(m[1]) : NaN
    })()
    const m0 = (() => {
      const m = raw.match(/(\d+)\s*(?:minuut|minuten|minutes?|min)\b/i)
      return m ? Number(m[1]) : NaN
    })()
    if (Number.isFinite(h) && !/×\s*60/.test(prevAssistant)) {
      return ask(`Vul in: ${h}×60 = __`, `Fill in: ${h}×60 = __`)
    }
    if (Number.isFinite(h) && Number.isFinite(m0) && /\b×\s*60\b/.test(prevAssistant) && userIsNumberLike(lastUserText)) {
      const mins = parseNum(lastUser)
      if (Math.abs(mins - h * 60) < 1e-9) return ask(`Vul in: ${mins} + ${m0} = __`, `Fill in: ${mins} + ${m0} = __`)
    }
    if (Number.isFinite(h) && Number.isFinite(m0) && /\+\s*\d+/.test(prevAssistant) && userIsNumberLike(lastUserText)) {
      const totalMin = parseNum(lastUser)
      const exp = h * 60 + m0
      if (Math.abs(totalMin - exp) < 1e-9) return ask(`Juist. Check: ${h} uur = ${h * 60} min.`, `Correct. Check: ${h} hours = ${h * 60} min.`)
    }

    // Canon (length cm→m): ask divide by 100
    const cm = raw.match(/(\d+(?:[.,]\d+)?)\s*cm\b/i)
    if (cm && /\bm\b/i.test(raw) && !/\b\/\s*100\b/.test(prevAssistant)) {
      const v = parseNum(cm[1])
      if (Number.isFinite(v)) return ask(`Vul in: ${v} ÷ 100 = __ (meter)`, `Fill in: ${v} ÷ 100 = __ (meters)`)
    }

    // Canon (money €→cent / cent→€)
    const euro = raw.match(/€\s*(\d+(?:[.,]\d+)?)/) || raw.match(/(\d+(?:[.,]\d+)?)\s*euro\b/i)
    const cent = raw.match(/(\d+(?:[.,]\d+)?)\s*cent\b/i)
    if (euro && /\bcent\b/i.test(raw) && !/\b×\s*100\b/.test(prevAssistant)) {
      const v = parseNum(euro[1])
      if (Number.isFinite(v)) return ask(`Vul in: ${v} × 100 = __ (cent)`, `Fill in: ${v} × 100 = __ (cents)`)
    }
    if (cent && (/\beuro\b/i.test(raw) || /€/.test(raw)) && !/\b÷\s*100\b/.test(prevAssistant)) {
      const v = parseNum(cent[1])
      if (Number.isFinite(v)) return ask(`Vul in: ${v} ÷ 100 = __ (euro)`, `Fill in: ${v} ÷ 100 = __ (euros)`)
    }

    // Canon (mass kg→g / g→kg)
    const kg = raw.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i)
    const g = raw.match(/(\d+(?:[.,]\d+)?)\s*g(?:ram)?\b/i)
    if (kg && /\bg\b/i.test(raw) && !/\b×\s*1000\b/.test(prevAssistant)) {
      const v = parseNum(kg[1])
      if (Number.isFinite(v)) return ask(`Vul in: ${v} × 1000 = __ (gram)`, `Fill in: ${v} × 1000 = __ (grams)`)
    }
    if (g && /\bkg\b/i.test(raw) && !/\b÷\s*1000\b/.test(prevAssistant)) {
      const v = parseNum(g[1])
      if (Number.isFinite(v)) return ask(`Vul in: ${v} ÷ 1000 = __ (kg)`, `Fill in: ${v} ÷ 1000 = __ (kg)`)
    }

    // Canon (volume L→ml / ml→L)
    const l = raw.match(/(\d+(?:[.,]\d+)?)\s*l(?:iter)?\b/i)
    const ml = raw.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i)
    if (l && /\bml\b/i.test(raw) && !/\b×\s*1000\b/.test(prevAssistant)) {
      const v = parseNum(l[1])
      if (Number.isFinite(v)) return ask(`Vul in: ${v} × 1000 = __ (ml)`, `Fill in: ${v} × 1000 = __ (ml)`)
    }
    if (ml && /\bl\b/i.test(raw) && !/\b÷\s*1000\b/.test(prevAssistant)) {
      const v = parseNum(ml[1])
      if (Number.isFinite(v)) return ask(`Vul in: ${v} ÷ 1000 = __ (liter)`, `Fill in: ${v} ÷ 1000 = __ (liters)`)
    }

    // Canon (distance km→m / m→km)
    const km = raw.match(/(\d+(?:[.,]\d+)?)\s*km\b/i)
    const m = raw.match(/(\d+(?:[.,]\d+)?)\s*m\b/i)
    if (km && /\bm\b/i.test(raw) && !/\b×\s*1000\b/.test(prevAssistant)) {
      const v = parseNum(km[1])
      if (Number.isFinite(v)) return ask(`Vul in: ${v} × 1000 = __ (meter)`, `Fill in: ${v} × 1000 = __ (meters)`)
    }
    if (m && /\bkm\b/i.test(raw) && !/\b÷\s*1000\b/.test(prevAssistant)) {
      const v = parseNum(m[1])
      if (Number.isFinite(v)) return ask(`Vul in: ${v} ÷ 1000 = __ (km)`, `Fill in: ${v} ÷ 1000 = __ (km)`)
    }

    return ask(`Vul in: 1 uur = __ minuten`, `Fill in: 1 hour = __ minutes`)
  }

  if (state.kind === 'order_ops' && state.expr) {
    const expr = state.expr
    // Very simple canonical: evaluate innermost (single) parentheses with + or - then multiply/divide then add/sub.
    const inside = expr.match(/\((\s*-?\d+(?:[.,]\d+)?\s*[+\-]\s*-?\d+(?:[.,]\d+)?\s*)\)/)
    if (inside) {
      const inner = inside[1]
      if (!/\(\s*.*\)\s*=/.test(prevAssistant)) {
        return ask(`Vul in: (${inner.trim()}) = __`, `Fill in: (${inner.trim()}) = __`)
      }
      // If inner computed, look for a leading multiplier like "3×__"
      const mult = expr.match(/(\d+)\s*[×x*]\s*\(/)
      const tail = expr.match(/\)\s*([+\-])\s*(\d+(?:[.,]\d+)?)/)
      if (mult && userIsNumberLike(lastUserText)) {
        const innerVal = parseNum(lastUser)
        const k = Number(mult[1])
        if (Number.isFinite(innerVal)) return ask(`Vul in: ${k}×${innerVal} = __`, `Fill in: ${k}×${innerVal} = __`)
      }
      // After multiplication, finish with the trailing +/- step if present.
      const prevMul = prevAssistant.match(/(\d+)\s*[×x*]\s*(\d+(?:[.,]\d+)?)\s*=\s*__/)
      if (prevMul && userIsNumberLike(lastUserText) && tail) {
        const prod = parseNum(lastUser)
        const op = tail[1]
        const n = parseNum(tail[2])
        if (Number.isFinite(prod) && Number.isFinite(n)) return ask(`Vul in: ${prod} ${op} ${n} = __`, `Fill in: ${prod} ${op} ${n} = __`)
      }
    }
    // If final step was asked and answered, confirm.
    const final = prevAssistant.match(/(\d+(?:[.,]\d+)?)\s*([+\-])\s*(\d+(?:[.,]\d+)?)\s*=\s*__/)
    if (final && userIsNumberLike(lastUserText)) {
      const a0 = parseNum(final[1])
      const op = final[2]
      const b0 = parseNum(final[3])
      const exp = op === '+' ? a0 + b0 : a0 - b0
      const userN = parseNum(lastUser)
      if (Math.abs(userN - exp) < 1e-9) return ask(`Juist.`, `Correct.`)
    }
    return ask(`Vul in: (8+4) = __`, `Fill in: (8+4) = __`)
  }

  if (state.kind === 'negatives' && state.expr) {
    // Canon: one compute, keep it on number line implicitly.
    const e = state.expr
    const m =
      e.match(/(-?\d+(?:[.,]\d+)?)\s*([+\-])\s*(-?\d+(?:[.,]\d+)?)/) ||
      e.match(/(-?\d+(?:[.,]\d+)?)\s*([+\-])\s*(\d+(?:[.,]\d+)?)/)
    if (m) {
      const a = parseNum(m[1])
      const op = m[2]
      const b = parseNum(m[3])
      if (Number.isFinite(a) && Number.isFinite(b)) {
        // If we just asked and the user answered correctly, confirm.
        const exp = op === '+' ? a + b : a - b
        if (new RegExp(`\\b${a}\\s*[+\\-]\\s*${b}\\b`).test(prevAssistant) && userIsNumberLike(lastUserText)) {
          const userN = parseNum(lastUser)
          if (Math.abs(userN - exp) < 1e-9) return ask(`Juist.`, `Correct.`)
        }
        return ask(`Vul in: ${a} ${op} ${b} = __`, `Fill in: ${a} ${op} ${b} = __`)
      }
    }
    return ask(`Vul in: −3 + 7 = __`, `Fill in: −3 + 7 = __`)
  }

  if (state.kind === 'unknown' && Number.isFinite(state.a) && Number.isFinite(state.b) && state.op) {
    const c = state.a!
    const b = state.b!
    const op = state.op!
    if (op === '+') {
      // Canon: rewrite, then compute
      if (!new RegExp(`\\b${c}\\s*[−-]\\s*${b}\\b`).test(prevAssistant)) {
        return ask(`Maak: __ = ${c} − ${b}. Vul in: ${c} − ${b} = __`, `Rewrite: __ = ${c} − ${b}. Fill in: ${c} − ${b} = __`)
      }
      if (new RegExp(`\\b${c}\\s*[−-]\\s*${b}\\b`).test(prevAssistant) && userIsNumberLike(lastUserText)) {
        const userN = parseNum(lastUser)
        const exp = c - b
        if (Math.abs(userN - exp) < 1e-9) return ask(`Juist.`, `Correct.`)
      }
      return ask(`Vul in: ${c} − ${b} = __`, `Fill in: ${c} − ${b} = __`)
    }
    if (!new RegExp(`\\b${c}\\s*\\+\\s*${b}\\b`).test(prevAssistant)) {
      return ask(`Maak: __ = ${c} + ${b}. Vul in: ${c} + ${b} = __`, `Rewrite: __ = ${c} + ${b}. Fill in: ${c} + ${b} = __`)
    }
    if (new RegExp(`\\b${c}\\s*\\+\\s*${b}\\b`).test(prevAssistant) && userIsNumberLike(lastUserText)) {
      const userN = parseNum(lastUser)
      const exp = c + b
      if (Math.abs(userN - exp) < 1e-9) return ask(`Juist.`, `Correct.`)
    }
    return ask(`Vul in: ${c} + ${b} = __`, `Fill in: ${c} + ${b} = __`)
  }

  // Fallback: do nothing.
  return null
}

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

const getLastMathLikeUserText = (messages?: any[]) => {
  const arr = Array.isArray(messages) ? messages : []
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i]
    if (m?.role !== 'user') continue
    const t = strip(m?.content)
    if (!t) continue
    // Skip stop/ack-only
    if (/^(ja|nee|yes|no|yep|nope|ok(é|ay)?|top|klopt|prima|goed|thanks|thank\s+you|dank(je|jewel|u)?)\b/i.test(t)) continue
    if (isStopSignal(t)) continue
    const norm = normalizeMathText(t)
    // Math-like: has digits plus an operator or fraction
    if (/\d/.test(norm) && (/[+\-*/=]/.test(norm) || /(\d+)\s*\/\s*(\d+)/.test(norm))) return norm
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

const isDirectArithmeticUserQuery = (t: string) => {
  const s = strip(t).toLowerCase()
  if (!s) return false
  // Exclude multi-step / homework framing.
  if (/\b(los\s+op|vereenvoudig|stap\s+voor\s+stap|uitleg)\b/.test(s)) return false
  // Allow "92/2", "17+28", "wat is 92/2", "what is 17+28"
  if (/^(?:wat\s+is|what\s+is)\s+/.test(s)) return /\d/.test(s) && /[+\-*/:]/.test(s)
  // Bare expression
  return /^[\s\d.,]+[+\-*/:][\s\d.,]+$/.test(s)
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
  return applyTutorPolicyWithDebug(payload, ctx).payload
}

export function applyTutorPolicyWithDebug(
  payload: TutorPayload,
  ctx: TutorPolicyContext
): { payload: TutorPayload; debug: TutorDebugEvent[] } {
  const out: TutorPayload = { ...payload }
  const debug: TutorDebugEvent[] = []
  const mark = (name: string, details?: Record<string, any>) => {
    debug.push({ name, details })
  }
  const lang = String(ctx.userLanguage || 'nl')
  const ageBand = getAgeBand(ctx.userAge)
  const lang11: SupportedLang = ((): SupportedLang => {
    const l = String(ctx.userLanguage || 'nl').toLowerCase()
    if (l === 'nl' || l === 'en' || l === 'fr' || l === 'de' || l === 'es' || l === 'it' || l === 'pt' || l === 'da' || l === 'sv' || l === 'no' || l === 'fi')
      return l
    return 'nl'
  })()
  const lastUser = strip(ctx.lastUserText)
  const messages = Array.isArray(ctx.messages) ? ctx.messages : []
  const prevAssistant = getPrevAssistantText(messages)
  const lastNonTrivialUser = getLastNonTrivialUserText(messages)
  const lastMathUser = getLastMathLikeUserText(messages)

  // Absolute rewrite: never allow "Vul in: A - B = __" as the first step for subtraction.
  // If the model produces it, we force the canon rewrite step immediately.
  const fullSubBlank = (() => {
    const m = normalizeMathText(String(out.message || ''))
    // Match variants like:
    // - "Vul in: 82 - 47 = __"
    // - "Vul in 82-47=__"
    // - "82-47=__"
    // - underscores "_" or "__"
    const blank = String.raw`(?:[_＿‗﹍﹎﹏‾]+|__+|\.{2,}|…+)`
    const mm =
      m.match(new RegExp(String.raw`\bvul\s+in\b[:\-]?\s*(\d+)\s*-\s*(\d+)\s*=\s*${blank}`, 'i')) ||
      m.match(new RegExp(String.raw`\b(\d+)\s*-\s*(\d+)\s*=\s*${blank}`, 'i'))
    if (!mm) return null
    // Captures are [a,b] at (1,2). NOTE: we do NOT trust these numbers for the rewrite;
    // we only use them for detection/logging, and will prefer the user's actual problem.
    return { a: Number(mm[1]), b: Number(mm[2]) }
  })()
  if (fullSubBlank) {
    const seed = lastMathUser || lastNonTrivialUser
    const canonFromUser = parseCanonFromText(seed)
    const a =
      canonFromUser?.kind === 'sub' && Number.isFinite(canonFromUser.a) ? (canonFromUser.a as number) : fullSubBlank.a
    const b =
      canonFromUser?.kind === 'sub' && Number.isFinite(canonFromUser.b) ? (canonFromUser.b as number) : fullSubBlank.b
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      // Can't safely rewrite; fall through.
    } else {
      mark('hardblock_sub_full_blank', {
        detectedFromModel: { a: fullSubBlank.a, b: fullSubBlank.b },
        usedFromUser: canonFromUser?.kind === 'sub',
        used: { a, b },
      })
    const bT = Math.trunc(b / 10) * 10
    const bU = b - bT
    out.message = (() => {
      // Align with the subtraction canon first step (age-aware).
      if (ageBand === 'student') return lang === 'en' ? `Fill in: ${a} − ${bT} = __` : `Vul in: ${a} − ${bT} = __`
      return lang === 'en'
        ? `Split: ${b} = ${bT} + ${bU}. Fill in: ${a} − ${bT} = __`
        : `Splits: ${b} = ${bT} + ${bU}. Vul in: ${a} − ${bT} = __`
    })()
    out.action = out.action || 'none'
    return { payload: out, debug }
    }
  }

  // NOTE: Canonical math engine runs AFTER stop/ack-only logic below.

  // 1) Stop signals (student control)
  if (lastUser && isStopSignal(lastUser)) {
    mark('stop_signal', { lastUser })
    const closuresNl = ['Oké. Tot later.', 'Helemaal goed. Tot zo.', 'Prima. Laat maar weten als je nog iets hebt.']
    const closuresEn = ['Okay. See you later.', 'All good. Talk soon.', 'Sure. Let me know if you need anything else.']
    const turn = messages.filter((m: any) => m?.role === 'user').length
    const v = ((turn % 3) + 3) % 3
    out.message = lang === 'en' ? closuresEn[v] : closuresNl[v]
    out.action = out.action || 'none'
    return { payload: out, debug }
  }

  // Grammar canon engine (12 core topics, 11 languages).
  // Runs before math canon. Never overrides closures like ack/yes-no.
  if (!(lastUser && (isStopSignal(lastUser) || isAckOnly(lastUser) || isBareYesNo(lastUser)))) {
    const looksLikeMath = (() => {
      const s = normalizeMathText(lastNonTrivialUser)
      return /\d/.test(s) && /[+\-*/=]/.test(s)
    })()
    if (!looksLikeMath) {
      const hit = routeGrammarTopic(lastNonTrivialUser, lang11)
      if (hit) {
        mark('grammar_route', { topic: hit.topic, confidence: hit.confidence })
        out.message = grammarCanonStep(hit.topic, { lang: lang11, messages, lastUserText: String(ctx.lastUserText || '') })
        out.action = out.action || 'none'
        return { payload: out, debug }
      }
    }
  }

  // 0) Canonical math engine override (consistency): if we can parse a known math skill,
  // we return the next One-Move step from the canon.
  // Do not override stop/ack-only/bare yes-no closures.
  const canonSeed = lastMathUser || lastNonTrivialUser
  const canon = parseCanonFromText(canonSeed)
  if (canon && !(lastUser && (isStopSignal(lastUser) || isAckOnly(lastUser) || isBareYesNo(lastUser)))) {
    // If the model asked for the full subtraction result (a−b=__) we rewrite to the canon first step.
    if (canon.kind === 'sub') {
      const m = normalizeMathText(String(out.message || ''))
      if (/\bvul\s+in\b/i.test(m) && /__/.test(m) && /=/.test(m) && /-/.test(m)) {
        // If it contains "a - b = __" (the full original subtraction), that's a lazy step → rewrite.
        const a = canon.a
        const b = canon.b
        if (Number.isFinite(a) && Number.isFinite(b)) {
          const aS = String(a)
          const bS = String(b)
          const hasAB = m.includes(aS) && m.includes(bS)
          // Heuristic: if the asked expression includes both original numbers and NOT the tens-step (a - bT),
          // treat as full-answer prompt and rewrite to canon.
          const bT = Math.trunc((b as number) / 10) * 10
          const hasTensStep = m.includes(String(bT))
          if (hasAB && !hasTensStep) {
            mark('rewrite_sub_from_lazy_full_blank', { a, b, bT })
            const step0 = canonStep(lang, canon, messages, lastUser, ageBand)
            if (step0) {
              out.message = step0
              out.action = out.action || 'none'
              return { payload: out, debug }
            }
          }
        }
      }
    }

    // Deterministic escape hatch if the student is stuck.
    if (lastUser && isStuckSignal(lastUser)) {
      mark('math_escape_hatch', { canon: canon.kind })
      const attempts = countRecentAttempts(messages)
      const base = canonStep(lang, canon, messages, lastUser, ageBand) || inferConcreteStep(lang, messages, lastUser)
      if (attempts <= 1) {
        out.message =
          lang === 'en'
            ? `Rule: do it in one tiny step.\n${base}`
            : `Regel: doe het in één mini-stap.\n${base}`
        out.action = out.action || 'none'
        return { payload: out, debug }
      }
      if (attempts <= 3) {
        out.message = lang === 'en' ? `We start together:\n${base}` : `We starten samen:\n${base}`
        out.action = out.action || 'none'
        return { payload: out, debug }
      }
      if (canon.kind === 'add' || canon.kind === 'sub' || canon.kind === 'mul') {
        const a = canon.a!
        const b = canon.b!
        const ans = canon.kind === 'add' ? a + b : canon.kind === 'sub' ? a - b : a * b
        out.message =
          lang === 'en'
            ? `Answer: **${ans}**.\nWhy: split → compute parts → combine.\nTry: ${a + 1} ${canon.kind === 'sub' ? '-' : canon.kind === 'mul' ? '×' : '+'} ${b} = __`
            : `Antwoord: **${ans}**.\nWaarom: splits → reken delen → combineer.\nProbeer: ${a + 1} ${canon.kind === 'sub' ? '-' : canon.kind === 'mul' ? '×' : '+'} ${b} = __`
        out.action = out.action || 'none'
        return { payload: out, debug }
      }
      out.message = base
      out.action = out.action || 'none'
      return { payload: out, debug }
    }

    const step = canonStep(lang, canon, messages, lastUser, ageBand)
    if (step) {
      mark('math_canon_step', { canon: canon.kind })
      out.message = step
      out.action = out.action || 'none'
      return { payload: out, debug }
    }
  }

  // 2) Bare yes/no with no pending question: treat as "we're done" (no wedervraag).
  if (lastUser && isBareYesNo(lastUser) && !/\?\s*$/.test(prevAssistant)) {
    mark('bare_yes_no_close', { lastUser })
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
    return { payload: out, debug }
  }

  // 3) ACK-only handling: if previous assistant asked a question, re-ask for the answer; else close.
  if (lastUser && isAckOnly(lastUser)) {
    if (/\?\s*$/.test(prevAssistant)) {
      mark('ack_only_answer_last_q')
      out.message =
        lang === 'en' ? `Got it. What’s your answer to my last question?` : `Top. Wat is jouw antwoord op mijn laatste vraag?`
      out.action = out.action || 'none'
      return { payload: out, debug }
    }

    // If we're in an active canonical math flow, treat ACK-only as "continue" (not as conversation end).
    // This prevents cases like: "Schrijf: 47=40+7 ..." → user: "ok" → assistant closes.
    const canonSeed2 = lastMathUser || lastNonTrivialUser
    const canon2 = parseCanonFromText(canonSeed2)
    const looksLikeCanonMathStep =
      !!canon2 &&
      (/^(schrijf|vul\s+in|begin\s+met|maak)\b/i.test(prevAssistant) ||
        prevAssistant.includes('__') ||
        /×|\/|\b\d+\s*[+\-*/]\s*\d+/.test(prevAssistant))
    if (looksLikeCanonMathStep) {
      const step = canonStep(lang, canon2!, messages, lastUser, ageBand)
      if (step) {
        mark('ack_only_continue_math_canon', { canon: canon2!.kind })
        out.message = step
        out.action = out.action || 'none'
        return { payload: out, debug }
      }
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
    return { payload: out, debug }
  }

  // 3b) If the assistant asked a comprehension check and the student answers yes/no,
  // do NOT end with praise-only. Continue with a concrete next step instead.
  if (lastUser && isBareYesNo(lastUser) && /\?\s*$/.test(prevAssistant) && isComprehensionCheck(prevAssistant)) {
    if (isPraiseOnly(out.message)) {
      out.message = inferConcreteStep(lang, messages, lastUser)
      out.action = out.action || 'none'
      return { payload: out, debug }
    }
  }

  // 4) Stop guardrail: if model claims completion, do not end with a new question.
  const hasCompletionMarker = (() => {
    const m = String(out?.message || '').toLowerCase()
    return /\b(we\s+zijn\s+klaar|klaar\.?$|dat\s+is\s+het|that'?s\s+it|we'?re\s+done|done\.)\b/i.test(m)
  })()
  if (hasCompletionMarker && /\?/.test(String(out?.message || ''))) {
    mark('strip_question_after_completion')
    out.message =
      stripAfterFirstQuestion(String(out.message || '')) ||
      takeFirstSentenceNoQuestion(String(out.message || '')) ||
      (lang === 'en' ? 'Done.' : 'Klaar.')
    out.action = out.action || 'none'
    return { payload: out, debug }
  }

  // 5) Arithmetic handling:
  // - If this is a *direct user arithmetic query*, stop when correct.
  // - If this is a *micro-step inside a larger problem*, never stop on correct; continue (and never return praise-only).
  const prevOp = extractSimpleOp(prevAssistant)
  const userIsNumber = /^\s*\d+([.,]\d+)?\s*$/.test(lastUser)
  if (prevOp && userIsNumber) {
    const expected = evalOp(prevOp)
    const userN = parseNum(lastUser)
    if (Number.isFinite(expected) && Number.isFinite(userN)) {
      if (Math.abs(userN - expected) < 1e-9) {
        // If the assistant asked for the FULL original expression (e.g. "Vul in: 47 + 28 = __"),
        // we must confirm and stop (do not continue with extra micro-steps).
        const seedOp = extractSimpleOp(canonSeed || '')
        const askedFullExpression =
          !!seedOp &&
          /__/.test(prevAssistant) &&
          /[=]/.test(prevAssistant) &&
          prevAssistant.includes(String(seedOp.a)) &&
          prevAssistant.includes(String(seedOp.b))
        if (askedFullExpression) {
          mark('stop_after_final_fill', { seed: canonSeed })
          out.message = lang === 'en' ? 'Correct.' : 'Juist.'
          out.action = out.action || 'none'
          return { payload: out, debug }
        }

        if (isDirectArithmeticUserQuery(lastNonTrivialUser)) {
          mark('direct_arithmetic_stop')
          out.message = lang === 'en' ? 'Exactly.' : 'Juist.'
          out.action = out.action || 'none'
          return { payload: out, debug }
        }
        // Micro-step correct: do not stop. If the model replies with praise-only, force a concrete next step.
        if (isPraiseOnly(out.message)) {
          mark('avoid_praise_only_continue')
          out.message = inferConcreteStep(lang, messages, lastUser)
          out.action = out.action || 'none'
          return { payload: out, debug }
        }
        // Otherwise, let the model continue naturally.
        return { payload: out, debug }
      }
      out.message =
        lang === 'en'
          ? `Almost. Fill in: **${prevOp.a} ${prevOp.op} ${prevOp.b} = __**.`
          : `Bijna. Vul in: **${prevOp.a} ${prevOp.op} ${prevOp.b} = __**.`
      out.action = out.action || 'none'
      return { payload: out, debug }
    }
  }

  // 6) Anti-parrot: rewrite re-asking a division question into a micro-step.
  const fracFromUser = (() => {
    const t = String(lastNonTrivialUser || '')
    const m = t.match(/(\d+)\s*\/\s*(\d+)/)
    if (!m) return null
    return { a: m[1], b: m[2] }
  })()

  // 6a) Division progression (prevents repeats):
  // If we're in a division a/b flow and the student answers a micro-step,
  // advance to the next concrete micro-step deterministically.
  if (fracFromUser && userIsNumber) {
    const aN = Number(fracFromUser.a)
    const bN = Number(fracFromUser.b)
    const userN = parseNum(lastUser)
    if (Number.isFinite(aN) && Number.isFinite(bN) && Number.isFinite(userN)) {
      const prev = String(prevAssistant || '')

      const prevAskedBx10 =
        new RegExp(`\\b${fracFromUser.b}\\s*[×x*]\\s*10\\b`).test(prev) || /\b(x|×)\s*10\s*=\s*__/.test(prev)
      if (prevAskedBx10) {
        const expectedBx10 = bN * 10
        if (Math.abs(userN - expectedBx10) < 1e-9) {
          out.message =
            lang === 'en'
              ? `Fill in: **${aN} − ${expectedBx10} = __**.`
              : `Vul in: **${aN} − ${expectedBx10} = __**.`
          out.action = out.action || 'none'
          return { payload: out, debug }
        }
        out.message =
          lang === 'en'
            ? `Almost. Fill in: **${bN} × 10 = __**.`
            : `Bijna. Vul in: **${bN} × 10 = __**.`
        out.action = out.action || 'none'
        return { payload: out, debug }
      }

      const prevAskedRemainder = /\b(hoeveel\s+blijft\s+er\s+over|blijft\s+er\s+over|remainder|rest)\b/i.test(prev)
      if (prevAskedRemainder) {
        // Try to find the "used" number from prev assistant (e.g. 160 in "160 van 184 aftrekt")
        const nums = (prev.match(/\d+/g) || []).map((n) => Number(n)).filter((n) => Number.isFinite(n))
        const used = nums.find((n) => n !== aN) ?? nums[0]
        const expectedRem = Number.isFinite(used) ? aN - used : NaN
        if (Number.isFinite(expectedRem) && Math.abs(userN - expectedRem) < 1e-9) {
          out.message =
            lang === 'en'
              ? `Next step: **${bN} × 1 = __**. What is it?`
              : `Volgende stap: **${bN} × 1 = __**. Wat is dat?`
          out.action = out.action || 'none'
          return { payload: out, debug }
        }
        if (Number.isFinite(expectedRem)) {
          out.message =
            lang === 'en'
              ? `Fill in: **${aN} − ${used} = __**.`
              : `Vul in: **${aN} − ${used} = __**.`
          out.action = out.action || 'none'
          return { payload: out, debug }
        }
      }
    }
  }

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
    mark('rewrite_generic_outcome_prompt')
    out.message = inferConcreteStep(lang, messages, lastUser)
    out.action = out.action || 'none'
    return { payload: out, debug }
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
    mark('rewrite_parroted_division_question')
    const { b } = fracFromUser!
    out.message =
      lang === 'en'
        ? `Start with: **${b} × 10 = __**. What is it?`
        : `Begin met: **${b} × 10 = __**. Wat is dat?`
    out.action = out.action || 'none'
    return { payload: out, debug }
  }

  // 7) Low-friction linter: eliminate guess/meta questions (policy-first) into concrete compute/fill-blank.
  const msg = strip(out.message)
  const bannedGuess = /(schat|schatten|meer\s+of\s+minder|denk\s+je\s+dat|zou\s+het\s+kunnen|past\s+.*\b(vaker|meer)\b)/i.test(msg)
  const bannedMeta =
    /(schrijf\s+je\s+berekening|wat\s+is\s+je\s+volgende\s+stap|volgende\s+stap\s*\(1\s*korte\s*zin\))/i.test(msg)
  if (bannedGuess || bannedMeta) {
    mark('rewrite_low_friction', { bannedGuess, bannedMeta })
    out.message = inferConcreteStep(lang, messages, lastUser)
    out.action = out.action || 'none'
    return { payload: out, debug }
  }

  // 8) Final anti-repeat: if assistant repeats itself, replace with a concrete next step.
  const lastAssistantInHistory = prevAssistant
  const nowMsg = typeof out.message === 'string' ? out.message : ''
  if (lastAssistantInHistory && normalizeForRepeat(nowMsg) && normalizeForRepeat(nowMsg) === normalizeForRepeat(lastAssistantInHistory)) {
    mark('anti_repeat_triggered')
    out.message = inferConcreteStep(lang, messages, lastUser)
    out.action = out.action || 'none'
    return { payload: out, debug }
  }

  mark('no_policy_change')
  return { payload: out, debug }
}

