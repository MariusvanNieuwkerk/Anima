/**
 * Beeld-testsuite: bewaakt de concept-first beeldketen (Curator 2.0).
 *
 * Draaien:  npm run test:images   (heeft netwerk nodig: Wikipedia/Wikidata)
 *
 * Contract: typische "hoe ziet X eruit?"-kindvragen MOETEN een bruikbare
 * afbeeldings-URL opleveren (jpg/png/webp/gif, nooit svg/pdf).
 */
import { findImageSmart, extractImageSubject } from '../app/lib/wiki'

let passed = 0
let failed = 0
const failures: string[] = []

const check = (name: string, ok: boolean, detail?: string) => {
  if (ok) passed++
  else {
    failed++
    failures.push(`✗ ${name}${detail ? `\n    ${detail}` : ''}`)
  }
}

// Onderwerp-extractie uit kindvragen
const subjectCases: Array<[string, string]> = [
  ['hoe ziet een koboldhaai eruit?', 'koboldhaai'],
  ['laat eens een foto van de eiffeltoren zien', 'eiffeltoren'],
  ['kun je me een plaatje van een vulkaan laten zien?', 'vulkaan'],
]

// Kindvragen die een afbeelding MOETEN opleveren.
// modelQuery = wat het LLM typisch teruggeeft; userText = wat het kind typte.
const imageCases: Array<{ name: string; modelQuery?: string; userText: string }> = [
  { name: 'koboldhaai (NL term, model vertaalde niet)', modelQuery: 'koboldhaai', userText: 'hoe ziet een koboldhaai eruit?' },
  { name: 'goblin shark (EN query)', modelQuery: 'goblin shark', userText: 'hoe ziet een koboldhaai eruit?' },
  { name: 'koboldhaai (geen model-query)', userText: 'hoe ziet een koboldhaai eruit?' },
  { name: 'vulkaan', modelQuery: 'volcano', userText: 'hoe ziet een vulkaan eruit?' },
  { name: 'Eiffeltoren', modelQuery: 'Eiffel Tower', userText: 'laat de eiffeltoren zien' },
  { name: 'blauwe vinvis (NL query)', modelQuery: 'blauwe vinvis', userText: 'hoe groot is een blauwe vinvis? laat zien' },
  { name: 'ridderharnas', userText: 'hoe ziet een ridderharnas eruit?' },
  { name: 'piramide van Gizeh', modelQuery: 'Great Pyramid of Giza', userText: 'toon de piramide van gizeh' },
  { name: 'Mona Lisa', modelQuery: 'Mona Lisa', userText: 'laat de mona lisa zien' },
  { name: 'vleermuis', userText: 'hoe ziet een vleermuis eruit?' },
  { name: 'Mount Everest', modelQuery: 'Mount Everest', userText: 'laat de mount everest zien' },
  { name: 'zonnebloem', modelQuery: 'sunflower', userText: 'hoe ziet een zonnebloem eruit?' },
]

const badExt = (url: string) => /\.(svg|pdf|djvu)([?#]|$)/i.test(url)

async function main() {
  for (const [input, expected] of subjectCases) {
    const got = extractImageSubject(input)
    check(`onderwerp uit "${input}"`, got === expected, `kreeg: "${got}"`)
  }

  for (const c of imageCases) {
    const r = await findImageSmart({ modelQuery: c.modelQuery, userText: c.userText, lang: 'nl' })
    const ok = !!(r.found && r.url && !badExt(r.url))
    check(`beeld voor: ${c.name}`, ok, `resultaat: ${JSON.stringify({ found: r.found, url: r.url })}`)
    if (ok) console.log(`  ✓ ${c.name} → ${r.url}`)
  }

  console.log('')
  for (const f of failures) console.log(f)
  console.log('')
  console.log(`Beeld-tests: ${passed} geslaagd, ${failed} gefaald`)
  if (failed > 0) process.exit(1)
}

main()
