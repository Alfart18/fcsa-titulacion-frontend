// Archivo: middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('fcsa_token')?.value;
  const { pathname } = request.nextUrl;

  // Si intenta acceder a cualquier ruta de /dashboard sin token -> redirigir a /login
  if (pathname.startsWith('/dashboard') && !token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Si ya tiene sesión activa y entra a /login o a la raíz / -> redirigir a /dashboard
  if ((pathname === '/login' || pathname === '/') && token) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*'],
};