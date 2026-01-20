import type { SupportedLang } from './i18n'
import { grammarPhrasesByLang } from './i18n'
import type { GrammarTopicId } from './routeMap'

export type GrammarCanonContext = {
  lang: SupportedLang
  messages: any[]
  lastUserText: string
}

const strip = (s: any) => String(s || '').trim()

const isStuckSignal = (t: string) =>
  /^(ik\s+snap\s+het\s+niet|snap\s+het\s+niet|ik\s+begrijp\s+het\s+niet|geen\s+idee|help|hulp|vast|i\s+don'?t\s+get\s+it|i\s+don'?t\s+understand|je\s+ne\s+comprends\s+pas|no\s+entiendo)\b/i.test(
    strip(t)
  )

const looksLikeAttempt = (t: string) => {
  const s = strip(t)
  if (!s) return false
  if (/^(ja|nee|yes|no|ok(é|ay)?|top|klopt|prima|goed|thanks|dank)/i.test(s)) return false
  if (s.length <= 2) return false
  return true
}

const countAttempts = (messages: any[]) => {
  const arr = Array.isArray(messages) ? messages : []
  let n = 0
  for (let i = Math.max(0, arr.length - 10); i < arr.length; i++) {
    const m = arr[i]
    if (m?.role !== 'user') continue
    if (looksLikeAttempt(String(m?.content || ''))) n++
  }
  return n
}

const getPrevAssistantText = (messages: any[]) => {
  const arr = Array.isArray(messages) ? messages : []
  for (let i = arr.length - 2; i >= 0; i--) {
    const m = arr[i]
    if (m?.role && m.role !== 'user') return strip(m?.content)
  }
  return ''
}

const extractSentence = (messages: any[], lastUserText: string) => {
  // Prefer the most recent non-trivial user text as "the sentence".
  const t = strip(lastUserText)
  if (t && t.length >= 6) return t
  const arr = Array.isArray(messages) ? messages : []
  for (let i = arr.length - 1; i >= 0; i--) {
    const m = arr[i]
    if (m?.role !== 'user') continue
    const s = strip(m?.content)
    if (!s) continue
    if (/^(ok(é|ay)?|ja|nee|yes|no|thanks|dank)/i.test(s)) continue
    return s
  }
  return t
}

function oneMoveFill(lang: SupportedLang, label: string, value: string) {
  const p = grammarPhrasesByLang[lang]
  return `${p.fillIn}: **${label} = __**\n${p.sentence}: ${value}`
}

function oneMoveChoose(lang: SupportedLang, label: string, options: string[], value: string) {
  const p = grammarPhrasesByLang[lang]
  const opts = options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('  ')
  return `${p.choose}: **${label} = A/B/C**\n${opts}\n${p.sentence}: ${value}`
}

export function grammarCanonStep(topic: GrammarTopicId, ctx: GrammarCanonContext): string {
  const { lang, messages, lastUserText } = ctx
  const p = grammarPhrasesByLang[lang]
  const sentence = extractSentence(messages, lastUserText)
  const prev = getPrevAssistantText(messages)

  // Deterministic escape hatch for grammar: keep the same micro-action but add a single rule line.
  if (isStuckSignal(lastUserText)) {
    const attempts = countAttempts(messages)
    const base = grammarCanonStep(topic, { ...ctx, lastUserText: sentence })
    if (attempts <= 1) return `${p.rulePrefix}: 1 stap tegelijk.\n${base}`
    if (attempts <= 3) return `${p.weStartTogether}:\n${base}`
    return `${p.correct}\n${p.transferTry}: (${p.sentence}) __` // minimal deterministic fallback
  }

  switch (topic) {
    case 'find_subject':
      return oneMoveFill(lang, p.subject, sentence)
    case 'find_finite_verb':
      return oneMoveFill(lang, p.finiteVerb, sentence)
    case 'tense_basic':
      return oneMoveChoose(lang, p.tense, ['present', 'past', 'future'], sentence)
    case 'aux_modals':
      return oneMoveFill(lang, 'Aux/Modal', sentence)
    case 'sv_agreement':
      return oneMoveChoose(lang, 'Agreement OK?', ['yes', 'no', 'not sure'], sentence)
    case 'pronouns_basic':
      return oneMoveFill(lang, 'Pronoun', sentence)
    case 'articles_basic':
      return oneMoveFill(lang, 'Article', sentence)
    case 'word_order_basic':
      return oneMoveFill(lang, 'Word order issue', sentence)
    case 'questions_basic':
      return oneMoveChoose(lang, p.questionType, ['yes/no', 'wh-question', 'tag'], sentence)
    case 'negation_basic':
      return oneMoveFill(lang, p.negation, sentence)
    case 'subordination_basic':
      return oneMoveFill(lang, p.subClause, sentence)
    case 'punctuation_basic':
      return oneMoveFill(lang, p.punctuation, sentence)
    default:
      // Should never happen; safe fallback.
      return oneMoveFill(lang, p.finiteVerb, sentence)
  }
}

