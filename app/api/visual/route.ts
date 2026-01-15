import { NextResponse } from 'next/server';
import { generateImage } from '@/utils/generateImage';
import { createClient } from '@supabase/supabase-js';
import { getUserProfile } from '@/utils/auth';

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
        isPremium = profile.is_premium === true;
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

    // --- GENERATE (Flux) ---
    const result = await generateImage(prompt);

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

      return NextResponse.json({ ...result, remaining_credits: newCredits });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
