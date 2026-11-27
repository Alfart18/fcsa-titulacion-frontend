// Archivo: app/dashboard/docentes/page.tsx
'use client';

import React, { useEffect, useMemo, useState, FormEvent } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Edit3,
  Filter,
  Layers,
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldCheck,
  X,
  Loader2,
  UserX,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch,
  ApiError,
  obtenerUsuarioSesion,
  UsuarioSesion,
} from '@/lib/api';
import { useSidebar } from '../sidebar-context';

type EstadoDocente = 'ACTIVO' | 'INACTIVO' | 'CESANTE';

interface DepartamentoItem {
  id: number;
  nombre: string;
  activo: boolean;
}

interface EscuelaItem {
  id: number;
  nombre: string;
  siglasDocumento: string;
  gradoBachiller: string;
  tituloProfesional: string;
  departamentoDefectoId: number;
  activa: boolean;
}

interface DocenteInfoResponse {
  id: string;
  gradoAcademico: string;
  estado: EstadoDocente;
  departamentoAcademico: { id: number; nombre: string };
  escuelaProfesional: { id: number; nombre: string; siglasDocumento: string };
}

interface PersonaDocenteItem {
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
  docente: DocenteInfoResponse | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedPersonasResponse {
  data: PersonaDocenteItem[];
  meta: PaginationMeta;
}

interface DocenteActivoSelectorItem {
  docenteId: string;
  personaId: string;
  nombreCompleto: string;
  gradoAcademico: string;
  correo: string | null;
  estado: EstadoDocente;
  departamentoAcademico: { id: number; nombre: string };
  escuelaProfesional: { id: number; nombre: string; siglasDocumento: string };
}

const GRADOS_ACADEMICOS = [
  'Dr.',
  'Dra.',
  'Mg.',
  'Mgt.',
  'Mtro.',
  'Mtra.',
  'Lic.',
  'Med.',
  'C.D.',
  'Obs.',
  'Ing.',
];

export default function DocentesCatalogoPage() {
  const { sidebarAbierto, toggleSidebar } = useSidebar();
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [modoVista, setModoVista] = useState<'CATALOGO' | 'EMBUDO'>('CATALOGO');

  // Catálogos base
  const [departamentos, setDepartamentos] = useState<DepartamentoItem[]>([]);
  const [escuelas, setEscuelas] = useState<EscuelaItem[]>([]);

  // Listado general de docentes (/personas?tipo=docente)
  const [personasDocentes, setPersonasDocentes] = useState<PersonaDocenteItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [paginaActual, setPaginaActual] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [deptoFiltro, setDeptoFiltro] = useState('');
  const [escuelaFiltro, setEscuelaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [cargando, setCargando] = useState(true);
  const [desactivandoId, setDesactivandoId] = useState<string | null>(null);

  // Estado del Simulador del Embudo de 3 Niveles (/personas/docentes/activos)
  const [escuelaEmbudoId, setEscuelaEmbudoId] = useState<number>(0);
  const [incluirOtrosDeptos, setIncluirOtrosDeptos] = useState(false);
  const [docentesActivos, setDocentesActivos] = useState<DocenteActivoSelectorItem[]>([]);
  const [cargandoEmbudo, setCargandoEmbudo] = useState(false);

  // Modal Crear / Editar Docente
  const [modalAbierto, setModalAbierto] = useState(false);
  const [personaEditar, setPersonaEditar] = useState<PersonaDocenteItem | null>(null);
  const [gradoForm, setGradoForm] = useState('Mg.');
  const [nombresForm, setNombresForm] = useState('');
  const [apellidoPaternoForm, setApellidoPaternoForm] = useState('');
  const [apellidoMaternoForm, setApellidoMaternoForm] = useState('');
  const [correoForm, setCorreoForm] = useState('');
  const [telefonoForm, setTelefonoForm] = useState('');
  const [deptoFormId, setDeptoFormId] = useState<number>(0);
  const [escuelaFormId, setEscuelaFormId] = useState<number>(0);
  const [estadoForm, setEstadoForm] = useState<EstadoDocente>('ACTIVO');
  const [guardando, setGuardando] = useState(false);

  const puedeCrearEditar =
    usuario?.rol === 'ADMIN' ||
    usuario?.rol === 'SECRETARIA_ACADEMICA' ||
    usuario?.rol === 'ADMINISTRATIVO';

  const puedeDesactivar =
    usuario?.rol === 'ADMIN' || usuario?.rol === 'SECRETARIA_ACADEMICA';

  const cargarCatalogos = async () => {
    try {
      const [deptosData, escuelasData] = await Promise.all([
        apiFetch<DepartamentoItem[]>('/catalogos/departamentos', {
          servicio: 'titulacion',
        }),
        apiFetch<EscuelaItem[]>('/catalogos/escuelas', {
          servicio: 'titulacion',
        }),
      ]);

      setDepartamentos(deptosData);
      setEscuelas(escuelasData);

      if (escuelasData.length > 0 && escuelaEmbudoId === 0) {
        setEscuelaEmbudoId(escuelasData[0].id);
      }
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  };

  const cargarDocentes = async (
    overrides?: { q?: string; page?: number },
  ) => {
    setCargando(true);
    try {
      const qVal = overrides?.q !== undefined ? overrides.q : busqueda;
      const pageVal =
        overrides?.page !== undefined ? overrides.page : paginaActual;

      const params = new URLSearchParams();
      params.set('tipo', 'docente');
      if (qVal.trim()) params.set('q', qVal.trim());
      params.set('page', String(pageVal));
      params.set('limit', '50');

      const resp = await apiFetch<PaginatedPersonasResponse>(
        `/personas?${params.toString()}`,
        { servicio: 'titulacion' },
      );

      setPersonasDocentes(resp.data);
      setMeta(resp.meta);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargando(false);
    }
  };

  const cargarDocentesActivosEmbudo = async () => {
    setCargandoEmbudo(true);
    try {
      const data = await apiFetch<DocenteActivoSelectorItem[]>(
        '/personas/docentes/activos',
        { servicio: 'titulacion' },
      );
      setDocentesActivos(data);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargandoEmbudo(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setUsuario(obtenerUsuarioSesion());
      void cargarCatalogos();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void cargarDocentes();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaActual]);

  useEffect(() => {
    if (modoVista === 'EMBUDO') {
      const timer = setTimeout(() => {
        void cargarDocentesActivosEmbudo();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [modoVista]);

  // Filtrado en cliente por departamento, escuela y estado (ListarPersonasDto solo acepta tipo, q, page, limit)
  const docentesFiltrados = useMemo(() => {
    return personasDocentes.filter((p) => {
      if (!p.docente) return false;
      if (
        deptoFiltro &&
        p.docente.departamentoAcademico.id !== Number(deptoFiltro)
      ) {
        return false;
      }
      if (
        escuelaFiltro &&
        p.docente.escuelaProfesional.id !== Number(escuelaFiltro)
      ) {
        return false;
      }
      if (estadoFiltro && p.docente.estado !== estadoFiltro) {
        return false;
      }
      return true;
    });
  }, [personasDocentes, deptoFiltro, escuelaFiltro, estadoFiltro]);

  // Clasificación en 3 niveles para el Embudo usando EscuelaCatalogo.departamentoDefectoId
  const escuelaEmbudoObj = useMemo(
    () => escuelas.find((e) => e.id === Number(escuelaEmbudoId)) || null,
    [escuelas, escuelaEmbudoId],
  );

  const nivelesEmbudo = useMemo(() => {
    if (!escuelaEmbudoObj) {
      return { nivel1: [], nivel2: [], nivel3: [] };
    }
    const nivel1 = docentesActivos.filter(
      (d) => d.escuelaProfesional.id === escuelaEmbudoObj.id,
    );
    const nivel2 = docentesActivos.filter(
      (d) =>
        d.escuelaProfesional.id !== escuelaEmbudoObj.id &&
        d.departamentoAcademico.id === escuelaEmbudoObj.departamentoDefectoId,
    );
    const nivel3 = incluirOtrosDeptos
      ? docentesActivos.filter(
          (d) =>
            d.departamentoAcademico.id !==
            escuelaEmbudoObj.departamentoDefectoId,
        )
      : [];
    return { nivel1, nivel2, nivel3 };
  }, [docentesActivos, escuelaEmbudoObj, incluirOtrosDeptos]);

  const abrirModalCrear = () => {
    setPersonaEditar(null);
    setGradoForm(GRADOS_ACADEMICOS[2] || 'Mg.');
    setNombresForm('');
    setApellidoPaternoForm('');
    setApellidoMaternoForm('');
    setCorreoForm('');
    setTelefonoForm('');
    const primeraEsc = escuelas[0];
    setEscuelaFormId(primeraEsc?.id || 0);
    setDeptoFormId(
      primeraEsc?.departamentoDefectoId || departamentos[0]?.id || 0,
    );
    setEstadoForm('ACTIVO');
    setModalAbierto(true);
  };

  const abrirModalEditar = (persona: PersonaDocenteItem) => {
    if (!persona.docente) return;
    setPersonaEditar(persona);
    setGradoForm(persona.docente.gradoAcademico);
    setNombresForm(persona.nombres);
    setApellidoPaternoForm(persona.apellidoPaterno);
    setApellidoMaternoForm(persona.apellidoMaterno);
    setCorreoForm(persona.correo || '');
    setTelefonoForm(persona.telefono || '');
    setDeptoFormId(persona.docente.departamentoAcademico.id);
    setEscuelaFormId(persona.docente.escuelaProfesional.id);
    setEstadoForm(persona.docente.estado);
    setModalAbierto(true);
  };

  const handleCambioEscuelaForm = (nuevaEscuelaId: number) => {
    setEscuelaFormId(nuevaEscuelaId);
    const escObj = escuelas.find((e) => e.id === nuevaEscuelaId);
    if (escObj) {
      setDeptoFormId(escObj.departamentoDefectoId);
    }
  };

  const handleGuardarDocente = async (e: FormEvent) => {
    e.preventDefault();
    if (!deptoFormId || !escuelaFormId) {
      toast.error('Seleccione Escuela Profesional y Departamento Académico.');
      return;
    }

    setGuardando(true);
    try {
      if (!personaEditar) {
        const creado = await apiFetch<PersonaDocenteItem>('/personas/docentes', {
          servicio: 'titulacion',
          method: 'POST',
          body: JSON.stringify({
            nombres: nombresForm.trim(),
            apellidoPaterno: apellidoPaternoForm.trim(),
            apellidoMaterno: apellidoMaternoForm.trim(),
            correo: correoForm.trim().toLowerCase(),
            ...(telefonoForm.trim() ? { telefono: telefonoForm.trim() } : {}),
            gradoAcademico: gradoForm.trim(),
            departamentoAcademicoId: Number(deptoFormId),
            escuelaProfesionalId: Number(escuelaFormId),
          }),
        });
        toast.success(
          `Docente registrado: ${creado.docente?.gradoAcademico || ''} ${creado.nombreCompleto}`,
        );
      } else {
        const gradoPrevio = personaEditar.docente?.gradoAcademico;
        const actualizado = await apiFetch<PersonaDocenteItem>(
          `/personas/${personaEditar.id}`,
          {
            servicio: 'titulacion',
            method: 'PATCH',
            body: JSON.stringify({
              nombres: nombresForm.trim(),
              apellidoPaterno: apellidoPaternoForm.trim(),
              apellidoMaterno: apellidoMaternoForm.trim(),
              correo: correoForm.trim().toLowerCase(),
              telefono: telefonoForm.trim(),
              gradoAcademico: gradoForm.trim(),
              departamentoAcademicoId: Number(deptoFormId),
              escuelaProfesionalId: Number(escuelaFormId),
              estadoDocente: estadoForm,
            }),
          },
        );
        const gradoNuevo = actualizado.docente?.gradoAcademico;
        toast.success(
          `Ficha actualizada: ${gradoNuevo || ''} ${actualizado.nombreCompleto}`,
          {
            description:
              gradoPrevio && gradoNuevo && gradoPrevio !== gradoNuevo
                ? `Cambio de grado (${gradoPrevio} → ${gradoNuevo}). Las resoluciones pasadas conservan su snapshot original.`
                : 'Cambios guardados correctamente.',
          },
        );
      }

      setModalAbierto(false);
      await cargarDocentes();
      if (modoVista === 'EMBUDO') {
        await cargarDocentesActivosEmbudo();
      }
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudo guardar los datos del docente.');
    } finally {
      setGuardando(false);
    }
  };

  const handleDesactivarDocente = async (persona: PersonaDocenteItem) => {
    if (!persona.docente) return;
    setDesactivandoId(persona.docente.id);
    try {
      await apiFetch<PersonaDocenteItem>(
        `/personas/docentes/${persona.docente.id}/desactivar`,
        {
          servicio: 'titulacion',
          method: 'PATCH',
        },
      );
      toast.success(
        `Docente ${persona.docente.gradoAcademico} ${persona.nombreCompleto} pasado a estado INACTIVO.`,
      );
      await cargarDocentes();
      if (modoVista === 'EMBUDO') {
        await cargarDocentesActivosEmbudo();
      }
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudo desactivar al docente.');
    } finally {
      setDesactivandoId(null);
    }
  };

  const opcionesGrado = useMemo(() => {
    if (gradoForm && !GRADOS_ACADEMICOS.includes(gradoForm)) {
      return [gradoForm, ...GRADOS_ACADEMICOS];
    }
    return GRADOS_ACADEMICOS;
  }, [gradoForm]);

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
          <span className="font-medium text-gray-800">Catálogo de Docentes</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Catálogo Académico de Docentes FCSa — UAC
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1 max-w-3xl">
              Departamentos Académicos, Escuelas Profesionales y registro de docentes activos de la Facultad.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 text-xs shadow-sm">
              <button
                type="button"
                onClick={() => setModoVista('CATALOGO')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  modoVista === 'CATALOGO'
                    ? 'bg-[#1E73BE] text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Catálogo General ({docentesFiltrados.length})
              </button>
              <button
                type="button"
                onClick={() => setModoVista('EMBUDO')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                  modoVista === 'EMBUDO'
                    ? 'bg-[#1E73BE] text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Por Escuela</span>
              </button>
            </div>

            {puedeCrearEditar ? (
              <button
                type="button"
                onClick={abrirModalCrear}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E73BE] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#175B96] transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Docente</span>
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-gray-100 border border-gray-200 text-[11px] font-semibold text-gray-600">
                Modo Lectura
              </span>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODO 1: CATÁLOGO GENERAL Y GESTIÓN DE ASCENSOS DE GRADO             */}
      {/* =================================================================== */}
      {modoVista === 'CATALOGO' && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (paginaActual !== 1) {
                setPaginaActual(1);
              } else {
                void cargarDocentes({ page: 1 });
              }
            }}
            className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Buscar por Nombre o Correo Institucional
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Ej. Ángela Caballero, eperez@uandina..."
                  className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Departamento Académico ({departamentos.length})
              </label>
              <select
                value={deptoFiltro}
                onChange={(e) => setDeptoFiltro(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs bg-white"
              >
                <option value="">Todos los Departamentos</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre.replace('Departamento Académico de ', '')}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">
                Escuela Profesional Principal ({escuelas.length})
              </label>
              <select
                value={escuelaFiltro}
                onChange={(e) => setEscuelaFiltro(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs bg-white"
              >
                <option value="">Todas las Escuelas</option>
                {escuelas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre.replace('Escuela Profesional de ', '')}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex gap-2">
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-2.5 py-2 text-xs bg-white"
              >
                <option value="">Estado: Todos</option>
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
                <option value="CESANTE">CESANTE</option>
              </select>
              <button
                type="submit"
                className="p-2 rounded-lg bg-[#1E73BE] text-white hover:bg-[#175B96]"
                title="Filtrar"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="py-3.5 px-4">Nombre Oficial para Resolución</th>
                    <th className="py-3.5 px-4">Correo / Teléfono</th>
                    <th className="py-3.5 px-4">Departamento Académico</th>
                    <th className="py-3.5 px-4">Escuela Principal</th>
                    <th className="py-3.5 px-4">Estado</th>
                    {puedeCrearEditar && (
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {docentesFiltrados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={puedeCrearEditar ? 6 : 5}
                        className="py-10 text-center text-gray-400 italic"
                      >
                        {cargando
                          ? 'Cargando catálogo de docentes...'
                          : 'No se encontraron docentes registrados.'}
                      </td>
                    </tr>
                  ) : (
                    docentesFiltrados.map((persona) => {
                      const doc = persona.docente!;
                      return (
                        <tr
                          key={persona.id}
                          className="hover:bg-gray-50/80 transition"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1E73BE] font-mono font-bold text-[11px]">
                                {doc.gradoAcademico}
                              </span>
                              <span className="font-bold text-gray-900">
                                {persona.nombreCompleto}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-gray-600 block">
                              {persona.correo || '—'}
                            </span>
                            {persona.telefono && (
                              <span className="text-[10px] text-gray-400">
                                Tel: {persona.telefono}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-gray-700">
                            {doc.departamentoAcademico.nombre.replace(
                              'Departamento Académico de ',
                              '',
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-[#1E73BE]">
                            {doc.escuelaProfesional.nombre.replace(
                              'Escuela Profesional de ',
                              '',
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                doc.estado === 'ACTIVO'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : doc.estado === 'CESANTE'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {doc.estado === 'ACTIVO' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              <span>{doc.estado}</span>
                            </span>
                          </td>
                          {puedeCrearEditar && (
                            <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => abrirModalEditar(persona)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#1E73BE]" />
                                <span>Editar</span>
                              </button>
                              {puedeDesactivar && doc.estado === 'ACTIVO' && (
                                <button
                                  type="button"
                                  disabled={desactivandoId === doc.id}
                                  onClick={() =>
                                    handleDesactivarDocente(persona)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 font-semibold hover:bg-rose-100 disabled:opacity-50"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Desactivar</span>
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-600 bg-gray-50/50">
                <span>
                  Página <b>{meta.page}</b> de <b>{meta.totalPages}</b> — Total:{' '}
                  <b>{meta.total}</b> docentes
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
        </>
      )}

      {/* =================================================================== */}
      {/* MODO 2: DOCENTES POR ESCUELA + OTROS DOCENTES                       */}
      {/* =================================================================== */}
      {modoVista === 'EMBUDO' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#1E73BE]">
                <Sparkles className="w-4 h-4" />
                <h3 className="text-sm font-bold">
                  Docentes Activos por Escuela Profesional
                </h3>
              </div>
              <p className="text-xs text-gray-500">
                Muestra primero a los docentes de la escuela seleccionada, con la opción de desplegar a otros docentes de la facultad.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                  Escuela Profesional:
                </label>
                <select
                  value={escuelaEmbudoId}
                  onChange={(e) => setEscuelaEmbudoId(Number(e.target.value))}
                  className="rounded-lg border border-gray-300 px-3 py-2 font-bold text-[#1E73BE] bg-blue-50/50"
                >
                  {escuelas.map((esc) => (
                    <option key={esc.id} value={esc.id}>
                      {esc.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {cargandoEmbudo ? (
            <div className="py-10 text-center text-xs text-gray-400">
              Cargando docentes activos...
            </div>
          ) : (
            <div className="space-y-4">
              {/* DOCENTES DE LA ESCUELA SELECCIONADA */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-900">
                    Docentes de {escuelaEmbudoObj?.nombre || 'la escuela seleccionada'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-mono text-[11px] font-bold">
                    {nivelesEmbudo.nivel1.length}
                  </span>
                </div>
                {nivelesEmbudo.nivel1.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">
                    No hay docentes activos registrados directamente en esta escuela.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {nivelesEmbudo.nivel1.map((d) => (
                      <div
                        key={d.docenteId}
                        className="p-3 rounded-lg bg-white border border-emerald-200 shadow-2xs text-xs"
                      >
                        <p className="font-bold text-gray-900">
                          {d.gradoAcademico} {d.nombreCompleto}
                        </p>
                        <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                          {d.escuelaProfesional.nombre}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {d.departamentoAcademico.nombre}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* BOTÓN OTROS DOCENTES */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setIncluirOtrosDeptos((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-[#1E73BE] hover:bg-blue-50 hover:border-blue-200 transition-colors"
                >
                  <span>
                    {incluirOtrosDeptos
                      ? 'Ocultar otros docentes de la Facultad'
                      : `Otros docentes de la Facultad (${docentesActivos.length - nivelesEmbudo.nivel1.length})`}
                  </span>
                </button>

                {incluirOtrosDeptos && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#1E73BE]">
                        Otros docentes de la Facultad
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#1E73BE] font-mono text-[11px] font-bold">
                        {nivelesEmbudo.nivel2.length + nivelesEmbudo.nivel3.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[...nivelesEmbudo.nivel2, ...nivelesEmbudo.nivel3].map((d) => (
                        <div
                          key={d.docenteId}
                          className="p-3 rounded-lg bg-white border border-blue-200 shadow-2xs text-xs"
                        >
                          <p className="font-bold text-gray-900">
                            {d.gradoAcademico} {d.nombreCompleto}
                          </p>
                          <p className="text-[11px] text-[#1E73BE] font-semibold mt-0.5">
                            {d.escuelaProfesional.nombre}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {d.departamentoAcademico.nombre}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL CREAR / EDITAR DOCENTE                                        */}
      {/* =================================================================== */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden my-6">
            <div className="bg-[#1E73BE] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  {personaEditar
                    ? 'Editar Ficha de Docente / Ascenso de Grado'
                    : 'Registrar Nuevo Docente en el Catálogo FCSa'}
                </h3>
                <p className="text-[11px] text-blue-200">
                  Registro integrado en el catálogo de Personas y Docentes
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
              onSubmit={handleGuardarDocente}
              className="p-6 space-y-4 text-xs max-h-[82vh] overflow-y-auto"
            >
              {personaEditar && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2.5 text-[11px] text-[#1E73BE]">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <b>Garantía de Inmutabilidad Histórica:</b> Si actualiza el grado académico (ej. de <b>Mg.</b> a <b>Dr.</b>), el nuevo grado se aplicará a las resoluciones futuras sin alterar los PDFs ni snapshots emitidos en el pasado.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Grado Académico *
                  </label>
                  <select
                    value={gradoForm}
                    onChange={(e) => setGradoForm(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs font-bold text-[#1E73BE] bg-white"
                  >
                    {opcionesGrado.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Nombres *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={nombresForm}
                    onChange={(e) => setNombresForm(e.target.value)}
                    placeholder="Ej. ÁNGELA LUZ"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Apellido Paterno *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={apellidoPaternoForm}
                    onChange={(e) => setApellidoPaternoForm(e.target.value)}
                    placeholder="Ej. CABALLERO"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs uppercase"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Apellido Materno *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={apellidoMaternoForm}
                    onChange={(e) => setApellidoMaternoForm(e.target.value)}
                    placeholder="Ej. NÚÑEZ"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Correo Institucional *
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={150}
                    value={correoForm}
                    onChange={(e) => setCorreoForm(e.target.value)}
                    placeholder="docente@uandina.edu.pe"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs font-mono lowercase"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={telefonoForm}
                    onChange={(e) => setTelefonoForm(e.target.value)}
                    placeholder="984123456"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">
                  Escuela Profesional Principal
                </label>
                <select
                  value={escuelaFormId}
                  onChange={(e) =>
                    handleCambioEscuelaForm(Number(e.target.value))
                  }
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-xs bg-white"
                >
                  {escuelas.map((esc) => (
                    <option key={esc.id} value={esc.id}>
                      {esc.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">
                  Departamento Académico de Adscripción
                </label>
                <select
                  value={deptoFormId}
                  onChange={(e) => setDeptoFormId(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-xs bg-white"
                >
                  {departamentos.map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {personaEditar && (
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Estado del Docente
                  </label>
                  <select
                    value={estadoForm}
                    onChange={(e) =>
                      setEstadoForm(e.target.value as EstadoDocente)
                    }
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs bg-white"
                  >
                    <option value="ACTIVO">
                      ACTIVO (Elegible para nuevas resoluciones)
                    </option>
                    <option value="INACTIVO">
                      INACTIVO (No elegible en nuevos trámites, conserva historial)
                    </option>
                    <option value="CESANTE">
                      CESANTE (Baja por cese laboral)
                    </option>
                  </select>
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
                  disabled={guardando}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1E73BE] text-white font-semibold hover:bg-[#175B96] disabled:opacity-60"
                >
                  {guardando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>
                      {personaEditar ? 'Guardar Cambios' : 'Registrar Docente'}
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
