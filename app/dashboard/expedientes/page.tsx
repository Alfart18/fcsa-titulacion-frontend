// Archivo: app/dashboard/expedientes/page.tsx
'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FolderPlus,
  Search,
  Filter,
  ArrowRight,
  Users,
  User,
  X,
  ShieldCheck,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';

interface EscuelaCatalogo {
  id: number;
  nombre: string;
  gradoBachiller: string;
  tituloProfesional: string;
  departamentoDefecto: {
    id: number;
    nombre: string;
  };
}

interface CatalogosAcademicosResponse {
  escuelas: EscuelaCatalogo[];
}

interface TesistaItem {
  id: string;
  orden: number;
  nombresApellidos: string;
  codigoEstudiante: string;
  estado: 'ACTIVO' | 'APTO' | 'DESISTIDO' | 'TITULADO';
}

interface ExpedienteItem {
  id: string;
  codigoExpediente: string;
  estado: 'ACTIVO' | 'TITULADO' | 'ANULADO';
  cantidadTesistas: number;
  tituloActual: string | null;
  creadoEn: string;
  actualizadoEn: string;
  escuelaProfesional: {
    id: number;
    nombre: string;
    gradoBachiller: string;
    tituloProfesional: string;
  };
  tesistas: TesistaItem[];
}

