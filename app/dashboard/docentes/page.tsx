// Archivo: app/dashboard/docentes/page.tsx
'use client';

import React, { useEffect, useState, FormEvent } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch,
  ApiError,
  obtenerUsuarioSesion,
  UsuarioSesion,
} from '@/lib/api';

interface DepartamentoItem {
  id: number;
  nombre: string;
}

interface EscuelaItem {
  id: number;
  nombre: string;
  gradoBachiller: string;
  tituloProfesional: string;
  departamentoDefecto: { id: number; nombre: string };
}

interface CatalogosAcademicosResponse {
  departamentos: DepartamentoItem[];
  escuelas: EscuelaItem[];
  gradosDocentePermitidos: string[];
}

interface DocenteItem {
  id: string;
  gradoAcademico: string;
  nombresCompletos: string;
  nombreParaResolucion: string;
  correo: string;
  departamentoAcademicoId: number;
  escuelaProfesionalId: number;
  estado: 'ACTIVO' | 'INACTIVO';
  departamentoAcademico: { id: number; nombre: string };
  escuelaProfesional: { id: number; nombre: string };
}

interface DocenteElegibleEmbudo {
  id: string;
  gradoAcademico: string;
  nombresCompletos: string;
  nombreParaResolucion: string;
  correo: string;
  departamentoAcademico: { id: number; nombre: string };
  escuelaProfesional: { id: number; nombre: string };
  nivelPrioridad: 1 | 2 | 3;
  categoriaEmbudo: string;
  advertenciaInterdisciplinaria: string | null;
}

