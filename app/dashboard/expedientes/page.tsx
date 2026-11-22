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
  AlertTriangle,
  CheckCircle2,
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

interface DocenteActivoItem {
  docenteId: string;
  nombreCompleto: string;
  gradoAcademico: string;
  escuelaProfesional: { id: number; nombre: string };
}

interface PersonaEstudianteMatch {
  id: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  codigoUniversitario: string | null;
  telefono: string | null;
}

interface PaginatedPersonasResponse {
  data: PersonaEstudianteMatch[];
}

interface ExpedienteDuplicadoInfo {
  codigoConsultado: string;
  tesistaNombre: string;
  expediente: ExpedienteItem;
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

const PASOS_EXPEDIENTE = [
  {
    numero: 1,
    titulo: 'Paso 1: Nombramiento de Asesor',
    descripcion: 'Expediente nuevo desde cero — solo requiere escuela y datos básicos del tesista.',
  },
  {
    numero: 2,
    titulo: 'Paso 2: Dictamen de Proyecto',
    descripcion: 'Ya cuenta con Resolución de Asesor (Paso 1).',
  },
  {
    numero: 3,
    titulo: 'Paso 3: Inscripción de Proyecto',
    descripcion: 'Ya cuenta con Resoluciones de Asesor y Dictamen (Pasos 1 y 2).',
  },
  {
    numero: 4,
    titulo: 'Paso 4: Tercer Dictaminante',
    descripcion: 'Ya cuenta con Pasos 1, 2 y 3 (hasta Inscripción).',
  },
  {
    numero: 5,
    titulo: 'Paso 5: Apto para Título Profesional',
    descripcion: 'Ya cuenta con Pasos 1 al 4 (hasta Tercer Dictaminante).',
  },
  {
    numero: 6,
    titulo: 'Paso 6: Fecha y Hora de Sustentación',
    descripcion: 'Ya cuenta con Pasos 1 al 5 (hasta Resolución de Apto CF).',
  },
  {
    numero: 7,
    titulo: 'Paso 7: Título Profesional',
    descripcion: 'Ya cuenta con Pasos 1 al 6 (hasta Fecha y Hora de Sustentación).',
  },
] as const;

const REGEX_CODIGO_UNIVERSITARIO = /^[0-9]{9}[a-zA-Z]$/;

export default function ExpedientesListPage() {
  const router = useRouter();
  const { sidebarAbierto, toggleSidebar } = useSidebar();

  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [escuelas, setEscuelas] = useState<EscuelaCatalogo[]>([]);
  const [docentesActivos, setDocentesActivos] = useState<DocenteActivoItem[]>([]);
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

  // Modal de Nuevo Expediente (Fase 1: Validar código -> Fase 2: Formulario completo)
  const [modalAbierto, setModalAbierto] = useState(false);
  const [faseModal, setFaseModal] = useState<'VALIDAR_CODIGO' | 'FORMULARIO'>('VALIDAR_CODIGO');
  const [codigoVerificar, setCodigoVerificar] = useState('');
  const [verificandoCodigo, setVerificandoCodigo] = useState(false);
  const [expedienteDuplicado, setExpedienteDuplicado] =
    useState<ExpedienteDuplicadoInfo | null>(null);
  const [estudiantesAutocompletados, setEstudiantesAutocompletados] = useState(false);
  const [verificandoT2, setVerificandoT2] = useState(false);
  const [duplicadoT2, setDuplicadoT2] = useState<ExpedienteDuplicadoInfo | null>(null);

  const [pasoInicial, setPasoInicial] = useState<number>(1);
  const [escuelaSeleccionadaId, setEscuelaSeleccionadaId] = useState<number>(0);
  const [esColectivo, setEsColectivo] = useState(false);
  const [t1, setT1] = useState<TesistaFormState>({ ...TESISTA_VACIO });
  const [t2, setT2] = useState<TesistaFormState>({ ...TESISTA_VACIO });

  // Antecedentes históricos según el paso seleccionado
  const [histAsesorNum, setHistAsesorNum] = useState('');
  const [histAsesorFecha, setHistAsesorFecha] = useState('');
  const [histAsesorId, setHistAsesorId] = useState('');
  const [histAsesorNombre, setHistAsesorNombre] = useState('');

  const [histDictNum, setHistDictNum] = useState('');
  const [histDictFecha, setHistDictFecha] = useState('');
  const [histTituloTesis, setHistTituloTesis] = useState('');
  const [histDict1Id, setHistDict1Id] = useState('');
  const [histDict1Nombre, setHistDict1Nombre] = useState('');
  const [histDict2Id, setHistDict2Id] = useState('');
  const [histDict2Nombre, setHistDict2Nombre] = useState('');

  const [histInscNum, setHistInscNum] = useState('');
  const [histInscFecha, setHistInscFecha] = useState('');

  const [histTercerDictNum, setHistTercerDictNum] = useState('');
  const [histTercerDictFecha, setHistTercerDictFecha] = useState('');
  const [histDict3Id, setHistDict3Id] = useState('');
  const [histDict3Nombre, setHistDict3Nombre] = useState('');

  const [histApto1Num, setHistApto1Num] = useState('');
  const [histApto1Fecha, setHistApto1Fecha] = useState('');
  const [histApto2Num, setHistApto2Num] = useState('');
  const [histApto2Fecha, setHistApto2Fecha] = useState('');

  const [histFechaHoraNum, setHistFechaHoraNum] = useState('');
  const [histFechaHoraFecha, setHistFechaHoraFecha] = useState('');
  const [histSustFecha, setHistSustFecha] = useState('');
  const [histSustHora, setHistSustHora] = useState('');
  const [histSustModalidad, setHistSustModalidad] = useState<'PRESENCIAL' | 'VIRTUAL'>('PRESENCIAL');

  const [guardandoExp, setGuardandoExp] = useState(false);

  const puedeCrearExpediente =
    usuario?.rol === 'ADMIN' ||
    usuario?.rol === 'SECRETARIA_ACADEMICA' ||
    usuario?.rol === 'ADMINISTRATIVO';

  const cargarEscuelas = async () => {
    try {
      const [listaEscuelas, listaDocentes] = await Promise.all([
        apiFetch<EscuelaCatalogo[]>('/catalogos/escuelas', {
          servicio: 'titulacion',
        }),
        apiFetch<DocenteActivoItem[]>('/personas/docentes/activos', {
          servicio: 'titulacion',
        }).catch(() => [] as DocenteActivoItem[]),
      ]);
      setEscuelas(listaEscuelas);
      setDocentesActivos(listaDocentes);
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

  const abrirModalNuevoExpediente = () => {
    setFaseModal('VALIDAR_CODIGO');
    setCodigoVerificar('');
    setExpedienteDuplicado(null);
    setEstudiantesAutocompletados(false);
    setDuplicadoT2(null);
    setEsColectivo(false);
    setPasoInicial(1);
    setT1({ ...TESISTA_VACIO });
    setT2({ ...TESISTA_VACIO });
    setModalAbierto(true);
  };

  const buscarExpedienteActivoPorCodigo = async (
    codigo: string,
  ): Promise<ExpedienteDuplicadoInfo | null> => {
    const codLimpio = codigo.trim().toLowerCase();
    const resp = await apiFetch<PaginatedExpedientesResponse>(
      `/expedientes?q=${encodeURIComponent(codLimpio)}&estado=EN_PROCESO&limit=10`,
      { servicio: 'titulacion' },
    );

    for (const exp of resp.data) {
      const tesistaMatch = exp.tesistas.find(
        (t) =>
          t.persona.codigoUniversitario?.trim().toLowerCase() === codLimpio &&
          (t.estado === 'ACTIVO' || t.estado === 'APTO'),
      );
      if (tesistaMatch) {
        return {
          codigoConsultado: codigo.trim().toUpperCase(),
          tesistaNombre: tesistaMatch.persona.nombreCompleto,
          expediente: exp,
        };
      }
    }
    return null;
  };

  const buscarPersonaPorCodigo = async (
    codigo: string,
  ): Promise<PersonaEstudianteMatch | null> => {
    const codLimpio = codigo.trim().toLowerCase();
    try {
      const resp = await apiFetch<PaginatedPersonasResponse>(
        `/personas?tipo=estudiante&q=${encodeURIComponent(codLimpio)}&limit=5`,
        { servicio: 'titulacion' },
      );
      return (
        resp.data.find(
          (p) => p.codigoUniversitario?.trim().toLowerCase() === codLimpio,
        ) || null
      );
    } catch {
      return null;
    }
  };

  const handleVerificarCodigo = async (e: FormEvent) => {
    e.preventDefault();
    setExpedienteDuplicado(null);

    const c1 = codigoVerificar.trim().toUpperCase();

    if (!REGEX_CODIGO_UNIVERSITARIO.test(c1)) {
      toast.error(
        'El código universitario debe tener 9 dígitos seguidos de 1 letra (ej. 019100452A).',
      );
      return;
    }

    setVerificandoCodigo(true);
    try {
      const dup = await buscarExpedienteActivoPorCodigo(c1);
      if (dup) {
        setExpedienteDuplicado(dup);
        return;
      }

      // No tiene expediente activo: autocompletar si ya existe en Personas
      const p1 = await buscarPersonaPorCodigo(c1);

      setT1({
        nombres: p1?.nombres || '',
        apellidoPaterno: p1?.apellidoPaterno || '',
        apellidoMaterno: p1?.apellidoMaterno || '',
        codigoUniversitario: c1,
        telefono: p1?.telefono || '',
      });
      setT2({ ...TESISTA_VACIO });
      setDuplicadoT2(null);
      setEsColectivo(false);

      const huboAuto = Boolean(p1);
      setEstudiantesAutocompletados(huboAuto);
      setFaseModal('FORMULARIO');

      toast.success(
        huboAuto
          ? 'Código verificado sin expediente activo. Datos del estudiante autocompletados.'
          : 'Código verificado: sin expediente activo. Ya puedes completar la apertura.',
      );
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudo verificar el código universitario.');
      }
    } finally {
      setVerificandoCodigo(false);
    }
  };

  const handleCambioCodigoT2 = async (valor: string) => {
    const limpio = valor.toUpperCase();
    setT2((prev) => ({ ...prev, codigoUniversitario: limpio }));
    setDuplicadoT2(null);

    const cod = limpio.trim();
    if (
      !REGEX_CODIGO_UNIVERSITARIO.test(cod) ||
      cod.toLowerCase() === t1.codigoUniversitario.trim().toLowerCase()
    ) {
      return;
    }

    setVerificandoT2(true);
    try {
      const dup = await buscarExpedienteActivoPorCodigo(cod);
      if (dup) {
        setDuplicadoT2(dup);
        return;
      }
      const p2 = await buscarPersonaPorCodigo(cod);
      if (p2) {
        setT2((prev) => ({
          ...prev,
          codigoUniversitario: cod,
          nombres: prev.nombres || p2.nombres,
          apellidoPaterno: prev.apellidoPaterno || p2.apellidoPaterno,
          apellidoMaterno: prev.apellidoMaterno || p2.apellidoMaterno,
          telefono: prev.telefono || p2.telefono || '',
        }));
      }
    } catch {
      // Silencioso; la validación definitiva ocurre al enviar
    } finally {
      setVerificandoT2(false);
    }
  };

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

    const obtenerNombreDocente = (id: string, nombreLibre: string) => {
      if (id) {
        const doc = docentesActivos.find((d) => d.docenteId === id);
        if (doc) return `${doc.gradoAcademico} ${doc.nombreCompleto}`.trim();
      }
      return nombreLibre.trim();
    };

    // Validaciones dinámicas según el paso seleccionado
    const payload: Record<string, unknown> = {
      escuelaProfesionalId: Number(escuelaSeleccionadaId),
      cantidadTesistas: tesistasPayload.length,
      pasoActual: pasoInicial,
      tesistas: tesistasPayload,
    };

    if (pasoInicial >= 2) {
      const nombreAsesorFinal = obtenerNombreDocente(histAsesorId, histAsesorNombre);
      if (!histAsesorNum.trim() || !histAsesorFecha || !nombreAsesorFinal) {
        toast.error(
          'Para iniciar en el Paso 2 o superior, complete el número, fecha y docente de la Resolución de Asesor (Paso 1).',
        );
        return;
      }
      payload.resolucionAsesor = {
        numeroCompleto: histAsesorNum.trim(),
        fechaEmision: histAsesorFecha,
        nombreAsesor: nombreAsesorFinal,
        ...(histAsesorId ? { asesorDocenteId: histAsesorId } : {}),
      };
    }

    if (pasoInicial >= 3) {
      const nombreD1 = obtenerNombreDocente(histDict1Id, histDict1Nombre);
      const nombreD2 = obtenerNombreDocente(histDict2Id, histDict2Nombre);
      if (
        !histDictNum.trim() ||
        !histDictFecha ||
        !histTituloTesis.trim() ||
        !nombreD1 ||
        !nombreD2
      ) {
        toast.error(
          'Para iniciar en el Paso 3 o superior, complete el número, fecha, título de tesis y ambos dictaminantes de la Resolución de Dictamen (Paso 2).',
        );
        return;
      }
      if (histDict1Id && histDict2Id && histDict1Id === histDict2Id) {
        toast.error('El Dictaminante 1 y el Dictaminante 2 deben ser docentes distintos.');
        return;
      }
      payload.tituloActual = histTituloTesis.trim();
      payload.resolucionDictaminantes = {
        numeroCompleto: histDictNum.trim(),
        fechaEmision: histDictFecha,
        tituloTesis: histTituloTesis.trim(),
        nombreDictaminante1: nombreD1,
        nombreDictaminante2: nombreD2,
        ...(histDict1Id ? { dictaminante1Id: histDict1Id } : {}),
        ...(histDict2Id ? { dictaminante2Id: histDict2Id } : {}),
      };
    }

    if (pasoInicial >= 4) {
      if (!histInscNum.trim() || !histInscFecha) {
        toast.error(
          'Para iniciar en el Paso 4 o superior, complete el número y fecha de la Resolución de Inscripción (Paso 3).',
        );
        return;
      }
      payload.resolucionInscripcion = {
        numeroCompleto: histInscNum.trim(),
        fechaEmision: histInscFecha,
      };
    }

    if (pasoInicial >= 5) {
      const nombreD3 = obtenerNombreDocente(histDict3Id, histDict3Nombre);
      if (!histTercerDictNum.trim() || !histTercerDictFecha || !nombreD3) {
        toast.error(
          'Para iniciar en el Paso 5 o superior, complete el número, fecha y docente de la Resolución de Tercer Dictaminante (Paso 4).',
        );
        return;
      }
      payload.resolucionTercerDictaminante = {
        numeroCompleto: histTercerDictNum.trim(),
        fechaEmision: histTercerDictFecha,
        nombreDictaminante3: nombreD3,
        ...(histDict3Id ? { dictaminante3Id: histDict3Id } : {}),
      };
    }

    if (pasoInicial >= 6) {
      if (!histApto1Num.trim() || !histApto1Fecha) {
        toast.error(
          'Para iniciar en el Paso 6 o superior, complete el número y fecha de la Resolución de Apto CF (Paso 5).',
        );
        return;
      }
      payload.resolucionApto = {
        numeroCompleto: histApto1Num.trim(),
        fechaEmision: histApto1Fecha,
      };
      if (esColectivo && histApto2Num.trim()) {
        if (!histApto2Fecha) {
          toast.error('Ingrese la fecha de emisión de la Resolución de Apto del Tesista 2.');
          return;
        }
        payload.resolucionAptoTesista2 = {
          numeroCompleto: histApto2Num.trim(),
          fechaEmision: histApto2Fecha,
        };
      }
    }

    if (pasoInicial >= 7) {
      if (!histFechaHoraNum.trim() || !histFechaHoraFecha) {
        toast.error(
          'Para iniciar en el Paso 7, complete el número y fecha de la Resolución de Fecha y Hora (Paso 6).',
        );
        return;
      }
      payload.resolucionFechaHora = {
        numeroCompleto: histFechaHoraNum.trim(),
        fechaEmision: histFechaHoraFecha,
        ...(histSustFecha ? { fechaSustentacion: histSustFecha } : {}),
        ...(histSustHora.trim() ? { horaSustentacion: histSustHora.trim() } : {}),
        modalidadSustentacion: histSustModalidad,
      };
    }

    setGuardandoExp(true);
    try {
      const nuevoExp = await apiFetch<ExpedienteItem>('/expedientes', {
        servicio: 'titulacion',
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success(`Expediente ${nuevoExp.codigoExpediente} creado en Paso ${pasoInicial}.`);
      setModalAbierto(false);
      setPasoInicial(1);
      setT1({ ...TESISTA_VACIO });
      setT2({ ...TESISTA_VACIO });
      setEsColectivo(false);
      setHistAsesorNum('');
      setHistAsesorFecha('');
      setHistAsesorId('');
      setHistAsesorNombre('');
      setHistDictNum('');
      setHistDictFecha('');
      setHistTituloTesis('');
      setHistDict1Id('');
      setHistDict1Nombre('');
      setHistDict2Id('');
      setHistDict2Nombre('');
      setHistInscNum('');
      setHistInscFecha('');
      setHistTercerDictNum('');
      setHistTercerDictFecha('');
      setHistDict3Id('');
      setHistDict3Nombre('');
      setHistApto1Num('');
      setHistApto1Fecha('');
      setHistApto2Num('');
      setHistApto2Fecha('');
      setHistFechaHoraNum('');
      setHistFechaHoraFecha('');
      setHistSustFecha('');
      setHistSustHora('');
      setHistSustModalidad('PRESENCIAL');

      router.push(`/dashboard/expedientes/${nuevoExp.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const dup =
          (await buscarExpedienteActivoPorCodigo(t1.codigoUniversitario).catch(
            () => null,
          )) ||
          (esColectivo
            ? await buscarExpedienteActivoPorCodigo(
                t2.codigoUniversitario,
              ).catch(() => null)
            : null);
        if (dup) {
          setExpedienteDuplicado(dup);
          setFaseModal('VALIDAR_CODIGO');
          return;
        }
        toast.error(err.message);
      } else if (err instanceof ApiError) {
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
              onClick={abrirModalNuevoExpediente}
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
                  {faseModal === 'VALIDAR_CODIGO'
                    ? 'Paso previo: valida el código universitario para evitar expedientes duplicados'
                    : 'El código correlativo anual (EXP-AAAA-NNNN) se asigna con bloqueo atómico'}
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

            {faseModal === 'VALIDAR_CODIGO' ? (
              <div className="p-6 space-y-5 text-xs max-h-[82vh] overflow-y-auto">
                {expedienteDuplicado ? (
                  <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6 text-center space-y-4 shadow-sm">
                    <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-gray-900">
                        Este estudiante ya cuenta con un expediente activo
                      </h4>
                      <p className="text-xs text-gray-600 max-w-md mx-auto">
                        No es necesario crear un expediente nuevo. Puedes ingresar directamente al expediente en curso para continuar con el siguiente paso.
                      </p>
                    </div>

                    <div className="rounded-xl bg-white border border-amber-200 p-4 text-left grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-400 block">
                          Expediente Existente
                        </span>
                        <span className="font-mono text-sm font-extrabold text-[#1E73BE]">
                          {expedienteDuplicado.expediente.codigoExpediente}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-400 block">
                          Etapa Actual
                        </span>
                        <span className="font-bold text-gray-900">
                          {PASOS_EXPEDIENTE.find(
                            (p) =>
                              p.numero ===
                              expedienteDuplicado.expediente.pasoActual,
                          )?.titulo ||
                            `Paso ${expedienteDuplicado.expediente.pasoActual}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-400 block">
                          Tesista(s) del Expediente ({expedienteDuplicado.expediente.cantidadTesistas})
                        </span>
                        <div className="font-semibold text-gray-900 space-y-0.5 mt-0.5">
                          {expedienteDuplicado.expediente.tesistas.map((t) => (
                            <p key={t.id}>
                              {t.persona.nombreCompleto}{' '}
                              <span className="font-mono text-[10px] text-gray-500">
                                ({t.persona.codigoUniversitario})
                              </span>
                            </p>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-400 block">
                          Escuela Profesional
                        </span>
                        <span className="font-semibold text-gray-800">
                          {expedienteDuplicado.expediente.escuelaProfesional.nombre}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const targetId = expedienteDuplicado.expediente.id;
                          setModalAbierto(false);
                          router.push(`/dashboard/expedientes/${targetId}`);
                        }}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E73BE] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#175B96] transition-colors"
                      >
                        <span>
                          Ir al expediente {expedienteDuplicado.expediente.codigoExpediente}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExpedienteDuplicado(null);
                          setCodigoVerificar('');
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
                      >
                        Verificar otro código
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleVerificarCodigo} className="space-y-4">
                    <div className="rounded-xl bg-blue-50/70 border border-blue-200 p-3.5 text-[11px] text-blue-900">
                      Ingresa el <b>Código Universitario</b> del estudiante (basta un solo código, incluso en tesis colectivas). Si ya pertenece a un expediente activo, te llevaremos directo a él; si no, abriremos el formulario de apertura.
                    </div>

                    <div>
                      <label className="block font-bold uppercase text-gray-700 mb-1.5">
                        Código Universitario del Estudiante *
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        maxLength={10}
                        value={codigoVerificar}
                        onChange={(e) => setCodigoVerificar(e.target.value)}
                        placeholder="Ej. 019100452A (9 dígitos + 1 letra)"
                        className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-mono uppercase bg-white focus:border-[#1E73BE] focus:outline-none"
                      />
                    </div>

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
                        disabled={verificandoCodigo}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1E73BE] text-white font-semibold hover:bg-[#175B96] disabled:opacity-60"
                      >
                        {verificandoCodigo ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Verificando código...</span>
                          </>
                        ) : (
                          <>
                            <span>Verificar código y continuar</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
            <form
              onSubmit={handleCrearExpediente}
              className="p-6 space-y-4 text-xs max-h-[82vh] overflow-y-auto"
            >
              {/* Banner de Código Verificado */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Código verificado sin expediente activo:{' '}
                    <b className="font-mono">{t1.codigoUniversitario}</b>
                    {estudiantesAutocompletados ? ' (datos autocompletados)' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExpedienteDuplicado(null);
                    setFaseModal('VALIDAR_CODIGO');
                  }}
                  className="text-[11px] font-bold text-[#1E73BE] hover:underline"
                >
                  Cambiar código
                </button>
              </div>

              {/* Paso inicial del expediente (1 al 7) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block font-bold uppercase text-gray-800">
                  1. ¿En qué paso se encuentra el expediente?
                </label>
                <select
                  value={pasoInicial}
                  onChange={(e) => setPasoInicial(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 p-2.5 text-xs font-semibold text-gray-900 bg-white focus:border-[#1E73BE] focus:outline-none"
                >
                  {PASOS_EXPEDIENTE.map((p) => (
                    <option key={p.numero} value={p.numero}>
                      {p.titulo}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#1E73BE] font-medium">
                  {PASOS_EXPEDIENTE.find((p) => p.numero === pasoInicial)?.descripcion}
                </p>
              </div>

              {/* Selección de Escuela Profesional */}
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1.5">
                  2. Escuela Profesional
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

              {/* Modalidad: 1 o 2 Tesistas */}
              <div>
                <label className="block font-bold uppercase text-gray-700 mb-1.5">
                  3. Modalidad de Integrantes
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEsColectivo(false);
                      setDuplicadoT2(null);
                    }}
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
                      readOnly
                      maxLength={10}
                      value={t1.codigoUniversitario}
                      placeholder="Ej. 019100452A"
                      className="w-full rounded-lg border border-gray-200 p-2 text-xs font-mono uppercase bg-gray-100 text-gray-700 cursor-not-allowed"
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
                      <label className="block text-[11px] text-gray-600 mb-1 flex items-center justify-between">
                        <span>Código Universitario (9 dígitos + 1 letra) *</span>
                        {verificandoT2 && (
                          <span className="inline-flex items-center gap-1 text-[#1E73BE] text-[10px]">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Verificando...
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={10}
                        value={t2.codigoUniversitario}
                        onChange={(e) => void handleCambioCodigoT2(e.target.value)}
                        placeholder="Ej. 019100819K"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono uppercase bg-white focus:border-[#1E73BE] focus:outline-none"
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
                  {duplicadoT2 && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-2 text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <b>{duplicadoT2.tesistaNombre}</b> ya tiene el expediente activo{' '}
                          <b className="font-mono">{duplicadoT2.expediente.codigoExpediente}</b>.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const targetId = duplicadoT2.expediente.id;
                          setModalAbierto(false);
                          router.push(`/dashboard/expedientes/${targetId}`);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#1E73BE] px-3 py-1.5 font-bold text-white hover:bg-[#175B96]"
                      >
                        <span>Ir al expediente</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* ANTECEDENTES HISTÓRICOS SEGÚN EL PASO SELECCIONADO (2..7) */}
              {/* ========================================================= */}
              {pasoInicial >= 2 && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
                  <p className="font-bold text-amber-900">
                    Antecedente Paso 1 — Resolución de Asesor (Histórica) *
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        N° Resolución de Asesor *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={50}
                        value={histAsesorNum}
                        onChange={(e) => setHistAsesorNum(e.target.value)}
                        placeholder="Ej. RES-ORD-2025-0123"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Fecha de Emisión *
                      </label>
                      <input
                        type="date"
                        required
                        value={histAsesorFecha}
                        onChange={(e) => setHistAsesorFecha(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Docente Asesor (Catálogo)
                      </label>
                      <select
                        value={histAsesorId}
                        onChange={(e) => setHistAsesorId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        <option value="">-- Ingresar nombre manualmente --</option>
                        {docentesActivos.map((doc) => (
                          <option key={doc.docenteId} value={doc.docenteId}>
                            {doc.gradoAcademico} {doc.nombreCompleto}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!histAsesorId && (
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">
                          Nombre del Asesor (si no está en catálogo) *
                        </label>
                        <input
                          type="text"
                          required={!histAsesorId}
                          maxLength={200}
                          value={histAsesorNombre}
                          onChange={(e) => setHistAsesorNombre(e.target.value)}
                          placeholder="Ej. Dr. Juan Pérez Quispe"
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {pasoInicial >= 3 && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
                  <p className="font-bold text-amber-900">
                    Antecedente Paso 2 — Resolución de Dictamen (Histórica) *
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        N° Resolución de Dictamen *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={50}
                        value={histDictNum}
                        onChange={(e) => setHistDictNum(e.target.value)}
                        placeholder="Ej. RES-ORD-2025-0245"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Fecha de Emisión *
                      </label>
                      <input
                        type="date"
                        required
                        value={histDictFecha}
                        onChange={(e) => setHistDictFecha(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-600 mb-1">
                      Título de la Tesis *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={500}
                      value={histTituloTesis}
                      onChange={(e) => setHistTituloTesis(e.target.value)}
                      placeholder="Título oficial aprobado en el Dictamen"
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Dictaminante 1 (Catálogo)
                      </label>
                      <select
                        value={histDict1Id}
                        onChange={(e) => setHistDict1Id(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        <option value="">-- Ingresar nombre manualmente --</option>
                        {docentesActivos.map((doc) => (
                          <option key={doc.docenteId} value={doc.docenteId}>
                            {doc.gradoAcademico} {doc.nombreCompleto}
                          </option>
                        ))}
                      </select>
                      {!histDict1Id && (
                        <input
                          type="text"
                          required={!histDict1Id}
                          maxLength={200}
                          value={histDict1Nombre}
                          onChange={(e) => setHistDict1Nombre(e.target.value)}
                          placeholder="Nombre completo Dictaminante 1 *"
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white mt-1.5"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Dictaminante 2 (Catálogo)
                      </label>
                      <select
                        value={histDict2Id}
                        onChange={(e) => setHistDict2Id(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        <option value="">-- Ingresar nombre manualmente --</option>
                        {docentesActivos.map((doc) => (
                          <option key={doc.docenteId} value={doc.docenteId}>
                            {doc.gradoAcademico} {doc.nombreCompleto}
                          </option>
                        ))}
                      </select>
                      {!histDict2Id && (
                        <input
                          type="text"
                          required={!histDict2Id}
                          maxLength={200}
                          value={histDict2Nombre}
                          onChange={(e) => setHistDict2Nombre(e.target.value)}
                          placeholder="Nombre completo Dictaminante 2 *"
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white mt-1.5"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {pasoInicial >= 4 && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
                  <p className="font-bold text-amber-900">
                    Antecedente Paso 3 — Resolución de Inscripción (Histórica) *
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        N° Resolución de Inscripción *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={50}
                        value={histInscNum}
                        onChange={(e) => setHistInscNum(e.target.value)}
                        placeholder="Ej. RES-ORD-2025-0310"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Fecha de Emisión *
                      </label>
                      <input
                        type="date"
                        required
                        value={histInscFecha}
                        onChange={(e) => setHistInscFecha(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {pasoInicial >= 5 && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
                  <p className="font-bold text-amber-900">
                    Antecedente Paso 4 — Resolución de Tercer Dictaminante (Histórica) *
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        N° Resolución 3er Dictaminante *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={50}
                        value={histTercerDictNum}
                        onChange={(e) => setHistTercerDictNum(e.target.value)}
                        placeholder="Ej. RES-ORD-2025-0412"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Fecha de Emisión *
                      </label>
                      <input
                        type="date"
                        required
                        value={histTercerDictFecha}
                        onChange={(e) => setHistTercerDictFecha(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Tercer Dictaminante (Catálogo)
                      </label>
                      <select
                        value={histDict3Id}
                        onChange={(e) => setHistDict3Id(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        <option value="">-- Ingresar nombre manualmente --</option>
                        {docentesActivos.map((doc) => (
                          <option key={doc.docenteId} value={doc.docenteId}>
                            {doc.gradoAcademico} {doc.nombreCompleto}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!histDict3Id && (
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">
                          Nombre del 3er Dictaminante *
                        </label>
                        <input
                          type="text"
                          required={!histDict3Id}
                          maxLength={200}
                          value={histDict3Nombre}
                          onChange={(e) => setHistDict3Nombre(e.target.value)}
                          placeholder="Ej. Dra. María López"
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {pasoInicial >= 6 && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
                  <p className="font-bold text-amber-900">
                    Antecedente Paso 5 — Resolución de Apto CF (Histórica) *
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        N° Res. Apto CF {esColectivo ? '(Tesista 1)' : ''} *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={50}
                        value={histApto1Num}
                        onChange={(e) => setHistApto1Num(e.target.value)}
                        placeholder="Ej. RES-CF-2025-0088"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Fecha de Emisión *
                      </label>
                      <input
                        type="date"
                        required
                        value={histApto1Fecha}
                        onChange={(e) => setHistApto1Fecha(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                  {esColectivo && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-amber-200/70">
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">
                          N° Res. Apto CF Tesista 2 (opcional si comparten la misma)
                        </label>
                        <input
                          type="text"
                          maxLength={50}
                          value={histApto2Num}
                          onChange={(e) => setHistApto2Num(e.target.value)}
                          placeholder="Ej. RES-CF-2025-0089"
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">
                          Fecha de Emisión Tesista 2
                        </label>
                        <input
                          type="date"
                          required={Boolean(histApto2Num.trim())}
                          value={histApto2Fecha}
                          onChange={(e) => setHistApto2Fecha(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {pasoInicial >= 7 && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
                  <p className="font-bold text-amber-900">
                    Antecedente Paso 6 — Resolución de Fecha y Hora (Histórica) *
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        N° Resolución Fecha y Hora *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={50}
                        value={histFechaHoraNum}
                        onChange={(e) => setHistFechaHoraNum(e.target.value)}
                        placeholder="Ej. RES-ORD-2025-0520"
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Fecha de Emisión *
                      </label>
                      <input
                        type="date"
                        required
                        value={histFechaHoraFecha}
                        onChange={(e) => setHistFechaHoraFecha(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Fecha Sustentación (Opcional)
                      </label>
                      <input
                        type="date"
                        value={histSustFecha}
                        onChange={(e) => setHistSustFecha(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Hora (Opcional)
                      </label>
                      <input
                        type="text"
                        maxLength={30}
                        value={histSustHora}
                        onChange={(e) => setHistSustHora(e.target.value)}
                        placeholder="Ej. 10:00 a.m."
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">
                        Modalidad
                      </label>
                      <select
                        value={histSustModalidad}
                        onChange={(e) =>
                          setHistSustModalidad(
                            e.target.value as 'PRESENCIAL' | 'VIRTUAL',
                          )
                        }
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        <option value="PRESENCIAL">PRESENCIAL</option>
                        <option value="VIRTUAL">VIRTUAL</option>
                      </select>
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
