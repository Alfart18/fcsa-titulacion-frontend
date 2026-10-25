// Archivo: app/dashboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderCheck,
  FolderClock,
  FolderX,
  FileWarning,
  Plus,
  Search,
  ArrowRight,
  FileSignature,
  BookOpen,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { apiFetch, obtenerUsuarioSesion, UsuarioSesion } from '@/lib/api';

interface TesistaResumen {
  id: string;
  orden: number;
  nombresApellidos: string;
  codigoEstudiante: string;
  estado: 'ACTIVO' | 'APTO' | 'DESISTIDO' | 'TITULADO';
}

interface ExpedienteResumen {
  id: string;
  codigoExpediente: string;
  estado: 'ACTIVO' | 'TITULADO' | 'ANULADO';
  tituloActual: string | null;
  actualizadoEn: string;
  escuelaProfesional: {
    id: number;
    nombre: string;
    tituloProfesional: string;
  };
  tesistas: TesistaResumen[];
}

interface ResolucionPendiente {
  id: string;
  numeroCompleto: string;
  serie: 'ORD' | 'CF';
  tipo: string;
  idTramiteControl: string;
  versionPdf: number;
  expediente: {
    codigoExpediente: string;
  };
}

interface AsientoNumeracion {
  id: string;
  numeroCompleto: string;
  serie: 'ORD' | 'CF';
  categoria: 'TITULACION' | 'ADMINISTRATIVO';
  descripcion: string;
  fechaDocumento: string;
  registradoPor: {
    iniciales: string;
  };
}

