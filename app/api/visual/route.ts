import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/utils/generateImage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { keyword, topic, age, coach } = await req.json();

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    // VISIBILITY (DEBUG): laat zien wat we binnenkrijgen (dit is nu een Flux prompt, niet een Unsplash search term)
    console.log('[VISUAL] Flux prompt:', keyword);

    const result = await generateImage(keyword);

    // Keep response shape stable for the frontend (Workspace expects { url })
    return NextResponse.json({ url: result.url, alt: result.alt, topic, age, coach });
  } catch (error) {
    console.error('Visual API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
