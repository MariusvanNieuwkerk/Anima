import { NextResponse } from 'next/server';

export async function POST() {
  // Logging tijdelijk uitgeschakeld om crashes te voorkomen
  return NextResponse.json({ status: 'ok' });
}
