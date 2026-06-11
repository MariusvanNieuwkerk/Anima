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

// ROUTING-CONTRACT: bij twijfel wint het gesprek (LLM).
// De grammatica-canon mag ALLEEN vuren bij expliciete grammatica-intentie,
// nooit op zinsvorm ("eindigt op een vraagteken" is geen intentie).
// Een gekaapte kennisvraag ("hoe ziet de paus eruit?") is erger dan een
// gemiste grammatica-oefening: de oefening kan het kind altijd expliciet vragen.

// 1) Ondubbelzinnige grammatica-termen: deze woorden betekenen buiten
//    grammatica vrijwel nooit iets anders → direct routeren.
const unambiguousByTopic: Partial<Record<GrammarTopicId, RegExp>> = {
  find_finite_verb: rxAny([
    '\\bpersoonsvorm\\w*\\b',
    '\\bfinite\\s+verb\\b',
    '\\bverbe\\s+conjugu\\w*\\b',
    '\\bverbo\\s+conjug\\w*\\b',
    '\\bverbo\\s+coniug\\w*\\b',
  ]),
  aux_modals: rxAny(['\\bhulpwerkwoord\\w*\\b', '\\bauxiliary\\b', '\\bmodalwerkwoord\\w*\\b']),
  pronouns_basic: rxAny(['\\bvoornaamwoord\\w*\\b', '\\bpronoun\\w*\\b', '\\bpronombre\\w*\\b', '\\bpronome\\b']),
  articles_basic: rxAny(['\\blidwoord\\w*\\b']),
  word_order_basic: rxAny(['\\bwoordvolgorde\\b', '\\bword\\s+order\\b']),
  questions_basic: rxAny(['\\bvraagzin\\w*\\b']),
  negation_basic: rxAny(['\\bontkenning\\w*\\b']),
  subordination_basic: rxAny(['\\bbijzin\\w*\\b', '\\bnebensatz\\b']),
  punctuation_basic: rxAny([
    '\\bleesteken\\w*\\b',
    '\\bpunctuation\\b',
    '\\bponctuation\\b',
    '\\bzeichensetzung\\b',
    '\\bpuntuaci\\w*\\b',
    '\\bpunteggiatura\\b',
  ]),
  sv_agreement: rxAny(['\\bcongruent\\w*\\b', '\\bconcordancia\\b']),
}

// 2) Ambigue termen: betekenen vaak iets anders ("tijd", "onderwerp",
//    "artikel", "question", "order"...). Alleen routeren als de tekst óók
//    metataal over zinnen/grammatica bevat.
const sentenceMeta = rxAny([
  '\\bzin\\b',
  '\\bzinnen\\b',
  '\\bsentence\\w*\\b',
  '\\bsatz\\b',
  '\\bphrase\\w*\\b',
  '\\bfrase\\w*\\b',
  '\\boraci\\w*\\b',
  '\\bgrammatica\\b',
  '\\bgrammar\\b',
  '\\bgrammaire\\b',
  '\\bgrammatik\\b',
  '\\bgram[aá]tica\\b',
  '\\bontleed\\w*\\b',
  '\\bontleden\\b',
  '\\bwerkwoord\\w*\\b',
])

const ambiguousByTopic: Partial<Record<GrammarTopicId, RegExp>> = {
  find_subject: rxAny(['\\bonderwerp\\w*\\b', '\\bsubject\\b', '\\bsujet\\b', '\\bsubjekt\\b', '\\bsujeto\\b', '\\bsoggetto\\b']),
  tense_basic: rxAny(['\\btijd\\b', '\\btijden\\b', '\\btense\\b', '\\btemps\\b', '\\bzeit\\b', '\\btiempo\\b', '\\btempo\\b']),
  aux_modals: rxAny(['\\bauxiliar\\w*\\b', '\\bmodal\\w*\\b']),
  articles_basic: rxAny(['\\barticle\\b', '\\bartikel\\w*\\b', '\\bart[íi]cul\\w*\\b', '\\barticolo\\b']),
  word_order_basic: rxAny(['\\border\\b', '\\bordre\\b', '\\bordine\\b', '\\borden\\b']),
  questions_basic: rxAny(['\\bquestion\\w*\\b', '\\bfrage\\b', '\\bpregunta\\w*\\b', '\\bdomanda\\b', '\\bpergunta\\b']),
  negation_basic: rxAny(['\\bnegation\\b', '\\bn[ée]gation\\b', '\\bvernein\\w*\\b', '\\bnegaci\\w*\\b']),
  subordination_basic: rxAny(['\\bsubordinate\\b', '\\bsubordonn\\w*\\b', '\\bsubordin\\w*\\b']),
  sv_agreement: rxAny(['\\bagreement\\b', '\\baccord\\b', '\\b[üu]bereinstimmung\\b']),
  pronouns_basic: rxAny(['\\bpronom\\b']),
}

// 3) "Check mijn zin"-intentie: expliciet vragen om een zin te controleren
//    of verbeteren → start bij de persoonsvorm.
const checkSentenceIntent = rxAny([
  '\\bklopt\\s+(deze|die|mijn)\\s+zin\\b',
  '\\bis\\s+(deze|die|mijn)\\s+zin\\s+(goed|correct|juist)\\b',
  '\\b(verbeter|check|controleer)\\s+(deze|die|de|mijn)\\s+zin\\b',
  '\\bontleed\\b',
  '\\bis\\s+(this|my)\\s+sentence\\s+(correct|right|ok)\\b',
  '\\b(check|fix|improve)\\s+(this|my)\\s+sentence\\b',
])

export function routeGrammarTopic(text: string, _lang: SupportedLang): GrammarRouteHit | null {
  const t = String(text || '')

  for (const [topic, re] of Object.entries(unambiguousByTopic) as Array<[GrammarTopicId, RegExp]>) {
    if (re.test(t)) return { topic, confidence: 'high' }
  }

  if (sentenceMeta.test(t)) {
    for (const [topic, re] of Object.entries(ambiguousByTopic) as Array<[GrammarTopicId, RegExp]>) {
      if (re.test(t)) return { topic, confidence: 'medium' }
    }
  }

  if (checkSentenceIntent.test(t)) {
    return { topic: 'find_finite_verb', confidence: 'medium' }
  }

  // Geen generieke fallback meer: een vraag die op "?" eindigt is gewoon
  // een vraag voor het gesprek (LLM), geen grammatica-oefening.
  return null
}
