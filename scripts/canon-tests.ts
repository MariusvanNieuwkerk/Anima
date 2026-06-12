/**
 * Canon-testsuite: bewaakt het routing-contract en de canon-flows.
 *
 * Draaien:  npm run test:canons
 *
 * Contract dat hier wordt afgedwongen:
 * 1. Kennisvragen gaan NOOIT naar een canon (anti-kaping) → LLM beantwoordt ze.
 * 2. Expliciete oefenvragen (grammatica/rekenen) routeren naar de juiste canon.
 * 3. Meerstaps-flows (golden conversations) blijven stap voor stap kloppen.
 *
 * Elke gefixte kaping of canon-bug hoort hier als test bij te komen.
 */
import { runTutorStateMachine, buildCanonExplanation, type TutorSMState } from '../app/api/chat/tutorStateMachine'
import { shouldExplain, boardMathIsSound, validatePracticePrompt } from '../app/api/chat/explain'
import { routeGrammarTopic } from '../app/api/chat/grammar/routeMap'

let passed = 0
let failed = 0
const failures: string[] = []

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++
  } else {
    failed++
    failures.push(`✗ ${name}${detail ? `\n    ${detail}` : ''}`)
  }
}

const sm = (lastUserText: string, state: TutorSMState | null = null) =>
  runTutorStateMachine({ state, lastUserText, userAge: 10, userLanguage: 'nl' })

type SMResult = ReturnType<typeof sm>
const nextOf = (r: SMResult): TutorSMState | null => (r.handled ? ((r.nextState as TutorSMState | null) ?? null) : null)
const kindOf = (r: SMResult): string | null => {
  const s = nextOf(r) as any
  return s?.kind ?? null
}

// =====================================================================
// 1) ANTI-KAPING: kennisvragen en gesprekjes blijven bij de LLM
// =====================================================================
const mustReachLlm = [
  'hoe ziet de paus eruit?',
  'waar ligt new york?',
  'waar ligt new york',
  'wat eten pinguïns?',
  'waarom is de lucht blauw?',
  'ik heb een question over vulkanen',
  'in welke tijd leefden de romeinen?',
  'wat is het onderwerp van mijn spreekbeurt?',
  'kun je dit artikel over dinosaurussen uitleggen?',
  'leg negatieve getallen uit',
  'help me met aardrijkskunde',
  'wie was napoleon?',
  'hoe werkt een vulkaan?',
  'wat betekent fotosynthese?',
]
for (const q of mustReachLlm) {
  const g = routeGrammarTopic(q, 'nl')
  check(`LLM-vraag niet gekaapt door grammatica: "${q}"`, g === null, `grammatica-route: ${JSON.stringify(g)}`)
}

// =====================================================================
// 2) EXPLICIETE GRAMMATICA-INTENTIE: routeert wél
// =====================================================================
const mustRouteGrammar: Array<[string, string]> = [
  ['wat is de persoonsvorm in deze zin: hij loopt naar huis', 'find_finite_verb'],
  ['vind het onderwerp in de zin: de kat slaapt op de bank', 'find_subject'],
  ['klopt deze zin: ik loopt naar school', 'find_finite_verb'],
  ['in welke tijd staat deze zin: hij liep naar huis', 'tense_basic'],
  ['welk lidwoord hoort bij huis', 'articles_basic'],
  ['wat is het hulpwerkwoord in deze zin: ik heb gelopen', 'aux_modals'],
  ['maak van deze zin een vraagzin: jij komt morgen', 'questions_basic'],
]
for (const [q, topic] of mustRouteGrammar) {
  const g = routeGrammarTopic(q, 'nl')
  check(`Grammatica-intentie routeert (${topic}): "${q}"`, g !== null && g.topic === topic, `kreeg: ${JSON.stringify(g)}`)
}

