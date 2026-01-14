import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Simplified Middleware - Login first, security later
 * 
 * PRIORITY: Laat login pagina altijd door
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CRITICAL: Skip login pagina EERST (altijd toegankelijk)
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Skip voor API routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip voor static files
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // Voor nu: Laat alle andere routes door (we voegen beveiliging later toe)
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
