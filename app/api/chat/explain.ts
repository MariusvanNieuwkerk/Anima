import { GoogleGenerativeAI } from '@google/generative-ai'
import { evalArithExpr, looksLikeMathProblem } from './mathChecker'

// ====================================================================
// LLM-UITLEGROUTE ("I Do" 2.0)
//
// Uitlegvragen ("hoe werkt een staartdeling?", "wat is fotosynthese?")
// gaan naar het LLM met een didactisch promptcontract; dit is alleen de
// uitleg-beurt, oefenen loopt via de normale flow + reken-vangrail.
//
// Contract met het model (JSON):
//   { message, board: null | {title,lines,conclusion}, practicePrompt }
//
// De server vertrouwt niets blind:
// - bordsommen worden nagerekend (evalArithExpr)
// - practicePrompt moet een echt intypbare som zijn (looksLikeMathProblem),
//   anders is de uitnodiging een dode link
// - kapot/leeg antwoord → één retry → daarna valt de caller terug op de
//   normale flow
// ====================================================================

export type ExplainSteps = {
  title: string
  lines: Array<{ text: string; note?: string }>
  conclusion: string
}

export type ExplainResult = {
  message: string
  steps: ExplainSteps | null
  // Zoekterm voor een Wikimedia-afbeelding bij niet-reken onderwerpen
  // ("fotosynthese", "Nachtwacht"). De caller lost dit op via de
  // beeldpijplijn (quality gate) en zet het resultaat op het bord.
  imageQuery: string | null
}

// ---------------------------------------------------------------
// Intentie + kapings-guards (puur en testbaar)
// ---------------------------------------------------------------

export function detectExplainIntent(text: string): boolean {
  const t = String(text || '').trim().toLowerCase()
  if (!t) return false
  return /\bleg\b.*\buit\b|uitleggen|\buitleg\b|hoe\s+(werkt|werken|doe|doet|moet|reken|deel|maak|vind|schrijf|gaat)\b|wat\s+(is|zijn|betekent)\b|waarom\b|kun\s+je\b.*\b(uitleggen|laten zien|voordoen)|laat\s+(een\s+)?voorbeeld|doe\s+(het\s+)?voor|\bexplain\b|how\s+(do|does|to)\b|\bwhy\b|what\s+(is|are|does)\b/i.test(
    t
  )
}

// Volledige gate: uitleg-intentie ZONDER dat het eigenlijk een som is.
// Concrete sommen ("wat is 25% van 80?") horen bij de oefen-flow.
export function shouldExplain(text: string): boolean {
  const t = String(text || '').trim()
  if (!t || !detectExplainIntent(t)) return false
  if (looksLikeMathProblem(t)) return false
  return true
}

// ---------------------------------------------------------------
// Validatie van de modeloutput
// ---------------------------------------------------------------

