// Archivo: app/dashboard/libros/page.tsx
'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Hash,
  Award,
  BarChart3,
  Search,
  Filter,
  RefreshCw,
  Plus,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  Lock,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch,
  ApiError,
  obtenerUsuarioSesion,
  UsuarioSesion,
} from '@/lib/api';
import { useSidebar } from '../sidebar-context';

type TabLibros = 'CONTADORES' | 'NUMERACION' | 'INSCRIPCION' | 'TITULOS';
type SerieNumeracion = 'ORD' | 'CF';
type CategoriaNumeracion = 'TITULACION' | 'ADMINISTRATIVO';

interface EscuelaCatalogo {
  id: number;
  nombre: string;
  siglasDocumento: string;
}

interface CausaCatalogo {
  id: number;
  ambito: 'CAMBIO_ASESOR' | 'CAMBIO_DICTAMINANTE' | 'DSE' | 'DOCUMENTO_EXTERNO';
  descripcion: string;
  requiereDetalleManual: boolean;
  activo: boolean;
}

interface ResumenContadoresResponse {
  anio: number;
  expedientes: { ultimoNumero: number };
  seriesResolucion: { ORD: number; CF: number };
  librosPorEscuela: Array<{
    escuelaProfesionalId: number;
    escuela: string;
    siglas: string;
    ultimoAsientoInscripcion: number;
    ultimoRegistroTitulo: number;
  }>;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface LibroNumeracionItem {
  id: string;
  numeroCompleto: string;
  numero: number;
  anio: number;
  serie: SerieNumeracion;
  categoria: CategoriaNumeracion;
  tipoDocumentoExterno: string | null;
  descripcion: string;
  fechaDocumento: string;
  registradoPorId: string;
  resolucionId: string | null;
  creadoEn: string;
  registradoPor: {
    id: string;
    nombresCompletos: string;
    iniciales: string;
  };
  resolucion: {
    id: string;
    tipo: string;
    situacionJuridica: string;
    estadoDocumental: string;
    expedienteId: string | null;
    expediente: { codigoExpediente: string } | null;
  } | null;
}

interface LibroInscripcionItem {
  id: string;
  escuelaProfesionalId: number;
  numeroAsiento: number;
  anio: number;
  numeroFolioFormateado: string;
  expedienteId: string;
  resolucionInscripcionId: string;
  tituloInscritoSnapshot: string;
  tesistasSnapshot: string;
  asesorSnapshot: string;
  estadoAsiento: string;
  fechaAsiento: string;
  creadoEn: string;
  escuelaProfesional: { id: number; nombre: string; siglasDocumento: string };
  expediente: { id: string; codigoExpediente: string; estado: string };
  resolucionInscripcion: {
    id: string;
    numeroCompleto: string;
    fechaEmision: string;
    situacionJuridica: string;
    estadoDocumental: string;
  };
}

interface LibroTituloItem {
  id: string;
  tesistaId: string | null;
  numeroRegistro: number;
  anioRegistro: number;
  expedienteId: string;
  resolucionTituloId: string;
  escuelaProfesionalId: number;
  tituladoTexto: string;
  denominacionOtorgada: string;
  fechaSustentacion: string | null;
  notaNumero: number | null;
  notaCalificativo: string | null;
  informeConformidadSA: string | null;
  estado: string;
  creadoEn: string;
  escuelaProfesional: { id: number; nombre: string; siglasDocumento: string };
  expediente: {
    id: string;
    codigoExpediente: string;
    tituloActual: string | null;
  };
  resolucionTitulo: {
    id: string;
    numeroCompleto: string;
    fechaEmision: string;
    situacionJuridica: string;
    estadoDocumental: string;
  };
}

interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_DISPONIBLES = [
  ANIO_ACTUAL + 1,
  ANIO_ACTUAL,
  ANIO_ACTUAL - 1,
  ANIO_ACTUAL - 2,
  ANIO_ACTUAL - 3,
];

function formatearFechaCorta(fechaIso: string | null | undefined): string {
  if (!fechaIso) return '—';
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return fechaIso;
  return fecha.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function LibrosOficialesPage() {
  const { sidebarAbierto, toggleSidebar } = useSidebar();
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [tabActiva, setTabActiva] = useState<TabLibros>('CONTADORES');

  // Catálogos auxiliares
  const [escuelas, setEscuelas] = useState<EscuelaCatalogo[]>([]);
  const [causasExternas, setCausasExternas] = useState<CausaCatalogo[]>([]);

  // Tab 1: Contadores
  const [anioContadores, setAnioContadores] = useState<number>(ANIO_ACTUAL);
  const [contadores, setContadores] = useState<ResumenContadoresResponse | null>(
    null,
  );
  const [cargandoContadores, setCargandoContadores] = useState(true);

  // Tab 2: Libro de Numeración
  const [numeracionItems, setNumeracionItems] = useState<LibroNumeracionItem[]>(
    [],
  );
  const [numeracionMeta, setNumeracionMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [numAnio, setNumAnio] = useState<string>('');
  const [numSerie, setNumSerie] = useState<string>('');
  const [numCategoria, setNumCategoria] = useState<string>('');
  const [numBusqueda, setNumBusqueda] = useState<string>('');
  const [numPage, setNumPage] = useState<number>(1);
  const [cargandoNumeracion, setCargandoNumeracion] = useState(false);

  // Modal Reservar Numeración Externa (POST /libros/numeracion/externo)
  const [modalExternaAbierto, setModalExternaAbierto] = useState(false);
  const [extSerie, setExtSerie] = useState<SerieNumeracion>('ORD');
  const [extAnio, setExtAnio] = useState<number>(ANIO_ACTUAL);
  const [extCausaId, setExtCausaId] = useState<string>('');
  const [extTipoDoc, setExtTipoDoc] = useState<string>('');
  const [extDescripcion, setExtDescripcion] = useState<string>('');
  const [extFechaDoc, setExtFechaDoc] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [guardandoExterna, setGuardandoExterna] = useState(false);

  // Tab 3: Libro de Inscripción
  const [inscripcionItems, setInscripcionItems] = useState<
    LibroInscripcionItem[]
  >([]);
  const [inscripcionMeta, setInscripcionMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [insEscuelaId, setInsEscuelaId] = useState<string>('');
  const [insAnio, setInsAnio] = useState<string>('');
  const [insEstado, setInsEstado] = useState<string>('');
  const [insBusqueda, setInsBusqueda] = useState<string>('');
  const [insPage, setInsPage] = useState<number>(1);
  const [cargandoInscripcion, setCargandoInscripcion] = useState(false);

  // Tab 4: Libro de Títulos
  const [titulosItems, setTitulosItems] = useState<LibroTituloItem[]>([]);
  const [titulosMeta, setTitulosMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [titEscuelaId, setTitEscuelaId] = useState<string>('');
  const [titAnio, setTitAnio] = useState<string>('');
  const [titEstado, setTitEstado] = useState<string>('');
  const [titBusqueda, setTitBusqueda] = useState<string>('');
  const [titPage, setTitPage] = useState<number>(1);
  const [cargandoTitulos, setCargandoTitulos] = useState(false);

  const puedeReservarExterna =
    usuario?.rol === 'ADMIN' ||
    usuario?.rol === 'SECRETARIA_ACADEMICA' ||
    usuario?.rol === 'ADMINISTRATIVO';

  const cargarCatalogosBase = async () => {
    try {
      const [listaEscuelas, listaCausas] = await Promise.all([
        apiFetch<EscuelaCatalogo[]>('/catalogos/escuelas', {
          servicio: 'titulacion',
        }),
        apiFetch<CausaCatalogo[]>(
          '/catalogos/causas?ambito=DOCUMENTO_EXTERNO',
          { servicio: 'titulacion' },
        ),
      ]);
      setEscuelas(listaEscuelas);
      setCausasExternas(listaCausas);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  };

  const cargarContadores = async (anio = anioContadores) => {
    setCargandoContadores(true);
    try {
      const data = await apiFetch<ResumenContadoresResponse>(
        `/libros/contadores?anio=${anio}`,
        { servicio: 'titulacion' },
      );
      setContadores(data);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargandoContadores(false);
    }
  };

  const cargarNumeracion = async (overrides?: {
    anio?: string;
    serie?: string;
    categoria?: string;
    busqueda?: string;
    page?: number;
  }) => {
    setCargandoNumeracion(true);
    try {
      const a = overrides?.anio !== undefined ? overrides.anio : numAnio;
      const s = overrides?.serie !== undefined ? overrides.serie : numSerie;
      const c =
        overrides?.categoria !== undefined ? overrides.categoria : numCategoria;
      const q =
        overrides?.busqueda !== undefined ? overrides.busqueda : numBusqueda;
      const p = overrides?.page !== undefined ? overrides.page : numPage;

      const params = new URLSearchParams();
      if (a) params.set('anio', a);
      if (s) params.set('serie', s);
      if (c) params.set('categoria', c);
      if (q.trim()) params.set('busqueda', q.trim());
      params.set('page', String(p));
      params.set('limit', '20');

      const resp = await apiFetch<PaginatedResponse<LibroNumeracionItem>>(
        `/libros/numeracion?${params.toString()}`,
        { servicio: 'titulacion' },
      );
      setNumeracionItems(resp.data);
      setNumeracionMeta(resp.meta);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargandoNumeracion(false);
    }
  };

  const cargarInscripcion = async (overrides?: {
    escuelaId?: string;
    anio?: string;
    estado?: string;
    busqueda?: string;
    page?: number;
  }) => {
    setCargandoInscripcion(true);
    try {
      const e =
        overrides?.escuelaId !== undefined ? overrides.escuelaId : insEscuelaId;
      const a = overrides?.anio !== undefined ? overrides.anio : insAnio;
      const est =
        overrides?.estado !== undefined ? overrides.estado : insEstado;
      const q =
        overrides?.busqueda !== undefined ? overrides.busqueda : insBusqueda;
      const p = overrides?.page !== undefined ? overrides.page : insPage;

      const params = new URLSearchParams();
      if (e) params.set('escuelaProfesionalId', e);
      if (a) params.set('anio', a);
      if (est) params.set('estadoAsiento', est);
      if (q.trim()) params.set('busqueda', q.trim());
      params.set('page', String(p));
      params.set('limit', '20');

      const resp = await apiFetch<PaginatedResponse<LibroInscripcionItem>>(
        `/libros/inscripcion?${params.toString()}`,
        { servicio: 'titulacion' },
      );
      setInscripcionItems(resp.data);
      setInscripcionMeta(resp.meta);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargandoInscripcion(false);
    }
  };

  const cargarTitulos = async (overrides?: {
    escuelaId?: string;
    anio?: string;
    estado?: string;
    busqueda?: string;
    page?: number;
  }) => {
    setCargandoTitulos(true);
    try {
      const e =
        overrides?.escuelaId !== undefined ? overrides.escuelaId : titEscuelaId;
      const a = overrides?.anio !== undefined ? overrides.anio : titAnio;
      const est =
        overrides?.estado !== undefined ? overrides.estado : titEstado;
      const q =
        overrides?.busqueda !== undefined ? overrides.busqueda : titBusqueda;
      const p = overrides?.page !== undefined ? overrides.page : titPage;

      const params = new URLSearchParams();
      if (e) params.set('escuelaProfesionalId', e);
      if (a) params.set('anioRegistro', a);
      if (est) params.set('estado', est);
      if (q.trim()) params.set('busqueda', q.trim());
      params.set('page', String(p));
      params.set('limit', '20');

      const resp = await apiFetch<PaginatedResponse<LibroTituloItem>>(
        `/libros/titulos?${params.toString()}`,
        { servicio: 'titulacion' },
      );
      setTitulosItems(resp.data);
      setTitulosMeta(resp.meta);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargandoTitulos(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setUsuario(obtenerUsuarioSesion());
      void cargarCatalogosBase();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (tabActiva === 'CONTADORES') {
      const timer = setTimeout(() => {
        void cargarContadores(anioContadores);
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva, anioContadores]);

  useEffect(() => {
    if (tabActiva === 'NUMERACION') {
      const timer = setTimeout(() => {
        void cargarNumeracion();
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva, numAnio, numSerie, numCategoria, numPage]);

  useEffect(() => {
    if (tabActiva === 'INSCRIPCION') {
      const timer = setTimeout(() => {
        void cargarInscripcion();
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva, insEscuelaId, insAnio, insEstado, insPage]);

  useEffect(() => {
    if (tabActiva === 'TITULOS') {
      const timer = setTimeout(() => {
        void cargarTitulos();
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva, titEscuelaId, titAnio, titEstado, titPage]);

  const causaExternaSeleccionada = causasExternas.find(
    (c) => String(c.id) === extCausaId,
  );

  const handleReservarExterna = async (e: FormEvent) => {
    e.preventDefault();
    if (!extDescripcion.trim()) {
      toast.error('La descripción o sumilla del documento es obligatoria.');
      return;
    }
    if (
      causaExternaSeleccionada?.requiereDetalleManual &&
      !extTipoDoc.trim()
    ) {
      toast.error(
        `La causa "${causaExternaSeleccionada.descripcion}" requiere especificar el detalle del tipo de documento.`,
      );
      return;
    }

    const payload: Record<string, unknown> = {
      serie: extSerie,
      anio: Number(extAnio),
      descripcion: extDescripcion.trim(),
      ...(extCausaId ? { causaCatalogoId: Number(extCausaId) } : {}),
      ...(extTipoDoc.trim()
        ? { tipoDocumentoExterno: extTipoDoc.trim().slice(0, 80) }
        : {}),
      ...(extFechaDoc ? { fechaDocumento: extFechaDoc } : {}),
    };

    setGuardandoExterna(true);
    try {
      const asiento = await apiFetch<LibroNumeracionItem>(
        '/libros/numeracion/externo',
        {
          servicio: 'titulacion',
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );
      toast.success(
        `Numeración reservada: ${asiento.numeroCompleto} (${asiento.serie}).`,
      );
      setModalExternaAbierto(false);
      setExtCausaId('');
      setExtTipoDoc('');
      setExtDescripcion('');
      await Promise.all([cargarNumeracion({ page: 1 }), cargarContadores()]);
      setNumPage(1);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudo reservar la numeración externa.');
    } finally {
      setGuardandoExterna(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Header con Breadcrumbs y Botón de Sidebar */}
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
          <span className="font-medium text-gray-800">Libros Oficiales</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Libros Oficiales y Contadores FCSa — UAC
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1 max-w-3xl">
              Control atómico de correlativos anuales, Libro de Numeración de Resoluciones, Libro de Inscripción de Temas y Libro Oficial de Títulos Profesionales.
            </p>
          </div>

          {puedeReservarExterna ? (
            <button
              type="button"
              onClick={() => setModalExternaAbierto(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E73BE] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#175B96] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Resolución Externa</span>
            </button>
          ) : (
            usuario && (
              <span
                title="Solo Secretaría Académica, Administrativo o Admin pueden reservar numeración externa"
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-100 px-3.5 py-2 text-xs font-semibold text-gray-500 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Reserva Externa (Solo SA / Admin)</span>
              </span>
            )
          )}
        </div>
      </div>

      {/* Selector de Pestañas */}
      <div className="bg-white rounded-2xl border border-gray-200 p-1.5 shadow-sm inline-flex flex-wrap gap-1">
        {(
          [
            {
              id: 'CONTADORES',
              label: 'Contadores Anuales',
              icon: BarChart3,
            },
            {
              id: 'NUMERACION',
              label: 'Libro de Numeración',
              icon: Hash,
            },
            {
              id: 'INSCRIPCION',
              label: 'Libro de Inscripción',
              icon: BookOpen,
            },
            {
              id: 'TITULOS',
              label: 'Libro de Títulos',
              icon: Award,
            },
          ] as const
        ).map((tab) => {
          const Icono = tab.icon;
          const activa = tabActiva === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabActiva(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                activa
                  ? 'bg-[#1E73BE] text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icono className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: CONTADORES ANUALES (GET /libros/contadores)                  */}
      {/* =================================================================== */}
      {tabActiva === 'CONTADORES' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Estado de Contadores Atómicos del Ejercicio {anioContadores}
              </h2>
              <p className="text-xs text-gray-500">
                Último correlativo asignado en expedientes, series ORD/CF y libros por Escuela Profesional
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={anioContadores}
                onChange={(e) => setAnioContadores(Number(e.target.value))}
                className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 bg-white focus:border-[#1E73BE] focus:outline-none"
              >
                {ANIOS_DISPONIBLES.map((a) => (
                  <option key={a} value={a}>
                    Año {a}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void cargarContadores(anioContadores)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${cargandoContadores ? 'animate-spin' : ''}`}
                />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          {cargandoContadores && !contadores ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-xs text-gray-400">
              Cargando contadores oficiales...
            </div>
          ) : (
            contadores && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase text-gray-500">
                        Expedientes ({contadores.anio})
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-[#1E73BE]" />
                      </div>
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900 font-mono">
                      {String(contadores.expedientes.ultimoNumero).padStart(
                        4,
                        '0',
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Próximo código:{' '}
                      <span className="font-mono font-semibold text-[#1E73BE]">
                        EXP-{contadores.anio}-
                        {String(
                          contadores.expedientes.ultimoNumero + 1,
                        ).padStart(4, '0')}
                      </span>
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase text-gray-500">
                        Serie Ordinaria (ORD)
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                        <Hash className="w-4 h-4 text-indigo-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900 font-mono">
                      {String(contadores.seriesResolucion.ORD).padStart(4, '0')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Último correlativo ORD emitido en {contadores.anio}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase text-gray-500">
                        Consejo de Facultad (CF)
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                        <Award className="w-4 h-4 text-purple-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900 font-mono">
                      {String(contadores.seriesResolucion.CF).padStart(4, '0')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Último correlativo CF (Apto / Título) en {contadores.anio}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900">
                      Contadores de Libros por Escuela Profesional (
                      {contadores.anio})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                          <th className="py-3.5 px-5">Escuela Profesional</th>
                          <th className="py-3.5 px-5">Siglas</th>
                          <th className="py-3.5 px-5 text-right">
                            Último Asiento Inscripción
                          </th>
                          <th className="py-3.5 px-5 text-right">
                            Último Registro de Título
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {contadores.librosPorEscuela.map((row) => (
                          <tr
                            key={row.escuelaProfesionalId}
                            className="hover:bg-gray-50/80"
                          >
                            <td className="py-3.5 px-5 font-bold text-gray-900">
                              {row.escuela}
                            </td>
                            <td className="py-3.5 px-5">
                              <span className="font-mono font-bold text-[#1E73BE] bg-blue-50 px-2 py-0.5 rounded">
                                {row.siglas}
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-right font-mono font-bold text-gray-800">
                              {String(row.ultimoAsientoInscripcion).padStart(
                                4,
                                '0',
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-right font-mono font-bold text-emerald-700">
                              {String(row.ultimoRegistroTitulo).padStart(
                                4,
                                '0',
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: LIBRO DE NUMERACIÓN (GET /libros/numeracion)                 */}
      {/* =================================================================== */}
      {tabActiva === 'NUMERACION' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (numPage !== 1) setNumPage(1);
              else void cargarNumeracion({ page: 1 });
            }}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Buscar por N.° Resolución o Descripción
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={numBusqueda}
                  onChange={(e) => setNumBusqueda(e.target.value)}
                  placeholder="Ej. 0001-2026, Comisión, Licencia..."
                  className="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2 text-xs focus:border-[#1E73BE] focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Año
              </label>
              <select
                value={numAnio}
                onChange={(e) => {
                  setNumAnio(e.target.value);
                  setNumPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs bg-white focus:border-[#1E73BE] focus:outline-none"
              >
                <option value="">Todos</option>
                {ANIOS_DISPONIBLES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Serie
              </label>
              <select
                value={numSerie}
                onChange={(e) => {
                  setNumSerie(e.target.value);
                  setNumPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs bg-white focus:border-[#1E73BE] focus:outline-none"
              >
                <option value="">Todas</option>
                <option value="ORD">ORD (Ordinaria)</option>
                <option value="CF">CF (Consejo Fac.)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Categoría
              </label>
              <select
                value={numCategoria}
                onChange={(e) => {
                  setNumCategoria(e.target.value);
                  setNumPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs bg-white focus:border-[#1E73BE] focus:outline-none"
              >
                <option value="">Todas</option>
                <option value="TITULACION">TITULACIÓN</option>
                <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
              </select>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1E73BE] px-3 py-2 text-xs font-semibold text-white hover:bg-[#175B96]"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtrar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNumAnio('');
                  setNumSerie('');
                  setNumCategoria('');
                  setNumBusqueda('');
                  setNumPage(1);
                  void cargarNumeracion({
                    anio: '',
                    serie: '',
                    categoria: '',
                    busqueda: '',
                    page: 1,
                  });
                }}
                className="p-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100"
                title="Limpiar filtros"
              >
                <RefreshCw
                  className={`w-4 h-4 ${cargandoNumeracion ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="py-3.5 px-4">Número Oficial</th>
                    <th className="py-3.5 px-4">Serie / Categoría</th>
                    <th className="py-3.5 px-4">Descripción / Tipo Externo</th>
                    <th className="py-3.5 px-4">Expediente / Resolución</th>
                    <th className="py-3.5 px-4">Fecha</th>
                    <th className="py-3.5 px-4">Registrado Por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {numeracionItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-gray-400 italic"
                      >
                        {cargandoNumeracion
                          ? 'Cargando Libro de Numeración...'
                          : 'No se encontraron asientos en el Libro de Numeración.'}
                      </td>
                    </tr>
                  ) : (
                    numeracionItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/80">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#1E73BE] whitespace-nowrap">
                          {item.numeroCompleto}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap space-x-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              item.serie === 'CF'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {item.serie}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.categoria === 'TITULACION'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.categoria}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-sm">
                          {item.tipoDocumentoExterno && (
                            <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded block w-fit mb-1">
                              {item.tipoDocumentoExterno}
                            </span>
                          )}
                          <p className="text-gray-800 font-medium">
                            {item.descripcion}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          {item.resolucion?.expedienteId ? (
                            <Link
                              href={`/dashboard/expedientes/${item.resolucion.expedienteId}`}
                              className="inline-flex items-center gap-1 font-mono font-bold text-[#1E73BE] hover:underline"
                            >
                              <span>
                                {item.resolucion.expediente?.codigoExpediente ||
                                  'Ver Expediente'}
                              </span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-gray-400 italic">
                              Trámite Administrativo Externo
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-gray-600 whitespace-nowrap">
                          {formatearFechaCorta(item.fechaDocumento)}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700">
                          <span className="font-semibold">
                            {item.registradoPor.nombresCompletos}
                          </span>{' '}
                          <span className="font-mono text-[10px] text-gray-400">
                            ({item.registradoPor.iniciales})
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {Math.max(1, numeracionMeta.totalPages) > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-600 bg-gray-50/50">
                <span>
                  Página <b>{numeracionMeta.page}</b> de{' '}
                  <b>{Math.max(1, numeracionMeta.totalPages)}</b> — Total:{' '}
                  <b>{numeracionMeta.total}</b> asientos
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={numeracionMeta.page <= 1}
                    onClick={() => setNumPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-semibold hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <button
                    type="button"
                    disabled={numeracionMeta.page >= numeracionMeta.totalPages}
                    onClick={() => setNumPage((p) => p + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-semibold hover:bg-gray-100 disabled:opacity-40"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: LIBRO DE INSCRIPCIÓN (GET /libros/inscripcion)               */}
      {/* =================================================================== */}
      {tabActiva === 'INSCRIPCION' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (insPage !== 1) setInsPage(1);
              else void cargarInscripcion({ page: 1 });
            }}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Buscar por Folio, Título, Tesista o Asesor
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={insBusqueda}
                  onChange={(e) => setInsBusqueda(e.target.value)}
                  placeholder="Ej. INS-ENF-2026-0001, título..."
                  className="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2 text-xs focus:border-[#1E73BE] focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Escuela Profesional
              </label>
              <select
                value={insEscuelaId}
                onChange={(e) => {
                  setInsEscuelaId(e.target.value);
                  setInsPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs bg-white focus:border-[#1E73BE] focus:outline-none"
              >
                <option value="">Todas las Escuelas</option>
                {escuelas.map((esc) => (
                  <option key={esc.id} value={esc.id}>
                    {esc.nombre.replace('Escuela Profesional de ', '')}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Año
              </label>
              <select
                value={insAnio}
                onChange={(e) => {
                  setInsAnio(e.target.value);
                  setInsPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs bg-white focus:border-[#1E73BE] focus:outline-none"
              >
                <option value="">Todos</option>
                {ANIOS_DISPONIBLES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Estado
              </label>
              <select
                value={insEstado}
                onChange={(e) => {
                  setInsEstado(e.target.value);
                  setInsPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 px-2 py-2 text-xs bg-white focus:border-[#1E73BE] focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="ACTIVO">ACTIVO</option>
                <option value="ANULADO">ANULADO</option>
              </select>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1E73BE] px-3 py-2 text-xs font-semibold text-white hover:bg-[#175B96]"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtrar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInsEscuelaId('');
                  setInsAnio('');
                  setInsEstado('');
                  setInsBusqueda('');
                  setInsPage(1);
                  void cargarInscripcion({
                    escuelaId: '',
                    anio: '',
                    estado: '',
                    busqueda: '',
                    page: 1,
                  });
                }}
                className="p-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100"
                title="Limpiar filtros"
              >
                <RefreshCw
                  className={`w-4 h-4 ${cargandoInscripcion ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="py-3.5 px-4">Folio / Fecha</th>
                    <th className="py-3.5 px-4">Escuela / Expediente</th>
                    <th className="py-3.5 px-4">Título Inscrito (Snapshot)</th>
                    <th className="py-3.5 px-4">Tesista(s) y Asesor</th>
                    <th className="py-3.5 px-4">Resolución</th>
                    <th className="py-3.5 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inscripcionItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-gray-400 italic"
                      >
                        {cargandoInscripcion
                          ? 'Cargando Libro de Inscripción...'
                          : 'No se encontraron asientos en el Libro de Inscripción.'}
                      </td>
                    </tr>
                  ) : (
                    inscripcionItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/80">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-[#1E73BE] block">
                            {item.numeroFolioFormateado}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatearFechaCorta(item.fechaAsiento)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-gray-900">
                            {item.escuelaProfesional.nombre.replace(
                              'Escuela Profesional de ',
                              '',
                            )}
                          </p>
                          <Link
                            href={`/dashboard/expedientes/${item.expediente.id}`}
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-[#1E73BE] hover:underline mt-0.5"
                          >
                            <span>{item.expediente.codigoExpediente}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="text-gray-800 font-medium line-clamp-2">
                            {item.tituloInscritoSnapshot}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="font-semibold text-gray-800">
                            {item.tesistasSnapshot}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Asesor: {item.asesorSnapshot}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-700 whitespace-nowrap">
                          {item.resolucionInscripcion.numeroCompleto}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.estadoAsiento === 'ACTIVO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.estadoAsiento}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {Math.max(1, inscripcionMeta.totalPages) > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-600 bg-gray-50/50">
                <span>
                  Página <b>{inscripcionMeta.page}</b> de{' '}
                  <b>{Math.max(1, inscripcionMeta.totalPages)}</b> — Total:{' '}
                  <b>{inscripcionMeta.total}</b> asientos
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={inscripcionMeta.page <= 1}
                    onClick={() => setInsPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-semibold hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <button
                    type="button"
                    disabled={
                      inscripcionMeta.page >= inscripcionMeta.totalPages
                    }
                    onClick={() => setInsPage((p) => p + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-semibold hover:bg-gray-100 disabled:opacity-40"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: LIBRO DE TÍTULOS (GET /libros/titulos)                       */}
      {/* =================================================================== */}
      {tabActiva === 'TITULOS' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (titPage !== 1) setTitPage(1);
              else void cargarTitulos({ page: 1 });
            }}
            className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Buscar por Titulado, Denominación o Informe SA
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={titBusqueda}
                  onChange={(e) => setTitBusqueda(e.target.value)}
                  placeholder="Ej. Licenciado en Enfermería, apellidos..."
                  className="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2 text-xs focus:border-[#1E73BE] focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Escuela Profesional
              </label>
              <select
                value={titEscuelaId}
                onChange={(e) => {
                  setTitEscuelaId(e.target.value);
                  setTitPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs bg-white focus:border-[#1E73BE] focus:outline-none"
              >
                <option value="">Todas las Escuelas</option>
                {escuelas.map((esc) => (
                  <option key={esc.id} value={esc.id}>
                    {esc.nombre.replace('Escuela Profesional de ', '')}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Año Registro
              </label>
              <select
                value={titAnio}
                onChange={(e) => {
                  setTitAnio(e.target.value);
                  setTitPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs bg-white focus:border-[#1E73BE] focus:outline-none"
              >
                <option value="">Todos</option>
                {ANIOS_DISPONIBLES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Estado
              </label>
              <select
                value={titEstado}
                onChange={(e) => {
                  setTitEstado(e.target.value);
                  setTitPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 px-2 py-2 text-xs bg-white focus:border-[#1E73BE] focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="VIGENTE">VIGENTE</option>
                <option value="ANULADO">ANULADO</option>
              </select>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1E73BE] px-3 py-2 text-xs font-semibold text-white hover:bg-[#175B96]"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtrar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitEscuelaId('');
                  setTitAnio('');
                  setTitEstado('');
                  setTitBusqueda('');
                  setTitPage(1);
                  void cargarTitulos({
                    escuelaId: '',
                    anio: '',
                    estado: '',
                    busqueda: '',
                    page: 1,
                  });
                }}
                className="p-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100"
                title="Limpiar filtros"
              >
                <RefreshCw
                  className={`w-4 h-4 ${cargandoTitulos ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="py-3.5 px-4">Registro</th>
                    <th className="py-3.5 px-4">Titulado / Expediente</th>
                    <th className="py-3.5 px-4">Título Profesional / Escuela</th>
                    <th className="py-3.5 px-4">Sustentación y Nota</th>
                    <th className="py-3.5 px-4">Resolución CF</th>
                    <th className="py-3.5 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {titulosItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-gray-400 italic"
                      >
                        {cargandoTitulos
                          ? 'Cargando Libro de Títulos...'
                          : 'No se encontraron registros en el Libro de Títulos.'}
                      </td>
                    </tr>
                  ) : (
                    titulosItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/80">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#1E73BE] whitespace-nowrap">
                          N.° {String(item.numeroRegistro).padStart(4, '0')}-
                          {item.anioRegistro}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-gray-900">
                            {item.tituladoTexto}
                          </p>
                          <Link
                            href={`/dashboard/expedientes/${item.expediente.id}`}
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-[#1E73BE] hover:underline mt-0.5"
                          >
                            <span>{item.expediente.codigoExpediente}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-gray-800">
                            {item.denominacionOtorgada}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {item.escuelaProfesional.nombre.replace(
                              'Escuela Profesional de ',
                              '',
                            )}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          {item.notaNumero !== null ? (
                            <div>
                              <span className="font-mono font-bold text-emerald-700">
                                Nota: {item.notaNumero}
                              </span>
                              {item.notaCalificativo && (
                                <span className="block text-[10px] text-gray-600">
                                  {item.notaCalificativo}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                          <span className="text-[10px] text-gray-400 block">
                            {formatearFechaCorta(item.fechaSustentacion)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-700 whitespace-nowrap">
                          {item.resolucionTitulo.numeroCompleto}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.estado === 'VIGENTE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.estado}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {Math.max(1, titulosMeta.totalPages) > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-600 bg-gray-50/50">
                <span>
                  Página <b>{titulosMeta.page}</b> de{' '}
                  <b>{Math.max(1, titulosMeta.totalPages)}</b> — Total:{' '}
                  <b>{titulosMeta.total}</b> registros
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={titulosMeta.page <= 1}
                    onClick={() => setTitPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-semibold hover:bg-gray-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <button
                    type="button"
                    disabled={titulosMeta.page >= titulosMeta.totalPages}
                    onClick={() => setTitPage((p) => p + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-semibold hover:bg-gray-100 disabled:opacity-40"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: REGISTRAR RESOLUCIÓN EXTERNA (POST /libros/numeracion/externo)*/}
      {/* =================================================================== */}
      {modalExternaAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden my-6">
            <div className="bg-[#1E73BE] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  Reservar Numeración para Resolución Externa
                </h3>
                <p className="text-[11px] text-blue-100">
                  Asigna el siguiente correlativo oficial en categoría ADMINISTRATIVO
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalExternaAbierto(false)}
                className="text-blue-100 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleReservarExterna}
              className="p-6 space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Serie de Numeración *
                  </label>
                  <select
                    value={extSerie}
                    onChange={(e) =>
                      setExtSerie(e.target.value as SerieNumeracion)
                    }
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs bg-white font-semibold"
                  >
                    <option value="ORD">ORD (Ordinaria)</option>
                    <option value="CF">CF (Consejo de Facultad)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Año del Libro
                  </label>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={extAnio}
                    onChange={(e) => setExtAnio(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-mono"
                  />
                </div>
              </div>

              {causasExternas.length > 0 && (
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Causa / Motivo Catálogo (Documento Externo)
                  </label>
                  <select
                    value={extCausaId}
                    onChange={(e) => setExtCausaId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs bg-white"
                  >
                    <option value="">— Sin causa de catálogo (Manual) —</option>
                    {causasExternas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.descripcion}
                        {c.requiereDetalleManual ? ' (Requiere detalle)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">
                  Tipo de Documento Externo{' '}
                  {causaExternaSeleccionada?.requiereDetalleManual
                    ? '*'
                    : '(Opcional, máx. 80 caracteres)'}
                </label>
                <input
                  type="text"
                  maxLength={80}
                  required={Boolean(
                    causaExternaSeleccionada?.requiereDetalleManual,
                  )}
                  value={extTipoDoc}
                  onChange={(e) => setExtTipoDoc(e.target.value)}
                  placeholder="Ej. Designación de Comisión, Licencia, Reconocimiento..."
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">
                  Descripción / Sumilla Oficial *
                </label>
                <textarea
                  rows={3}
                  required
                  value={extDescripcion}
                  onChange={(e) => setExtDescripcion(e.target.value)}
                  placeholder="Detalle el asunto de la resolución administrativa externa..."
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">
                  Fecha del Documento
                </label>
                <input
                  type="date"
                  value={extFechaDoc}
                  onChange={(e) => setExtFechaDoc(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalExternaAbierto(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoExterna}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1E73BE] text-white font-semibold hover:bg-[#175B96] disabled:opacity-60"
                >
                  {guardandoExterna ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Reservando...</span>
                    </>
                  ) : (
                    <span>Reservar Número Oficial</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