// =====================================================================
// 3) REKEN-ROUTING: sommen starten de juiste canon
// =====================================================================
const mustStartCanon: Array<[string, string]> = [
  ['84 ÷ 7', 'div'],
  ['12 × 8', 'mul'],
  ['47 + 38', 'add'],
  ['82 - 47', 'sub'],
  ['1/4 + 1/8', 'frac_addsub'],
  ['2/3 × 3/4', 'frac_muldiv'],
  ['20% van 150', 'percent'],
  ['20% korting op €80', 'percent_word'],
  ['x + 8 = 23', 'unknown'],
  ['1,2 × 0,5', 'dec_muldiv'],
  ['0,75 ÷ 0,25', 'dec_muldiv'],
  ['€80 met 20% korting, daarna 21% btw. Wat betaal je?', 'money_discount_vat'],
  ['80 met 20% korting en 21% btw. Wat betaal je?', 'money_discount_vat'],
]
for (const [q, kind] of mustStartCanon) {
  const r = sm(q)
  const gotKind = kindOf(r)
  check(`Som start canon ${kind}: "${q}"`, r.handled && gotKind === kind, `handled=${r.handled}, kind=${gotKind}`)
}

// Kennisvragen mogen de rekencanon óók niet starten
for (const q of mustReachLlm) {
  const r = sm(q)
  check(`LLM-vraag niet gekaapt door rekenen: "${q}"`, !r.handled, `handled met kind=${kindOf(r) ?? '-'}`)
}

// =====================================================================
// 4) FLOW-TESTS: golden conversations als code
// =====================================================================
function flow(name: string, start: string, turns: Array<[answer: string, expectInMessage: string]>) {
  let r = sm(start)
  check(`${name} — start wordt afgehandeld`, r.handled, `handled=${r.handled}`)
  let state = nextOf(r)
  let step = 0
  for (const [answer, expect] of turns) {
    step++
    r = sm(answer, state)
    const msg = String(r.handled ? r.payload.message : '')
    check(`${name} — stap ${step} ("${answer}" → verwacht "${expect}")`, r.handled && msg.includes(expect), `bericht: "${msg}"`)
    state = nextOf(r)
  }
}

// Golden test 5v-4: korting + btw met direct bedrag
flow('vat: €80, 20% korting, 21% btw', '€80 met 20% korting, daarna 21% btw. Wat betaal je?', [
  // start vraagt: 80 ÷ 5
  ['16', 'na korting'],
  ['64', '÷ 100'],
  ['0,64', '× 21'],
  ['13,44', '13,44'],
  // Golden doc 5v-4: na het eindantwoord volgt een korte bevestiging en stop.
  ['77,44', 'Juist'],
])

// Golden test 5v-5: korting + btw met aantal × prijs
{
  const r = sm('Je koopt 2 kaartjes van €50 met 20% korting en daarna 21% btw. Wat betaal je?')
  const msg = String(r.handled ? r.payload.message : '')
  check('vat met aantal: start met 2 × 50', r.handled && msg.includes('2 × 50'), `bericht: "${msg}"`)
}

// Golden test 5v-6: stuck-escalatie maakt de stap kleiner
{
  let r = sm('Je koopt 3 kaartjes van €4,50 met 20% korting en daarna 21% btw. Wat betaal je?')
  let state = nextOf(r)
  r = sm('13,5', state)
  state = nextOf(r)
  const stepMsg = String(r.handled ? r.payload.message : '')
  check('vat stuck: na subtotaal volgt 13,5 ÷ 5', stepMsg.includes('13,5 ÷ 5'), `bericht: "${stepMsg}"`)
  r = sm('ik weet het niet', state)
  state = nextOf(r)
  r = sm('ik weet het niet', state)
  const escMsg = String(r.handled ? r.payload.message : '')
  check('vat stuck: 2e "weet ik niet" maakt stap kleiner (135 ÷ 5)', escMsg.includes('135 ÷ 5'), `bericht: "${escMsg}"`)
}

// =====================================================================
// 5) UITLEG-MODUS ("I Do"): volledige walkthrough in één bericht
// =====================================================================
const explain = (q: string) => buildCanonExplanation({ userText: q, userAge: 10, userLanguage: 'nl' })

