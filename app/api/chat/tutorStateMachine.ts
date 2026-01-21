export type TutorSMKind = 'div' | 'mul' | 'add' | 'sub' | 'frac' | 'percent' | 'order_ops' | 'negatives'

export type TutorSMState =
  | {
      v: 1
      kind: 'div'
      a: number
      b: number
      startChunk: number
      onesAdded: number
      turn: number
      step: 'bx_start' | 'a_minus_used' | 'bx1' | 'rem_minus_b' | 'q_sum' | 'final'
      used?: number
      rem?: number
    }
  | {
      v: 1
      kind: 'frac'
      n: number
      d: number
      turn: number
      step: 'n_div' | 'd_div'
      div: number
      n2?: number
    }
  | {
      v: 1
      kind: 'add'
      a: number
      b: number
      turn: number
      step: 'tens' | 'ones' | 'combine'
      aT: number
      aU: number
      bT: number
      bU: number
      tensSum: number
      onesSum: number
    }
  | {
      v: 1
      kind: 'sub'
      a: number
      b: number
      turn: number
      step: 'a_minus_bT' | 'rem_minus_bU'
      bT: number
      bU: number
      remAfterTens: number
    }
  | {
      v: 1
      kind: 'mul'
      a: number
      b: number
      turn: number
      step: 'ax_bT' | 'ax_bU' | 'ax_bU_micro_aT' | 'ax_bU_micro_aU' | 'ax_bU_micro_sum' | 'sum' | 'done'
      bT?: number
      bU?: number
      axbT?: number
      axbU?: number
      aT?: number
      aU?: number
      aTxbU?: number
      aUxbU?: number
    }
  | {
      v: 1
      kind: 'percent'
      p: number
      base: number
      turn: number
      step: 'unit' | 'scale'
      unitPct: number
      divisor: number
      multiplier: number
      unitValue?: number
    }
  | {
      v: 1
      kind: 'order_ops'
      expr: string // normalized internal expression
      turn: number
      step: 'compute'
      prompt: string // pretty subexpression currently asked
      expected: number
      nextExpr: string
    }
  | {
      v: 1
      kind: 'negatives'
      expr: string // normalized internal expression (may include unary negatives)
      turn: number
      step: 'rewrite' | 'compute'
      // rewrite-step prompt
      rewritePrompt?: string
      rewriteExpected?: number
      rewriteNextExpr?: string
      // compute-step prompt
      prompt?: string
      expected?: number
      nextExpr?: string
    }

export type TutorSMInput = {
  state: TutorSMState | null
  lastUserText: string
  userAge?: number
  userLanguage?: string
}

export type TutorSMOutput =
  | { handled: false }
  | { handled: true; payload: { message: string; action: 'none' }; nextState: TutorSMState | null }

const strip = (s: any) => String(s || '').trim()

const normalizeMathText = (t: string) =>
  String(t || '')
    .replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\u2015\u00AD\uFF0D−–—]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/[×]/g, '*')
    .replace(/:/g, '/')

