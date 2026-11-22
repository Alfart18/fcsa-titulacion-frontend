// Archivo: lib/api.ts

export type RolUsuario =
  | 'ADMIN'
  | 'DECANO'
  | 'SECRETARIA_ACADEMICA'
  | 'ADMINISTRATIVO';

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

function manejarExpiracionSesion(status: number, autenticado: boolean): void {
  if (status === 401 && autenticado && typeof window !== 'undefined') {
    cerrarSesion();
    if (!window.location.pathname.startsWith('/login')) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/login';
    }
  }
}

async function extraerMensajeError(
  response: Response,
  mensajePorDefecto: string,
): Promise<string> {
  try {
    const errorData = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(errorData.message) && errorData.message.length > 0) {
      return errorData.message.join(' | ');
    }
    if (typeof errorData.message === 'string' && errorData.message.trim()) {
      return errorData.message;
    }
  } catch {
    // Si la respuesta de error no es JSON
  }
  return mensajePorDefecto;
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
    const mensajeServidor = await extraerMensajeError(
      response,
      'Ocurrió un error al comunicarse con el servidor.',
    );
    manejarExpiracionSesion(response.status, autenticado);
    throw new ApiError(response.status, mensajeServidor);
  }

  if (response.status === 204) {
    return undefined as T;
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

// ============================================================================
// DESCARGA Y VISUALIZACIÓN DE DOCUMENTOS PDF Y LOTES ZIP AUTENTICADOS
// ============================================================================

export async function abrirPdfAutenticado(
  endpoint: string,
  servicio: MicroservicioDestino = 'documentos',
  descargar = false,
  nombreArchivoDescarga = 'resolucion_uac.pdf',
): Promise<void> {
  const baseUrl = URLS_MICROSERVICIOS[servicio];
  const rutaLimpia = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const token = obtenerToken();

  const response = await fetch(`${baseUrl}${rutaLimpia}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const mensaje = await extraerMensajeError(
      response,
      'No se pudo generar o descargar el documento PDF.',
    );
    manejarExpiracionSesion(response.status, true);
    throw new ApiError(response.status, mensaje);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  if (descargar) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = nombreArchivoDescarga;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

export interface PrevisualizarPdfPayload {
  tipo: string;
  serie?: 'ORD' | 'CF';
  codigoExpediente?: string;
  expedienteId?: string;
  datosEspecificos: Record<string, unknown>;
  fechaEmision?: string;
}

export async function previsualizarPdfResolucionApi(
  payload: PrevisualizarPdfPayload,
  signal?: AbortSignal,
): Promise<Blob> {
  const baseUrl = URLS_MICROSERVICIOS.documentos;
  const token = obtenerToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}/documentos/previsualizar-pdf`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const mensaje = await extraerMensajeError(
      response,
      'No se pudo generar la vista previa del documento PDF.',
    );
    manejarExpiracionSesion(response.status, true);
    throw new ApiError(response.status, mensaje);
  }

  return response.blob();
}

export async function descargarZipPendientesApi(filtros?: {
  serie?: 'ORD' | 'CF';
  expedienteId?: string;
}): Promise<void> {
  const baseUrl = URLS_MICROSERVICIOS.firmas;
  const params = new URLSearchParams();
  if (filtros?.serie) params.set('serie', filtros.serie);
  if (filtros?.expedienteId) params.set('expedienteId', filtros.expedienteId);

  const query = params.toString() ? `?${params.toString()}` : '';
  const token = obtenerToken();

  const response = await fetch(`${baseUrl}/firmas/pendientes/zip${query}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const mensaje = await extraerMensajeError(
      response,
      'No se pudo generar el archivo ZIP de resoluciones pendientes.',
    );
    manejarExpiracionSesion(response.status, true);
    throw new ApiError(response.status, mensaje);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const fechaStr = new Date().toISOString().slice(0, 10);

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `LOTE_PENDIENTES_FIRMA_FCSA_${fechaStr}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}
