import { NextResponse } from 'next/server';
import { generateImage } from '@/utils/generateImage';
import { createClient } from '@supabase/supabase-js';
import { getUserProfile } from '@/utils/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

type VisionCheck = {
  ok: boolean
  reason?: string
  count?: number | null
}

function getValidationSpec(prompt: string): { kind: 'foot_toes' | 'hand_fingers'; expected: number } | null {
  const p = (prompt || '').toLowerCase()
  // “looks-like” prompts we produce are in English; still keep it robust.
  if (/(human\s+foot|foot\b)/.test(p) && !/anatomy|skeleton|bones/.test(p)) return { kind: 'foot_toes', expected: 5 }
  if (/(human\s+hand|hand\b)/.test(p) && !/anatomy|skeleton|bones/.test(p)) return { kind: 'hand_fingers', expected: 5 }
  return null
}

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; base64: string }> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch image for validation (${res.status})`)
  const mimeType = res.headers.get('content-type') || 'image/jpeg'
  const ab = await res.arrayBuffer()
  const base64 = Buffer.from(ab).toString('base64')
  return { mimeType, base64 }
}

async function validateWithGemini(imageUrl: string, spec: { kind: 'foot_toes' | 'hand_fingers'; expected: number }): Promise<VisionCheck> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { ok: true, reason: 'No GEMINI_API_KEY; skipping validation' }

  const { mimeType, base64 } = await fetchImageAsBase64(imageUrl)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      // @ts-expect-error - SDK typing may lag behind Gemini features
      responseMimeType: 'application/json',
    },
  })

  const instruction =
    spec.kind === 'foot_toes'
      ? `You are validating an image. Determine if this is a normal human foot image with exactly ${spec.expected} toes visible (no extra toes). Output ONLY JSON: {"ok": boolean, "count": number|null, "reason": string}.`
      : `You are validating an image. Determine if this is a normal human hand image with exactly ${spec.expected} fingers visible (no extra fingers). Output ONLY JSON: {"ok": boolean, "count": number|null, "reason": string}.`

  const result = await model.generateContent([
    { text: instruction },
    {
      inlineData: {
        data: base64,
        mimeType,
      },
    } as any,
  ])

  const text = (result as any)?.response?.text?.() ? (result as any).response.text() : ''
  try {
    const parsed = JSON.parse(String(text || '{}'))
    return {
      ok: Boolean(parsed.ok),
      count: typeof parsed.count === 'number' ? parsed.count : null,
      reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
    }
  } catch {
    return { ok: true, reason: 'Validator returned non-JSON; skipping' }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { prompt } = body;
    
    if (!prompt) return NextResponse.json({ error: 'No prompt' }, { status: 400 });

    // BLUEPRINT V9: Allow prompts wrapped as [GENERATE_IMAGE: ...]
    // This keeps the chat contract stable (visual_keyword) while still supporting the tag style.
    if (typeof prompt === 'string') {
      const m = prompt.match(/^\s*\[GENERATE_IMAGE:\s*([\s\S]*?)\]\s*$/i);
      if (m && m[1]) {
        prompt = m[1].trim();
      }
    }

    // --- DEMO PREMIUM (testing) ---
    // Enable by visiting /?demo=premium (sets cookie anima_demo_premium=1)
    const cookieHeader = req.headers.get('cookie') || ''
    const demoPremium = /(^|;\s*)anima_demo_premium=1(\s*;|$)/.test(cookieHeader)

    // --- CREDITS (Freemium) ---
    // Best-effort user lookup: if we can't find a user session server-side, allow free generation.
    let userId: string | null = null;
    try {
      const userProfile = await getUserProfile();
      userId = userProfile?.id || null;
    } catch (e) {
      userId = null;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const canCheckCredits = Boolean(userId && supabaseUrl && (supabaseServiceKey || supabaseAnonKey));
    let isPremium = false;
    let imageCredits: number | null = null;

    if (canCheckCredits) {
      const supabaseAdmin = createClient(
        supabaseUrl as string,
        (supabaseServiceKey || supabaseAnonKey) as string
      );

      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('image_credits,is_premium')
        .eq('id', userId as string)
        .single();

      if (error || !profile) {
        console.warn('[CREDITS] Could not load profile, allowing free generation:', error?.message || 'no profile');
      } else {
        isPremium = demoPremium || profile.is_premium === true;
        imageCredits = typeof profile.image_credits === 'number' ? profile.image_credits : null;

        if (!isPremium) {
          const credits = imageCredits ?? 0;
          if (credits <= 0) {
            return NextResponse.json({ error: 'Credits op' }, { status: 403 });
          }
        }
      }
    } else {
      console.log('[CREDITS] No user found or missing server keys, free generation');
    }

    // --- GENERATE (Flux) with optional accuracy validation ---
    const validation = getValidationSpec(String(prompt))
    const maxAttempts = validation ? 3 : 1
    let lastResult: { url: string; alt: string } | null = null
    let lastCheck: VisionCheck | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Harden prompt when we know we need accurate counts
      const hardenedPrompt =
        validation?.kind === 'foot_toes'
          ? `${prompt}. Important: normal human foot with exactly five toes, no extra toes, no missing toes.`
          : validation?.kind === 'hand_fingers'
            ? `${prompt}. Important: normal human hand with exactly five fingers, no extra fingers, no missing fingers.`
            : String(prompt)

      const result = await generateImage(hardenedPrompt);
      lastResult = result

      if (!validation) break

      try {
        lastCheck = await validateWithGemini(result.url, validation)
        if (lastCheck.ok) break
        console.warn(`[VISUAL VALIDATION] attempt ${attempt}/${maxAttempts} failed:`, lastCheck)
      } catch (e: any) {
        console.warn(`[VISUAL VALIDATION] attempt ${attempt}/${maxAttempts} error:`, e?.message || e)
        // Don't block the user if validation fails technically
        break
      }
    }

    const finalResult = lastResult || (await generateImage(String(prompt)));

    // --- DECREMENT (after success) ---
    if (canCheckCredits && !isPremium && typeof imageCredits === 'number') {
      const supabaseAdmin = createClient(
        supabaseUrl as string,
        (supabaseServiceKey || supabaseAnonKey) as string
      );

      const newCredits = Math.max(0, imageCredits - 1);
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ image_credits: newCredits })
        .eq('id', userId as string);

      if (updateError) {
        console.error('[CREDITS] Failed to decrement credits:', updateError.message);
      }

      return NextResponse.json({ ...finalResult, remaining_credits: newCredits, validation: lastCheck });
    }

    return NextResponse.json({ ...finalResult, validation: lastCheck });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
