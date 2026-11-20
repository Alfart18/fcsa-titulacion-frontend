// Archivo: app/dashboard/estudiantes/page.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Pencil,
  Eye,
  ChevronRight,
  ChevronLeft,
  PanelLeft,
  Mail,
  Phone,
  Hash,
  Loader2,
  X,
  ExternalLink,
  FolderKanban,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch,
  ApiError,
  obtenerUsuarioSesion,
  UsuarioSesion,
} from '@/lib/api';
import { useSidebar } from '../sidebar-context';

interface TesistaParticipacion {
  id: string;
  expedienteId: string;
  codigoExpediente: string;
  orden: number;
  estado: 'ACTIVO' | 'APTO' | 'DESISTIDO' | 'TITULADO';
}

interface EstudiantePersona {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  correo: string | null;
  telefono: string | null;
  codigoUniversitario: string | null;
  esDocente: boolean;
  esEstudiante: boolean;
  creadoEn: string;
  actualizadoEn: string;
  tesista?: TesistaParticipacion[];
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedEstudiantesResponse {
  data: EstudiantePersona[];
  meta: PaginationMeta;
}

const REGEX_CODIGO_UNIVERSITARIO = /^[0-9]{9}[a-zA-Z]$/;

export default function EstudiantesPage() {
  const { sidebarAbierto, toggleSidebar } = useSidebar();

  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [estudiantes, setEstudiantes] = useState<EstudiantePersona[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [terminoAplicado, setTerminoAplicado] = useState('');
  const [pagina, setPagina] = useState(1);

  // Modal Crear Estudiante (POST /personas/estudiantes)
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nuevoNombres, setNuevoNombres] = useState('');
  const [nuevoApPat, setNuevoApPat] = useState('');
  const [nuevoApMat, setNuevoApMat] = useState('');
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevoCorreo, setNuevoCorreo] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');

  // Modal Editar Estudiante (PATCH /personas/:id)
  const [editandoPersona, setEditandoPersona] =
    useState<EstudiantePersona | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [editNombres, setEditNombres] = useState('');
  const [editApPat, setEditApPat] = useState('');
  const [editApMat, setEditApMat] = useState('');
  const [editCodigo, setEditCodigo] = useState('');
  const [editCorreo, setEditCorreo] = useState('');
  const [editTelefono, setEditTelefono] = useState('');

  // Modal Detalle Estudiante + Expedientes (GET /personas/:id)
  const [detallePersona, setDetallePersona] =
    useState<EstudiantePersona | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const puedeGestionar =
    usuario?.rol === 'ADMIN' ||
    usuario?.rol === 'SECRETARIA_ACADEMICA' ||
    usuario?.rol === 'ADMINISTRATIVO';

  const cargarEstudiantes = useCallback(
    async (pageNum: number, queryText: string) => {
      setCargando(true);
      try {
        const params = new URLSearchParams();
        params.set('tipo', 'estudiante');
        params.set('page', String(pageNum));
        params.set('limit', '20');
        if (queryText.trim()) {
          params.set('q', queryText.trim());
        }

        const resp = await apiFetch<PaginatedEstudiantesResponse>(
          `/personas?${params.toString()}`,
          { servicio: 'titulacion' },
        );
        setEstudiantes(resp.data);
        setMeta(resp.meta);
      } catch (err) {
        if (err instanceof ApiError) toast.error(err.message);
        else toast.error('No se pudo cargar el directorio de estudiantes.');
      } finally {
        setCargando(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setUsuario(obtenerUsuarioSesion());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void cargarEstudiantes(pagina, terminoAplicado);
    }, 0);
    return () => clearTimeout(timer);
  }, [pagina, terminoAplicado, cargarEstudiantes]);

