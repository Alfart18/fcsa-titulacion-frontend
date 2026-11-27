// Archivo: app/dashboard/expedientes/[id]/page.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  FormEvent,
} from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  FileText,
  FileSignature,
  RefreshCw,
  RotateCcw,
  UserMinus,
  Loader2,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  PanelLeft,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  abrirPdfAutenticado,
  apiFetch,
  ApiError,
  obtenerUsuarioSesion,
  previsualizarPdfResolucionApi,
  PrevisualizarPdfPayload,
  UsuarioSesion,
} from '@/lib/api';
import { useSidebar } from '../../sidebar-context';
import { SelectorDocente } from './selector-docente';

type EstadoExpediente = 'EN_PROCESO' | 'FINALIZADO' | 'ANULADO';
type EstadoTesista = 'ACTIVO' | 'APTO' | 'DESISTIDO' | 'TITULADO';

type TipoResolucionBackend =
  | 'ASESOR'
  | 'DICTAMEN'
  | 'INSCRIPCION'
  | 'TERCER_DICT'
  | 'APTO'
  | 'FECHA_HORA'
  | 'TITULO'
  | 'COASESOR'
  | 'CAMBIO_ASESOR'
  | 'CAMBIO_TITULO'
  | 'CAMBIO_DICTAMINANTE'
  | 'DESISTIMIENTO'
  | 'DSE';

interface EscuelaCatalogo {
  id: number;
  nombre: string;
  siglasDocumento: string;
  gradoBachiller: string;
  tituloProfesional: string;
  departamentoDefectoId: number;
  activa: boolean;
}

interface DepartamentoCatalogo {
  id: number;
  nombre: string;
  activo: boolean;
}

interface DocenteActivoSelector {
  docenteId: string;
  personaId: string;
  nombreCompleto: string;
  gradoAcademico: string;
  correo: string | null;
  estado: 'ACTIVO' | 'INACTIVO' | 'CESANTE';
  departamentoAcademico: { id: number; nombre: string };
  escuelaProfesional: { id: number; nombre: string; siglasDocumento: string };
}

interface CausaCatalogo {
  id: number;
  ambito: 'CAMBIO_ASESOR' | 'CAMBIO_DICTAMINANTE' | 'DSE' | 'DOCUMENTO_EXTERNO';
  descripcion: string;
  requiereDetalleManual: boolean;
  activo: boolean;
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

interface TesistaDetalle {
  id: string;
  personaId: string;
  orden: number;
  estado: EstadoTesista;
  aptoResolucionId: string | null;
  tituloResolucionId: string | null;
  notaSustentacion: number | null;
  resultadoSustentacion: string | null;
  fechaSustentacionReal: string | null;
  persona: PersonaTesistaResumen;
}

interface ResolucionDetalle {
  id: string;
  tipo: TipoResolucionBackend;
  serie: 'ORD' | 'CF';
  numeroCorrelativo: number;
  anioNumeracion: number;
  numeroCompleto: string;
  tesistaId: string | null;
  resolucionAntecedenteId?: string | null;
  situacionJuridica: 'VIGENTE' | 'MODIFICADA' | 'SIN_EFECTO';
  estadoDocumental: 'EMITIDO' | 'FIRMADO';
  origen: 'SISTEMA' | 'HISTORICO';
  fechaEmision: string;
  nombreDecanoSnapshot: string;
  inicialesOperador: string;
  idTramiteControl: string;
  versionPdf: number;
  hashVersionGenerado?: string;
  pdfGeneradoPath: string | null;
  pdfFirmadoPath: string | null;
  fechaConfirmacionFirma: string | null;
  creadoEn: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datosEspecificos: Record<string, any>;
}

interface ExpedienteDetalleResponse {
  id: string;
  codigoExpediente: string;
  escuelaProfesionalId: number;
  estado: EstadoExpediente;
  cantidadTesistas: number;
  pasoActual: number;
  asesorDocenteId: string | null;
  asesorResolucionId: string | null;
  tituloActual: string | null;
  tituloResolucionId: string | null;
  departamentoDictaminantesId: number | null;
  dictaminante1Id: string | null;
  dictaminante2Id: string | null;
  dictaminante3Id: string | null;
  dictaminantesResolucionId: string | null;
  inscripcionResolucionId: string | null;
  libroInscripcionId: string | null;
  fechaHoraResolucionId: string | null;
  creadoPorId: string;
  creadoEn: string;
  actualizadoEn: string;
  escuelaProfesional: {
    id: number;
    nombre: string;
    siglasDocumento: string;
    gradoBachiller: string;
    tituloProfesional: string;
  };
  tesistas: TesistaDetalle[];
  resoluciones: ResolucionDetalle[];
}

interface CrearResolucionDtoPayload {
  expedienteId: string;
  tipo: TipoResolucionBackend;
  serie?: 'ORD' | 'CF';
  tesistaId?: string;
  resolucionAntecedenteId?: string;
  fechaEmision?: string;
  datosEspecificos: Record<string, unknown>;
}

interface PayloadEmisionCompleto extends CrearResolucionDtoPayload {
  codigoExpediente: string;
}

function calcularMencionPreview(nota: number): string {
  if (nota < 14 || nota > 20) return 'BLOQUEADO (Nota debe ser entre 14 y 20)';
  if (nota <= 16) return 'APROBADO';
  if (nota <= 18) return 'APROBADO CON DISTINCIÓN';
  return 'APROBADO CON DISTINCIÓN Y FELICITACIÓN PÚBLICA';
}

export default function ExpedienteDetallePage() {
  const params = useParams<{ id: string }>();
  const expedienteId = params.id;
  const { sidebarAbierto, toggleSidebar } = useSidebar();

  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [ficha, setFicha] = useState<ExpedienteDetalleResponse | null>(null);
  const [resoluciones, setResoluciones] = useState<ResolucionDetalle[]>([]);
  const [docentesActivos, setDocentesActivos] = useState<DocenteActivoSelector[]>([]);
  const [escuelas, setEscuelas] = useState<EscuelaCatalogo[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoCatalogo[]>([]);
  const [causas, setCausas] = useState<CausaCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoAccion, setProcesandoAccion] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [errorEmision, setErrorEmision] = useState<string | null>(null);

  // Acción seleccionada actualmente en el espacio de emisión
  const [accionActiva, setAccionActiva] = useState<TipoResolucionBackend | null>(null);

  // Estados de formularios para Pasos 1 al 7 y Complementarias
  const [asesorId, setAsesorId] = useState('');
  const [fechaCartaAceptacion, setFechaCartaAceptacion] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [tituloProyecto, setTituloProyecto] = useState('');
  const [dict1Id, setDict1Id] = useState('');
  const [dict2Id, setDict2Id] = useState('');
  const [dict3Id, setDict3Id] = useState('');
  const [tesistaSeleccionadoId, setTesistaSeleccionadoId] = useState('');
  const [numInformeSec, setNumInformeSec] = useState('INF-001-2026-SA-FCSA-UAC');
  const [fechaInformeSec, setFechaInformeSec] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [presidenteId, setPresidenteId] = useState('');
  const [secretarioId, setSecretarioId] = useState('');
  const [vocalId, setVocalId] = useState('');
  const [fechaSustProgramada, setFechaSustProgramada] = useState('');
  const [horaSustProgramada, setHoraSustProgramada] = useState('11:00');
  const [modalidadSust, setModalidadSust] = useState<'PRESENCIAL' | 'VIRTUAL'>('PRESENCIAL');
  const [lugarSust, setLugarSust] = useState('Salón de Grados de la FCSa');
  const [notaSust, setNotaSust] = useState<number>(18);
  const [fechaSustReal, setFechaSustReal] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  // Estados adicionales para Complementarias y DSE
  const [causaIdSeleccionada, setCausaIdSeleccionada] = useState<number>(0);
  const [detalleCausaManual, setDetalleCausaManual] = useState('');
  const [dictSalienteId, setDictSalienteId] = useState('');
  const [dictEntranteId, setDictEntranteId] = useState('');
  const [refSolicitudDesistimiento, setRefSolicitudDesistimiento] =
    useState('SOL-2026-MP-UAC');
  const [fundamentoDesistimiento, setFundamentoDesistimiento] = useState('');
  const [serieDse, setSerieDse] = useState<'ORD' | 'CF'>('ORD');
  const [idsAfectadosDse, setIdsAfectadosDse] = useState<string[]>([]);
  const [reinicioIntegralDse, setReinicioIntegralDse] = useState(false);

  // Estados de Vista Previa PDF en vivo
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewCargando, setPreviewCargando] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const previewUrlRef = useRef<string | null>(null);
  const skipDebounceRef = useRef(false);
  const workspaceEmisionRef = useRef<HTMLDivElement | null>(null);

  const puedeEmitir =
    usuario?.rol === 'ADMIN' ||
    usuario?.rol === 'SECRETARIA_ACADEMICA' ||
    usuario?.rol === 'ADMINISTRATIVO';

  const puedeCambiarEstado =
    usuario?.rol === 'ADMIN' || usuario?.rol === 'SECRETARIA_ACADEMICA';

