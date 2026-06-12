/**
 * Tutor-testsuite: bewaakt het routing-contract van de dunne architectuur.
 *
 * Draaien:  npm run test:tutor
 *
 * Contract dat hier wordt afgedwongen:
 * 1. ANTI-KAPING: gewone vragen worden door geen enkele serverlaag
 *    onderschept — alles gaat naar de LLM (met leerprofiel).
 * 2. GESPREKSREGELS (dun): stopsignalen, kale ja/nee en "ok" worden
 *    deterministisch en vriendelijk afgehandeld.
 * 3. REKEN-VANGRAIL: "EXPR = __"-antwoorden worden exact nagerekend.
 * 4. UITLEG-GATES: uitlegvragen wel, concrete sommen niet; bordsommen
 *    worden nagerekend; oefen-uitnodigingen zijn echte sommen.
 *
 * Elke gefixte kaping of vangrail-bug hoort hier als test bij te komen.
 */
import { applyTutorPolicyWithDebug } from '../app/api/chat/tutorPolicy'
import { evalArithExpr, looksLikeMathProblem, checkBlankAnswer, skillOf } from '../app/api/chat/mathChecker'
import { shouldExplain, boardMathIsSound, validatePracticePrompt } from '../app/api/chat/explain'

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

const msg = (role: 'user' | 'assistant', content: string) => ({ role, content })

// Draai de preflight zoals route.ts dat doet en geef terug of er
// deterministisch werd onderschept (en zo ja, door welke regel).
function preflight(lastUserText: string, messages: Array<{ role: string; content: string }> = []) {
  const r = applyTutorPolicyWithDebug(
    { message: '' },
    { userLanguage: 'nl', userAge: 10, messages: [...messages, msg('user', lastUserText)], lastUserText }
  )
  const names = (r.debug || []).map((e) => String(e?.name || ''))
  const intercepted = names.some((n) => ['stop_signal', 'ack_only_answer_last_q', 'bare_yes_no_close'].includes(n))
  return { intercepted, names, message: String(r.payload?.message || '') }
}

// =====================================================================
// 1) ANTI-KAPING: gewone vragen bereiken altijd de LLM
// =====================================================================
const mustReachLlm = [
  'hoe ziet de paus eruit?',
  'waar ligt new york?',
  'wat eten pinguïns?',
  'waarom is de lucht blauw?',
  'in welke tijd leefden de romeinen?',
  'wie was napoleon?',
  'kunnen we een begrijpend lezen tekst oefenen?',
  'kun je een verhaaltje schrijven?',
  'wat is de persoonsvorm in deze zin: hij loopt naar huis',
  'help me met aardrijkskunde',
]
for (const q of mustReachLlm) {
  const r = preflight(q)
  check(`LLM-vraag niet onderschept: "${q}"`, !r.intercepted, `regels: ${r.names.join(',')}`)
}

// Regressie (de kaping die deze opschoning veroorzaakte): na een reken-
// geschiedenis mag een nieuw onderwerp NIET worden teruggetrokken naar een som.
{
  const history = [
    msg('user', '84 ÷ 7'),
    msg('assistant', 'Begin met: **7 × 10 = __**. Wat is dat?'),
    msg('user', '70'),
    msg('assistant', 'Vul in: **84 − 70 = __**.'),
  ]
  const r = preflight('kunnen we een begrijpend lezen tekst oefenen?', history)
  check(
    'Anti-kaping: nieuw onderwerp na rekenhistorie wordt niet teruggekaapt',
    !r.intercepted && !r.message.includes('__'),
    `regels: ${r.names.join(',')} bericht: "${r.message}"`
  )
}

// Ook kale sommen worden niet meer server-side onderschept: de LLM begeleidt,
// de vangrail rekent alleen blanks na.
for (const q of ['84 ÷ 7', '47 + 38', '20% van 150']) {
  const r = preflight(q)
  check(`Som gaat naar de LLM: "${q}"`, !r.intercepted, `regels: ${r.names.join(',')}`)
}

