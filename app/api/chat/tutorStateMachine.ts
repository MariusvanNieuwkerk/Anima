export type TutorSMKind = 'div' | 'mul'

export type TutorSMState =
  | {
      v: 1
      kind: 'div'
      a: number
      b: number
      startChunk: number
      onesAdded: number
      step: 'bx_start' | 'a_minus_used' | 'bx1' | 'rem_minus_b' | 'q_sum' | 'final'
      used?: number
      rem?: number
    }
  | { v: 1; kind: 'mul'; a: number; b: number; step: 'ax_bT' | 'ax_bU' | 'sum' | 'done'; bT?: number; bU?: number; axbT?: number; axbU?: number }

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

function parseProblem(text: string): { kind: TutorSMKind; a: number; b: number } | null {
  const t = normalizeMathText(text)
  // Division: "184/16" or "wat is 184/16" or "los op: 184/16"
  const div = t.match(/(?:wat\s+is|what\s+is|los\s+op|bereken)?\s*[: ]*\s*(\d+)\s*\/\s*(\d+)/i)
  if (div) return { kind: 'div', a: Number(div[1]), b: Number(div[2]) }
  // Multiplication: "23*14" or "23×14"
  const mul = t.match(/(?:wat\s+is|what\s+is|los\s+op|bereken)?\s*[: ]*\s*(\d+)\s*[*x]\s*(\d+)/i)
  if (mul) return { kind: 'mul', a: Number(mul[1]), b: Number(mul[2]) }
  return null
}

