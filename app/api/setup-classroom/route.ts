import { NextResponse } from 'next/server';

// DISABLED: legacy onboarding route zonder auth (hardcoded test-teacher).
// Klassen worden aangemaakt via server actions in app/actions/classroom-actions.ts
// (met ingelogde leraar + ownership checks).
export async function POST() {
  return NextResponse.json({ error: 'Deze route is uitgeschakeld.' }, { status: 410 });
}