// Uitleg-intentie zonder concrete som → korte chattekst + uitgewerkte bordsom
const mustExplain: Array<[string, string, string]> = [
  ['kun je me staartdelingen uitleggen?', '84 ÷ 7', '84 ÷ 7 = 12'],
  ['hoe werkt vermenigvuldigen?', '12 × 8', '12 × 8 = 96'],
  ['leg optellen uit', '47 + 38', '47 + 38 = 85'],
  ['hoe werkt aftrekken', '82 − 47', '82 − 47 = 35'],
  ['leg procenten uit', '15% van 80', '15% van 80 = 12'],
  ['hoe reken je met kommagetallen?', '1,2 × 5', '1,2 × 5 = 6'],
  ['leg de volgorde van bewerkingen uit', '2 + 3 × 4', '2 + 3 × 4 = 14'],
  ['leg korting uit', '20% korting op €80', 'Je betaalt €64'],
]
for (const [q, example, conclusion] of mustExplain) {
  const r = explain(q)
  const msg = r?.message || ''
  check(`Uitleg-modus: "${q}" verwijst naar het bord met voorbeeld ${example}`, !!r && msg.includes(example) && msg.includes('op het bord'), `kreeg: ${msg ? msg.slice(0, 100) : '(null)'}`)
  check(`Uitleg-modus: "${q}" nodigt uit om zelf te proberen`, msg.includes('zelf proberen'), `kreeg: ${msg.slice(0, 100)}`)
  check(`Uitleg-modus: "${q}" bord heeft ≥ 2 stappen`, (r?.board.lines.length ?? 0) >= 2, `kreeg: ${r?.board.lines.length ?? 0} stappen`)
  check(`Uitleg-modus: "${q}" bordtitel = voorbeeld`, r?.board.title === example, `kreeg: ${r?.board.title}`)
  check(`Uitleg-modus: "${q}" conclusie klopt`, r?.board.conclusion === conclusion, `kreeg: ${r?.board.conclusion}`)
}

// Demo-bordregels: geen coach-uitroepen ("Top!", "Slim:") en geen open blanks
{
  const r = explain('leg staartdelen uit')
  const all = (r?.board.lines || []).map((l) => `${l.text} ${l.note || ''}`).join(' | ')
  check('Uitleg-modus: bordnotities zonder coach-uitroepen', !/\b(Top|Slim|Mooi|Goed zo)\s*[!—:]/.test(all), `kreeg: ${all}`)
  check('Uitleg-modus: geen open blanks op het bord', !all.includes('__'), `kreeg: ${all}`)
  check('Uitleg-modus: geen "(rest 0)"-jargon', !all.includes('rest 0') && !(r?.board.conclusion || '').includes('rest 0'), `kreeg: ${all}`)
}

// Regressie: staartdeling rondt NIET te vroeg af (84 ÷ 7 = 12, niet 11 rest 7)
{
  const r = explain('leg staartdelen uit')
  check('Uitleg-modus: 84 ÷ 7 eindigt correct op 12', r?.board.conclusion === '84 ÷ 7 = 12', `kreeg: ${r?.board.conclusion}`)
}

// Geen uitleg-modus voor kennisvragen → die horen bij de LLM
for (const q of ['leg uit waarom de lucht blauw is', 'hoe werkt een vulkaan?', 'wie was napoleon?']) {
  check(`Uitleg-modus laat kennisvraag los: "${q}"`, explain(q) === null, `kreeg uitleg ipv null`)
}

// Een concrete som is GÉÉN uitleg-demo (moet interactief opgelost worden)
for (const q of ['84 ÷ 7', 'wat is 84 ÷ 7?', '15% van 80']) {
  check(`Uitleg-modus negeert concrete som: "${q}"`, explain(q) === null, `kreeg demo ipv interactieve canon`)
}

// =====================================================================
// 5b) LLM-UITLEGROUTE: intentie-gate + kapings-guards (puur, geen API)
// =====================================================================

// Uitlegvragen (ook buiten rekenen) gaan naar de LLM-uitlegroute
const mustTriggerExplain = [
  'hoe werkt een staartdeling?',
  'wat is fotosynthese?',
  'waarom waren de romeinen belangrijk?',
  'leg breuken uit',
  'hoe vind je de persoonsvorm?',
  'kun je uitleggen hoe je een samenvatting schrijft',
  'hoe werkt delen met kommagetallen?',
  'waarom?',
]
for (const q of mustTriggerExplain) {
  check(`Uitleg-gate AAN: "${q}"`, shouldExplain(q), `shouldExplain gaf false`)
}

