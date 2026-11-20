// Archivo: app/dashboard/auditoria/page.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  Lock,
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch,
  ApiError,
  obtenerUsuarioSesion,
  RolUsuario,
  UsuarioSesion,
} from '@/lib/api';
import { useSidebar } from '../sidebar-context';

interface UsuarioAuditoriaResumen {
  id?: string;
  nombresCompletos: string;
  correo?: string;
  rol: string;
}

interface EventoAuditoria {
  id: string;
  usuarioId: string;
  inicialesUsuario: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  expedienteId: string | null;
  resolucionId: string | null;
  detalle: Record<string, unknown> | null;
  fechaHora: string;
  usuario?: UsuarioAuditoriaResumen;
}

interface MetaPaginacionAuditoria {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ListaAuditoriaPaginadaResponse {
  data: EventoAuditoria[];
  meta: MetaPaginacionAuditoria;
}

type OrigenAuditoria = 'identidad' | 'titulacion';

const ROLES_AUDITORIA_GLOBAL: RolUsuario[] = [
  'ADMIN',
  'DECANO',
  'SECRETARIA_ACADEMICA',
];

const LIMITE_PAGINA_TITULACION = 20;

export default function AuditoriaGlobalPage() {
  const { sidebarAbierto, toggleSidebar } = useSidebar();

  const [usuarioSesion, setUsuarioSesion] = useState<UsuarioSesion | null>(null);
  const [origen, setOrigen] = useState<OrigenAuditoria>('identidad');
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [metaPaginacion, setMetaPaginacion] =
    useState<MetaPaginacionAuditoria | null>(null);
  const [cargando, setCargando] = useState(true);

  // Filtros en cliente (Identidad)
  const [busqueda, setBusqueda] = useState('');
  const [accionFiltro, setAccionFiltro] = useState('');
  const [operadorFiltro, setOperadorFiltro] = useState('');

  // Filtros de servidor (Titulación - paginado, solo ADMIN)
  const [entidadServidor, setEntidadServidor] = useState('');
  const [accionServidor, setAccionServidor] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [pagina, setPagina] = useState(1);

  // Modal de Inspección Forense JSONB
  const [eventoSeleccionado, setEventoSeleccionado] =
    useState<EventoAuditoria | null>(null);

  const cargarAuditoriaIdentidad = useCallback(async () => {
    setCargando(true);
    try {
      const data = await apiFetch<EventoAuditoria[]>('/admin/auditoria', {
        servicio: 'identidad',
      });
      setEventos(Array.isArray(data) ? data : []);
      setMetaPaginacion(null);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudo cargar la bitácora de identidad.');
      }
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarAuditoriaTitulacion = useCallback(
    async (paginaObjetivo: number) => {
      setCargando(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(paginaObjetivo));
        params.set('limit', String(LIMITE_PAGINA_TITULACION));
        if (entidadServidor.trim()) params.set('entidad', entidadServidor.trim());
        if (accionServidor.trim()) params.set('accion', accionServidor.trim());
        if (fechaDesde) params.set('fechaDesde', fechaDesde);
        if (fechaHasta) params.set('fechaHasta', fechaHasta);

        const respuesta = await apiFetch<ListaAuditoriaPaginadaResponse>(
          `/auditoria?${params.toString()}`,
          { servicio: 'titulacion' },
        );
        setEventos(Array.isArray(respuesta.data) ? respuesta.data : []);
        setMetaPaginacion(respuesta.meta ?? null);
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error('No se pudo cargar la bitácora de titulación.');
        }
      } finally {
        setCargando(false);
      }
    },
    [accionServidor, entidadServidor, fechaDesde, fechaHasta],
  );

  useEffect(() => {
    const sesion = obtenerUsuarioSesion();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsuarioSesion(sesion);
    if (sesion && ROLES_AUDITORIA_GLOBAL.includes(sesion.rol)) {
      cargarAuditoriaIdentidad();
    } else {
      setCargando(false);
    }
  }, [cargarAuditoriaIdentidad]);

  const cambiarOrigen = (nuevoOrigen: OrigenAuditoria) => {
    if (nuevoOrigen === origen) return;
    setOrigen(nuevoOrigen);
    setBusqueda('');
    setAccionFiltro('');
    setOperadorFiltro('');
    if (nuevoOrigen === 'identidad') {
      cargarAuditoriaIdentidad();
    } else {
      setPagina(1);
      cargarAuditoriaTitulacion(1);
    }
  };

  const handleRefrescar = () => {
    if (origen === 'identidad') {
      cargarAuditoriaIdentidad();
    } else {
      cargarAuditoriaTitulacion(pagina);
    }
  };

  const handleAplicarFiltrosTitulacion = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    cargarAuditoriaTitulacion(1);
  };

  const handleCambiarPagina = (nuevaPagina: number) => {
    setPagina(nuevaPagina);
    cargarAuditoriaTitulacion(nuevaPagina);
  };

