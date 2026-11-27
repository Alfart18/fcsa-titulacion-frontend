// Archivo: app/dashboard/plantillas/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FileCode2,
  Eye,
  Save,
  History,
  RotateCcw,
  RefreshCw,
  Search,
  ChevronRight,
  PanelLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Code,
  Tag,
  ShieldAlert,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch,
  ApiError,
  obtenerUsuarioSesion,
  UsuarioSesion,
} from '@/lib/api';
import { useSidebar } from '../sidebar-context';

type SerieNumeracion = 'ORD' | 'CF';

type TipoResolucion =
  | 'ASESOR'
  | 'DICTAMEN'
  | 'INSCRIPCION'
  | 'TERCER_DICT'
  | 'APTO'
  | 'FECHA_HORA'
  | 'TITULO'
  | 'COASESOR'
  | 'CAMBIO_ASESOR'
  | 'CAMBIO_TITULO'
  | 'CAMBIO_DICTAMINANTE'
  | 'DSE'
  | 'DESISTIMIENTO';

interface PlantillaResumen {
  id: string;
  tipo: TipoResolucion;
  nombre: string;
  seriePorDefecto: SerieNumeracion;
  asuntoPlantilla: string;
  cuerpoHtml: string;
  variablesEsquema: string[];
  versionActual: number;
  activa: boolean;
  actualizadoPorId: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

interface PlantillaHistorialItem {
  id: string;
  plantillaId: string;
  version: number;
  asuntoPlantilla: string;
  cuerpoHtml: string;
  motivoCambio: string | null;
  modificadoPorId: string | null;
  fechaCambio: string;
}

interface PlantillaDetalle extends PlantillaResumen {
  historialVersiones: PlantillaHistorialItem[];
}

interface PrevisualizacionResponse {
  tipo: TipoResolucion;
  version: number;
  seriePorDefecto: SerieNumeracion;
  asuntoRenderizado: string;
  cuerpoHtmlRenderizado: string;
  variablesUtilizadas: Record<string, string>;
}

interface ExpedienteOption {
  id: string;
  codigoExpediente: string;
  tituloActual: string | null;
}

interface PaginatedExpedientesLite {
  data: ExpedienteOption[];
}

const ETIQUETAS_TIPO: Record<TipoResolucion, string> = {
  ASESOR: 'Paso 1 · Designación de Asesor',
  DICTAMEN: 'Paso 2 · Dictaminantes',
  INSCRIPCION: 'Paso 3 · Inscripción de Tema',
  TERCER_DICT: 'Paso 4 · Tercer Dictaminante',
  APTO: 'Paso 5 · Declaratoria de Apto',
  FECHA_HORA: 'Paso 6 · Fecha y Hora / Jurado',
  TITULO: 'Paso 7 · Título Profesional (CF)',
  COASESOR: 'Complementaria · Coasesor',
  CAMBIO_ASESOR: 'Complementaria · Cambio de Asesor',
  CAMBIO_TITULO: 'Complementaria · Cambio de Título',
  CAMBIO_DICTAMINANTE: 'Complementaria · Cambio de Dictaminante',
  DSE: 'Complementaria · Dejar Sin Efecto',
  DESISTIMIENTO: 'Complementaria · Desistimiento',
};

const ETIQUETAS_HTML_SEGURAS = new Set([
  'DIV',
  'P',
  'SPAN',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'BR',
  'HR',
  'H1',
  'H2',
  'H3',
  'H4',
  'UL',
  'OL',
  'LI',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'TH',
  'TD',
  'BLOCKQUOTE',
]);

const ATRIBUTOS_HTML_SEGUROS = new Set(['class']);

function sanitizarHtmlSeguro(html: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return '';
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');

  const limpiarNodo = (nodo: Node): void => {
    const hijos = Array.from(nodo.childNodes);
    for (const hijo of hijos) {
      if (hijo.nodeType === Node.ELEMENT_NODE) {
        const el = hijo as Element;
        const tag = el.tagName.toUpperCase();
        if (!ETIQUETAS_HTML_SEGURAS.has(tag)) {
          // Eliminar por completo etiquetas peligrosas con su contenido; desempaquetar el resto
          if (
            ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'FORM'].includes(
              tag,
            )
          ) {
            el.remove();
          } else {
            limpiarNodo(el);
            const frag = doc.createDocumentFragment();
            while (el.firstChild) frag.appendChild(el.firstChild);
            el.replaceWith(frag);
          }
          continue;
        }

        for (const attr of Array.from(el.attributes)) {
          if (!ATRIBUTOS_HTML_SEGUROS.has(attr.name.toLowerCase())) {
            el.removeAttribute(attr.name);
          }
        }
        limpiarNodo(el);
      } else if (hijo.nodeType === Node.COMMENT_NODE) {
        hijo.remove();
      }
    }
  };

