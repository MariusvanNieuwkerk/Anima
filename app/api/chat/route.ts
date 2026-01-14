import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '@/utils/supabase';
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
      visualStrategy = "Kies letterlijke, duidelijke trefwoorden (bijv. 'math geometry' of 'periodic table').";
    } else if (tutorMode === 'growth') {
      coachInstructions = "SCAFFOLDED GUIDE: direct richting geven, methode uitleggen, maar géén eindantwoord in de eerste beurt bij sommen. Warm, geduldig en ondersteunend (emoji's mag). Eindig met een concrete volgende stap (mini-opdracht).";
      visualStrategy = "Kies zachte, bemoedigende beelden (bijv. 'growing plant' of 'cozy library').";
    } else {
      coachInstructions = "SCAFFOLDED GUIDE: direct richting geven, methode uitleggen, maar géén eindantwoord in de eerste beurt bij sommen. Vriendelijk en helder, geen 'schooljuf' toon. Eindig met een concrete volgende stap (mini-opdracht).";
      visualStrategy = "Kies inspirerende beelden die de context vergroten (bijv. 'ancient ruins' of 'space nebula').";
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
    
    ### IMAGE GENERATION RULES (KRITIEK - LEES DIT EERST)
    
    REGEL 1 (Trigger Discipline): 
    - ONLY include "visual_keyword" in your JSON response if visual evidence is CRITICAL for the explanation OR explicitly requested by the user.
    - NEVER generate images for:
      * Greetings (e.g., "hallo", "hi", "goedemorgen")
      * Pleasantries (e.g., "dank je", "oké", "ja")
      * Abstract concepts without concrete visual representation (e.g., "success", "patience", "happiness", "learning")
      * Simple confirmations (e.g., "ik snap het", "klopt")
      * Questions that don't require visual aid (e.g., "hoe gaat het?", "wat is 2+2?")
    - ONLY generate images when:
      * User explicitly asks "hoe ziet X eruit?" or "toon me X"
      * User asks about a specific physical object, structure, or visual concept
      * Visual evidence would significantly help explain a complex concept (e.g., "cel structuur", "atoom model")
    
    REGEL 2 (Query Engineering):
    - The "visual_keyword" MUST be in ENGLISH, regardless of the user's language.
    - It MUST be descriptive and SPECIFIC to the context, NOT generic.
    - Focus on the SPECIFIC object/detail discussed, NOT the general category.
    - Examples:
      * User: "Mijn snowboard binding is stuk" → visual_keyword: "close up detail of snowboard bindings technical parts" (NOT "snowboard")
      * User: "Hoe ziet een snowboard eruit?" → visual_keyword: "snowboard close-up detailed equipment" (NOT "snow mountain" or "winter landscape")
      * User: "Hoe zien pistachenoten eruit?" → visual_keyword: "pistachio nuts close-up shell detailed" (NOT "plant" or "green leaves")
      * User: "Hoe werkt een cel?" → visual_keyword: "cell structure microscope diagram detailed" (NOT "biology" or "microscope equipment")
    
    REGEL 3 (Context Priority):
    - Prioritize the SPECIFIC object/detail discussed over the general category.
    - If user mentions a specific part or detail, include that in the query.
    - Use descriptive qualifiers: "close-up", "detailed", "technical parts", "structure", "diagram", "photograph"
    - Query length: 4-7 words maximum (specific object + 2-3 qualifiers)
    
    BELANGRIJK: Antwoord ALTIJD in het volgende JSON-formaat. Combineer je pedagogische antwoord met de visuele metadata:
    {
      "message": "[Uitleg volgens jouw Coach-stijl]",
      "visual_keyword": "[ALLEEN als REGEL 1 van toepassing is - volg REGEL 2 & 3 strikt]",
      "topic": "[Het specifieke onderwerp]",
      "action": "update_board"
    }
    
    ### STRIKTE INSTRUCTIE VOOR VISUAL_KEYWORD (alleen als REGEL 1 van toepassing is)
    
    STAP-VOOR-STAP PROCES:
    1. Check REGEL 1: Is visual evidence CRITICAL? If NO, set visual_keyword to null or omit it entirely.
    2. If YES, identify the SPECIFIC object/detail from the question (e.g., "snowboard bindings", "pistachio nuts", "cell structure")
    3. Translate to English if needed
    4. Build query: [specific object] + [2-3 descriptive qualifiers]
    5. Examples:
       - "snowboard bindings close-up technical parts"
       - "pistachio nuts close-up shell detailed"
       - "cell structure microscope diagram detailed"
       - "snowboard close-up detailed equipment"
    
    Voorbeelden van CORRECT gebruik:
    - Vraag: "Hoe zien pistachenoten eruit?" → visual_keyword: "pistachio nuts close-up shell detailed"
    - Vraag: "Hoe zien pinda's eruit?" → visual_keyword: "peanuts close-up shell detailed"
    - Vraag: "Hoe ziet een snowboard eruit?" → visual_keyword: "snowboard close-up detailed equipment"
    - Vraag: "Mijn snowboard binding is stuk" → visual_keyword: "snowboard bindings close-up technical parts"
    - Vraag: "Hoe ziet de zon eruit?" → visual_keyword: "sun surface NASA telescope detailed"
    - Vraag: "Hoe ziet een cel eruit?" → visual_keyword: "cell structure microscope diagram detailed"
    
    Voorbeelden van FOUT gebruik (ABSOLUUT VERBIEDEN):
    - Vraag: "hallo" → FOUT: Geen visual_keyword (greeting, geen visuele hulp nodig)
    - Vraag: "snowboard" → FOUT: "snow mountain", "winter landscape", "skiing", "snow" (te generiek)
    - Vraag: "pinda's" → FOUT: "baseball", "sport", "ball", "nuts in general" (verkeerd object)
    - Vraag: "zon" → FOUT: "solar system", "space", "starfield", "astronomy" (te breed)
    - Vraag: "cel" → FOUT: "biology", "microscope equipment", "science lab" (te generiek)
    
    REGELS (ALGEMEEN):
    1. MUSEUM GUIDE: Geef direct uitleg; geen Socratische wedervragen.
    2. FOCUS: Blijf strikt bij het onderwerp van de leerling. Geen zijsprongen.
    3. JSON FORMAAT: Geef ALTIJD alleen geldige JSON, geen extra tekst ervoor of erna.
    4. IMAGE DISCIPLINE: Volg REGEL 1 strikt - geen images voor greetings, pleasantries, of abstracte concepten.
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
    
    // Test write naar insights tabel na succesvolle AI-respons
    console.log('DEBUG: Poging tot schrijven naar Supabase...');
    try {
      const { error } = await supabase
        .from('insights')
        .insert({
          topic: 'Test',
          sentiment: 'Positief',
          flow_score: 80,
          summary: 'De verbinding werkt!',
          parent_tip: 'Test tip',
          needs_attention: false,
          knelpunt_detail: ''
        });
      if (error) {
        console.error('DEBUG: Fout bij test write naar insights:', error);
      } else {
        console.log('DEBUG: Test write naar insights succesvol');
        console.log('SUCCESS');
      }
    } catch (testError) {
      console.error('DEBUG: Fout bij test write naar insights:', testError);
    }
    
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