export function runTutorStateMachine(input: TutorSMInput): TutorSMOutput {
  const lang = String(input.userLanguage || 'nl')
  const ageBand = ageBandOf(input.userAge)
  const lastUser = strip(input.lastUserText)

  const problem = parseProblem(lastUser)
  const state = input.state

  // Start or restart when user provides a fresh problem statement.
  if (problem) {
    if (!state || state.kind !== problem.kind || (state as any).a !== problem.a || (state as any).b !== problem.b) {
      if (problem.kind === 'div') {
        const a = problem.a
        const b = problem.b
        const k0 = Math.floor(a / b)
        const startChunk = k0 >= 10 ? 10 : 1
        return {
          handled: true,
          payload: {
            message: lang === 'en' ? `Fill in: ${b}×${startChunk} = __` : `Vul in: ${b}×${startChunk} = __`,
            action: 'none',
          },
          nextState: { v: 1, kind: 'div', a, b, startChunk, onesAdded: 0, step: 'bx_start' },
        }
      }
      if (problem.kind === 'mul') {
        const bT = Math.trunc(problem.b / 10) * 10
        const bU = problem.b - bT
        return {
          handled: true,
          payload: {
            message:
              lang === 'en'
                ? `Fill in: ${problem.a}×${bT} = __`
                : `${problem.a}×${problem.b} = ${problem.a}×(${bT}+${bU}). Vul in: ${problem.a}×${bT} = __`,
            action: 'none',
          },
          nextState: { v: 1, kind: 'mul', a: problem.a, b: problem.b, step: 'ax_bT', bT, bU },
        }
      }
    }
  }

  if (!state) return { handled: false }

  // If user isn't answering a blank and isn't stuck, let other systems handle it.
  if (!isNumberLike(lastUser) && !isStuck(lastUser)) return { handled: false }

  if (state.kind === 'div') {
    const { a, b } = state
    const startChunk = state.startChunk || 10
    const qStart = b * startChunk
    const q1 = b * 1

    if (state.step === 'bx_start') {
      if (isStuck(lastUser)) {
        return {
          handled: true,
          payload: { message: lang === 'en' ? `Fill in: ${b}×${startChunk} = __` : `Vul in: ${b}×${startChunk} = __`, action: 'none' },
          nextState: state,
        }
      }
      const userN = parseNum(lastUser)
      if (Math.abs(userN - qStart) < 1e-9) {
        return {
          handled: true,
          payload: {
            message: lang === 'en' ? `Fill in: ${a} − ${qStart} = __` : `Vul in: ${a} − ${qStart} = __`,
            action: 'none',
          },
          nextState: { ...state, step: 'a_minus_used', used: qStart },
        }
      }
      return {
        handled: true,
        payload: { message: lang === 'en' ? `Fill in: ${b}×${startChunk} = __` : `Vul in: ${b}×${startChunk} = __`, action: 'none' },
        nextState: state,
      }
    }

    if (state.step === 'a_minus_used') {
      const used = state.used ?? qStart
      const userN = parseNum(lastUser)
      const rem = a - used
      if (Math.abs(userN - rem) < 1e-9) {
        if (rem >= b) {
          return {
            handled: true,
            payload: { message: lang === 'en' ? `Fill in: ${b}×1 = __` : `Vul in: ${b}×1 = __`, action: 'none' },
            nextState: { ...state, step: 'bx1', rem },
          }
        }
        const q = Math.floor((a - rem) / b)
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
          nextState: { ...state, step: 'q_sum', rem, onesAdded: Math.max(0, q - startChunk) },
        }
      }
      return {
        handled: true,
        payload: { message: lang === 'en' ? `Fill in: ${a} − ${used} = __` : `Vul in: ${a} − ${used} = __`, action: 'none' },
        nextState: state,
      }
    }

    if (state.step === 'bx1') {
      if (isStuck(lastUser)) {
        return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${b}×1 = __` : `Vul in: ${b}×1 = __`, action: 'none' }, nextState: state }
      }
      const userN = parseNum(lastUser)
      if (Math.abs(userN - q1) < 1e-9) {
        const rem = state.rem ?? a - qStart
        return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${rem} − ${b} = __` : `Vul in: ${rem} − ${b} = __`, action: 'none' }, nextState: { ...state, step: 'rem_minus_b' } }
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
        return {
          handled: true,
          payload: {
            message:
              lang === 'en'
                ? `Fill in: ${startChunk} + ${q - startChunk} = __${label}`
                : `Vul in: ${startChunk} + ${q - startChunk} = __${label}`,
            action: 'none',
          },
          nextState: { ...state, step: 'q_sum', rem, onesAdded },
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
          return {
            handled: true,
            payload: { message: lang === 'en' ? `Fill in: ${a} ÷ ${b} = __ (remainder ${rem})` : `Vul in: ${a} ÷ ${b} = __ (rest ${rem})`, action: 'none' },
            nextState: { ...state, step: 'final' },
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
        return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${a}×${bU} = __` : `Vul in: ${a}×${bU} = __`, action: 'none' }, nextState: { ...state, step: 'ax_bU', axbT } }
      }
      return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${a}×${bT} = __` : `Vul in: ${a}×${bT} = __`, action: 'none' }, nextState: state }
    }

    if (state.step === 'ax_bU') {
      if (isStuck(lastUser)) {
        const aT = Math.trunc(a / 10) * 10
        const aU = a - aT
        return {
          handled: true,
          payload: {
            message:
              ageBand === 'junior'
                ? `We starten samen: Splits: ${a} = ${aT} + ${aU}. Vul in: ${aT}×${bU} = __`
                : `Vul in: ${aT}×${bU} = __`,
            action: 'none',
          },
          nextState: state,
        }
      }
      const userN = parseNum(lastUser)
      if (Math.abs(userN - axbU) < 1e-9) {
        const axbT2 = (state as any).axbT ?? axbT
        return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${axbT2} + ${axbU} = __` : `Vul in: ${axbT2} + ${axbU} = __`, action: 'none' }, nextState: { ...state, step: 'sum', axbT: axbT2, axbU } }
      }
      return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${a}×${bU} = __` : `Vul in: ${a}×${bU} = __`, action: 'none' }, nextState: state }
    }

    if (state.step === 'sum') {
      const userN = parseNum(lastUser)
      if (Math.abs(userN - a * b) < 1e-9) {
        return { handled: true, payload: { message: lang === 'en' ? `Correct.` : `Juist.`, action: 'none' }, nextState: null }
      }
      const x = (state as any).axbT ?? axbT
      const y = (state as any).axbU ?? axbU
      return { handled: true, payload: { message: lang === 'en' ? `Fill in: ${x} + ${y} = __` : `Vul in: ${x} + ${y} = __`, action: 'none' }, nextState: state }
    }
  }

  return { handled: false }
}

