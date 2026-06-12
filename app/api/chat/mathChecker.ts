// ====================================================================
// DUNNE REKEN-VANGRAIL
//
// Dit bestand vervangt de duizenden regels canon-state-machines.
// De LLM begeleidt het oefenen (sokratisch, met het leerprofiel);
// de server garandeert alleen wat een server kán garanderen:
//
//   1. evalArithExpr      — veilige rekenmachine (shunting-yard, geen eval)
//   2. looksLikeMathProblem — is dit een kale, intypbare som?
//   3. checkBlankAnswer   — leerling beantwoordt "EXPR = __" → exact verdict
//   4. skillOf            — grove skill-classificatie voor het leerprofiel
// ====================================================================

const strip = (s: unknown) => String(s ?? '').trim()

const parseNum = (s: string): number => {
  const n = Number(strip(s).replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

// ---------------------------------------------------------------
// 1. Rekenmachine
// ---------------------------------------------------------------

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
      // Unair minteken hoort bij het getal (begin, na operator of na '(').
      if (prevIsOpOrLp()) {
        let j = i + 1
        while (j < s.length && /[0-9.,]/.test(s[j])) j++
        if (!pushNum(s.slice(i, j))) return null
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
      if (!pushNum(s.slice(i, j))) return null
      i = j
      continue
    }
    return null
  }
  return toks
}

const applyOp = (a: number, op: '+' | '-' | '*' | '/', b: number): number =>
  op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b

