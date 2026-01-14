import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '@/utils/supabase';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API Key mist" }, { status: 500 });
    }

    const { sessionId, studentName } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // 1. Haal alleen de messages op voor deze sessie (PRIVACY FILTER: alleen voor insight generatie)
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: "Error fetching messages" }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages found" }, { status: 400 });
    }

    // 2. Converteer messages naar een conversatie tekst voor Gemini
    const conversationText = messages
      .map(msg => `${msg.role === 'user' ? 'Leerling' : 'Anima'}: ${msg.content}`)
      .join('\n\n');

    // 3. Genereer insight met Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const systemPrompt = `
Je bent een pedagogische analist. Analyseer de volgende conversatie tussen een leerling en een AI-tutor (Anima).

Analyseer de conversatie en geef een JSON response met:
{
  "topic": "[Het hoofdonderwerp waarover werd gesproken, bijv. 'pistachenoten', 'breuken', 'fotosynthese']",
  "sentiment": "[Positief, Neutraal, of Zorgwekkend - gebaseerd op de toon en interactie]",
  "flow_score": [Een getal tussen 1-100 dat de inzet en flow van het kind weergeeft. 100 = perfecte flow, 50 = gemiddeld, <30 = worsteling],
  "summary": "[Een korte, warme pedagogische samenvatting voor de ouder over hoe het ging. Focus op proces, niet op cijfers. Maximaal 2 zinnen.]",
  "parent_tip": "[Een specifieke gespreksstarter voor aan de eettafel. Bijv. 'Vraag Rens hoe hij pistachenoten onderscheidt van andere noten.' Maximaal 1 zin.]",
  "needs_attention": [true of false - true als het kind worstelt of extra hulp nodig heeft],
  "knelpunt_detail": "[Alleen invullen als needs_attention true is. Beschrijf het specifieke knelpunt in 1 zin. Laat leeg als needs_attention false is.]"
}

Regels:
- flow_score: Gebaseerd op hoeveel vragen het kind stelde, doorzettingsvermogen, en positieve interactie
- sentiment: Positief = enthousiast en betrokken, Neutraal = normaal leerproces, Zorgwekkend = frustratie of gebrek aan begrip
- summary: Warm en ondersteunend, focus op inzet en proces
- parent_tip: Concreet en actiegericht, help de ouder een gesprek te starten
- needs_attention: true als flow_score < 50 of als er duidelijke worsteling is
- knelpunt_detail: Specifiek en behulpzaam, alleen als needs_attention true is
`;

    const prompt = `${systemPrompt}\n\nConversatie:\n${conversationText}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // 4. Parse JSON response
    let insightData;
    try {
      let jsonText = responseText.trim();
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '').trim();
      }
      
      insightData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Error parsing insight JSON:', parseError);
      return NextResponse.json({ error: "Error parsing insight response" }, { status: 500 });
    }

    // 5. Valideer data
    if (!insightData.topic || !insightData.sentiment || !insightData.summary || !insightData.parent_tip) {
      return NextResponse.json({ error: "Invalid insight data" }, { status: 500 });
    }

    // Ensure flow_score is between 1-100
    const flowScore = Math.max(1, Math.min(100, parseInt(insightData.flow_score) || 50));
    
    // Ensure needs_attention is boolean
    const needsAttention = insightData.needs_attention === true || insightData.needs_attention === 'true';
    const knelpuntDetail = insightData.knelpunt_detail || '';

    // 6. Sla insight op in Supabase
    console.log('DEBUG: Versturen naar insights...');
    console.log('[INSIGHTS API] Inserting insight into database:', {
      topic: insightData.topic,
      sentiment: insightData.sentiment,
      flow_score: flowScore,
      needs_attention: needsAttention,
      summary: insightData.summary.substring(0, 50) + '...',
      parent_tip: insightData.parent_tip.substring(0, 50) + '...'
    });

    const { data: insight, error: insertError } = await supabase
      .from('insights')
      .insert({
        topic: insightData.topic,
        sentiment: insightData.sentiment,
        flow_score: flowScore,
        summary: insightData.summary,
        parent_tip: insightData.parent_tip,
        needs_attention: needsAttention,
        knelpunt_detail: knelpuntDetail,
        student_name: studentName || null // Koppel aan student
      })
      .select()
      .single();

    if (insertError) {
      console.error('[INSIGHTS API] Error inserting insight:', insertError);
      console.error('[INSIGHTS API] Error details:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      return NextResponse.json({ error: "Error saving insight", details: insertError }, { status: 500 });
    }

    console.log('[INSIGHTS API] Successfully inserted insight:', insight?.id);
    console.log('SUCCESS');
    return NextResponse.json({ success: true, insight });

  } catch (error) {
    console.error("Insights API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

