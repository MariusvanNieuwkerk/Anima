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
  | 'units_time'
  | 'order_ops'
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

const parseCanonFromText = (tRaw: string): CanonState | null => {
  const t = strip(tRaw)
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
      if (Number.isFinite(a)) return { kind: 'percent', a, raw: t }
    }
  }

  // Unit conversion time (hours/minutes)
  if (/\b(uur|uren|minuut|minuten|hour|hours|minute|minutes)\b/i.test(t) && /\d/.test(t)) {
    return { kind: 'units_time', raw: t }
  }

  // Order of ops / parentheses
  if (/[()]/.test(t) && /[+\-*/:×x]/.test(t) && /\d/.test(t)) {
    return { kind: 'order_ops', raw: t }
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

const canonStep = (lang: string, state: CanonState, messages: any[], lastUserText: string) => {
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
    if (!/(schrijf|write)\s*:?\s*\d+\s*=\s*\d+\s*\+\s*\d+/i.test(prevAssistant)) {
      return ask(
        `Schrijf: ${a} = ${aT} + ${aU} en ${b} = ${bT} + ${bU}.`,
        `Write: ${a} = ${aT} + ${aU} and ${b} = ${bT} + ${bU}.`
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
    return ask(`Vul in: ${aT} + ${bT} = __`, `Fill in: ${aT} + ${bT} = __`)
  }

  if (state.kind === 'sub' && Number.isFinite(state.a) && Number.isFinite(state.b)) {
    const a = state.a!
    const b = state.b!
    // Canon: rewrite as a - tens - ones
    const bT = Math.trunc(b / 10) * 10
    const bU = b - bT
    if (!/=\s*.*-\s*\d+/i.test(prevAssistant) && !/maak\s+het/i.test(prevAssistant)) {
      return ask(`Maak: ${a} − ${b} = ${a} − ${bT} − ${bU}`, `Rewrite: ${a} − ${b} = ${a} − ${bT} − ${bU}`)
    }
    if (new RegExp(`\\b${a}\\s*[−-]\\s*${bT}\\b`).test(prevAssistant) && /^\d+/.test(lastUser)) {
      const userN = parseNum(lastUser)
      if (Math.abs(userN - (a - bT)) < 1e-9) return ask(`Vul in: ${a - bT} − ${bU} = __`, `Fill in: ${a - bT} − ${bU} = __`)
    }
    return ask(`Vul in: ${a} − ${bT} = __`, `Fill in: ${a} − ${bT} = __`)
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
    return ask(`Vul in: ${a}×${bT} = __`, `Fill in: ${a}×${bT} = __`)
  }

  if (state.kind === 'div' && Number.isFinite(state.divA) && Number.isFinite(state.divB)) {
    const a = state.divA!
    const b = state.divB!
    // Canon chunking with 10 then remainder then 1
    if (!/\b10\b/.test(prevAssistant) && !/\b×\s*10\b/.test(prevAssistant)) {
      return ask(`Begin met: ${b}×10 = __`, `Start with: ${b}×10 = __`)
    }
    // If remainder asked and user answered, next step is b×1
    if (/\b(aftrek|blijft\s+er\s+over|over)\b/i.test(prevAssistant) && /^\d+/.test(lastUser)) {
      const used = b * 10
      const expectedRem = a - used
      const userN = parseNum(lastUser)
      if (Math.abs(userN - expectedRem) < 1e-9) return ask(`Vul in: ${b}×1 = __`, `Fill in: ${b}×1 = __`)
    }
    // Otherwise ask remainder
    return ask(`Vul in: ${a} − ${b * 10} = __`, `Fill in: ${a} − ${b * 10} = __`)
  }

  if (state.kind === 'frac_simplify' && Number.isFinite(state.a) && Number.isFinite(state.b)) {
    const a = state.a!
    const b = state.b!
    // Canon: try divide by 2,3,5 via a concrete compute
    const can2 = a % 2 === 0 && b % 2 === 0
    const can3 = a % 3 === 0 && b % 3 === 0
    const can5 = a % 5 === 0 && b % 5 === 0
    if (can2) return ask(`Vul in: ${a}/2 = __ en ${b}/2 = __`, `Fill in: ${a}/2 = __ and ${b}/2 = __`)
    if (can3) return ask(`Vul in: ${a}/3 = __ en ${b}/3 = __`, `Fill in: ${a}/3 = __ and ${b}/3 = __`)
    if (can5) return ask(`Vul in: ${a}/5 = __ en ${b}/5 = __`, `Fill in: ${a}/5 = __ and ${b}/5 = __`)
    return ask(`Kan ${a}/${b} nog door 2, 3 of 5? Vul in: nee`, `Can ${a}/${b} still be divided by 2, 3, or 5? Fill in: no`)
  }

  if (state.kind === 'unknown' && Number.isFinite(state.a) && Number.isFinite(state.b) && state.op) {
    const c = state.a!
    const b = state.b!
    const op = state.op!
    if (op === '+') return ask(`Vul in: __ = ${c} − ${b}`, `Fill in: __ = ${c} − ${b}`)
    return ask(`Vul in: __ = ${c} + ${b}`, `Fill in: __ = ${c} + ${b}`)
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
  const out: TutorPayload = { ...payload }
  const lang = String(ctx.userLanguage || 'nl')
  const lastUser = strip(ctx.lastUserText)
  const messages = Array.isArray(ctx.messages) ? ctx.messages : []
  const prevAssistant = getPrevAssistantText(messages)
  const lastNonTrivialUser = getLastNonTrivialUserText(messages)

  // NOTE: Canonical math engine runs AFTER stop/ack-only logic below.

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

  // 0) Canonical math engine override (consistency): if we can parse a known math skill,
  // we return the next One-Move step from the canon.
  // Do not override stop/ack-only/bare yes-no closures.
  const canon = parseCanonFromText(lastNonTrivialUser)
  if (canon && !(lastUser && (isStopSignal(lastUser) || isAckOnly(lastUser) || isBareYesNo(lastUser)))) {
    // Deterministic escape hatch if the student is stuck.
    if (lastUser && isStuckSignal(lastUser)) {
      const attempts = countRecentAttempts(messages)
      const base = canonStep(lang, canon, messages, lastUser) || inferConcreteStep(lang, messages, lastUser)
      if (attempts <= 1) {
        out.message =
          lang === 'en'
            ? `Rule: do it in one tiny step.\n${base}`
            : `Regel: doe het in één mini-stap.\n${base}`
        out.action = out.action || 'none'
        return out
      }
      if (attempts <= 3) {
        out.message = lang === 'en' ? `We start together:\n${base}` : `We starten samen:\n${base}`
        out.action = out.action || 'none'
        return out
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
        return out
      }
      out.message = base
      out.action = out.action || 'none'
      return out
    }

    const step = canonStep(lang, canon, messages, lastUser)
    if (step) {
      out.message = step
      out.action = out.action || 'none'
      return out
    }
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
        if (isDirectArithmeticUserQuery(lastNonTrivialUser)) {
          out.message = lang === 'en' ? 'Exactly.' : 'Juist.'
          out.action = out.action || 'none'
          return out
        }
        // Micro-step correct: do not stop. If the model replies with praise-only, force a concrete next step.
        if (isPraiseOnly(out.message)) {
          out.message = inferConcreteStep(lang, messages, lastUser)
          out.action = out.action || 'none'
          return out
        }
        // Otherwise, let the model continue naturally.
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
          return out
        }
        out.message =
          lang === 'en'
            ? `Almost. Fill in: **${bN} × 10 = __**.`
            : `Bijna. Vul in: **${bN} × 10 = __**.`
        out.action = out.action || 'none'
        return out
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
          return out
        }
        if (Number.isFinite(expectedRem)) {
          out.message =
            lang === 'en'
              ? `Fill in: **${aN} − ${used} = __**.`
              : `Vul in: **${aN} − ${used} = __**.`
          out.action = out.action || 'none'
          return out
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