export function evalArithExpr(expr: string): number | null {
  const norm = String(expr || '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/(\d)\s*:\s*(\d)/g, '$1/$2')
    .replace(/[\u2212\u2013\u2014]/g, '-')
  const toks = tokenizeExpr(norm)
  if (!toks || !toks.length) return null

  const prec = (op: string) => (op === '*' || op === '/' ? 2 : 1)
  const output: Tok[] = []
  const stackOps: Tok[] = []
  for (const t of toks) {
    if (t.t === 'num') output.push(t)
    else if (t.t === 'op') {
      while (stackOps.length) {
        const top = stackOps[stackOps.length - 1]
        if (top.t === 'op' && prec(top.op) >= prec(t.op)) output.push(stackOps.pop() as Tok)
        else break
      }
      stackOps.push(t)
    } else if (t.t === 'lp') stackOps.push(t)
    else if (t.t === 'rp') {
      while (stackOps.length && stackOps[stackOps.length - 1].t !== 'lp') output.push(stackOps.pop() as Tok)
      if (stackOps.length) stackOps.pop()
    }
  }
  while (stackOps.length) output.push(stackOps.pop() as Tok)

  const valStack: number[] = []
  for (const t of output) {
    if (t.t === 'num') valStack.push(t.n)
    else if (t.t === 'op') {
      const b = valStack.pop()
      const a = valStack.pop()
      if (a === undefined || b === undefined) return null
      valStack.push(applyOp(a, t.op, b))
    }
  }
  return valStack.length === 1 && Number.isFinite(valStack[0]) ? valStack[0] : null
}

// ---------------------------------------------------------------
// 2. Somdetectie
// ---------------------------------------------------------------

// Is dit een kale, intypbare som? Gebruikt door de uitleg-gates (een som
// hoort bij oefenen, niet bij uitleg) en de practicePrompt-validatie.
export function looksLikeMathProblem(text: string): boolean {
  const t = strip(text)
  if (!t) return false
  // Twee getallen met een operator ertussen: "84 ÷ 3", "1/2 + 1/4", "12x12".
  if (/\d\s*[+\-*/×÷:x]\s*\d/i.test(t)) return true
  // Procent-van: "25% van 60", "what is 25% of 80".
  if (/\d+(?:[.,]\d+)?\s*%\s*(van|of)\s+\d/i.test(t)) return true
  // Mini-algebra: "x + 8 = 23" of "__ − 7 = 15".
  if (/(?:__|\bx\b)\s*[+\-−–]\s*\d+(?:[.,]\d+)?\s*=\s*\d/i.test(t)) return true
  return false
}

// ---------------------------------------------------------------
// 3. Blank-check (de eigenlijke vangrail tijdens het oefenen)
// ---------------------------------------------------------------

export type BlankCheck = {
  expr: string
  expected: number
  given: number
  correct: boolean
}

// De vorige assistent-beurt vroeg "EXPR = __" en de leerling antwoordt met
// een kaal getal: dan rekent de server het exact na. Alles wat hier geen
// verdict oplevert (woorden, breuk-antwoorden, geen blank) laat de LLM
// zelf beoordelen.
export function checkBlankAnswer(prevAssistantText: string, userText: string): BlankCheck | null {
  const user = strip(userText)
  if (!/^-?\d+(?:[.,]\d+)?$/.test(user)) return null
  const given = parseNum(user)
  if (!Number.isFinite(given)) return null

  // Laatste "EXPR = __" in de vorige beurt (markdown-vet en eenheden eromheen
  // mogen). Bewust géén ':' in de klasse: "Stap 3: 84 − 70 = __" moet de som
  // pakken, niet het stapnummer. Deling met ':' vangt het tweede patroon.
  const prev = String(prevAssistantText || '')
  const patterns = [
    /(-?\d[\d\s.,+\-*/×÷()−–]*?)\s*=\s*_{1,}/g,
    /(\d+(?:[.,]\d+)?\s*:\s*\d+(?:[.,]\d+)?)\s*=\s*_{1,}/g,
  ]
  let lastExpr: string | null = null
  let lastIdx = -1
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(prev))) {
      const cand = m[1]
      // Zonder operator is het geen som ("antwoord = __"): geen verdict.
      if (!/[+\-*/×÷:−–]/.test(cand.replace(/^-/, ''))) continue
      if (m.index > lastIdx) {
        lastIdx = m.index
        lastExpr = cand
      }
    }
  }
  if (!lastExpr) return null

  const expected = evalArithExpr(lastExpr)
  if (expected === null) return null

  let correct = Math.abs(expected - given) < 1e-9
  // Staartdeling-conventie: "7 ÷ 3 = __" mag met het quotiënt (2) beantwoord
  // worden — daar vraagt de stap in die context om.
  if (!correct) {
    const div = lastExpr.match(/^\s*(\d+)\s*[÷/:]\s*(\d+)\s*$/)
    if (div) {
      const a = Number(div[1])
      const b = Number(div[2])
      if (b > 0 && Number.isInteger(given) && given === Math.floor(a / b)) correct = true
    }
  }

  return { expr: strip(lastExpr).replace(/\s+/g, ' '), expected, given, correct }
}

// ---------------------------------------------------------------
// 4. Skill-classificatie (voedt het leerprofiel)
// ---------------------------------------------------------------

// Grove indeling van een som of oefenstap. Sleutels sluiten aan op de
// labels in learnerProfile.ts (KIND_LABELS).
export function skillOf(text: string): string | null {
  const t = strip(text).toLowerCase()
  if (!t) return null
  if (/\d\s*%|procent|percent|korting/.test(t)) return 'percent'
  if (/breuk|fraction|\d\s*\/\s*\d\s*[+\-]|\b[+\-]\s*\d\s*\/\s*\d/.test(t)) return 'frac_addsub'
  if (/staartdeling|gedeeld door|\d\s*[÷:]\s*\d|\d\s*\/\s*\d/.test(t)) return 'div'
  if (/\d\s*[×x*]\s*\d|keer som|vermenigvuldig/.test(t)) return 'mul'
  if (/\d\s*\+\s*\d|optel/.test(t)) return 'add'
  if (/\d\s*[-−–]\s*\d|aftrek/.test(t)) return 'sub'
  if (/(?:__|\bx\b)\s*[+\-−–]\s*\d+\s*=/.test(t)) return 'unknown'
  return null
}