const parseNum = (s: string) => {
  const n = Number(String(s || '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

const isNumberLike = (t: string) => /^\s*\d+([.,]\d+)?\s*$/.test(strip(t))

const isAckOnly = (t: string) =>
  /^(ok(é|ay)?|ja|yes|yep|nee|no|nope|prima|top|klopt|thanks|thank\s+you|dankjewel|dank\s+je)\b[!.]*$/i.test(strip(t))

const isStopSignal = (t: string) => /^(stop|klaar|niets|laat\s+maar|hou\s+op|ophouden|exit|quit|done)\b/i.test(strip(t))

const isStuck = (t: string) =>
  /^(ik\s+snap\s+het\s+niet|snap\s+het\s+niet|ik\s+begrijp\s+het\s+niet|ik\s+weet\s+het\s+niet|weet\s+ik\s+niet|geen\s+idee|help|hulp|vast|i\s+don'?t\s+get\s+it|i\s+don'?t\s+understand)\b/i.test(
    strip(t)
  )

type AgeBand = 'junior' | 'teen' | 'student'
const ageBandOf = (age?: number): AgeBand => {
  const a = Number(age)
  if (!Number.isFinite(a)) return 'teen'
  if (a <= 12) return 'junior'
  if (a <= 16) return 'teen'
  return 'student'
}

type CoachTone = 'none' | 'mid' | 'high'

function coachToneOf(turn: number): CoachTone {
  if (!Number.isFinite(turn) || turn <= 0) return 'mid' // warm start
  if (turn % 10 === 7) return 'high' // rare
  if (turn % 3 === 1) return 'mid' // sometimes
  return 'none'
}

function coachJunior(lang: string, ageBand: AgeBand, turn: number, nlMid: string, enMid: string, prompt: string, opts?: { forceTone?: CoachTone }) {
  if (ageBand !== 'junior') return prompt
  const tone = opts?.forceTone ?? coachToneOf(turn)
  if (tone === 'none') return prompt

  if (tone === 'high') {
    const hiNL = ['Wauw, netjes!', 'Yes, knap gedaan!', 'Lekker bezig!', 'Topper!'][turn % 4]
    const hiEN = ['Wow, nice!', 'Yes—well done!', 'Great job!', 'You’re on fire!'][turn % 4]
    const hi = lang === 'en' ? hiEN : hiNL
    return `${hi} ${prompt}`.trim()
  }

  const mid = (lang === 'en' ? enMid : nlMid).trim()
  return mid ? `${mid} ${prompt}`.trim() : prompt
}

function percentPlan(pRaw: number): { unitPct: number; divisor: number; multiplier: number } {
  const p = Number(pRaw)
  // Shortcuts:
  // 50% = 1/2, 25% = 1/4, 20% = 1/5, 10% = 1/10
  if (Math.abs(p - 50) < 1e-9) return { unitPct: 50, divisor: 2, multiplier: 1 }
  if (Math.abs(p - 25) < 1e-9) return { unitPct: 25, divisor: 4, multiplier: 1 }
  if (Math.abs(p - 20) < 1e-9) return { unitPct: 20, divisor: 5, multiplier: 1 }
  if (Math.abs(p - 10) < 1e-9) return { unitPct: 10, divisor: 10, multiplier: 1 }

  // Multiples of 10%: compute 10% first, then scale.
  if (Number.isFinite(p) && Math.abs(p % 10) < 1e-9) return { unitPct: 10, divisor: 10, multiplier: p / 10 }

  // Default: compute 1% (= ÷100) then scale by p.
  return { unitPct: 1, divisor: 100, multiplier: p }
}

function percentWhy(lang: string, unitPct: number, divisor: number): { nl: string; en: string } {
  if (unitPct === 50 && divisor === 2) return { nl: `50% is de helft.`, en: `50% is half.` }
  if (unitPct === 25 && divisor === 4) return { nl: `25% is een kwart.`, en: `25% is a quarter.` }
  if (unitPct === 20 && divisor === 5) return { nl: `20% is één vijfde.`, en: `20% is one fifth.` }
  if (unitPct === 10 && divisor === 10) return { nl: `10% is delen door 10.`, en: `10% is divide by 10.` }
  if (unitPct === 1 && divisor === 100) return { nl: `1% is delen door 100.`, en: `1% is divide by 100.` }
  return { nl: `% betekent “van de 100”.`, en: `% means “out of 100”.` }
}

type ParsedProblem =
  | { kind: 'frac' | 'div' | 'mul' | 'add' | 'sub' | 'percent'; a: number; b: number }
  | { kind: 'order_ops'; expr: string }
  | { kind: 'negatives'; expr: string }

type Tok = { t: 'num'; n: number } | { t: 'op'; op: '+' | '-' | '*' | '/' } | { t: 'lp' } | { t: 'rp' }

function tokenizeExpr(exprRaw: string): Tok[] | null {
  const s = strip(exprRaw).replace(/\s+/g, '')
  if (!s) return null
  const toks: Tok[] = []
  let i = 0
  const pushNum = (raw: string) => {
    const n = parseNum(raw)
    if (!Number.isFinite(n)) return false
    toks.push({ t: 'num', n })
    return true
  }
  const prevIsOpOrLp = () => toks.length === 0 || toks[toks.length - 1].t === 'op' || toks[toks.length - 1].t === 'lp'

  while (i < s.length) {
    const ch = s[i]
    if (ch === '(') {
      toks.push({ t: 'lp' })
      i++
      continue
    }
    if (ch === ')') {
      toks.push({ t: 'rp' })
      i++
      continue
    }
    if (ch === '+' || ch === '*' || ch === '/') {
      toks.push({ t: 'op', op: ch as any })
      i++
      continue
    }
    if (ch === '-') {
      // unary minus becomes part of a number when it appears at start or after an operator or '('
      if (prevIsOpOrLp()) {
        let j = i + 1
        while (j < s.length && /[0-9.,]/.test(s[j])) j++
        const raw = s.slice(i, j)
        if (!pushNum(raw)) return null
        i = j
        continue
      }
      toks.push({ t: 'op', op: '-' })
      i++
      continue
    }
    if (/[0-9.]/.test(ch) || ch === ',') {
      let j = i + 1
      while (j < s.length && /[0-9.,]/.test(s[j])) j++
      const raw = s.slice(i, j)
      if (!pushNum(raw)) return null
      i = j
      continue
    }
    return null
  }
  return toks
}

function formatExprPretty(expr: string): string {
  const s = strip(expr).replace(/\s+/g, '')
  // keep it simple but readable: spaces around ops, and nicer symbols
  return s
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/-/g, '−')
    .replace(/([+−×÷])/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findInnermostParens(tokens: Tok[]): { l: number; r: number } | null {
  const stack: number[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.t === 'lp') stack.push(i)
    if (t.t === 'rp') {
      const l = stack.pop()
      if (l === undefined) return null
      // this is the innermost closing paren encountered left-to-right
      return { l, r: i }
    }
  }
  return null
}

function chooseNextOp(tokens: Tok[], startIdx: number, endIdx: number): number | null {
  // returns index of op token to evaluate next within [startIdx, endIdx] inclusive
  // precedence: * and / first, then + and -, left-to-right
  for (let i = startIdx; i <= endIdx; i++) {
    const t = tokens[i]
    if (t.t === 'op' && (t.op === '*' || t.op === '/')) return i
  }
  for (let i = startIdx; i <= endIdx; i++) {
    const t = tokens[i]
    if (t.t === 'op' && (t.op === '+' || t.op === '-')) return i
  }
  return null
}

function applyOp(a: number, op: '+' | '-' | '*' | '/', b: number): number {
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === '*') return a * b
  return a / b
}

function stringifyTokens(tokens: Tok[]): string {
  return tokens
    .map((t) => {
      if (t.t === 'lp') return '('
      if (t.t === 'rp') return ')'
      if (t.t === 'op') return t.op
      // num
      // keep integers clean
      return Math.abs(t.n % 1) < 1e-9 ? String(Math.trunc(t.n)) : String(Number(t.n.toFixed(6))).replace(/\.?0+$/, '')
    })
    .join('')
}

function nextOrderOpsStep(expr: string): { promptPretty: string; expected: number; nextExpr: string } | null {
  const toks0 = tokenizeExpr(expr)
  if (!toks0 || toks0.length === 0) return null

  // Determine focus range: innermost parentheses content, else full expression.
  const par = findInnermostParens(toks0)
  const range = par ? { start: par.l + 1, end: par.r - 1, parL: par.l, parR: par.r } : { start: 0, end: toks0.length - 1, parL: -1, parR: -1 }
  if (range.start > range.end) return null

  const opIdx = chooseNextOp(toks0, range.start, range.end)
  if (opIdx === null) {
    // No ops left in range: if it's inside parentheses with a single number, remove the parens and continue.
    if (par) {
      const inner = toks0.slice(range.start, range.end + 1)
      if (inner.length === 1 && inner[0].t === 'num') {
        const toks = toks0.slice(0, range.parL).concat(inner as any, toks0.slice(range.parR + 1))
        return nextOrderOpsStep(stringifyTokens(toks))
      }
    }
    // Already reduced to a number?
    if (toks0.length === 1 && toks0[0].t === 'num') return null
    return null
  }

  const left = toks0[opIdx - 1]
  const op = toks0[opIdx]
  const right = toks0[opIdx + 1]
  if (!left || !right || left.t !== 'num' || right.t !== 'num' || op.t !== 'op') return null
  const expected = applyOp(left.n, op.op, right.n)
  if (!Number.isFinite(expected)) return null

  const subexpr = `${stringifyTokens([left as any, op as any, right as any])}`
  const promptPretty = formatExprPretty(subexpr)

  // Replace [left op right] with expected number.
  const toks = toks0.slice(0, opIdx - 1).concat([{ t: 'num', n: expected } as Tok], toks0.slice(opIdx + 2))

  // If parentheses now wrap a single number, remove them (to avoid a useless "(5)" step).
  const par2 = findInnermostParens(toks)
  if (par2) {
    const inner = toks.slice(par2.l + 1, par2.r)
    const hasOp = inner.some((t) => t.t === 'op')
    if (!hasOp && inner.length === 1 && inner[0].t === 'num') {
      const simplified = toks.slice(0, par2.l).concat(inner as any, toks.slice(par2.r + 1))
      return { promptPretty, expected, nextExpr: stringifyTokens(simplified) }
    }
  }

  return { promptPretty, expected, nextExpr: stringifyTokens(toks) }
}

function orderOpsWhy(lang: string, ageBand: AgeBand, expr: string): { nl: string; en: string } {
  if (ageBand !== 'junior') return { nl: '', en: '' }
  const hasParens = /[()]/.test(expr)
  if (hasParens) return { nl: `Eerst rekenen we binnen de haakjes.`, en: `First we do what’s inside the parentheses.` }
  return { nl: `Eerst keer/delen, daarna plus/min.`, en: `First multiply/divide, then add/subtract.` }
}

function hasNegativeNumberToken(tokens: Tok[]): boolean {
  return tokens.some((t) => t.t === 'num' && Number(t.n) < 0)
}

function negativesRewritePlan(expr: string): { promptPretty: string; expected: number; nextExpr: string } | null {
  const toks = tokenizeExpr(expr)
  if (!toks) return null
  // Only try a single rewrite on very simple 2-term + / - expressions.
  const ops = toks.filter((t) => t.t === 'op') as Array<{ t: 'op'; op: '+' | '-' | '*' | '/' }>
  if (ops.length !== 1) return null
  if (toks.length !== 3) return null
  const a = toks[0]
  const op = toks[1]
  const b = toks[2]
  if (a.t !== 'num' || b.t !== 'num' || op.t !== 'op') return null
  if (op.op !== '+' && op.op !== '-') return null

  const absA = Math.abs(a.n)
  const absB = Math.abs(b.n)

  // Case 1: -a + b  (b positive) → b − a
  if (a.n < 0 && op.op === '+' && b.n >= 0) {
    const nextExpr = `${Math.trunc(b.n) === b.n ? String(Math.trunc(b.n)) : String(b.n)}-${Math.trunc(absA) === absA ? String(Math.trunc(absA)) : String(absA)}`
    const prettyOrig = formatExprPretty(stringifyTokens(toks))
    const promptPrettyNL = `Schrijf om: ${prettyOrig} = ${formatExprPretty(String(b.n))} − __`
    return { promptPretty: promptPrettyNL, expected: absA, nextExpr }
  }

  // Case 2: a + (−b) → a − b
  if (a.n >= 0 && op.op === '+' && b.n < 0) {
    const nextExpr = `${Math.trunc(a.n) === a.n ? String(Math.trunc(a.n)) : String(a.n)}-${Math.trunc(absB) === absB ? String(Math.trunc(absB)) : String(absB)}`
    const prettyOrig = formatExprPretty(stringifyTokens(toks))
    const promptPrettyNL = `Schrijf om: ${prettyOrig} = ${formatExprPretty(String(a.n))} − __`
    return { promptPretty: promptPrettyNL, expected: absB, nextExpr }
  }

  // Case 3: a − (−b) → a + b
  if (op.op === '-' && b.n < 0) {
    const nextExpr = `${Math.trunc(a.n) === a.n ? String(Math.trunc(a.n)) : String(a.n)}+${Math.trunc(absB) === absB ? String(Math.trunc(absB)) : String(absB)}`
    const prettyOrig = formatExprPretty(stringifyTokens(toks))
    const promptPrettyNL = `Schrijf om: ${prettyOrig} = ${formatExprPretty(String(a.n))} + __`
    return { promptPretty: promptPrettyNL, expected: absB, nextExpr }
  }

  return null
}

function negativesWhy(lang: string, ageBand: AgeBand, expr: string): { nl: string; en: string } {
  if (ageBand !== 'junior') return { nl: '', en: '' }
  if (/--/.test(expr) || /-\s*-/.test(expr)) return { nl: `Min min wordt plus.`, en: `Minus minus becomes plus.` }
  return { nl: `Let op het min‑teken.`, en: `Watch the minus sign.` }
}

function negativesStuckHint(lang: string, expr: string): string {
  const e = String(expr || '').replace(/\s+/g, '')
  // Keep it short: 1 rule sentence max.
  if (/--/.test(e)) return lang === 'en' ? `Rule: minus minus = plus.` : `Regel: min min = plus.`
  if (/\+-/.test(e) || /\+\(-/.test(e)) return lang === 'en' ? `Rule: adding a negative = subtraction.` : `Regel: plus een negatief getal = aftrekken.`
  if (/^-\d+(?:[.,]\d+)?\+\d/.test(e)) return lang === 'en' ? `Rule: −a + b = b − a.` : `Regel: −a + b = b − a.`
  return lang === 'en' ? `Rule: watch the minus sign.` : `Regel: let op het min‑teken.`
}

function parseProblem(text: string): ParsedProblem | null {
  const t = normalizeMathText(text)
  // Percent-of: "20% van 150" / "20 procent van 150" / "20% of 150"
  const pct = t.match(
    /(?:wat\s+is|what\s+is|los\s+op|bereken)?\s*[: ]*\s*(\d+(?:[.,]\d+)?)\s*(?:%|procent|percent)\s*(?:van|of)\s*(\d+(?:[.,]\d+)?)/i
  )
  if (pct) {
    const p = parseNum(pct[1])
    const base = parseNum(pct[2])
    if (Number.isFinite(p) && Number.isFinite(base)) return { kind: 'percent', a: p, b: base }
  }

  // Negatives: if the expression contains an actual negative number (unary minus),
  // route it to a dedicated canon so we don't confuse it with normal subtraction.
  // Examples: "-3 + 7", "7 + -3", "5 - -2", "5 * -2".
  {
    const core = strip(t).replace(/^(?:wat\s+is|what\s+is|los\s+op|bereken)\s*:?\s*/i, '').trim()
    const toks = tokenizeExpr(core)
    if (toks && hasNegativeNumberToken(toks) && toks.some((x) => x.t === 'op')) {
      return { kind: 'negatives', expr: stringifyTokens(toks) }
    }
  }
  // Order of operations:
  // - Any arithmetic with parentheses, OR
  // - Any arithmetic with MULTIPLE operators (e.g. "3 + 4*5") so precedence matters.
  // IMPORTANT: do NOT hijack simple one-op canons like "17 + 28" or "184/16".
  if (/[+\-*/()]/.test(t) && /\d/.test(t)) {
    const core = strip(t).replace(/^(?:wat\s+is|what\s+is|los\s+op|bereken)\s*:?\s*/i, '').trim()
    const toks = tokenizeExpr(core)
    if (toks) {
      const opCount = toks.filter((x) => x.t === 'op').length
      const hasParens = toks.some((x) => x.t === 'lp' || x.t === 'rp')
      if (hasParens || opCount >= 2) return { kind: 'order_ops', expr: stringifyTokens(toks) }
    }
  }
  // Fraction simplify: "vereenvoudig 12/18" or "breuk 12/18 vereenvoudigen"
  if (/(?:vereenvoudig|vereenvoudigen|breuk|simplify|reduce)\b/i.test(t)) {
    const fm = t.match(/(\d+)\s*\/\s*(\d+)/)
    if (fm) return { kind: 'frac', a: Number(fm[1]), b: Number(fm[2]) }
  }
  // Division: "184/16" or "wat is 184/16" or "los op: 184/16"
  const div = t.match(/(?:wat\s+is|what\s+is|los\s+op|bereken)?\s*[: ]*\s*(\d+)\s*\/\s*(\d+)/i)
  if (div) return { kind: 'div', a: Number(div[1]), b: Number(div[2]) }
  // Multiplication: "23*14" or "23×14"
  const mul = t.match(/(?:wat\s+is|what\s+is|los\s+op|bereken)?\s*[: ]*\s*(\d+)\s*[*x]\s*(\d+)/i)
  if (mul) return { kind: 'mul', a: Number(mul[1]), b: Number(mul[2]) }
  // Addition/Subtraction: "47 + 28", "82 - 47" (normalized minus)
  const addSub = t.match(/(?:wat\s+is|what\s+is|los\s+op|bereken)?\s*[: ]*\s*(\d+)\s*([+\-])\s*(\d+)/i)
  if (addSub) {
    const a = Number(addSub[1])
    const op = addSub[2]
    const b = Number(addSub[3])
    if (op === '+') return { kind: 'add', a, b }
    if (op === '-') return { kind: 'sub', a, b }
  }
  return null
}

function isStandaloneProblemStatement(text: string): boolean {
  const t = normalizeMathText(text)
  if (/[=]/.test(t)) return false
  const s = strip(t)
  const core = s.replace(/^(?:wat\s+is|what\s+is|los\s+op|bereken)\s*:?\s*/i, '').trim()
  // Negatives: contains a unary negative number token and an operator.
  {
    const toks = tokenizeExpr(core)
    if (toks && hasNegativeNumberToken(toks) && toks.some((x) => x.t === 'op')) return true
  }
  // Any expression with parentheses, or with multiple operators, should start the order-ops canon.
  if (/[+\-*/()]/.test(core) && /\d/.test(core)) {
    const toks = tokenizeExpr(core)
    if (toks) {
      const opCount = toks.filter((x) => x.t === 'op').length
      const hasParens = toks.some((x) => x.t === 'lp' || x.t === 'rp')
      if (hasParens || opCount >= 2) return true
    }
  }
  if (/(?:\d+(?:[.,]\d+)?)\s*(?:%|procent|percent)\s*(?:van|of)\s*(?:\d+(?:[.,]\d+)?)/i.test(core)) return true
  if (/(?:vereenvoudig|vereenvoudigen|breuk|simplify|reduce)\b/i.test(core) && /(\d+)\s*\/\s*(\d+)/.test(core)) return true
  return /^\d+\s*(?:[+\-]|\*|\/)\s*\d+$/.test(core)
}

function smallestCommonDivisor(n: number, d: number): number | null {
  if (!Number.isFinite(n) || !Number.isFinite(d)) return null
  const a = Math.abs(Math.trunc(n))
  const b = Math.abs(Math.trunc(d))
  if (a === 0 || b === 0) return null
  const max = Math.min(15, Math.min(a, b))
  for (let k = 2; k <= max; k++) {
    if (a % k === 0 && b % k === 0) return k
  }
  return null
}

export function runTutorStateMachine(input: TutorSMInput): TutorSMOutput {
  const lang = String(input.userLanguage || 'nl')
  const ageBand = ageBandOf(input.userAge)
  const lastUser = strip(input.lastUserText)

  const problem = parseProblem(lastUser)
  const state = input.state

  // Start or restart when user provides a fresh problem statement.
  if (problem && isStandaloneProblemStatement(lastUser)) {
    if (problem.kind === 'negatives') {
      const expr = problem.expr
      const why = negativesWhy(lang, ageBand, expr)

      // Junior: do a single rewrite step when it makes the rule explicit and easier.
      if (ageBand === 'junior') {
        const rw = negativesRewritePlan(expr)
        if (rw) {
          const prompt = lang === 'en' ? rw.promptPretty.replace(/^Schrijf om:/, 'Rewrite:') : rw.promptPretty
          return {
            handled: true,
            payload: { message: coachJunior(lang, ageBand, 0, why.nl, why.en, prompt), action: 'none' },
            nextState: {
              v: 1,
              kind: 'negatives',
              expr,
              turn: 0,
              step: 'rewrite',
              rewritePrompt: prompt,
              rewriteExpected: rw.expected,
              rewriteNextExpr: rw.nextExpr,
            },
          }
        }
      }

      // Teen: if a simple rewrite exists, jump straight to the easier rewritten compute (no extra rewrite step).
      if (ageBand === 'teen') {
        const rw = negativesRewritePlan(expr)
        if (rw) {
          const step = nextOrderOpsStep(rw.nextExpr)
          if (!step) return { handled: false }
          const hint = negativesStuckHint(lang, expr)
          const prompt = lang === 'en' ? `Fill in: ${step.promptPretty} = __` : `Vul in: ${step.promptPretty} = __`
          return {
            handled: true,
            payload: { message: [hint, prompt].filter(Boolean).join(' '), action: 'none' },
            nextState: {
              v: 1,
              kind: 'negatives',
              expr: rw.nextExpr,
              turn: 0,
              step: 'compute',
              prompt: step.promptPretty,
              expected: step.expected,
              nextExpr: step.nextExpr,
            },
          }
        }
      }

      const step = nextOrderOpsStep(expr)
      if (!step) return { handled: false }
      const prompt = lang === 'en' ? `Fill in: ${step.promptPretty} = __` : `Vul in: ${step.promptPretty} = __`
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, 0, why.nl, why.en, prompt), action: 'none' },
        nextState: {
          v: 1,
          kind: 'negatives',
          expr,
          turn: 0,
          step: 'compute',
          prompt: step.promptPretty,
          expected: step.expected,
          nextExpr: step.nextExpr,
        },
      }
    }

    if (problem.kind === 'order_ops') {
      const step = nextOrderOpsStep(problem.expr)
      if (!step) return { handled: false }
      const prompt = lang === 'en' ? `Fill in: ${step.promptPretty} = __` : `Vul in: ${step.promptPretty} = __`
      const why = orderOpsWhy(lang, ageBand, problem.expr)
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, 0, why.nl, why.en, prompt), action: 'none' },
        nextState: {
          v: 1,
          kind: 'order_ops',
          expr: problem.expr,
          turn: 0,
          step: 'compute',
          prompt: step.promptPretty,
          expected: step.expected,
          nextExpr: step.nextExpr,
        },
      }
    }

    if (problem.kind === 'percent') {
      const p = Number(problem.a)
      const base = Number(problem.b)
      const { unitPct, divisor, multiplier } = percentPlan(p)
      const why = percentWhy(lang, unitPct, divisor)

      // For older learners: allow a compact single-step for integer percent.
      if (ageBand === 'student' && Number.isFinite(p) && Number.isFinite(base) && Math.abs(p % 1) < 1e-9) {
        const pInt = Number(p.toFixed(0))
        const prompt = lang === 'en' ? `Fill in: ${base} × ${pInt} ÷ 100 = __` : `Vul in: ${base} × ${pInt} ÷ 100 = __`
        return {
          handled: true,
          payload: { message: prompt, action: 'none' },
          nextState: {
            v: 1,
            kind: 'percent',
            p,
            base,
            turn: 0,
            step: 'unit',
            unitPct: 1,
            divisor: 100,
            multiplier: p,
          },
        }
      }

      const unitLabel = lang === 'en' ? `(${unitPct}% step)` : `(dat is ${unitPct}%)`
      const prompt =
        lang === 'en' ? `Fill in: ${base} ÷ ${divisor} = __ ${unitLabel}` : `Vul in: ${base} ÷ ${divisor} = __ ${unitLabel}`
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, 0, why.nl, why.en, prompt), action: 'none' },
        nextState: { v: 1, kind: 'percent', p, base, turn: 0, step: 'unit', unitPct, divisor, multiplier },
      }
    }

    if (problem.kind === 'frac') {
      const n = Math.trunc(problem.a)
      const d = Math.trunc(problem.b)
      const div = smallestCommonDivisor(n, d)
      if (!div) {
        const msg =
          lang === 'en'
            ? `Already simplified: ${n}/${d}. Correct.`
            : `Deze breuk is al vereenvoudigd: ${n}/${d}. Juist.`
        return { handled: true, payload: { message: msg, action: 'none' }, nextState: null }
      }
      const prompt = lang === 'en' ? `Fill in: ${n} ÷ ${div} = __` : `Vul in: ${n} ÷ ${div} = __`
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, 0, `We delen teller en noemer door ${div}.`, `We divide top and bottom by ${div}.`, prompt), action: 'none' },
        nextState: { v: 1, kind: 'frac', n, d, turn: 0, step: 'n_div', div },
      }
    }

    if (problem.kind === 'div') {
      const a = problem.a
      const b = problem.b
      const k0 = Math.floor(a / b)
      const startChunk = k0 >= 10 ? 10 : 1
      const prompt = lang === 'en' ? `Fill in: ${b}×${startChunk} = __` : `Vul in: ${b}×${startChunk} = __`
      return {
        handled: true,
        payload: {
          message: coachJunior(
            lang,
            ageBand,
            0,
            `Slim: we beginnen met ${startChunk} groepjes, dat rekent snel.`,
            `Smart: we start with ${startChunk} groups, that’s fast.`,
            prompt
          ),
          action: 'none',
        },
        nextState: { v: 1, kind: 'div', a, b, startChunk, onesAdded: 0, turn: 0, step: 'bx_start' },
      }
    }

    if (problem.kind === 'mul') {
      const bT = Math.trunc(problem.b / 10) * 10
      const bU = problem.b - bT
      const prompt =
        lang === 'en'
          ? `Fill in: ${problem.a}×${bT} = __`
          : `${problem.a}×${problem.b} = ${problem.a}×(${bT}+${bU}). Vul in: ${problem.a}×${bT} = __`
      return {
        handled: true,
        payload: {
          message: coachJunior(lang, ageBand, 0, `Top! Eerst de makkelijke tientallen.`, `Nice! Start with the easy tens.`, prompt),
          action: 'none',
        },
        nextState: { v: 1, kind: 'mul', a: problem.a, b: problem.b, turn: 0, step: 'ax_bT', bT, bU },
      }
    }

    if (problem.kind === 'add') {
      const a = problem.a
      const b = problem.b
      const aT = Math.trunc(a / 10) * 10
      const aU = a - aT
      const bT = Math.trunc(b / 10) * 10
      const bU = b - bT
      const tensSum = aT + bT
      const onesSum = aU + bU
      const prompt = (() => {
        if (ageBand === 'junior') {
          return lang === 'en'
            ? `Split: ${a} = ${aT} + ${aU}. Split: ${b} = ${bT} + ${bU}. Fill in: ${aT} + ${bT} = __`
            : `Splits: ${a} = ${aT} + ${aU}. Splits: ${b} = ${bT} + ${bU}. Vul in: ${aT} + ${bT} = __`
        }
        if (ageBand === 'student') return lang === 'en' ? `Fill in: ${aT} + ${bT} = __` : `Vul in: ${aT} + ${bT} = __`
        return lang === 'en'
          ? `Write: ${a} = ${aT} + ${aU} and ${b} = ${bT} + ${bU}. Fill in: ${aT} + ${bT} = __`
          : `Schrijf: ${a} = ${aT} + ${aU} en ${b} = ${bT} + ${bU}. Vul in: ${aT} + ${bT} = __`
      })()
      return {
        handled: true,
        payload: {
          message: coachJunior(lang, ageBand, 0, `Top—eerst de tientallen.`, `Nice—start with the tens.`, prompt),
          action: 'none',
        },
        nextState: { v: 1, kind: 'add', a, b, turn: 0, step: 'tens', aT, aU, bT, bU, tensSum, onesSum },
      }
    }

    if (problem.kind === 'sub') {
      const a = problem.a
      const b = problem.b
      const bT = Math.trunc(b / 10) * 10
      const bU = b - bT
      const remAfterTens = a - bT
      const prompt =
        ageBand === 'student'
          ? lang === 'en'
            ? `Fill in: ${a} − ${bT} = __`
            : `Vul in: ${a} − ${bT} = __`
          : lang === 'en'
            ? `Split: ${b} = ${bT} + ${bU}. Fill in: ${a} − ${bT} = __`
            : `Splits: ${b} = ${bT} + ${bU}. Vul in: ${a} − ${bT} = __`
      return {
        handled: true,
        payload: {
          message: coachJunior(lang, ageBand, 0, `Goed—eerst de tientallen eraf.`, `Good—subtract the tens first.`, prompt),
          action: 'none',
        },
        nextState: { v: 1, kind: 'sub', a, b, turn: 0, step: 'a_minus_bT', bT, bU, remAfterTens },
      }
    }
  }

  if (!state) return { handled: false }

  // Stop signals: clear deterministic state and close politely.
  if (isStopSignal(lastUser)) {
    return {
      handled: true,
      payload: { message: lang === 'en' ? `Okay—stopping here.` : `Oké—dan stoppen we hier.`, action: 'none' },
      nextState: null,
    }
  }

  // In an active canon flow: if the user sends ACK-only or "I'm stuck",
  // we repeat the current blank (no rewind).
  const canAnswer = isNumberLike(lastUser)
  const canHelp = isStuck(lastUser) || isAckOnly(lastUser)
  if (!canAnswer && !canHelp) return { handled: false }

  if (state.kind === 'frac') {
    const promptN = () => (lang === 'en' ? `Fill in: ${state.n} ÷ ${state.div} = __` : `Vul in: ${state.n} ÷ ${state.div} = __`)
    const promptD = () => (lang === 'en' ? `Fill in: ${state.d} ÷ ${state.div} = __` : `Vul in: ${state.d} ÷ ${state.div} = __`)

    if (!canAnswer) {
      const p = state.step === 'n_div' ? promptN() : promptD()
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, state.turn, `Pak deze stap.`, `Do this step.`, p, { forceTone: 'mid' }), action: 'none' },
        nextState: state,
      }
    }

    const userN = parseNum(lastUser)
    if (state.step === 'n_div') {
      const expected = state.n / state.div
      if (Math.abs(userN - expected) < 1e-9) {
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Mooi—nu de noemer.`, `Nice—now the bottom.`, promptD()), action: 'none' },
          nextState: { ...state, turn: state.turn + 1, step: 'd_div', n2: expected },
        }
      }
      return { handled: true, payload: { message: promptN(), action: 'none' }, nextState: state }
    }

    // d_div
    const expectedD = state.d / state.div
    if (Math.abs(userN - expectedD) < 1e-9) {
      const n2 = Number(state.n2)
      const d2 = expectedD
      const div2 = smallestCommonDivisor(n2, d2)
      if (div2) {
        const pre =
          ageBand === 'junior'
            ? lang === 'en'
              ? `New fraction: ${n2}/${d2}. `
              : `Nieuwe breuk: ${n2}/${d2}. `
            : ''
        const nextPrompt = lang === 'en' ? `${pre}Fill in: ${n2} ÷ ${div2} = __` : `${pre}Vul in: ${n2} ÷ ${div2} = __`
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Nog een keer delen.`, `Divide once more.`, nextPrompt), action: 'none' },
          nextState: { v: 1, kind: 'frac', n: n2, d: d2, turn: state.turn + 1, step: 'n_div', div: div2 },
        }
      }
      const msg =
        lang === 'en' ? `Correct. Simplified: ${n2}/${d2}.` : `Juist. Vereenvoudigd: ${n2}/${d2}.`
      return { handled: true, payload: { message: msg, action: 'none' }, nextState: null }
    }
    return { handled: true, payload: { message: promptD(), action: 'none' }, nextState: state }
  }

  if (state.kind === 'add') {
    const { a, b, aT, aU, bT, bU, tensSum, onesSum } = state

    const promptOf = (step: 'tens' | 'ones' | 'combine') => {
      if (step === 'tens') {
        if (ageBand === 'junior') {
          return lang === 'en'
            ? `Split: ${a} = ${aT} + ${aU}. Split: ${b} = ${bT} + ${bU}. Fill in: ${aT} + ${bT} = __`
            : `Splits: ${a} = ${aT} + ${aU}. Splits: ${b} = ${bT} + ${bU}. Vul in: ${aT} + ${bT} = __`
        }
        if (ageBand === 'student') return lang === 'en' ? `Fill in: ${aT} + ${bT} = __` : `Vul in: ${aT} + ${bT} = __`
        return lang === 'en'
          ? `Write: ${a} = ${aT} + ${aU} and ${b} = ${bT} + ${bU}. Fill in: ${aT} + ${bT} = __`
          : `Schrijf: ${a} = ${aT} + ${aU} en ${b} = ${bT} + ${bU}. Vul in: ${aT} + ${bT} = __`
      }
      if (step === 'ones') return lang === 'en' ? `Fill in: ${aU} + ${bU} = __` : `Vul in: ${aU} + ${bU} = __`
      return lang === 'en' ? `Fill in: ${tensSum} + ${onesSum} = __` : `Vul in: ${tensSum} + ${onesSum} = __`
    }

    if (!canAnswer) {
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, state.turn, `Pak deze stap.`, `Do this step.`, promptOf(state.step), { forceTone: 'mid' }), action: 'none' },
        nextState: state,
      }
    }

    const userN = parseNum(lastUser)
    if (state.step === 'tens') {
      if (Math.abs(userN - tensSum) < 1e-9) {
        const prompt = promptOf('ones')
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Mooi—nu de eenheden.`, `Nice—now the ones.`, prompt), action: 'none' },
          nextState: { ...state, turn: state.turn + 1, step: 'ones' },
        }
      }
      return { handled: true, payload: { message: promptOf('tens'), action: 'none' }, nextState: state }
    }
    if (state.step === 'ones') {
      if (Math.abs(userN - onesSum) < 1e-9) {
        const prompt = promptOf('combine')
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Nu tel je ze samen.`, `Now combine them.`, prompt), action: 'none' },
          nextState: { ...state, turn: state.turn + 1, step: 'combine' },
        }
      }
      return { handled: true, payload: { message: promptOf('ones'), action: 'none' }, nextState: state }
    }
    // combine
    if (Math.abs(userN - (a + b)) < 1e-9) return { handled: true, payload: { message: lang === 'en' ? `Correct.` : `Juist.`, action: 'none' }, nextState: null }
    return { handled: true, payload: { message: promptOf('combine'), action: 'none' }, nextState: state }
  }

  if (state.kind === 'sub') {
    const { a, b, bT, bU, remAfterTens } = state
    const promptOf = (step: 'a_minus_bT' | 'rem_minus_bU') => {
      if (step === 'a_minus_bT') {
        return ageBand === 'student'
          ? lang === 'en'
            ? `Fill in: ${a} − ${bT} = __`
            : `Vul in: ${a} − ${bT} = __`
          : lang === 'en'
            ? `Split: ${b} = ${bT} + ${bU}. Fill in: ${a} − ${bT} = __`
            : `Splits: ${b} = ${bT} + ${bU}. Vul in: ${a} − ${bT} = __`
      }
      return lang === 'en' ? `Fill in: ${remAfterTens} − ${bU} = __` : `Vul in: ${remAfterTens} − ${bU} = __`
    }

    if (!canAnswer) {
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, state.turn, `Alleen deze stap.`, `Just this step.`, promptOf(state.step), { forceTone: 'mid' }), action: 'none' },
        nextState: state,
      }
    }

    const userN = parseNum(lastUser)
    if (state.step === 'a_minus_bT') {
      if (Math.abs(userN - remAfterTens) < 1e-9) {
        const prompt = promptOf('rem_minus_bU')
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Goed—nu haal je de eenheden eraf.`, `Good—now subtract the ones.`, prompt), action: 'none' },
          nextState: { ...state, turn: state.turn + 1, step: 'rem_minus_bU' },
        }
      }
      return { handled: true, payload: { message: promptOf('a_minus_bT'), action: 'none' }, nextState: state }
    }

    const ans = a - b
    if (Math.abs(userN - ans) < 1e-9) return { handled: true, payload: { message: lang === 'en' ? `Correct.` : `Juist.`, action: 'none' }, nextState: null }
    return { handled: true, payload: { message: promptOf('rem_minus_bU'), action: 'none' }, nextState: state }
  }

  if (state.kind === 'div') {
    const { a, b } = state
    const startChunk = state.startChunk || 10
    const qStart = b * startChunk
    const q1 = b * 1

    if (state.step === 'bx_start') {
      if (isStuck(lastUser)) {
        const prompt = lang === 'en' ? `Fill in: ${b}×${startChunk} = __` : `Vul in: ${b}×${startChunk} = __`
        return {
          handled: true,
          payload: {
            message: coachJunior(lang, ageBand, state.turn, `Geen stress—pak gewoon deze stap.`, `No stress—just do this step.`, prompt, { forceTone: 'mid' }),
            action: 'none',
          },
          nextState: state,
        }
      }
      const userN = parseNum(lastUser)
      if (Math.abs(userN - qStart) < 1e-9) {
        const prompt = lang === 'en' ? `Fill in: ${a} − ${qStart} = __` : `Vul in: ${a} − ${qStart} = __`
        return {
          handled: true,
          payload: {
            message: coachJunior(
              lang,
              ageBand,
              state.turn,
              `Top! Nu kijken we wat er overblijft.`,
              `Great! Now see what’s left.`,
              prompt
            ),
            action: 'none',
          },
          nextState: { ...state, turn: state.turn + 1, step: 'a_minus_used', used: qStart },
        }
      }
      return {
        handled: true,
        payload: {
          message: coachJunior(
            lang,
            ageBand,
            state.turn,
            `We maken groepjes van ${b}.`,
            `We make groups of ${b}.`,
            lang === 'en' ? `Fill in: ${b}×${startChunk} = __` : `Vul in: ${b}×${startChunk} = __`
          ),
          action: 'none',
        },
        nextState: state,
      }
    }

    if (state.step === 'a_minus_used') {
      const used = state.used ?? qStart
      const userN = parseNum(lastUser)
      const rem = a - used
      if (Math.abs(userN - rem) < 1e-9) {
        if (rem >= b) {
          const prompt = lang === 'en' ? `Fill in: ${b}×1 = __` : `Vul in: ${b}×1 = __`
          return {
            handled: true,
            payload: {
              message: coachJunior(lang, ageBand, state.turn, `Past er nog 1 groepje bij?`, `Does 1 more group fit?`, prompt),
              action: 'none',
            },
            nextState: { ...state, turn: state.turn + 1, step: 'bx1', rem },
          }
        }
        const q = Math.floor((a - rem) / b)
        const label =
          ageBand === 'junior' ? (lang === 'en' ? ' (how many?)' : ' (hoe vaak?)') : lang === 'en' ? ' (quotient)' : ' (quotiënt)'
        return {
          handled: true,
          payload: {
            message: coachJunior(
              lang,
              ageBand,
              state.turn,
              `Tel de groepjes bij elkaar.`,
              `Add the groups together.`,
              lang === 'en'
                ? `Fill in: ${startChunk} + ${q - startChunk} = __${label}`
                : `Vul in: ${startChunk} + ${q - startChunk} = __${label}`
            ),
            action: 'none',
          },
          nextState: { ...state, turn: state.turn + 1, step: 'q_sum', rem, onesAdded: Math.max(0, q - startChunk) },
        }
      }
      return {
        handled: true,
        payload: {
          message: coachJunior(
            lang,
            ageBand,
            state.turn,
            `Wat blijft er over?`,
            `What is left?`,
            lang === 'en' ? `Fill in: ${a} − ${used} = __` : `Vul in: ${a} − ${used} = __`
          ),
          action: 'none',
        },
        nextState: state,
      }
    }

    if (state.step === 'bx1') {
      if (isStuck(lastUser)) {
        const prompt = lang === 'en' ? `Fill in: ${b}×1 = __` : `Vul in: ${b}×1 = __`
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Pak deze stap.`, `Do this step.`, prompt, { forceTone: 'mid' }), action: 'none' },
          nextState: state,
        }
      }
      const userN = parseNum(lastUser)
      if (Math.abs(userN - q1) < 1e-9) {
        const rem = state.rem ?? a - qStart
        const prompt = lang === 'en' ? `Fill in: ${rem} − ${b} = __` : `Vul in: ${rem} − ${b} = __`
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Haal nog ${b} weg.`, `Subtract ${b} once.`, prompt), action: 'none' },
          nextState: { ...state, turn: state.turn + 1, step: 'rem_minus_b' },
        }
      }
      return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${b}×1 = __` : `Vul in: ${b}×1 = __`, action: 'none' }, nextState: state }
    }

    if (state.step === 'rem_minus_b') {
      const rem0 = state.rem ?? a - qStart
      const userN = parseNum(lastUser)
      const rem = rem0 - b
      if (Math.abs(userN - rem) < 1e-9) {
        const onesAdded = (state.onesAdded || 0) + 1
        const q = startChunk + onesAdded
        const label =
          ageBand === 'junior' ? (lang === 'en' ? ' (how many?)' : ' (hoe vaak?)') : lang === 'en' ? ' (quotient)' : ' (quotiënt)'
        const prompt =
          lang === 'en'
            ? `Fill in: ${startChunk} + ${q - startChunk} = __${label}`
            : `Vul in: ${startChunk} + ${q - startChunk} = __${label}`
        return {
          handled: true,
          payload: {
            message: coachJunior(lang, ageBand, state.turn, `Tel de groepjes bij elkaar.`, `Add the groups together.`, prompt),
            action: 'none',
          },
          nextState: { ...state, turn: state.turn + 1, step: 'q_sum', rem, onesAdded },
        }
      }
      return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${rem0} − ${b} = __` : `Vul in: ${rem0} − ${b} = __`, action: 'none' }, nextState: state }
    }

    if (state.step === 'q_sum') {
      const userN = parseNum(lastUser)
      const rem = state.rem ?? 0
      const q = Math.floor((a - rem) / b)
      if (Math.abs(userN - q) < 1e-9) {
        if (ageBand === 'junior') {
          const prompt =
            lang === 'en' ? `Fill in: ${a} ÷ ${b} = __ (remainder ${rem})` : `Vul in: ${a} ÷ ${b} = __ (rest ${rem})`
          return {
            handled: true,
            payload: {
              message: coachJunior(
                lang,
                ageBand,
                state.turn,
                `Schrijf nu het antwoord op (rest = wat overblijft).`,
                `Now write the answer (remainder = what’s left).`,
                prompt
              ),
              action: 'none',
            },
            nextState: { ...state, turn: state.turn + 1, step: 'final' },
          }
        }
        return {
          handled: true,
          payload: {
            message:
              lang === 'en'
                ? `Correct. Quotient: **${q}**, remainder: **${rem}**. Check: ${b}×${q}+${rem}=${a}.`
                : `Juist. Quotiënt: **${q}**, rest: **${rem}**. Check: ${b}×${q}+${rem}=${a}.`,
            action: 'none',
          },
          nextState: null,
        }
      }
      // re-ask
      const label =
        ageBand === 'junior' ? (lang === 'en' ? ' (how many?)' : ' (hoe vaak?)') : lang === 'en' ? ' (quotient)' : ' (quotiënt)'
      return {
        handled: true,
        payload: {
          message:
            lang === 'en'
              ? `Fill in: ${startChunk} + ${q - startChunk} = __${label}`
              : `Vul in: ${startChunk} + ${q - startChunk} = __${label}`,
          action: 'none',
        },
        nextState: state,
      }
    }

    if (state.step === 'final') {
      const userN = parseNum(lastUser)
      const rem = state.rem ?? 0
      const q = Math.floor((a - rem) / b)
      if (Math.abs(userN - q) < 1e-9) {
        return { handled: true, payload: { message: lang === 'en' ? `Correct: ${q} remainder ${rem}.` : `Juist: ${q} rest ${rem}.`, action: 'none' }, nextState: null }
      }
      return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${a} ÷ ${b} = __ (remainder ${rem})` : `Vul in: ${a} ÷ ${b} = __ (rest ${rem})`, action: 'none' }, nextState: state }
    }
  }

  if (state.kind === 'mul') {
    const { a, b } = state
    const bT = state.bT ?? Math.trunc(b / 10) * 10
    const bU = state.bU ?? b - bT
    const axbT = a * bT
    const axbU = a * bU

    if (state.step === 'ax_bT') {
      if (isStuck(lastUser)) return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${a}×${bT} = __` : `Vul in: ${a}×${bT} = __`, action: 'none' }, nextState: state }
      const userN = parseNum(lastUser)
      if (Math.abs(userN - axbT) < 1e-9) {
        const prompt = lang === 'en' ? `Fill in: ${a}×${bU} = __` : `Vul in: ${a}×${bU} = __`
        return {
          handled: true,
          payload: {
            message: coachJunior(lang, ageBand, state.turn, `Top—nu de losse ${bU}.`, `Great—now the ${bU}.`, prompt),
            action: 'none',
          },
          nextState: { ...state, turn: state.turn + 1, step: 'ax_bU', axbT },
        }
      }
      return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${a}×${bT} = __` : `Vul in: ${a}×${bT} = __`, action: 'none' }, nextState: state }
    }

    if (state.step === 'ax_bU') {
      if (isStuck(lastUser)) {
        if (ageBand !== 'junior') {
          return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${a}×${bU} = __` : `Vul in: ${a}×${bU} = __`, action: 'none' }, nextState: state }
        }

        const aT = Math.trunc(a / 10) * 10
        const aU = a - aT
        const prompt = lang === 'en' ? `Fill in: ${aT}×${bU} = __` : `Splits: ${a} = ${aT} + ${aU}. Vul in: ${aT}×${bU} = __`
        return {
          handled: true,
          payload: {
            message: coachJunior(lang, ageBand, state.turn, `We doen ’m samen in stukjes.`, `Let’s do it in small pieces.`, prompt, { forceTone: 'mid' }),
            action: 'none',
          },
          nextState: { ...state, turn: state.turn + 1, step: 'ax_bU_micro_aT', aT, aU },
        }
      }
      const userN = parseNum(lastUser)
      if (Math.abs(userN - axbU) < 1e-9) {
        const axbT2 = (state as any).axbT ?? axbT
        const prompt = lang === 'en' ? `Fill in: ${axbT2} + ${axbU} = __` : `Vul in: ${axbT2} + ${axbU} = __`
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Nu tel je ze bij elkaar op.`, `Now add them together.`, prompt), action: 'none' },
          nextState: { ...state, turn: state.turn + 1, step: 'sum', axbT: axbT2, axbU },
        }
      }
      return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${a}×${bU} = __` : `Vul in: ${a}×${bU} = __`, action: 'none' }, nextState: state }
    }

    if (state.step === 'ax_bU_micro_aT') {
      const aT = state.aT ?? Math.trunc(a / 10) * 10
      const aU = state.aU ?? a - aT
      const expect = aT * bU
      if (isStuck(lastUser)) {
        const prompt = lang === 'en' ? `Fill in: ${aT}×${bU} = __` : `Vul in: ${aT}×${bU} = __`
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Pak deze kleine stap.`, `Do this small step.`, prompt, { forceTone: 'mid' }), action: 'none' },
          nextState: state,
        }
      }
      const userN = parseNum(lastUser)
      if (Math.abs(userN - expect) < 1e-9) {
        const prompt = lang === 'en' ? `Fill in: ${aU}×${bU} = __` : `Vul in: ${aU}×${bU} = __`
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Mooi—nu het laatste stukje.`, `Nice—now the last piece.`, prompt), action: 'none' },
          nextState: { ...state, turn: state.turn + 1, step: 'ax_bU_micro_aU', aT, aU, aTxbU: expect },
        }
      }
      return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${aT}×${bU} = __` : `Vul in: ${aT}×${bU} = __`, action: 'none' }, nextState: state }
    }

    if (state.step === 'ax_bU_micro_aU') {
      const aT = state.aT ?? Math.trunc(a / 10) * 10
      const aU = state.aU ?? a - aT
      const expect = aU * bU
      if (isStuck(lastUser)) {
        const prompt = lang === 'en' ? `Fill in: ${aU}×${bU} = __` : `Vul in: ${aU}×${bU} = __`
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Alleen deze nog.`, `Just this one.`, prompt, { forceTone: 'mid' }), action: 'none' },
          nextState: state,
        }
      }
      const userN = parseNum(lastUser)
      if (Math.abs(userN - expect) < 1e-9) {
        const x = state.aTxbU ?? aT * bU
        const prompt = lang === 'en' ? `Fill in: ${x} + ${expect} = __` : `Vul in: ${x} + ${expect} = __`
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Tel de stukjes op.`, `Add the pieces.`, prompt), action: 'none' },
          nextState: { ...state, turn: state.turn + 1, step: 'ax_bU_micro_sum', aT, aU, aUxbU: expect },
        }
      }
      return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${aU}×${bU} = __` : `Vul in: ${aU}×${bU} = __`, action: 'none' }, nextState: state }
    }

    if (state.step === 'ax_bU_micro_sum') {
      const x = state.aTxbU ?? (state.aT ?? Math.trunc(a / 10) * 10) * bU
      const y = state.aUxbU ?? (state.aU ?? a - (state.aT ?? Math.trunc(a / 10) * 10)) * bU
      const expect = x + y
      const userN = parseNum(lastUser)
      if (Math.abs(userN - expect) < 1e-9) {
        const axbT2 = state.axbT ?? axbT
        const prompt = lang === 'en' ? `Fill in: ${axbT2} + ${expect} = __` : `Vul in: ${axbT2} + ${expect} = __`
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Yes—nu de twee grote stukken samen.`, `Yes—now combine the two big parts.`, prompt), action: 'none' },
          nextState: { ...state, turn: state.turn + 1, step: 'sum', axbT: axbT2, axbU: expect },
        }
      }
      const prompt = lang === 'en' ? `Fill in: ${x} + ${y} = __` : `Vul in: ${x} + ${y} = __`
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, state.turn, `Tel op.`, `Add.`, prompt), action: 'none' },
        nextState: state,
      }
    }

    if (state.step === 'sum') {
      const userN = parseNum(lastUser)
      if (Math.abs(userN - a * b) < 1e-9) {
        return { handled: true, payload: { message: lang === 'en' ? `Correct.` : `Juist.`, action: 'none' }, nextState: null }
      }
      const x = (state as any).axbT ?? axbT
      const y = (state as any).axbU ?? axbU
      const prompt = lang === 'en' ? `Fill in: ${x} + ${y} = __` : `Vul in: ${x} + ${y} = __`
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, state.turn, `Laatste stap: tel op.`, `Last step: add.`, prompt), action: 'none' },
        nextState: state,
      }
    }
  }

  if (state.kind === 'percent') {
    const p = state.p
    const base = state.base
    const { unitPct, divisor, multiplier } = state

    const promptUnit = () => {
      const unitLabel = lang === 'en' ? `(${unitPct}% step)` : `(dat is ${unitPct}%)`
      return lang === 'en' ? `Fill in: ${base} ÷ ${divisor} = __ ${unitLabel}` : `Vul in: ${base} ÷ ${divisor} = __ ${unitLabel}`
    }
    const promptScale = (unitValue: number) => {
      const pLabel = lang === 'en' ? `(${p}% )` : `(dat is ${p}%)`
      return lang === 'en'
        ? `Fill in: ${unitValue} × ${multiplier} = __ ${pLabel}`
        : `Vul in: ${unitValue} × ${multiplier} = __ ${pLabel}`
    }

    if (!canAnswer) {
      const pmt = state.step === 'unit' ? promptUnit() : promptScale(Number(state.unitValue))
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, state.turn, `Pak deze stap.`, `Do this step.`, pmt, { forceTone: 'mid' }), action: 'none' },
        nextState: state,
      }
    }

    const userN = parseNum(lastUser)
    if (state.step === 'unit') {
      // Student compact path: unitPct=1, divisor=100, multiplier=p, but prompt may have been "base×p÷100".
      // We accept the final answer directly if multiplier != 1 and unitPct==1 (compact branch), otherwise we do the unit step.
      if (ageBand === 'student' && state.unitPct === 1 && state.divisor === 100 && Math.abs(p % 1) < 1e-9) {
        const expected = (base * p) / 100
        if (Math.abs(userN - expected) < 1e-9) {
          const msg = lang === 'en' ? `Correct.` : `Juist.`
          return { handled: true, payload: { message: msg, action: 'none' }, nextState: null }
        }
        const pInt = Number(p.toFixed(0))
        const prompt = lang === 'en' ? `Fill in: ${base} × ${pInt} ÷ 100 = __` : `Vul in: ${base} × ${pInt} ÷ 100 = __`
        return { handled: true, payload: { message: prompt, action: 'none' }, nextState: state }
      }

      const expectedUnit = base / divisor
      if (Math.abs(userN - expectedUnit) < 1e-9) {
        if (Math.abs(multiplier - 1) < 1e-9) {
          const msg =
            lang === 'en'
              ? `Correct: ${p}% of ${base} = ${userN}.`
              : `Juist: ${p}% van ${base} = ${userN}.`
          return { handled: true, payload: { message: msg, action: 'none' }, nextState: null }
        }
        const prompt = promptScale(userN)
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Mooi—nu vermenigvuldigen.`, `Nice—now multiply.`, prompt), action: 'none' },
          nextState: { ...state, turn: state.turn + 1, step: 'scale', unitValue: userN },
        }
      }
      return { handled: true, payload: { message: promptUnit(), action: 'none' }, nextState: state }
    }

    // scale
    const unitValue = Number(state.unitValue)
    const expected = unitValue * multiplier
    if (Math.abs(userN - expected) < 1e-9) {
      const msg = lang === 'en' ? `Correct: ${p}% of ${base} = ${userN}.` : `Juist: ${p}% van ${base} = ${userN}.`
      return { handled: true, payload: { message: msg, action: 'none' }, nextState: null }
    }
    return { handled: true, payload: { message: promptScale(unitValue), action: 'none' }, nextState: state }
  }

  if (state.kind === 'order_ops') {
    const prompt = () => (lang === 'en' ? `Fill in: ${state.prompt} = __` : `Vul in: ${state.prompt} = __`)

    if (!canAnswer) {
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, state.turn, `Pak deze stap.`, `Do this step.`, prompt(), { forceTone: 'mid' }), action: 'none' },
        nextState: state,
      }
    }

    const userN = parseNum(lastUser)
    if (Math.abs(userN - state.expected) < 1e-9) {
      const next = state.nextExpr
      const toks = tokenizeExpr(next)
      if (toks && toks.length === 1 && toks[0].t === 'num') {
        const msg = lang === 'en' ? `Correct.` : `Juist.`
        return { handled: true, payload: { message: msg, action: 'none' }, nextState: null }
      }
      const step2 = nextOrderOpsStep(next)
      if (!step2) return { handled: false }
      const nextPrompt = lang === 'en' ? `Fill in: ${step2.promptPretty} = __` : `Vul in: ${step2.promptPretty} = __`
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, state.turn, `Mooi—volgende stap.`, `Nice—next step.`, nextPrompt), action: 'none' },
        nextState: {
          v: 1,
          kind: 'order_ops',
          expr: next,
          turn: state.turn + 1,
          step: 'compute',
          prompt: step2.promptPretty,
          expected: step2.expected,
          nextExpr: step2.nextExpr,
        },
      }
    }

    return { handled: true, payload: { message: prompt(), action: 'none' }, nextState: state }
  }

  if (state.kind === 'negatives') {
    if (state.step === 'rewrite') {
      const prompt = () => String(state.rewritePrompt || '')
      const expected = Number(state.rewriteExpected)
      const nextExpr = String(state.rewriteNextExpr || '')
      if (!canAnswer) {
        // Teen/junior: add a tiny rule-hint when the student is stuck/ACKs.
        const hint = ageBand === 'student' ? '' : negativesStuckHint(lang, state.expr)
        return {
          handled: true,
          payload: {
            message: coachJunior(lang, ageBand, state.turn, hint, hint, prompt(), { forceTone: 'mid' }),
            action: 'none',
          },
          nextState: state,
        }
      }
      const userN = parseNum(lastUser)
      if (Number.isFinite(expected) && Math.abs(userN - expected) < 1e-9 && nextExpr) {
        const step = nextOrderOpsStep(nextExpr)
        if (!step) return { handled: false }
        const pmt = lang === 'en' ? `Fill in: ${step.promptPretty} = __` : `Vul in: ${step.promptPretty} = __`
        return {
          handled: true,
          payload: { message: coachJunior(lang, ageBand, state.turn, `Yes—nu rekenen.`, `Yes—now compute.`, pmt), action: 'none' },
          nextState: {
            v: 1,
            kind: 'negatives',
            expr: nextExpr,
            turn: state.turn + 1,
            step: 'compute',
            prompt: step.promptPretty,
            expected: step.expected,
            nextExpr: step.nextExpr,
          },
        }
      }
      return { handled: true, payload: { message: prompt(), action: 'none' }, nextState: state }
    }

    // compute
    const prompt = () => (lang === 'en' ? `Fill in: ${state.prompt} = __` : `Vul in: ${state.prompt} = __`)
    if (!canAnswer) {
      const hint = ageBand === 'student' ? '' : negativesStuckHint(lang, state.expr)
      return {
        handled: true,
        payload: {
          message: coachJunior(lang, ageBand, state.turn, hint, hint, prompt(), { forceTone: 'mid' }),
          action: 'none',
        },
        nextState: state,
      }
    }
    const expected = Number(state.expected)
    const userN = parseNum(lastUser)
    if (Number.isFinite(expected) && Math.abs(userN - expected) < 1e-9) {
      const next = String(state.nextExpr || '')
      const toks = tokenizeExpr(next)
      if (toks && toks.length === 1 && toks[0].t === 'num') {
        return { handled: true, payload: { message: lang === 'en' ? `Correct.` : `Juist.`, action: 'none' }, nextState: null }
      }
      const step2 = nextOrderOpsStep(next)
      if (!step2) return { handled: false }
      const nextPrompt = lang === 'en' ? `Fill in: ${step2.promptPretty} = __` : `Vul in: ${step2.promptPretty} = __`
      return {
        handled: true,
        payload: { message: coachJunior(lang, ageBand, state.turn, `Mooi—volgende stap.`, `Nice—next step.`, nextPrompt), action: 'none' },
        nextState: {
          v: 1,
          kind: 'negatives',
          expr: next,
          turn: state.turn + 1,
          step: 'compute',
          prompt: step2.promptPretty,
          expected: step2.expected,
          nextExpr: step2.nextExpr,
        },
      }
    }
    return { handled: true, payload: { message: prompt(), action: 'none' }, nextState: state }
  }

  return { handled: false }
}

