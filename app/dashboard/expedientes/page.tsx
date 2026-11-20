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
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  Lock,
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
type EstadoTesista = 'ACTIVO' | 'APTO' | 'DESISTIDO' | 'TITULADO';

interface EscuelaCatalogo {
  id: number;
  nombre: string;
  siglasDocumento: string;
  gradoBachiller: string;
  tituloProfesional: string;
  departamentoDefectoId: number;
  activa: boolean;
}

interface PersonaTesistaResumen {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  codigoUniversitario: string | null;
  correo: string | null;
  telefono: string | null;
}

interface TesistaItem {
  id: string;
  personaId: string;
  orden: number;
  estado: EstadoTesista;
  aptoResolucionId: string | null;
  tituloResolucionId: string | null;
  fechaSustentacionReal: string | null;
  notaSustentacion: number | null;
  resultadoSustentacion: string | null;
  persona: PersonaTesistaResumen;
}

interface ExpedienteItem {
  id: string;
  codigoExpediente: string;
  escuelaProfesionalId: number;
  estado: EstadoExpediente;
  cantidadTesistas: number;
  pasoActual: number;
  tituloActual: string | null;
  creadoEn: string;
  actualizadoEn: string;
  escuelaProfesional: {
    id: number;
    nombre: string;
    siglasDocumento: string;
    gradoBachiller: string;
    tituloProfesional: string;
  };
  tesistas: TesistaItem[];
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedExpedientesResponse {
  data: ExpedienteItem[];
  meta: PaginationMeta;
}

interface TesistaFormState {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  codigoUniversitario: string;
  telefono: string;
}

const TESISTA_VACIO: TesistaFormState = {
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  codigoUniversitario: '',
  telefono: '',
};

const REGEX_CODIGO_UNIVERSITARIO = /^[0-9]{9}[a-zA-Z]$/;

export default function ExpedientesListPage() {
  const router = useRouter();
  const { sidebarAbierto, toggleSidebar } = useSidebar();

  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [escuelas, setEscuelas] = useState<EscuelaCatalogo[]>([]);
  const [expedientes, setExpedientes] = useState<ExpedienteItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [cargando, setCargando] = useState(true);

  // Filtros de búsqueda y paginación
  const [busqueda, setBusqueda] = useState('');
  const [escuelaFiltro, setEscuelaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);

  // Modal de Nuevo Expediente
  const [modalAbierto, setModalAbierto] = useState(false);
  const [escuelaSeleccionadaId, setEscuelaSeleccionadaId] = useState<number>(0);
  const [esColectivo, setEsColectivo] = useState(false);
  const [tituloInicial, setTituloInicial] = useState('');
  const [t1, setT1] = useState<TesistaFormState>({ ...TESISTA_VACIO });
  const [t2, setT2] = useState<TesistaFormState>({ ...TESISTA_VACIO });
  const [guardandoExp, setGuardandoExp] = useState(false);

  const puedeCrearExpediente =
    usuario?.rol === 'ADMIN' ||
    usuario?.rol === 'SECRETARIA_ACADEMICA' ||
    usuario?.rol === 'ADMINISTRATIVO';

  const cargarEscuelas = async () => {
    try {
      const listaEscuelas = await apiFetch<EscuelaCatalogo[]>(
        '/catalogos/escuelas',
        { servicio: 'titulacion' },
      );
      setEscuelas(listaEscuelas);
      if (listaEscuelas.length > 0 && escuelaSeleccionadaId === 0) {
        setEscuelaSeleccionadaId(listaEscuelas[0].id);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      }
    }
  };

  const cargarExpedientes = async (
    overrides?: {
      q?: string;
      escuela?: string;
      estado?: string;
      page?: number;
    },
  ) => {
    setCargando(true);
    try {
      const qVal = overrides?.q !== undefined ? overrides.q : busqueda;
      const escVal =
        overrides?.escuela !== undefined ? overrides.escuela : escuelaFiltro;
      const estVal =
        overrides?.estado !== undefined ? overrides.estado : estadoFiltro;
      const pageVal =
        overrides?.page !== undefined ? overrides.page : paginaActual;

      const params = new URLSearchParams();
      if (qVal.trim()) params.set('q', qVal.trim());
      if (escVal) params.set('escuelaProfesionalId', escVal);
      if (estVal) params.set('estado', estVal);
      params.set('page', String(pageVal));
      params.set('limit', '20');

      const resp = await apiFetch<PaginatedExpedientesResponse>(
        `/expedientes?${params.toString()}`,
        { servicio: 'titulacion' },
      );

      setExpedientes(resp.data);
      setMeta(resp.meta);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setUsuario(obtenerUsuarioSesion());
      void cargarEscuelas();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void cargarExpedientes();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escuelaFiltro, estadoFiltro, paginaActual]);

  const handleBuscarSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (paginaActual !== 1) {
      setPaginaActual(1);
    } else {
      void cargarExpedientes({ page: 1 });
    }
  };