export default function DocentesCatalogoPage() {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [modoVista, setModoVista] = useState<'CATALOGO' | 'EMBUDO'>('CATALOGO');

  // Catálogos base
  const [departamentos, setDepartamentos] = useState<DepartamentoItem[]>([]);
  const [escuelas, setEscuelas] = useState<EscuelaItem[]>([]);
  const [gradosPermitidos, setGradosPermitidos] = useState<string[]>([]);

  // Listado general de docentes
  const [docentes, setDocentes] = useState<DocenteItem[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [deptoFiltro, setDeptoFiltro] = useState('');
  const [escuelaFiltro, setEscuelaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [cargando, setCargando] = useState(true);

  // Estado del Simulador del Embudo de 3 Niveles
  const [escuelaEmbudoId, setEscuelaEmbudoId] = useState<number>(2); // Por defecto 2 = Tecnología Médica
  const [incluirOtrosDeptos, setIncluirOtrosDeptos] = useState(true);
  const [resultadosEmbudo, setResultadosEmbudo] = useState<DocenteElegibleEmbudo[]>([]);
  const [cargandoEmbudo, setCargandoEmbudo] = useState(false);

  // Modal Crear / Editar Docente (Ascenso de Grado)
  const [modalAbierto, setModalAbierto] = useState(false);
  const [docenteEditar, setDocenteEditar] = useState<DocenteItem | null>(null);
  const [gradoForm, setGradoForm] = useState('Mg.');
  const [nombresForm, setNombresForm] = useState('');
  const [correoForm, setCorreoForm] = useState('');
  const [deptoFormId, setDeptoFormId] = useState<number>(1);
  const [escuelaFormId, setEscuelaFormId] = useState<number>(1);
  const [estadoForm, setEstadoForm] = useState<'ACTIVO' | 'INACTIVO'>('ACTIVO');
  const [guardando, setGuardando] = useState(false);

  const puedeEditarCatalogo =
    usuario?.rol === 'DECANO' || usuario?.rol === 'SECRETARIA_ACADEMICA';

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (busqueda.trim()) params.set('q', busqueda.trim());
      if (deptoFiltro) params.set('departamentoId', deptoFiltro);
      if (escuelaFiltro) params.set('escuelaId', escuelaFiltro);
      if (estadoFiltro) params.set('estado', estadoFiltro);

      const [catData, docData] = await Promise.all([
        apiFetch<CatalogosAcademicosResponse>('/catalogos/academicos', {
          servicio: 'titulacion',
        }),
        apiFetch<DocenteItem[]>(
          `/docentes${params.toString() ? `?${params.toString()}` : ''}`,
          { servicio: 'titulacion' },
        ),
      ]);

      setDepartamentos(catData.departamentos);
      setEscuelas(catData.escuelas);
      setGradosPermitidos(catData.gradosDocentePermitidos);
      setDocentes(docData);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargando(false);
    }
  };

  const ejecutarSimulacionEmbudo = async (
    escId = escuelaEmbudoId,
    interdisciplinario = incluirOtrosDeptos,
  ) => {
    setCargandoEmbudo(true);
    try {
      const data = await apiFetch<DocenteElegibleEmbudo[]>(
        `/docentes/elegibles?escuelaId=${escId}&incluirOtrosDepartamentos=${interdisciplinario}`,
        { servicio: 'titulacion' },
      );
      setResultadosEmbudo(data);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargandoEmbudo(false);
    }
  };

    useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsuario(obtenerUsuarioSesion());
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptoFiltro, escuelaFiltro, estadoFiltro]);

  useEffect(() => {
    if (modoVista === 'EMBUDO') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      ejecutarSimulacionEmbudo(escuelaEmbudoId, incluirOtrosDeptos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoVista, escuelaEmbudoId, incluirOtrosDeptos]);

  const abrirModalCrear = () => {
    setDocenteEditar(null);
    setGradoForm(gradosPermitidos[0] || 'Mg.');
    setNombresForm('');
    setCorreoForm('');
    const primerDepto = departamentos[0]?.id || 1;
    const primeraEsc = escuelas[0]?.id || 1;
    setDeptoFormId(primerDepto);
    setEscuelaFormId(primeraEsc);
    setEstadoForm('ACTIVO');
    setModalAbierto(true);
  };

  const abrirModalEditar = (doc: DocenteItem) => {
    setDocenteEditar(doc);
    setGradoForm(doc.gradoAcademico);
    setNombresForm(doc.nombresCompletos);
    setCorreoForm(doc.correo);
    setDeptoFormId(doc.departamentoAcademicoId);
    setEscuelaFormId(doc.escuelaProfesionalId);
    setEstadoForm(doc.estado);
    setModalAbierto(true);
  };

  // Sincronizar automáticamente el Departamento por defecto al elegir una Escuela en el formulario
  const handleCambioEscuelaForm = (nuevaEscuelaId: number) => {
    setEscuelaFormId(nuevaEscuelaId);
    const escObj = escuelas.find((e) => e.id === nuevaEscuelaId);
    if (escObj) {
      setDeptoFormId(escObj.departamentoDefecto.id);
    }
  };

  const handleGuardarDocente = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);

    try {
      if (!docenteEditar) {
        const creado = await apiFetch<DocenteItem>('/docentes', {
          servicio: 'titulacion',
          method: 'POST',
          body: JSON.stringify({
            gradoAcademico: gradoForm,
            nombresCompletos: nombresForm.trim(),
            correo: correoForm.trim(),
            departamentoAcademicoId: Number(deptoFormId),
            escuelaProfesionalId: Number(escuelaFormId),
          }),
        });
        toast.success(`Docente registrado: ${creado.nombreParaResolucion}`);
      } else {
        const actualizado = await apiFetch<DocenteItem>(
          `/docentes/${docenteEditar.id}`,
          {
            servicio: 'titulacion',
            method: 'PATCH',
            body: JSON.stringify({
              gradoAcademico: gradoForm,
              nombresCompletos: nombresForm.trim(),
              correo: correoForm.trim(),
              departamentoAcademicoId: Number(deptoFormId),
              escuelaProfesionalId: Number(escuelaFormId),
              estado: estadoForm,
            }),
          },
        );
        toast.success(
          `Ficha actualizada: ${actualizado.nombreParaResolucion}`,
          {
            description:
              docenteEditar.gradoAcademico !== actualizado.gradoAcademico
                ? `Ascenso de grado (${docenteEditar.gradoAcademico} → ${actualizado.gradoAcademico}) auditado. Las resoluciones pasadas conservan su snapshot original.`
                : 'Cambios guardados y registrados en auditoría.',
          },
        );
      }

      setModalAbierto(false);
      await cargarDatos();
      if (modoVista === 'EMBUDO') {
        await ejecutarSimulacionEmbudo();
      }
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera y Selector de Modo */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Catálogo Académico de Docentes FCSa — UAC
          </h2>
          <p className="text-xs text-gray-500">
            4 Departamentos Académicos, 6 Escuelas Profesionales, ascensos de grado con inmutabilidad histórica y Embudo de 3 Niveles
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1 text-xs">
            <button
              type="button"
              onClick={() => setModoVista('CATALOGO')}
              className={`px-3 py-1.5 rounded-md font-bold transition ${
                modoVista === 'CATALOGO'
                  ? 'bg-[#0B2B5A] text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Catálogo General ({docentes.length})
            </button>
            <button
              type="button"
              onClick={() => setModoVista('EMBUDO')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition ${
                modoVista === 'EMBUDO'
                  ? 'bg-[#0B2B5A] text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Probar Embudo de 3 Niveles</span>
            </button>
          </div>

          {puedeEditarCatalogo ? (
            <button
              type="button"
              onClick={abrirModalCrear}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2B5A] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#082044] transition"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Docente</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-[11px] font-semibold text-gray-600">
              Modo Lectura (Edición exclusiva para Decano y Secretaría Académica)
            </span>
          )}
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
              cargarDatos();
            }}
            className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
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
                Departamento Académico (4)
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
                Escuela Profesional Principal (6)
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
              </select>
              <button
                type="submit"
                className="p-2 rounded-lg bg-[#0B2B5A] text-white hover:bg-[#082044]"
                title="Filtrar"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                    <th className="py-3.5 px-4">Nombre Oficial para Resolución</th>
                    <th className="py-3.5 px-4">Correo (@uandina.edu.pe)</th>
                    <th className="py-3.5 px-4">Departamento Académico</th>
                    <th className="py-3.5 px-4">Escuela Principal</th>
                    <th className="py-3.5 px-4">Estado</th>
                    {puedeEditarCatalogo && (
                      <th className="py-3.5 px-4 text-right">Acción</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {docentes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-gray-400 italic"
                      >
                        {cargando
                          ? 'Cargando catálogo de docentes...'
                          : 'No se encontraron docentes registrados.'}
                      </td>
                    </tr>
                  ) : (
                    docentes.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0B2B5A] font-mono font-bold text-[11px]">
                              {doc.gradoAcademico}
                            </span>
                            <span className="font-bold text-gray-900">
                              {doc.nombresCompletos}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-gray-600">
                          {doc.correo}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700">
                          {doc.departamentoAcademico.nombre.replace(
                            'Departamento Académico de ',
                            '',
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[#0B2B5A]">
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
                        {puedeEditarCatalogo && (
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => abrirModalEditar(doc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#0B2B5A]" />
                              <span>Editar / Ascenso</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* MODO 2: DEMOSTRADOR DEL EMBUDO DE 3 NIVELES (CASO TECNOLOGÍA MÉDICA)*/}
      {/* =================================================================== */}
      {modoVista === 'EMBUDO' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#0B2B5A]">
                <Sparkles className="w-4 h-4" />
                <h3 className="text-sm font-bold">
                  Simulador del Algoritmo de Embudo en 3 Niveles (Endpoint /docentes/elegibles)
                </h3>
              </div>
              <p className="text-xs text-gray-500">
                Verifica cómo el sistema prioriza a los docentes de la propia Escuela Profesional (ej. Tecnología Médica), luego del mismo Departamento Académico (Medicina Humana) y finalmente al resto de la Facultad.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                  Escuela del Expediente:
                </label>
                <select
                  value={escuelaEmbudoId}
                  onChange={(e) => setEscuelaEmbudoId(Number(e.target.value))}
                  className="rounded-lg border border-gray-300 px-3 py-2 font-bold text-[#0B2B5A] bg-blue-50/50"
                >
                  {escuelas.map((esc) => (
                    <option key={esc.id} value={esc.id}>
                      {esc.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 pt-4 cursor-pointer font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={incluirOtrosDeptos}
                  onChange={(e) => setIncluirOtrosDeptos(e.target.checked)}
                  className="rounded"
                />
                <span>Habilitar Nivel 3 (Investigación Interdisciplinaria)</span>
              </label>
            </div>
          </div>

          {cargandoEmbudo ? (
            <div className="py-10 text-center text-xs text-gray-400">
              Calculando priorización en 3 niveles...
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* NIVEL 1: MISMA ESCUELA */}
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-900">
                    ★ NIVEL 1: Misma Escuela Profesional
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-mono text-[11px] font-bold">
                    {resultadosEmbudo.filter((d) => d.nivelPrioridad === 1).length}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Prioridad máxima: Docentes adscritos directamente a la Escuela del tesista.
                </p>
                <div className="space-y-2">
                  {resultadosEmbudo
                    .filter((d) => d.nivelPrioridad === 1)
                    .map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-lg bg-white border border-emerald-200 shadow-2xs text-xs"
                      >
                        <p className="font-bold text-gray-900">
                          {d.nombreParaResolucion}
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
              </div>

              {/* NIVEL 2: MISMO DEPARTAMENTO ACADÉMICO */}
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#0B2B5A]">
                    ● NIVEL 2: Mismo Departamento
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-200 text-[#0B2B5A] font-mono text-[11px] font-bold">
                    {resultadosEmbudo.filter((d) => d.nivelPrioridad === 2).length}
                  </span>
                </div>
                <p className="text-[11px] text-blue-900">
                  Docentes que comparten el mismo Departamento Académico (ej. Medicina Humana con Tecnología Médica, u Obstetricia con Enfermería).
                </p>
                <div className="space-y-2">
                  {resultadosEmbudo
                    .filter((d) => d.nivelPrioridad === 2)
                    .map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-lg bg-white border border-blue-200 shadow-2xs text-xs"
                      >
                        <p className="font-bold text-gray-900">
                          {d.nombreParaResolucion}
                        </p>
                        <p className="text-[11px] text-[#0B2B5A] font-semibold mt-0.5">
                          {d.escuelaProfesional.nombre}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {d.departamentoAcademico.nombre}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              {/* NIVEL 3: OTROS DEPARTAMENTOS (INTERDISCIPLINARIO) */}
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-900">
                    ◆ NIVEL 3: Otros Departamentos
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-mono text-[11px] font-bold">
                    {resultadosEmbudo.filter((d) => d.nivelPrioridad === 3).length}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Habilitados para investigaciones interdisciplinarias sin bloquear al operador.
                </p>
                <div className="space-y-2">
                  {resultadosEmbudo
                    .filter((d) => d.nivelPrioridad === 3)
                    .map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-lg bg-white border border-amber-200 shadow-2xs text-xs"
                      >
                        <p className="font-bold text-gray-900">
                          {d.nombreParaResolucion}
                        </p>
                        <p className="text-[11px] text-amber-800 font-semibold mt-0.5">
                          {d.departamentoAcademico.nombre}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL CREAR / EDITAR DOCENTE (CON AVISO DE INMUTABILIDAD SNAPSHOT)  */}
      {/* =================================================================== */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="bg-[#0B2B5A] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  {docenteEditar
                    ? 'Editar Ficha de Docente / Ascenso de Grado'
                    : 'Registrar Nuevo Docente en el Catálogo FCSa'}
                </h3>
                <p className="text-[11px] text-blue-200">
                  Normalización automática a MAYÚSCULAS conservando tildes y letra Ñ
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

            <form onSubmit={handleGuardarDocente} className="p-6 space-y-4 text-xs">
              {docenteEditar && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2.5 text-[11px] text-[#0B2B5A]">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <b>Garantía de Inmutabilidad Histórica:</b> Si actualiza el grado académico (ej. de <b>Mg.</b> a <b>Dr.</b>), el nuevo grado se aplicará a las resoluciones futuras sin alterar los PDFs ni snapshots emitidos en el pasado.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Grado Controlado
                  </label>
                  <select
                    value={gradoForm}
                    onChange={(e) => setGradoForm(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs font-bold text-[#0B2B5A] bg-white"
                  >
                    {gradosPermitidos.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Nombres y Apellidos Completos
                  </label>
                  <input
                    type="text"
                    required
                    value={nombresForm}
                    onChange={(e) => setNombresForm(e.target.value)}
                    placeholder="Ej. ÁNGELA LUZ CABALLERO NÚÑEZ"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">
                  Correo Institucional (@uandina.edu.pe — Único)
                </label>
                <input
                  type="email"
                  required
                  value={correoForm}
                  onChange={(e) => setCorreoForm(e.target.value)}
                  placeholder="docente@uandina.edu.pe"
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-xs font-mono lowercase"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1">
                  Escuela Profesional Principal (Relación 1:N)
                </label>
                <select
                  value={escuelaFormId}
                  onChange={(e) => handleCambioEscuelaForm(Number(e.target.value))}
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
                  Departamento Académico de Adscripción (4 Oficiales)
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

              {docenteEditar && (
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Estado en el Catálogo
                  </label>
                  <select
                    value={estadoForm}
                    onChange={(e) =>
                      setEstadoForm(e.target.value as 'ACTIVO' | 'INACTIVO')
                    }
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs bg-white"
                  >
                    <option value="ACTIVO">
                      ACTIVO (Elegible para nuevas resoluciones)
                    </option>
                    <option value="INACTIVO">
                      INACTIVO (No elegible en nuevos trámites, conserva historial)
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
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#0B2B5A] text-white font-semibold hover:bg-[#082044] disabled:opacity-50"
                >
                  {guardando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar en Catálogo</span>
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