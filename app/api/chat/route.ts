import { GoogleGenerativeAI } from "@google/generative-ai";
import { getUserProfile } from '@/utils/auth';
import { extractMoneyLike } from './skills/ocrUtils'
import {
  getDutchTimeWordProblemSteps,
  solveDutchTimeHoursOnly,
  solveDutchTimeWordProblem,
} from './skills/timeDutch'
import { searchWikimedia } from '@/app/lib/wiki'
import { anatomyCandidates } from '@/utils/anatomyDictionary'
import type { MapSpec } from '@/components/mapTypes'

// SWITCH RUNTIME: Gebruik nodejs runtime voor betere Vision support (geen edge timeout)
export const runtime = 'nodejs';
// INCREASE TIMEOUT: Geef Gemini 60 seconden voor beeldanalyse
export const maxDuration = 60;

const languageMap: Record<string, string> = {
  nl: 'Nederlands', en: 'English', es: 'Español', de: 'Deutsch', fr: 'Français',
  it: 'Italiano', pt: 'Português', zh: 'Chinese', ar: 'Arabic', hi: 'Hindi'
};

export async function POST(req: Request) {
  try {
    // AUTHENTICATIE CHECK: Alleen studenten kunnen chatten
    // TODO: Vervang met echte auth token check
    const userProfile = await getUserProfile();
    
    // FALLBACK: Als er geen profile is, gebruik student fallback (voor development)
    const effectiveProfile = userProfile || {
      id: 'fallback',
      email: 'guest@anima.local',
      role: 'student' as const,
      student_name: 'Rens',
      parent_name: null,
      teacher_name: null
    };
    
    if (effectiveProfile.role !== 'student') {
      console.log(`DEBUG: Chat API toegang geweigerd voor rol: ${effectiveProfile.role}`);
      return new Response(
        JSON.stringify({ error: "Toegang geweigerd. Alleen studenten kunnen chatten." }), 
        { status: 403 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "API Key mist" }), { status: 500 });

    const { messages, data } = await req.json();
    const tutorMode = data?.tutorMode || 'explorer';
    const userAge = data?.userAge || 12;
    const userLanguage = data?.userLanguage || 'nl'; 
    const images = data?.images || (data?.image ? [data.image] : []);
    
    const targetLanguage = languageMap[userLanguage] || 'Nederlands';

    let coachInstructions = "";
    let visualStrategy = "";
    const ageBand: 'junior' | 'teen' | 'student' =
      userAge <= 12 ? 'junior' : userAge <= 16 ? 'teen' : 'student'

    const adaptivePacing = (() => {
      if (ageBand === 'junior') {
        return [
          'ADAPTIVE PACING & TONE (JUNIOR 6-12):',
          '- Pacing: ULTRA-kort. Max 2 zinnen per bericht.',
          '- I Do / We Do / You Do: 1 zin uitleg (I Do), 1 zin samen stap (We Do), eindig met 1 mini-actie (You Do).',
          '- Interactie: na elke zin 1 simpele checkvraag (bijv. "Zie je de rode stip?").',
          "- Toon: enthousiast, warm, veel complimenten. Gebruik simpele metaforen (pizza/lego).",
          '- Visueel: je kunt GEEN afbeeldingen genereren (geen DALL·E/Flux), maar je kunt WEL bestaande afbeeldingen opzoeken via `show_image` (Wikimedia). Zeg dus niet “ik kan geen afbeeldingen”, maar: “Ik zoek het voor je op.” en vul het bord.',
        ].join('\n')
      }
      if (ageBand === 'teen') {
        return [
          'ADAPTIVE PACING & TONE (TEEN 13-16):',
          '- Pacing: normaal. Focus op de kern, geen lange lappen tekst.',
          '- I Do / We Do / You Do: korte methode (I Do), 1 gezamenlijke tussenstap (We Do), dan jij (You Do).',
          '- Interactie: daag uit ("Wat is de volgende stap?").',
          "- Toon: real talk. Niet neerbuigend. Erken dat school soms saai is. Vermijd te veel emoji’s.",
          '- Visueel: je kunt GEEN afbeeldingen genereren, maar je kunt WEL `show_image` (Wikimedia) en `show_map` (Leaflet) gebruiken wanneer passend. Gebruik LaTeX voor formules.',
        ].join('\n')
      }
      return [
        'ADAPTIVE PACING & TONE (STUDENT 17+):',
        '- Pacing: hoog tempo, informatie-dicht maar helder.',
        '- I Do / We Do / You Do: conceptueel kader (I Do), snelle check op begrip (We Do), dan een gerichte oefenactie (You Do).',
        '- Interactie: conceptueel ("Snap je de logica hierachter?").',
        '- Toon: professioneel, efficiënt, academische partner.',
        '- Visueel: je kunt GEEN afbeeldingen genereren, maar je kunt WEL `show_image` (Wikimedia) en `show_map` (Leaflet) gebruiken wanneer passend. Gebruik LaTeX waar relevant.',
      ].join('\n')
    })()
    
    if (tutorMode === 'focus') {
      coachInstructions = "SCAFFOLDED GUIDE: direct richting geven, methode uitleggen. Bij sommen/huiswerk: geef NIET meteen het eindantwoord (ook niet als de gebruiker erom vraagt). Gebruik de 3-level escape hatch; pas bij level 3 (na 3 échte pogingen) mag je het eindantwoord geven + mini-transfer. Kort, zakelijk, geen emoji's. Eindig met een concrete volgende stap (mini-opdracht).";
      visualStrategy = "VISUALS (Blueprint V10): Geen generatieve afbeeldingen. Gebruik Smart Board tools: plot_graph (grafiek), display_formula (LaTeX), show_map (Leaflet), show_image (Wikimedia) wanneer passend volgens routing table + quality gate.";
    } else if (tutorMode === 'growth') {
      coachInstructions = "SCAFFOLDED GUIDE: direct richting geven, methode uitleggen. Bij sommen/huiswerk: geef NIET meteen het eindantwoord (ook niet als de gebruiker erom vraagt). Gebruik de 3-level escape hatch; pas bij level 3 (na 3 échte pogingen) mag je het eindantwoord geven + mini-transfer. Warm, geduldig en ondersteunend (emoji's mag). Eindig met een concrete volgende stap (mini-opdracht).";
      visualStrategy = "VISUALS (Blueprint V10): Geen generatieve afbeeldingen. Gebruik Smart Board tools: plot_graph, display_formula, show_map, show_image wanneer passend volgens routing table + quality gate.";
    } else {
      coachInstructions = "SCAFFOLDED GUIDE: direct richting geven, methode uitleggen. Bij sommen/huiswerk: geef NIET meteen het eindantwoord (ook niet als de gebruiker erom vraagt). Gebruik de 3-level escape hatch; pas bij level 3 (na 3 échte pogingen) mag je het eindantwoord geven + mini-transfer. Vriendelijk en helder, geen 'schooljuf' toon. Eindig met een concrete volgende stap (mini-opdracht).";
      visualStrategy = "VISUALS (Blueprint V10): Geen generatieve afbeeldingen. Gebruik Smart Board tools: plot_graph, display_formula, show_map, show_image wanneer passend volgens routing table + quality gate.";
    }

    const systemPrompt = `
ROL: Anima, AI-tutor. Filosofie: "Warm inzicht boven kille data".
LEEFTIJD: ${userAge} jaar (pas toon/tempo aan).
TAAL: ${targetLanguage.toUpperCase()} (antwoord ALTIJD en ALLEEN in deze taal).
MODE: ${String(tutorMode || 'explorer')} (focus/explorer/growth)

COACH PROFIEL: ${coachInstructions}
VISUAL STRATEGY: ${visualStrategy}
${adaptivePacing}

NORTH STAR (LOW-FRICTION TUTOR — HOUD DIT ALTIJD AAN)
1) Leeractie boven tekst: elk bericht is ontworpen om de leerling 1 kleine denk-actie te laten doen.
2) Kort is pedagogisch: geen lappen tekst, geen rambling, geen extra weetjes als het niet nodig is.
3) Context eerst: bepaal altijd of dit (A) kennisvraag, (B) opgave/probleem, of (C) vastlopen is.
4) Methode vóór uitkomst (bij opgaven): geef structuur + 1 stap; geen eindantwoord in de eerste beurt.
5) Stop als het klaar is: stop alleen als de leerling de **concrete eindoutput** heeft gegeven (eindantwoord/definitie/gevraagde tekst) of expliciet stopt. “Ja/ok” telt nooit als bewijs.
6) Visuals zijn een hefboom, niet een ritueel: gebruik visuals wanneer ze begrip aantoonbaar versnellen (grafiek/kaart/figuur/anatomie) of als de leerling erom vraagt.
7) Frustratie = valve: bij vastlopen escaleer je deterministisch (escape hatch).

INTENT-PROTOCOL (STRIKT)
- KENNISVRAAG: geef een direct antwoord in 1–3 zinnen. Daarna mag je stoppen met 1 korte afsluitzin (zonder vraagteken). Geen druk.
- OPGAVE/PROBLEEM: geef 1–2 zinnen methode + eindig met EXACT 1 micro-opdracht.
  - Default micro-opdracht bij rekenen: **Compute** (één berekening) of **Fill‑blank** (één invulplek "__").
  - Vermijd keuzevragen tenzij kiezen echt nodig is.
- VERBODEN (LOW-FRICTION):
  - Geen gokvragen: niet “denk je dat…?”, “zou het kunnen…?”, “past het vaker dan…?”
  - Geen meta‑vragen: niet “schrijf je berekening”, “wat is je volgende stap” (behalve bij vastlopen).
- BELANGRIJK:
  - Geef nooit een bericht dat alleen uit lof bestaat (“Super!”, “Top!”). Als je bevestigt, geef meteen de volgende concrete stap (tenzij je stopt volgens de stopcriteria).
- VASTLOPEN (escape hatch 3-level):
  - Wat telt als "poging": alleen echt werk (stap/redenering/bewerking), niet alleen "ok/ja" en niet alleen een los getal.
  - Level 1: regel-hint + mini-checkvraag (geen eindantwoord).
  - Level 2: werk precies 1 stap uit met 1 blanco "__" (nog geen eindantwoord).
  - Level 3: (na ≥3 echte pogingen) eindantwoord + 2 korte zinnen waarom + 1 mini transfer-oefenvraag. Kort houden.

ANTI-SORRY: geen standaard excuses. Zeg: "Oké—stap 1 is…".
INSTANT: geen "even denken". Start meteen.

VISUALS (TOOLS)
- plot_graph: functies/grafieken/plotten (als het helpt of gevraagd).
- show_map: locaties/topografie (alleen bij locatie-intent).
- show_image: biologie/anatomie, geschiedenis, kunst (alleen feitelijk via Wikimedia; geen verzonnen URLs).
- display_formula: formules/vergelijkingen/reactievergelijkingen.
QUALITY GATE: liever geen visual dan een foute.

MATH: gebruik LaTeX in message voor formules (inline $...$ of blok $$...$$).

REKEN-STOPREGEL (BELANGRIJK, STUDENT-PROOF)
- Als jij een *directe rekenvraag* stelt (bijv. "Wat is 92/2?" of "Wat is 17+28?") en de leerling antwoordt met een getal:
  - Als het antwoord correct is: bevestig kort en STOP (geen nieuwe vraag, geen eenheden-vraag).
  - Vraag NIET naar eenheden tenzij de vraag duidelijk een verhaalsom is met eenheden/context.

OUTPUT-CONTRACT (CRITICAL)
- Geef ALLEEN geldige JSON terug, zonder extra tekst ervoor/erna.
- message = natuurlijke taal (met LaTeX waar nodig). NOOIT JSON/code in message.
- Gebruik alleen deze velden:
  { "message": "...", "topic": "...", "action": "none|plot_graph|show_map|show_image|display_formula",
    "graph": { "expressions": ["x^2"], "points": [{"x":0,"y":0,"label":"top"}] },
    "map": { "lat": 0, "lng": 0, "zoom": 10, "title": "..." },
    "image": { "query": "...", "caption": "..." },
    "formula": { "latex": "$$...$$", "title": "..." } }
`;

    const genAI = new GoogleGenerativeAI(apiKey);
    // Prefer JSON-only responses to reduce fragile formatting. If unsupported, Gemini will ignore it.
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const dataUrlToInlineDataPart = (imgData: string) => {
      const matches = imgData.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/)
      if (matches && matches.length === 3) {
        return {
          inlineData: {
            data: matches[2],
            mimeType: matches[1],
          },
        }
      }
      const base64Data = imgData.includes(',') ? imgData.split(',')[1] : imgData
      return {
        inlineData: {
          data: base64Data,
          mimeType: 'image/jpeg',
        },
      }
    }

    const messageToGeminiParts = (msg: any) => {
      const parts: any[] = []
      const text = typeof msg?.content === 'string' ? msg.content : ''
      if (text.trim()) parts.push({ text })

      // IMPORTANT: Preserve image context across turns by including prior user images in history.
      // This avoids "context reset" for follow-up replies like "7" -> "7:25" after a worksheet photo.
      const imgs: any[] = Array.isArray(msg?.images) ? msg.images : []
      if (msg?.role === 'user' && imgs.length > 0) {
        for (const img of imgs) {
          if (typeof img === 'string' && /^data:image\//i.test(img)) {
            parts.push(dataUrlToInlineDataPart(img))
          }
        }
      }
      return parts.length ? parts : [{ text: '' }]
    }

    const previousHistory = (Array.isArray(messages) ? messages.slice(0, -1) : []).map((msg: any) => ({
      role: msg?.role === 'user' ? 'user' : 'model',
      parts: messageToGeminiParts(msg),
    }));

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: `Begrepen. Ik ben een "Scaffolded Guide": ik leg de methode uit en wijs details aan. Bij sommen/huiswerk geef ik niet meteen het eindantwoord; ik gebruik de 3-level escape hatch en geef pas bij level 3 (na 3 échte pogingen) het eindantwoord + mini-transfer.` }] },
        ...previousHistory
      ],
    });

    const lastMessage = messages[messages.length - 1]
    const lastMessageContent = lastMessage?.content || '';
    let userParts: any[] = [{ text: lastMessageContent }];
    
    // IMAGE PAYLOAD: Controleer en verwerk afbeeldingen correct
    if (images.length > 0) {
        console.log(`[CHAT API] Verwerken van ${images.length} afbeelding(en)...`);
        images.forEach((imgData: string, index: number) => {
             const part = dataUrlToInlineDataPart(imgData)
             const len = part?.inlineData?.data?.length || 0
             const mt = part?.inlineData?.mimeType || 'image/jpeg'
             console.log(`[CHAT API] Afbeelding ${index + 1}: mimeType=${mt}, dataLength=${len}`);
             userParts.push(part)
        });
        userParts[0].text += `\n\n[Systeem: De gebruiker heeft ${images.length} afbeelding(en) geüpload. Kijk goed naar de inhoud.]`;
        console.log(`[CHAT API] ${images.length} afbeelding(en) toegevoegd aan userParts`);
    }

    // ROBUST LOGGING: Log de aanroep naar Gemini
    console.log(`[CHAT API] Versturen naar Gemini: ${userParts.length} parts (${userParts.filter(p => p.text).length} text, ${userParts.filter(p => p.inlineData).length} images)`);
    
    const extractJsonFromModelText = (rawText: string): string | null => {
      const t = (rawText || '').trim()
      if (!t) return null

      // Prefer fenced json
      const fencedJson = t.match(/```json\s*(\{[\s\S]*?\})\s*```/i)
      if (fencedJson && fencedJson[1]) return fencedJson[1].trim()

      // Any fenced block that contains a JSON object
      const fencedAny = t.match(/```\s*(\{[\s\S]*?\})\s*```/i)
      if (fencedAny && fencedAny[1]) return fencedAny[1].trim()

      // If it *is* a JSON object already
      if (t.startsWith('{') && t.endsWith('}')) return t

      // Robust fallback: take substring from first "{" to last "}" (handles leading/trailing text)
      const first = t.indexOf('{')
      const last = t.lastIndexOf('}')
      if (first !== -1 && last !== -1 && last > first) {
        return t.slice(first, last + 1).trim()
      }

      return null
    }

    const sanitizeMessageForDisplay = (raw: string): string => {
      let t = String(raw || '').trim()
      if (!t) return ''

      // If the model accidentally echoed JSON inside the `message` (often as a fenced block),
      // strip it deterministically. Students should NEVER see JSON/code.
      //
      // 1) Try to extract `message` from any fenced block that parses as JSON.
      const fencedRe = /```[^\n]*\n?([\s\S]*?)```/g
      let match: RegExpExecArray | null
      while ((match = fencedRe.exec(t))) {
        const inner = String(match[1] || '').trim()
        if (inner.startsWith('{') && inner.endsWith('}')) {
          try {
            const parsed = JSON.parse(inner)
            if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
              return String(parsed.message).trim()
            }
          } catch {
            // ignore
          }
        }
      }

      // 2) Remove any fenced blocks that *look* like JSON (even if not labeled ```json).
      t = t
        .replace(/```[^\n]*\n?\{[\s\S]*?\}\s*```/g, '')
        .replace(/```json[\s\S]*?```/gi, '')
        .trim()

      // If the message itself is a JSON object, try to extract its `message` field.
      const looksJson = t.startsWith('{') && t.endsWith('}')
      if (looksJson) {
        try {
          const parsed = JSON.parse(t)
          if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
            return String(parsed.message).trim()
          }
        } catch {
          // ignore
        }
      }

      // If it contains common JSON keys, try to extract embedded object and use its `message`.
      if (/"(message|graph|image|topic|action)"\s*:/.test(t) && t.includes('{') && t.includes('}')) {
        const first = t.indexOf('{')
        const last = t.lastIndexOf('}')
        if (first !== -1 && last !== -1 && last > first) {
          const slice = t.slice(first, last + 1)
          try {
            const parsed = JSON.parse(slice)
            if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
              return String(parsed.message).trim()
            }
          } catch {
            // ignore
          }
        }
      }

      return t
    }

    // Ensure common LaTeX commands render even if the model forgets $...$ fences.
    // We only rewrite *outside* existing $...$ / $$...$$ math segments.
    const autoWrapLatexOutsideMath = (text: string): string => {
      const s = String(text || '')
      if (!s.includes('\\frac')) return s

      let out = ''
      let i = 0
      let mode: 'text' | 'inline' | 'block' = 'text'

      const at = (idx: number) => s.slice(idx)
      const isEscaped = (idx: number) => idx > 0 && s[idx - 1] === '\\'

      while (i < s.length) {
        // Detect $$ (block math)
        if (!isEscaped(i) && at(i).startsWith('$$')) {
          out += '$$'
          i += 2
          mode = mode === 'block' ? 'text' : mode === 'text' ? 'block' : mode
          continue
        }
        // Detect $ (inline math)
        if (!isEscaped(i) && s[i] === '$') {
          out += '$'
          i += 1
          mode = mode === 'inline' ? 'text' : mode === 'text' ? 'inline' : mode
          continue
        }

        if (mode === 'text') {
          // Wrap \frac{a}{b} and \dfrac{a}{b}
          const rest = at(i)
          const m = rest.match(/^(\\(?:d)?frac)\{([^{}]{1,40})\}\{([^{}]{1,40})\}/)
          if (m) {
            out += `$${m[1]}{${m[2]}}{${m[3]}}$`
            i += m[0].length
            continue
          }
        }

        out += s[i]
        i += 1
      }

      return out
    }

    const validatePayload = (p: any) => {
      if (!p || typeof p !== 'object') return { ok: false as const, error: 'Payload is not an object' }
      if (typeof p.message !== 'string' || !p.message.trim()) return { ok: false as const, error: 'Missing message string' }
      if (p.formula != null) {
        if (typeof p.formula !== 'object') return { ok: false as const, error: 'formula must be object or null/undefined' }
        if (typeof p.formula.latex !== 'string' || !p.formula.latex.trim()) return { ok: false as const, error: 'formula.latex must be a non-empty string' }
        if (p.formula.title != null && typeof p.formula.title !== 'string') return { ok: false as const, error: 'formula.title must be string if present' }
      }
      if (p.graph != null) {
        if (typeof p.graph !== 'object') return { ok: false as const, error: 'graph must be object or null/undefined' }
        if (!Array.isArray(p.graph.expressions)) return { ok: false as const, error: 'graph.expressions must be an array' }
        for (const e of p.graph.expressions) {
          if (typeof e !== 'string' || !e.trim()) return { ok: false as const, error: 'graph.expressions[] must be non-empty strings' }
        }
        if (p.graph.points != null) {
          if (!Array.isArray(p.graph.points)) return { ok: false as const, error: 'graph.points must be an array' }
          for (const pt of p.graph.points) {
            if (!pt || typeof pt !== 'object') return { ok: false as const, error: 'graph.points[] must be objects' }
            if (typeof pt.x !== 'number' || typeof pt.y !== 'number') return { ok: false as const, error: 'graph.points[].x/.y must be numbers' }
            if (pt.label != null && typeof pt.label !== 'string') return { ok: false as const, error: 'graph.points[].label must be string if present' }
            if (pt.color != null && typeof pt.color !== 'string') return { ok: false as const, error: 'graph.points[].color must be string if present' }
          }
        }
      }
      if (p.image != null) {
        if (typeof p.image !== 'object') return { ok: false as const, error: 'image must be object or null/undefined' }
        const hasUrl = typeof p.image.url === 'string' && p.image.url.trim()
        const hasQuery = typeof p.image.query === 'string' && p.image.query.trim()
        if (!hasUrl && !hasQuery) return { ok: false as const, error: 'image must include url or query' }
        if (p.image.caption != null && typeof p.image.caption !== 'string') return { ok: false as const, error: 'image.caption must be string if present' }
        if (p.image.sourceUrl != null && typeof p.image.sourceUrl !== 'string') return { ok: false as const, error: 'image.sourceUrl must be string if present' }
      }
      if (p.map != null) {
        if (typeof p.map !== 'object') return { ok: false as const, error: 'map must be object or null/undefined' }
        if (p.map.title != null && typeof p.map.title !== 'string') return { ok: false as const, error: 'map.title must be string if present' }
        if (p.map.zoom != null && typeof p.map.zoom !== 'number') return { ok: false as const, error: 'map.zoom must be number if present' }
        // Accept tool-style maps: { lat, lng, zoom, title }
        if (p.map.lat != null || p.map.lng != null) {
          if (typeof p.map.lat !== 'number' || typeof p.map.lng !== 'number') {
            return { ok: false as const, error: 'map.lat/lng must be numbers if present' }
          }
        }
        if (p.map.center != null) {
          if (typeof p.map.center !== 'object') return { ok: false as const, error: 'map.center must be object if present' }
          if (typeof p.map.center.lat !== 'number' || typeof p.map.center.lon !== 'number') return { ok: false as const, error: 'map.center.lat/lon must be numbers' }
        }
        if (p.map.markers != null) {
          if (!Array.isArray(p.map.markers)) return { ok: false as const, error: 'map.markers must be array if present' }
          for (const m of p.map.markers) {
            if (!m || typeof m !== 'object') return { ok: false as const, error: 'map.markers[] must be objects' }
            if (typeof m.lat !== 'number' || typeof m.lon !== 'number') return { ok: false as const, error: 'map.markers[].lat/lon must be numbers' }
            if (m.label != null && typeof m.label !== 'string') return { ok: false as const, error: 'map.markers[].label must be string if present' }
          }
        }
        if (p.map.queries != null) {
          if (!Array.isArray(p.map.queries)) return { ok: false as const, error: 'map.queries must be array if present' }
          for (const q of p.map.queries) {
            if (!q || typeof q !== 'object' || typeof q.query !== 'string' || !q.query.trim()) {
              return { ok: false as const, error: 'map.queries[].query must be a non-empty string' }
            }
          }
        }
      }
      if (p.topic != null && typeof p.topic !== 'string') return { ok: false as const, error: 'topic must be string or null/undefined' }
      if (p.action != null && typeof p.action !== 'string') return { ok: false as const, error: 'action must be string or null/undefined' }
      return { ok: true as const }
    }

    console.log(`[CHAT API] Gemini request gestart (non-stream, JSON contract)`)
    const lower = (lastMessageContent || '').toLowerCase()

    const isBodyPartTopic = (() => {
      // IMPORTANT: use word boundaries for short tokens like "oor" to avoid false positives (e.g. "dOOR").
      return /menselijk lichaam|lichaamsdeel|\bhand\b|\bvinger(s)?\b|\bvoet(en)?\b|\bteen(s)?\b|\benkel\b|\bknie\b|\barm(en)?\b|\bbeen(deren)?\b|\belleboog\b|\bschouder\b|\bheup\b|\brib(ben)?\b|\bschedel\b|\boor\b|\boren\b|\boog\b|\bogen\b|\bneus\b|\bmond\b|\bkeel\b|\bhuid\b/.test(
        lower
      )
    })()

    const isExplicitAnatomy = (() => {
      // Words that imply anatomy/structure, not just appearance
      return /anatomie|bot|botten|skelet|spier|spieren|pees|pezen|band|banden|orgaan|organen|doorsnede|spijsverter|bloedsomloop|ademhaling|zenuwstelsel|grays|gray's|gray|plaat|wikimedia|label|gelabeld/.test(
        lower
      )
    })()


    const needsGraph = (() => {
      // Interactive graphs are allowed via JSON { graph: { expressions: [...] } }
      return /grafiek|plot|plotten|functie|parabool|lijn\s+door|teken\s+de\s+grafiek|grafiek\s+van|y\s*=/.test(lower)
    })()

    const wantsMarkedPoints = (() => {
      return /markeer|punt|punten|top|toppen|snijpunt|snijpunten|oorsprong|vertex/.test(lower)
    })()

    const needsMap = (() => {
      // Map requests (geography/topography) – only when there is *location intent*.
      // Avoid false positives like "Westland" (contains "land") when the user asks "bekend door/om".
      if (/bekend\s+(door|om)\b/.test(lower)) return false
      return /kaart|map\b|op\s+de\s+kaart|waar\s+ligt|locatie\s+van|co[oö]rdina(t|at)en|latitude|longitude|\blat\b|\blng\b|topografie|hoofdstad|capital/.test(
        lower
      )
    })()

    const needsFormula = (() => {
      // Formula/definition requests: show formula on board + LaTeX in chat.
      // Keep broad but avoid graph/map being misrouted.
      if (needsGraph || needsMap) return false
      return /formule|definitie|vergelijking|reactievergelijking|abc-?formule|pythagoras|stelling|fotosynthese|photosynthesis/.test(
        lower
      )
    })()

    const needsImage = (() => {
      // Curator images (Wikimedia) per Blueprint V10:
      // - Always for anatomy/body parts (high factual value).
      // - Otherwise only if the user explicitly asks to see it ("toon/hoe ziet/laat zien/...").
      // Never for graphs/maps.
      if (needsGraph || needsMap) return false
      if (isBodyPartTopic || isExplicitAnatomy) return true
      // IMPORTANT: use word boundaries so we don't match substrings like "foto" in "fotosynthese".
      return /hoe\s+ziet|laat\s+(me\s+)?zien|toon\b|show\b|plaatje|afbeelding|\bfoto(?:'s)?\b|\bphoto(?:s)?\b|picture|\bimage\b/.test(
        lower
      )
    })()

    const imageQueryPreset = (text: string): { query: string; caption?: string } | null => {
      const t = (text || '').toLowerCase()
      if (t.includes('nachtwacht')) return { query: 'The Night Watch Rembrandt painting', caption: 'De Nachtwacht (Rembrandt)' }
      if (t.includes('mona lisa') || t.includes('monalisa')) return { query: 'Mona Lisa', caption: 'Mona Lisa (Leonardo da Vinci)' }
      if (t.includes('fotosynthese') || t.includes('photosynthesis')) return { query: 'photosynthesis', caption: 'Fotosynthese' }
      // Anatomy presets: prefer canonical English terms for en.wikipedia queries
      const dict = anatomyCandidates(text || '')
      if (dict.canonical) return { query: dict.canonical, caption: (text || '').trim() }
      return null
    }

    const extractLatexBlock = (text: string): string | null => {
      const t = String(text || '')
      const block = t.match(/\$\$[\s\S]*?\$\$/)
      if (block) return block[0]
      const inline = t.match(/\$([^$\n]+?)\$/)
      if (inline?.[1]) return `$$\n${inline[1].trim()}\n$$`
      return null
    }

    const geocodeNominatim = async (query: string): Promise<{ lat: number; lon: number } | null> => {
      const q = String(query || '').trim()
      if (!q) return null
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('q', q)
      url.searchParams.set('limit', '1')
      url.searchParams.set('addressdetails', '0')
      const res = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Anima/1.0 (board-maps; server)',
          Accept: 'application/json',
        },
        cache: 'no-store',
      })
      if (!res.ok) return null
      const arr: any[] = await res.json().catch(() => [])
      const top = arr?.[0]
      const lat = top?.lat != null ? Number(top.lat) : NaN
      const lon = top?.lon != null ? Number(top.lon) : NaN
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return { lat, lon }
    }

    const extractGraphExpressions = (text: string): string[] => {
      const t = String(text || '')
      if (!t.trim()) return []

      // Common patterns:
      // - "Teken de grafiek van x^2"
      // - "Teken y = x^2"
      // - "Plot x^2 en x+2"
      // Try to capture segments after "van", "y =", or inside quotes.
      const candidates: string[] = []

      const quoted = t.match(/["“”']([^"“”']{1,80})["“”']/g)
      if (quoted) {
        for (const q of quoted) {
          const inner = q.replace(/^["“”']|["“”']$/g, '').trim()
          if (inner) candidates.push(inner)
        }
      }

      const afterVan = t.match(/grafiek\s+van\s+(.+)$/i)
      if (afterVan?.[1]) candidates.push(afterVan[1])

      const afterYEq = t.match(/\by\s*=\s*([^\n\r;]+)$/i)
      if (afterYEq?.[1]) candidates.push(afterYEq[1])

      // Split candidate blocks into individual expressions.
      const splitters = /(?:,|;|\ben\b|\band\b|\&)/
      const expressions: string[] = []
      for (const c of candidates) {
        const parts = c
          .split(splitters)
          .map((s) => s.trim())
          .filter(Boolean)
        for (const p of parts) {
          // Keep only plausible mathjs expressions: must contain x or a digit/operator combo
          const cleaned = p
            .replace(/\s+/g, ' ')
            .replace(/^\s*(?:y\s*=\s*)/i, '')
            .trim()
          if (!cleaned) continue
          if (!/[xX]/.test(cleaned) && !/[0-9]/.test(cleaned)) continue
          // Remove trailing punctuation
          const final = cleaned.replace(/[.?!]+$/g, '').trim()
          if (final) expressions.push(final)
        }
      }

      // Fallback: if nothing matched but the prompt contains x^... somewhere, capture the token-ish expression.
      if (expressions.length === 0) {
        const simple = t.match(/(?:y\s*=\s*)?([0-9xX+\-*/^().\s]{1,40})/)
        const maybe = simple?.[1]?.trim()
        if (maybe && /[xX]/.test(maybe)) expressions.push(maybe.replace(/^y\s*=\s*/i, '').trim())
      }

      // Deduplicate preserving order
      const seen = new Set<string>()
      const out: string[] = []
      for (const e of expressions) {
        const k = e.replace(/\s+/g, '')
        if (seen.has(k)) continue
        seen.add(k)
        out.push(e)
      }
      return out.slice(0, 4)
    }

    const partsCloneWithTextSuffix = (parts: any[], suffix: string) => {
      const cloned = parts.map((p) => ({ ...p }))
      if (cloned.length > 0 && typeof cloned[0]?.text === 'string') {
        cloned[0].text = `${cloned[0].text}${suffix}`
      }
      return cloned
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    const isTransientModelError = (e: any) => {
      const msg = String(e?.message || e || '').toLowerCase()
      return (
        msg.includes('unavailable') ||
        msg.includes('overload') ||
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('econnreset') ||
        msg.includes('socket') ||
        msg.includes('fetch failed') ||
        msg.includes('network') ||
        msg.includes('429') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('rate')
      )
    }

    const runOnce = async (parts: any[]) => {
      const r = await chat.sendMessage(parts)
      const txt = (r as any)?.response?.text?.() ? (r as any).response.text() : (r as any)?.response?.text?.() || ''
      return String(txt || '')
    }

    const runOnceWithRetry = async (parts: any[], label: string, maxAttempts: number = 2) => {
      let lastErr: any = null
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (attempt > 1) console.log(`[CHAT API] Retry ${attempt}/${maxAttempts} for ${label}`)
          return await runOnce(parts)
        } catch (e: any) {
          lastErr = e
          const transient = isTransientModelError(e)
          console.warn(`[CHAT API] Model error (${label}) attempt ${attempt}/${maxAttempts}:`, {
            message: e?.message || String(e),
            transient,
          })
          if (!transient || attempt === maxAttempts) break
          await sleep(700 * attempt)
        }
      }
      throw lastErr || new Error('Model error')
    }

    // --- VISION READING ACCURACY (2-pass OCR for workbook / reading comprehension photos) ---
    const wantsPreciseReading = (() => {
      if (images.length === 0) return false
      const t = (lastMessageContent || '').toLowerCase()
      // Typical signals: workbook page, reading comprehension, "read this", "what does it say", etc.
      return /begrijpend|lees|lezen|werkboek|tekst|alinea|zinnen|vraag\s*\d+|opdracht|wat staat|haal uit de tekst|citeer|onderstreep/.test(
        t
      )
    })()

    let ocrTranscript: string | null = null
    let ocrConfidence: 'high' | 'medium' | 'low' | null = null

    if (wantsPreciseReading) {
      try {
        const ocrAddon =
          '\n\n[SYSTEEM OVERRIDE (OCR-ONLY): Je taak is NU alleen: lees de foto en schrijf de tekst exact over. GEEN uitleg, GEEN antwoord, GEEN aannames. Als iets onleesbaar is, schrijf [ONLEESBAAR]. Behoud regels/opsomming.\nOUTPUT: Geef ALLEEN geldige JSON in dit schema:\n{ "transcript": "....", "confidence": "high|medium|low" }\nRegels: transcript is letterlijk (geen verbeteringen), confidence=low als delen onleesbaar zijn.]'
        const ocrParts = partsCloneWithTextSuffix(userParts, ocrAddon)
        const ocrRaw = await runOnceWithRetry(ocrParts, 'ocr', 2)
        const ocrJsonText = extractJsonFromModelText(ocrRaw)
        if (ocrJsonText) {
          const o = JSON.parse(ocrJsonText)
          if (typeof o?.transcript === 'string' && o.transcript.trim()) {
            ocrTranscript = o.transcript.trim()
            if (o.confidence === 'high' || o.confidence === 'medium' || o.confidence === 'low') {
              ocrConfidence = o.confidence
            }
          }
        }
      } catch {
        // ignore OCR failures; we'll fall back to normal single-pass
      }
    }

    const makeLowConfidenceMessage = () => {
      const amounts = ocrTranscript ? extractMoneyLike(ocrTranscript) : []
      const lang = String(userLanguage || 'nl')
      if (lang === 'en') {
        return [
          `I can’t read the amounts reliably from this photo yet (OCR confidence: ${ocrConfidence}).`,
          amounts.length ? `I think I see these amounts: ${amounts.join(', ')}.` : `I can’t confidently detect the amounts.`,
          `Can you send a close-up of the receipt table (fill the frame, less shadow/glare)?`,
        ].join('\n')
      }
      return [
        `Ik kan de bedragen nog niet betrouwbaar lezen uit deze foto (OCR-confidence: ${ocrConfidence}).`,
        amounts.length ? `Ik denk dat ik deze bedragen zie: ${amounts.join(', ')}.` : `Ik kan de bedragen niet zeker herkennen.`,
        `Kun je een close-up sturen van het kassabon-tabelletje (beeldvullend, minder schaduw/reflectie)?`,
      ].join('\n')
    }

    // --- ESCAPE HATCH (SERVER-SIDE, DETERMINISTIC) ---
    // Trigger only when the user explicitly signals being stuck.
    const isStuckSignal = (s: string) => {
      const t = String(s || '').toLowerCase().trim()
      return (
        /^(help|hulp)\b/.test(t) ||
        /(ik\s+snap\s+het\s+niet|snap\s+het\s+niet|geen\s+idee|ik\s+begrijp\s+het\s+niet|lukt\s+niet|ik\s+kom\s+er\s+niet\s+uit|vastgelopen)/.test(t)
      )
    }

    // "Echte poging" heuristic: must show work/reasoning, not just a final answer token.
    const isWorkAttempt = (s: string) => {
      const t = String(s || '').trim()
      if (!t) return false
      // Exclude ACK-only and ultra-short tokens
      if (t.length <= 4) return false
      if (/^(ok(é|ay)?|ja|nee|yes|no|yep|nope)\b[!.]*$/i.test(t)) return false
      // Pure number/time/letter answers don't count as "work"
      if (/^\s*\d+([.,]\d+)?\s*$/.test(t)) return false
      if (/^\s*[a-fA-F]\s*$/.test(t)) return false
      if (/^\s*\d{1,2}:\d{2}\s*$/.test(t)) return false

      const lowerT = t.toLowerCase()
      const hasOps = /[+\-*/^=]/.test(t) || /\\frac|\\sqrt/.test(t)
      const hasMultiNumbers = (t.match(/\d+/g) || []).length >= 2
      const hasReasoningWords = /\b(omdat|dus|want|eerst|dan|stap|volgens|ik\s+denk|ik\s+doe)\b/.test(lowerT)
      const hasUnits = /\b(€|euro|cent|km|m|cm|mm|kg|g|uur|min(uten)?|seconde(n)?|procent|%)\b/i.test(t)

      return hasOps || hasMultiNumbers || hasReasoningWords || hasUnits
    }

    const escapeHatchLevel = (() => {
      const lastUser = String(lastMessageContent || '').trim()
      if (!isStuckSignal(lastUser)) return 0

      const arr = Array.isArray(messages) ? messages : []
      const recentUserTexts = arr
        .filter((m: any) => m?.role === 'user')
        .slice(-10)
        .map((m: any) => String(m?.content || '').trim())

      // Count only "work attempts" in recent history (excluding current stuck signal turn)
      const workAttempts = recentUserTexts
        .slice(0, -1)
        .filter((t: string) => isWorkAttempt(t)).length

      if (workAttempts >= 3) return 3
      if (workAttempts >= 1) return 2
      return 1
    })()

    // If OCR itself says medium/low confidence, do NOT proceed to "answer" (prevents wrong amounts).
    if (wantsPreciseReading && ocrTranscript && ocrConfidence && ocrConfidence !== 'high') {
      return new Response(
        JSON.stringify({
          message: makeLowConfidenceMessage(),
          action: 'none',
          topic: 'Begrijpend lezen / OCR',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Deterministic guardrail for common Dutch time word problems (prevents model mistakes like 2pm -> 2am).
    if (wantsPreciseReading && ocrTranscript && ocrConfidence === 'high') {
      const solved = solveDutchTimeWordProblem(ocrTranscript)
      const steps = getDutchTimeWordProblemSteps(ocrTranscript)
      if (solved && steps) {
        const lang = String(userLanguage || 'nl')
        // Always stay scaffolded: guide method, avoid the final time/option (Blueprint V9).
        const msg = (() => {
          const { startHHMM, afterHoursHHMM, hoursPart, minsPart } = steps

          // Split into 2–3 micro-tasks with blanks. Do NOT reveal the final end time or option.
          return lang === 'en'
            ? [
                `Step by step (you fill it in):`,
                `- **Mini-step 1**: 2 pm → **${startHHMM}** (24h time).`,
                `- **Mini-step 2**: ${startHHMM} + ${hoursPart} hours = **__ : __**`,
                `- **Mini-step 3**: Then add the last ${minsPart} minutes → **__ : __**`,
                `Now look at the answer options: which one matches your final time?`,
              ].join('\n')
            : [
                `Stap voor stap (jij vult het in):`,
                `- **Mini-stap 1**: 2 uur ’s middags → **${startHHMM}** (24-uurs tijd).`,
                `- **Mini-stap 2**: ${startHHMM} + ${hoursPart} uur = **__ : __**`,
                `- **Mini-stap 3**: Tel dan de laatste ${minsPart} minuten erbij → **__ : __**`,
                `Kijk nu naar de antwoordopties: welke past bij jouw eindtijd?`,
              ].join('\n')
        })()

        return new Response(
          JSON.stringify({
            message: msg,
            action: 'none',
            topic: lang === 'en' ? 'Time calculation' : 'Tijdrekenen',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // Follow-up text questions (without re-uploading the image) should still respect "’s middags" -> 24h.
    // This prevents regressions like treating 2pm as 2am in subsequent turns.
    const isDutchClockTimeSession = (() => {
      const msgs = Array.isArray(messages) ? messages.slice(-12) : []
      const blob = msgs
        .map((m: any) => String(m?.content || ''))
        .join('\n')
        .toLowerCase()
      // IMPORTANT: This should ONLY trigger for clock-time problems (e.g. 14:00 + duration),
      // NOT for generic “how many hours” word problems (travel, speed, etc.).
      const hasClockMarkers =
        /\b\d{1,2}:\d{2}\b/.test(blob) ||
        /24-?uurs/.test(blob) ||
        /tijdrekenen|tijdstip|klok|eindtijd|begintijd/.test(blob) ||
        /\'s\s+(ochtends|middags|avonds|nachts)/.test(blob) ||
        /kaars/.test(blob)
      const hasOurTimeScaffold =
        /mini-?stap/.test(blob) && (/__\s*:\s*__/.test(blob) || /14:00|19:25|24-?uurs/.test(blob))
      return hasClockMarkers || hasOurTimeScaffold
    })()

    const isShortAttempt = /^\s*\d{1,2}(:\d{2})?\s*$/.test(String(lastMessageContent || ''))
    if (isDutchClockTimeSession && isShortAttempt) {
      const lang = String(userLanguage || 'nl')
      const t = String(lastMessageContent || '').trim()
      const isHourOnly = /^\d{1,2}$/.test(t)
      const lastAssistantText = (() => {
        const arr = Array.isArray(messages) ? messages : []
        for (let i = arr.length - 2; i >= 0; i--) {
          const m = arr[i]
          if (m?.role && m.role !== 'user') return String(m?.content || '')
        }
        return ''
      })()
      const lastAssistantLower = lastAssistantText.toLowerCase()
      const askedMinutesConversion =
        /hoeveel\s+minu?t/i.test(lastAssistantText) ||
        (lastAssistantLower.includes('minuten') && /omzetten|zet\s+om|naar\s+minuten/.test(lastAssistantLower))

      const findStartTime = (() => {
        const msgs = Array.isArray(messages) ? messages.slice(-12) : []
        const blob = msgs.map((m: any) => String(m?.content || '')).join('\n')
        const m = blob.match(/\b(\d{1,2}):(\d{2})\b/)
        if (!m) return null
        const hh = String(m[1]).padStart(2, '0')
        const mm = String(m[2]).padStart(2, '0')
        return `${hh}:${mm}`
      })()

      const msg =
        lang === 'en'
          ? askedMinutesConversion
            ? [
                `Got it — we’ll work with **${t} minutes**.`,
                `Now add that to the start time${findStartTime ? ` (**${findStartTime}**)` : ''}.`,
                `Do it in 2 tiny steps: +60 minutes → **__ : __**, then +35 minutes → **__ : __**.`,
                `What time do you get after the **+60 minutes** step?`,
              ].join('\n')
            : isHourOnly
              ? [
                  `Nice — you wrote **${t}**.`,
                  `Write the time with minutes as **__ : __** and tell me what it is.`,
                ].join('\n')
              : [
                  `Good attempt. Let’s do the next micro-step (no final answer yet):`,
                  `Write your next time as **__ : __** (with minutes).`,
                ].join('\n')
          : askedMinutesConversion
            ? [
                `Oké — we rekenen met **${t} minuten**.`,
                `Tel dat op bij de starttijd${findStartTime ? ` (**${findStartTime}**)` : ''}.`,
                `Doe het in 2 mini-stappen: +60 minuten → **__ : __**, daarna +35 minuten → **__ : __**.`,
                `Welke tijd krijg je na de **+60 minuten** stap?`,
              ].join('\n')
            : isHourOnly
              ? [
                  `Mooi — jij schreef **${t}**.`,
                  `Schrijf de tijd mét minuten als **__ : __** en stuur die.`,
                ].join('\n')
              : [
                  `Goede poging. We doen de volgende micro-stap (nog geen eindantwoord):`,
                  `Schrijf je volgende tijd als **__ : __** (met minuten).`,
                ].join('\n')

      return new Response(
        JSON.stringify({ message: msg, action: 'none', topic: lang === 'en' ? 'Time calculation' : 'Tijdrekenen' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const hoursOnly = solveDutchTimeHoursOnly(lastMessageContent)
    if (hoursOnly) {
      const lang = String(userLanguage || 'nl')
      const msg =
        lang === 'en'
          ? [
              `Let’s do only this step (no final answer yet).`,
              `Mini-step 1: 2 pm → **${hoursOnly.startHHMM}** (24h time).`,
              `Mini-step 2: ${hoursOnly.startHHMM} + ${hoursOnly.durHours} hours = **__ : __**`,
              `What hour do you get?`,
            ].join('\n')
          : [
              `We doen alleen deze stap (nog geen eindantwoord).`,
              `Mini-stap 1: 2 uur ’s middags → **${hoursOnly.startHHMM}** (24-uurs tijd).`,
              `Mini-stap 2: ${hoursOnly.startHHMM} + ${hoursOnly.durHours} uur = **__ : __**`,
              `Welk uur krijg je?`,
            ].join('\n')

      return new Response(
        JSON.stringify({ message: msg, action: 'none', topic: lang === 'en' ? 'Time calculation' : 'Tijdrekenen' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Final pass: answer using transcript as ground truth (no guessing).
    const finalUserParts = (() => {
      if (!ocrTranscript) return userParts
      const suffix =
        `\n\n[EXACTE TEKST UIT DE FOTO (OCR)]\n${ocrTranscript}\n\n[SYSTEEM OVERRIDE (STRICT): Gebruik ALLEEN de OCR-tekst hierboven om de opdracht te beantwoorden. Als info ontbreekt of onleesbaar is, zeg precies welk stukje ontbreekt en vraag om een scherpere close-up van dat deel. GEEN gokken. Houd je aan de Scaffolded Guide: methode/aanpak eerst; bij sommen/huiswerk geen eindantwoord in de eerste beurt (eindantwoord pas bij Escape Hatch level 3).]`
      // Keep images attached so the model can cross-check, but transcript is the source of truth.
      return partsCloneWithTextSuffix(userParts, suffix)
    })()

    const finalUserPartsWithEscape = (() => {
      if (!escapeHatchLevel) return finalUserParts
      const lang = String(userLanguage || 'nl')
      const addon =
        lang === 'en'
          ? escapeHatchLevel === 1
            ? `\n\n[SYSTEM OVERRIDE (ESCAPE HATCH LEVEL 1): The student is stuck. Give 1 short rule/formula hint + 1 tiny check question. Do NOT give the final answer. Keep it short. Output valid JSON only.]`
            : escapeHatchLevel === 2
              ? `\n\n[SYSTEM OVERRIDE (ESCAPE HATCH LEVEL 2): The student is stuck and has already tried. Work out exactly ONE step (leave 1 blank like "__") and ask them to fill it in. Do NOT give the final answer yet. Output valid JSON only.]`
              : `\n\n[SYSTEM OVERRIDE (ESCAPE HATCH LEVEL 3): The student is stuck after 3 real attempts. You MAY give the final answer now. Format: final answer + 2 short 'why' sentences + 1 mini transfer practice question (same idea, new numbers). Keep it concise. Output valid JSON only.]`
          : escapeHatchLevel === 1
            ? `\n\n[SYSTEEM OVERRIDE (ESCAPE HATCH LEVEL 1): De leerling zit vast. Geef 1 korte regel-hint (formule/werkwijze) + 1 mini-checkvraag. Geef GEEN eindantwoord. Houd het kort. Output ALLEEN geldige JSON.]`
            : escapeHatchLevel === 2
              ? `\n\n[SYSTEEM OVERRIDE (ESCAPE HATCH LEVEL 2): De leerling zit vast en heeft al geprobeerd. Werk precies ÉÉN stap concreet uit (laat 1 blanco zoals "__") en laat de leerling die invullen. Nog GEEN eindantwoord. Output ALLEEN geldige JSON.]`
              : `\n\n[SYSTEEM OVERRIDE (ESCAPE HATCH LEVEL 3): De leerling zit vast na 3 échte pogingen. Je MAG nu het eindantwoord geven. Format: eindantwoord + 2 korte zinnen 'waarom' + 1 mini transfer-oefenvraag (zelfde idee, nieuwe getallen). Houd het kort. Output ALLEEN geldige JSON.]`
      return partsCloneWithTextSuffix(finalUserParts, addon)
    })()

    let text = await runOnceWithRetry(finalUserPartsWithEscape, 'final', 2)

    // PRE-PARSE ANTI-REPEAT (YES/NO CONTINUATION):
    // If the model repeats the previous assistant message AND the student just answered a yes/no
    // to the assistant's yes/no question, we must NOT respond with "next micro-step" meta text.
    // Instead: retry once with a strict "continue the answer without repeating" override.
    const normalizeForRepeatEarly = (s: string) =>
      String(s || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[“”"']/g, '')
        .replace(/[^a-z0-9\s:.,!?€$]/g, '')
        .replace(
          /^(?:super|precies|juist|exact|helemaal\s+goed|goed\s+zo|top|ok[ée]?|oke|klopt)\b[!.,:;\-–— ]*/i,
          ''
        )
        .trim()

    const lastAssistantInHistoryEarly = (() => {
      const arr = Array.isArray(messages) ? messages : []
      for (let i = arr.length - 2; i >= 0; i--) {
        const m = arr[i]
        if (m?.role && m.role !== 'user') return String(m?.content || '')
      }
      return ''
    })()

    const lastUserTextEarly = String(lastMessageContent || '').trim()
    const isYesNoAnswerEarly = /^(ja|nee|yes|no|yep|nope)\b[!.]*$/i.test(lastUserTextEarly)
    const lastAssistantAskedEarly = /\?\s*$/.test(lastAssistantInHistoryEarly.trim())
    const lastAssistantLooksYesNoQuestionEarly =
      lastAssistantAskedEarly &&
      /\b(wil\s+je|wilt\s+u|zullen\s+we|shall\s+we|do\s+you\s+want|would\s+you\s+like|weet\s+je|snap\s+je|begrijp\s+je|ken\s+je)\b/i.test(
        lastAssistantInHistoryEarly
      )

    const didRepeatEarly =
      lastAssistantInHistoryEarly &&
      normalizeForRepeatEarly(text) &&
      normalizeForRepeatEarly(text) === normalizeForRepeatEarly(lastAssistantInHistoryEarly)

    if (didRepeatEarly && isYesNoAnswerEarly && lastAssistantLooksYesNoQuestionEarly) {
      const lang = String(userLanguage || 'nl')
      const ynAddon =
        lang === 'en'
          ? `\n\n[SYSTEM OVERRIDE (NO-REPEAT + YES/NO): The student answered "${lastUserTextEarly}" to your previous yes/no question: "${lastAssistantInHistoryEarly}". Do NOT repeat your previous message. If the answer is YES, continue by giving the information you offered. If NO, respect it and offer 2 short options for what to do next. Keep it short. Output valid JSON only.]`
          : `\n\n[SYSTEEM OVERRIDE (NO-REPEAT + JA/NEE): De leerling antwoordde "${lastUserTextEarly}" op jouw vorige ja/nee-vraag: "${lastAssistantInHistoryEarly}". Herhaal je vorige bericht NIET. Bij "ja": ga door en geef de info die je aanbood. Bij "nee": respecteer dat en geef 2 korte opties voor wat nu. Houd het kort. Output ALLEEN geldige JSON.]`
      const retryParts = partsCloneWithTextSuffix(finalUserPartsWithEscape, ynAddon)
      text = await runOnceWithRetry(retryParts, 'repeat_yesno_retry', 2)
    }

    // Best-effort JSON extraction. If it fails, fall back to plain text in message.
    let payload: any = null
    try {
      const jsonText = extractJsonFromModelText(text)
      if (jsonText) payload = JSON.parse(jsonText)
    } catch (e) {
      payload = null
    }

    if (!payload) {
      payload = { message: text || 'Er ging iets mis bij het genereren van een antwoord.', action: 'none' }
    }

    const validation = validatePayload(payload)
    if (!validation.ok) {
      // Keep the user experience stable: return the raw model text as the message.
      payload = { message: text || 'Er ging iets mis bij het genereren van een antwoord.', action: 'none' }
    }

    // Always sanitize message to prevent JSON/code leakage in the chat bubble.
    if (payload?.message && typeof payload.message === 'string') {
      const cleaned = autoWrapLatexOutsideMath(sanitizeMessageForDisplay(payload.message))

      // Blueprint V10 enforcement (deterministic):
      // - Anti-Sorry: don't start with apologies.
      // - Instant responsiveness: avoid "even denken / momentje / wacht even" as filler.
      const enforceBlueprintTone = (msg: string) => {
        let m = String(msg || '').trim()
        if (!m) return ''

        // Remove common apology openers (NL + EN).
        m = m.replace(
          /^(?:sorry|mijn excuses|excuses|het spijt me|pardon|i'?m sorry|sorry about that|my apologies)\s*([,.:!—-]+\s*)?/i,
          ''
        )

        // Remove filler phrases early in the message.
        m = m.replace(/^(?:ok[ée]?\s*[,.:!—-]+\s*)?(?:even denken|wacht even|momentje)\s*([,.:!—-]+\s*)?/i, '')

        return m.trim()
      }

      const toned = enforceBlueprintTone(cleaned)
      payload.message = toned || cleaned || 'Er ging iets mis bij het genereren van een antwoord.'
    }

    // LOW-FRICTION MOVE LINTER (POLICY-FIRST):
    // Rewrite "guess questions" (schatten/meer-of-minder/denk je dat...) and "meta questions"
    // (schrijf je berekening / wat is je volgende stap) into a concrete compute/fill-blank move,
    // unless the user is explicitly stuck (escape hatch).
    const getLastNonTrivialUserText = () => {
      const arr = Array.isArray(messages) ? messages : []
      for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i]
        if (m?.role !== 'user') continue
        const t = String(m?.content || '').trim()
        if (!t) continue
        if (
          /^(ja|nee|yes|no|yep|nope|ok(é|ay)?|top|klopt|prima|goed|thanks|thank\s+you|dank(je|jewel|u)?|niets|laat\s+maar|stop|klaar)\b/i.test(
            t
          )
        )
          continue
        return t
      }
      return ''
    }

    const extractFrac = (text: string): { a: string; b: string } | null => {
      const t = String(text || '')
      const m = t.match(/(\d+)\s*\/\s*(\d+)/)
      if (!m) return null
      return { a: m[1], b: m[2] }
    }

    const lowFrictionRewrite = () => {
      const msg = String(payload?.message || '').trim()
      if (!msg) return

      const userIsStuck = isStuckSignal(String(lastMessageContent || ''))
      const bannedGuess =
        /(schat|schatten|meer\s+of\s+minder|denk\s+je\s+dat|zou\s+het\s+kunnen|past\s+.*\b(vaker|meer)\b)/i.test(msg)
      const bannedMeta =
        /(schrijf\s+je\s+berekening|wat\s+is\s+je\s+volgende\s+stap|volgende\s+stap\s*\(1\s*korte\s*zin\))/i.test(msg)

      if (!bannedGuess && !(bannedMeta && !userIsStuck)) return

      const lastUser = getLastNonTrivialUserText()
      const frac = extractFrac(lastUser)
      const lang = String(userLanguage || 'nl')

      if (frac) {
        const b = frac.b
        payload.message =
          lang === 'en'
            ? [
                `Let’s do it step by step (no final answer yet).`,
                `Start with: **${b} × 10 = __**. What is it?`,
              ].join('\n')
            : [
                `We doen het stap voor stap (nog geen eindantwoord).`,
                `Begin met: **${b} × 10 = __**. Wat is dat?`,
              ].join('\n')
        return
      }

      // Generic fallback: ask for one concrete computation or fill-blank.
      payload.message =
        lang === 'en'
          ? `Let’s do one concrete step: write **one** calculation you can do right now (e.g. 12×10=120).`
          : `We doen één concrete stap: schrijf **één** berekening die je nu kunt doen (bijv. 12×10=120).`
    }

    lowFrictionRewrite()

    // ANTI-PARROT (NO "SAME QUESTION" FOLLOW-UP):
    // If the user asks a direct calculation like "184/16" and the model just re-asks the same question
    // ("Wat is de uitkomst van 184 gedeeld door 16?"), rewrite it into a real micro-step.
    const lastNonTrivialUserText = (() => {
      const arr = Array.isArray(messages) ? messages : []
      for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i]
        if (m?.role !== 'user') continue
        const t = String(m?.content || '').trim()
        if (!t) continue
        // Skip pure acknowledgements / stop signals
        if (
          /^(ja|nee|yes|no|yep|nope|ok(é|ay)?|top|klopt|prima|goed|thanks|thank\s+you|dank(je|jewel|u)?|niets|laat\s+maar|stop|klaar)\b/i.test(
            t
          )
        )
          continue
        return t
      }
      return ''
    })()

    const fracFromUser = (() => {
      const t = String(lastNonTrivialUserText || '')
      // Matches "184/16" or "184 / 16"
      const m = t.match(/(\d+)\s*\/\s*(\d+)/)
      if (!m) return null
      return { a: m[1], b: m[2] }
    })()

    const looksLikeParrotedDivisionQuestion = (() => {
      if (!fracFromUser) return false
      const msg = String(payload?.message || '')
      const low = msg.toLowerCase()
      if (!/\?\s*$/.test(msg.trim())) return false
      // Must mention both numbers and the division phrasing
      if (!low.includes(fracFromUser.a) || !low.includes(fracFromUser.b)) return false
      if (!/(gedeeld\s+door|delen\s+door|\/)/.test(low)) return false
      if (!/(wat\s+is|uitkomst|hoeveel)/.test(low)) return false
      return true
    })()

    if (looksLikeParrotedDivisionQuestion) {
      const lang = String(userLanguage || 'nl')
      const { a, b } = fracFromUser!
      payload.message =
        lang === 'en'
          ? [
              `Let’s do it step by step (no final answer yet).`,
              `Start with: **${b} × 10 = __**. What is it?`,
            ].join('\n')
          : [
              `We doen het stap voor stap (nog geen eindantwoord).`,
              `Begin met: **${b} × 10 = __**. Wat is dat?`,
            ].join('\n')
    }

    // STOP GUARDRAIL (SERVER-SIDE, MINIMAL):
    // Only enforce stopping when the model itself signals completion ("we zijn klaar", "dat is het")
    // or when the user explicitly sends a stop signal. Do NOT stop merely because an intermediate
    // step was correct (otherwise the tutor halts mid-explanation).
    const prevAssistantTextForStop = (() => {
      const arr = Array.isArray(messages) ? messages : []
      for (let i = arr.length - 2; i >= 0; i--) {
        const m = arr[i]
        if (m?.role && m.role !== 'user') return String(m?.content || '')
      }
      return ''
    })()
    const prevAssistantAskedForStop = /\?\s*$/.test(prevAssistantTextForStop.trim())
    const userAnswerTextForStop = String(lastMessageContent || '').trim()
    const userLooksLikeAnswer =
      /^(ja|nee|yes|no|yep|nope)\b[!.]*$/i.test(userAnswerTextForStop) ||
      /^\s*\d+([.,]\d+)?\s*$/.test(userAnswerTextForStop) ||
      /^\s*[a-fA-F]\s*$/.test(userAnswerTextForStop) ||
      /^\s*\d{1,2}:\d{2}\s*$/.test(userAnswerTextForStop)
    const prevAssistantIsComprehensionCheck = /(\bsnap\s+je\b|\bbegrijp\s+je\b|\bis\s+dat\s+duidelijk\b|\bvolg\s+je\b|\bmake\s+sense\b|\bdo\s+you\s+understand\b)/i.test(
      prevAssistantTextForStop
    )
    const userSaidYes = /^(ja|yes|yep)\b[!.]*$/i.test(userAnswerTextForStop)

    const hasCompletionMarker = (() => {
      const m = String(payload?.message || '').toLowerCase()
      return /\b(we\s+zijn\s+klaar|klaar\.?$|dat\s+is\s+het|that'?s\s+it|we'?re\s+done|done\.)\b/i.test(m)
    })()

    const stripAfterFirstQuestion = (s: string) => {
      const t = String(s || '').trim()
      if (!t) return ''
      const q = t.indexOf('?')
      if (q === -1) return t
      const before = t.slice(0, q).trim()
      // If we cut right after a colon, keep going until next sentence end.
      return (before.endsWith(':') ? before.slice(0, -1) : before).trim() + '.'
    }

    const takeFirstSentenceNoQuestion = (s: string) => {
      const t = String(s || '').trim()
      if (!t) return ''
      let out = ''
      for (let i = 0; i < t.length; i++) {
        const ch = t[i]
        if (ch === '\n') break
        if (ch === '?' || ch === '!' || ch === '.') {
          out += ch === '?' ? '.' : ch
          break
        }
        out += ch
      }
      return out.trim()
    }

    // If the model itself claims completion, do not end with a new question.
    if (hasCompletionMarker && /\?/.test(String(payload?.message || ''))) {
      payload.message =
        stripAfterFirstQuestion(String(payload.message || '')) ||
        takeFirstSentenceNoQuestion(String(payload.message || '')) ||
        (String(userLanguage || 'nl') === 'en' ? 'Done.' : 'Klaar.')
    }

    // If we have LaTeX in the message and no explicit formula field, attach it for the board.
    if (!payload.formula) {
      const latex = extractLatexBlock(payload.message || '')
      if (latex) {
        payload.formula = { latex }
        // Don't override explicit graph/image/map actions.
        if (!payload.action || payload.action === 'none') payload.action = 'display_formula'
      }
    }

    // Deterministic formula for common “definition/equation” concepts if the model forgot it.
    // Example: Fotosynthese is often asked as "toon fotosynthese" (image) but we still want the equation on the board.
    if (!payload.formula && /fotosynthese|photosynthesis/i.test(lastMessageContent || '')) {
      payload.formula = {
        title: 'Fotosynthese',
        latex: '$$\n6\\,CO_2 + 6\\,H_2O \\rightarrow C_6H_{12}O_6 + 6\\,O_2\n$$',
      }
      if (!payload.action || payload.action === 'none') payload.action = 'display_formula'
    }

    // Blueprint V10: If we have a formula for the board, ensure the chat also shows it as LaTeX
    // (students shouldn't have to "look right" to see the key equation).
    if (payload.formula && typeof payload.formula === 'object' && typeof payload.formula.latex === 'string') {
      const normalizeLatexBlock = (s: string) => {
        const t = String(s || '').trim()
        if (!t) return ''
        // If already a $$...$$ block, keep it.
        if (t.includes('$$')) return t
        // Otherwise wrap as block math.
        return `$$\n${t}\n$$`
      }
      const latexBlock = normalizeLatexBlock(payload.formula.latex)
      payload.formula.latex = latexBlock

      const msg = String(payload.message || '').trim()
      const hasAnyMath = /\$\$[\s\S]*?\$\$|\$[^$\n]+?\$/.test(msg)
      if (!hasAnyMath && latexBlock) {
        payload.message = `${msg}\n\n${latexBlock}`.trim()
      }
    }

    // Map requests: if model didn't provide a map, deterministically geocode the place name.
    if (needsMap && !payload.map && !needsGraph) {
      const place =
        (lastMessageContent || '')
          .replace(/waar\s+ligt/gi, ' ')
          .replace(/toon|laat|zien|op|de|kaart|map/gi, ' ')
          .replace(/[?!.:,;]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() || lastMessageContent
      const center = await geocodeNominatim(place)
      if (center) {
        const map: MapSpec = {
          title: place,
          center: { lat: center.lat, lon: center.lon },
          zoom: 10,
          markers: [{ lat: center.lat, lon: center.lon, label: place }],
          // Ask the client map to fetch GeoJSON bounds/outline and auto-fit (cities/countries/rivers).
          queries: [{ query: place, label: place, withGeoJson: true }],
        }
        // Also include tool-style lat/lng for compatibility with the prompt/tool schema.
        payload.map = { ...map, lat: center.lat, lng: center.lon } as any
        payload.action = 'show_map'
      }
    }

    // ROUTING ENFORCEMENT (SINGLE SOURCE OF TRUTH):
    // Ensure that if a request falls into a routing bucket, the corresponding action is selected
    // and conflicting visuals are cleared (prevents overlap/residue).
    if (needsGraph) {
      // Graph takes precedence for math plotting.
      payload.action = 'plot_graph'
      delete payload.map
      delete payload.image
      // Keep formula only if explicitly asked; usually graphs should stand alone.
      if (!needsFormula) delete payload.formula
    } else if (needsMap) {
      // Geography/location always maps to show_map.
      payload.action = 'show_map'
      delete payload.graph
      delete payload.image
      delete payload.formula
      // If model gave an incomplete map, we'll still try to produce one via deterministic geocode above.
    } else if (needsImage) {
      // Visual appearance/anatomy/history/biology always maps to show_image.
      payload.action = 'show_image'
      delete payload.graph
      delete payload.map
      // Clean slate: do not mix visuals.
      delete payload.formula
    } else if (needsFormula) {
      payload.action = 'display_formula'
      delete payload.graph
      delete payload.map
      delete payload.image
    }

    // If we expected a graph but got none, retry once with a strict override.
    if (needsGraph && !payload.graph) {
      const strictGraph =
        "\n\n[SYSTEEM OVERRIDE (STRICT): De gebruiker vraagt om een grafiek. Antwoord met geldige JSON en voeg een 'graph' object toe met: {\"expressions\": [\"...\"]}. Gebruik formules in x zoals \"x^2\" of \"x+2\". Zet action op \"plot_graph\". GEEN SVG, geen plaatjes.]"
      const retryParts = partsCloneWithTextSuffix(userParts, strictGraph)
      const retryText = await runOnceWithRetry(retryParts, 'graph_retry', 2)
      try {
        const jsonText2 = extractJsonFromModelText(retryText)
        if (jsonText2) {
          const payload2 = JSON.parse(jsonText2)
          const v2 = validatePayload(payload2)
          if (v2.ok && payload2.graph) {
            payload = payload2
          }
        }
      } catch {
        // ignore
      }
    }

    // Final deterministic safety net: always attach a graph spec for graph requests.
    if (needsGraph && !payload.graph) {
      const expressions = extractGraphExpressions(lastMessageContent || '')
      if (expressions.length > 0) {
        payload.graph = { expressions }
        payload.action = 'plot_graph'
      }
    }

    // Deterministic point hints for common beginner requests (keeps UX consistent).
    if (needsGraph && payload.graph && wantsMarkedPoints && !payload.graph.points) {
      const exprs: string[] = Array.isArray(payload.graph.expressions) ? payload.graph.expressions : []
      const pts: any[] = []

      const mentionsOrigin = /oorsprong/.test(lower)
      const mentionsTop = /top|vertex/.test(lower)

      if (mentionsOrigin) {
        pts.push({ x: 0, y: 0, label: '(0,0)' })
      } else if (mentionsTop) {
        // Special-case x^2: vertex at (0,0)
        const hasXSquared = exprs.some((e) => /\bx\s*\^\s*2\b/i.test(String(e)))
        if (hasXSquared) pts.push({ x: 0, y: 0, label: 'top' })
      }

      if (pts.length > 0) {
        payload.graph.points = pts
      }
    }

    // Resolve Wikipedia/Wikimedia image queries server-side into a concrete URL.
    if (payload.image && !payload.image.url && typeof payload.image.query === 'string') {
      try {
        const result = await searchWikimedia(payload.image.query)
        if (result.found && result.url) {
          payload.image = {
            url: result.url,
            caption: payload.image.caption || result.caption || result.title,
            sourceUrl: result.pageUrl,
          }
          payload.action = payload.action || 'show_image'
        } else {
          // If not found, strip image to keep the UI stable.
          delete payload.image
        }
      } catch {
        delete payload.image
      }
    }

    // If the user asked for an image but the model forgot, retry once to request an image query.
    if (needsImage && !payload.image && !needsGraph) {
      // Deterministic preset (e.g., Dutch cultural terms) before asking the model again.
      const preset = imageQueryPreset(lastMessageContent || '')
      if (preset) {
        payload.image = { query: preset.query, caption: preset.caption }
      }

      const strictImage =
        '\n\n[SYSTEEM OVERRIDE (STRICT): De gebruiker vraagt om een afbeelding. Antwoord met geldige JSON en voeg een "image" object toe met {"query":"...","caption":"..."} (query in het Engels). Zet action op "show_image". GEEN graph, geen SVG, geen plaatjes genereren.]'
      if (!payload.image) {
        const retryParts = partsCloneWithTextSuffix(userParts, strictImage)
        const retryText = await runOnceWithRetry(retryParts, 'image_retry', 2)
        try {
          const jsonText2 = extractJsonFromModelText(retryText)
          if (jsonText2) {
            const payload2 = JSON.parse(jsonText2)
            const v2 = validatePayload(payload2)
            if (v2.ok && payload2.image) {
              payload = payload2
            }
          }
        } catch {
          // ignore
        }
      }
      // Resolve if we got a query.
      if (payload.image && !payload.image.url && typeof payload.image.query === 'string') {
        try {
          const result = await searchWikimedia(payload.image.query)
          if (result.found && result.url) {
            payload.image = {
              url: result.url,
              caption: payload.image.caption || result.caption || result.title,
              sourceUrl: result.pageUrl,
            }
            payload.action = 'show_image'
          } else {
            delete payload.image
          }
        } catch {
          delete payload.image
        }
      }
    }

    // FINAL QUALITY GATE: if an image/map action was selected but we don't have a usable payload,
    // prefer showing nothing (Blueprint V10: liever geen visual dan een foute/lege).
    if (payload.action === 'show_image' && !(payload.image && typeof payload.image.url === 'string' && payload.image.url.trim())) {
      delete payload.image
      payload.action = 'none'
    }
    if (payload.action === 'show_map' && !payload.map) {
      payload.action = 'none'
    }

    // If the user asked for an image but we couldn't find a reliable factual match (Curator quality gate),
    // explain briefly and ask a clarifying question (keeps the student oriented).
    if (needsImage && payload.action === 'none') {
      const lang = String(userLanguage || 'nl')
      const asked = String(lastMessageContent || '').trim()
      const alreadyMentions = typeof payload.message === 'string' && /geen.*(afbeelding|foto)|niets\s+gevonden|not\s+find/i.test(payload.message)
      if (!alreadyMentions) {
        const extra =
          lang === 'en'
            ? `\n\nI couldn’t find a **reliable factual photo / recognized plate** that matches your request.\nDo you mean a **photo** (real object) or a **school-style diagram**? (I only show photos/recognized plates.)`
            : `\n\nIk kon geen **betrouwbare foto / erkende plaat** vinden die echt goed bij je vraag past.\nBedoel je een **foto** (echt object) of een **schoolboek-schema**? (Ik toon alleen foto’s/erkende platen.)`
        payload.message = `${String(payload.message || '').trim()}${extra}`.trim()
      }
    }

    // ACK-ONLY GUARDRAIL:
    // If the user only acknowledges ("ok/ja/top/...") and doesn't ask anything new,
    // do NOT continue with extra content. Ask 1 short next-step question.
    const lastUserText = String(lastMessageContent || '').trim()
    const isBareYesNo =
      lastUserText.length > 0 &&
      lastUserText.length <= 8 &&
      !/[?¿]/.test(lastUserText) &&
      /^(ja|nee|yes|no|yep|nope)\b[!.]*$/i.test(lastUserText)
    const isStopSignal =
      lastUserText.length > 0 &&
      lastUserText.length <= 32 &&
      !/[?¿]/.test(lastUserText) &&
      /^(niets|nee\s+hoor|laat\s+maar|stop|klaar|geen\s+vragen|geen\s+verdere\s+vragen|that'?s\s+all|nothing|no\s+thanks)\b[!.]*$/i.test(
        lastUserText
      )

    const prevAssistantTextForAck = (() => {
      const arr = Array.isArray(messages) ? messages : []
      for (let i = arr.length - 2; i >= 0; i--) {
        const m = arr[i]
        if (m?.role && m.role !== 'user') return String(m?.content || '')
      }
      return ''
    })()
    const prevAssistantAskedForAck = /\?\s*$/.test(prevAssistantTextForAck.trim())
    // NOTE: "ja/nee/yes/no" are treated as *answers* to a yes/no question, not as ACK-only.
    // We only treat lightweight acknowledgements like "ok/top/dankjewel" as ACK-only.
    const isAckOnly =
      lastUserText.length > 0 &&
      lastUserText.length <= 24 &&
      !/[?¿]/.test(lastUserText) &&
      /^(ok(é|ay)?|klopt|top|prima|goed|thanks|thank\s+you|dank(je|jewel|u)?)\b[!.]*$/i.test(lastUserText)

    // If the student says "stop / niets / laat maar", treat as conversation complete and stop cleanly.
    if (isStopSignal) {
      const lang = String(userLanguage || 'nl')
      const userTurnIndex = (() => {
        const arr = Array.isArray(messages) ? messages : []
        return arr.filter((m: any) => m?.role === 'user').length
      })()
      const variant = ((userTurnIndex % 3) + 3) % 3
      const closuresNl = ['Oké. Tot later.', 'Helemaal goed. Tot zo.', 'Prima. Laat maar weten als je nog iets hebt.']
      const closuresEn = ['Okay. See you later.', 'All good. Talk soon.', 'Sure. Let me know if you need anything else.']
      payload.message = lang === 'en' ? closuresEn[variant] : closuresNl[variant]
      payload.action = payload.action || 'none'
    }

    // If the student clearly acknowledges with a bare yes/no BUT there's no pending yes/no question,
    // treat it as "conversation complete" and stop without a wedervraag.
    if (isBareYesNo && !prevAssistantAskedForAck) {
      const lang = String(userLanguage || 'nl')
      const userTurnIndex = (() => {
        const arr = Array.isArray(messages) ? messages : []
        return arr.filter((m: any) => m?.role === 'user').length
      })()
      const variant = ((userTurnIndex % 3) + 3) % 3

      const closuresNl = [
        'Top. Als je nog iets wilt weten, typ het maar.',
        'Helder. Je mag altijd een nieuwe vraag sturen.',
        'Oké. Zeg het maar als je nog iets nodig hebt.',
      ]
      const closuresEn = [
        'Got it. If you have another question, just type it.',
        'Clear. Feel free to ask a new question anytime.',
        'Okay. Tell me if you need anything else.',
      ]
      payload.message = lang === 'en' ? closuresEn[variant] : closuresNl[variant]
    }

    if (isAckOnly) {
      const lang = String(userLanguage || 'nl')
      const prevAssistantAsked = prevAssistantAskedForAck

      const userTurnIndex = (() => {
        const arr = Array.isArray(messages) ? messages : []
        return arr.filter((m: any) => m?.role === 'user').length
      })()
      const variant = ((userTurnIndex % 3) + 3) % 3

      const closingVariantsNl = [
        'Top. Wil je een voorbeeld, of heb je een nieuwe vraag?',
        'Helder. Wil je 1 oefenvraag, of wil je iets anders vragen?',
        'Oké. Zullen we één voorbeeld doen, of ga je door met een nieuwe vraag?',
      ]
      const closingVariantsEn = [
        'Got it. Do you want an example, or do you have a new question?',
        'Clear. Do you want 1 practice question, or do you want to ask something else?',
        'Okay. Should we do one example, or do you have a new question?',
      ]

      payload.message =
        lang === 'en'
          ? prevAssistantAsked
            ? `Got it. What’s your answer to my last question? (1 short line)`
            : [
                'Got it. If you have another question, just type it.',
                'Clear. Feel free to ask a new question anytime.',
                'Okay. Tell me if you need anything else.',
              ][variant]
          : prevAssistantAsked
            ? `Top. Wat is jouw antwoord op mijn laatste vraag? (1 korte zin)`
            : [
                'Top. Als je nog iets wilt weten, typ het maar.',
                'Helder. Je mag altijd een nieuwe vraag sturen.',
                'Oké. Zeg het maar als je nog iets nodig hebt.',
              ][variant]
    }

    // FINAL ANTI-REPEAT SAFETY NET:
    // If the model repeats the exact same assistant message as the previous assistant turn,
    // replace it with a "continue" scaffold (prevents getting stuck in a loop).
    const normalizeForRepeat = (s: string) =>
      String(s || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[“”"']/g, '')
        // Keep common punctuation; drop other symbols (ASCII-safe; avoids unicode property escapes).
        .replace(/[^a-z0-9\s:.,!?€$]/g, '')
        // Ignore small praise/confirmation prefixes so we catch near-duplicates like "Super!" vs "Precies!"
        .replace(/^(?:super|precies|juist|exact|helemaal\s+goed|goed\s+zo|top|ok[ée]?|oke|klopt)\b[!.,:;\-–— ]*/i, '')
        .trim()

    const lastAssistantInHistory = (() => {
      const arr = Array.isArray(messages) ? messages : []
      for (let i = arr.length - 2; i >= 0; i--) {
        const m = arr[i]
        if (m?.role && m.role !== 'user') {
          return String(m?.content || '')
        }
      }
      return ''
    })()

    const nowMsg = typeof payload.message === 'string' ? payload.message : ''
    if (lastAssistantInHistory && normalizeForRepeat(nowMsg) && normalizeForRepeat(nowMsg) === normalizeForRepeat(lastAssistantInHistory)) {
      const lang = String(userLanguage || 'nl')
      const userText = String(lastMessageContent || '').trim()
      const isShortConfirm = /^(ja|ok(é)?|klopt|yes|yep|nope|nee)\b/i.test(userText)
      const isShortNumber = /^\d+([.,]\d+)?$/.test(userText)
      const isYes = /^(ja|yes|yep)\b/i.test(userText)
      const isNo = /^(nee|no|nope)\b/i.test(userText)
      const lastAssistantLower = String(lastAssistantInHistory || '').toLowerCase()
      const looksLikeSimplifyPrompt =
        /(vereenvoudig|vereenvoudigen|delen\s+door\s+een\s+kleiner|getal\s+delen|kun\s+je\s+\d+.*delen|factor)/.test(lastAssistantLower)
      const hasUnitContext = /\b(€|euro|cent|km|meter|cm|mm|kg|gram|liter|ml|uur|minuut|minuten|seconde|%|procent)\b/i.test(
        lastAssistantInHistory
      )

      const parseNum = (s: string) => {
        const n = Number(String(s || '').trim().replace(',', '.'))
        return Number.isFinite(n) ? n : NaN
      }

      const extractSimpleOp = (text: string): { a: number; b: number; op: '+' | '-' | '*' | '/' } | null => {
        const t = String(text || '')
        // NL/EN patterns: "wat is 92 / 2?" / "what is 92/2?"
        const m =
          t.match(/(?:wat\s+is|what\s+is)\s+(-?\d+(?:[.,]\d+)?)\s*([+\-*/:])\s*(-?\d+(?:[.,]\d+)?)/i) ||
          t.match(/(-?\d+(?:[.,]\d+)?)\s*([+\-*/:])\s*(-?\d+(?:[.,]\d+)?)/)
        if (!m) return null
        const a = parseNum(m[1])
        const rawOp = m[2]
        const b = parseNum(m[3])
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null
        const op = rawOp === ':' ? '/' : (rawOp as any)
        if (op !== '+' && op !== '-' && op !== '*' && op !== '/') return null
        return { a, b, op }
      }

      const op = extractSimpleOp(lastAssistantInHistory)
      const userN = isShortNumber ? parseNum(userText) : NaN
      const expected = (() => {
        if (!op) return NaN
        if (op.op === '+') return op.a + op.b
        if (op.op === '-') return op.a - op.b
        if (op.op === '*') return op.a * op.b
        if (op.op === '/') return op.b === 0 ? NaN : op.a / op.b
        return NaN
      })()
      const isArithmeticQuestion = !!op && Number.isFinite(expected) && isShortNumber && Number.isFinite(userN)
      const isCorrectArithmetic = isArithmeticQuestion && Math.abs(userN - expected) < 1e-9

      payload.message =
        lang === 'en'
          ? [
              `Ok.`,
              isShortNumber
                ? isArithmeticQuestion
                  ? isCorrectArithmetic
                    ? `Exactly.`
                    : `Almost. Try again: ${op!.a} ${op!.op} ${op!.b} = __`
                  : hasUnitContext
                    ? `You wrote **${userText}**. What does that number represent (units: €, km, minutes…)?`
                    : `You wrote **${userText}**. Write your calculation in 1 short line.`
                : looksLikeSimplifyPrompt && isYes
                  ? `Great. Which **smaller number** can you divide **both** numbers by? (Try 2 or 3.)`
                  : looksLikeSimplifyPrompt && isNo
                    ? `Ok. Then we’ll skip simplifying. Start with: compute **23×10** = __. What is it?`
                    : isShortConfirm && (isYes || isNo)
                      ? `Got it. Answer in 1 short line: what’s your next step?`
                      : `What is your next step? (1 short line)`,
            ].join('\n')
          : [
              `Oké.`,
              isShortNumber
                ? isArithmeticQuestion
                  ? isCorrectArithmetic
                    ? `Juist.`
                    : `Bijna. Probeer nog eens: ${op!.a} ${op!.op} ${op!.b} = __`
                  : hasUnitContext
                    ? `Jij schreef **${userText}**. Waar staat dat getal voor (eenheid: €, km, minuten…)?`
                    : `Jij schreef **${userText}**. Schrijf je berekening in 1 korte zin.`
                : looksLikeSimplifyPrompt && isYes
                  ? `Top. Door welk **kleiner getal** kun je **beide** getallen delen? (Probeer 2 of 3.)`
                  : looksLikeSimplifyPrompt && isNo
                    ? `Oké. Dan slaan we vereenvoudigen over. Begin met: **23×10** = __. Wat is dat?`
                    : isShortConfirm && (isYes || isNo)
                      ? `Helder. Antwoord in 1 korte zin: wat is je volgende stap?`
                      : `Wat is je volgende stap? (1 korte zin)`,
            ].join('\n')
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    // ROBUST LOGGING: Log de exacte foutmelding
    console.error("[CHAT API] Backend error:", {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Error',
      stack: error?.stack || 'No stack trace',
      cause: error?.cause || 'No cause'
    });
    
    // If Gemini/model provider is temporarily unreachable, keep the UX stable with a valid JSON payload (no hard crash).
    const msg = (() => {
      const m = String(error?.message || '')
      if (/unavailable|overload|timeout|timed out|fetch failed|econnreset|socket|429|502|503|504|rate/i.test(m)) {
        return 'Ik heb heel even geen verbinding met mijn brein. Probeer over 5–10 seconden opnieuw.'
      }
      return 'Er ging iets mis. Probeer het zo nog eens.'
    })()

    return new Response(
      JSON.stringify({
        message: msg,
        topic: 'Systeem',
        action: 'none',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