// =====================================================================
// 2) GESPREKSREGELS (dun)
// =====================================================================
{
  const r = preflight('laat maar')
  check('Stopsignaal sluit vriendelijk af', r.intercepted && r.names.includes('stop_signal'), `regels: ${r.names.join(',')}`)
}
{
  const history = [msg('assistant', 'De Romeinen bouwden wegen en aquaducten.')]
  const r = preflight('nee', history)
  check(
    'Kale "nee" zonder openstaande vraag rondt af',
    r.intercepted && r.names.includes('bare_yes_no_close'),
    `regels: ${r.names.join(',')}`
  )
}
{
  const history = [msg('assistant', 'Hoeveel poten heeft een spin?')]
  const r = preflight('ok', history)
  check(
    '"ok" op een openstaande vraag → vraag om het antwoord',
    r.intercepted && r.names.includes('ack_only_answer_last_q'),
    `regels: ${r.names.join(',')}`
  )
}
{
  // "ja" op een openstaande vraag is een antwoord: niet onderscheppen.
  const history = [msg('assistant', 'Wil je nog een som proberen?')]
  const r = preflight('ja', history)
  check('"ja" op een vraag gaat naar de LLM', !r.intercepted, `regels: ${r.names.join(',')}`)
}
{
  // "Klaar"-hygiëne: model meldt af én stelt een vraag → vraag wordt gestript.
  const r = applyTutorPolicyWithDebug(
    { message: 'We zijn klaar. Wil je nog een som?' },
    { userLanguage: 'nl', userAge: 10, messages: [], lastUserText: 'super bedankt voor de hulp vandaag' }
  )
  check(
    '"Klaar"-hygiëne stript de vraag na een afrondingszin',
    !String(r.payload.message).includes('?'),
    `bericht: "${r.payload.message}"`
  )
}

// =====================================================================
// 3) REKEN-VANGRAIL (mathChecker)
// =====================================================================

// Rekenmachine
check('evalArithExpr: 8 × 10 = 80', evalArithExpr('8 × 10') === 80)
check('evalArithExpr: 84 − 70 = 14', evalArithExpr('84 − 70') === 14)
check('evalArithExpr: 2 + 3 × 4 = 14 (voorrang)', evalArithExpr('2 + 3 × 4') === 14)
check('evalArithExpr: (2 + 3) × 4 = 20 (haakjes)', evalArithExpr('(2 + 3) × 4') === 20)
check('evalArithExpr: 13,5 ÷ 5 = 2,7 (komma)', Math.abs((evalArithExpr('13,5 ÷ 5') ?? 0) - 2.7) < 1e-9)
check('evalArithExpr: 84 : 7 = 12 (dubbelepunt)', evalArithExpr('84 : 7') === 12)
check('evalArithExpr: woorden → null', evalArithExpr('appels en peren') === null)

// Somdetectie
for (const q of ['84 ÷ 3', '96 ÷ 8', '12 x 12', '1/2 + 1/4', '25% van 60', 'x + 8 = 23', '__ − 7 = 15']) {
  check(`looksLikeMathProblem AAN: "${q}"`, looksLikeMathProblem(q))
}
for (const q of ['hoe werkt een staartdeling?', 'kunnen we een begrijpend lezen tekst oefenen?', 'wat is fotosynthese?', 'hallo', '15']) {
  check(`looksLikeMathProblem UIT: "${q}"`, !looksLikeMathProblem(q))
}

