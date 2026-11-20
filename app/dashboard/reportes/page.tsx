// Archivo: app/dashboard/reportes/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  FolderKanban,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  RefreshCw,
  ChevronRight,
  PanelLeft,
  ShieldAlert,
  Building2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch,
  ApiError,
  obtenerUsuarioSesion,
  UsuarioSesion,
} from '@/lib/api';
import { useSidebar } from '../sidebar-context';

type EstadoExpediente = 'EN_PROCESO' | 'FINALIZADO' | 'ANULADO';

interface ResumenDashboardResponse {
  totalExpedientes: number;
  expedientesEnProceso: number;
  expedientesFinalizados: number;
  expedientesAnulados: number;
  totalTitulosEmitidos: number;
}

interface ExpedientesPorEstadoItem {
  estado: EstadoExpediente;
  total: number;
}

interface ExpedientesPorEscuelaItem {
  escuelaProfesionalId: number;
  nombreEscuela: string;
  siglasDocumento: string;
  totalExpedientes: number;
}

interface ResolucionesPorMesItem {
  mes: number;
  nombreMes: string;
  anio: number;
  totalResoluciones: number;
}

interface TitulosPorEscuelaItem {
  escuelaProfesionalId: number;
  nombreEscuela: string;
  siglasDocumento: string;
  anio: number;
  totalTitulos: number;
}

const ETIQUETA_ESTADO: Record<
  EstadoExpediente,
  { label: string; bar: string; badge: string }
