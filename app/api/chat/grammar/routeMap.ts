import type { SupportedLang } from './i18n'

export type GrammarTopicId =
  | 'find_subject'
  | 'find_finite_verb'
  | 'tense_basic'
  | 'aux_modals'
  | 'sv_agreement'
  | 'pronouns_basic'
  | 'articles_basic'
  | 'word_order_basic'
  | 'questions_basic'
  | 'negation_basic'
  | 'subordination_basic'
  | 'punctuation_basic'

export type GrammarRouteHit = { topic: GrammarTopicId; confidence: 'high' | 'medium' }

const rxAny = (patterns: string[]) => new RegExp(patterns.join('|'), 'i')

const keywordByTopic: Record<GrammarTopicId, RegExp> = {
  find_subject: rxAny(['\\bonderwerp\\b', '\\bsubject\\b', '\\bsujet\\b', '\\bsubjekt\\b', '\\bsujeto\\b', '\\bsoggetto\\b']),
  find_finite_verb: rxAny([
    '\\bpersoonsvorm\\b',
    '\\bfinite\\s+verb\\b',
    '\\bverbe\\s+conjugu\\w*\\b',
    '\\bfinit\\w*\\s+verb\\b',
    '\\bverbo\\s+conjug\\w*\\b',
    '\\bverbo\\s+coniug\\w*\\b',
  ]),
  tense_basic: rxAny(['\\btijd\\b', '\\btense\\b', '\\btemps\\b', '\\bzeit\\b', '\\btiempo\\b', '\\btempo\\b']),
  aux_modals: rxAny(['\\bhulpwerkwoord\\b', '\\bauxiliar\\b', '\\bauxiliary\\b', '\\bmodal\\b', '\\bmodale\\b']),
  sv_agreement: rxAny(['\\bcongruent\\w*\\b', '\\bagreement\\b', '\\baccord\\b', '\\bÜbereinstimmung\\b', '\\bconcordancia\\b']),
  pronouns_basic: rxAny(['\\bvoornaamwoord\\w*\\b', '\\bpronoun\\w*\\b', '\\bpronom\\b', '\\bpronombre\\b', '\\bpronome\\b']),
  articles_basic: rxAny(['\\blidwoord\\w*\\b', '\\barticle\\b', '\\bartikel\\b', '\\bart\\w*\\b']),
  word_order_basic: rxAny(['\\bwoordvolgorde\\b', '\\bword\\s+order\\b', '\\border\\b', '\\bordre\\b', '\\bordine\\b']),
  questions_basic: rxAny(['\\bvraagzin\\b', '\\bquestion\\b', '\\bfrage\\b', '\\bpregunta\\b', '\\bdomanda\\b', '\\bpergunta\\b']),
  negation_basic: rxAny(['\\bontkenning\\b', '\\bnegation\\b', '\\bnégation\\b', '\\bvernein\\w*\\b', '\\bnegaci\\w*\\b', '\\bnega\\w*\\b']),
  subordination_basic: rxAny(['\\bbijzin\\b', '\\bsubordinate\\b', '\\bsubordonn\\w*\\b', '\\bnebensatz\\b', '\\bsubordin\\w*\\b']),
  punctuation_basic: rxAny(['\\bleesteken\\w*\\b', '\\bpunctuation\\b', '\\bponctuation\\b', '\\bzeichensetzung\\b', '\\bpuntuaci\\w*\\b', '\\bpunteggiatura\\b']),
}

const looksLikeSentence = (t: string) => {
  const s = String(t || '').trim()
  if (s.length < 6) return false
  // no digits-heavy / math
  if (/\d/.test(s) && /[+\-*/=]/.test(s)) return false
  // has letters and spaces, or punctuation typical of sentences
  return /[a-zA-ZÀ-ÿ]/.test(s) && (/\s/.test(s) || /[.,;:!?]/.test(s))
}

export function routeGrammarTopic(text: string, _lang: SupportedLang): GrammarRouteHit | null {
  const t = String(text || '')

  for (const [topic, re] of Object.entries(keywordByTopic) as any) {
    if (re.test(t)) return { topic, confidence: 'high' }
  }

  // Generic fallback: if user pasted a sentence and asks if it's correct → start with finite verb.
  if (looksLikeSentence(t) && /[?¿]$/.test(t.trim())) {
    return { topic: 'find_finite_verb', confidence: 'medium' }
  }

  return null
}