const parseNumLoose = (s: string): number | null => {
  const n = Number(String(s || '').trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Reken pure rekenregels op het bord na ("7 × 10 = 70"). Regels met woorden
// ("15% van 80 = 12") kunnen we niet generiek narekenen; die laten we staan.
export function boardMathIsSound(steps: ExplainSteps): boolean {
  for (const line of steps.lines || []) {
    const m = String(line.text || '').match(/^([0-9\s.,+\-*/×÷:()−–]+)=\s*(-?[\d.,]+)\s*$/)
    if (!m) continue
    const expected = evalArithExpr(m[1])
    const stated = parseNumLoose(m[2])
    if (expected === null || stated === null) continue
    if (Math.abs(expected - stated) <= 1e-6) continue
    // Staartdeling-conventie: "7 ÷ 3 = 2" betekent quotiënt-met-rest.
    // Dat is op een bord met deelstappen correct, geen rekenfout.
    const div = m[1].match(/^\s*(\d+)\s*[÷/:]\s*(\d+)\s*$/)
    if (div) {
      const a = Number(div[1])
      const b = Number(div[2])
      if (b > 0 && Number.isInteger(stated) && stated === Math.floor(a / b)) continue
    }
    return false
  }
  return true
}

function sanitizeSteps(raw: any): ExplainSteps | null {
  if (!raw || typeof raw !== 'object') return null
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const conclusion = typeof raw.conclusion === 'string' ? raw.conclusion.trim() : ''
  const linesIn = Array.isArray(raw.lines) ? raw.lines : []
  const lines = linesIn
    .filter((l: any) => l && typeof l.text === 'string' && l.text.trim())
    .map((l: any) => ({
      text: String(l.text).trim(),
      note: typeof l.note === 'string' && l.note.trim() ? String(l.note).trim() : undefined,
    }))
  if (!title || !conclusion || lines.length < 2) return null
  const steps: ExplainSteps = { title, lines, conclusion }
  // Foute sommen op het bord zijn erger dan geen bord.
  if (!boardMathIsSound(steps)) return null
  return steps
}

// practicePrompt alleen doorlaten als het echt een intypbare som is; anders
// is de uitnodiging een dode link.
export function validatePracticePrompt(p: unknown): string | null {
  const t = typeof p === 'string' ? p.trim() : ''
  if (!t || t.length > 60) return null
  try {
    return looksLikeMathProblem(t) ? t : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------

function registerRules(userAge: number): string {
  if (userAge <= 12) {
    return [
      '- Korte zinnen. Warme, natuurlijke toon — zoals een lievelingsjuf of -meester die naast je komt zitten.',
      '- GEEN vaktermen of afkortingen zonder ze meteen in gewone woorden uit te leggen (dus nooit kaal "kgv" of "ggd").',
      '- Gebruik een concreet beeld uit het dagelijks leven (snoepjes, zakgeld, pizza).',
      '- Richtlijn: ±150 woorden. Liever iets langer en helder dan kort en cryptisch.',
    ].join('\n')
  }
  if (userAge <= 16) {
    return [
      '- Normale zinnen, geen kleutertoon en niet neerbuigend.',
      '- Vaktermen mogen, maar leg ze de eerste keer kort uit.',
      '- Richtlijn: ±200 woorden.',
    ].join('\n')
  }
  return [
    '- Efficiënt en helder, hoger tempo.',
    '- Vaktermen zijn prima.',
    '- Richtlijn: ±250 woorden.',
  ].join('\n')
}

function buildExplainPrompt(opts: {
  userText: string
  history: Array<{ role: string; content: string }>
  userAge: number
  targetLanguage: string
  studentName?: string | null
  boardVisible: boolean
  profileBlock?: string | null
}): string {
  const name = (opts.studentName || '').trim()
  const recent = (opts.history || [])
    .slice(-6)
    .map((m) => `${m.role === 'assistant' ? 'Anima' : 'Leerling'}: ${String(m.content || '').slice(0, 300)}`)
    .join('\n')

  const boardRule = opts.boardVisible
    ? [
        'Er staat een BORD naast de chat.',
        '- Zet de uitgewerkte voorbeeldsom op het bord ("board"): elke regel is één rekenstap ("text", bv. "7 × 10 = 70") met een korte waarom-zin ("note").',
        '- "conclusion" is de oorspronkelijke som met het eindantwoord (bv. "84 ÷ 7 = 12").',
        '- Houd "message" dan korter en verwijs één keer naar het bord.',
        '- Alleen voor reken-onderwerpen; bij andere onderwerpen is "board" null en staat alles in "message".',
      ].join('\n')
    : [
        'Er is GEEN bord zichtbaar (telefoon).',
        '- "board" MOET null zijn.',
        '- De volledige uitleg, inclusief het doorgewerkte voorbeeld als genummerde stappen, staat in "message".',
        '- Verwijs NOOIT naar een bord.',
      ].join('\n')

  return [
    `Je bent Anima, een warme, geduldige privéleraar voor ${name || 'een leerling'} van ${opts.userAge} jaar.`,
    `Dit is een UITLEG-beurt: de leerling wil iets begrijpen. Het is geen overhoring.`,
    '',
    opts.profileBlock
      ? `WAT JE AL WEET OVER DEZE LEERLING (gebruik dit om de uitleg te laten aansluiten; benoem het alleen als het relevant is):\n${opts.profileBlock}\n`
      : '',
    'DIDACTISCHE RICHTING (gebruik dit als kompas, niet als sjabloon — schrijf natuurlijk):',
    '- Maak ergens vroeg duidelijk waarvoor je dit in het echt gebruikt.',
    '- De kern is ÉÉN concreet, volledig doorgewerkt voorbeeld in kleine stappen die elkaar logisch opvolgen.',
    '- Benoem de veelgemaakte fout of valkuil, op een plek waar die natuurlijk past.',
    '- Geef GEEN oefenvraag of wedervraag in "message" — het systeem voegt zelf een uitnodiging toe.',
    '',
    'REGISTER:',
    registerRules(opts.userAge),
    '',
    'BORD:',
    boardRule,
    '',
    '"practicePrompt": alleen bij reken-onderwerpen — een kale, intypbare som die lijkt op het voorbeeld maar met andere getallen (bv. "96 ÷ 8" of "25% van 60"). Bij andere onderwerpen: null.',
    '',
    '"imageQuery": alleen bij onderwerpen waar een echte foto of erkende plaat het begrip helpt (dier, plant, plek, gebouw, kunstwerk, persoon, orgaan, natuurverschijnsel): een korte zoekterm voor Wikipedia (bv. "fotosynthese" of "Nachtwacht Rembrandt"). Bij reken- en taalonderwerpen: null.',
    '',
    `Antwoord UITSLUITEND met geldige JSON in dit formaat, in het ${opts.targetLanguage}:`,
    '{"message": string, "board": null | {"title": string, "lines": [{"text": string, "note": string|null}], "conclusion": string}, "practicePrompt": string|null, "imageQuery": string|null}',
    '',
    recent ? `GESPREK TOT NU TOE:\n${recent}` : '',
    '',
    `VRAAG VAN DE LEERLING: ${opts.userText}`,
  ]
    .filter(Boolean)
    .join('\n')
}

// ---------------------------------------------------------------
// Generatie
// ---------------------------------------------------------------

const EXPLAIN_TIMEOUT_MS = 25_000

async function callModel(apiKey: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    // Uitleg is de beurt waar kwaliteit telt: frontier-model (snel én slim),
    // overschrijfbaar via env (bv. gemini-3.1-pro-preview voor max kwaliteit).
    model: process.env.GEMINI_EXPLAIN_MODEL || 'gemini-3.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  })
  const result = (await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) => setTimeout(() => reject(new Error('explain timeout')), EXPLAIN_TIMEOUT_MS)),
  ])) as Awaited<ReturnType<typeof model.generateContent>>
  return result.response.text()
}

