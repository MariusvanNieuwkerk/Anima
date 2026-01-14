import { NextRequest, NextResponse } from 'next/server';
import { getUnsplashVisual } from '@/utils/unsplash';

export async function POST(req: NextRequest) {
  try {
    const { keyword, topic, age, coach } = await req.json();

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const url = await getUnsplashVisual(
      keyword,
      topic || keyword,
      age || 12,
      coach || 'explorer'
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Visual API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
