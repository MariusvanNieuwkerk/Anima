import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * Haalt het profiel van de INGELOGDE gebruiker op (en maakt het aan als het
 * nog niet bestaat, bv. direct na signup).
 *
 * Security:
 * - Vereist een geldige sessie (cookies).
 * - Geeft alleen het eigen profiel terug; een meegegeven userId moet
 *   overeenkomen met de ingelogde gebruiker (anders 403).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestedUserId: string | undefined = body?.userId;

    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (requestedUserId && requestedUserId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Lezen kan via RLS (eigen profiel), maar aanmaken vereist admin
    // omdat er geen INSERT policy op profiles staat.
    const supabaseAdmin = createAdminClient();

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      // Profile bestaat nog niet → automatisch aanmaken voor de eigen user.
      if (error.code === 'PGRST116') {
        const userEmail = user.email || 'unknown@example.com';
        const baseName = userEmail.split('@')[0] || 'Student';

        // Gezinsproduct: alleen ouder- en kind-accounts.
        const metaRoleRaw = (user.user_metadata as any)?.role;
        const metaRole = typeof metaRoleRaw === 'string' ? metaRoleRaw.toLowerCase() : null;
        const role: 'student' | 'parent' = metaRole === 'parent' ? 'parent' : 'student';

        const rowBase: any = {
          id: user.id,
          role,
          display_name: baseName,
          student_name: role === 'student' ? baseName : null,
          parent_name: role === 'parent' ? baseName : null,
          teacher_name: null,
          deep_read_mode: false,
          created_at: new Date().toISOString(),
        };

        const isMissingEmail = (msg: string) => /profiles\.email|'email'/i.test(msg) && /does not exist|could not find/i.test(msg);
        const isMissingDisplayName = (msg: string) =>
          /profiles\.display_name|'display_name'/i.test(msg) && /does not exist|could not find/i.test(msg);

        // Sommige deployments missen profiles.email en/of display_name → probeer insert, daarna zonder die velden.
        const tryInsert = async (row: any) => supabaseAdmin.from('profiles').insert(row).select().single();

        const attempt1 = await tryInsert({ ...rowBase, email: userEmail });
        let newProfile = attempt1.data;
        let insertError = attempt1.error;

        if (insertError && isMissingEmail(String(insertError.message || ''))) {
          const attempt2 = await tryInsert(rowBase);
          newProfile = attempt2.data;
          insertError = attempt2.error;
        }

        if (insertError && isMissingDisplayName(String(insertError.message || ''))) {
          const rowNoDisplay: any = { ...rowBase };
          delete rowNoDisplay.display_name;

          const attempt3 = await tryInsert({ ...rowNoDisplay, email: userEmail });
          newProfile = attempt3.data;
          insertError = attempt3.error;

          if (insertError && isMissingEmail(String(insertError.message || ''))) {
            const attempt4 = await tryInsert(rowNoDisplay);
            newProfile = attempt4.data;
            insertError = attempt4.error;
          }
        }

        if (insertError) {
          console.error('[GET-PROFILE] Fout bij aanmaken profile:', insertError.message);
          return NextResponse.json({ error: 'Profile creation failed' }, { status: 500 });
        }

        return NextResponse.json({ profile: newProfile });
      }

      console.error('[GET-PROFILE] Database error:', error.message);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[GET-PROFILE] Exception:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
