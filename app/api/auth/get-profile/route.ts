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

        // Role selection:
        // - Default to student
        // - If auth user_metadata.role is set (via signup), honor it for first profile creation.
        const metaRoleRaw = (authUser.user.user_metadata as any)?.role
        const metaRole = typeof metaRoleRaw === 'string' ? metaRoleRaw.toLowerCase() : null
        const role: 'student' | 'parent' | 'teacher' =
          metaRole === 'parent' || metaRole === 'teacher' || metaRole === 'student' ? (metaRole as any) : 'student'
        
        // Maak automatisch een profile aan
        const rowBase: any = {
          id: userId,
          role,
          display_name: baseName,
          student_name: role === 'student' ? baseName : null,
          parent_name: role === 'parent' ? baseName : null,
          teacher_name: role === 'teacher' ? baseName : null,
          deep_read_mode: false,
          created_at: new Date().toISOString()
        }

        const isMissingEmail = (msg: string) =>
          /column\\s+profiles\\.email\\s+does\\s+not\\s+exist/i.test(msg) || /email\\s+does\\s+not\\s+exist/i.test(msg)
        const isMissingDisplayName = (msg: string) =>
          /column\\s+profiles\\.display_name\\s+does\\s+not\\s+exist/i.test(msg) ||
          /display_name\\s+does\\s+not\\s+exist/i.test(msg) ||
          /could\\s+not\\s+find\\s+the\\s+'display_name'\\s+column\\s+of\\s+'profiles'\\s+in\\s+the\\s+schema\\s+cache/i.test(msg)

        // Some deployments don't have profiles.email and/or profiles.display_name yet → try insert, then retry with fields removed.
        const tryInsert = async (row: any) => supabaseAdmin.from('profiles').insert(row).select().single()

        const attempt1 = await tryInsert({ ...rowBase, email: userEmail })
        let newProfile = attempt1.data
        let insertError = attempt1.error

        if (insertError) {
          const msg1 = String(insertError.message || '')
          if (isMissingEmail(msg1)) {
            const attempt2 = await tryInsert(rowBase)
            newProfile = attempt2.data
            insertError = attempt2.error
          }
        }

        if (insertError) {
          const msg2 = String(insertError.message || '')
          if (isMissingDisplayName(msg2)) {
            const rowNoDisplay: any = { ...rowBase }
            delete rowNoDisplay.display_name

            const attempt3 = await tryInsert({ ...rowNoDisplay, email: userEmail })
            newProfile = attempt3.data
            insertError = attempt3.error

            if (insertError) {
              const msg3 = String(insertError.message || '')
              if (isMissingEmail(msg3)) {
                const attempt4 = await tryInsert(rowNoDisplay)
                newProfile = attempt4.data
                insertError = attempt4.error
              }
            }
          }
        }

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

    console.log(`[GET-PROFILE] Profile gevonden, role: ${profile.role}`);

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[GET-PROFILE] Exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