export default function DashboardHomePage() {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [expedientes, setExpedientes] = useState<ExpedienteResumen[]>([]);
  const [pendientesFirma, setPendientesFirma] = useState<ResolucionPendiente[]>([]);
  const [ultimosNumeros, setUltimosNumeros] = useState<AsientoNumeracion[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargarDatosDashboard = async () => {
    setCargando(true);
    try {
      const [listaExp, listaPendientes, listaNumeracion] = await Promise.all([
        apiFetch<ExpedienteResumen[]>('/expedientes', { servicio: 'titulacion' }),
        apiFetch<ResolucionPendiente[]>('/firmas/pendientes', { servicio: 'firmas' }),
        apiFetch<AsientoNumeracion[]>('/numeracion', { servicio: 'titulacion' }),
      ]);

      setExpedientes(listaExp);
      setPendientesFirma(listaPendientes);
      setUltimosNumeros(listaNumeracion.slice(0, 6));
    } catch {
      // Manejado silenciosamente si algún microservicio está reiniciando
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsuario(obtenerUsuarioSesion());
    cargarDatosDashboard();
  }, []);

  // Cálculos en vivo para las 4 Tarjetas de Resumen
  const totalActivos = expedientes.filter((e) => e.estado === 'ACTIVO').length;
  const totalTitulados = expedientes.filter((e) => e.estado === 'TITULADO').length;
  const totalAnulados = expedientes.filter((e) => e.estado === 'ANULADO').length;
  const totalPendientesFirma = pendientesFirma.length;

  // Filtro en vivo del buscador rápido
  const expedientesFiltrados = expedientes
    .filter((exp) => {
      if (!busqueda.trim()) return true;
      const q = busqueda.toLowerCase();
      const coincideCodigo = exp.codigoExpediente.toLowerCase().includes(q);
      const coincideTitulo = (exp.tituloActual || '').toLowerCase().includes(q);
      const coincideEscuela = exp.escuelaProfesional.nombre.toLowerCase().includes(q);
      const coincideTesista = exp.tesistas.some(
        (t) =>
          t.nombresApellidos.toLowerCase().includes(q) ||
          t.codigoEstudiante.toLowerCase().includes(q),
      );
      return coincideCodigo || coincideTitulo || coincideEscuela || coincideTesista;
    })
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Cabecera de Acciones Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Resumen Operativo de Titulación
          </h2>
          <p className="text-xs text-gray-500">
            Estado consolidado de expedientes, numeración correlativa y firmas digitales
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={cargarDatosDashboard}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <Link
            href="/dashboard/firmas"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#0B2B5A] bg-white px-3.5 py-2 text-xs font-semibold text-[#0B2B5A] hover:bg-blue-50 transition"
          >
            <FileSignature className="w-4 h-4" />
            <span>Validar PDFs Firmados ({totalPendientesFirma})</span>
          </Link>

          <Link
            href="/dashboard/expedientes"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2B5A] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#082044] transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Expediente</span>
          </Link>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4 TARJETAS DE RESUMEN (KPIs DEL SISTEMA)                            */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tarjeta 1: Expedientes en Curso (ACTIVO) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Expedientes en Curso
            </p>
            <p className="text-3xl font-extrabold text-gray-900 mt-2">
              {totalActivos}
            </p>
            <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
              Estado: ACTIVO
            </span>
          </div>
          <div className="p-3 rounded-xl bg-blue-50 text-[#0B2B5A]">
            <FolderClock className="w-6 h-6" />
          </div>
        </div>

        {/* Tarjeta 2: Resoluciones Pendientes de Firma (EMITIDO) */}
        <div className="bg-white rounded-xl border border-amber-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Pendientes de Firma
            </p>
            <p className="text-3xl font-extrabold text-amber-600 mt-2">
              {totalPendientesFirma}
            </p>
            <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800">
              Candado Activo: EMITIDO
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <FileWarning className="w-6 h-6" />
          </div>
        </div>

        {/* Tarjeta 3: Expedientes Concluidos (TITULADO) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Expedientes Titulados
            </p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">
              {totalTitulados}
            </p>
            <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
              Estado: TITULADO (7/7 Pasos)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <FolderCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Tarjeta 4: Expedientes Anulados por DSE Integral (ANULADO) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Expedientes Anulados
            </p>
            <p className="text-3xl font-extrabold text-rose-600 mt-2">
              {totalAnulados}
            </p>
            <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700">
              Estado: ANULADO (DSE)
            </span>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
            <FolderX className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* GRILLA PRINCIPAL: EXPEDIENTES RECIENTES + LIBRO DE NUMERACIÓN       */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda (2/3): Buscador Global y Expedientes Recientes */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Expedientes de Titulación Recientes
              </h3>
              <p className="text-xs text-gray-500">
                Búsqueda instantánea por código, tesista, escuela o título de tesis
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar expediente o tesista..."
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-[#0B2B5A] focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-bold uppercase text-gray-500">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Escuela Profesional</th>
                  <th className="py-3 px-4">Tesista(s)</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expedientesFiltrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-gray-400 italic"
                    >
                      No se encontraron expedientes registrados.
                    </td>
                  </tr>
                ) : (
                  expedientesFiltrados.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-[#0B2B5A]">
                        {exp.codigoExpediente}
                      </td>
                      <td className="py-3 px-4 text-gray-700 font-medium">
                        {exp.escuelaProfesional.nombre.replace(
                          'Escuela Profesional de ',
                          '',
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {exp.tesistas.map((t) => (
                            <div
                              key={t.id}
                              className="text-gray-800 font-medium flex items-center gap-1.5"
                            >
                              <span>{t.nombresApellidos}</span>
                              <span className="text-[10px] font-mono text-gray-400">
                                ({t.codigoEstudiante})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            exp.estado === 'ACTIVO'
                              ? 'bg-blue-50 text-blue-700'
                              : exp.estado === 'TITULADO'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {exp.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/dashboard/expedientes/${exp.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B2B5A] hover:underline"
                        >
                          <span>Abrir Ficha</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center text-xs">
            <span className="text-gray-500">
              Mostrando {expedientesFiltrados.length} de {expedientes.length} expedientes
            </span>
            <Link
              href="/dashboard/expedientes"
              className="font-semibold text-[#0B2B5A] hover:underline"
            >
              Ver todos los expedientes →
            </Link>
          </div>
        </div>

        {/* Columna Derecha (1/3): Últimos Números Emitidos + Tarjeta RBAC */}
        <div className="space-y-6">
          {/* Últimos correlativos del Libro de Numeración */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0B2B5A]" />
                <h3 className="text-sm font-bold text-gray-900">
                  Últimos Correlativos (ORD / CF)
                </h3>
              </div>
              <Link
                href="/dashboard/numeracion"
                className="text-xs font-semibold text-[#0B2B5A] hover:underline"
              >
                Ver Libro
              </Link>
            </div>

            <div className="space-y-3">
              {ultimosNumeros.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">
                  Aún no hay resoluciones numeradas.
                </p>
              ) : (
                ultimosNumeros.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-gray-900">
                        {item.numeroCompleto}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          item.serie === 'CF'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.serie}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1">
                      {item.descripcion}
                    </p>
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                      <span>{item.fechaDocumento.slice(0, 10)}</span>
                      <span>Op: /{item.registradoPor?.iniciales || 'SIST'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tarjeta Contextual de Permisos según el Rol en Sesión */}
          {usuario && (
            <div className="bg-[#0B2B5A] text-white rounded-xl p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-300" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Nivel de Acceso Activo: {usuario.rol}
                </h3>
              </div>
              <p className="text-xs text-blue-100 leading-relaxed">
                {usuario.rol === 'DECANO' &&
                  'Autoridad máxima: Tienes habilitada la gestión de cuentas de usuario, la designación del Decano Firmante activo y la Auditoría Global inmutable.'}
                {usuario.rol === 'SECRETARIA_ACADEMICA' &&
                  'Supervisión operativa: Tienes habilitada la emisión de resoluciones, el mantenimiento de catálogos (Docentes y Causas) y la consulta de la Auditoría Global.'}
                {usuario.rol === 'ADMINISTRATIVO' &&
                  'Rol operativo: Tienes habilitada la creación de expedientes, emisión de los 7 pasos, carga de lotes firmados y consulta de tu propio historial de actividad.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}