  if (usuarioSesion && !ROLES_AUDITORIA_GLOBAL.includes(usuarioSesion.rol)) {
    return (
      <div className="space-y-6 pb-12 w-full">
        <nav className="flex items-center text-sm text-gray-500">
          <button
            type="button"
            className="hidden lg:flex p-1.5 mr-3 rounded-md text-gray-500 hover:bg-gray-200 transition-colors"
            title={sidebarAbierto ? 'Ocultar menú' : 'Mostrar menú'}
            onClick={toggleSidebar}
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
            Inicio
          </Link>
          <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
          <span className="font-medium text-gray-800">Auditoría Global</span>
        </nav>

        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-10 text-center max-w-lg mx-auto my-12 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-rose-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">
            Acceso Restringido por Matriz RBAC
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            El módulo de <b>Auditoría Global Inmutable</b> está reservado
            exclusivamente para los roles de <b>ADMIN</b>, <b>DECANO</b> y{' '}
            <b>SECRETARIA_ACADEMICA</b>.
          </p>
        </div>
      </div>
    );
  }

  const esAdmin = usuarioSesion?.rol === 'ADMIN';

  const accionesUnicas = Array.from(new Set(eventos.map((e) => e.accion)));
  const operadoresUnicos = Array.from(
    new Set(eventos.map((e) => e.inicialesUsuario)),
  );

  const eventosFiltrados = eventos.filter((ev) => {
    if (accionFiltro && ev.accion !== accionFiltro) return false;
    if (operadorFiltro && ev.inicialesUsuario !== operadorFiltro) return false;
    if (!busqueda.trim()) return true;

    const q = busqueda.toLowerCase();
    const jsonStr = JSON.stringify(ev.detalle ?? {}).toLowerCase();
    return (
      ev.accion.toLowerCase().includes(q) ||
      ev.entidad.toLowerCase().includes(q) ||
      ev.inicialesUsuario.toLowerCase().includes(q) ||
      (ev.usuario?.nombresCompletos?.toLowerCase().includes(q) ?? false) ||
      jsonStr.includes(q)
    );
  });

  const totalRechazosFirma = eventos.filter(
    (e) => e.accion === 'RECHAZO_VALIDACION_FIRMA_PDF',
  ).length;
  const totalDse = eventos.filter((e) => e.accion === 'DEJAR_SIN_EFECTO').length;
  const totalFirmasValidas = eventos.filter(
    (e) => e.accion === 'VALIDACION_FIRMA_PDF',
  ).length;