  limpiarNodo(doc.body);
  return doc.body.innerHTML;
}

export default function PlantillasResolucionPage() {
  const { sidebarAbierto, toggleSidebar } = useSidebar();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [plantillas, setPlantillas] = useState<PlantillaResumen[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Detalle seleccionado
  const [tipoSeleccionado, setTipoSeleccionado] =
    useState<TipoResolucion | null>(null);
  const [detalle, setDetalle] = useState<PlantillaDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  // Pestaña activa del panel derecho
  const [tabDerecha, setTabDerecha] = useState<
    'EDITOR' | 'PREVIEW' | 'HISTORIAL'
  >('EDITOR');

  // Formulario de edición (PUT /plantillas/:tipo)
  const [formNombre, setFormNombre] = useState('');
  const [formSerie, setFormSerie] = useState<SerieNumeracion>('ORD');
  const [formAsunto, setFormAsunto] = useState('');
  const [formCuerpoHtml, setFormCuerpoHtml] = useState('');
  const [formActiva, setFormActiva] = useState(true);
  const [formMotivoCambio, setFormMotivoCambio] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Restauración de versión (POST /plantillas/:tipo/restaurar/:version)
  const [versionARestaurar, setVersionARestaurar] =
    useState<PlantillaHistorialItem | null>(null);
  const [restaurando, setRestaurando] = useState(false);

  // Previsualización (POST /plantillas/:tipo/previsualizar)
  const [expedientesLista, setExpedientesLista] = useState<ExpedienteOption[]>(
    [],
  );
  const [previewExpedienteId, setPreviewExpedienteId] = useState('');
  const [previewVariablesExtra, setPreviewVariablesExtra] = useState<
    Record<string, string>
  >({});
  const [previsualizando, setPrevisualizando] = useState(false);
  const [previewData, setPreviewData] =
    useState<PrevisualizacionResponse | null>(null);
  const [mostrarVariablesRender, setMostrarVariablesRender] = useState(false);

  const puedeEditar =
    usuario?.rol === 'ADMIN' || usuario?.rol === 'SECRETARIA_ACADEMICA';

  const cargarDetalle = useCallback(async (tipo: TipoResolucion) => {
    setCargandoDetalle(true);
    setPreviewData(null);
    setPreviewVariablesExtra({});
    try {
      const data = await apiFetch<PlantillaDetalle>(`/plantillas/${tipo}`, {
        servicio: 'titulacion',
      });
      setDetalle(data);
      setFormNombre(data.nombre);
      setFormSerie(data.seriePorDefecto);
      setFormAsunto(data.asuntoPlantilla);
      setFormCuerpoHtml(data.cuerpoHtml);
      setFormActiva(data.activa);
      setFormMotivoCambio('');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(`No se pudo cargar la plantilla ${tipo}.`);
    } finally {
      setCargandoDetalle(false);
    }
  }, []);

  const cargarPlantillas = useCallback(
    async (mantenerSeleccion?: TipoResolucion | null) => {
      setCargandoLista(true);
      try {
        const data = await apiFetch<PlantillaResumen[]>('/plantillas', {
          servicio: 'titulacion',
        });
        setPlantillas(data);
        const tipoInicial =
          mantenerSeleccion && data.some((p) => p.tipo === mantenerSeleccion)
            ? mantenerSeleccion
            : data[0]?.tipo ?? null;
        if (tipoInicial) {
          setTipoSeleccionado(tipoInicial);
          await cargarDetalle(tipoInicial);
        }
      } catch (err) {
        if (err instanceof ApiError) toast.error(err.message);
        else toast.error('No se pudieron cargar las plantillas de resolución.');
      } finally {
        setCargandoLista(false);
      }
    },
    [cargarDetalle],
  );

  const cargarExpedientesParaPreview = useCallback(async () => {
    try {
      const resp = await apiFetch<PaginatedExpedientesLite>(
        '/expedientes?page=1&limit=30',
        { servicio: 'titulacion' },
      );
      setExpedientesLista(Array.isArray(resp?.data) ? resp.data : []);
    } catch {
      // Opcional para enriquecer la previsualización
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setUsuario(obtenerUsuarioSesion());
      void cargarPlantillas();
      void cargarExpedientesParaPreview();
    }, 0);
    return () => clearTimeout(timer);
  }, [cargarPlantillas, cargarExpedientesParaPreview]);

  const plantillasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return plantillas;
    const q = busqueda.toLowerCase();
    return plantillas.filter(
      (p) =>
        p.tipo.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        (ETIQUETAS_TIPO[p.tipo] ?? '').toLowerCase().includes(q),
    );
  }, [plantillas, busqueda]);

  const variablesEsquemaActual = useMemo(() => {
    if (!detalle || !Array.isArray(detalle.variablesEsquema)) return [];
    return detalle.variablesEsquema.map((v) => String(v));
  }, [detalle]);

  const handleSeleccionarTipo = async (tipo: TipoResolucion) => {
    setTipoSeleccionado(tipo);
    setVersionARestaurar(null);
    await cargarDetalle(tipo);
  };

  const insertarVariableEnCursor = (variable: string) => {
    const token = `{{${variable}}}`;
    if (!puedeEditar) {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(token);
        toast.info(`Variable ${token} copiada al portapapeles.`);
      }
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) {
      setFormCuerpoHtml((prev) => `${prev}${token}`);
      return;
    }
    const start = textarea.selectionStart ?? formCuerpoHtml.length;
    const end = textarea.selectionEnd ?? formCuerpoHtml.length;
    const nuevoTexto =
      formCuerpoHtml.slice(0, start) + token + formCuerpoHtml.slice(end);
    setFormCuerpoHtml(nuevoTexto);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  // PUT /plantillas/:tipo
  const handleGuardarCambios = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalle || !puedeEditar) return;

    if (!formAsunto.trim() || !formCuerpoHtml.trim()) {
      toast.error('El asunto y el cuerpo HTML de la plantilla son obligatorios.');
      return;
    }

    setGuardando(true);
    try {
      // Construir DTO estricto (ActualizarPlantillaDto con forbidNonWhitelisted)
      const payload: {
        nombre?: string;
        seriePorDefecto?: SerieNumeracion;
        asuntoPlantilla: string;
        cuerpoHtml: string;
        activa?: boolean;
        motivoCambio?: string;
      } = {
        nombre: formNombre.trim() || undefined,
        seriePorDefecto: formSerie,
        asuntoPlantilla: formAsunto.trim(),
        cuerpoHtml: formCuerpoHtml,
        activa: formActiva,
      };
      if (formMotivoCambio.trim()) {
        payload.motivoCambio = formMotivoCambio.trim();
      }

      const actualizada = await apiFetch<PlantillaResumen>(
        `/plantillas/${detalle.tipo}`,
        {
          servicio: 'titulacion',
          method: 'PUT',
          body: JSON.stringify(payload),
        },
      );

      toast.success(
        `Plantilla ${actualizada.tipo} guardada como versión v${actualizada.versionActual}.`,
      );
      await cargarPlantillas(detalle.tipo);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudo guardar la nueva versión de la plantilla.');
    } finally {
      setGuardando(false);
    }
  };

  // POST /plantillas/:tipo/restaurar/:version
  const handleConfirmarRestauracion = async () => {
    if (!detalle || !versionARestaurar || !puedeEditar) return;
    setRestaurando(true);
    try {
      const restaurada = await apiFetch<PlantillaResumen>(
        `/plantillas/${detalle.tipo}/restaurar/${versionARestaurar.version}`,
        {
          servicio: 'titulacion',
          method: 'POST',
        },
      );
      toast.success(
        `Versión v${versionARestaurar.version} restaurada como nueva versión v${restaurada.versionActual}.`,
      );
      setVersionARestaurar(null);
      await cargarPlantillas(detalle.tipo);
      setTabDerecha('EDITOR');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudo restaurar la versión seleccionada.');
    } finally {
      setRestaurando(false);
    }
  };

  // POST /plantillas/:tipo/previsualizar
  const handlePrevisualizar = async () => {
    if (!detalle) return;
    setPrevisualizando(true);
    try {
      // Construir DTO estricto (PrevisualizarPlantillaDto)
      const payload: {
        expedienteId?: string;
        variablesExtra?: Record<string, string>;
      } = {};

      if (previewExpedienteId.trim()) {
        payload.expedienteId = previewExpedienteId.trim();
      }

      const extrasLimpias: Record<string, string> = {};
      for (const [k, v] of Object.entries(previewVariablesExtra)) {
        if (v.trim().length > 0) {
          extrasLimpias[k] = v.trim();
        }
      }
      if (Object.keys(extrasLimpias).length > 0) {
        payload.variablesExtra = extrasLimpias;
      }

      const data = await apiFetch<PrevisualizacionResponse>(
        `/plantillas/${detalle.tipo}/previsualizar`,
        {
          servicio: 'titulacion',
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );
      setPreviewData(data);
      setTabDerecha('PREVIEW');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudo generar la previsualización de la plantilla.');
    } finally {
      setPrevisualizando(false);
    }
  };

  const formatearFecha = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* 1. Header con Breadcrumbs */}
      <div className="flex flex-col gap-4">
        <nav className="flex items-center text-sm text-gray-500">
          <button
            type="button"
            className="hidden lg:flex p-1.5 mr-3 rounded-md text-gray-500 hover:bg-gray-200 transition-colors"
            title={sidebarAbierto ? 'Ocultar menú' : 'Mostrar menú'}
            onClick={toggleSidebar}
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <Link
            href="/dashboard"
            className="hover:text-gray-900 transition-colors"
          >
            Inicio
          </Link>
          <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
          <span className="font-medium text-gray-800">
            Plantillas de Resoluciones
          </span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Plantillas Oficiales de Resoluciones
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1 max-w-3xl">
              Administración versionada de formatos resolutivos HTML con
              interpolación de variables institucionales, historial de cambios y
              previsualización en vivo.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => void cargarPlantillas(tipoSeleccionado)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${cargandoLista ? 'animate-spin' : ''}`}
              />
              <span>Actualizar</span>
            </button>

            <button
              type="button"
              disabled={!detalle || previsualizando}
              onClick={() => void handlePrevisualizar()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E73BE] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#175B96] disabled:opacity-50 transition-colors"
            >
              {previsualizando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              <span>Previsualizar Plantilla</span>
            </button>
          </div>
        </div>
      </div>

      {/* Aviso de solo lectura para DECANO / ADMINISTRATIVO */}
      {usuario && !puedeEditar && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Modo consulta: solo <b>ADMIN</b> y <b>SECRETARÍA ACADÉMICA</b>{' '}
            pueden guardar nuevas versiones o restaurar historial de plantillas.
            Puede inspeccionar el código, el historial y previsualizar cualquier
            plantilla.
          </span>
        </div>
      )}

      {/* 2. Layout de 2 columnas: Catálogo de tipos | Detalle + Editor / Preview / Historial */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA (4 cols): Lista de Plantillas por Tipo */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-gray-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                  <FileCode2 className="w-5 h-5 text-[#1E73BE]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    Tipos de Resolución
                  </h2>
                  <p className="text-[11px] text-gray-500">
                    {plantillas.length} plantilla(s) registrada(s)
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar tipo o nombre..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-9 pr-3 py-2 text-xs text-gray-900 focus:border-[#1E73BE] focus:bg-white focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[640px] overflow-y-auto">
            {cargandoLista ? (
              <div className="py-12 text-center text-xs text-gray-400">
                Cargando plantillas oficiales...
              </div>
            ) : plantillasFiltradas.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400">
                No se encontraron plantillas para el filtro indicado.
              </div>
            ) : (
              plantillasFiltradas.map((item) => {
                const seleccionada = item.tipo === tipoSeleccionado;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleSeleccionarTipo(item.tipo)}
                    className={`w-full text-left p-4 transition-colors flex flex-col gap-1.5 ${
                      seleccionada
                        ? 'bg-blue-50/70 border-l-4 border-l-[#1E73BE]'
                        : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-mono font-bold ${
                          seleccionada ? 'text-[#1E73BE]' : 'text-gray-900'
                        }`}
                      >
                        {item.tipo}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                            item.seriePorDefecto === 'CF'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-[#1E73BE] border-blue-200'
                          }`}
                        >
                          {item.seriePorDefecto}
                        </span>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          v{item.versionActual}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs font-medium text-gray-700 line-clamp-2">
                      {item.nombre}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>{ETIQUETAS_TIPO[item.tipo] ?? item.tipo}</span>
                      {item.activa ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-500 font-semibold">
                          <XCircle className="w-3 h-3" /> Inactiva
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA (8 cols): Editor, Previsualización e Historial */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          {cargandoDetalle || !detalle ? (
            <div className="p-16 text-center text-sm text-gray-400 flex flex-col items-center gap-3">
              {cargandoDetalle ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-[#1E73BE]" />
                  <span>Cargando detalle y versiones de la plantilla...</span>
                </>
              ) : (
                <span>Seleccione una plantilla del panel izquierdo.</span>
              )}
            </div>
          ) : (
            <>
              {/* Cabecera de la plantilla seleccionada + Tabs */}
              <div className="p-6 border-b border-gray-100 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-[#1E73BE] border border-blue-200">
                        {detalle.tipo}
                      </span>
                      <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700">
                        Versión actual: v{detalle.versionActual}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                          detalle.activa
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {detalle.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mt-2">
                      {detalle.nombre}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Última actualización: {formatearFecha(detalle.actualizadoEn)}
                    </p>
                  </div>

                  {/* Selector de pestañas */}
                  <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTabDerecha('EDITOR')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        tabDerecha === 'EDITOR'
                          ? 'bg-white text-[#1E73BE] shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>{puedeEditar ? 'Editor' : 'Detalle HTML'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTabDerecha('PREVIEW');
                        if (!previewData) void handlePrevisualizar();
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        tabDerecha === 'PREVIEW'
                          ? 'bg-white text-[#1E73BE] shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Previsualizar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTabDerecha('HISTORIAL')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        tabDerecha === 'HISTORIAL'
                          ? 'bg-white text-[#1E73BE] shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>
                        Historial ({detalle.historialVersiones.length})
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* TAB 1: EDITOR / DETALLE */}
              {tabDerecha === 'EDITOR' && (
                <form
                  onSubmit={handleGuardarCambios}
                  className="p-6 space-y-5 flex-1"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-7 space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-700">
                        Nombre Descriptivo
                      </label>
                      <input
                        type="text"
                        maxLength={150}
                        disabled={!puedeEditar}
                        value={formNombre}
                        onChange={(e) => setFormNombre(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs text-gray-900 focus:border-[#1E73BE] focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>

                    <div className="md:col-span-3 space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-700">
                        Serie por Defecto
                      </label>
                      <select
                        disabled={!puedeEditar}
                        value={formSerie}
                        onChange={(e) =>
                          setFormSerie(e.target.value as SerieNumeracion)
                        }
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 focus:border-[#1E73BE] focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                      >
                        <option value="ORD">ORD (Ordinaria)</option>
                        <option value="CF">CF (Consejo de Facultad)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 flex items-end pb-1.5">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!puedeEditar}
                          checked={formActiva}
                          onChange={(e) => setFormActiva(e.target.checked)}
                          className="rounded border-gray-300 text-[#1E73BE] focus:ring-[#1E73BE]"
                        />
                        <span>Activa</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700">
                      Asunto de la Plantilla (máx. 300 caracteres) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={300}
                      disabled={!puedeEditar}
                      value={formAsunto}
                      onChange={(e) => setFormAsunto(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs text-gray-900 font-mono focus:border-[#1E73BE] focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </div>

                  {/* Variables disponibles */}
                  {variablesEsquemaActual.length > 0 && (
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-gray-700 inline-flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[#1E73BE]" />
                          Variables disponibles ({variablesEsquemaActual.length})
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {puedeEditar
                            ? 'Clic para insertar en el cursor del cuerpo HTML'
                            : 'Clic para copiar'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {variablesEsquemaActual.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => insertarVariableEnCursor(v)}
                            className="px-2 py-1 rounded-lg bg-white border border-blue-200 text-[#1E73BE] hover:bg-blue-50 font-mono text-[11px] font-medium transition-colors"
                          >
                            {`{{${v}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700">
                      Cuerpo HTML de la Resolución *
                    </label>
                    <textarea
                      ref={textareaRef}
                      required
                      rows={14}
                      disabled={!puedeEditar}
                      value={formCuerpoHtml}
                      onChange={(e) => setFormCuerpoHtml(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 p-3.5 text-xs font-mono text-gray-900 leading-relaxed focus:border-[#1E73BE] focus:outline-none disabled:bg-gray-50 disabled:text-gray-600"
                    />
                  </div>

                  {puedeEditar && (
                    <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-4">
                      <div className="flex-1 space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">
                          Motivo del Cambio (opcional, máx. 250 caracteres)
                        </label>
                        <input
                          type="text"
                          maxLength={250}
                          value={formMotivoCambio}
                          onChange={(e) => setFormMotivoCambio(e.target.value)}
                          placeholder="Ej. Actualización de base legal conforme al Reglamento 2026..."
                          className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={guardando}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E73BE] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#175B96] disabled:opacity-50 transition-colors shrink-0"
                      >
                        {guardando ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>
                          Guardar como Versión v{detalle.versionActual + 1}
                        </span>
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* TAB 2: PREVISUALIZACIÓN */}
              {tabDerecha === 'PREVIEW' && (
                <div className="p-6 space-y-5 flex-1">
                  {/* Controles de contexto para previsualización */}
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-8 space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">
                          Expediente de Referencia (opcional — interpola datos
                          reales)
                        </label>
                        <select
                          value={previewExpedienteId}
                          onChange={(e) =>
                            setPreviewExpedienteId(e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                        >
                          <option value="">
                            -- Usar datos de ejemplo institucionales --
                          </option>
                          {expedientesLista.map((exp) => (
                            <option key={exp.id} value={exp.id}>
                              {exp.codigoExpediente}
                              {exp.tituloActual
                                ? ` · ${exp.tituloActual.slice(0, 60)}`
                                : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-4">
                        <button
                          type="button"
                          disabled={previsualizando}
                          onClick={() => void handlePrevisualizar()}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E73BE] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#175B96] disabled:opacity-50 transition-colors"
                        >
                          {previsualizando ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          <span>Renderizar Vista Previa</span>
                        </button>
                      </div>
                    </div>

                    {/* Sobrescritura rápida de variables personalizadas */}
                    {variablesEsquemaActual.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer font-semibold text-[#1E73BE] hover:underline select-none">
                          Personalizar variables de prueba (variablesExtra)
                        </summary>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {variablesEsquemaActual.slice(0, 10).map((varName) => (
                            <div key={varName} className="space-y-1">
                              <label className="block text-[10px] font-mono text-gray-600">
                                {varName}
                              </label>
                              <input
                                type="text"
                                value={previewVariablesExtra[varName] ?? ''}
                                onChange={(e) =>
                                  setPreviewVariablesExtra((prev) => ({
                                    ...prev,
                                    [varName]: e.target.value,
                                  }))
                                }
                                placeholder={`Valor personalizado para {{${varName}}}`}
                                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>

                  {/* Resultado renderizado */}
                  {previsualizando ? (
                    <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#1E73BE]" />
                      <span>Interpolando variables en el servidor...</span>
                    </div>
                  ) : previewData ? (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-semibold text-gray-600">
                            Asunto renderizado:{' '}
                          </span>
                          <span className="font-bold text-gray-900">
                            {previewData.asuntoRenderizado}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-[#1E73BE] font-semibold">
                          v{previewData.version} · Serie{' '}
                          {previewData.seriePorDefecto}
                        </span>
                      </div>

                      {/* Hoja de documento renderizada */}
                      <div className="p-6 sm:p-8 rounded-2xl border border-gray-200 bg-white shadow-inner">
                        <div
                          className="prose prose-sm max-w-none text-gray-800 space-y-3 [&_h2]:text-center [&_h2]:text-base [&_h2]:font-bold [&_h2]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_p]:leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: sanitizarHtmlSeguro(
                              previewData.cuerpoHtmlRenderizado,
                            ),
                          }}
                        />
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setMostrarVariablesRender((prev) => !prev)
                          }
                          className="text-xs font-semibold text-[#1E73BE] hover:underline"
                        >
                          {mostrarVariablesRender
                            ? 'Ocultar variables utilizadas'
                            : `Ver variables utilizadas (${Object.keys(previewData.variablesUtilizadas).length})`}
                        </button>
                        {mostrarVariablesRender && (
                          <div className="mt-2 p-3.5 rounded-xl bg-gray-50 border border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            {Object.entries(
                              previewData.variablesUtilizadas,
                            ).map(([k, v]) => (
                              <div key={k} className="truncate">
                                <span className="font-mono font-semibold text-gray-700">
                                  {k}:
                                </span>{' '}
                                <span className="text-gray-600">{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-10 text-center text-xs text-gray-400">
                      Pulse &quot;Renderizar Vista Previa&quot; para generar el
                      documento interpolado.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: HISTORIAL DE VERSIONES */}
              {tabDerecha === 'HISTORIAL' && (
                <div className="p-6 space-y-4 flex-1">
                  {detalle.historialVersiones.length === 0 ? (
                    <div className="py-10 text-center text-xs text-gray-400">
                      Aún no existen versiones históricas registradas.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detalle.historialVersiones.map((ver) => {
                        const esActual = ver.version === detalle.versionActual;
                        return (
                          <div
                            key={ver.id}
                            className={`p-4 rounded-xl border transition-colors ${
                              esActual
                                ? 'bg-blue-50/50 border-blue-200'
                                : 'bg-white border-gray-200 hover:bg-gray-50/70'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-900 text-white">
                                  v{ver.version}
                                </span>
                                {esActual && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                    Versión Vigente
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">
                                  {formatearFecha(ver.fechaCambio)}
                                </span>
                              </div>

                              {puedeEditar && !esActual && (
                                <button
                                  type="button"
                                  onClick={() => setVersionARestaurar(ver)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[#1E73BE] text-xs font-semibold hover:bg-blue-100 transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Restaurar v{ver.version}</span>
                                </button>
                              )}
                            </div>

                            <p className="text-xs font-semibold text-gray-800 mt-2">
                              {ver.asuntoPlantilla}
                            </p>
                            {ver.motivoCambio && (
                              <p className="text-[11px] text-gray-500 mt-1">
                                Motivo: {ver.motivoCambio}
                              </p>
                            )}

                            <details className="mt-2 text-xs">
                              <summary className="cursor-pointer text-[11px] font-semibold text-gray-500 hover:text-gray-800 select-none">
                                Inspeccionar HTML guardado
                              </summary>
                              <pre className="mt-2 p-3 rounded-lg bg-gray-900 text-gray-100 text-[11px] overflow-x-auto whitespace-pre-wrap">
                                {ver.cuerpoHtml}
                              </pre>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de Confirmación de Restauración */}
      {versionARestaurar && detalle && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Confirmar Restauración
                  </h3>
                  <p className="text-xs text-gray-500">
                    Plantilla {detalle.tipo} · v{versionARestaurar.version}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVersionARestaurar(null)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Se restaurará el asunto y el cuerpo HTML de la{' '}
              <b>versión v{versionARestaurar.version}</b>, creando una nueva
              versión vigente <b>v{detalle.versionActual + 1}</b> y dejando
              registro en auditoría.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={restaurando}
                onClick={() => setVersionARestaurar(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={restaurando}
                onClick={() => void handleConfirmarRestauracion()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E73BE] text-xs font-bold text-white hover:bg-[#175B96] disabled:opacity-50 transition-colors"
              >
                {restaurando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                <span>Sí, Restaurar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