> = {
  EN_PROCESO: {
    label: 'En Proceso',
    bar: 'bg-[#1E73BE]',
    badge: 'bg-blue-100 text-blue-800',
  },
  FINALIZADO: {
    label: 'Finalizados',
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  ANULADO: {
    label: 'Anulados',
    bar: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-800',
  },
};

export default function ReportesEstadisticasPage() {
  const { sidebarAbierto, toggleSidebar } = useSidebar();
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [sesionCargada, setSesionCargada] = useState(false);

  const [resumen, setResumen] = useState<ResumenDashboardResponse | null>(null);
  const [porEstado, setPorEstado] = useState<ExpedientesPorEstadoItem[]>([]);
  const [porEscuela, setPorEscuela] = useState<ExpedientesPorEscuelaItem[]>([]);
  const [resolucionesMes, setResolucionesMes] = useState<
    ResolucionesPorMesItem[]
  >([]);
  const [titulosEscuela, setTitulosEscuela] = useState<TitulosPorEscuelaItem[]>(
    [],
  );
  const [cargando, setCargando] = useState(true);

  const tieneAcceso =
    usuario?.rol === 'ADMIN' || usuario?.rol === 'DECANO';

  const cargarReportes = async () => {
    setCargando(true);
    try {
      const [
        resumenData,
        estadoData,
        escuelaData,
        mesData,
        titulosData,
      ] = await Promise.all([
        apiFetch<ResumenDashboardResponse>('/reportes/resumen', {
          servicio: 'titulacion',
        }),
        apiFetch<ExpedientesPorEstadoItem[]>('/reportes/expedientes-por-estado', {
          servicio: 'titulacion',
        }),
        apiFetch<ExpedientesPorEscuelaItem[]>(
          '/reportes/expedientes-por-escuela',
          { servicio: 'titulacion' },
        ),
        apiFetch<ResolucionesPorMesItem[]>('/reportes/resoluciones-por-mes', {
          servicio: 'titulacion',
        }),
        apiFetch<TitulosPorEscuelaItem[]>('/reportes/titulos-por-escuela', {
          servicio: 'titulacion',
        }),
      ]);

      setResumen(resumenData);
      setPorEstado(estadoData);
      setPorEscuela(escuelaData);
      setResolucionesMes(mesData);
      setTitulosEscuela(titulosData);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudieron cargar los reportes estadísticos.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const sesion = obtenerUsuarioSesion();
      setUsuario(sesion);
      setSesionCargada(true);
      if (sesion?.rol === 'ADMIN' || sesion?.rol === 'DECANO') {
        void cargarReportes();
      } else {
        setCargando(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const maxExpedientesEscuela = Math.max(
    1,
    ...porEscuela.map((e) => e.totalExpedientes),
  );
  const maxResolucionesMes = Math.max(
    1,
    ...resolucionesMes.map((m) => m.totalResoluciones),
  );
  const totalResolucionesAnio = resolucionesMes.reduce(
    (acc, m) => acc + m.totalResoluciones,
    0,
  );
  const anioReportes =
    resolucionesMes[0]?.anio ??
    titulosEscuela[0]?.anio ??
    new Date().getFullYear();
  const maxTitulosEscuela = Math.max(
    1,
    ...titulosEscuela.map((t) => t.totalTitulos),
  );
  const totalTitulosAnio = titulosEscuela.reduce(
    (acc, t) => acc + t.totalTitulos,
    0,
  );
  const totalEstados = Math.max(
    1,
    porEstado.reduce((acc, item) => acc + item.total, 0),
  );

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
          <span className="font-medium text-gray-800">
            Reportes y Estadísticas
          </span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Reportes y Estadísticas de Titulación
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1 max-w-3xl">
              Indicadores ejecutivos de expedientes por estado, distribución por Escuela Profesional, emisión mensual de resoluciones y títulos otorgados.
            </p>
          </div>

          {tieneAcceso && (
            <button
              type="button"
              onClick={() => void cargarReportes()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${cargando ? 'animate-spin' : ''}`}
              />
              <span>Actualizar Indicadores</span>
            </button>
          )}
        </div>
      </div>

      {/* Control de Acceso (Backend @Roles(ADMIN, DECANO)) */}
      {sesionCargada && !tieneAcceso ? (
        <div className="bg-white rounded-2xl border border-amber-200 p-8 shadow-sm text-center max-w-xl mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">
            Acceso Restringido a Decanato y Administración
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            El módulo de Reportes y Estadísticas está reservado exclusivamente para los roles <b>DECANO</b> y <b>ADMIN</b> conforme a la política de gobierno del servicio de titulación.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E73BE] px-4 py-2 text-xs font-semibold text-white hover:bg-[#175B96] transition-colors"
          >
            Volver al Resumen General
          </Link>
        </div>
      ) : cargando && !resumen ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-xs text-gray-400 animate-pulse">
          Calculando indicadores y estadísticas del sistema...
        </div>
      ) : (
        <>
          {/* 1. Tarjetas KPI del Resumen General (GET /reportes/resumen) */}
          {resumen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase text-gray-500">
                    Total Expedientes
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FolderKanban className="w-4 h-4 text-[#1E73BE]" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-gray-900 font-mono">
                  {resumen.totalExpedientes}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Histórico acumulado FCSa
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase text-gray-500">
                    En Proceso
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-sky-600" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-[#1E73BE] font-mono">
                  {resumen.expedientesEnProceso}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Trámites activos en 7 pasos
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase text-gray-500">
                    Finalizados
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-emerald-700 font-mono">
                  {resumen.expedientesFinalizados}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Concluidos satisfactoriamente
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase text-gray-500">
                    Anulados
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
                    <XCircle className="w-4 h-4 text-rose-600" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-rose-700 font-mono">
                  {resumen.expedientesAnulados}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Dejados sin efecto / baja
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase text-gray-500">
                    Títulos Vigentes
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Award className="w-4 h-4 text-purple-600" />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-purple-700 font-mono">
                  {resumen.totalTitulosEmitidos}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Registrados en Libro de Títulos
                </p>
              </div>
            </div>
          )}

          {/* 2. Distribución por Estado + Expedientes por Escuela */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Expedientes por Estado */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-[#1E73BE]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Expedientes por Estado
                  </h2>
                  <p className="text-xs text-gray-500">
                    Distribución porcentual del universo de expedientes
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {porEstado.map((item) => {
                  const cfg = ETIQUETA_ESTADO[item.estado];
                  const porcentaje = Math.round(
                    (item.total / totalEstados) * 100,
                  );
                  return (
                    <div key={item.estado} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.badge}`}
                        >
                          {cfg.label}
                        </span>
                        <span className="font-mono font-bold text-gray-800">
                          {item.total}{' '}
                          <span className="text-gray-400 font-normal">
                            ({porcentaje}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                          style={{ width: `${porcentaje}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expedientes por Escuela Profesional */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Expedientes por Escuela Profesional
                  </h2>
                  <p className="text-xs text-gray-500">
                    Volumen total de trámites de titulación por unidad académica
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                {porEscuela.map((esc) => {
                  const ancho = Math.round(
                    (esc.totalExpedientes / maxExpedientesEscuela) * 100,
                  );
                  return (
                    <div
                      key={esc.escuelaProfesionalId}
                      className="space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#1E73BE] shrink-0">
                            {esc.siglasDocumento}
                          </span>
                          <span className="font-semibold text-gray-800 truncate">
                            {esc.nombreEscuela.replace(
                              'Escuela Profesional de ',
                              '',
                            )}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-gray-900 shrink-0">
                          {esc.totalExpedientes}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1E73BE] rounded-full transition-all duration-500"
                          style={{ width: `${ancho}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Resoluciones Emitidas por Mes (Gráfico de Barras Verticales) */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Resoluciones Emitidas por Mes — Año {anioReportes}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Producción documental mensual registrada en el sistema
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-50 text-[#1E73BE] text-xs font-bold font-mono">
                Total {anioReportes}: {totalResolucionesAnio} resoluciones
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-3 items-end pt-4">
              {resolucionesMes.map((m) => {
                const alturaPct =
                  m.totalResoluciones === 0
                    ? 4
                    : Math.max(
                        12,
                        Math.round(
                          (m.totalResoluciones / maxResolucionesMes) * 100,
                        ),
                      );
                return (
                  <div
                    key={m.mes}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span className="font-mono text-xs font-bold text-gray-800">
                      {m.totalResoluciones}
                    </span>
                    <div className="w-full h-36 bg-gray-50 border border-gray-100 rounded-xl flex items-end p-1.5">
                      <div
                        className={`w-full rounded-lg transition-all duration-500 ${
                          m.totalResoluciones > 0
                            ? 'bg-[#1E73BE]'
                            : 'bg-gray-200'
                        }`}
                        style={{ height: `${alturaPct}%` }}
                        title={`${m.nombreMes} ${m.anio}: ${m.totalResoluciones} resoluciones`}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-gray-600">
                      {m.nombreMes.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Títulos Emitidos por Escuela en el Año Actual */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <Award className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Títulos Profesionales por Escuela — Año {anioReportes}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Registros vigentes asentados en el Libro de Títulos durante {anioReportes}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold font-mono">
                Total {anioReportes}: {totalTitulosAnio} títulos
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="py-3.5 px-5">Escuela Profesional</th>
                    <th className="py-3.5 px-5">Siglas</th>
                    <th className="py-3.5 px-5 w-1/3">Proporción</th>
                    <th className="py-3.5 px-5 text-right">
                      Títulos ({anioReportes})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {titulosEscuela.map((t) => {
                    const ancho = Math.round(
                      (t.totalTitulos / maxTitulosEscuela) * 100,
                    );
                    return (
                      <tr
                        key={t.escuelaProfesionalId}
                        className="hover:bg-gray-50/80"
                      >
                        <td className="py-3.5 px-5 font-bold text-gray-900">
                          {t.nombreEscuela}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                            {t.siglasDocumento}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-600 rounded-full transition-all duration-500"
                              style={{ width: `${ancho}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono font-extrabold text-gray-900">
                          {t.totalTitulos}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
