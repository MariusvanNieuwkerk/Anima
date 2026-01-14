import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Test endpoint om te controleren of service role key werkt
 * GET: Test verbinding
 * POST: Test specifieke user ID
 */
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const checks: Record<string, any> = {};

    // Check 1: Environment variables
    checks.env = {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasAnonKey: !!supabaseAnonKey,
      urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'NOT SET',
      serviceKeyPreview: supabaseServiceKey ? `${supabaseServiceKey.substring(0, 10)}...` : 'NOT SET'
    };

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ 
        error: 'Environment variables missing',
        checks
      }, { status: 500 });
    }

    // Check 2: Test database connection
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .limit(5);

    checks.database = {
      connected: !profilesError,
      error: profilesError?.message || null,
      profileCount: profiles?.length || 0,
      sampleProfiles: profiles || []
    };

    // Check 3: Test auth connection
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 5
    });

    checks.auth = {
      connected: !authError,
      error: authError?.message || null,
      userCount: authUsers?.users?.length || 0,
      sampleUsers: authUsers?.users?.map(u => ({ id: u.id, email: u.email })) || []
    };

    return NextResponse.json({ 
      success: true,
      message: 'Connection test complete',
      checks
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Exception',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    // Check profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    return NextResponse.json({
      userId,
      auth: {
        exists: !!authUser?.user,
        email: authUser?.user?.email || null,
        error: authError?.message || null
      },
      profile: {
        exists: !!profile,
        data: profile || null,
        error: profileError?.message || null,
        errorCode: profileError?.code || null
      }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Exception',
      details: error.message 
    }, { status: 500 });
  }
}