export default function ExpedientesListPage() {
  const router = useRouter();

  const [escuelas, setEscuelas] = useState<EscuelaCatalogo[]>([]);
  const [expedientes, setExpedientes] = useState<ExpedienteItem[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros de búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [escuelaFiltro, setEscuelaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  // Modal de Nuevo Expediente
  const [modalAbierto, setModalAbierto] = useState(false);
  const [escuelaSeleccionadaId, setEscuelaSeleccionadaId] = useState<number>(0);
  const [esColectivo, setEsColectivo] = useState(false);
  const [t1Nombre, setT1Nombre] = useState('');
  const [t1Codigo, setT1Codigo] = useState('');
  const [t2Nombre, setT2Nombre] = useState('');
  const [t2Codigo, setT2Codigo] = useState('');
  const [guardandoExp, setGuardandoExp] = useState(false);

  const cargarCatalogosYExpedientes = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set('q', busqueda.trim());
      if (escuelaFiltro) params.set('escuelaId', escuelaFiltro);
      if (estadoFiltro) params.set('estado', estadoFiltro);

      const [catData, expData] = await Promise.all([
        apiFetch<CatalogosAcademicosResponse>('/catalogos/academicos', {
          servicio: 'titulacion',
        }),
        apiFetch<ExpedienteItem[]>(
          `/expedientes${params.toString() ? `?${params.toString()}` : ''}`,
          { servicio: 'titulacion' },
        ),
      ]);

      setEscuelas(catData.escuelas);
      if (catData.escuelas.length > 0 && escuelaSeleccionadaId === 0) {
        setEscuelaSeleccionadaId(catData.escuelas[0].id);
      }
      setExpedientes(expData);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      }
    } finally {
      setCargando(false);
    }
  };

    useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarCatalogosYExpedientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escuelaFiltro, estadoFiltro]);

  const handleBuscarSubmit = (e: FormEvent) => {
    e.preventDefault();
    cargarCatalogosYExpedientes();
  };

  const escuelaSeleccionadaObj = escuelas.find(
    (e) => e.id === Number(escuelaSeleccionadaId),
  );

  const handleCrearExpediente = async (e: FormEvent) => {
    e.preventDefault();
    if (!escuelaSeleccionadaId) {
      toast.error('Seleccione una Escuela Profesional.');
      return;
    }
    if (!t1Nombre.trim() || !t1Codigo.trim()) {
      toast.error('Complete los nombres y el código del Tesista 1.');
      return;
    }
    if (esColectivo && (!t2Nombre.trim() || !t2Codigo.trim())) {
      toast.error('Complete los nombres y el código del Tesista 2.');
      return;
    }

    const tesistasPayload = [
      {
        nombresApellidos: t1Nombre.trim(),
        codigoEstudiante: t1Codigo.trim(),
      },
    ];

    if (esColectivo) {
      tesistasPayload.push({
        nombresApellidos: t2Nombre.trim(),
        codigoEstudiante: t2Codigo.trim(),
      });
    }

    setGuardandoExp(true);
    try {
      const nuevoExp = await apiFetch<ExpedienteItem>('/expedientes', {
        servicio: 'titulacion',
        method: 'POST',
        body: JSON.stringify({
          escuelaProfesionalId: Number(escuelaSeleccionadaId),
          tesistas: tesistasPayload,
        }),
      });

      toast.success(`Expediente ${nuevoExp.codigoExpediente} creado con éxito.`);
      setModalAbierto(false);
      setT1Nombre('');
      setT1Codigo('');
      setT2Nombre('');
      setT2Codigo('');
      setEsColectivo(false);

      router.push(`/dashboard/expedientes/${nuevoExp.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Error al crear el expediente.');
      }
    } finally {
      setGuardandoExp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Gestión de Expedientes de Titulación
          </h2>
          <p className="text-xs text-gray-500">
            Control secuencial de los 7 pasos, resoluciones complementarias y trazabilidad por tesista
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalAbierto(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0B2B5A] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#082044] transition"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Aperturar Nuevo Expediente</span>
        </button>
      </div>

      {/* Barra de Filtros Multicriterio */}
      <form
        onSubmit={handleBuscarSubmit}
        className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
      >
        <div className="md:col-span-5">
          <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
            Búsqueda por Código, Tesista, Título o N.° Resolución
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej. EXP-2026-0001, Cahuascanco, 019100..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-xs text-gray-900 focus:border-[#0B2B5A] focus:outline-none"
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
            Escuela Profesional
          </label>
          <select
            value={escuelaFiltro}
            onChange={(e) => setEscuelaFiltro(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 bg-white focus:border-[#0B2B5A] focus:outline-none"
          >
            <option value="">Todas las Escuelas (6)</option>
            {escuelas.map((esc) => (
              <option key={esc.id} value={esc.id}>
                {esc.nombre.replace('Escuela Profesional de ', '')}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
            Estado Expediente
          </label>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 bg-white focus:border-[#0B2B5A] focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="ACTIVO">ACTIVO</option>
            <option value="TITULADO">TITULADO</option>
            <option value="ANULADO">ANULADO</option>
          </select>
        </div>

        <div className="md:col-span-2 flex gap-2">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0B2B5A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#082044] transition"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setBusqueda('');
              setEscuelaFiltro('');
              setEstadoFiltro('');
              setTimeout(cargarCatalogosYExpedientes, 50);
            }}
            title="Refrescar"
            className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </form>

      {/* Tabla de Expedientes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                <th className="py-3.5 px-4">Código</th>
                <th className="py-3.5 px-4">Escuela / Título a Obtener</th>
                <th className="py-3.5 px-4">Tesista(s) e Estado Individual</th>
                <th className="py-3.5 px-4">Título de Tesis Vigente</th>
                <th className="py-3.5 px-4">Estado General</th>
                <th className="py-3.5 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expedientes.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-gray-400 italic"
                  >
                    {cargando
                      ? 'Cargando expedientes...'
                      : 'No se encontraron expedientes con los criterios seleccionados.'}
                  </td>
                </tr>
              ) : (
                expedientes.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50/80 transition">
                    <td className="py-3.5 px-4 align-top">
                      <span className="font-mono font-bold text-[#0B2B5A] text-xs block">
                        {exp.codigoExpediente}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {exp.cantidadTesistas === 2 ? 'Colectivo (2)' : 'Individual (1)'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <p className="font-bold text-gray-900">
                        {exp.escuelaProfesional.nombre.replace(
                          'Escuela Profesional de ',
                          '',
                        )}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {exp.escuelaProfesional.tituloProfesional}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 align-top space-y-1.5">
                      {exp.tesistas.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded"
                        >
                          <div>
                            <span className="font-semibold text-gray-800">
                              {t.nombresApellidos}
                            </span>
                            <span className="font-mono text-[10px] text-gray-500 ml-1.5">
                              ({t.codigoEstudiante})
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              t.estado === 'TITULADO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.estado === 'APTO'
                                  ? 'bg-purple-100 text-purple-800'
                                  : t.estado === 'DESISTIDO'
                                    ? 'bg-rose-100 text-rose-800 line-through'
                                    : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {t.estado}
                          </span>
                        </div>
                      ))}
                    </td>

                    <td className="py-3.5 px-4 align-top max-w-xs">
                      {exp.tituloActual ? (
                        <p className="text-gray-800 font-medium line-clamp-2">
                          {exp.tituloActual}
                        </p>
                      ) : (
                        <span className="text-gray-400 italic">
                          Pendiente de Paso 2 (Dictamen de Proyecto)
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          exp.estado === 'ACTIVO'
                            ? 'bg-blue-100 text-blue-800'
                            : exp.estado === 'TITULADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {exp.estado}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 align-top text-right">
                      <Link
                        href={`/dashboard/expedientes/${exp.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2B5A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#082044] transition"
                      >
                        <span>Gestionar 7 Pasos</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL DE APERTURA DE NUEVO EXPEDIENTE (CON BLINDAJE DE GRADO/TÍTULO)*/}
      {/* =================================================================== */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="bg-[#0B2B5A] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  Aperturar Nuevo Expediente de Titulación
                </h3>
                <p className="text-[11px] text-blue-200">
                  El código correlativo anual (EXP-2026-NNNN) se asigna con bloqueo atómico
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-blue-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCrearExpediente} className="p-6 space-y-4 text-xs">
              {/* Selección de Escuela Profesional */}
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1.5">
                  1. Seleccionar Escuela Profesional
                </label>
                <select
                  value={escuelaSeleccionadaId}
                  onChange={(e) => setEscuelaSeleccionadaId(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-xs font-semibold text-gray-900 bg-white focus:border-[#0B2B5A] focus:outline-none"
                >
                  {escuelas.map((esc) => (
                    <option key={esc.id} value={esc.id}>
                      {esc.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bloque Blindado de Autocompletado en Servidor (Solo Lectura) */}
              {escuelaSeleccionadaObj && (
                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[#0B2B5A] font-bold text-[11px]">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Datos Oficiales Derivados en Backend (Protegidos contra alteración):
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-gray-500 block">Grado de Bachiller:</span>
                      <span className="font-bold text-gray-900">
                        {escuelaSeleccionadaObj.gradoBachiller}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Título Profesional a Otorgar:</span>
                      <span className="font-bold text-gray-900">
                        {escuelaSeleccionadaObj.tituloProfesional}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Selector de 1 o 2 Tesistas */}
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1.5">
                  2. Modalidad de Integrantes
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEsColectivo(false)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border font-semibold transition ${
                      !esColectivo
                        ? 'bg-[#0B2B5A] text-white border-[#0B2B5A]'
                        : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>Individual (1 Tesista)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEsColectivo(true)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border font-semibold transition ${
                      esColectivo
                        ? 'bg-[#0B2B5A] text-white border-[#0B2B5A]'
                        : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Tesis Colectiva (2 Tesistas)</span>
                  </button>
                </div>
              </div>

              {/* Datos del Tesista 1 */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                <p className="font-bold text-gray-800">
                  Datos del Tesista 1 (Obligatorio)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-gray-600 mb-1">
                      Nombres y Apellidos Completos
                    </label>
                    <input
                      type="text"
                      required
                      value={t1Nombre}
                      onChange={(e) => setT1Nombre(e.target.value)}
                      placeholder="Ej. LUZ PAOLA CAHUASCANCO ATAYUPANQUI"
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">
                      Código Universitario
                    </label>
                    <input
                      type="text"
                      required
                      value={t1Codigo}
                      onChange={(e) => setT1Codigo(e.target.value)}
                      placeholder="Ej. 019100452A"
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Datos del Tesista 2 (Si es Colectivo) */}
              {esColectivo && (
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                  <p className="font-bold text-gray-800">
                    Datos del Tesista 2 (Tesis Colectiva)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Nombres y Apellidos Completos
                      </label>
                      <input
                        type="text"
                        required
                        value={t2Nombre}
                        onChange={(e) => setT2Nombre(e.target.value)}
                        placeholder="Ej. NURIA FLORES CÉSPEDES"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Código Universitario
                      </label>
                      <input
                        type="text"
                        required
                        value={t2Codigo}
                        onChange={(e) => setT2Codigo(e.target.value)}
                        placeholder="Ej. 019100819K"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoExp}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0B2B5A] text-white font-semibold hover:bg-[#082044] disabled:opacity-60"
                >
                  {guardandoExp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generando Expediente...</span>
                    </>
                  ) : (
                    <span>Crear Expediente</span>
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