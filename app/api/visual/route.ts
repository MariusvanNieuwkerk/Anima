import { NextResponse } from 'next/server';
import { generateImage } from '@/utils/generateImage';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt } = body;
    
    if (!prompt) return NextResponse.json({ error: 'No prompt' }, { status: 400 });

    // Direct doorsturen naar de utility, geen database tussenkomst
    const result = await generateImage(prompt);
    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
