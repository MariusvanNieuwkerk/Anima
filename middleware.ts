import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const ROLE_HOME: Record<string, string> = {
  student: '/student/desk',
  parent: '/parent/dashboard',
  teacher: '/teacher/clipboard',
}

const isPublicPath = (pathname: string) => {
  // Homepage is always public (the "front door")
  if (pathname === '/') return true
  // Login is public
  if (pathname === '/login') return true
  // Mobile QR upload bridge should stay accessible without login
  if (pathname.startsWith('/upload')) return true
  // Static files
  if (pathname.startsWith('/_next/')) return true
  if (pathname.startsWith('/favicon')) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) return NextResponse.next()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Fail-open for deployments missing env vars, to avoid locking you out.
    return NextResponse.next()
  }

  // IMPORTANT: use a response we can mutate cookies on
  let response = NextResponse.next()

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
        cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: any }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not logged in -> /login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Logged in: determine role
  let role: string = 'student'
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    role = (data?.role as string) || 'student'
  } catch {
    role = 'student'
  }

  const home = ROLE_HOME[role] || ROLE_HOME.student

  // If user tries to access another role area, bounce to their home.
  const isRoleArea =
    pathname.startsWith('/student') ||
    pathname.startsWith('/parent') ||
    pathname.startsWith('/teacher')

  if (pathname === '/student' || pathname === '/parent' || pathname === '/teacher') {
    const url = request.nextUrl.clone()
    url.pathname = home
    return NextResponse.redirect(url)
  }

  if (isRoleArea && !pathname.startsWith(home.split('/')[1] ? `/${home.split('/')[1]}` : home)) {
    const url = request.nextUrl.clone()
    url.pathname = home
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Only protect role-based areas; homepage stays public.
  matcher: ['/student/:path*', '/parent/:path*', '/teacher/:path*'],
}