// Blank-check: het hart van de vangrail
{
  const v = checkBlankAnswer('Begin met: **8 × 10 = __**. Wat is dat?', '80')
  check('Blank-check: goed antwoord is correct', !!v && v.correct === true, JSON.stringify(v))
}
{
  const v = checkBlankAnswer('Begin met: **8 × 10 = __**. Wat is dat?', '75')
  check('Blank-check: fout antwoord is fout (verwacht 80)', !!v && v.correct === false && v.expected === 80, JSON.stringify(v))
}
{
  const v = checkBlankAnswer('Stap 3: 84 − 70 = __', '14')
  check('Blank-check: stapnummer vervuilt de som niet', !!v && v.correct === true && v.expected === 14, JSON.stringify(v))
}
{
  const v = checkBlankAnswer('Vul in: 13,5 ÷ 5 = __ (euro)', '2,7')
  check('Blank-check: komma-antwoord met eenheid erachter', !!v && v.correct === true, JSON.stringify(v))
}
{
  const v = checkBlankAnswer('Hoeveel is 7 ÷ 3 = __ in de staartdeling?', '2')
  check('Blank-check: quotiënt-conventie "7 ÷ 3 = 2" telt als goed', !!v && v.correct === true, JSON.stringify(v))
}
{
  const v = checkBlankAnswer('Vul in: 84 : 7 = __', '12')
  check('Blank-check: deling met dubbelepunt', !!v && v.correct === true, JSON.stringify(v))
}
check('Blank-check: geen blank → geen verdict', checkBlankAnswer('Goed bezig! Wat denk je zelf?', '14') === null)
check('Blank-check: woord-antwoord → geen verdict (LLM beoordeelt)', checkBlankAnswer('Vul in: 8 × 10 = __', 'tachtig') === null)
check('Blank-check: blank zonder som → geen verdict', checkBlankAnswer('Antwoord = __', '7') === null)

// Skill-classificatie (voedt het leerprofiel)
const skillCases: Array<[string, string]> = [
  ['84 ÷ 7', 'div'],
  ['hoe werkt een staartdeling', 'div'],
  ['12 × 8', 'mul'],
  ['47 + 38', 'add'],
  ['82 - 47', 'sub'],
  ['20% van 150', 'percent'],
  ['€80 met 20% korting', 'percent'],
  ['1/4 + 1/8', 'frac_addsub'],
  ['x + 8 = 23', 'unknown'],
]
for (const [q, kind] of skillCases) {
  check(`skillOf("${q}") = ${kind}`, skillOf(q) === kind, `kreeg: ${skillOf(q)}`)
}
check('skillOf: geen rekenles → null', skillOf('wie was napoleon?') === null, `kreeg: ${skillOf('wie was napoleon?')}`)

// =====================================================================
// 4) UITLEG-GATES (puur, geen API)
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

// Concrete sommen en niet-uitlegvragen blijven bij de normale flow
const mustNotTriggerExplain = [
  'wat is 25% van 80?',
  'wat is 84 ÷ 7?',
  '96 ÷ 8',
  'kun je 1/2 + 1/4 uitleggen',
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
// Staartdeling-conventie: quotiënt-met-rest is geen rekenfout
check(
  'Bordvalidatie: "7 ÷ 3 = 2" (quotiënt met rest) passeert',
  boardMathIsSound({
    title: '72 ÷ 3',
    lines: [{ text: '7 ÷ 3 = 2', note: '3 past 2 keer in 7, rest 1' }, { text: '12 ÷ 3 = 4' }],
    conclusion: '72 ÷ 3 = 24',
  }),
  'staartdelingsstap werd afgekeurd'
)
check(
  'Bordvalidatie: "7 ÷ 3 = 3" blijft fout',
  !boardMathIsSound({
    title: '72 ÷ 3',
    lines: [{ text: '7 ÷ 3 = 3' }],
    conclusion: '72 ÷ 3 = 24',
  }),
  'echt foute deelstap passeerde'
)

// practicePrompt alleen doorlaten als het echt een intypbare som is
check('practicePrompt geldig: "96 ÷ 8"', validatePracticePrompt('96 ÷ 8') === '96 ÷ 8', 'werd afgekeurd')
check('practicePrompt geldig: "25% van 60"', validatePracticePrompt('25% van 60') === '25% van 60', 'werd afgekeurd')
check('practicePrompt ongeldig: vrije tekst', validatePracticePrompt('schrijf een verhaal over de zee') === null, 'passeerde')
check('practicePrompt ongeldig: leeg', validatePracticePrompt('') === null, 'passeerde')

// =====================================================================
// Resultaat
// =====================================================================
console.log('')
for (const f of failures) console.log(f)
console.log('')
console.log(`Tutor-tests: ${passed} geslaagd, ${failed} gefaald`)
if (failed > 0) process.exit(1)
