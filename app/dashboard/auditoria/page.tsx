// Archivo: app/dashboard/auditoria/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch,
  ApiError,
  obtenerUsuarioSesion,
  UsuarioSesion,
} from '@/lib/api';

interface EventoAuditoria {
  id: string | number;
  usuarioId: string;
  inicialesUsuario: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  expedienteId?: string | null;
  resolucionId?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detalle: Record<string, any>;
  fechaHora: string;
  usuario?: {
    nombresCompletos: string;
    rol: string;
  };
}

export default function AuditoriaGlobalPage() {
  const [usuarioSesion, setUsuarioSesion] = useState<UsuarioSesion | null>(null);
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros en cliente y servidor
  const [busqueda, setBusqueda] = useState('');
  const [accionFiltro, setAccionFiltro] = useState('');
  const [operadorFiltro, setOperadorFiltro] = useState('');

  // Modal de Inspección Forense JSONB
  const [eventoSeleccionado, setEventoSeleccionado] =
    useState<EventoAuditoria | null>(null);

  const cargarAuditoria = async () => {
    setCargando(true);
    try {
      const data = await apiFetch<EventoAuditoria[]>('/auditoria', {
        servicio: 'identidad',
      });
      setEventos(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargando(false);
    }
  };

     useEffect(() => {
    const sesion = obtenerUsuarioSesion();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsuarioSesion(sesion);
    if (sesion && (sesion.rol === 'DECANO' || sesion.rol === 'SECRETARIA_ACADEMICA')) {
      cargarAuditoria();
    } else {
      setCargando(false);
    }
  }, []);

  if (
    usuarioSesion &&
    usuarioSesion.rol !== 'DECANO' &&
    usuarioSesion.rol !== 'SECRETARIA_ACADEMICA'
  ) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-10 text-center max-w-lg mx-auto my-12 space-y-3">
        <Lock className="w-10 h-10 text-rose-600 mx-auto" />
        <h2 className="text-base font-bold text-gray-900">
          Acceso Restringido por Matriz RBAC
        </h2>
        <p className="text-xs text-gray-600">
          El módulo de <b>Auditoría Global Inmutable</b> está reservado exclusivamente para los roles de <b>DECANO</b> y <b>SECRETARIA_ACADEMICA</b>. Como personal Administrativo puede consultar sus propias operaciones en el módulo <b>Mi Actividad</b>.
        </p>
      </div>
    );
  }

  const accionesUnicas = Array.from(new Set(eventos.map((e) => e.accion)));
  const operadoresUnicos = Array.from(
    new Set(eventos.map((e) => e.inicialesUsuario)),
  );

  const eventosFiltrados = eventos.filter((ev) => {
    if (accionFiltro && ev.accion !== accionFiltro) return false;
    if (operadorFiltro && ev.inicialesUsuario !== operadorFiltro) return false;
    if (!busqueda.trim()) return true;

    const q = busqueda.toLowerCase();
    const jsonStr = JSON.stringify(ev.detalle || {}).toLowerCase();
    return (
      ev.accion.toLowerCase().includes(q) ||
      ev.entidad.toLowerCase().includes(q) ||
      ev.inicialesUsuario.toLowerCase().includes(q) ||
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
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    if (accion.includes('VALIDACION_FIRMA') || accion.includes('CREAR')) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (accion.includes('CAMBIO') || accion.includes('REGENERAR')) {
      return 'bg-amber-100 text-amber-900 border-amber-200';
    }
    return 'bg-blue-50 text-[#0B2B5A] border-blue-200';
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Registro de Auditoría Global Inmutable (Append-Only)
          </h2>
          <p className="text-xs text-gray-500">
            Trazabilidad forense de emisiones, firmas PKCS#7, rechazos de archivos corruptos, cambios de grado y DSE
          </p>
        </div>

        <button
          type="button"
          onClick={cargarAuditoria}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          <span>Refrescar Bitácora</span>
        </button>
      </div>

      {/* KPIs Forenses */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-gray-500">
              Total Eventos Auditados
            </p>
            <p className="text-2xl font-extrabold text-[#0B2B5A] mt-1">
              {eventos.length}
            </p>
          </div>
          <ShieldAlert className="w-7 h-7 text-[#0B2B5A] opacity-80" />
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-emerald-700">
              Firmas PKCS#7 Validadas
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">
              {totalFirmasValidas}
            </p>
          </div>
          <CheckCircle2 className="w-7 h-7 text-emerald-600 opacity-80" />
        </div>

        <div className="bg-white rounded-xl border border-rose-200 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase text-rose-700">
              Rechazos Forenses PDF / DSE
            </p>
            <p className="text-2xl font-extrabold text-rose-600 mt-1">
              {totalRechazosFirma} rechazos | {totalDse} DSE
            </p>
          </div>
          <AlertTriangle className="w-7 h-7 text-rose-600 opacity-80" />
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en el payload JSON (ej. 0001-2026, SHA-256, SIN_FIRMA_DIGITAL, nombre de docente)..."
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-xs"
          />
        </div>

        <div className="md:col-span-4">
          <select
            value={accionFiltro}
            onChange={(e) => setAccionFiltro(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs bg-white"
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs bg-white font-mono"
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

      {/* Tabla de Eventos de Auditoría */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase text-gray-500">
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Operador</th>
                <th className="py-3 px-4">Acción Ejecutada</th>
                <th className="py-3 px-4">Entidad</th>
                <th className="py-3 px-4">Resumen de Datos (JSONB)</th>
                <th className="py-3 px-4 text-right">Inspección</th>
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
                  <tr key={String(ev.id)} className="hover:bg-gray-50/80">
                    <td className="py-3 px-4 font-mono text-[11px] text-gray-600 whitespace-nowrap">
                      {new Date(ev.fechaHora).toLocaleString('es-PE')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-gray-100 font-mono font-bold text-[#0B2B5A]">
                        /{ev.inicialesUsuario}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold font-mono ${badgeColorPorAccion(
                          ev.accion,
                        )}`}
                      >
                        {ev.accion}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-gray-600">
                      {ev.entidad}
                    </td>
                    <td className="py-3 px-4 max-w-md truncate font-mono text-[11px] text-gray-600">
                      {JSON.stringify(ev.detalle)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setEventoSeleccionado(ev)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B2B5A] text-white text-[11px] font-semibold hover:bg-[#082044]"
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
      </div>

      {/* Modal Forense para Inspeccionar el Snapshot JSONB */}
      {eventoSeleccionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="bg-[#0B2B5A] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="text-sm font-bold">
                    Evidencia Inmutable de Auditoría — ID #{String(eventoSeleccionado.id)}
                  </h3>
                  <p className="text-[11px] text-blue-200">
                    Acción: {eventoSeleccionado.accion} | Operador: /{eventoSeleccionado.inicialesUsuario}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEventoSeleccionado(null)}
                className="text-blue-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Fecha y Hora Exacta:
                  </span>
                  <span className="font-mono font-bold text-gray-800">
                    {new Date(eventoSeleccionado.fechaHora).toLocaleString('es-PE')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Entidad Afectada:
                  </span>
                  <span className="font-mono font-bold text-gray-800">
                    {eventoSeleccionado.entidad}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Operador Responsable:
                  </span>
                  <span className="font-mono font-bold text-[#0B2B5A]">
                    /{eventoSeleccionado.inicialesUsuario}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase text-gray-600 block mb-1.5">
                  Payload Estructurado (Columna JSONB en PostgreSQL):
                </span>
                <pre className="bg-slate-900 text-emerald-300 p-4 rounded-xl overflow-x-auto font-mono text-[11px] leading-relaxed max-h-80">
                  {JSON.stringify(eventoSeleccionado.detalle, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setEventoSeleccionado(null)}
                  className="px-4 py-2 rounded-lg bg-[#0B2B5A] text-white font-semibold"
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