  const badgeColorPorAccion = (accion: string) => {
    if (accion.includes('RECHAZO') || accion.includes('DEJAR_SIN_EFECTO')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (accion.includes('VALIDACION_FIRMA') || accion.includes('CREAR')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (
      accion.includes('CAMBIO') ||
      accion.includes('REGENERAR') ||
      accion.includes('ACTUALIZAR')
    ) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-blue-50 text-[#1E73BE] border-blue-200';
  };

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* 1. Header con Breadcrumbs y Toggle de Sidebar */}
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

          <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
            Inicio
          </Link>
          <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
          <span className="font-medium text-gray-800">Auditoría Global</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Auditoría Global Inmutable
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Bitácora forense append-only de gestión institucional, emisiones,
              firmas PKCS#7, rechazos de archivos corruptos y DSE.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {esAdmin && (
              <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 text-xs shadow-xs">
                <button
                  type="button"
                  onClick={() => cambiarOrigen('identidad')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    origen === 'identidad'
                      ? 'bg-[#1E73BE] text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Identidad y Accesos
                </button>
                <button
                  type="button"
                  onClick={() => cambiarOrigen('titulacion')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    origen === 'titulacion'
                      ? 'bg-[#1E73BE] text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Titulación (Paginado)
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleRefrescar}
              disabled={cargando}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs transition-colors disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`}
              />
              <span>Refrescar Bitácora</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPIs Forenses */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {metaPaginacion
                ? 'Total Eventos (Consulta)'
                : 'Eventos Recientes Cargados'}
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {metaPaginacion ? metaPaginacion.total : eventos.length}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-[#1E73BE]" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Firmas PKCS#7 Validadas
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {totalFirmasValidas}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Rechazos Forenses / DSE
            </p>
            <p className="text-xl font-bold text-rose-600 mt-1">
              {totalRechazosFirma} rechazos · {totalDse} DSE
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
        </div>
      </div>

      {/* 3. Barra de Filtros */}
      {origen === 'identidad' ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en el payload JSON, entidad, acción u operador..."
              className="w-full rounded-xl border border-gray-300 pl-10 pr-3 py-2.5 text-xs focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
            />
          </div>

          <div className="md:col-span-4">
            <select
              value={accionFiltro}
              onChange={(e) => setAccionFiltro(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs bg-white focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
            >
              <option value="">Todas las Acciones ({accionesUnicas.length})</option>
              {accionesUnicas.map((acc) => (
                <option key={acc} value={acc}>
                  {acc}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={operadorFiltro}
              onChange={(e) => setOperadorFiltro(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs bg-white font-mono focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
            >
              <option value="">Operador: Todos</option>
              {operadoresUnicos.map((op) => (
                <option key={op} value={op}>
                  /{op}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleAplicarFiltrosTitulacion}
          className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
        >
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Entidad
            </label>
            <input
              type="text"
              value={entidadServidor}
              onChange={(e) => setEntidadServidor(e.target.value)}
              placeholder="Ej. resoluciones, libros"
              maxLength={60}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Acción
            </label>
            <input
              type="text"
              value={accionServidor}
              onChange={(e) => setAccionServidor(e.target.value)}
              placeholder="Ej. EMITIR_RESOLUCION"
              maxLength={50}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-xl bg-[#1E73BE] text-white px-3 py-2.5 text-xs font-semibold hover:bg-[#155A9C] shadow-sm transition-colors disabled:opacity-60"
            >
              Consultar
            </button>
          </div>
        </form>
      )}

      {/* 4. Tabla de Eventos de Auditoría */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                <th className="py-3.5 px-4">Fecha y Hora</th>
                <th className="py-3.5 px-4">Operador</th>
                <th className="py-3.5 px-4">Acción Ejecutada</th>
                <th className="py-3.5 px-4">Entidad</th>
                <th className="py-3.5 px-4">Resumen de Datos (JSONB)</th>
                <th className="py-3.5 px-4 text-right">Inspección</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {eventosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-gray-400 italic"
                  >
                    {cargando
                      ? 'Cargando bitácora de auditoría...'
                      : 'No se encontraron registros con los filtros aplicados.'}
                  </td>
                </tr>
              ) : (
                eventosFiltrados.map((ev) => (
                  <tr
                    key={ev.id}
                    className="hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                      {new Date(ev.fechaHora).toLocaleString('es-PE')}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-block w-fit px-2 py-0.5 rounded-md bg-gray-100 font-mono font-semibold text-[#1E73BE]">
                          /{ev.inicialesUsuario}
                        </span>
                        {ev.usuario?.nombresCompletos && (
                          <span className="text-[11px] text-gray-500 truncate max-w-[180px]">
                            {ev.usuario.nombresCompletos}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold font-mono ${badgeColorPorAccion(
                          ev.accion,
                        )}`}
                      >
                        {ev.accion}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600">
                      {ev.entidad}
                    </td>
                    <td className="py-3.5 px-4 max-w-md truncate font-mono text-[11px] text-gray-600">
                      {JSON.stringify(ev.detalle ?? {})}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setEventoSeleccionado(ev)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1E73BE] text-white text-[11px] font-semibold hover:bg-[#155A9C] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver JSON</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación para Titulación */}
        {metaPaginacion && metaPaginacion.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-600 bg-gray-50/50">
            <span>
              Página <b>{metaPaginacion.page}</b> de{' '}
              <b>{metaPaginacion.totalPages}</b> ({metaPaginacion.total} registros)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagina <= 1 || cargando}
                onClick={() => handleCambiarPagina(pagina - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                disabled={pagina >= metaPaginacion.totalPages || cargando}
                onClick={() => handleCambiarPagina(pagina + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Modal Forense para Inspeccionar el Snapshot JSONB */}
      {eventoSeleccionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FileCode2 className="w-5 h-5 text-[#1E73BE]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Evidencia de Auditoría — ID #{eventoSeleccionado.id}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Acción: {eventoSeleccionado.accion} · Operador: /
                    {eventoSeleccionado.inicialesUsuario}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEventoSeleccionado(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Fecha y Hora Exacta
                  </span>
                  <span className="font-mono font-semibold text-gray-800">
                    {new Date(eventoSeleccionado.fechaHora).toLocaleString('es-PE')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Entidad Afectada
                  </span>
                  <span className="font-mono font-semibold text-gray-800">
                    {eventoSeleccionado.entidad}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Operador Responsable
                  </span>
                  <span className="font-mono font-semibold text-[#1E73BE]">
                    /{eventoSeleccionado.inicialesUsuario}
                  </span>
                  {eventoSeleccionado.usuario && (
                    <span className="block text-[10px] text-gray-500 mt-0.5">
                      {eventoSeleccionado.usuario.nombresCompletos} (
                      {eventoSeleccionado.usuario.rol})
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase text-gray-500 block mb-1.5">
                  Payload Estructurado (Columna JSONB en PostgreSQL)
                </span>
                <pre className="bg-slate-900 text-emerald-300 p-4 rounded-xl overflow-x-auto font-mono text-[11px] leading-relaxed max-h-80">
                  {JSON.stringify(eventoSeleccionado.detalle ?? {}, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEventoSeleccionado(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#1E73BE] text-white font-semibold hover:bg-[#155A9C] transition-colors"
                >
                  Cerrar Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
