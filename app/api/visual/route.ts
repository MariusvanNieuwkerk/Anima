import { NextResponse } from 'next/server';
import { generateImage } from '@/utils/generateImage';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt } = body;
    
    console.log("🎨 API/VISUAL: Prompt received:", prompt);

    if (!prompt) {
      return NextResponse.json({ error: 'No prompt provided' }, { status: 400 });
    }

    // Directe aanroep zonder database logging
    const result = await generateImage(prompt);
    
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("❌ API/VISUAL Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
