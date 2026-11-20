// Archivo: app/dashboard/configuracion/page.tsx
'use client';

import React, { useCallback, useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  Settings,
  Award,
  ListChecks,
  Building2,
  BookOpen,
  RefreshCw,
  Plus,
  Edit3,
  Power,
  CheckCircle2,
  XCircle,
  Search,
  ChevronRight,
  PanelLeft,
  Save,
  X,
  Loader2,
  ShieldCheck,
  Info,
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

// ============================================================================
// TIPOS SINCRONIZADOS CON TITULACION-SERVICE (configuracion/ y catalogos/)
// ============================================================================

type AmbitoCausa =
  | 'CAMBIO_ASESOR'
  | 'CAMBIO_DICTAMINANTE'
  | 'DSE'
  | 'DOCUMENTO_EXTERNO';

interface DecanoFirmanteResponse {
  id: string;
  nombresCompletos: string;
  gradoTitulo: string;
  correo: string;
  iniciales: string;
  rol: RolUsuario;
  estado: 'ACTIVO' | 'DESACTIVADO';
  esDecanoFirmante: boolean;
}

interface ConfiguracionInstitucionalResponse {
  id: number;
  facultad: string;
  universidad: string;
  ciudad: string;
  siglasFacultad: string;
  siglasUniversidad: string;
  reglamentoMarco: string;
  actualizadoEn: string;
}

interface ConfiguracionCompletaResponse {
  institucional: ConfiguracionInstitucionalResponse;
  decanoFirmante: DecanoFirmanteResponse | null;
}

interface CausaResponse {
  id: number;
  ambito: AmbitoCausa;
  descripcion: string;
  requiereDetalleManual: boolean;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

interface EscuelaCatalogoResponse {
  id: number;
  nombre: string;
  siglasDocumento: string;
  gradoBachiller: string;
  tituloProfesional: string;
  departamentoDefectoId: number;
  activa: boolean;
}

interface DepartamentoCatalogoResponse {
  id: number;
  nombre: string;
  activo: boolean;
}

interface UsuarioCandidatoDecano {
  id: string;
  gradoTitulo: string;
  nombresCompletos: string;
  correo: string;
  iniciales: string;
  rol: RolUsuario;
  estado: 'ACTIVO' | 'DESACTIVADO';
  esDecanoFirmante: boolean;
}

type PestanaActiva = 'institucional' | 'causas' | 'academicos';

const AMBITOS_CAUSA: { value: AmbitoCausa; label: string; badge: string }[] = [
  {
    value: 'CAMBIO_ASESOR',
    label: 'Cambio de Asesor',
    badge: 'bg-blue-50 text-[#1E73BE] border-blue-200',
  },
  {
    value: 'CAMBIO_DICTAMINANTE',
    label: 'Cambio de Dictaminante',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    value: 'DSE',
    label: 'Dejar Sin Efecto (DSE)',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    value: 'DOCUMENTO_EXTERNO',
    label: 'Documento Externo',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
  },
];

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function obtenerInfoAmbito(ambito: AmbitoCausa) {
  return (
    AMBITOS_CAUSA.find((a) => a.value === ambito) ?? {
      value: ambito,
      label: ambito,
      badge: 'bg-gray-100 text-gray-700 border-gray-200',
    }
  );
}

export default function ConfiguracionYCausasPage() {
  const { sidebarAbierto, toggleSidebar } = useSidebar();

  const [sesion, setSesion] = useState<UsuarioSesion | null>(null);
  const [pestana, setPestana] = useState<PestanaActiva>('institucional');

  // Estado Tab 1: Configuración Institucional y Decano Firmante
  const [configuracion, setConfiguracion] =
    useState<ConfiguracionCompletaResponse | null>(null);
  const [cargandoConfig, setCargandoConfig] = useState(true);
  const [reglamentoMarco, setReglamentoMarco] = useState('');
  const [guardandoReglamento, setGuardandoReglamento] = useState(false);
  const [candidatosDecano, setCandidatosDecano] = useState<
    UsuarioCandidatoDecano[]
  >([]);
  const [nuevoDecanoId, setNuevoDecanoId] = useState('');
  const [guardandoDecano, setGuardandoDecano] = useState(false);

  // Estado Tab 2: Catálogo de Causas
  const [causas, setCausas] = useState<CausaResponse[]>([]);
  const [cargandoCausas, setCargandoCausas] = useState(true);
  const [ambitoFiltro, setAmbitoFiltro] = useState<'' | AmbitoCausa>('');
  const [incluirInactivos, setIncluirInactivos] = useState(true);
  const [busquedaCausa, setBusquedaCausa] = useState('');
  const [procesandoCausaId, setProcesandoCausaId] = useState<number | null>(
    null,
  );

  // Modal Crear / Editar Causa
  const [modalCausaAbierto, setModalCausaAbierto] = useState(false);
  const [causaEditar, setCausaEditar] = useState<CausaResponse | null>(null);
  const [causaAmbito, setCausaAmbito] = useState<AmbitoCausa>('CAMBIO_ASESOR');
  const [causaDescripcion, setCausaDescripcion] = useState('');
  const [causaRequiereManual, setCausaRequiereManual] = useState(false);
  const [causaActiva, setCausaActiva] = useState(true);
  const [guardandoCausa, setGuardandoCausa] = useState(false);

  // Estado Tab 3: Escuelas y Departamentos
  const [escuelas, setEscuelas] = useState<EscuelaCatalogoResponse[]>([]);
  const [departamentos, setDepartamentos] = useState<
    DepartamentoCatalogoResponse[]
  >([]);
  const [cargandoAcademicos, setCargandoAcademicos] = useState(true);

  const cargarConfiguracion = useCallback(async (rolActual?: RolUsuario) => {
    setCargandoConfig(true);
    try {
      const data = await apiFetch<ConfiguracionCompletaResponse>(
        '/configuracion',
        { servicio: 'titulacion' },
      );
      setConfiguracion(data);
      setReglamentoMarco(data.institucional.reglamentoMarco);
      setNuevoDecanoId(data.decanoFirmante?.id ?? '');

      // Solo ADMIN puede consultar /admin/usuarios en identidad-service para listar candidatos DECANO
      if (rolActual === 'ADMIN') {
        try {
          const usuarios = await apiFetch<UsuarioCandidatoDecano[]>(
            '/admin/usuarios',
            { servicio: 'identidad' },
          );
          const decanosActivos = (Array.isArray(usuarios) ? usuarios : []).filter(
            (u) => u.rol === 'DECANO' && u.estado === 'ACTIVO',
          );
          setCandidatosDecano(decanosActivos);
        } catch {
          setCandidatosDecano([]);
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudo cargar la configuración institucional.');
      }
    } finally {
      setCargandoConfig(false);
    }
  }, []);

  const cargarCausas = useCallback(
    async (
      ambitoParam: '' | AmbitoCausa = ambitoFiltro,
      incluirParam: boolean = incluirInactivos,
    ) => {
      setCargandoCausas(true);
      try {
        const params = new URLSearchParams();
        if (ambitoParam) params.set('ambito', ambitoParam);
        if (incluirParam) params.set('incluirInactivos', 'true');
        const query = params.toString() ? `?${params.toString()}` : '';

        const data = await apiFetch<CausaResponse[]>(
          `/catalogos/causas${query}`,
          { servicio: 'titulacion' },
        );
        setCausas(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error('No se pudo cargar el catálogo de causas.');
        }
      } finally {
        setCargandoCausas(false);
      }
    },
    [ambitoFiltro, incluirInactivos],
  );

  const cargarAcademicos = useCallback(async () => {
    setCargandoAcademicos(true);
    try {
      const [listaEscuelas, listaDepartamentos] = await Promise.all([
        apiFetch<EscuelaCatalogoResponse[]>('/catalogos/escuelas', {
          servicio: 'titulacion',
        }),
        apiFetch<DepartamentoCatalogoResponse[]>('/catalogos/departamentos', {
          servicio: 'titulacion',
        }),
      ]);
      setEscuelas(Array.isArray(listaEscuelas) ? listaEscuelas : []);
      setDepartamentos(
        Array.isArray(listaDepartamentos) ? listaDepartamentos : [],
      );
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudieron cargar las escuelas y departamentos.');
      }
    } finally {
      setCargandoAcademicos(false);
    }
  }, []);

  useEffect(() => {
    let activo = true;
    const inicializar = async () => {
      await Promise.resolve();
      if (!activo) return;
      const u = obtenerUsuarioSesion();
      setSesion(u);
      await Promise.all([
        cargarConfiguracion(u?.rol),
        cargarCausas('', true),
        cargarAcademicos(),
      ]);
    };
    void inicializar();
    return () => {
      activo = false;
    };
  }, [cargarConfiguracion, cargarCausas, cargarAcademicos]);

  // Permisos exactos según backend titulacion-service
  const puedeEditarReglamento = sesion?.rol === 'ADMIN';
  const puedeCambiarDecano =
    sesion?.rol === 'ADMIN' || sesion?.rol === 'SECRETARIA_ACADEMICA';
  const puedeGestionarCausas =
    sesion?.rol === 'ADMIN' || sesion?.rol === 'SECRETARIA_ACADEMICA';

  const handleGuardarReglamento = async (e: FormEvent) => {
    e.preventDefault();
    const limpio = reglamentoMarco.trim();
    if (!limpio) {
      toast.error('El reglamento marco es obligatorio.');
      return;
    }

    setGuardandoReglamento(true);
    try {
      const actualizada = await apiFetch<ConfiguracionCompletaResponse>(
        '/configuracion',
        {
          servicio: 'titulacion',
          method: 'PATCH',
          body: JSON.stringify({ reglamentoMarco: limpio }),
        },
      );
      setConfiguracion(actualizada);
      setReglamentoMarco(actualizada.institucional.reglamentoMarco);
      toast.success('Reglamento marco institucional actualizado correctamente.');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudo actualizar el reglamento marco.');
      }
    } finally {
      setGuardandoReglamento(false);
    }
  };

  const handleCambiarDecanoFirmante = async (e: FormEvent) => {
    e.preventDefault();
    const usuarioIdLimpio = nuevoDecanoId.trim();
    if (!UUID_V4_REGEX.test(usuarioIdLimpio)) {
      toast.error(
        'Debe seleccionar o ingresar un identificador UUID v4 válido de usuario con rol DECANO.',
      );
      return;
    }

    setGuardandoDecano(true);
    try {
      const actualizada = await apiFetch<ConfiguracionCompletaResponse>(
        '/configuracion/decano-firmante',
        {
          servicio: 'titulacion',
          method: 'PATCH',
          body: JSON.stringify({ usuarioId: usuarioIdLimpio }),
        },
      );
      setConfiguracion(actualizada);
      setNuevoDecanoId(actualizada.decanoFirmante?.id ?? usuarioIdLimpio);
      toast.success('Decano Firmante actualizado correctamente.', {
        description: actualizada.decanoFirmante
          ? `${actualizada.decanoFirmante.gradoTitulo} ${actualizada.decanoFirmante.nombresCompletos}`
          : undefined,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudo actualizar el Decano Firmante.');
      }
    } finally {
      setGuardandoDecano(false);
    }
  };

  const handleCambioFiltroAmbito = (nuevoAmbito: '' | AmbitoCausa) => {
    setAmbitoFiltro(nuevoAmbito);
    void cargarCausas(nuevoAmbito, incluirInactivos);
  };

  const handleCambioIncluirInactivos = (nuevoValor: boolean) => {
    setIncluirInactivos(nuevoValor);
    void cargarCausas(ambitoFiltro, nuevoValor);
  };

  const abrirModalCrearCausa = () => {
    setCausaEditar(null);
    setCausaAmbito(ambitoFiltro || 'CAMBIO_ASESOR');
    setCausaDescripcion('');
    setCausaRequiereManual(false);
    setCausaActiva(true);
    setModalCausaAbierto(true);
  };

  const abrirModalEditarCausa = (causa: CausaResponse) => {
    setCausaEditar(causa);
    setCausaAmbito(causa.ambito);
    setCausaDescripcion(causa.descripcion);
    setCausaRequiereManual(causa.requiereDetalleManual);
    setCausaActiva(causa.activo);
    setModalCausaAbierto(true);
  };

  const handleGuardarCausa = async (e: FormEvent) => {
    e.preventDefault();
    const descripcionLimpia = causaDescripcion.trim();
    if (!descripcionLimpia) {
      toast.error('La descripción de la causa es obligatoria.');
      return;
    }

    setGuardandoCausa(true);
    try {
      if (!causaEditar) {
        await apiFetch<CausaResponse>('/catalogos/causas', {
          servicio: 'titulacion',
          method: 'POST',
          body: JSON.stringify({
            ambito: causaAmbito,
            descripcion: descripcionLimpia,
            requiereDetalleManual: causaRequiereManual,
          }),
        });
        toast.success('Nueva causa registrada en el catálogo.');
      } else {
        await apiFetch<CausaResponse>(`/catalogos/causas/${causaEditar.id}`, {
          servicio: 'titulacion',
          method: 'PATCH',
          body: JSON.stringify({
            ambito: causaAmbito,
            descripcion: descripcionLimpia,
            requiereDetalleManual: causaRequiereManual,
            activo: causaActiva,
          }),
        });
        toast.success('Causa actualizada correctamente.');
      }

      setModalCausaAbierto(false);
      await cargarCausas(ambitoFiltro, incluirInactivos);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudo guardar la causa.');
      }
    } finally {
      setGuardandoCausa(false);
    }
  };

  const handleAlternarEstadoCausa = async (causa: CausaResponse) => {
    setProcesandoCausaId(causa.id);
    try {
      await apiFetch<CausaResponse>(`/catalogos/causas/${causa.id}`, {
        servicio: 'titulacion',
        method: 'PATCH',
        body: JSON.stringify({ activo: !causa.activo }),
      });
      toast.success(
        !causa.activo
          ? 'Causa reactivada correctamente.'
          : 'Causa desactivada correctamente.',
      );
      await cargarCausas(ambitoFiltro, incluirInactivos);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudo cambiar el estado de la causa.');
      }
    } finally {
      setProcesandoCausaId(null);
    }
  };

  const causasFiltradas = causas.filter((c) => {
    if (!busquedaCausa.trim()) return true;
    const q = busquedaCausa.toLowerCase();
    return (
      c.descripcion.toLowerCase().includes(q) ||
      c.ambito.toLowerCase().includes(q)
    );
  });

  const departamentosPorId = new Map<number, DepartamentoCatalogoResponse>(
    departamentos.map((d) => [d.id, d]),
  );

  const handleRefrescarPestana = () => {
    if (pestana === 'institucional') {
      void cargarConfiguracion(sesion?.rol);
    } else if (pestana === 'causas') {
      void cargarCausas(ambitoFiltro, incluirInactivos);
    } else {
      void cargarAcademicos();
    }
  };

  const cargandoActual =
    (pestana === 'institucional' && cargandoConfig) ||
    (pestana === 'causas' && cargandoCausas) ||
    (pestana === 'academicos' && cargandoAcademicos);

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
          <span className="font-medium text-gray-800">
            Configuración y Causas
          </span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Configuración Institucional y Catálogos
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Parámetros institucionales, autoridad firmante vigente, catálogo
              normalizado de causas y estructura académica de la FCSa - UAC.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefrescarPestana}
            disabled={cargandoActual}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs transition-colors disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${cargandoActual ? 'animate-spin' : ''}`}
            />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* 2. Navegación por Pestañas */}
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setPestana('institucional')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            pestana === 'institucional'
              ? 'bg-[#1E73BE] text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Configuración y Decano Firmante</span>
        </button>

        <button
          type="button"
          onClick={() => setPestana('causas')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            pestana === 'causas'
              ? 'bg-[#1E73BE] text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>Catálogo de Causas</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
              pestana === 'causas'
                ? 'bg-white/20 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {causas.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPestana('academicos')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            pestana === 'academicos'
              ? 'bg-[#1E73BE] text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Escuelas y Departamentos</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
              pestana === 'academicos'
                ? 'bg-white/20 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {escuelas.length} / {departamentos.length}
          </span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* PESTAÑA 1: CONFIGURACIÓN INSTITUCIONAL Y DECANO FIRMANTE             */}
      {/* ==================================================================== */}
      {pestana === 'institucional' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tarjeta 1: Datos Institucionales y Reglamento Marco */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-[#1E73BE]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Parámetros Institucionales
                  </h2>
                  <p className="text-xs text-gray-500">
                    Encabezados oficiales y reglamento marco vigente
                  </p>
                </div>
              </div>
              {!puedeEditarReglamento && (
                <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
                  Solo lectura (Edita: ADMIN)
                </span>
              )}
            </div>

            {cargandoConfig && !configuracion ? (
              <div className="py-8 text-center text-xs text-gray-400">
                Cargando configuración institucional...
              </div>
            ) : configuracion ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">
                      Universidad
                    </span>
                    <span className="font-semibold text-gray-900 mt-0.5 block">
                      {configuracion.institucional.universidad} (
                      {configuracion.institucional.siglasUniversidad})
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">
                      Facultad
                    </span>
                    <span className="font-semibold text-gray-900 mt-0.5 block">
                      {configuracion.institucional.facultad} (
                      {configuracion.institucional.siglasFacultad})
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">
                      Ciudad / Sede
                    </span>
                    <span className="font-semibold text-gray-900 mt-0.5 block">
                      {configuracion.institucional.ciudad}
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">
                      Última Actualización
                    </span>
                    <span className="font-mono font-semibold text-gray-700 mt-0.5 block">
                      {new Date(
                        configuracion.institucional.actualizadoEn,
                      ).toLocaleString('es-PE')}
                    </span>
                  </div>
                </div>

                <form
                  onSubmit={handleGuardarReglamento}
                  className="space-y-3 pt-2 border-t border-gray-100"
                >
                  <div>
                    <label
                      htmlFor="reglamentoMarco"
                      className="block text-xs font-semibold text-gray-700 mb-1.5"
                    >
                      Reglamento Marco Vigente (máx. 150 caracteres)
                    </label>
                    <input
                      id="reglamentoMarco"
                      type="text"
                      required
                      maxLength={150}
                      disabled={!puedeEditarReglamento || guardandoReglamento}
                      value={reglamentoMarco}
                      onChange={(e) => setReglamentoMarco(e.target.value)}
                      placeholder="Ej. Resolución N.º 513-CU-2024-UAC"
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 disabled:bg-gray-50 disabled:text-gray-600 focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                    />
                  </div>

                  {puedeEditarReglamento && (
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={guardandoReglamento}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#1E73BE] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#155A9C] shadow-sm transition-colors disabled:opacity-50"
                      >
                        {guardandoReglamento ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        <span>Guardar Reglamento Marco</span>
                      </button>
                    </div>
                  )}
                </form>
              </>
            ) : null}
          </div>

          {/* Tarjeta 2: Decano Firmante Vigente */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Award className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Decano Firmante Vigente
                  </h2>
                  <p className="text-xs text-gray-500">
                    Autoridad estampada en nuevas resoluciones emitidas
                  </p>
                </div>
              </div>
              {!puedeCambiarDecano && (
                <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">
                  Solo lectura (Edita: ADMIN / SEC. ACAD.)
                </span>
              )}
            </div>

            {configuracion?.decanoFirmante ? (
              <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#1E73BE]">
                    Autoridad Activa
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{configuracion.decanoFirmante.estado}</span>
                  </span>
                </div>
                <p className="text-base font-bold text-gray-900">
                  {configuracion.decanoFirmante.gradoTitulo}{' '}
                  {configuracion.decanoFirmante.nombresCompletos}
                </p>
                <p className="text-xs text-gray-600 font-mono">
                  {configuracion.decanoFirmante.correo} · /
                  {configuracion.decanoFirmante.iniciales}
                </p>
                <p className="text-[11px] text-gray-400 font-mono">
                  UUID: {configuracion.decanoFirmante.id}
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-xs text-amber-900">
                No existe un usuario con rol <b>DECANO</b> activo designado como
                firmante vigente.
              </div>
            )}

            <div className="bg-gray-50 rounded-xl border border-gray-100 p-3.5 text-xs text-gray-600 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#1E73BE] shrink-0 mt-0.5" />
              <span>
                El cambio de Decano Firmante retira automáticamente el indicador
                al anterior y solo aplica a las resoluciones emitidas a partir
                de ese momento, preservando el historial inmutable.
              </span>
            </div>

            {puedeCambiarDecano && (
              <form
                onSubmit={handleCambiarDecanoFirmante}
                className="space-y-3 pt-2 border-t border-gray-100"
              >
                {candidatosDecano.length > 0 ? (
                  <div>
                    <label
                      htmlFor="selectorDecano"
                      className="block text-xs font-semibold text-gray-700 mb-1.5"
                    >
                      Seleccionar Usuario con Rol DECANO Activo
                    </label>
                    <select
                      id="selectorDecano"
                      value={nuevoDecanoId}
                      onChange={(e) => setNuevoDecanoId(e.target.value)}
                      disabled={guardandoDecano}
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs bg-white font-semibold focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                    >
                      <option value="">-- Seleccione un decano activo --</option>
                      {candidatosDecano.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.gradoTitulo} {c.nombresCompletos} ({c.correo})
                          {c.esDecanoFirmante ? ' — ACTUAL' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="inputDecanoUuid"
                      className="block text-xs font-semibold text-gray-700 mb-1.5"
                    >
                      UUID v4 del Usuario Decano Activo
                    </label>
                    <input
                      id="inputDecanoUuid"
                      type="text"
                      required
                      value={nuevoDecanoId}
                      onChange={(e) => setNuevoDecanoId(e.target.value)}
                      disabled={guardandoDecano}
                      placeholder="550e8400-e29b-41d4-a716-446655440000"
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs font-mono focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                    />
                    <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>
                        El usuario indicado debe tener estado ACTIVO y rol DECANO.
                      </span>
                    </p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={guardandoDecano || !nuevoDecanoId.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1E73BE] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#155A9C] shadow-sm transition-colors disabled:opacity-50"
                  >
                    {guardandoDecano ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Award className="w-4 h-4" />
                    )}
                    <span>Designar Decano Firmante</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 2: CATÁLOGO DE CAUSAS                                        */}
      {/* ==================================================================== */}
      {pestana === 'causas' && (
        <div className="space-y-4">
          {/* Barra de Filtros y Acción */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busquedaCausa}
                  onChange={(e) => setBusquedaCausa(e.target.value)}
                  placeholder="Buscar por descripción o ámbito..."
                  className="w-full rounded-xl border border-gray-300 pl-10 pr-3 py-2 text-xs focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                />
              </div>

              <select
                value={ambitoFiltro}
                onChange={(e) =>
                  handleCambioFiltroAmbito(e.target.value as '' | AmbitoCausa)
                }
                className="rounded-xl border border-gray-300 px-3 py-2 text-xs bg-white font-medium focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
              >
                <option value="">Todos los ámbitos</option>
                {AMBITOS_CAUSA.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={incluirInactivos}
                  onChange={(e) => handleCambioIncluirInactivos(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Incluir inactivas</span>
              </label>
            </div>

            {puedeGestionarCausas && (
              <button
                type="button"
                onClick={abrirModalCrearCausa}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1E73BE] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#155A9C] transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Causa</span>
              </button>
            )}
          </div>

          {/* Tabla de Causas */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="py-3.5 px-4">Ámbito</th>
                    <th className="py-3.5 px-4">Descripción de la Causa</th>
                    <th className="py-3.5 px-4">Detalle Manual</th>
                    <th className="py-3.5 px-4">Estado</th>
                    {puedeGestionarCausas && (
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {causasFiltradas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={puedeGestionarCausas ? 5 : 4}
                        className="py-10 text-center text-gray-400 italic"
                      >
                        {cargandoCausas
                          ? 'Cargando catálogo de causas...'
                          : 'No se encontraron causas con los filtros aplicados.'}
                      </td>
                    </tr>
                  ) : (
                    causasFiltradas.map((causa) => {
                      const infoAmbito = obtenerInfoAmbito(causa.ambito);
                      const ocupada = procesandoCausaId === causa.id;
                      return (
                        <tr
                          key={causa.id}
                          className="hover:bg-gray-50/80 transition-colors"
                        >
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-md border text-[10px] font-bold ${infoAmbito.badge}`}
                            >
                              {infoAmbito.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-gray-900">
                            {causa.descripcion}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {causa.requiereDetalleManual ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                                Requiere texto adicional
                              </span>
                            ) : (
                              <span className="text-gray-400">Opcional</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                causa.activo
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {causa.activo ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              <span>{causa.activo ? 'ACTIVA' : 'INACTIVA'}</span>
                            </span>
                          </td>
                          {puedeGestionarCausas && (
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={ocupada}
                                  onClick={() =>
                                    handleAlternarEstadoCausa(causa)
                                  }
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                    causa.activo
                                      ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                  <span>
                                    {causa.activo ? 'Desactivar' : 'Activar'}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => abrirModalEditarCausa(causa)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-[11px] font-semibold hover:bg-gray-50 transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-[#1E73BE]" />
                                  <span>Editar</span>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 3: ESCUELAS Y DEPARTAMENTOS (SOLO LECTURA)                   */}
      {/* ==================================================================== */}
      {pestana === 'academicos' && (
        <div className="space-y-6">
          {/* Escuelas Profesionales */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-[#1E73BE]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Escuelas Profesionales Activas
                  </h2>
                  <p className="text-xs text-gray-500">
                    Siglas documentales, grados académicos y departamento por
                    defecto
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#1E73BE] text-xs font-bold">
                {escuelas.length} escuelas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="py-3.5 px-4">Escuela Profesional</th>
                    <th className="py-3.5 px-4">Siglas</th>
                    <th className="py-3.5 px-4">Grado de Bachiller</th>
                    <th className="py-3.5 px-4">Título Profesional</th>
                    <th className="py-3.5 px-4">Departamento por Defecto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {escuelas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-gray-400 italic"
                      >
                        {cargandoAcademicos
                          ? 'Cargando escuelas profesionales...'
                          : 'No hay escuelas profesionales registradas.'}
                      </td>
                    </tr>
                  ) : (
                    escuelas.map((esc) => {
                      const depto = departamentosPorId.get(
                        esc.departamentoDefectoId,
                      );
                      return (
                        <tr
                          key={esc.id}
                          className="hover:bg-gray-50/80 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-semibold text-gray-900">
                            {esc.nombre}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1E73BE] border border-blue-200 font-mono font-bold text-[11px]">
                              {esc.siglasDocumento}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-600">
                            {esc.gradoBachiller}
                          </td>
                          <td className="py-3.5 px-4 text-gray-600">
                            {esc.tituloProfesional}
                          </td>
                          <td className="py-3.5 px-4 text-gray-700 font-medium">
                            {depto?.nombre ?? `ID #${esc.departamentoDefectoId}`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Departamentos Académicos */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Departamentos Académicos Activos
                  </h2>
                  <p className="text-xs text-gray-500">
                    Unidades académicas de adscripción docente
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                {departamentos.length} departamentos
              </span>
            </div>

            {departamentos.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400 italic">
                {cargandoAcademicos
                  ? 'Cargando departamentos académicos...'
                  : 'No hay departamentos académicos registrados.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {departamentos.map((depto) => {
                  const escuelasVinculadas = escuelas.filter(
                    (e) => e.departamentoDefectoId === depto.id,
                  ).length;
                  return (
                    <div
                      key={depto.id}
                      className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-gray-900">
                          {depto.nombre}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {escuelasVinculadas === 1
                            ? '1 escuela vinculada'
                            : `${escuelasVinculadas} escuelas vinculadas`}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ACTIVO</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL CREAR / EDITAR CAUSA                                           */}
      {/* ==================================================================== */}
      {modalCausaAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {causaEditar
                    ? `Editar Causa #${causaEditar.id}`
                    : 'Registrar Nueva Causa'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Catálogo normalizado para resoluciones complementarias y DSE
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalCausaAbierto(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleGuardarCausa}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Ámbito de Aplicación
                </label>
                <select
                  value={causaAmbito}
                  onChange={(e) =>
                    setCausaAmbito(e.target.value as AmbitoCausa)
                  }
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs bg-white font-semibold focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                >
                  {AMBITOS_CAUSA.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label} ({a.value})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Descripción Oficial (máx. 160 caracteres)
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={160}
                  value={causaDescripcion}
                  onChange={(e) => setCausaDescripcion(e.target.value)}
                  placeholder="Ej. Renuncia voluntaria del asesor debidamente fundamentada"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                />
                <span className="block text-right text-[10px] text-gray-400 mt-0.5">
                  {causaDescripcion.length}/160
                </span>
              </div>

              <label className="flex items-center gap-2.5 p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={causaRequiereManual}
                  onChange={(e) => setCausaRequiereManual(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>
                  Requiere detalle manual complementario al emitir resolución
                </span>
              </label>

              {causaEditar && (
                <label className="flex items-center gap-2.5 p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={causaActiva}
                    onChange={(e) => setCausaActiva(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>Causa activa y visible en selectores de emisión</span>
                </label>
              )}

              <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalCausaAbierto(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCausa}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E73BE] text-white font-semibold hover:bg-[#155A9C] shadow-sm transition-colors disabled:opacity-50"
                >
                  {guardandoCausa ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>
                      {causaEditar ? 'Guardar Cambios' : 'Registrar Causa'}
                    </span>
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