  const cargarTodo = async () => {
    setCargando(true);
    try {
      const [
        dataFicha,
        listaResoluciones,
        listaDocentes,
        listaEscuelas,
        listaDepartamentos,
        listaCausas,
      ] = await Promise.all([
        apiFetch<ExpedienteDetalleResponse>(`/expedientes/${expedienteId}`, {
          servicio: 'titulacion',
        }),
        apiFetch<ResolucionDetalle[]>(
          `/expedientes/${expedienteId}/resoluciones`,
          { servicio: 'titulacion' },
        ),
        apiFetch<DocenteActivoSelector[]>('/personas/docentes/activos', {
          servicio: 'titulacion',
        }),
        apiFetch<EscuelaCatalogo[]>('/catalogos/escuelas', {
          servicio: 'titulacion',
        }),
        apiFetch<DepartamentoCatalogo[]>('/catalogos/departamentos', {
          servicio: 'titulacion',
        }),
        apiFetch<CausaCatalogo[]>('/catalogos/causas', {
          servicio: 'titulacion',
        }),
      ]);

      setFicha(dataFicha);
      setResoluciones(listaResoluciones);
      setDocentesActivos(listaDocentes);
      setEscuelas(listaEscuelas);
      setDepartamentos(listaDepartamentos);
      setCausas(listaCausas);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setUsuario(obtenerUsuarioSesion());
      if (expedienteId) {
        void cargarTodo();
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedienteId]);

  // Clasificar docentes activos en el embudo de 3 niveles según la Escuela del expediente
  const escuelaCatalogoActual = useMemo(() => {
    if (!ficha) return null;
    return (
      escuelas.find((e) => e.id === ficha.escuelaProfesionalId) || null
    );
  }, [escuelas, ficha]);

  const departamentoDefectoActual = useMemo(() => {
    if (!escuelaCatalogoActual) return null;
    return (
      departamentos.find(
        (d) => d.id === escuelaCatalogoActual.departamentoDefectoId,
      ) || null
    );
  }, [departamentos, escuelaCatalogoActual]);

  const docentesEmbudo = useMemo(() => {
    const escId = ficha?.escuelaProfesionalId ?? 0;
    const depId = escuelaCatalogoActual?.departamentoDefectoId ?? 0;
    return docentesActivos
      .map((d) => {
        let nivelPrioridad: 1 | 2 | 3 = 3;
        if (d.escuelaProfesional.id === escId) {
          nivelPrioridad = 1;
        } else if (depId && d.departamentoAcademico.id === depId) {
          nivelPrioridad = 2;
        }
        return {
          ...d,
          nombreParaResolucion: `${d.gradoAcademico} ${d.nombreCompleto}`.trim(),
          nivelPrioridad,
        };
      })
      .sort((a, b) =>
        a.nivelPrioridad !== b.nivelPrioridad
          ? a.nivelPrioridad - b.nivelPrioridad
          : a.nombreCompleto.localeCompare(b.nombreCompleto),
      );
  }, [docentesActivos, ficha, escuelaCatalogoActual]);

  const nombreDocentePorId = useCallback(
    (docenteId: string | null | undefined): string => {
      if (!docenteId) return '';
      const encontrado = docentesEmbudo.find((d) => d.docenteId === docenteId);
      return encontrado ? encontrado.nombreParaResolucion : '';
    },
    [docentesEmbudo],
  );

  const tesistasActivos = useMemo(
    () => (ficha ? ficha.tesistas.filter((t) => t.estado !== 'DESISTIDO') : []),
    [ficha],
  );

  const obtenerResolucionPorId = useCallback(
    (resId: string | null) =>
      resId ? resoluciones.find((r) => r.id === resId) || null : null,
    [resoluciones],
  );

  const resAsesorObj = useMemo(
    () => obtenerResolucionPorId(ficha?.asesorResolucionId ?? null),
    [ficha?.asesorResolucionId, obtenerResolucionPorId],
  );
  const resDictObj = useMemo(
    () => obtenerResolucionPorId(ficha?.dictaminantesResolucionId ?? null),
    [ficha?.dictaminantesResolucionId, obtenerResolucionPorId],
  );
  const resDictamenOrig = useMemo(
    () =>
      resoluciones.find(
        (r) => r.tipo === 'DICTAMEN' && r.situacionJuridica === 'VIGENTE',
      ) || null,
    [resoluciones],
  );
  const resTercerDictOrig = useMemo(
    () =>
      resoluciones.find(
        (r) => r.tipo === 'TERCER_DICT' && r.situacionJuridica === 'VIGENTE',
      ) || null,
    [resoluciones],
  );

  const asesorActualNombre = useMemo(
    () =>
      nombreDocentePorId(ficha?.asesorDocenteId) ||
      String(
        resAsesorObj?.datosEspecificos?.asesorNombreCompletoSnapshot ||
          resAsesorObj?.datosEspecificos?.nombreAsesor ||
          '',
      ) ||
      null,
    [ficha?.asesorDocenteId, nombreDocentePorId, resAsesorObj],
  );

  const dict1ActualNombre = useMemo(
    () =>
      nombreDocentePorId(ficha?.dictaminante1Id) ||
      String(
        resDictObj?.datosEspecificos?.dictaminante1Snapshot ||
          resDictObj?.datosEspecificos?.nombreDictaminante1 ||
          resDictamenOrig?.datosEspecificos?.dictaminante1Snapshot ||
          resDictamenOrig?.datosEspecificos?.nombreDictaminante1 ||
          '',
      ) ||
      null,
    [ficha?.dictaminante1Id, nombreDocentePorId, resDictObj, resDictamenOrig],
  );

  const dict2ActualNombre = useMemo(
    () =>
      nombreDocentePorId(ficha?.dictaminante2Id) ||
      String(
        resDictObj?.datosEspecificos?.dictaminante2Snapshot ||
          resDictObj?.datosEspecificos?.nombreDictaminante2 ||
          resDictamenOrig?.datosEspecificos?.dictaminante2Snapshot ||
          resDictamenOrig?.datosEspecificos?.nombreDictaminante2 ||
          '',
      ) ||
      null,
    [ficha?.dictaminante2Id, nombreDocentePorId, resDictObj, resDictamenOrig],
  );

  const dict3ActualNombre = useMemo(
    () =>
      nombreDocentePorId(ficha?.dictaminante3Id) ||
      String(
        resTercerDictOrig?.datosEspecificos?.dictaminante3Snapshot ||
          resTercerDictOrig?.datosEspecificos?.nombreDictaminante3 ||
          resDictObj?.datosEspecificos?.dictaminante3Snapshot ||
          resDictObj?.datosEspecificos?.nombreDictaminante3 ||
          '',
      ) ||
      null,
    [ficha?.dictaminante3Id, nombreDocentePorId, resTercerDictOrig, resDictObj],
  );

  const causaSeleccionadaObj = useMemo(
    () => causas.find((c) => c.id === Number(causaIdSeleccionada)),
    [causas, causaIdSeleccionada],
  );

  // Helper puro que construye el payload exacto desde el estado actual (usado por Emisión y Vista Previa)
  const construirPayloadEmision = useCallback((): PayloadEmisionCompleto | null => {
    if (!ficha || !accionActiva) return null;

    const baseSnapshots: Record<string, unknown> = {
      escuelaProfesionalSnapshot: ficha.escuelaProfesional.nombre,
      gradoBachillerSnapshot: ficha.escuelaProfesional.gradoBachiller,
      tituloProfesionalSnapshot: ficha.escuelaProfesional.tituloProfesional,
      departamentoAcademico:
        departamentoDefectoActual?.nombre.replace(
          'Departamento Académico de ',
          '',
        ) || ficha.escuelaProfesional.nombre,
      tesistasSnapshot: tesistasActivos.map((t) => ({
        nombresApellidos: t.persona.nombreCompleto,
        codigoEstudiante: t.persona.codigoUniversitario || '',
      })),
    };

    const causaTextoConsolidado = causaSeleccionadaObj
      ? detalleCausaManual.trim()
        ? `${causaSeleccionadaObj.descripcion}: ${detalleCausaManual.trim()}`
        : causaSeleccionadaObj.descripcion
      : detalleCausaManual.trim();

    const payload: PayloadEmisionCompleto = {
      expedienteId: ficha.id,
      codigoExpediente: ficha.codigoExpediente,
      tipo: accionActiva,
      datosEspecificos: { ...baseSnapshots },
    };

    if (accionActiva === 'ASESOR') {
      payload.serie = 'ORD';
      payload.datosEspecificos = {
        ...baseSnapshots,
        asesorDocenteId: asesorId,
        asesorNombreCompletoSnapshot: nombreDocentePorId(asesorId),
        ...(fechaCartaAceptacion ? { fechaCartaAceptacion } : {}),
      };
    } else if (accionActiva === 'DICTAMEN') {
      payload.serie = 'ORD';
      if (ficha.asesorResolucionId) {
        payload.resolucionAntecedenteId = ficha.asesorResolucionId;
      }
      payload.datosEspecificos = {
        ...baseSnapshots,
        tituloTesis: tituloProyecto.trim(),
        tituloProyecto: tituloProyecto.trim(),
        tituloVigenteSnapshot: tituloProyecto.trim(),
        departamentoAcademicoId: escuelaCatalogoActual?.departamentoDefectoId,
        dictaminante1Id: dict1Id,
        dictaminante2Id: dict2Id,
        dictaminante1Snapshot: nombreDocentePorId(dict1Id),
        dictaminante2Snapshot: nombreDocentePorId(dict2Id),
      };
    } else if (accionActiva === 'INSCRIPCION') {
      payload.serie = 'ORD';
      if (ficha.dictaminantesResolucionId) {
        payload.resolucionAntecedenteId = ficha.dictaminantesResolucionId;
      }
      payload.datosEspecificos = {
        ...baseSnapshots,
        tituloInscritoSnapshot: ficha.tituloActual || '',
        tituloProyecto: ficha.tituloActual || '',
        resolucionDictamenNumeroSnapshot: resDictObj?.numeroCompleto || '',
        fechaResolucionDictamenSnapshot: resDictObj?.fechaEmision || '',
      };
    } else if (accionActiva === 'TERCER_DICT') {
      payload.serie = 'ORD';
      if (ficha.inscripcionResolucionId) {
        payload.resolucionAntecedenteId = ficha.inscripcionResolucionId;
      }
      payload.datosEspecificos = {
        ...baseSnapshots,
        tituloVigenteSnapshot: ficha.tituloActual || '',
        dictaminante1Id: ficha.dictaminante1Id,
        dictaminante2Id: ficha.dictaminante2Id,
        dictaminante3Id: dict3Id,
        dictaminante1Snapshot: dict1ActualNombre || '',
        dictaminante2Snapshot: dict2ActualNombre || '',
        dictaminante3Snapshot: nombreDocentePorId(dict3Id),
      };
    } else if (accionActiva === 'APTO') {
      const tesistaObj = tesistasActivos.find(
        (t) => t.id === tesistaSeleccionadoId,
      );
      payload.serie = 'CF';
      if (tesistaObj) {
        payload.tesistaId = tesistaObj.id;
      }
      if (ficha.dictaminantesResolucionId) {
        payload.resolucionAntecedenteId = ficha.dictaminantesResolucionId;
      }
      payload.datosEspecificos = {
        ...baseSnapshots,
        tesistaNombresSnapshot: tesistaObj?.persona.nombreCompleto || '',
        numeroInformeSecretariaSnapshot: numInformeSec.trim(),
        fechaInformeSecretariaSnapshot: fechaInformeSec,
      };
    } else if (accionActiva === 'FECHA_HORA') {
      payload.serie = 'ORD';
      payload.datosEspecificos = {
        ...baseSnapshots,
        tituloVigenteSnapshot: ficha.tituloActual || '',
        presidenteDocenteId: presidenteId,
        secretarioDocenteId: secretarioId,
        vocalDocenteId: vocalId,
        fechaSustentacion: fechaSustProgramada,
        horaSustentacion: horaSustProgramada,
        modalidad: modalidadSust,
        lugarReferencia: lugarSust.trim(),
        asesorNombreCompletoSnapshot: asesorActualNombre || '',
        juradoSnapshot: {
          presidente: nombreDocentePorId(presidenteId) || dict1ActualNombre || '',
          secretario: nombreDocentePorId(secretarioId) || dict2ActualNombre || '',
          dictaminante: nombreDocentePorId(vocalId) || dict3ActualNombre || '',
          asesor: asesorActualNombre || '',
        },
      };
    } else if (accionActiva === 'TITULO') {
      const tesistaObj = tesistasActivos.find(
        (t) => t.id === tesistaSeleccionadoId,
      );
      payload.serie = 'CF';
      if (tesistaObj) {
        payload.tesistaId = tesistaObj.id;
      }
      if (ficha.fechaHoraResolucionId) {
        payload.resolucionAntecedenteId = ficha.fechaHoraResolucionId;
      }
      payload.datosEspecificos = {
        ...baseSnapshots,
        tesistaNombresSnapshot: tesistaObj?.persona.nombreCompleto || '',
        notaSustentacion: Number(notaSust),
        resultadoSustentacion: calcularMencionPreview(Number(notaSust)),
        fechaSustentacionReal: fechaSustReal,
      };
    } else if (accionActiva === 'CAMBIO_ASESOR') {
      payload.serie = 'ORD';
      if (ficha.asesorResolucionId) {
        payload.resolucionAntecedenteId = ficha.asesorResolucionId;
      }
      payload.datosEspecificos = {
        ...baseSnapshots,
        asesorDocenteId: asesorId,
        asesorNombreCompletoSnapshot: nombreDocentePorId(asesorId),
        asesorSalienteSnapshot: asesorActualNombre || '',
        causaId: Number(causaIdSeleccionada) || undefined,
        causaTextoConsolidadoSnapshot: causaTextoConsolidado,
        resolucionAntecedenteNumeroSnapshot: resAsesorObj?.numeroCompleto || '',
        fechaResolucionAntecedenteSnapshot: resAsesorObj?.fechaEmision || '',
      };
    } else if (accionActiva === 'CAMBIO_TITULO') {
      const resTituloPrev =
        obtenerResolucionPorId(ficha.tituloResolucionId) || resDictObj;
      payload.serie = 'ORD';
      if (resTituloPrev) {
        payload.resolucionAntecedenteId = resTituloPrev.id;
      }
      payload.datosEspecificos = {
        ...baseSnapshots,
        nuevoTitulo: tituloProyecto.trim(),
        tituloTesis: tituloProyecto.trim(),
        diceTituloAnterior: ficha.tituloActual || '',
        debeDecirNuevoTitulo: tituloProyecto.trim(),
        resolucionAntecedenteNumeroSnapshot: resTituloPrev?.numeroCompleto || '',
        fechaResolucionAntecedenteSnapshot: resTituloPrev?.fechaEmision || '',
      };
    } else if (accionActiva === 'CAMBIO_DICTAMINANTE') {
      payload.serie = 'ORD';
      if (ficha.dictaminantesResolucionId) {
        payload.resolucionAntecedenteId = ficha.dictaminantesResolucionId;
      }
      const slotActualizado: Record<string, string> = {};
      if (dictSalienteId === ficha.dictaminante1Id) {
        slotActualizado.dictaminante1Id = dictEntranteId;
      } else if (dictSalienteId === ficha.dictaminante2Id) {
        slotActualizado.dictaminante2Id = dictEntranteId;
      } else if (dictSalienteId === ficha.dictaminante3Id) {
        slotActualizado.dictaminante3Id = dictEntranteId;
      }
      payload.datosEspecificos = {
        ...baseSnapshots,
        ...slotActualizado,
        dictaminanteSalienteId: dictSalienteId,
        dictaminanteEntranteId: dictEntranteId,
        dictaminanteSalienteSnapshot: nombreDocentePorId(dictSalienteId),
        dictaminanteEntranteSnapshot: nombreDocentePorId(dictEntranteId),
        causaId: Number(causaIdSeleccionada) || undefined,
        causaTextoConsolidadoSnapshot: causaTextoConsolidado,
        tituloVigenteSnapshot: ficha.tituloActual || '',
        resolucionAntecedenteNumeroSnapshot: resDictObj?.numeroCompleto || '',
        fechaResolucionAntecedente: resDictObj?.fechaEmision || '',
      };
    } else if (accionActiva === 'DESISTIMIENTO') {
      const desistente = tesistasActivos.find(
        (t) => t.id === tesistaSeleccionadoId,
      );
      const continua = desistente
        ? tesistasActivos.find((t) => t.id !== desistente.id)
        : undefined;
      payload.serie = 'ORD';
      if (desistente) {
        payload.tesistaId = desistente.id;
      }
      payload.datosEspecificos = {
        ...baseSnapshots,
        tesistaDesistenteId: desistente?.id || '',
        tesistaDesistenteNombresSnapshot: desistente?.persona.nombreCompleto || '',
        tesistaContinuaNombresSnapshot: continua?.persona.nombreCompleto || '',
        referenciaSolicitudExterna: refSolicitudDesistimiento.trim(),
        ...(fundamentoDesistimiento.trim()
          ? { fundamentoSolicitud: fundamentoDesistimiento.trim() }
          : {}),
        resolucionAsesorNumeroSnapshot: resAsesorObj?.numeroCompleto || '',
        fechaResolucionAsesorSnapshot: resAsesorObj?.fechaEmision || '',
        resolucionDictamenNumeroSnapshot: resDictObj?.numeroCompleto || '',
        fechaResolucionDictamenSnapshot: resDictObj?.fechaEmision || '',
      };
    } else if (accionActiva === 'DSE') {
      const afectadasObjs = resoluciones.filter((r) =>
        idsAfectadosDse.includes(r.id),
      );
      payload.serie = serieDse;
      payload.datosEspecificos = {
        ...baseSnapshots,
        resolucionesAfectadasIds: idsAfectadosDse,
        resolucionesAfectadasSnapshot: afectadasObjs.map((r) => ({
          numeroCompleto: r.numeroCompleto,
          fechaEmision: r.fechaEmision,
          tipo: r.tipo,
        })),
        causaId: Number(causaIdSeleccionada) || undefined,
        causaTextoConsolidadoSnapshot: causaTextoConsolidado,
        reinicioIntegral: reinicioIntegralDse,
      };
    }

    return payload;
  }, [
    accionActiva,
    asesorActualNombre,
    asesorId,
    causaIdSeleccionada,
    causaSeleccionadaObj,
    departamentoDefectoActual,
    detalleCausaManual,
    dict1ActualNombre,
    dict1Id,
    dict2ActualNombre,
    dict2Id,
    dict3ActualNombre,
    dict3Id,
    dictEntranteId,
    dictSalienteId,
    escuelaCatalogoActual,
    fechaCartaAceptacion,
    fechaInformeSec,
    fechaSustProgramada,
    fechaSustReal,
    ficha,
    fundamentoDesistimiento,
    horaSustProgramada,
    idsAfectadosDse,
    lugarSust,
    modalidadSust,
    nombreDocentePorId,
    notaSust,
    numInformeSec,
    obtenerResolucionPorId,
    presidenteId,
    refSolicitudDesistimiento,
    reinicioIntegralDse,
    resAsesorObj,
    resDictObj,
    resoluciones,
    secretarioId,
    serieDse,
    tesistaSeleccionadoId,
    tesistasActivos,
    tituloProyecto,
    vocalId,
  ]);

  const payloadPreviewJson = useMemo(() => {
    const payload = construirPayloadEmision();
    if (!payload) return null;
    const previewBody: PrevisualizarPdfPayload = {
      tipo: payload.tipo,
      serie: payload.serie,
      expedienteId: payload.expedienteId,
      codigoExpediente: payload.codigoExpediente,
      datosEspecificos: payload.datosEspecificos,
    };
    return JSON.stringify(previewBody);
  }, [construirPayloadEmision]);

  const limpiarPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewCargando(false);
  }, []);

  // Vista previa PDF en vivo con debounce de 500ms y cancelación por AbortController
  useEffect(() => {
    if (!accionActiva || !payloadPreviewJson) {
      return;
    }

    const controller = new AbortController();
    const delayMs = skipDebounceRef.current ? 0 : 500;
    skipDebounceRef.current = false;

    const timer = setTimeout(() => {
      setPreviewCargando(true);
      setPreviewError(null);

      const previewBody = JSON.parse(
        payloadPreviewJson,
      ) as PrevisualizarPdfPayload;

      void previsualizarPdfResolucionApi(previewBody, controller.signal)
        .then((blob) => {
          if (controller.signal.aborted) return;
          const nextUrl = URL.createObjectURL(blob);
          if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
          }
          previewUrlRef.current = nextUrl;
          setPreviewUrl(nextUrl);
          setPreviewError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          const msg =
            err instanceof ApiError
              ? err.message
              : 'No se pudo conectar con documentos-service para generar la vista previa.';
          setPreviewError(msg);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setPreviewCargando(false);
          }
        });
    }, delayMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [accionActiva, payloadPreviewJson, previewNonce]);

  // Limpieza segura del object URL al desmontar la página
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  if (cargando || !ficha) {
    return (
      <div className="py-16 text-center text-xs text-gray-500 animate-pulse">
        Cargando ficha integral del expediente y árbol de resoluciones...
      </div>
    );
  }

  const estaVigenteYFirmada = (resId: string | null): boolean => {
    const r = obtenerResolucionPorId(resId);
    return Boolean(
      r && r.situacionJuridica === 'VIGENTE' && r.estadoDocumental === 'FIRMADO',
    );
  };

  // Resoluciones VIGENTES todavía pendientes de firma digital (bloquean la emisión de la siguiente resolución en backend)
  const resolucionesPendientesFirma = resoluciones.filter(
    (r) =>
      r.situacionJuridica === 'VIGENTE' && r.estadoDocumental === 'EMITIDO',
  );

  const dictaminantesCongeladosPorPaso6 = Boolean(ficha.fechaHoraResolucionId);
  const expedienteEnProceso = ficha.estado === 'EN_PROCESO';

  // Evaluación exacta de las 7 etapas secuenciales
  const p1Firmado = estaVigenteYFirmada(ficha.asesorResolucionId);
  const p2Firmado =
    estaVigenteYFirmada(ficha.dictaminantesResolucionId) &&
    (estaVigenteYFirmada(ficha.tituloResolucionId) || Boolean(ficha.tituloActual)) &&
    (Boolean(ficha.dictaminante1Id) || Boolean(dict1ActualNombre));
  const p3Firmado = estaVigenteYFirmada(ficha.inscripcionResolucionId);
  const p4Firmado =
    (Boolean(ficha.dictaminante3Id) || Boolean(dict3ActualNombre)) &&
    estaVigenteYFirmada(ficha.dictaminantesResolucionId);
  const todosAptosFirmados =
    tesistasActivos.length > 0 &&
    tesistasActivos.every((t) => estaVigenteYFirmada(t.aptoResolucionId));
  const p6Firmado = estaVigenteYFirmada(ficha.fechaHoraResolucionId);
  const todosTituladosFirmados =
    tesistasActivos.length > 0 &&
    tesistasActivos.every((t) => estaVigenteYFirmada(t.tituloResolucionId));

  const sinFirmaPendiente = resolucionesPendientesFirma.length === 0;

  const etapas = [
    {
      numero: 1,
      tipo: 'ASESOR' as TipoResolucionBackend,
      nombre: '1. Nombramiento de Asesor',
      serie: 'ORD',
      completado: p1Firmado,
      enEmitido: Boolean(ficha.asesorResolucionId) && !p1Firmado,
      habilitado:
        puedeEmitir &&
        expedienteEnProceso &&
        !ficha.asesorResolucionId &&
        sinFirmaPendiente,
      detalleEstado: !ficha.asesorResolucionId
        ? 'Listo para designar Docente Asesor.'
        : p1Firmado
          ? `Firmado (${asesorActualNombre || 'Asesor registrado'})`
          : 'Resolución en estado EMITIDO — Requiere firma digital en el módulo de Firmas para desbloquear el Paso 2.',
    },
    {
      numero: 2,
      tipo: 'DICTAMEN' as TipoResolucionBackend,
      nombre: '2. Dictamen de Proyecto (Título + 2 Dictaminantes)',
      serie: 'ORD',
      completado: p2Firmado,
      enEmitido:
        Boolean(ficha.dictaminantesResolucionId) &&
        !ficha.dictaminante3Id &&
        !p2Firmado,
      habilitado:
        puedeEmitir &&
        expedienteEnProceso &&
        p1Firmado &&
        !ficha.dictaminante1Id &&
        !ficha.dictaminantesResolucionId &&
        sinFirmaPendiente,
      detalleEstado: !p1Firmado
        ? 'Bloqueado: Requiere Paso 1 en estado VIGENTE + FIRMADO.'
        : p2Firmado
          ? 'Proyecto dictaminado y firmado.'
          : Boolean(ficha.dictaminantesResolucionId)
            ? 'Resolución EMITIDA — Pendiente de firma digital PKCS#7.'
            : 'Listo para registrar Título y designar 2 Dictaminantes.',
    },
    {
      numero: 3,
      tipo: 'INSCRIPCION' as TipoResolucionBackend,
      nombre: '3. Inscripción de Proyecto',
      serie: 'ORD',
      completado: p3Firmado,
      enEmitido: Boolean(ficha.inscripcionResolucionId) && !p3Firmado,
      habilitado:
        puedeEmitir &&
        expedienteEnProceso &&
        p2Firmado &&
        !ficha.inscripcionResolucionId &&
        sinFirmaPendiente,
      detalleEstado: !p2Firmado
        ? 'Bloqueado: Requiere Paso 2 en estado VIGENTE + FIRMADO.'
        : p3Firmado
          ? 'Proyecto inscrito y resolución firmada.'
          : Boolean(ficha.inscripcionResolucionId)
            ? 'Resolución EMITIDA — Pendiente de firma digital PKCS#7.'
            : 'Listo para emitir resolución de inscripción del proyecto.',
    },
    {
      numero: 4,
      tipo: 'TERCER_DICT' as TipoResolucionBackend,
      nombre: '4. Tercer Dictaminante (Obligatorio)',
      serie: 'ORD',
      completado: p4Firmado,
      enEmitido:
        (Boolean(ficha.dictaminante3Id) || Boolean(resTercerDictOrig)) && !p4Firmado,
      habilitado:
        puedeEmitir &&
        expedienteEnProceso &&
        p3Firmado &&
        !ficha.dictaminante3Id &&
        !resTercerDictOrig &&
        sinFirmaPendiente,
      detalleEstado: !p3Firmado
        ? 'Bloqueado: Requiere Paso 3 en estado VIGENTE + FIRMADO.'
        : p4Firmado
          ? `Terna completa firmada (${dict3ActualNombre || '3er Dictaminante'}).`
          : Boolean(ficha.dictaminante3Id)
            ? 'Resolución EMITIDA — Pendiente de firma digital PKCS#7.'
            : 'Listo para designar al Tercer Dictaminante.',
    },
    {
      numero: 5,
      tipo: 'APTO' as TipoResolucionBackend,
      nombre: '5. Apto para Título Profesional (Individual por Tesista)',
      serie: 'CF',
      completado: todosAptosFirmados,
      enEmitido:
        tesistasActivos.some((t) => Boolean(t.aptoResolucionId)) &&
        !todosAptosFirmados,
      habilitado:
        puedeEmitir &&
        expedienteEnProceso &&
        p4Firmado &&
        tesistasActivos.some((t) => !t.aptoResolucionId),
      detalleEstado: !p4Firmado
        ? 'Bloqueado: Requiere Paso 4 en estado VIGENTE + FIRMADO.'
        : todosAptosFirmados
          ? 'Todos los tesistas activos cuentan con Apto CF firmado.'
          : 'Pendiente emitir o firmar digitalmente el Apto individual de tesista(s).',
    },
    {
      numero: 6,
      tipo: 'FECHA_HORA' as TipoResolucionBackend,
      nombre: '6. Fecha y Hora de Sustentación (Jurado de 4)',
      serie: 'ORD',
      completado: p6Firmado,
      enEmitido: Boolean(ficha.fechaHoraResolucionId) && !p6Firmado,
      habilitado:
        puedeEmitir &&
        expedienteEnProceso &&
        todosAptosFirmados &&
        !ficha.fechaHoraResolucionId &&
        sinFirmaPendiente,
      detalleEstado: !todosAptosFirmados
        ? 'Bloqueado: TODOS los tesistas activos deben tener su Apto VIGENTE + FIRMADO.'
        : p6Firmado
          ? 'Fecha, hora y Jurado firmados (Dictaminantes congelados).'
          : Boolean(ficha.fechaHoraResolucionId)
            ? 'Resolución EMITIDA — Pendiente de firma digital PKCS#7.'
            : 'Listo para conformar Jurado y programar fecha/hora.',
    },
    {
      numero: 7,
      tipo: 'TITULO' as TipoResolucionBackend,
      nombre: '7. Título Profesional (Calificación 14 a 20)',
      serie: 'CF',
      completado: todosTituladosFirmados,
      enEmitido:
        tesistasActivos.some((t) => Boolean(t.tituloResolucionId)) &&
        !todosTituladosFirmados,
      habilitado:
        puedeEmitir &&
        expedienteEnProceso &&
        p6Firmado &&
        tesistasActivos.some((t) => !t.tituloResolucionId),
      detalleEstado: !p6Firmado
        ? 'Bloqueado: Requiere Paso 6 en estado VIGENTE + FIRMADO.'
        : todosTituladosFirmados
          ? 'Todos los tesistas cuentan con Resolución de Título firmada.'
          : 'Listo para registrar calificación entera (14-20) por tesista.',
    },
  ];

  const abrirFormulario = (tipo: TipoResolucionBackend) => {
    setErrorEmision(null);
    setDetalleCausaManual('');
    limpiarPreview();
    skipDebounceRef.current = true;
    setAccionActiva(tipo);

    const disponiblesSinAsesor = docentesEmbudo.filter(
      (d) => d.docenteId !== ficha.asesorDocenteId,
    );
    const disponiblesSinTerna = docentesEmbudo.filter(
      (d) =>
        ![
          ficha.asesorDocenteId,
          ficha.dictaminante1Id,
          ficha.dictaminante2Id,
          ficha.dictaminante3Id,
        ].includes(d.docenteId),
    );

    if (tipo === 'ASESOR') {
      if (docentesEmbudo.length > 0) {
        setAsesorId(docentesEmbudo[0].docenteId);
      }
      setFechaCartaAceptacion(new Date().toISOString().slice(0, 10));
    }
    if (tipo === 'DICTAMEN' && disponiblesSinAsesor.length >= 2) {
      setDict1Id(disponiblesSinAsesor[0].docenteId);
      setDict2Id(disponiblesSinAsesor[1].docenteId);
      setTituloProyecto(ficha.tituloActual || '');
    }
    if (tipo === 'TERCER_DICT' && disponiblesSinTerna.length > 0) {
      setDict3Id(disponiblesSinTerna[0].docenteId);
    }
    if (tipo === 'APTO') {
      const sinApto = tesistasActivos.find((t) => !t.aptoResolucionId);
      if (sinApto) setTesistaSeleccionadoId(sinApto.id);
    }
    if (tipo === 'FECHA_HORA') {
      setPresidenteId(ficha.dictaminante1Id || '');
      setSecretarioId(ficha.dictaminante2Id || '');
      setVocalId(ficha.dictaminante3Id || '');
      const proxSemana = new Date(Date.now() + 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      setFechaSustProgramada(proxSemana);
    }
    if (tipo === 'TITULO') {
      const sinTit = tesistasActivos.find((t) => !t.tituloResolucionId);
      if (sinTit) setTesistaSeleccionadoId(sinTit.id);
    }
    if (tipo === 'CAMBIO_ASESOR') {
      if (disponiblesSinTerna.length > 0) {
        setAsesorId(disponiblesSinTerna[0].docenteId);
      }
      const c = causas.find((x) => x.ambito === 'CAMBIO_ASESOR');
      if (c) setCausaIdSeleccionada(c.id);
    }
    if (tipo === 'CAMBIO_TITULO') {
      setTituloProyecto(ficha.tituloActual || '');
    }
    if (tipo === 'CAMBIO_DICTAMINANTE') {
      setDictSalienteId(ficha.dictaminante3Id || ficha.dictaminante1Id || '');
      if (disponiblesSinTerna.length > 0) {
        setDictEntranteId(disponiblesSinTerna[0].docenteId);
      }
      const c = causas.find((x) => x.ambito === 'CAMBIO_DICTAMINANTE');
      if (c) setCausaIdSeleccionada(c.id);
    }
    if (tipo === 'DESISTIMIENTO') {
      if (tesistasActivos.length > 0) {
        setTesistaSeleccionadoId(tesistasActivos[0].id);
      }
    }
    if (tipo === 'DSE') {
      const vigentes = resoluciones.filter(
        (r) => r.situacionJuridica === 'VIGENTE' && r.tipo !== 'DSE',
      );
      if (vigentes.length > 0) {
        setIdsAfectadosDse([vigentes[vigentes.length - 1].id]);
      } else {
        setIdsAfectadosDse([]);
      }
      const c = causas.find((x) => x.ambito === 'DSE');
      if (c) setCausaIdSeleccionada(c.id);
    }

    requestAnimationFrame(() => {
      workspaceEmisionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const handleActualizarPreview = () => {
    skipDebounceRef.current = true;
    setPreviewNonce((n) => n + 1);
  };

  const handleAbrirPreviewEnPestana = () => {
    if (!previewUrl) return;
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  // Construye y envía POST /resoluciones/emitir con CrearResolucionDto exacto
  const handleEjecutarEmision = async (e: FormEvent) => {
    e.preventDefault();
    if (!accionActiva) return;

    setErrorEmision(null);

    if (accionActiva === 'ASESOR') {
      if (!asesorId) {
        toast.error('Seleccione un Docente Asesor.');
        return;
      }
      if (!fechaCartaAceptacion) {
        toast.error('Ingrese la fecha de la carta de aceptación del asesor.');
        return;
      }
    } else if (accionActiva === 'DICTAMEN') {
      if (!tituloProyecto.trim() || !dict1Id || !dict2Id || dict1Id === dict2Id) {
        toast.error(
          'Ingrese el título del proyecto y seleccione dos dictaminantes distintos.',
        );
        return;
      }
    } else if (accionActiva === 'TERCER_DICT') {
      if (!dict3Id) {
        toast.error('Seleccione el Tercer Dictaminante.');
        return;
      }
    } else if (accionActiva === 'APTO') {
      const tesistaObj = tesistasActivos.find(
        (t) => t.id === tesistaSeleccionadoId,
      );
      if (!tesistaObj) {
        toast.error('Seleccione el tesista a declarar Apto.');
        return;
      }
    } else if (accionActiva === 'FECHA_HORA') {
      if (
        !presidenteId ||
        !secretarioId ||
        !vocalId ||
        new Set([presidenteId, secretarioId, vocalId]).size < 3
      ) {
        toast.error(
          'Debe asignar 3 dictaminantes distintos a los cargos de Presidente, Secretario y Vocal.',
        );
        return;
      }
    } else if (accionActiva === 'TITULO') {
      const tesistaObj = tesistasActivos.find(
        (t) => t.id === tesistaSeleccionadoId,
      );
      if (!tesistaObj) {
        toast.error('Seleccione el tesista.');
        return;
      }
      if (notaSust < 14 || notaSust > 20) {
        toast.error('La nota entera debe estar entre 14 y 20.');
        return;
      }
    } else if (accionActiva === 'CAMBIO_ASESOR') {
      if (!asesorId) {
        toast.error('Seleccione el nuevo Docente Asesor.');
        return;
      }
    } else if (accionActiva === 'CAMBIO_TITULO') {
      if (!tituloProyecto.trim()) {
        toast.error('Ingrese el nuevo título de la tesis.');
        return;
      }
    } else if (accionActiva === 'CAMBIO_DICTAMINANTE') {
      if (!dictSalienteId || !dictEntranteId) {
        toast.error('Seleccione el dictaminante saliente y el entrante.');
        return;
      }
    } else if (accionActiva === 'DESISTIMIENTO') {
      const desistente = tesistasActivos.find(
        (t) => t.id === tesistaSeleccionadoId,
      );
      if (!desistente) {
        toast.error('Seleccione el tesista desistente.');
        return;
      }
    } else if (accionActiva === 'DSE') {
      if (idsAfectadosDse.length === 0) {
        toast.error('Seleccione al menos una resolución vigente a dejar sin efecto.');
        return;
      }
    }

    const payload = construirPayloadEmision();
    if (!payload) return;

    const dto: CrearResolucionDtoPayload = {
      expedienteId: payload.expedienteId,
      tipo: payload.tipo,
      ...(payload.serie ? { serie: payload.serie } : {}),
      ...(payload.tesistaId ? { tesistaId: payload.tesistaId } : {}),
      ...(payload.resolucionAntecedenteId
        ? { resolucionAntecedenteId: payload.resolucionAntecedenteId }
        : {}),
      datosEspecificos: payload.datosEspecificos,
    };

    setProcesandoAccion(true);
    try {
      const creada = await apiFetch<ResolucionDetalle>('/resoluciones/emitir', {
        servicio: 'titulacion',
        method: 'POST',
        body: JSON.stringify(dto),
      });

      toast.success(
        `Resolución ${creada.numeroCompleto} emitida con éxito (Estado: EMITIDO).`,
        {
          description:
            'Diríjase al módulo de Firma Digital para firmar y validar el documento antes del siguiente paso.',
        },
      );
      setAccionActiva(null);
      setErrorEmision(null);
      limpiarPreview();
      await cargarTodo();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error al emitir la resolución.';
      setErrorEmision(msg);
      toast.error(msg);
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleCambiarEstadoExpediente = async (nuevoEstado: EstadoExpediente) => {
    if (nuevoEstado === ficha.estado) return;
    setCambiandoEstado(true);
    try {
      await apiFetch<ExpedienteDetalleResponse>(
        `/expedientes/${ficha.id}/estado`,
        {
          servicio: 'titulacion',
          method: 'PATCH',
          body: JSON.stringify({ estado: nuevoEstado }),
        },
      );
      toast.success(
        `Estado del expediente actualizado a ${nuevoEstado.replace('_', ' ')}.`,
      );
      await cargarTodo();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudo actualizar el estado del expediente.');
    } finally {
      setCambiandoEstado(false);
    }
  };

  const handleVerPdf = async (res: ResolucionDetalle) => {
    try {
      if (res.estadoDocumental === 'FIRMADO' && res.pdfFirmadoPath) {
        await abrirPdfAutenticado(`/firmas/${res.id}/pdf-firmado`, 'firmas');
      } else {
        await abrirPdfAutenticado(`/documentos/${res.id}/pdf`, 'documentos');
      }
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  };

  const ternaVigentesOpciones = [
    {
      id: ficha.dictaminante1Id || '',
      nombre: dict1ActualNombre || 'Dictaminante 1',
    },
    {
      id: ficha.dictaminante2Id || '',
      nombre: dict2ActualNombre || 'Dictaminante 2',
    },
    {
      id: ficha.dictaminante3Id || '',
      nombre: dict3ActualNombre || 'Dictaminante 3',
    },
  ].filter((x) => Boolean(x.id));

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Breadcrumbs y Botón de Sidebar */}
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
        <Link
          href="/dashboard/expedientes"
          className="hover:text-gray-900 transition-colors"
        >
          Expedientes y 7 Pasos
        </Link>
        <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
        <span className="font-mono font-medium text-gray-800">
          {ficha.codigoExpediente}
        </span>
      </nav>

      {/* Barra Superior de Regreso y Estado General */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/expedientes"
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-base font-extrabold text-[#1E73BE]">
                {ficha.codigoExpediente}
              </span>
              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded">
                {ficha.escuelaProfesional.nombre}
              </span>
              <span className="text-[11px] font-bold text-[#1E73BE] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                Paso actual: {ficha.pasoActual}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Grado: <b>{ficha.escuelaProfesional.gradoBachiller}</b> → Título:{' '}
              <b>{ficha.escuelaProfesional.tituloProfesional}</b>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {dictaminantesCongeladosPorPaso6 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <Lock className="w-3.5 h-3.5" />
              <span>Dictaminantes Congelados (Paso 6 Vigente)</span>
            </span>
          )}

          {puedeCambiarEstado ? (
            <select
              value={ficha.estado}
              disabled={cambiandoEstado}
              onChange={(e) =>
                void handleCambiarEstadoExpediente(
                  e.target.value as EstadoExpediente,
                )
              }
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold border cursor-pointer focus:outline-none ${
                ficha.estado === 'EN_PROCESO'
                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : ficha.estado === 'FINALIZADO'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border-rose-200'
              }`}
            >
              <option value="EN_PROCESO">EXPEDIENTE: EN PROCESO</option>
              <option value="FINALIZADO">EXPEDIENTE: FINALIZADO</option>
              <option value="ANULADO">EXPEDIENTE: ANULADO</option>
            </select>
          ) : (
            <span
              className={`px-3.5 py-1 rounded-full text-xs font-extrabold ${
                ficha.estado === 'EN_PROCESO'
                  ? 'bg-blue-100 text-blue-800'
                  : ficha.estado === 'FINALIZADO'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
              }`}
            >
              EXPEDIENTE: {ficha.estado.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Aviso Destacado si existe Resolución EMITIDA pendiente de Firma Digital */}
      {resolucionesPendientesFirma.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 space-y-1">
              <p className="font-bold">
                Firma digital PKCS#7 pendiente — Avance de pasos bloqueado por seguridad jurídica
              </p>
              <p className="text-amber-900">
                La(s) resolución(es){' '}
                <span className="font-mono font-bold">
                  {resolucionesPendientesFirma
                    .map((r) => r.numeroCompleto)
                    .join(', ')}
                </span>{' '}
                se encuentra(n) en estado <b>EMITIDO</b>. Debe descargar el PDF, firmarlo digitalmente (ReFirma/Tocapu) y validarlo criptográficamente en el módulo de Firmas antes de emitir la siguiente resolución.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/firmas"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E73BE] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#175B96] transition shrink-0"
          >
            <FileSignature className="w-4 h-4" />
            <span>Ir a Firma Digital</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* =================================================================== */}
      {/* ESPACIO ACTIVO DE EMISIÓN + VISTA PREVIA DEL PDF EN VIVO            */}
      {/* =================================================================== */}
      {accionActiva && (
        <div
          ref={workspaceEmisionRef}
          className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start scroll-mt-20"
        >
          {/* COLUMNA IZQUIERDA (5 Columnas): FORMULARIO ACTIVO */}
          <div className="xl:col-span-5 bg-white rounded-2xl border border-blue-200 p-5 shadow-sm">
            <form onSubmit={handleEjecutarEmision} className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1E73BE]">
                    Formulario de Emisión: {accionActiva.replaceAll('_', ' ')}
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Complete los campos y verifique el borrador en tiempo real.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAccionActiva(null);
                    setErrorEmision(null);
                    limpiarPreview();
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xs font-bold shrink-0 ml-2"
                >
                  ✕ Cerrar
                </button>
              </div>

              {/* Mensaje de error del backend (ej. bloqueo por firma digital pendiente) */}
              {errorEmision && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <p className="font-semibold text-[11px] leading-relaxed">
                      {errorEmision}
                    </p>
                  </div>
                  {errorEmision.toLowerCase().includes('firma') && (
                    <Link
                      href="/dashboard/firmas"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1E73BE] hover:underline"
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      <span>Ir al módulo de Firma Digital y Validación</span>
                    </Link>
                  )}
                </div>
              )}

              {/* PASO 1: NOMBRAMIENTO DE ASESOR */}
              {accionActiva === 'ASESOR' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Seleccionar Docente Asesor:
                    </label>
                    <SelectorDocente
                      value={asesorId}
                      onChange={setAsesorId}
                      docentes={docentesEmbudo}
                      nombreEscuela={ficha.escuelaProfesional.nombre}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Fecha de Carta de Aceptación del Asesor *
                    </label>
                    <input
                      type="date"
                      required
                      value={fechaCartaAceptacion}
                      onChange={(e) => setFechaCartaAceptacion(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    />
                  </div>
                </div>
              )}

              {/* PASO 2: DICTAMEN DE PROYECTO */}
              {accionActiva === 'DICTAMEN' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Título Oficial del Proyecto de Tesis:
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={tituloProyecto}
                      onChange={(e) => setTituloProyecto(e.target.value)}
                      placeholder="Ingrese el título completo del proyecto de tesis..."
                      className="w-full rounded-lg border border-gray-300 p-2.5 text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Dictaminante 1 (Excluye automáticamente al Asesor):
                    </label>
                    <SelectorDocente
                      value={dict1Id}
                      onChange={setDict1Id}
                      docentes={docentesEmbudo}
                      excluirIds={[ficha.asesorDocenteId]}
                      nombreEscuela={ficha.escuelaProfesional.nombre}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Dictaminante 2 (Excluye Asesor y Dictaminante 1):
                    </label>
                    <SelectorDocente
                      value={dict2Id}
                      onChange={setDict2Id}
                      docentes={docentesEmbudo}
                      excluirIds={[ficha.asesorDocenteId, dict1Id]}
                      nombreEscuela={ficha.escuelaProfesional.nombre}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    />
                  </div>
                </div>
              )}

              {/* PASO 3: INSCRIPCIÓN DE PROYECTO */}
              {accionActiva === 'INSCRIPCION' && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1.5">
                  <p className="font-bold text-[#1E73BE]">
                    Emisión de Resolución de Inscripción de Proyecto
                  </p>
                  <p className="text-gray-700">
                    <b>Título a inscribir:</b> {ficha.tituloActual}
                  </p>
                  <p className="text-[11px] text-gray-600">
                    Al confirmar, el sistema asignará un número correlativo ORD para la{' '}
                    <b>{ficha.escuelaProfesional.nombre}</b>.
                  </p>
                </div>
              )}

              {/* PASO 4: TERCER DICTAMINANTE */}
              {accionActiva === 'TERCER_DICT' && (
                <div className="space-y-3">
                  <label className="block font-bold text-gray-700">
                    Seleccionar Tercer Dictaminante (Excluye Asesor y D1/D2):
                  </label>
                  <SelectorDocente
                    value={dict3Id}
                    onChange={setDict3Id}
                    docentes={docentesEmbudo}
                    excluirIds={[
                      ficha.asesorDocenteId,
                      ficha.dictaminante1Id,
                      ficha.dictaminante2Id,
                    ]}
                    nombreEscuela={ficha.escuelaProfesional.nombre}
                  />
                </div>
              )}

              {/* PASO 5: APTO PARA TÍTULO PROFESIONAL (CF) */}
              {accionActiva === 'APTO' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Tesista Activo a Declarar Apto (Individual Serie CF):
                    </label>
                    <select
                      value={tesistaSeleccionadoId}
                      onChange={(e) =>
                        setTesistaSeleccionadoId(e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    >
                      {tesistasActivos
                        .filter((t) => !t.aptoResolucionId)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.persona.nombreCompleto} (
                            {t.persona.codigoUniversitario || 'S/C'})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      N.° de Informe de Secretaría Académica:
                    </label>
                    <input
                      type="text"
                      required
                      value={numInformeSec}
                      onChange={(e) => setNumInformeSec(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Fecha del Informe:
                    </label>
                    <input
                      type="date"
                      required
                      value={fechaInformeSec}
                      onChange={(e) => setFechaInformeSec(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* PASO 6: FECHA Y HORA DE SUSTENTACIÓN */}
              {accionActiva === 'FECHA_HORA' && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                    Distribuya los 3 Dictaminantes vigentes en los cargos de Presidente, Secretario y Vocal. El Asesor (
                    <b>{asesorActualNombre || 'Asesor'}</b>) se integra automáticamente como 4.° miembro.
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Presidente del Jurado:
                      </label>
                      <select
                        value={presidenteId}
                        onChange={(e) => setPresidenteId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        {ternaVigentesOpciones.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Secretario del Jurado:
                      </label>
                      <select
                        value={secretarioId}
                        onChange={(e) => setSecretarioId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        {ternaVigentesOpciones.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Vocal / Dictaminante:
                      </label>
                      <select
                        value={vocalId}
                        onChange={(e) => setVocalId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        {ternaVigentesOpciones.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Fecha Programada:
                      </label>
                      <input
                        type="date"
                        required
                        value={fechaSustProgramada}
                        onChange={(e) =>
                          setFechaSustProgramada(e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Hora (24h HH:mm):
                      </label>
                      <input
                        type="time"
                        required
                        value={horaSustProgramada}
                        onChange={(e) =>
                          setHoraSustProgramada(e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Modalidad:
                      </label>
                      <select
                        value={modalidadSust}
                        onChange={(e) =>
                          setModalidadSust(
                            e.target.value as 'PRESENCIAL' | 'VIRTUAL',
                          )
                        }
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        <option value="PRESENCIAL">PRESENCIAL</option>
                        <option value="VIRTUAL">VIRTUAL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Lugar / Referencia:
                      </label>
                      <input
                        type="text"
                        required
                        value={lugarSust}
                        onChange={(e) => setLugarSust(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 7: TÍTULO PROFESIONAL (CF) */}
              {accionActiva === 'TITULO' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Tesista que Aprobó la Sustentación:
                    </label>
                    <select
                      value={tesistaSeleccionadoId}
                      onChange={(e) =>
                        setTesistaSeleccionadoId(e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    >
                      {tesistasActivos
                        .filter((t) => !t.tituloResolucionId)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.persona.nombreCompleto} (
                            {t.persona.codigoUniversitario || 'S/C'})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Nota Entera (14 a 20):
                      </label>
                      <input
                        type="number"
                        min={14}
                        max={20}
                        step={1}
                        required
                        value={notaSust}
                        onChange={(e) => setNotaSust(Number(e.target.value))}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Fecha Real Sustentación:
                      </label>
                      <input
                        type="date"
                        required
                        value={fechaSustReal}
                        onChange={(e) => setFechaSustReal(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">
                      Mención Calculada Automáticamente:
                    </span>
                    <span className="font-extrabold text-[#1E73BE] text-xs">
                      {calcularMencionPreview(notaSust)}
                    </span>
                  </div>
                </div>
              )}

              {/* COMPLEMENTARIA 1: CAMBIO DE ASESOR */}
              {accionActiva === 'CAMBIO_ASESOR' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Nuevo Docente Asesor (Excluye Asesor actual y Dictaminantes):
                    </label>
                    <SelectorDocente
                      value={asesorId}
                      onChange={setAsesorId}
                      docentes={docentesEmbudo}
                      excluirIds={[
                        ficha.asesorDocenteId,
                        ficha.dictaminante1Id,
                        ficha.dictaminante2Id,
                        ficha.dictaminante3Id,
                      ]}
                      nombreEscuela={ficha.escuelaProfesional.nombre}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Causa Oficial del Cambio:
                    </label>
                    <select
                      value={causaIdSeleccionada}
                      onChange={(e) =>
                        setCausaIdSeleccionada(Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    >
                      {causas
                        .filter((c) => c.ambito === 'CAMBIO_ASESOR')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.descripcion}
                          </option>
                        ))}
                    </select>
                  </div>
                  {causaSeleccionadaObj?.requiereDetalleManual && (
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Especificar Detalle Manual de la Causa:
                      </label>
                      <input
                        type="text"
                        required
                        value={detalleCausaManual}
                        onChange={(e) =>
                          setDetalleCausaManual(e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* COMPLEMENTARIA 2: CAMBIO DE TÍTULO (DICE / DEBE DECIR) */}
              {accionActiva === 'CAMBIO_TITULO' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">
                      DICE (Título Vigente Actual):
                    </label>
                    <textarea
                      rows={2}
                      readOnly
                      value={ficha.tituloActual || ''}
                      className="w-full rounded-lg border border-gray-200 bg-gray-100 p-2 text-xs text-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#1E73BE] mb-1">
                      DEBE DECIR (Nuevo Título Modificado):
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={tituloProyecto}
                      onChange={(e) => setTituloProyecto(e.target.value)}
                      className="w-full rounded-lg border border-blue-400 p-2 text-xs uppercase"
                    />
                  </div>
                </div>
              )}

              {/* COMPLEMENTARIA 3: CAMBIO DE DICTAMINANTE */}
              {accionActiva === 'CAMBIO_DICTAMINANTE' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Dictaminante Vigente que Sale:
                    </label>
                    <select
                      value={dictSalienteId}
                      onChange={(e) => setDictSalienteId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    >
                      {ternaVigentesOpciones.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Nuevo Docente Dictaminante Entrante:
                    </label>
                    <SelectorDocente
                      value={dictEntranteId}
                      onChange={setDictEntranteId}
                      docentes={docentesEmbudo}
                      excluirIds={[
                        ficha.asesorDocenteId,
                        ficha.dictaminante1Id,
                        ficha.dictaminante2Id,
                        ficha.dictaminante3Id,
                      ]}
                      nombreEscuela={ficha.escuelaProfesional.nombre}
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Causa Oficial del Reemplazo:
                    </label>
                    <select
                      value={causaIdSeleccionada}
                      onChange={(e) =>
                        setCausaIdSeleccionada(Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    >
                      {causas
                        .filter((c) => c.ambito === 'CAMBIO_DICTAMINANTE')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.descripcion}
                          </option>
                        ))}
                    </select>
                  </div>
                  {causaSeleccionadaObj?.requiereDetalleManual && (
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Especificar Detalle Manual de la Causa:
                      </label>
                      <input
                        type="text"
                        required
                        value={detalleCausaManual}
                        onChange={(e) =>
                          setDetalleCausaManual(e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* COMPLEMENTARIA 4: DESISTIMIENTO */}
              {accionActiva === 'DESISTIMIENTO' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Tesista que Presenta el Desistimiento:
                    </label>
                    <select
                      value={tesistaSeleccionadoId}
                      onChange={(e) =>
                        setTesistaSeleccionadoId(e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    >
                      {tesistasActivos.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.persona.nombreCompleto} (
                          {t.persona.codigoUniversitario || 'S/C'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Referencia de Solicitud Externa:
                    </label>
                    <input
                      type="text"
                      required
                      value={refSolicitudDesistimiento}
                      onChange={(e) =>
                        setRefSolicitudDesistimiento(e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Fundamento / Observación (Opcional):
                    </label>
                    <input
                      type="text"
                      value={fundamentoDesistimiento}
                      onChange={(e) =>
                        setFundamentoDesistimiento(e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* COMPLEMENTARIA 5: DEJAR SIN EFECTO (DSE) */}
              {accionActiva === 'DSE' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Serie de la Resolución DSE:
                    </label>
                    <select
                      value={serieDse}
                      onChange={(e) =>
                        setSerieDse(e.target.value as 'ORD' | 'CF')
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    >
                      <option value="ORD">ORDINARIA (ORD)</option>
                      <option value="CF">CONSEJO DE FACULTAD (CF)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Seleccionar Resolución(es) VIGENTES a Dejar Sin Efecto:
                    </label>
                    <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1.5 bg-gray-50">
                      {resoluciones
                        .filter(
                          (r) =>
                            r.situacionJuridica === 'VIGENTE' &&
                            r.tipo !== 'DSE',
                        )
                        .map((r) => (
                          <label
                            key={r.id}
                            className="flex items-center gap-2 text-xs cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={idsAfectadosDse.includes(r.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setIdsAfectadosDse((prev) => [
                                    ...prev,
                                    r.id,
                                  ]);
                                } else {
                                  setIdsAfectadosDse((prev) =>
                                    prev.filter((id) => id !== r.id),
                                  );
                                }
                              }}
                            />
                            <span className="font-mono font-bold">
                              {r.numeroCompleto}
                            </span>
                            <span className="text-gray-600">— {r.tipo}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Causa del DSE:
                    </label>
                    <select
                      value={causaIdSeleccionada}
                      onChange={(e) =>
                        setCausaIdSeleccionada(Number(e.target.value))
                      }
                      className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                    >
                      {causas
                        .filter((c) => c.ambito === 'DSE')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.descripcion}
                          </option>
                        ))}
                    </select>
                  </div>
                  {causaSeleccionadaObj?.requiereDetalleManual && (
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Especificar Detalle Manual de la Causa:
                      </label>
                      <input
                        type="text"
                        required
                        value={detalleCausaManual}
                        onChange={(e) =>
                          setDetalleCausaManual(e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reinicioIntegralDse}
                      onChange={(e) =>
                        setReinicioIntegralDse(e.target.checked)
                      }
                    />
                    <span>
                      Marcar Reinicio Integral en los datos de la resolución DSE
                    </span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={procesandoAccion}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#1E73BE] py-2.5 px-4 text-xs font-bold text-white shadow hover:bg-[#175B96] disabled:opacity-60 transition"
              >
                {procesandoAccion ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Emitiendo Resolución...</span>
                  </>
                ) : (
                  <span>Confirmar Emisión y Asignar Número Oficial</span>
                )}
              </button>
            </form>
          </div>

          {/* COLUMNA DERECHA (7 Columnas): VISTA PREVIA PDF EN VIVO */}
          <div className="xl:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden xl:sticky xl:top-20">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-gray-200 bg-gray-50/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1E73BE] shrink-0">
                  <Eye className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-extrabold text-gray-900">
                      Vista Previa del PDF (En vivo)
                    </h3>
                    {previewCargando ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1E73BE]">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Generando...</span>
                      </span>
                    ) : previewUrl && !previewError ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        <span>Sincronizado</span>
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-gray-500 truncate">
                    Borrador A4 — {accionActiva.replaceAll('_', ' ')} ({ficha.codigoExpediente})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleActualizarPreview}
                  disabled={previewCargando}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 text-[11px] font-semibold disabled:opacity-50 transition"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${previewCargando ? 'animate-spin' : ''}`}
                  />
                  <span>Actualizar</span>
                </button>
                <button
                  type="button"
                  onClick={handleAbrirPreviewEnPestana}
                  disabled={!previewUrl}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1E73BE] hover:bg-[#175B96] text-white text-[11px] font-semibold disabled:opacity-40 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir PDF en pestaña</span>
                </button>
              </div>
            </div>

            <div className="relative h-[680px] xl:h-[780px] bg-slate-100">
              {previewError ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <p className="text-xs font-bold text-gray-900">
                      Vista previa en vivo no disponible por el momento
                    </p>
                    <p className="text-[11px] text-rose-700 font-medium">
                      {previewError}
                    </p>
                    <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
                      Si acaba de actualizar el backend, reinicie{' '}
                      <span className="font-mono font-semibold text-gray-700">
                        documentos-service
                      </span>{' '}
                      y vuelva a intentar. Puede continuar completando el formulario con normalidad.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleActualizarPreview}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1E73BE] hover:bg-[#175B96] text-white text-xs font-bold shadow-xs transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reintentar vista previa</span>
                  </button>
                </div>
              ) : previewUrl ? (
                <>
                  <iframe
                    src={`${previewUrl}#toolbar=1&navpanes=0`}
                    title="Vista previa del PDF de la resolución en vivo"
                    className="w-full h-full border-0 bg-white"
                  />
                  {previewCargando && (
                    <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 border border-blue-200 px-3 py-1.5 text-[11px] font-bold text-[#1E73BE] shadow-sm backdrop-blur-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Actualizando borrador...</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2.5">
                  <Loader2 className="w-7 h-7 text-[#1E73BE] animate-spin" />
                  <p className="text-xs font-bold text-gray-800">
                    Generando vista previa A4 en vivo...
                  </p>
                  <p className="text-[11px] text-gray-500 max-w-xs">
                    El documento borrador se actualiza automáticamente al modificar cualquier campo del formulario.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* GRILLA PRINCIPAL: IZQUIERDA (7 PASOS + DATOS) | DERECHA (ASISTENTE) */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* COLUMNA DE DATOS Y 7 PASOS */}
        <div
          className={
            accionActiva
              ? 'xl:col-span-12 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start'
              : 'xl:col-span-7 space-y-6'
          }
        >
          {/* 1. Punteros Consolidados Vigentes del Expediente */}
          <div
            className={`bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 ${
              accionActiva ? 'xl:col-span-5' : ''
            }`}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Información Vigente Consolidada del Expediente
              </h3>
              {ficha.libroInscripcionId && (
                <span className="font-mono text-xs font-bold bg-blue-50 text-[#1E73BE] px-2.5 py-1 rounded border border-blue-200">
                  Inscrito en Libro Oficial
                </span>
              )}
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase text-gray-400 block">
                Título del Proyecto / Tesis Vigente:
              </span>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {ficha.tituloActual ||
                  '(Aún sin título registrado — Se registra en el Paso 2: Dictamen)'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">
                  Docente Asesor Vigente:
                </span>
                <span className="font-bold text-gray-900">
                  {asesorActualNombre || 'Sin designar'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">
                  Terna de Dictaminantes Vigente:
                </span>
                <div className="font-semibold text-gray-800 space-y-0.5 mt-0.5">
                  <p>1. {dict1ActualNombre || '—'}</p>
                  <p>2. {dict2ActualNombre || '—'}</p>
                  <p>3. {dict3ActualNombre || '—'}</p>
                </div>
              </div>
            </div>

            {/* Tabla de Tesistas */}
            <div>
              <h4 className="text-[11px] font-bold uppercase text-gray-500 mb-2">
                Tesista(s) del Expediente
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-[10px] uppercase text-gray-400">
                      <th className="py-1.5">Tesista</th>
                      <th className="py-1.5">Código</th>
                      <th className="py-1.5">Estado</th>
                      <th className="py-1.5">Res. Apto (CF)</th>
                      <th className="py-1.5">Res. Título y Mención (CF)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ficha.tesistas.map((t) => {
                      const rApto = obtenerResolucionPorId(t.aptoResolucionId);
                      const rTit = obtenerResolucionPorId(t.tituloResolucionId);
                      const notaMostrar =
                        t.notaSustentacion ??
                        rTit?.datosEspecificos?.notaSustentacion ??
                        null;
                      const resMostrar =
                        t.resultadoSustentacion ??
                        rTit?.datosEspecificos?.resultadoSustentacion ??
                        null;

                      return (
                        <tr key={t.id}>
                          <td className="py-2 font-bold text-gray-900">
                            {t.persona.nombreCompleto}
                          </td>
                          <td className="py-2 font-mono">
                            {t.persona.codigoUniversitario || '—'}
                          </td>
                          <td className="py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                t.estado === 'TITULADO'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : t.estado === 'APTO'
                                    ? 'bg-purple-100 text-purple-800'
                                    : t.estado === 'DESISTIDO'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {t.estado}
                            </span>
                          </td>
                          <td className="py-2 font-mono text-[11px]">
                            {rApto
                              ? `${rApto.numeroCompleto} (${rApto.estadoDocumental})`
                              : 'Pendiente'}
                          </td>
                          <td className="py-2 font-mono text-[11px]">
                            {rTit
                              ? `${rTit.numeroCompleto}${notaMostrar !== null ? ` [Nota: ${notaMostrar}${resMostrar ? ` - ${resMostrar}` : ''}]` : ''} (${rTit.estadoDocumental})`
                              : 'Pendiente'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Botonera de Resoluciones Complementarias y Excepciones */}
            {puedeEmitir && (
              <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase text-gray-500 mr-1">
                  Complementarias:
                </span>
                <button
                  type="button"
                  onClick={() => abrirFormulario('CAMBIO_ASESOR')}
                  disabled={!p1Firmado || !expedienteEnProceso}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-40"
                >
                  Cambio de Asesor
                </button>
                <button
                  type="button"
                  onClick={() => abrirFormulario('CAMBIO_TITULO')}
                  disabled={!p2Firmado || !expedienteEnProceso}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-40"
                >
                  Cambio de Título (DICE/DEBE DECIR)
                </button>
                <button
                  type="button"
                  onClick={() => abrirFormulario('CAMBIO_DICTAMINANTE')}
                  disabled={
                    !p4Firmado ||
                    dictaminantesCongeladosPorPaso6 ||
                    !expedienteEnProceso
                  }
                  title={
                    dictaminantesCongeladosPorPaso6
                      ? 'Bloqueado: Los dictaminantes están congelados en Paso 6'
                      : ''
                  }
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-40"
                >
                  Cambio de Dictaminante
                </button>
                <button
                  type="button"
                  onClick={() => abrirFormulario('DESISTIMIENTO')}
                  disabled={
                    tesistasActivos.length !== 2 ||
                    dictaminantesCongeladosPorPaso6 ||
                    !expedienteEnProceso
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 disabled:opacity-40"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>Desistimiento</span>
                </button>
                <button
                  type="button"
                  onClick={() => abrirFormulario('DSE')}
                  disabled={resoluciones.length === 0 || !expedienteEnProceso}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-100 hover:bg-rose-200 text-rose-900 disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Dejar Sin Efecto (DSE)</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. Flujo Secuencial de los 7 Pasos */}
          <div
            className={`bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3 ${
              accionActiva ? 'xl:col-span-7' : ''
            }`}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Flujo Secuencial Obligatorio (7 Pasos de Titulación)
            </h3>

            <div className="space-y-2.5">
              {etapas.map((etapa) => (
                <div
                  key={etapa.numero}
                  className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition ${
                    etapa.completado
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : etapa.enEmitido
                        ? 'bg-amber-50/70 border-amber-300'
                        : etapa.habilitado
                          ? 'bg-blue-50/60 border-blue-300'
                          : 'bg-gray-50 border-gray-200 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        etapa.completado
                          ? 'bg-emerald-600 text-white'
                          : etapa.enEmitido
                            ? 'bg-amber-500 text-white'
                            : etapa.habilitado
                              ? 'bg-[#1E73BE] text-white'
                              : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      {etapa.completado ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : etapa.enEmitido ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        etapa.numero
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-900">
                          {etapa.nombre}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            etapa.serie === 'CF'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          Serie {etapa.serie}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        {etapa.detalleEstado}
                      </p>
                    </div>
                  </div>

                  {etapa.enEmitido ? (
                    <Link
                      href="/dashboard/firmas"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      <span>Firmar en Firmas</span>
                    </Link>
                  ) : (
                    etapa.habilitado && (
                      <button
                        type="button"
                        onClick={() => abrirFormulario(etapa.tipo)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#1E73BE] hover:bg-[#175B96] text-white text-xs font-bold shadow-xs transition"
                      >
                        Preparar Paso {etapa.numero}
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* COLUMNA DERECHA (5 Columnas): ASISTENTE EN ESPERA (SI NO HAY FORM)  */}
        {/* =================================================================== */}
        {!accionActiva && (
          <div className="xl:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm sticky top-20">
              <div className="py-12 text-center space-y-2">
                <Sparkles className="w-8 h-8 text-[#1E73BE] mx-auto opacity-70" />
                <h3 className="text-sm font-bold text-gray-900">
                  Asistente de Emisión de Resoluciones
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Seleccione el botón <b>&quot;Preparar Paso&quot;</b> en la línea de progreso o cualquiera de las <b>Resoluciones Complementarias</b> para abrir su formulario validado junto a la vista previa del PDF en vivo.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* HISTORIAL DOCUMENTAL INMUTABLE DEL EXPEDIENTE                       */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Historial Documental del Expediente ({resoluciones.length})
            </h3>
            <p className="text-xs text-gray-500">
              Cadena de resoluciones, Sello de Doble Vía (ID-TRAMITE + HASH) y descarga de PDF oficial
            </p>
          </div>
          <button
            type="button"
            onClick={() => void cargarTodo()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E73BE] hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refrescar Historial</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-bold uppercase text-gray-500">
                <th className="py-2.5 px-3">Número Oficial</th>
                <th className="py-2.5 px-3">Tipo / Serie</th>
                <th className="py-2.5 px-3">Sit. Jurídica</th>
                <th className="py-2.5 px-3">Est. Documental</th>
                <th className="py-2.5 px-3">Sello ID-Trámite y Versión</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resoluciones.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-gray-400 italic"
                  >
                    Aún no se han emitido resoluciones en este expediente.
                  </td>
                </tr>
              ) : (
                [...resoluciones].reverse().map((res) => (
                  <tr key={res.id} className="hover:bg-gray-50/70">
                    <td className="py-3 px-3 font-mono font-bold text-[#1E73BE]">
                      {res.numeroCompleto}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-gray-900">
                        {res.tipo}
                      </span>
                      <span
                        className={`ml-2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          res.serie === 'CF'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {res.serie}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          res.situacionJuridica === 'VIGENTE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : res.situacionJuridica === 'MODIFICADA'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {res.situacionJuridica}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          res.estadoDocumental === 'FIRMADO'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {res.estadoDocumental}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-gray-500">
                      {res.idTramiteControl} | v{res.versionPdf}
                      {res.hashVersionGenerado
                        ? ` (${res.hashVersionGenerado.slice(0, 8)})`
                        : ''}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void handleVerPdf(res)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E73BE] text-white text-[11px] font-semibold hover:bg-[#175B96]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>
                          {res.estadoDocumental === 'FIRMADO' &&
                          res.pdfFirmadoPath
                            ? 'Ver PDF Firmado'
                            : 'Ver PDF'}
                        </span>
                      </button>

                      {res.estadoDocumental === 'EMITIDO' &&
                        res.situacionJuridica === 'VIGENTE' && (
                          <Link
                            href="/dashboard/firmas"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 text-white text-[11px] font-semibold hover:bg-amber-700"
                          >
                            <FileSignature className="w-3.5 h-3.5" />
                            <span>Firmar en Firmas</span>
                          </Link>
                        )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
