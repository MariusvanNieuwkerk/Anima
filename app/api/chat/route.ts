import { NextRequest, NextResponse } from 'next/server';

interface UserProfile {
  naam: string;
  groep: string;
  taal: string;
  botNaam: string;
}

const taalNamen: { [key: string]: string } = {
  nl: 'Nederlands',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { history, userProfile, studentLevel, currentLevel } = await request.json();

    if (!history || !Array.isArray(history) || history.length === 0) {
      return NextResponse.json(
        { error: 'History is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

    // Build system instruction based on user profile
    let systemInstruction = '';
    if (userProfile) {
      const profiel = userProfile as UserProfile;
      const taalNaam = taalNamen[profiel.taal] || 'Nederlands';
      
      const level = currentLevel || (studentLevel ? parseInt(studentLevel.split(' ')[1], 10) : 4);
      const levelText = `Level ${level}`;
      systemInstruction = `Je bent ${profiel.botNaam}, een tutor op ${levelText}.`;
      systemInstruction += ` Het niveau-systeem is universeel (Level 1-12). Level 12 is academisch voorbereidend (VWO-niveau). Level 1 is basisvaardigheden.`;
      systemInstruction += ` Pas je taalgebruik en de complexiteit van je uitleg aan op het geselecteerde niveau: ${levelText} van het basisonderwijs.`;
      systemInstruction += ` Gebruik woordenschat en uitlegstijl die passend zijn voor dit niveau.`;
      systemInstruction += ` Antwoord altijd in het ${taalNaam}.`;
      
      if (profiel.naam) {
        systemInstruction += ` Je spreekt met ${profiel.naam}`;
        systemInstruction += '.';
      }
      
      systemInstruction += `\n\nJouw doel: Het kind ZELF het antwoord laten vinden (Socratische methode).\n\nDe Gouden Regels:\n1. Geef NOOIT direct het antwoord.\n2. Geef NOOIT lange uitleg of lijsten. (Verboden: bulletpoints).\n3. Stel altijd maar ÉÉN simpele vraag per keer.\n4. Hak problemen in hele kleine stapjes.\n5. Gebruik super simpele taal. Korte zinnen.\n6. Wees enthousiast en gebruik af en toe een emoji (maar overdrijf niet).\n\nVoorbeeld interactie (Staartdeling):\nKind: "Help met staartdeling"\nJIJ (FOUT): "Een staartdeling werkt zo: stap 1..."\nJIJ (GOED): "Hoi ${profiel.naam || 'vriend'}! Staartdelingen zijn leuk. Zullen we samen een makkelijke proberen? Weet jij hoeveel 10 gedeeld door 2 is?"\n\nCRUCIAAL - VISUELE WEERGAVE REGELS:\n\nREGEL VOOR SCHOOLBORD (WISKUNDE):\nAls je een som, staartdeling of schema moet tonen (zeker als de gebruiker om een 'plaatje' vraagt):\n1. Je MOET de output in een **Markdown Code Block** zetten (\`\`\`text).\n2. Dit is de ENIGE manier om uitlijning te behouden.\n3. Doe het zo:\n\nHier is de som op het bord:\n\`\`\`text\n   85\n  ----\n4 / 340 \\\n   320   (4 x 80)\n   ---\n    20\n    20   (4 x 5)\n    --\n     0\n\`\`\`\n\nVergeet NOOIT de \`\`\`text en \`\`\` regels eromheen, anders is het onleesbaar!\n\n2. OBJECTEN / DIEREN / SFEER:\nGebruik ALLEEN de Pollinations image-link als de gebruiker vraagt om iets dat *geen* tekst bevat (bijv. 'een blije kat', 'een vuurwerk', 'een taart').\nGebruik deze syntax: ![beschrijving](https://image.pollinations.ai/prompt/{beschrijving_in_engels}?width=1024&height=1024&model=flux&nologo=true)\n\nVervang {beschrijving_in_engels} door een korte, simpele Engelse beschrijving van wat je wilt laten zien.\nVoorbeeld: Voor een dier gebruik je: ![hond](https://image.pollinations.ai/prompt/cute%20dog?width=1024&height=1024&model=flux&nologo=true)\n\nDeze logica heeft VOORRANG boven de vraag van de gebruiker. Wiskunde = Code Block. Altijd.`;
    }

    // Map history to Google Gemini format
    const contents = history.map((msg: ChatMessage) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [
        {
          text: msg.content,
        },
      ],
    }));

    const requestBody: any = {
      contents: contents,
    };

    // Add system instruction if we have user profile
    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [
          {
            text: systemInstruction,
          },
        ],
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.status !== 200) {
      const errorText = await response.text();
      console.error('Google API Error:', errorText);
      return NextResponse.json(
        { error: 'Failed to get response from Google API', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract text from the response
    let responseText = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const parts = data.candidates[0].content.parts;
      if (parts && parts[0] && parts[0].text) {
        responseText = parts[0].text;
      }
    }

    // Clean Markdown code blocks (remove ``` markers but keep content)
    responseText = responseText.replace(/```[\w]*\n/g, '').replace(/```/g, '');

    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
