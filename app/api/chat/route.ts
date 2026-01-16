import { GoogleGenerativeAI } from "@google/generative-ai";
import { getUserProfile } from '@/utils/auth';

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
    
    if (tutorMode === 'focus') {
      coachInstructions = "SCAFFOLDED GUIDE: direct richting geven, methode uitleggen, maar géén eindantwoord in de eerste beurt bij sommen. Kort, zakelijk, geen emoji's. Eindig met een concrete volgende stap (mini-opdracht).";
      visualStrategy = "Je bent ook een Wetenschappelijk Illustrator. Als een visual nodig is: maak een Engelstalige prompt die ACCURAAT en DUIDELIJK is (1:1). Kies vaak voor een helder diagram/infographic met clean lines, high contrast, minimale achtergrond. Vermijd 'cinematic' of vage sfeerwoorden.";
    } else if (tutorMode === 'growth') {
      coachInstructions = "SCAFFOLDED GUIDE: direct richting geven, methode uitleggen, maar géén eindantwoord in de eerste beurt bij sommen. Warm, geduldig en ondersteunend (emoji's mag). Eindig met een concrete volgende stap (mini-opdracht).";
      visualStrategy = "Je bent ook een Wetenschappelijk Illustrator. Als een visual nodig is: maak een Engelstalige prompt die ACCURAAT en DUIDELIJK is (1:1). Kies een rustige, duidelijke diagram-stijl (textbook illustration), met minimale achtergrond en heldere labels. Vermijd 'cinematic' en overmatige decoratie.";
    } else {
      coachInstructions = "SCAFFOLDED GUIDE: direct richting geven, methode uitleggen, maar géén eindantwoord in de eerste beurt bij sommen. Vriendelijk en helder, geen 'schooljuf' toon. Eindig met een concrete volgende stap (mini-opdracht).";
      visualStrategy = "Je bent ook een Wetenschappelijk Illustrator. Als een visual nodig is: maak een Engelstalige prompt die ACCURAAT en DUIDELIJK is (1:1). Gebruik diagram/doorsnede/labelled textbook style als dat het concept beter uitlegt. Vermijd 'cinematic' en vage sfeerwoorden.";
    }

    const systemPrompt = `
    ROL: Anima, AI-tutor.
    LEEFTIJD: ${userAge} jaar. (Pas taalgebruik strikt aan).
    TAAL: ${targetLanguage.toUpperCase()} (Antwoord ALTIJD en ALLEEN in deze taal).
    
    COACH PROFIEL: ${coachInstructions}
    VISUAL STRATEGY: ${visualStrategy}

    ### VISUAL STRATEGY: FLUX VS SVG (HYBRID ENGINE)
    - Als de vraag gaat over **Wiskunde / Meetkunde / Breuken / Grafieken / Functies / Diagrammen**:
      - Gebruik GEEN image tool en zet ` + "`visual_keyword`" + ` op null/weglaten.
      - Je output moet een SVG zijn (voor rendering in de app).
      - Je MAG een SVG ook ZONDER dat de gebruiker erom vraagt toevoegen als het de uitleg merkbaar duidelijker maakt (bijv. bij meetkunde, grafieken, breuken, krachten/diagrammen). Niet vragen "wil je een tekening?"—gewoon doen als het helpt.
      - CRITICAL (JSON-SAFE): Plaats de SVG ALTIJD in een markdown code block met xml fences in de ` + "`message`" + ` string:
        ` + "```xml" + `
        <svg>...</svg>
        ` + "```" + `
      - CRITICAL (JSON-SAFE): Gebruik in de SVG ALTIJD **single quotes** voor alle attribute values (dus geen dubbele quotes) om JSON-escaping fouten te voorkomen.
      - BELANGRIJK VOOR JSON: nieuwe regels in strings moeten als ` + "`\\n`" + ` (escaped) zodat het geldige JSON blijft.
      - VISUAL MANDATE (meetkunde): Bij vragen over vormen/hoeken/oppervlakte is visuele output VERPLICHT. Je mag geen uitleg geven zonder bijbehorende SVG-constructie in ` + "`message`" + `.
      - In je ` + "`message`" + `: geef een KORTE uitleg (1–4 zinnen) + daarna de SVG (in de xml code block).
      - De SVG MOET het gevraagde diagram precies voorstellen (geen generieke vorm als er een specifieke situatie gevraagd wordt).

    - Als de vraag gaat over **"hoe ziet X eruit?" (lichaamsdeel als uiterlijk/foto)**:
      - Dit is GEEN anatomie-plaat. Gebruik Flux (via ` + "`visual_keyword`" + `) om een **heldere foto/illustratie** te tonen.
      - Maak een Engelstalige prompt die fotorealistisch/helder is (white background / studio / medical reference photo style).
      - Geen tekst in beeld (NO TEXT RULE).
      - Voorbeeld user: "Hoe ziet een voet eruit?" -> visual_keyword: [GENERATE_IMAGE: A clear photorealistic reference photo of a human foot, neutral pose, studio lighting, white background, no text...]

    - Als de vraag gaat over **Biologie / Anatomie (mens of dier) (botten/spieren/organen/doorsnede/labels/Gray)**:
      - Gebruik GEEN Flux en teken GEEN vrije SVG.
      - Gebruik de **REMOTE IMAGE ENGINE**: zet in ` + "`message`" + ` een tag:
        <remote-image query="..." caption="..." />
      - ` + "`query`" + ` moet Engels zijn en gericht op Gray's Anatomy (bv. "human skeleton", "hand bones", "pituitary gland", "heart anatomy").
      - De app zoekt de juiste Wikimedia Commons plaat + bronvermelding.
      - GEEN wedervragen zoals "Wil je een afbeelding?". Bij anatomie hoort standaard een afbeelding, tenzij de gebruiker expliciet "schematisch/diagram" vraagt.

    - Als de vraag gaat over **Biologie / Anatomie** maar de gebruiker vraagt om een **schematisch diagram** of je wilt iets simpel uitleggen:
      - Kies **DIAGRAM-FIRST (CURATED TEMPLATES)**: je tekent NIET vrij.
      - Je geeft een ` + "`diagram`" + ` object terug dat een bestaande template kiest + highlights/labels toevoegt.
      - Beschikbare templates (MENS): ` + "`human_organs_basic`" + `, ` + "`human_skeleton_basic`" + `
      - ` + "`diagram`" + ` schema (voorbeeld):
        "diagram": { "templateId": "human_organs_basic", "highlights": [{ "id": "heart", "color": "#ef4444" }] }
      - IDs (organen): ` + "`lung_left, lung_right, heart, liver, stomach, intestines, torso`" + `
      - IDs (skelet): ` + "`skull, spine, ribcage, pelvis, arm_left, arm_right, leg_left, leg_right`" + `

    ### REMOTE IMAGE ENGINE (WIKIMEDIA / GRAY'S ANATOMY)
    - Als de gebruiker expliciet vraagt om een **echte anatomie-plaat** (bijv. "Gray's Anatomy", "bron", "echte plaat", "historische anatomie plaat"):
      - Gebruik GEEN Flux en teken GEEN SVG.
      - Voeg in ` + "`message`" + ` een self-closing tag toe:
        <remote-image query="..." caption="..." />
      - ` + "`query`" + ` moet een korte zoekstring zijn (Engels), bv. "pituitary gland", "human skeleton", "heart anatomy".
      - Gebruik bij voorkeur CANONICAL termen (bijv. "pituitary gland" i.p.v. "hypofyse", "kidney anatomy" i.p.v. "nier").
      - De app zoekt vervolgens de juiste Wikimedia Commons plaat en toont de bronvermelding automatisch.
      - Zet ` + "`visual_keyword`" + ` op null/weglaten en zet ` + "`diagram`" + ` op null/weglaten.

    ### CURATOR / EXTERNAL DIAGRAM SEARCH (WIKIMEDIA COMMONS)
    Doel: Voor **standaard wetenschappelijke diagrams** (die al bestaan) ga je NIET zelf tekenen, maar je laat de app een betrouwbare bron zoeken.

    **SCOPE (Curator actief bij "CONCEPT" vragen):**
    - Anatomie & Biologie (zoals besproken)
    - Standaard Wiskundige Modellen (bv. "Pythagorean theorem proof diagram", "Fibonacci spiral")
    - Natuurkunde & Scheikunde (bv. "visible light spectrum", "Bohr model atom", "circuit symbols")
    - Economie & Aardrijkskunde (bv. "supply and demand curve", "water cycle diagram")

    **OUTPUT FORMAT (Search term):**
    - Geef in ` + "`message`" + ` een tag:
      [SEARCH_DIAGRAM: <specific English term> diagram]
    - Kies de **meest standaard 'schoolboek' versie** van een concept-diagram (didactic, clear, common).
      - Vermijd obscure varianten ("inverse", "advanced proof", "historical scan") als er een simpel standaarddiagram bestaat.
      - Voeg waar nuttig context toe in de zoekterm: "simple", "school", "right triangle", "with squares", "labeled".
      Voorbeelden:
      - [SEARCH_DIAGRAM: Pythagorean theorem squares on sides diagram]
      - [SEARCH_DIAGRAM: Bohr model atom diagram]
      - [SEARCH_DIAGRAM: supply and demand curve diagram]
      - [SEARCH_DIAGRAM: water cycle diagram]
    - De app vertaalt dit naar een Wikimedia Commons lookup en toont het plaatje met bronvermelding.
    - Zet ` + "`visual_keyword`" + ` op null/weglaten (geen Flux) en teken geen vrije SVG.

    **CRITICAL DISTINCTION: "CONCEPT" vs "SOM"**
    - CONCEPT = algemeen standaardmodel (bestaat in databases) -> Curator search tag.
    - SOM = uniek/specificiek voor deze leerling (moet exact kloppen) -> SVG (De Passer).
      Voorbeelden SOM (SVG):
      - "Teken de grafiek van y=2x+1"
      - "Teken een driehoek met zijden 3,4,5 en label de hoeken"
      - "Teken een trapezium met gegeven afmetingen uit het werkblad"
    - Als je twijfelt: als er een formule/waarden/gegeven afmetingen in de prompt staan, is het meestal een SOM -> SVG.

    ### UNIVERSAL GEOMETRY ENGINE ###

    Wanneer je gevraagd wordt om een geometrische vorm te tekenen, volg je dit strikte algoritme:

    **STEP 0: PARSE THE REQUEST (Diagram Spec)**
    - Bepaal eerst WAT er precies getekend moet worden:
      - Welke vorm(en)? (bijv. driehoek, trapezium, zeshoek, assenstelsel + grafiek)
      - Welke eigenschappen? (bijv. rechte hoek, gelijke zijden, parallelle lijnen, symmetrie)
      - Welke labels? (punten A,B,C; lengtes; hoekgrootte; aslabels)
    - Als er details ontbreken, maak redelijke aannames en label ze duidelijk in het diagram (maar blijf simpel).

    **STEP 1: IDENTIFY VERTICES (The "Points" Rule)**
    - Identificeer de vorm en het vereiste aantal hoekpunten (vertices).
      - Triangle = 3 vertices.
      - Rectangle/Square = 4 vertices.
      - Pentagon = 5 vertices.
    - CRITICAL: Je MAG een vorm niet tekenen met minder vertices dan vereist.
      (Bijv. een driehoek MOET 3 sets coördinaten hebben.)

    **STEP 2: PLOT COORDINATES**
    - Bereken de (x,y) coördinaten voor ALLE vertices eerst (mentaal) vóór je de SVG schrijft.
    - Centreer de vorm in een ` + "`viewBox=\"0 0 300 300\"`" + `.
    - Houd marge (bijv. 20–30px) zodat lijnen/labels niet worden afgesneden.

    **STEP 3: GENERATE SVG WITH "CLOSE PATH"**
    - Gebruik een ` + "`<path>`" + `.
    - Start met ` + "`M`" + ` (Move naar punt 1).
    - Gebruik ` + "`L`" + ` (Line naar punt 2, punt 3, ...).
    - MANDATORY: Eindig elke polygon path met ` + "`Z`" + `.
      - ` + "`Z`" + ` betekent: Close Path (terug naar het begin).
      - Zonder ` + "`Z`" + ` is de vorm BROKEN/OPEN.

    **STEP 4: ADD CONSTRAINT MARKERS (If requested)**
    - Rechte hoek: teken een klein hoekvierkantje met ` + "`<path>`" + ` of ` + "`<rect>`" + ` bij de 90°-hoek.
    - Gelijke zijden: teken 1 of 2 kleine streepjes (ticks) op de betreffende zijden.
    - Parallelle lijnen: markeer met pijltjes/gelijke marker.

    **Example Logic (Internal Monologue)**
    - "User wants a triangle. That means 3 points: A, B, C. I will draw A->B, B->C, C->A. I will use 'Z' to close it."

    **QUALITY CHECK (BEFORE YOU OUTPUT)**
    - Check: klopt het aantal vertices?
    - Check: is de vorm gesloten (Z aanwezig)?
    - Check: zie je de gevraagde eigenschap? (bijv. rechte hoek-marker als het een rechthoekige driehoek is)
    - Check: staan labels niet bovenop lijnen? (gebruik kleine offset)

    **OUTPUT**
    - Plaats de SVG ALTIJD in een ` + "```xml" + ` code block in de ` + "`message`" + ` (JSON-safe).
    - Include labels (A, B, C) near the vertices using ` + "`<text>`" + ` elements.

    - Als de vraag gaat over **Geschiedenis / Natuur / Biologie / Kunst / Context & sfeer**:
      - Gebruik Flux ALLEEN als de gebruiker expliciet om een plaatje vraagt (bv. "maak een afbeelding", "teken", "laat zien", "kun je een plaatje maken?").
      - Zet anders ` + "`visual_keyword`" + ` op null/weglaten (dus géén automatische visuals).
      - Gebruik Flux NOOIT voor dingen die tekst/labels nodig hebben (kaarten, grafieken met aslabels, woorden in beeld). Kies dan SVG (als het schematisch is) of leg het uit met woorden.
      - Format: zet ` + "`visual_keyword`" + ` op een string die start met:
        [GENERATE_IMAGE: <your detailed English prompt>]

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

    FORBIDDEN (tenzij de gebruiker expliciet vraagt: "Wat is het antwoord?"):
    - Geef niet meteen het eindantwoord zoals "€16,30" of "x = 4" in de eerste beurt.
    - Geen "Ik ga het even voor je uitrekenen" met de finale uitkomst.

    TONE:
    - Helpful, encouraging, empowering. Zeg bv: "Laten we deze samen kraken."

    KEEP IT SHORT:
    - Max 3 korte alinea's. Friendly tone. Geen 'schooljuf' taal.

    ### GOLDEN RULE (ALL TOPICS): EXPLANATION FIRST, VISUAL SECOND
    - De chat (message) bevat **altijd** de volledige uitleg (methode/intuïtie/stappen).
    - Elke visual (Wikimedia/Flux/SVG/Map) is **alleen ondersteunend**: 1 visueel anker, niet "de hele uitleg".
    - Verwijs naar het beeld als ondersteuning ("Kijk naar ..."), maar leg het ook in woorden uit.
    - Als je een Curator-tag of remote-image gebruikt: blijf in tekst uitleggen wat de leerling moet snappen.
    
    ### STRICT IMAGE PROMPTING RULES (ALLEEN VOOR FLUX / ` + "`visual_keyword`" + `) ###

    1. **NO TEXT RULE:** The prompt MUST explicitly forbid text. Always include keywords:
       "no text, no letters, no numbers, no labels, no writing."
       Reason: The image generator cannot render text correctly. All explanations must happen in the chat, not the image.

    2. **VISUAL RECIPE (GEOMETRY ONLY):** Describe strictly the shapes, colors, and composition.
       - Bad: "A diagram showing 3/4."
       - Good: "A minimalist flat vector icon of a single circle. The circle is divided into exactly 4 equal pie slices. 3 slices are filled with solid blue color. 1 slice is white. White background. Clean lines. High contrast. No text, no letters, no numbers, no labels, no writing."

    3. **STYLE:** Use "Flat Vector Art" or "Minimalist Icon" style for math/science. Avoid "Photorealistic" for abstract concepts like fractions.

    **YOUR TASK:**
    Translate the user's educational concept into a description of SHAPES ONLY.
    Use keywords: "diagram," "flat vector," "white background," "minimalist," "educational illustration," plus the NO TEXT keywords above.
    
    ### MAP ENGINE (INTERACTIEVE KAARTEN MET OPENSTREETMAP)
    - Als de vraag gaat over **landen/steden/rivieren/continenten**, of als de gebruiker expliciet vraagt om een kaart:
      - Gebruik GEEN Flux en teken GEEN kaart als SVG.
      - Lever een **interactieve kaart-spec** via het veld ` + "`map`" + ` in JSON, zodat de app echte (betrouwbare) kaartdata kan ophalen.
      - Zet ` + "`visual_keyword`" + ` op null/weglaten.
      - In ` + "`message`" + `: leg kort uit wat er op de kaart te zien is (1–3 zinnen).
      - JSON schema (voorbeeld):
        {
          "message": "Hier zie je de locaties op de kaart.",
          "map": {
            "title": "Nederland",
            "queries": [
              { "query": "Amsterdam, Netherlands", "label": "Amsterdam" },
              { "query": "Rotterdam, Netherlands", "label": "Rotterdam" }
            ],
            "zoom": 6
          },
          "topic": "Aardrijkskunde",
          "action": "show_map"
        }
      - ` + "`queries[].query`" + ` moet een normale plaats/gebied zoekstring zijn (bijv. "Rhine river", "Germany", "Africa"). De app geocodeert dit via OpenStreetMap.

    BELANGRIJK: Antwoord ALTIJD in het volgende JSON-formaat. Combineer je pedagogische antwoord met de visuele metadata:
    {
      "message": "[Uitleg volgens jouw Coach-stijl]",
      "visual_keyword": "[OPTIONEEL: ENGLISH image prompt voor generate_educational_image wanneer een visual helpt of wanneer de gebruiker expliciet om een visual vraagt; anders null of weglaten]",
      "map": "[OPTIONEEL: map spec object voor interactieve kaarten; anders null of weglaten]",
      "diagram": "[OPTIONEEL: diagram spec object voor curated anatomie/biologie templates; anders null of weglaten]",
      "topic": "[Het specifieke onderwerp]",
      "action": "update_board"
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
        // @ts-expect-error - SDK typing may lag behind Gemini features
        responseMimeType: "application/json",
      },
    });

    const previousHistory = messages.slice(0, -1).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: `Begrepen. Ik ben een "Scaffolded Guide": ik leg de methode uit en wijs details aan, maar ik geef niet meteen het eindantwoord tenzij je expliciet om het antwoord vraagt.` }] },
        ...previousHistory
      ],
    });

    const lastMessageContent = messages[messages.length - 1].content;
    let userParts: any[] = [{ text: lastMessageContent }];
    
    // IMAGE PAYLOAD: Controleer en verwerk afbeeldingen correct
    if (images.length > 0) {
        console.log(`[CHAT API] Verwerken van ${images.length} afbeelding(en)...`);
        images.forEach((imgData: string, index: number) => {
             const matches = imgData.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
             if (matches && matches.length === 3) {
                 const mimeType = matches[1];
                 const base64Data = matches[2];
                 console.log(`[CHAT API] Afbeelding ${index + 1}: mimeType=${mimeType}, dataLength=${base64Data.length}`);
                 userParts.push({ 
                   inlineData: { 
                     data: base64Data, 
                     mimeType: mimeType 
                   } 
                 });
             } else {
                 // Fallback: probeer base64 data te extraheren
                 const base64Data = imgData.includes(',') ? imgData.split(',')[1] : imgData;
                 console.log(`[CHAT API] Afbeelding ${index + 1}: Fallback naar JPEG, dataLength=${base64Data.length}`);
                 userParts.push({ 
                   inlineData: { 
                     data: base64Data, 
                     mimeType: "image/jpeg" 
                   } 
                 });
             }
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

    const validatePayload = (p: any) => {
      if (!p || typeof p !== 'object') return { ok: false as const, error: 'Payload is not an object' }
      if (typeof p.message !== 'string' || !p.message.trim()) return { ok: false as const, error: 'Missing message string' }
      if (p.visual_keyword != null && typeof p.visual_keyword !== 'string') return { ok: false as const, error: 'visual_keyword must be string or null/undefined' }
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
      // “Hoe ziet X eruit / laat zien / toon / foto” about a body part, without anatomy keywords => Flux is appropriate.
      const asksLooksLike = /hoe ziet|laat zien|toon|foto|afbeelding|plaat|image/.test(lower)
      return isBodyPartTopic && asksLooksLike && !isExplicitAnatomy && !wantsSchematicDiagram
    })()

    const hasSvgInMessage = (m: string) => /<svg[\s\S]*?<\/svg>/i.test(m || '')

    const partsCloneWithTextSuffix = (parts: any[], suffix: string) => {
      const cloned = parts.map((p) => ({ ...p }))
      if (cloned.length > 0 && typeof cloned[0]?.text === 'string') {
        cloned[0].text = `${cloned[0].text}${suffix}`
      }
      return cloned
    }

    const runOnce = async (parts: any[]) => {
      const r = await chat.sendMessage(parts)
      const txt = (r as any)?.response?.text?.() ? (r as any).response.text() : (r as any)?.response?.text?.() || ''
      return String(txt || '')
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
        const ocrRaw = await runOnce(ocrParts)
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

    // Final pass: answer using transcript as ground truth (no guessing).
    const finalUserParts = (() => {
      if (!ocrTranscript) return userParts
      const suffix =
        `\n\n[EXACTE TEKST UIT DE FOTO (OCR)]\n${ocrTranscript}\n\n[SYSTEEM OVERRIDE (STRICT): Gebruik ALLEEN de OCR-tekst hierboven om de opdracht te beantwoorden. Als info ontbreekt of onleesbaar is, zeg precies welk stukje ontbreekt en vraag om een scherpere close-up van dat deel. GEEN gokken. Houd je aan de Scaffolded Guide: methode/aanpak eerst, geen eindantwoord tenzij expliciet gevraagd.]`
      // Keep images attached so the model can cross-check, but transcript is the source of truth.
      return partsCloneWithTextSuffix(userParts, suffix)
    })()

    let text = await runOnce(finalUserParts)

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

    // If we *expected* a drawn SVG (SOM) but got none, retry once with stricter instruction.
    if (needsSvg && !hasSvgInMessage(payload.message) && !payload.map && !wantsCuratorDiagram) {
      const strictAddon =
        "\n\n[SYSTEEM OVERRIDE (STRICT): Geef GEEN wedervragen. Voeg ALTIJD een SVG toe in een ```xml code block in 'message' (met <svg>...</svg> en single quotes). Antwoord als geldige JSON en niets anders.]"
      const retryParts = partsCloneWithTextSuffix(userParts, strictAddon)
      const retryText = await runOnce(retryParts)

      try {
        const jsonText2 = extractJsonFromModelText(retryText)
        if (jsonText2) {
          const payload2 = JSON.parse(jsonText2)
          const v2 = validatePayload(payload2)
          if (v2.ok && hasSvgInMessage(payload2.message)) {
            payload = payload2
          }
        }
      } catch {
        // ignore retry failures
      }
    }

    // If this is a standard concept diagram, force a SEARCH_DIAGRAM tag once.
    if (wantsCuratorDiagram && !/\[SEARCH_DIAGRAM:/i.test(payload.message || '')) {
      const strictSearch =
        "\n\n[SYSTEEM OVERRIDE (STRICT): Dit is een standaard concept-diagram. Voeg in 'message' EXACT één tag toe met een schoolboek-zoekterm. Voor Pythagoras: gebruik bij voorkeur: [SEARCH_DIAGRAM: Pythagorean theorem squares on sides diagram]. GEEN SVG/GEEN diagram object/GEEN visual_keyword. Antwoord als geldige JSON en niets anders.]"
      const retryParts = partsCloneWithTextSuffix(userParts, strictSearch)
      const retryText = await runOnce(retryParts)
      try {
        const jsonText2 = extractJsonFromModelText(retryText)
        if (jsonText2) {
          const payload2 = JSON.parse(jsonText2)
          const v2 = validatePayload(payload2)
          if (v2.ok && /\[SEARCH_DIAGRAM:/i.test(payload2.message || '')) {
            payload = payload2
          }
        }
      } catch {
        // ignore
      }
    }

    // If we expected a curated anatomy diagram, retry once to force a diagram spec.
    if (needsDiagram && !payload.diagram && !wantsRemoteAnatomyPlate) {
      const strictDiagram =
        "\n\n[SYSTEEM OVERRIDE (STRICT): Voor biologie/anatomie: geef GEEN vrije SVG. Geef een 'diagram' object met templateId ('human_organs_basic' of 'human_skeleton_basic') + highlights ids (bijv. heart, lung_left, lung_right, liver, stomach, intestines) + optionele labels. Antwoord als geldige JSON en niets anders. 'visual_keyword' moet null zijn.]"
      const retryParts = partsCloneWithTextSuffix(userParts, strictDiagram)
      const retryText = await runOnce(retryParts)
      try {
        const jsonText2 = extractJsonFromModelText(retryText)
        if (jsonText2) {
          const payload2 = JSON.parse(jsonText2)
          const v2 = validatePayload(payload2)
          if (v2.ok && payload2.diagram) {
            payload = payload2
          }
        }
      } catch {
        // ignore
      }
    }

    // If the user wants a real anatomy plate, force a remote-image tag once.
    if (wantsRemoteAnatomyPlate && !/remote-image/i.test(payload.message || '')) {
      const strictRemote =
        "\n\n[SYSTEEM OVERRIDE (STRICT): Geef een <remote-image query=\"...\" caption=\"...\" /> tag in 'message' (self-closing). GEEN SVG/GEEN diagram. Antwoord als geldige JSON en niets anders. visual_keyword moet null zijn.]"
      const retryParts = partsCloneWithTextSuffix(userParts, strictRemote)
      const retryText = await runOnce(retryParts)
      try {
        const jsonText2 = extractJsonFromModelText(retryText)
        if (jsonText2) {
          const payload2 = JSON.parse(jsonText2)
          const v2 = validatePayload(payload2)
          if (v2.ok && /remote-image/i.test(payload2.message || '')) {
            payload = payload2
          }
        }
      } catch {
        // ignore
      }
    }

    // If the user asked “what does it look like?” for a body part and we got no visual_keyword, retry once to force Flux.
    if (wantsAppearanceImage && !payload.visual_keyword) {
      const strictFlux =
        "\n\n[SYSTEEM OVERRIDE (STRICT): De gebruiker vraagt om hoe het eruit ziet (niet anatomisch). Zet 'visual_keyword' op een [GENERATE_IMAGE: ...] prompt (Engels, fotorealistisch, white background, no text). Antwoord als geldige JSON en niets anders. Geef GEEN remote-image en GEEN SVG/diagram.]"
      const retryParts = partsCloneWithTextSuffix(userParts, strictFlux)
      const retryText = await runOnce(retryParts)
      try {
        const jsonText2 = extractJsonFromModelText(retryText)
        if (jsonText2) {
          const payload2 = JSON.parse(jsonText2)
          const v2 = validatePayload(payload2)
          if (v2.ok && typeof payload2.visual_keyword === 'string' && payload2.visual_keyword.includes('[GENERATE_IMAGE:')) {
            payload = payload2
          }
        }
      } catch {
        // ignore
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
    
    // Stuur een duidelijke error response terug
    return new Response(
      JSON.stringify({ 
        error: "Backend error",
        details: error?.message || "Er is een fout opgetreden bij het verwerken van je bericht."
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
