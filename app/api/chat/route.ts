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
    
    ### STRICT IMAGE PROMPTING RULES ###

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
    
    BELANGRIJK: Antwoord ALTIJD in het volgende JSON-formaat. Combineer je pedagogische antwoord met de visuele metadata:
    {
      "message": "[Uitleg volgens jouw Coach-stijl]",
      "visual_keyword": "[OPTIONEEL: ENGLISH image prompt voor generate_educational_image wanneer een visual helpt of wanneer de gebruiker expliciet om een visual vraagt; anders null of weglaten]",
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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
    
    const result = await chat.sendMessageStream(userParts);
    console.log(`[CHAT API] Gemini stream gestart`);
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(stream);
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