  const handleBuscarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    setTerminoAplicado(busqueda);
  };

  const limpiarFormularioCrear = () => {
    setNuevoNombres('');
    setNuevoApPat('');
    setNuevoApMat('');
    setNuevoCodigo('');
    setNuevoCorreo('');
    setNuevoTelefono('');
  };

  // POST /personas/estudiantes
  const handleCrearEstudiante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGestionar) return;

    const codigoLimpio = nuevoCodigo.trim();
    if (!REGEX_CODIGO_UNIVERSITARIO.test(codigoLimpio)) {
      toast.error(
        'El código universitario debe tener exactamente 9 números seguidos de 1 letra (ej. 019200997j).',
      );
      return;
    }

    setCreando(true);
    try {
      // Construir DTO estricto (CrearEstudianteDto)
      const payload: {
        nombres: string;
        apellidoPaterno: string;
        apellidoMaterno: string;
        codigoUniversitario: string;
        correo?: string;
        telefono?: string;
      } = {
        nombres: nuevoNombres.trim(),
        apellidoPaterno: nuevoApPat.trim(),
        apellidoMaterno: nuevoApMat.trim(),
        codigoUniversitario: codigoLimpio,
      };
      if (nuevoCorreo.trim()) payload.correo = nuevoCorreo.trim();
      if (nuevoTelefono.trim()) payload.telefono = nuevoTelefono.trim();

      const creado = await apiFetch<EstudiantePersona>(
        '/personas/estudiantes',
        {
          servicio: 'titulacion',
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

      toast.success(
        `Estudiante ${creado.nombreCompleto} registrado correctamente.`,
      );
      setModalCrearAbierto(false);
      limpiarFormularioCrear();
      setPagina(1);
      await cargarEstudiantes(1, terminoAplicado);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudo registrar al estudiante.');
    } finally {
      setCreando(false);
    }
  };

  const abrirModalEditar = (est: EstudiantePersona) => {
    setEditandoPersona(est);
    setEditNombres(est.nombres);
    setEditApPat(est.apellidoPaterno);
    setEditApMat(est.apellidoMaterno);
    setEditCodigo(est.codigoUniversitario ?? '');
    setEditCorreo(est.correo ?? '');
    setEditTelefono(est.telefono ?? '');
  };

  // PATCH /personas/:id
  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editandoPersona || !puedeGestionar) return;

    const codigoLimpio = editCodigo.trim();
    if (codigoLimpio && !REGEX_CODIGO_UNIVERSITARIO.test(codigoLimpio)) {
      toast.error(
        'El código universitario debe tener exactamente 9 números seguidos de 1 letra (ej. 019200997j).',
      );
      return;
    }

    setGuardandoEdicion(true);
    try {
      // Construir DTO estricto (ActualizarPersonaDto — solo campos permitidos para estudiante)
      const payload: {
        nombres?: string;
        apellidoPaterno?: string;
        apellidoMaterno?: string;
        codigoUniversitario?: string;
        correo?: string;
        telefono?: string;
      } = {
        nombres: editNombres.trim(),
        apellidoPaterno: editApPat.trim(),
        apellidoMaterno: editApMat.trim(),
        telefono: editTelefono.trim(),
      };
      if (codigoLimpio) payload.codigoUniversitario = codigoLimpio;
      if (editCorreo.trim()) payload.correo = editCorreo.trim();

      const actualizado = await apiFetch<EstudiantePersona>(
        `/personas/${editandoPersona.id}`,
        {
          servicio: 'titulacion',
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      );

      toast.success(`Datos de ${actualizado.nombreCompleto} actualizados.`);
      setEditandoPersona(null);
      await cargarEstudiantes(pagina, terminoAplicado);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudieron actualizar los datos del estudiante.');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  // GET /personas/:id (para inspeccionar expedientes asociados)
  const abrirDetalleEstudiante = async (est: EstudiantePersona) => {
    setDetallePersona(est);
    setCargandoDetalle(true);
    try {
      const full = await apiFetch<EstudiantePersona>(`/personas/${est.id}`, {
        servicio: 'titulacion',
      });
      setDetallePersona(full);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const badgeEstadoTesista = (estado: TesistaParticipacion['estado']) => {
    if (estado === 'TITULADO')
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (estado === 'APTO') return 'bg-blue-50 text-[#1E73BE] border-blue-200';
    if (estado === 'DESISTIDO')
      return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
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
            Directorio de Estudiantes
          </span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Directorio de Estudiantes y Tesistas
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1 max-w-3xl">
              Registro y mantenimiento de estudiantes de la FCSa - UAC con
              código universitario, correo institucional y trazabilidad de
              expedientes de titulación.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => void cargarEstudiantes(pagina, terminoAplicado)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${cargando ? 'animate-spin' : ''}`}
              />
              <span>Actualizar</span>
            </button>

            {puedeGestionar && (
              <button
                type="button"
                onClick={() => {
                  limpiarFormularioCrear();
                  setModalCrearAbierto(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1E73BE] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#175B96] transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>Registrar Estudiante</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Tarjeta Principal: Buscador + Tabla Paginada */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-[#1E73BE]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Estudiantes Registrados
              </h2>
              <p className="text-xs text-gray-500">
                Total encontrados: <b>{meta.total}</b> estudiante(s)
              </p>
            </div>
          </div>

          <form
            onSubmit={handleBuscarSubmit}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, código (019200997j) o correo..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-4 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#1E73BE] focus:bg-white focus:outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#1E73BE] text-white text-xs font-semibold hover:bg-[#175B96] transition-colors"
            >
              Buscar
            </button>
            {terminoAplicado && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  setTerminoAplicado('');
                  setPagina(1);
                }}
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Limpiar
              </button>
            )}
          </form>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-3.5 px-5">Código Universitario</th>
                <th className="py-3.5 px-5">Nombre Completo</th>
                <th className="py-3.5 px-5">Correo Institucional</th>
                <th className="py-3.5 px-5">Teléfono</th>
                <th className="py-3.5 px-5">Condición</th>
                <th className="py-3.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cargando ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Consultando directorio de estudiantes...
                  </td>
                </tr>
              ) : estudiantes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    No se encontraron estudiantes con los criterios actuales.
                  </td>
                </tr>
              ) : (
                estudiantes.map((est) => (
                  <tr
                    key={est.id}
                    className="hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[#1E73BE] bg-blue-50/70 border border-blue-100 px-2.5 py-1 rounded-lg">
                        <Hash className="w-3 h-3" />
                        {est.codigoUniversitario || 'Sin código'}
                      </span>
                    </td>

                    <td className="py-3.5 px-5">
                      <span className="font-semibold text-gray-900 block">
                        {est.nombreCompleto}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {est.apellidoPaterno} {est.apellidoMaterno},{' '}
                        {est.nombres}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{est.correo || '—'}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>{est.telefono || '—'}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Estudiante
                        </span>
                        {est.esDocente && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#1E73BE] border border-blue-200">
                            Docente
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void abrirDetalleEstudiante(est)}
                          title="Ver expedientes asociados"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-[11px] font-semibold hover:bg-gray-100 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detalle</span>
                        </button>

                        {puedeGestionar && (
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(est)}
                            title="Editar datos del estudiante"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-[#1E73BE] text-[11px] font-semibold hover:bg-blue-100 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/70 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
          <span>
            Página <b>{meta.page}</b> de <b>{meta.totalPages}</b> ({meta.total}{' '}
            registros)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagina <= 1 || cargando}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              disabled={pagina >= meta.totalPages || cargando}
              onClick={() => setPagina((p) => Math.min(meta.totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal 1: Registrar Nuevo Estudiante (POST /personas/estudiantes) */}
      {modalCrearAbierto && puedeGestionar && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-[#1E73BE]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Registrar Estudiante
                  </h3>
                  <p className="text-xs text-gray-500">
                    Si omite el correo, se autogenera con @uandina.edu.pe
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCrearAbierto(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCrearEstudiante}
              className="p-6 space-y-4 text-xs"
            >
              <div className="space-y-1.5">
                <label className="block font-semibold text-gray-700">
                  Nombres *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={nuevoNombres}
                  onChange={(e) => setNuevoNombres(e.target.value)}
                  placeholder="Ej. María Fernanda"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-gray-700">
                    Apellido Paterno *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={nuevoApPat}
                    onChange={(e) => setNuevoApPat(e.target.value)}
                    placeholder="Ej. Quispe"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-semibold text-gray-700">
                    Apellido Materno *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={nuevoApMat}
                    onChange={(e) => setNuevoApMat(e.target.value)}
                    placeholder="Ej. Huamán"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-gray-700">
                    Código Universitario *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    pattern="^[0-9]{9}[a-zA-Z]$"
                    title="Debe tener exactamente 9 dígitos seguidos de 1 letra (ej. 019200997j)"
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value)}
                    placeholder="019200997j"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 font-mono text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-400">
                    Formato: 9 dígitos + 1 letra (ej. 019200997j)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-gray-700">
                    Teléfono (opcional)
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value)}
                    placeholder="+51 984 000 000"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-gray-700">
                  Correo Electrónico (opcional)
                </label>
                <input
                  type="email"
                  maxLength={150}
                  value={nuevoCorreo}
                  onChange={(e) => setNuevoCorreo(e.target.value)}
                  placeholder="Si se deja vacío: {codigo}@uandina.edu.pe"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={creando}
                  onClick={() => setModalCrearAbierto(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creando}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1E73BE] font-bold text-white hover:bg-[#175B96] disabled:opacity-50 transition-colors"
                >
                  {creando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>Guardar Estudiante</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Editar Estudiante (PATCH /personas/:id) */}
      {editandoPersona && puedeGestionar && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Pencil className="w-5 h-5 text-[#1E73BE]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Editar Estudiante
                  </h3>
                  <p className="text-xs text-gray-500">
                    {editandoPersona.nombreCompleto}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditandoPersona(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleGuardarEdicion}
              className="p-6 space-y-4 text-xs"
            >
              <div className="space-y-1.5">
                <label className="block font-semibold text-gray-700">
                  Nombres *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={editNombres}
                  onChange={(e) => setEditNombres(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-gray-700">
                    Apellido Paterno *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={editApPat}
                    onChange={(e) => setEditApPat(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block font-semibold text-gray-700">
                    Apellido Materno *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={editApMat}
                    onChange={(e) => setEditApMat(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-gray-700">
                    Código Universitario
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    pattern="^[0-9]{9}[a-zA-Z]$"
                    title="Debe tener exactamente 9 dígitos seguidos de 1 letra (ej. 019200997j)"
                    value={editCodigo}
                    onChange={(e) => setEditCodigo(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 font-mono text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-gray-700">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={editTelefono}
                    onChange={(e) => setEditTelefono(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-gray-700">
                  Correo Institucional
                </label>
                <input
                  type="email"
                  maxLength={150}
                  value={editCorreo}
                  onChange={(e) => setEditCorreo(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-gray-900 focus:border-[#1E73BE] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={guardandoEdicion}
                  onClick={() => setEditandoPersona(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1E73BE] font-bold text-white hover:bg-[#175B96] disabled:opacity-50 transition-colors"
                >
                  {guardandoEdicion && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Detalle del Estudiante y sus Expedientes (GET /personas/:id) */}
      {detallePersona && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-[#1E73BE]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {detallePersona.nombreCompleto}
                  </h3>
                  <p className="text-xs font-mono text-[#1E73BE]">
                    {detallePersona.codigoUniversitario || 'Sin código'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetallePersona(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div>
                  <span className="text-[10px] uppercase text-gray-400 font-semibold block">
                    Correo
                  </span>
                  <span className="text-gray-800 font-medium">
                    {detallePersona.correo || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-gray-400 font-semibold block">
                    Teléfono
                  </span>
                  <span className="text-gray-800 font-medium">
                    {detallePersona.telefono || '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-800">
                  Expedientes de Titulación Asociados
                </h4>
                {cargandoDetalle ? (
                  <div className="py-6 text-center text-gray-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1E73BE]" />
                    <span>Cargando participaciones...</span>
                  </div>
                ) : !detallePersona.tesista ||
                  detallePersona.tesista.length === 0 ? (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-center text-gray-400">
                    Este estudiante aún no participa en expedientes registrados.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detallePersona.tesista.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl border border-gray-200 flex items-center justify-between gap-2"
                      >
                        <div>
                          <Link
                            href={`/dashboard/expedientes/${t.expedienteId}`}
                            className="font-mono font-bold text-[#1E73BE] hover:underline inline-flex items-center gap-1"
                          >
                            <span>{t.codigoExpediente}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                          <span className="block text-[11px] text-gray-500">
                            Tesista N.º {t.orden}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badgeEstadoTesista(
                            t.estado,
                          )}`}
                        >
                          {t.estado}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDetallePersona(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
