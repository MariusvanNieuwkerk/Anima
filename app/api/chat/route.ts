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
      coachInstructions = "Stijl: Kort, zakelijk, geen emoji's. Richt je puur op de kern van de opgave. Als het kind vastloopt, geef je alleen de regel of een hint als 'Escape Hatch'.";
      visualStrategy = "Kies letterlijke, duidelijke trefwoorden (bijv. 'math geometry' of 'periodic table').";
    } else if (tutorMode === 'growth') {
      coachInstructions = "Stijl: Warm, geduldig en ondersteunend met gebruik van emoji's. Gebruik 'Scaffolding' (samen de eerste stap zetten) als 'Escape Hatch'. Focus op het proces en geef complimenten over de inzet.";
      visualStrategy = "Kies zachte, bemoedigende beelden (bijv. 'growing plant' of 'cozy library').";
    } else {
      coachInstructions = "Stijl: Nieuwsgierig en onderzoekend. Gebruik de Socratische methode; stel vragen in plaats van antwoorden te geven. Gebruik analogieën als 'Escape Hatch' om abstracte concepten uit te leggen.";
      visualStrategy = "Kies inspirerende beelden die de context vergroten (bijv. 'ancient ruins' of 'space nebula').";
    }

    const systemPrompt = `
    ROL: Anima, AI-tutor.
    LEEFTIJD: ${userAge} jaar. (Pas taalgebruik strikt aan).
    TAAL: ${targetLanguage.toUpperCase()} (Antwoord ALTIJD en ALLEEN in deze taal).
    
    COACH PROFIEL: ${coachInstructions}
    VISUAL STRATEGY: ${visualStrategy}
    
    BELANGRIJK: Antwoord ALTIJD in het volgende JSON-formaat. Combineer je pedagogische antwoord met de visuele metadata:
    {
      "message": "[Uitleg volgens jouw Coach-stijl]",
      "visual_keyword": "[Volg de STRIKTE INSTRUCTIE hieronder - gebruik ALTIJD meerdere woorden met educatieve qualifiers]",
      "topic": "[Het specifieke onderwerp]",
      "action": "update_board"
    }
    
    ### STRIKTE INSTRUCTIE VOOR VISUAL_KEYWORD
    DE VISUAL_KEYWORD MOET HET EXACTE ONDERWERP UIT DE VRAAG BEVATTEN. Gebruik het PRECIES zoals de leerling het noemt.
    
    KRITIEKE REGEL: Begin ALTIJD met het exacte onderwerp uit de vraag. Voeg daarna educatieve qualifiers toe.
    
    Voorbeelden van CORRECT gebruik:
    - Vraag: "Hoe zien pistachenoten eruit" → visual_keyword: "pistachio nuts close-up detailed"
    - Vraag: "Hoe zien pinda's eruit" → visual_keyword: "peanuts close-up shell detailed"
    - Vraag: "Hoe ziet een snowboard eruit" → visual_keyword: "snowboard close-up detailed"
    - Vraag: "Hoe ziet een ski eruit" → visual_keyword: "ski close-up detailed"
    - Vraag: "Hoe ziet de zon eruit" → visual_keyword: "sun surface NASA telescope"
    - Vraag: "Hoe ziet een cel eruit" → visual_keyword: "cell structure microscope diagram"
    - Vraag: "Hoe ziet de maan eruit" → visual_keyword: "moon surface crater detailed"
    - Vraag: "Cashewnoten" → visual_keyword: "cashew nuts close-up detailed"
    
    Voorbeelden van FOUT gebruik (ABSOLUUT VERBIEDEN):
    - Vraag: "snowboard" → FOUT: "snow mountain", "winter landscape", "skiing", "snow"
    - Vraag: "ski" → FOUT: "skiing", "mountain snow", "winter sport", "snow"
    - Vraag: "pinda's" → FOUT: "baseball", "sport", "ball", "nuts in general"
    - Vraag: "pistachenoten" → FOUT: "plant", "green leaves", "succulent", "tree"
    - Vraag: "zon" → FOUT: "solar system", "space", "starfield", "astronomy"
    - Vraag: "cel" → FOUT: "biology", "microscope equipment", "science lab"
    
    STAP-VOOR-STAP PROCES:
    1. Identificeer het HOOFDONDERWERP uit de vraag (bijv. "pinda's", "pistachio", "zon", "cel")
    2. Gebruik dit EXACTE woord als EERSTE woord in visual_keyword
    3. Voeg maximaal 2-3 educatieve qualifiers toe: "close-up", "detailed", "photograph", "diagram"
    4. Gebruik NIETS anders dan het exacte onderwerp + qualifiers
    
    Regels voor 'visual_keyword':
    1. EERSTE WOORD = het exacte onderwerp uit de vraag (Engels vertaald indien nodig)
    2. Daarna: 2-3 educatieve qualifiers zoals "close-up", "detailed", "photograph", "diagram"
    3. TOTALE LENGTE: 3-5 woorden maximum
    4. NOOIT: andere objecten, verwante onderwerpen, of algemene termen
    
    REGELS:
    1. SOCRATISCHE METHODE: Geef nooit direct het antwoord. Stel verdiepende vragen.
    2. ANTI-SORRY: Verontschuldig je niet. Wees een kordate, warme tutor.
    3. FOCUS: Blijf strikt bij het onderwerp van de leerling. Geen zijsprongen.
    4. JSON FORMAAT: Geef ALTIJD alleen geldige JSON, geen extra tekst ervoor of erna.
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
        { role: "model", parts: [{ text: `Begrepen. Ik zal pro-actief visuele ondersteuning bieden bij vragen zoals 'hoe ziet dat eruit'.` }] },
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
