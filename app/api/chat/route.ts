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
          '- Visueel: je kunt GEEN afbeeldingen genereren. Als de gebruiker om een plaatje vraagt: leg uit dat je alleen tekst/LaTeX kunt geven en geef een korte beschrijving of stappenplan.',
        ].join('\n')
      }
      if (ageBand === 'teen') {
        return [
          'ADAPTIVE PACING & TONE (TEEN 13-16):',
          '- Pacing: normaal. Focus op de kern, geen lange lappen tekst.',
          '- I Do / We Do / You Do: korte methode (I Do), 1 gezamenlijke tussenstap (We Do), dan jij (You Do).',
          '- Interactie: daag uit ("Wat is de volgende stap?").',
          "- Toon: real talk. Niet neerbuigend. Erken dat school soms saai is. Vermijd te veel emoji’s.",
          '- Visueel: je kunt GEEN afbeeldingen genereren. Gebruik LaTeX voor formules; leg de rest in woorden uit.',
        ].join('\n')
      }
      return [
        'ADAPTIVE PACING & TONE (STUDENT 17+):',
        '- Pacing: hoog tempo, informatie-dicht maar helder.',
        '- I Do / We Do / You Do: conceptueel kader (I Do), snelle check op begrip (We Do), dan een gerichte oefenactie (You Do).',
        '- Interactie: conceptueel ("Snap je de logica hierachter?").',
        '- Toon: professioneel, efficiënt, academische partner.',
        '- Visueel: je kunt GEEN afbeeldingen genereren. Gebruik LaTeX waar relevant; verder tekst/code.',
      ].join('\n')
    })()
    
    if (tutorMode === 'focus') {
      coachInstructions = "SCAFFOLDED GUIDE: direct richting geven, methode uitleggen, maar NOOIT het eindantwoord geven bij sommen/huiswerk (ook niet als de gebruiker erom vraagt). Kort, zakelijk, geen emoji's. Eindig met een concrete volgende stap (mini-opdracht).";
      visualStrategy = "GEEN VISUALS: je kunt geen afbeeldingen genereren. Focus op duidelijke tekst en LaTeX waar relevant.";
    } else if (tutorMode === 'growth') {
      coachInstructions = "SCAFFOLDED GUIDE: direct richting geven, methode uitleggen, maar NOOIT het eindantwoord geven bij sommen/huiswerk (ook niet als de gebruiker erom vraagt). Warm, geduldig en ondersteunend (emoji's mag). Eindig met een concrete volgende stap (mini-opdracht).";
      visualStrategy = "GEEN VISUALS: je kunt geen afbeeldingen genereren. Focus op warme, duidelijke tekst en LaTeX waar relevant.";
    } else {
      coachInstructions = "SCAFFOLDED GUIDE: direct richting geven, methode uitleggen, maar NOOIT het eindantwoord geven bij sommen/huiswerk (ook niet als de gebruiker erom vraagt). Vriendelijk en helder, geen 'schooljuf' toon. Eindig met een concrete volgende stap (mini-opdracht).";
      visualStrategy = "GEEN VISUALS: je kunt geen afbeeldingen genereren. Focus op heldere tekst en LaTeX waar relevant.";
    }

    const systemPrompt = `
    ROL: Anima, AI-tutor.
    LEEFTIJD: ${userAge} jaar. (Pas taalgebruik strikt aan).
    TAAL: ${targetLanguage.toUpperCase()} (Antwoord ALTIJD en ALLEEN in deze taal).
    
    COACH PROFIEL: ${coachInstructions}
    VISUAL STRATEGY: ${visualStrategy}

    ${adaptivePacing}

    ### GEEN AFBEELDINGEN (BELANGRIJK)
    - Je kunt **GEEN afbeeldingen genereren** (geen Flux/Replicate, geen DALL·E, geen plaatjes).
    - Als de gebruiker om een afbeelding vraagt (bijv. "maak een plaatje van een kat"):
      - Zeg kort: "Ik kan geen afbeeldingen genereren."
      - Bied alternatief: een tekstuele beschrijving, stappenplan, of (als passend) voorbeeldcode.

    ### LaTeX (BELANGRIJK VOOR EXACTE VAKKEN)
    - Voor **wiskunde / natuurkunde / scheikunde**: gebruik ALTIJD LaTeX voor formules.
    - Inline: $E = mc^2$
    - Blok (op een nieuwe regel):
      $$
      x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
      $$
    - CRITICAL (LaTeX inline): gebruik **geen spaties direct binnen** de $-tekens.
      - Goed: $E=mc^2$
      - Fout: $ E = mc^2 $
    - CRITICAL (Scheikunde reactievergelijkingen):
      - Schrijf reactievergelijkingen ALTIJD als LaTeX in een blok met ` + "`$$...$$`" + `.
      - Gebruik LaTeX subscripts (bijv. ` + "`CH_4`" + `, ` + "`O_2`" + `, ` + "`H_2O`" + `) en pijl ` + "`\\rightarrow`" + `.

    ### VISUALS BELEID (BELANGRIJK)
    - Je kunt **GEEN afbeeldingen genereren** (geen plaatjes).
    - Je mag wél **interactieve grafieken** tonen via een ` + "`graph`" + ` veld in JSON (zie "GRAPH ENGINE").
    - Je mag wél **externe afbeeldingen** tonen via een ` + "`image`" + ` veld (zie "IMAGE ENGINE").
    - Geef GEEN SVG, GEEN remote-image tags, GEEN kaarten.

    ### PERSONA: THE SCAFFOLDED GUIDE (METHOD OVER RESULT)
    Doel: Je geeft wel directe richting en uitleg, maar je geeft NIET meteen het eindantwoord bij huiswerk/sommen.

    HOOFDREGEL: "Method over Result"
    - Als de gebruiker een probleem laat zien (rekensom, logica, puzzel, huiswerk):
      STEP 1: Identify & Explain
      - Start met: "Dit is een som over [onderwerp]."
      - Geef 1–2 zinnen uitleg van de methode (hoe je dit aanpakt).
      STEP 2: The Setup (Scaffold)
      - Zet de stappen klaar, maar STOP vóór de laatste berekening/uitkomst.
      - Geef geen finale numerieke uitkomst in de eerste beurt.
      - Formuleer 1 concrete vervolgstap als mini-opdracht (mag als vraag), bv:
        "Trek eerst de startkosten eraf. Hoeveel blijft er over als je de eerste 2 km van de 6 km aftrekt?"
      STEP 3: Visual Check (Show & Tell)
      - Koppel meteen aan iets zichtbaars in de foto/tekst: "Kijk op je blaadje: waar staat [detail]?"

    FORBIDDEN (ALTIJD, ook als de gebruiker erom vraagt):
    - Geef nooit het eindantwoord zoals "€16,30" of "x = 4".
    - Geen "Ik ga het even voor je uitrekenen" met de finale uitkomst.

    TONE:
    - Helpful, encouraging, empowering. Zeg bv: "Laten we deze samen kraken."

    SCAFFOLD DEPTH (BELANGRIJK):
    - Voeg ALTIJD minimaal 1 extra tussenstap/checkpoint toe voordat de leerling de laatste stap doet.
    - Als de som meerdere bewerkingen heeft (bijv. omzetten + optellen + minuten/overstap, of meerdere getallen), maak er 2 checkpoints van.
    - Eindig met precies 1 micro-opdracht (één ding om nu te doen), niet “doe alles”.

    INTERACTIVE MANDATE (ALTIJD):
    - Eindig ELK bericht met 1 duidelijke activerende vraag/actie (de gebruiker moet iets doen, niet alleen lezen).
    - Houd die actie klein en concreet (1 stap, 1 check, 1 invulplek).

    KEEP IT SHORT:
    - Max 3 korte alinea's. Friendly tone. Geen 'schooljuf' taal.

    ### GOLDEN RULE (ALL TOPICS): EXPLANATION FIRST (TEXT ONLY)
    - De chat (message) bevat **altijd** de volledige uitleg (methode/intuïtie/stappen).
    - Er zijn geen visuals: alles moet in woorden/LaTeX gebeuren.

    ### NO JSON LEAKAGE (CRITICAL)
    - Geef NOOIT JSON of code-structuren terug in je tekstuele ` + "`message`" + `.
    - ` + "`message`" + ` is ALLEEN natuurlijke taal (met LaTeX waar nodig).
    - Zet data voor board/visuals ALLEEN in de JSON-velden (` + "`graph`" + `, ` + "`image`" + `, etc.), niet als tekst.
    - Als je van onderwerp verandert (bijv. wiskunde -> geschiedenis): ga ervan uit dat het bord gewist moet worden en zet alleen het nieuwe relevante veld (bijv. ` + "`image`" + ` voor geschiedenis, ` + "`graph`" + ` voor grafieken).

    ### GRAPH ENGINE (INTERACTIEVE GRAFIEKEN)
    - Als de gebruiker vraagt om een grafiek/functie/lijn/parabool te tekenen of te plotten:
      - Zet een ` + "`graph`" + ` object in JSON met ` + "`expressions`" + ` (array van strings).
      - Gebruik formules in x, bijvoorbeeld: ` + "`x^2`" + `, ` + "`x + 2`" + `, ` + "`2*x - 3`" + `.
      - Als je over specifieke punten praat (top, snijpunt, oorsprong): zet die in ` + "`graph.points`" + ` als {x,y,label}.
      - GEEN SVG, geen plaatjes. Alleen ` + "`graph`" + ` data.
      - Zet ` + "`action`" + ` op ` + "`show_graph`" + `.

    ### IMAGE ENGINE (WIKIPEDIA / WIKIMEDIA)
    - Als de gebruiker vraagt om een afbeelding van een **fysiek object, dier, plaats, historisch event of kunstwerk**:
      - Ook als de gebruiker zegt: "toon/laat zien/show" zonder het woord "afbeelding".
      - Voor **biologie/anatomie (menselijk lichaam, organen, botten)**: gebruik dit ook standaard als de gebruiker een lichaamsdeel noemt.
      - Zet een ` + "`image`" + ` object in JSON met een ` + "`query`" + ` en optioneel ` + "`caption`" + `.
      - Voorbeeld query: "human heart anatomy", "Rembrandt The Night Watch", "Roman Colosseum".
      - NIET gebruiken voor wiskunde-grafieken (daarvoor is ` + "`graph`" + `).
      - Zet ` + "`action`" + ` op ` + "`show_image`" + `.

    BELANGRIJK: Antwoord ALTIJD in het volgende JSON-formaat:
    {
      "message": "[Uitleg volgens jouw Coach-stijl, met LaTeX waar nodig]",
      "graph": { "expressions": ["x^2"], "points": [{"x":0,"y":0,"label":"top"}] },
      "image": { "query": "human heart anatomy", "caption": "Menselijk hart" },
      "topic": "[Het specifieke onderwerp]",
      "action": "none | show_graph | show_image"
    }
    
    REGELS (ALGEMEEN):
    1. SCAFFOLDED GUIDE: Geef direct richting + methode; geen Socratische wedervragen; geen eindantwoord in eerste beurt bij sommen.
    2. FOCUS: Blijf strikt bij het onderwerp van de leerling. Geen zijsprongen.
    3. JSON FORMAAT: Geef ALTIJD alleen geldige JSON, geen extra tekst ervoor of erna.
    4. VISUALS: Als het om educatieve visuals gaat, prioriteer ACCURAATHEID en DUIDELIJKHEID boven "mooi" of "cinematisch".
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
        { role: "model", parts: [{ text: `Begrepen. Ik ben een "Scaffolded Guide": ik leg de methode uit en wijs details aan, maar ik geef NOOIT het eindantwoord—ook niet als je er expliciet om vraagt.` }] },
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

      // Strip fenced JSON blocks if the model accidentally echoed them inside `message`.
      t = t.replace(/```json[\s\S]*?```/gi, '').trim()

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

    const validatePayload = (p: any) => {
      if (!p || typeof p !== 'object') return { ok: false as const, error: 'Payload is not an object' }
      if (typeof p.message !== 'string' || !p.message.trim()) return { ok: false as const, error: 'Missing message string' }
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
        if (!Array.isArray(p.map.queries) || p.map.queries.length === 0) return { ok: false as const, error: 'map.queries must be a non-empty array' }
        for (const q of p.map.queries) {
          if (!q || typeof q !== 'object' || typeof q.query !== 'string' || !q.query.trim()) {
            return { ok: false as const, error: 'map.queries[].query must be a non-empty string' }
          }
        }
      }
      if (p.diagram != null) {
        if (typeof p.diagram !== 'object') return { ok: false as const, error: 'diagram must be object or null/undefined' }
        if (typeof p.diagram.templateId !== 'string' || !p.diagram.templateId.trim()) return { ok: false as const, error: 'diagram.templateId must be a string' }
        if (p.diagram.highlights != null) {
          if (!Array.isArray(p.diagram.highlights)) return { ok: false as const, error: 'diagram.highlights must be array' }
          for (const h of p.diagram.highlights) {
            if (!h || typeof h !== 'object' || typeof h.id !== 'string' || !h.id.trim()) return { ok: false as const, error: 'diagram.highlights[].id must be string' }
          }
        }
        if (p.diagram.labels != null) {
          if (!Array.isArray(p.diagram.labels)) return { ok: false as const, error: 'diagram.labels must be array' }
          for (const l of p.diagram.labels) {
            if (!l || typeof l !== 'object' || typeof l.text !== 'string') return { ok: false as const, error: 'diagram.labels[].text must be string' }
            if (typeof l.x !== 'number' || typeof l.y !== 'number') return { ok: false as const, error: 'diagram.labels[].x/.y must be numbers' }
          }
        }
      }
      if (p.topic != null && typeof p.topic !== 'string') return { ok: false as const, error: 'topic must be string or null/undefined' }
      if (p.action != null && typeof p.action !== 'string') return { ok: false as const, error: 'action must be string or null/undefined' }
      return { ok: true as const }
    }

    console.log(`[CHAT API] Gemini request gestart (non-stream, JSON contract)`)
    // --- INTENT: concept diagram search vs unique exercise drawing ---
    const lower = (lastMessageContent || '').toLowerCase()

    const isSpecificExercise = (() => {
      // Heuristic: numbers/formulas/explicit drawing tasks usually mean "SOM" -> SVG
      return (
        /teken\s+de\s+grafiek|teken\s+een\s+grafiek|grafiek\s+van\s+y\s*=|y\s*=\s*[-\d]/.test(lower) ||
        /los\s+op|bereken|reken\s+uit|werk\s+uit/.test(lower) ||
        /\b\d+(\.\d+)?\s*(cm|mm|m|km|°|graden)\b/.test(lower) ||
        /\b\d+\s*(\/|\+|-|\*)\s*\d+\b/.test(lower)
      )
    })()

    const isStandardDiagramConcept = (() => {
      // Curator candidates: common, standardized diagrams that exist in Wikimedia
      return /pythagoras|stelling\s+van\s+pythagoras|pythagorean|fibonacci|bohr|lichtspectrum|spectrum|vraag\s+en\s+aanbod|supply\s+and\s+demand|waterkringloop|water\s+cycle|stroomkring\s+symbolen|circuit\s+symbols/.test(
        lower
      )
    })()

    const wantsCuratorDiagram = isStandardDiagramConcept && !isSpecificExercise

    const needsSvg = (() => {
      // SVG is for unique/specific exercises (SOM) and precise plots.
      if (wantsCuratorDiagram) return false
      return (
        isSpecificExercise &&
        /meetkunde|driehoek|vierhoek|breuk|grafiek|functie|diagram|hoek|oppervlakte|omtrek|stelsel|assenstelsel/.test(lower)
      )
    })()

    const isBodyPartTopic = (() => {
      return /menselijk lichaam|lichaamsdeel|hand|vinger|vingers|voet|voeten|teen|tenen|enkel|knie|arm|been|elleboog|schouder|heup|ribben|schedel|oor|oog|neus|mond|keel|huid/.test(
        lower
      )
    })()

    const isExplicitAnatomy = (() => {
      // Words that imply anatomy/structure, not just appearance
      return /anatomie|bot|botten|skelet|spier|spieren|pees|pezen|band|banden|orgaan|organen|doorsnede|spijsverter|bloedsomloop|ademhaling|zenuwstelsel|grays|gray's|gray|plaat|wikimedia|label|gelabeld/.test(
        lower
      )
    })()

    const isAnatomy = isExplicitAnatomy

    const wantsSchematicDiagram = (() => {
      return /schematisch|schema|diagram/.test(lower)
    })()

    const needsDiagram = (() => {
      return wantsSchematicDiagram && isExplicitAnatomy
    })()

    const wantsRemoteAnatomyPlate = (() => {
      // Only when the user actually means anatomy (structure), not just appearance.
      return isExplicitAnatomy && !wantsSchematicDiagram
    })()

    const wantsAppearanceImage = (() => {
      // NOTE: visuals are disabled; we handle these requests as text-only descriptions.
      const asksLooksLike = /hoe ziet|laat zien|toon|foto|afbeelding|plaat|image/.test(lower)
      return isBodyPartTopic && asksLooksLike && !isExplicitAnatomy && !wantsSchematicDiagram
    })()

    const needsGraph = (() => {
      // Interactive graphs are allowed via JSON { graph: { expressions: [...] } }
      return /grafiek|plot|plotten|functie|parabool|lijn\s+door|teken\s+de\s+grafiek|grafiek\s+van|y\s*=/.test(lower)
    })()

    const wantsMarkedPoints = (() => {
      return /markeer|punt|punten|top|toppen|snijpunt|snijpunten|oorsprong|vertex/.test(lower)
    })()

    const needsImage = (() => {
      // Broader intent: "toon/laat zien" often implies an image even without words like "plaatje/afbeelding".
      // Avoid triggering for graphing/math requests.
      if (needsGraph) return false
      // Anatomy/body part requests should show an image by default (even without "toon/laat zien").
      if (isBodyPartTopic || isExplicitAnatomy) return true
      return /laat\s+(me\s+)?zien|toon\b|show\b|laat\s+.*zien|plaatje\s+van|afbeelding\s+van|picture\s+of|image\s+of/.test(lower)
    })()

    const imageQueryPreset = (text: string): { query: string; caption?: string } | null => {
      const t = (text || '').toLowerCase()
      if (t.includes('nachtwacht')) return { query: 'The Night Watch Rembrandt painting', caption: 'De Nachtwacht (Rembrandt)' }
      // Anatomy presets: prefer canonical English terms for en.wikipedia queries
      const dict = anatomyCandidates(text || '')
      if (dict.canonical) return { query: dict.canonical, caption: (text || '').trim() }
      return null
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

    const hasSvgInMessage = (m: string) => /<svg[\s\S]*?<\/svg>/i.test(m || '')

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
        `\n\n[EXACTE TEKST UIT DE FOTO (OCR)]\n${ocrTranscript}\n\n[SYSTEEM OVERRIDE (STRICT): Gebruik ALLEEN de OCR-tekst hierboven om de opdracht te beantwoorden. Als info ontbreekt of onleesbaar is, zeg precies welk stukje ontbreekt en vraag om een scherpere close-up van dat deel. GEEN gokken. Houd je aan de Scaffolded Guide: methode/aanpak eerst, NOOIT het eindantwoord geven.]`
      // Keep images attached so the model can cross-check, but transcript is the source of truth.
      return partsCloneWithTextSuffix(userParts, suffix)
    })()

    let text = await runOnceWithRetry(finalUserParts, 'final', 2)

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
      const cleaned = sanitizeMessageForDisplay(payload.message)
      payload.message = cleaned || 'Er ging iets mis bij het genereren van een antwoord.'
    }

    // If we expected a graph but got none, retry once with a strict override.
    if (needsGraph && !payload.graph) {
      const strictGraph =
        "\n\n[SYSTEEM OVERRIDE (STRICT): De gebruiker vraagt om een grafiek. Antwoord met geldige JSON en voeg een 'graph' object toe met: {\"expressions\": [\"...\"]}. Gebruik formules in x zoals \"x^2\" of \"x+2\". Zet action op \"show_graph\". GEEN SVG, geen plaatjes.]"
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
        payload.action = 'show_graph'
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
        return 'Ik heb heel even geen verbinding met mijn brein. Wacht 5–10 seconden en probeer opnieuw.'
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