  const escuelaSeleccionadaObj = escuelas.find(
    (e) => e.id === Number(escuelaSeleccionadaId),
  );

  const validarTesista = (
    datos: TesistaFormState,
    etiqueta: string,
  ): string | null => {
    if (
      !datos.nombres.trim() ||
      !datos.apellidoPaterno.trim() ||
      !datos.apellidoMaterno.trim()
    ) {
      return `Complete nombres, apellido paterno y apellido materno del ${etiqueta}.`;
    }
    if (!REGEX_CODIGO_UNIVERSITARIO.test(datos.codigoUniversitario.trim())) {
      return `El código universitario del ${etiqueta} debe tener exactamente 9 dígitos seguidos de 1 letra (ej. 019100452A).`;
    }
    return null;
  };

  const handleCrearExpediente = async (e: FormEvent) => {
    e.preventDefault();
    if (!escuelaSeleccionadaId) {
      toast.error('Seleccione una Escuela Profesional.');
      return;
    }

    const errT1 = validarTesista(t1, 'Tesista 1');
    if (errT1) {
      toast.error(errT1);
      return;
    }

    if (esColectivo) {
      const errT2 = validarTesista(t2, 'Tesista 2');
      if (errT2) {
        toast.error(errT2);
        return;
      }
      if (
        t1.codigoUniversitario.trim().toLowerCase() ===
        t2.codigoUniversitario.trim().toLowerCase()
      ) {
        toast.error('Los dos tesistas deben tener códigos universitarios distintos.');
        return;
      }
    }

    const mapTesistaPayload = (t: TesistaFormState) => ({
      nombres: t.nombres.trim(),
      apellidoPaterno: t.apellidoPaterno.trim(),
      apellidoMaterno: t.apellidoMaterno.trim(),
      codigoUniversitario: t.codigoUniversitario.trim(),
      ...(t.telefono.trim() ? { telefono: t.telefono.trim() } : {}),
    });

    const tesistasPayload = [mapTesistaPayload(t1)];
    if (esColectivo) {
      tesistasPayload.push(mapTesistaPayload(t2));
    }

    setGuardandoExp(true);
    try {
      const nuevoExp = await apiFetch<ExpedienteItem>('/expedientes', {
        servicio: 'titulacion',
        method: 'POST',
        body: JSON.stringify({
          escuelaProfesionalId: Number(escuelaSeleccionadaId),
          cantidadTesistas: tesistasPayload.length,
          pasoActual: 1,
          ...(tituloInicial.trim()
            ? { tituloActual: tituloInicial.trim() }
            : {}),
          tesistas: tesistasPayload,
        }),
      });

      toast.success(`Expediente ${nuevoExp.codigoExpediente} creado con éxito.`);
      setModalAbierto(false);
      setT1({ ...TESISTA_VACIO });
      setT2({ ...TESISTA_VACIO });
      setTituloInicial('');
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
    <div className="space-y-6 pb-12 w-full">
      {/* Cabecera con Breadcrumbs y Botón de Sidebar */}
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
          <span className="font-medium text-gray-800">Expedientes y 7 Pasos</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Gestión de Expedientes de Titulación
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1 max-w-3xl">
              Control secuencial de los 7 pasos, resoluciones complementarias y trazabilidad por tesista ({meta.total} registros).
            </p>
          </div>

          {puedeCrearExpediente ? (
            <button
              type="button"
              onClick={() => setModalAbierto(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E73BE] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#175B96] transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Aperturar Nuevo Expediente</span>
            </button>
          ) : (
            usuario && (
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  disabled
                  title="Solo Secretaría Académica, Administrativo o Admin pueden aperturar expedientes"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-400 cursor-not-allowed"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Aperturar Nuevo Expediente</span>
                </button>
                <span className="text-[11px] text-gray-500">
                  Solo Secretaría Académica, Administrativo o Admin pueden aperturar expedientes
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Barra de Filtros Multicriterio */}
      <form
        onSubmit={handleBuscarSubmit}
        className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
      >
        <div className="md:col-span-5">
          <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
            Búsqueda por Código, Tesista o Título
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Ej. EXP-2026-0001, Cahuascanco, 019100..."
              className="w-full rounded-xl border border-gray-300 pl-9 pr-3 py-2 text-xs text-gray-900 focus:border-[#1E73BE] focus:outline-none"
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
            Escuela Profesional
          </label>
          <select
            value={escuelaFiltro}
            onChange={(e) => {
              setEscuelaFiltro(e.target.value);
              setPaginaActual(1);
            }}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-900 bg-white focus:border-[#1E73BE] focus:outline-none"
          >
            <option value="">Todas las Escuelas ({escuelas.length})</option>
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
            onChange={(e) => {
              setEstadoFiltro(e.target.value);
              setPaginaActual(1);
            }}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs text-gray-900 bg-white focus:border-[#1E73BE] focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="EN_PROCESO">EN PROCESO</option>
            <option value="FINALIZADO">FINALIZADO</option>
            <option value="ANULADO">ANULADO</option>
          </select>
        </div>

        <div className="md:col-span-2 flex gap-2">
          <button
            type="submit"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1E73BE] px-3 py-2 text-xs font-semibold text-white hover:bg-[#175B96] transition-colors"
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
              setPaginaActual(1);
              void cargarExpedientes({
                q: '',
                escuela: '',
                estado: '',
                page: 1,
              });
            }}
            title="Refrescar"
            className="p-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </form>

      {/* Tabla de Expedientes */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                <th className="py-3.5 px-4">Código / Paso</th>
                <th className="py-3.5 px-4">Escuela / Título a Obtener</th>
                <th className="py-3.5 px-4">Tesista(s) y Estado Individual</th>
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
                      <span className="font-mono font-bold text-[#1E73BE] text-xs block">
                        {exp.codigoExpediente}
                      </span>
                      <span className="text-[10px] text-gray-500 block">
                        {exp.cantidadTesistas === 2
                          ? 'Colectivo (2)'
                          : 'Individual (1)'}{' '}
                        · Paso {exp.pasoActual}
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
                              {t.persona.nombreCompleto}
                            </span>
                            {t.persona.codigoUniversitario && (
                              <span className="font-mono text-[10px] text-gray-500 ml-1.5">
                                ({t.persona.codigoUniversitario})
                              </span>
                            )}
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
                          exp.estado === 'EN_PROCESO'
                            ? 'bg-blue-100 text-blue-800'
                            : exp.estado === 'FINALIZADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {exp.estado.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 align-top text-right">
                      <Link
                        href={`/dashboard/expedientes/${exp.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E73BE] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#175B96] transition"
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

        {/* Paginación */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-600 bg-gray-50/50">
            <span>
              Página <b>{meta.page}</b> de <b>{meta.totalPages}</b> — Total:{' '}
              <b>{meta.total}</b> expedientes
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-semibold hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                disabled={meta.page >= meta.totalPages}
                onClick={() =>
                  setPaginaActual((p) => Math.min(meta.totalPages, p + 1))
                }
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 font-semibold hover:bg-gray-100 disabled:opacity-40"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* MODAL DE APERTURA DE NUEVO EXPEDIENTE (CON BLINDAJE DE GRADO/TÍTULO)*/}
      {/* =================================================================== */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden my-6">
            <div className="bg-[#1E73BE] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  Aperturar Nuevo Expediente de Titulación
                </h3>
                <p className="text-[11px] text-blue-200">
                  El código correlativo anual (EXP-AAAA-NNNN) se asigna con bloqueo atómico
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

            <form
              onSubmit={handleCrearExpediente}
              className="p-6 space-y-4 text-xs max-h-[82vh] overflow-y-auto"
            >
              {/* Selección de Escuela Profesional */}
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1.5">
                  1. Seleccionar Escuela Profesional
                </label>
                <select
                  value={escuelaSeleccionadaId}
                  onChange={(e) =>
                    setEscuelaSeleccionadaId(Number(e.target.value))
                  }
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-xs font-semibold text-gray-900 bg-white focus:border-[#1E73BE] focus:outline-none"
                >
                  {escuelas.map((esc) => (
                    <option key={esc.id} value={esc.id}>
                      {esc.nombre} ({esc.siglasDocumento})
                    </option>
                  ))}
                </select>
              </div>

              {/* Bloque Blindado de Autocompletado en Servidor (Solo Lectura) */}
              {escuelaSeleccionadaObj && (
                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[#1E73BE] font-bold text-[11px]">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Datos Oficiales Derivados en Backend (Protegidos contra alteración):
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-gray-500 block">
                        Grado de Bachiller:
                      </span>
                      <span className="font-bold text-gray-900">
                        {escuelaSeleccionadaObj.gradoBachiller}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">
                        Título Profesional a Otorgar:
                      </span>
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
                        ? 'bg-[#1E73BE] text-white border-[#1E73BE]'
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
                        ? 'bg-[#1E73BE] text-white border-[#1E73BE]'
                        : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Tesis Colectiva (2 Tesistas)</span>
                  </button>
                </div>
              </div>

              {/* Título inicial opcional */}
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">
                  3. Título Preliminar de Tesis (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={tituloInicial}
                  onChange={(e) => setTituloInicial(e.target.value)}
                  placeholder="Puede dejarlo vacío y registrarlo en el Paso 2 (Dictamen)"
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                />
              </div>

              {/* Datos del Tesista 1 */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
                <p className="font-bold text-gray-800">
                  Datos del Tesista 1 (Obligatorio)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">
                      Nombres *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={t1.nombres}
                      onChange={(e) =>
                        setT1((prev) => ({ ...prev, nombres: e.target.value }))
                      }
                      placeholder="Ej. LUZ PAOLA"
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">
                      Apellido Paterno *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={t1.apellidoPaterno}
                      onChange={(e) =>
                        setT1((prev) => ({
                          ...prev,
                          apellidoPaterno: e.target.value,
                        }))
                      }
                      placeholder="Ej. CAHUASCANCO"
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">
                      Apellido Materno *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={t1.apellidoMaterno}
                      onChange={(e) =>
                        setT1((prev) => ({
                          ...prev,
                          apellidoMaterno: e.target.value,
                        }))
                      }
                      placeholder="Ej. ATAYUPANQUI"
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">
                      Código Universitario (9 dígitos + 1 letra) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      value={t1.codigoUniversitario}
                      onChange={(e) =>
                        setT1((prev) => ({
                          ...prev,
                          codigoUniversitario: e.target.value,
                        }))
                      }
                      placeholder="Ej. 019100452A"
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono uppercase bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">
                      Teléfono (Opcional)
                    </label>
                    <input
                      type="text"
                      maxLength={30}
                      value={t1.telefono}
                      onChange={(e) =>
                        setT1((prev) => ({ ...prev, telefono: e.target.value }))
                      }
                      placeholder="Ej. 984123456"
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Datos del Tesista 2 (Si es Colectivo) */}
              {esColectivo && (
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
                  <p className="font-bold text-gray-800">
                    Datos del Tesista 2 (Tesis Colectiva)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Nombres *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={120}
                        value={t2.nombres}
                        onChange={(e) =>
                          setT2((prev) => ({ ...prev, nombres: e.target.value }))
                        }
                        placeholder="Ej. NURIA"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Apellido Paterno *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={t2.apellidoPaterno}
                        onChange={(e) =>
                          setT2((prev) => ({
                            ...prev,
                            apellidoPaterno: e.target.value,
                          }))
                        }
                        placeholder="Ej. FLORES"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Apellido Materno *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={t2.apellidoMaterno}
                        onChange={(e) =>
                          setT2((prev) => ({
                            ...prev,
                            apellidoMaterno: e.target.value,
                          }))
                        }
                        placeholder="Ej. CÉSPEDES"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Código Universitario (9 dígitos + 1 letra) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={10}
                        value={t2.codigoUniversitario}
                        onChange={(e) =>
                          setT2((prev) => ({
                            ...prev,
                            codigoUniversitario: e.target.value,
                          }))
                        }
                        placeholder="Ej. 019100819K"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono uppercase bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Teléfono (Opcional)
                      </label>
                      <input
                        type="text"
                        maxLength={30}
                        value={t2.telefono}
                        onChange={(e) =>
                          setT2((prev) => ({ ...prev, telefono: e.target.value }))
                        }
                        placeholder="Ej. 984654321"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
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
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1E73BE] text-white font-semibold hover:bg-[#175B96] disabled:opacity-60"
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
