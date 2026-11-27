// Archivo: middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function esJwtVigente(token: string | undefined): boolean {
  if (!token) return false;
  const partes = token.split('.');
  if (partes.length !== 3) return false;

  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number; sub?: string; rol?: string };
    if (!payload || (!payload.sub && !payload.rol)) return false;
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('fcsa_token')?.value;
  const tokenValido = esJwtVigente(token);
  const { pathname } = request.nextUrl;

  // Si intenta acceder a cualquier ruta de /dashboard sin token válido -> limpiar cookie y redirigir a /login
  if (pathname.startsWith('/dashboard') && !tokenValido) {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    if (token) {
      response.cookies.delete('fcsa_token');
    }
    return response;
  }

  // Si ya tiene sesión activa válida y entra a /login o a la raíz / -> redirigir a /dashboard
  if ((pathname === '/login' || pathname === '/') && tokenValido) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Si entra a /login con cookie expirada o corrupta -> limpiarla para evitar bucles
  if (pathname === '/login' && token && !tokenValido) {
    const response = NextResponse.next();
    response.cookies.delete('fcsa_token');
    return response;
  }

  // Si entra a la raíz / sin token válido -> redirigir a /login
  if (pathname === '/' && !tokenValido) {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    if (token) {
      response.cookies.delete('fcsa_token');
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*'],
};