// Concrete sommen en niet-uitlegvragen blijven bij de oefen-flow/normale flow
const mustNotTriggerExplain = [
  'wat is 25% van 80?', // som → canon (TSM-guard)
  'wat is 84 ÷ 7?', // som → operator-guard
  '96 ÷ 8',
  'kun je 1/2 + 1/4 uitleggen', // eigen som → operator-guard
  'hallo',
  'ik snap het niet',
  '15',
]
for (const q of mustNotTriggerExplain) {
  check(`Uitleg-gate UIT: "${q}"`, !shouldExplain(q), `shouldExplain gaf true`)
}

// Bordsommen van het LLM worden nagerekend
check(
  'Bordvalidatie: kloppende sommen passeren',
  boardMathIsSound({
    title: '84 ÷ 7',
    lines: [{ text: '7 × 10 = 70' }, { text: '84 − 70 = 14', note: 'wat blijft over' }, { text: '15% van 80 = 12' }],
    conclusion: '84 ÷ 7 = 12',
  }),
  'kloppend bord werd afgekeurd'
)
check(
  'Bordvalidatie: foute som wordt afgekeurd',
  !boardMathIsSound({
    title: '84 ÷ 7',
    lines: [{ text: '7 × 10 = 70' }, { text: '84 − 70 = 15' }],
    conclusion: '84 ÷ 7 = 12',
  }),
  'fout bord passeerde'
)

// practicePrompt alleen doorlaten als hij echt een canon start
check('practicePrompt geldig: "96 ÷ 8"', validatePracticePrompt('96 ÷ 8', 10, 'nl') === '96 ÷ 8', 'werd afgekeurd')
check('practicePrompt geldig: "25% van 60"', validatePracticePrompt('25% van 60', 10, 'nl') === '25% van 60', 'werd afgekeurd')
check('practicePrompt ongeldig: vrije tekst', validatePracticePrompt('schrijf een verhaal over de zee', 10, 'nl') === null, 'passeerde')
check('practicePrompt ongeldig: leeg', validatePracticePrompt('', 10, 'nl') === null, 'passeerde')

// Mobiel vangnet: canon-walkthrough zonder bord zet de stappen inline
{
  const r = buildCanonExplanation({ userText: 'leg staartdelen uit', userAge: 10, userLanguage: 'nl', boardVisible: false })
  const msg = r?.message || ''
  check('Mobiel vangnet: stappen inline in de chat', /\n2\.\s/.test(msg) && msg.includes('Dus: 84 ÷ 7 = 12'), `kreeg: ${msg.slice(0, 140)}`)
  check('Mobiel vangnet: verwijst niet naar het bord', !msg.includes('op het bord'), `kreeg: ${msg.slice(0, 140)}`)
}

// =====================================================================
// 6) REGRESSIE: staartdeling met meerdere extra groepjes klopt
// =====================================================================
{
  // 84 ÷ 7 vereist 10 + 1 + 1 groepjes; de canon mag niet te vroeg afronden.
  let r = sm('84 ÷ 7')
  let state = nextOf(r)
  const feed = (a: string) => {
    r = sm(a, state)
    state = nextOf(r)
    return String(r.handled ? r.payload.message : '')
  }
  feed('70') // 7×10
  feed('14') // 84 − 70
  feed('7') // 7×1
  feed('7') // 14 − 7  (rest nog ≥ 7 → nog een groepje)
  feed('7') // 7×1
  const afterZero = feed('0') // 7 − 7 = 0 → quotiënt-som
  check('div 84 ÷ 7: na rest 0 volgt quotiënt-som 10 + 2', afterZero.includes('10 + 2'), `bericht: "${afterZero}"`)
  const finalPrompt = feed('12') // 10 + 2 = 12 → schrijf-het-antwoord (rest 0)
  check('div 84 ÷ 7: eindstap heeft rest 0', finalPrompt.includes('rest 0'), `bericht: "${finalPrompt}"`)
  const done = feed('12') // 84 ÷ 7 = 12 (rest 0)
  check('div 84 ÷ 7: bevestigt quotiënt 12', done.includes('12'), `bericht: "${done}"`)
}

// =====================================================================
// Resultaat
// =====================================================================
console.log('')
for (const f of failures) console.log(f)
console.log('')
console.log(`Canon-tests: ${passed} geslaagd, ${failed} gefaald`)
if (failed > 0) process.exit(1)
