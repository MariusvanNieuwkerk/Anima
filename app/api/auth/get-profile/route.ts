import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side API route om profile op te halen
 * Gebruikt service role key om RLS te bypassen
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Gebruik service role key voor RLS bypass (alleen server-side!)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[GET-PROFILE] Service role key niet gevonden');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Maak admin client (bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log(`[GET-PROFILE] Ophalen profile voor user: ${userId}`);

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[GET-PROFILE] Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Als profile niet bestaat, maak automatisch een profile aan
      if (error.code === 'PGRST116') {
        console.log('[GET-PROFILE] Profile niet gevonden, maak automatisch aan...');
        
        // Haal email op van auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (authError || !authUser?.user) {
          console.error('[GET-PROFILE] Kan auth user niet ophalen:', authError);
          return NextResponse.json({ 
            error: 'Profile not found',
            details: 'Geen profile gevonden en kan auth user niet ophalen om profile aan te maken.'
          }, { status: 404 });
        }

        const userEmail = authUser.user.email || 'unknown@example.com';
        const baseName = userEmail.split('@')[0] || 'Student';
        
        // Maak automatisch een student profile aan
        const { data: newProfile, error: insertError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            email: userEmail,
            role: 'student',
            display_name: baseName,
            student_name: baseName,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error('[GET-PROFILE] Fout bij aanmaken profile:', insertError);
          return NextResponse.json({ 
            error: 'Profile creation failed',
            details: insertError.message
          }, { status: 500 });
        }

        console.log(`[GET-PROFILE] ✅ Profile automatisch aangemaakt, role: ${newProfile.role}`);
        return NextResponse.json({ profile: newProfile });
      }
      
      return NextResponse.json({ 
        error: 'Database error',
        details: error.message 
      }, { status: 500 });
    }

    if (!profile) {
      console.log('[GET-PROFILE] Profile is null');
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    console.log(`[GET-PROFILE] Profile gevonden, role: ${profile.role}, email: ${profile.email}`);

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[GET-PROFILE] Exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

