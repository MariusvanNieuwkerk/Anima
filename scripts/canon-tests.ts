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
import { runTutorStateMachine, type TutorSMState } from '../app/api/chat/tutorStateMachine'
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
  const gotKind = r.nextState ? (r.nextState as any).kind : null
  check(`Som start canon ${kind}: "${q}"`, r.handled && gotKind === kind, `handled=${r.handled}, kind=${gotKind}`)
}

// Kennisvragen mogen de rekencanon óók niet starten
for (const q of mustReachLlm) {
  const r = sm(q)
  check(`LLM-vraag niet gekaapt door rekenen: "${q}"`, !r.handled, `handled met kind=${r.nextState ? (r.nextState as any).kind : '-'}`)
}

// =====================================================================
// 4) FLOW-TESTS: golden conversations als code
// =====================================================================
function flow(name: string, start: string, turns: Array<[answer: string, expectInMessage: string]>) {
  let r = sm(start)
  check(`${name} — start wordt afgehandeld`, r.handled, `handled=${r.handled}`)
  let state = (r.nextState as TutorSMState | null) ?? null
  let step = 0
  for (const [answer, expect] of turns) {
    step++
    r = sm(answer, state)
    const msg = String(r.handled ? r.payload.message : '')
    check(`${name} — stap ${step} ("${answer}" → verwacht "${expect}")`, r.handled && msg.includes(expect), `bericht: "${msg}"`)
    state = (r.nextState as TutorSMState | null) ?? null
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
  let state = (r.nextState as TutorSMState | null) ?? null
  r = sm('13,5', state)
  state = (r.nextState as TutorSMState | null) ?? null
  const stepMsg = String(r.handled ? r.payload.message : '')
  check('vat stuck: na subtotaal volgt 13,5 ÷ 5', stepMsg.includes('13,5 ÷ 5'), `bericht: "${stepMsg}"`)
  r = sm('ik weet het niet', state)
  state = (r.nextState as TutorSMState | null) ?? null
  r = sm('ik weet het niet', state)
  const escMsg = String(r.handled ? r.payload.message : '')
  check('vat stuck: 2e "weet ik niet" maakt stap kleiner (135 ÷ 5)', escMsg.includes('135 ÷ 5'), `bericht: "${escMsg}"`)
}

// =====================================================================
// Resultaat
// =====================================================================
console.log('')
for (const f of failures) console.log(f)
console.log('')
console.log(`Canon-tests: ${passed} geslaagd, ${failed} gefaald`)
if (failed > 0) process.exit(1)