type ExplainOpts = {
  apiKey: string
  userText: string
  history: Array<{ role: string; content: string }>
  userAge: number
  userLanguage: string
  targetLanguage: string
  studentName?: string | null
  boardVisible: boolean
  profileBlock?: string | null
}

// Verwijst de chattekst naar het bord? (nl + en)
const mentionsBoard = (s: string) => /\bbord\b|\bboard\b/i.test(s)

// Eén modelpoging. Gooit bij netwerk/parse-fouten; geeft null bij lege message.
async function attemptExplain(opts: ExplainOpts, boardVisible: boolean): Promise<ExplainResult | null> {
  const raw = await callModel(opts.apiKey, buildExplainPrompt({ ...opts, boardVisible }))
  const parsed = JSON.parse(raw)
  const message = typeof parsed?.message === 'string' ? parsed.message.trim() : ''
  if (!message) return null

  // Telefoon: bord hard uitzetten, ook als het model er toch één stuurt.
  const steps = boardVisible ? sanitizeSteps(parsed?.board) : null
  if (boardVisible && parsed?.board && !steps) {
    console.warn('[explain] bord van model afgekeurd (structuur of rekenfout)')
  }

  const practice = validatePracticePrompt(parsed?.practicePrompt)
  const invite =
    practice == null
      ? ''
      : opts.userLanguage === 'en'
        ? `\n\nWant to try one yourself? Type: ${practice}`
        : `\n\nWil je er nu zelf één proberen? Typ: ${practice}`

  const imageQuery =
    typeof parsed?.imageQuery === 'string' && parsed.imageQuery.trim()
      ? parsed.imageQuery.trim().slice(0, 80)
      : null

  return { message: `${message}${invite}`, steps, imageQuery }
}

export async function generateLlmExplanation(opts: ExplainOpts): Promise<ExplainResult | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await attemptExplain(opts, opts.boardVisible)
      if (!result) continue

      // Bord-belofte zonder bord ("kijk op het bord" terwijl het bord is
      // afgekeurd): één keer opnieuw genereren in inline-vorm, zodat de
      // volledige uitleg in de chat staat en nergens naar een leeg bord wijst.
      if (opts.boardVisible && !result.steps && mentionsBoard(result.message)) {
        try {
          const inline = await attemptExplain(opts, false)
          if (inline) return inline
        } catch {
          /* inline-herkansing mislukt → val door naar de bord-loze message */
        }
        // Laatste redmiddel: zinnen met bordverwijzing wegknippen.
        const stripped = result.message
          .split(/(?<=[.!?])\s+/)
          .filter((s) => !mentionsBoard(s))
          .join(' ')
          .trim()
        if (stripped) return { message: stripped, steps: null, imageQuery: result.imageQuery }
      }

      return result
    } catch (e) {
      const msg = (e as any)?.message || String(e)
      console.warn(`[explain] attempt ${attempt + 1} failed:`, msg)
      // Bij een timeout niet opnieuw proberen: dan is het model traag/stuk en
      // moet de caller snel naar het vangnet (client wacht maximaal ~55s).
      if (String(msg).includes('timeout')) break
    }
  }
  return null
}
