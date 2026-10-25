// Archivo: lib/api.ts

export type RolUsuario = 'DECANO' | 'SECRETARIA_ACADEMICA' | 'ADMINISTRATIVO';

export interface UsuarioSesion {
  id: string;
  nombresCompletos: string;
  correo: string;
  iniciales: string;
  rol: RolUsuario;
  esDecanoFirmante: boolean;
}

export interface LoginResponse {
  accessToken: string;
  usuario: UsuarioSesion;
}

export type MicroservicioDestino = 'identidad' | 'titulacion' | 'documentos' | 'firmas';

const URLS_MICROSERVICIOS: Record<MicroservicioDestino, string> = {
  identidad: process.env.NEXT_PUBLIC_IDENTIDAD_API_URL || 'http://localhost:4000/api',
  titulacion: process.env.NEXT_PUBLIC_TITULACION_API_URL || 'http://localhost:4001/api',
  documentos: process.env.NEXT_PUBLIC_DOCUMENTOS_API_URL || 'http://localhost:4002/api',
  firmas: process.env.NEXT_PUBLIC_FIRMAS_API_URL || 'http://localhost:4003/api',
};

const STORAGE_TOKEN_KEY = 'accessToken';
const STORAGE_USER_KEY = 'usuario';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ============================================================================
// GESTIÓN DE SESIÓN EN LOCALSTORAGE + COOKIE SINCRONIZADA
// ============================================================================

export function guardarSesion(data: LoginResponse): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_TOKEN_KEY, data.accessToken);
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.usuario));

  // Cookie sincronizada con SameSite=Strict para protección de rutas en Next.js Middleware
  document.cookie = `fcsa_token=${data.accessToken}; path=/; max-age=28800; SameSite=Strict`;
}

export function obtenerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_TOKEN_KEY);
}

export function obtenerUsuarioSesion(): UsuarioSesion | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UsuarioSesion;
  } catch {
    return null;
  }
}

export function cerrarSesion(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
  document.cookie = 'fcsa_token=; path=/; max-age=0; SameSite=Strict';
}

// ============================================================================
// CLIENTE HTTP CENTRALIZADO PARA LOS 4 MICROSERVICIOS
// ============================================================================

interface FetchOpciones extends RequestInit {
  servicio?: MicroservicioDestino;
  autenticado?: boolean;
}

export async function apiFetch<T>(
  endpoint: string,
  opciones: FetchOpciones = {},
): Promise<T> {
  const {
    servicio = 'identidad',
    autenticado = true,
    headers: customHeaders,
    ...restOptions
  } = opciones;

  const baseUrl = URLS_MICROSERVICIOS[servicio];
  const rutaLimpia = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const urlCompleta = `${baseUrl}${rutaLimpia}`;

  const headers = new Headers(customHeaders);

  if (!(restOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (autenticado) {
    const token = obtenerToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(urlCompleta, {
    ...restOptions,
    headers,
  });

  if (!response.ok) {
    let mensajeServidor = 'Ocurrió un error al comunicarse con el servidor.';
    try {
      const errorData = await response.json();
      if (Array.isArray(errorData.message)) {
        mensajeServidor = errorData.message[0];
      } else if (typeof errorData.message === 'string') {
        mensajeServidor = errorData.message;
      }
    } catch {
      // Si la respuesta de error no es JSON
    }

    // Si una petición protegida recibe 401 (token expirado o inválido), limpiar sesión
    if (response.status === 401 && autenticado && typeof window !== 'undefined') {
      cerrarSesion();
      if (!window.location.pathname.startsWith('/login')) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login';
      }
    }

    throw new ApiError(response.status, mensajeServidor);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// ENDPOINT DE AUTENTICACIÓN (IDENTIDAD-SERVICE - PUERTO 4000)
// ============================================================================

export async function iniciarSesionApi(
  correo: string,
  password: string,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    servicio: 'identidad',
    autenticado: false,
    method: 'POST',
    body: JSON.stringify({ correo, password }),
  });
}