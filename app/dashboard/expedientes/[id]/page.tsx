// Archivo: app/dashboard/expedientes/[id]/page.tsx
'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  FileText,
  FileCheck2,
  RefreshCw,
  Edit3,
  RotateCcw,
  UserMinus,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { abrirPdfAutenticado, apiFetch, ApiError } from '@/lib/api';

type TipoAccionFormulario =
  | 'ASESOR'
  | 'DICTAMEN'
  | 'INSCRIPCION'
  | 'TERCER_DICT'
  | 'APTO'
  | 'FECHA_HORA'
  | 'TITULO'
  | 'CAMBIO_ASESOR'
  | 'CAMBIO_TITULO'
  | 'CAMBIO_DICTAMINANTE'
  | 'DESISTIMIENTO'
  | 'DSE'
  | 'CORREGIR_BORRADOR';

interface DocenteElegible {
  id: string;
  gradoAcademico: string;
  nombresCompletos: string;
  nombreParaResolucion: string;
  departamentoAcademico: { id: number; nombre: string };
  escuelaProfesional: { id: number; nombre: string };
  nivelPrioridad: 1 | 2 | 3;
  categoriaEmbudo: string;
  advertenciaInterdisciplinaria: string | null;
}

interface CausaCatalogo {
  id: number;
  ambito: 'CAMBIO_ASESOR' | 'CAMBIO_DICTAMINANTE' | 'DSE' | 'DOCUMENTO_EXTERNO';
  descripcion: string;
  requiereDetalleManual: boolean;
}

interface TesistaDetalle {
  id: string;
  orden: number;
  nombresApellidos: string;
  codigoEstudiante: string;
  estado: 'ACTIVO' | 'APTO' | 'DESISTIDO' | 'TITULADO';
  aptoResolucionId: string | null;
  tituloResolucionId: string | null;
  notaSustentacion: number | null;
  resultadoSustentacion: string | null;
  fechaSustentacionReal: string | null;
}

interface ResolucionDetalle {
  id: string;
  tipo: string;
  serie: 'ORD' | 'CF';
  numeroCompleto: string;
  tesistaId: string | null;
  resolucionAntecedenteId: string | null;
  situacionJuridica: 'VIGENTE' | 'MODIFICADA' | 'SIN_EFECTO';
  estadoDocumental: 'EMITIDO' | 'FIRMADO';
  fechaEmision: string;
  nombreDecanoSnapshot: string;
  inicialesOperador: string;
  idTramiteControl: string;
  versionPdf: number;
  hashVersionGenerado: string;
  pdfFirmadoPath: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datosEspecificos: Record<string, any>;
}

interface FichaExpedienteResponse {
  id: string;
  codigoExpediente: string;
  escuelaProfesionalId: number;
  estado: 'ACTIVO' | 'TITULADO' | 'ANULADO';
  cantidadTesistas: number;
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
  fechaHoraResolucionId: string | null;
  escuelaProfesional: {
    id: number;
    nombre: string;
    gradoBachiller: string;
    tituloProfesional: string;
    departamentoDefecto: { id: number; nombre: string };
  };
  tesistas: TesistaDetalle[];
  resoluciones: ResolucionDetalle[];
  asientosLibroInscripcion: Array<{
    id: string;
    numeroFolioFormateado: string;
    estadoAsiento: string;
  }>;
  informacionVigenteConsolidada: {
    gradoBachiller: string;
    tituloProfesional: string;
    asesorActual: string | null;
    tituloActual: string | null;
    dictaminante1Actual: string | null;
    dictaminante2Actual: string | null;
    dictaminante3Actual: string | null;
    dictaminantesCongeladosPorPaso6: boolean;
  };
}

export default function ExpedienteDetallePage() {
  const params = useParams<{ id: string }>();
  const expedienteId = params.id;

  const [ficha, setFicha] = useState<FichaExpedienteResponse | null>(null);
  const [docentesEmbudo, setDocentesEmbudo] = useState<DocenteElegible[]>([]);
  const [causas, setCausas] = useState<CausaCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  // Acción seleccionada actualmente en el panel derecho
  const [accionActiva, setAccionActiva] = useState<TipoAccionFormulario | null>(null);
  const [resolucionBorradorEditar, setResolucionBorradorEditar] =
    useState<ResolucionDetalle | null>(null);

  // Estados de formularios para Pasos 1 al 7 y Complementarias
  const [asesorId, setAsesorId] = useState('');
  const [tituloProyecto, setTituloProyecto] = useState('');
  const [dict1Id, setDict1Id] = useState('');
  const [dict2Id, setDict2Id] = useState('');
  const [dict3Id, setDict3Id] = useState('');
  const [tesistaSeleccionadoId, setTesistaSeleccionadoId] = useState('');
  const [numInformeSec, setNumInformeSec] = useState('INF-001-2026-SA-FCSA-UAC');
  const [fechaInformeSec, setFechaInformeSec] = useState(
    new Date().toISOString().slice(0, 10),
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
    new Date().toISOString().slice(0, 10),
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

  const cargarTodo = async () => {
    setCargando(true);
    try {
      const dataFicha = await apiFetch<FichaExpedienteResponse>(
        `/expedientes/${expedienteId}`,
        { servicio: 'titulacion' },
      );
      setFicha(dataFicha);

      const [listaElegibles, listaCausas] = await Promise.all([
        apiFetch<DocenteElegible[]>(
          `/docentes/elegibles?escuelaId=${dataFicha.escuelaProfesionalId}&incluirOtrosDepartamentos=true`,
          { servicio: 'titulacion' },
        ),
        apiFetch<CausaCatalogo[]>('/catalogos/causas', { servicio: 'titulacion' }),
      ]);

      setDocentesEmbudo(listaElegibles);
      setCausas(listaCausas);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (expedienteId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarTodo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedienteId]);

  if (cargando || !ficha) {
    return (
      <div className="py-16 text-center text-xs text-gray-500 animate-pulse">
        Cargando ficha integral del expediente y árbol de resoluciones...
      </div>
    );
  }

  const tesistasActivos = ficha.tesistas.filter((t) => t.estado !== 'DESISTIDO');

  const obtenerResolucionPorId = (resId: string | null) =>
    resId ? ficha.resoluciones.find((r) => r.id === resId) || null : null;

  const estaVigenteYFirmada = (resId: string | null): boolean => {
    const r = obtenerResolucionPorId(resId);
    return Boolean(
      r && r.situacionJuridica === 'VIGENTE' && r.estadoDocumental === 'FIRMADO',
    );
  };

  // Evaluación exacta de las 7 etapas secuenciales
  const p1Firmado = estaVigenteYFirmada(ficha.asesorResolucionId);
  const p2Firmado =
    estaVigenteYFirmada(ficha.dictaminantesResolucionId) &&
    estaVigenteYFirmada(ficha.tituloResolucionId) &&
    Boolean(ficha.dictaminante1Id);
  const p3Firmado = estaVigenteYFirmada(ficha.inscripcionResolucionId);
  const p4Firmado =
    Boolean(ficha.dictaminante3Id) &&
    estaVigenteYFirmada(ficha.dictaminantesResolucionId);
  const todosAptosFirmados =
    tesistasActivos.length > 0 &&
    tesistasActivos.every((t) => estaVigenteYFirmada(t.aptoResolucionId));
  const p6Firmado = estaVigenteYFirmada(ficha.fechaHoraResolucionId);
  const todosTituladosFirmados =
    tesistasActivos.length > 0 &&
    tesistasActivos.every((t) => estaVigenteYFirmada(t.tituloResolucionId));

  const etapas = [
    {
      numero: 1,
      tipo: 'ASESOR' as TipoAccionFormulario,
      nombre: '1. Nombramiento de Asesor',
      serie: 'ORD',
      completado: p1Firmado,
      enEmitido:
        Boolean(ficha.asesorResolucionId) && !p1Firmado,
      habilitado: ficha.estado === 'ACTIVO' && !ficha.asesorResolucionId,
      detalleEstado: !ficha.asesorResolucionId
        ? 'Listo para designar Docente Asesor.'
        : p1Firmado
          ? `Firmado (${ficha.informacionVigenteConsolidada.asesorActual})`
          : 'Resolución en estado EMITIDO (Confirme su firma para desbloquear el Paso 2).',
    },
    {
      numero: 2,
      tipo: 'DICTAMEN' as TipoAccionFormulario,
      nombre: '2. Dictamen de Proyecto (Título + 2 Dictaminantes)',
      serie: 'ORD',
      completado: p2Firmado,
      enEmitido:
        Boolean(ficha.dictaminantesResolucionId) &&
        !ficha.dictaminante3Id &&
        !p2Firmado,
      habilitado:
        ficha.estado === 'ACTIVO' && p1Firmado && !ficha.dictaminante1Id,
      detalleEstado: !p1Firmado
        ? 'Bloqueado: Requiere Paso 1 en estado VIGENTE + FIRMADO.'
        : p2Firmado
          ? 'Proyecto dictaminado y firmado.'
          : 'Resolución EMITIDA pendiente de firma.',
    },
    {
      numero: 3,
      tipo: 'INSCRIPCION' as TipoAccionFormulario,
      nombre: '3. Inscripción de Proyecto (Asiento en Libro)',
      serie: 'ORD',
      completado: p3Firmado,
      enEmitido: Boolean(ficha.inscripcionResolucionId) && !p3Firmado,
      habilitado:
        ficha.estado === 'ACTIVO' && p2Firmado && !ficha.inscripcionResolucionId,
      detalleEstado: !p2Firmado
        ? 'Bloqueado: Requiere Paso 2 en estado VIGENTE + FIRMADO.'
        : p3Firmado
          ? 'Proyecto inscrito en el Libro de la Escuela.'
          : 'Resolución EMITIDA pendiente de firma.',
    },
    {
      numero: 4,
      tipo: 'TERCER_DICT' as TipoAccionFormulario,
      nombre: '4. Tercer Dictaminante (Obligatorio)',
      serie: 'ORD',
      completado: p4Firmado,
      enEmitido: Boolean(ficha.dictaminante3Id) && !p4Firmado,
      habilitado:
        ficha.estado === 'ACTIVO' && p3Firmado && !ficha.dictaminante3Id,
      detalleEstado: !p3Firmado
        ? 'Bloqueado: Requiere Paso 3 en estado VIGENTE + FIRMADO.'
        : p4Firmado
          ? `Terna completa firmada (${ficha.informacionVigenteConsolidada.dictaminante3Actual}).`
          : 'Resolución EMITIDA pendiente de firma.',
    },
    {
      numero: 5,
      tipo: 'APTO' as TipoAccionFormulario,
      nombre: '5. Apto para Título Profesional (Individual por Tesista)',
      serie: 'CF',
      completado: todosAptosFirmados,
      enEmitido:
        tesistasActivos.some((t) => Boolean(t.aptoResolucionId)) &&
        !todosAptosFirmados,
      habilitado:
        ficha.estado === 'ACTIVO' &&
        p4Firmado &&
        tesistasActivos.some((t) => !t.aptoResolucionId),
      detalleEstado: !p4Firmado
        ? 'Bloqueado: Requiere Paso 4 en estado VIGENTE + FIRMADO.'
        : todosAptosFirmados
          ? 'Todos los tesistas activos cuentan con Apto CF firmado.'
          : 'Pendiente emitir o firmar Apto individual de tesista(s).',
    },
    {
      numero: 6,
      tipo: 'FECHA_HORA' as TipoAccionFormulario,
      nombre: '6. Fecha y Hora de Sustentación (Jurado de 4)',
      serie: 'ORD',
      completado: p6Firmado,
      enEmitido: Boolean(ficha.fechaHoraResolucionId) && !p6Firmado,
      habilitado:
        ficha.estado === 'ACTIVO' &&
        todosAptosFirmados &&
        !ficha.fechaHoraResolucionId,
      detalleEstado: !todosAptosFirmados
        ? 'Bloqueado: TODOS los tesistas activos deben tener su Apto VIGENTE + FIRMADO.'
        : p6Firmado
          ? 'Fecha, hora y Jurado firmados (Dictaminantes congelados).'
          : 'Resolución EMITIDA pendiente de firma.',
    },
    {
      numero: 7,
      tipo: 'TITULO' as TipoAccionFormulario,
      nombre: '7. Título Profesional (Calificación 14 a 20)',
      serie: 'CF',
      completado: todosTituladosFirmados,
      enEmitido:
        tesistasActivos.some((t) => Boolean(t.tituloResolucionId)) &&
        !todosTituladosFirmados,
      habilitado:
        ficha.estado === 'ACTIVO' &&
        p6Firmado &&
        tesistasActivos.some((t) => !t.tituloResolucionId),
      detalleEstado: !p6Firmado
        ? 'Bloqueado: Requiere Paso 6 en estado VIGENTE + FIRMADO.'
        : todosTituladosFirmados
          ? 'Expediente concluido (TITULADO).'
          : 'Listo para registrar nota entera (14-20) por tesista.',
    },
  ];

  // Preparar valores por defecto al abrir un formulario
  const abrirFormulario = (tipo: TipoAccionFormulario) => {
    setResolucionBorradorEditar(null);
    setAccionActiva(tipo);

    const disponiblesSinAsesor = docentesEmbudo.filter(
      (d) => d.id !== ficha.asesorDocenteId,
    );
    const disponiblesSinTerna = docentesEmbudo.filter(
      (d) =>
        ![
          ficha.asesorDocenteId,
          ficha.dictaminante1Id,
          ficha.dictaminante2Id,
          ficha.dictaminante3Id,
        ].includes(d.id),
    );

    if (tipo === 'ASESOR' && docentesEmbudo.length > 0) {
      setAsesorId(docentesEmbudo[0].id);
    }
    if (tipo === 'DICTAMEN' && disponiblesSinAsesor.length >= 2) {
      setDict1Id(disponiblesSinAsesor[0].id);
      setDict2Id(disponiblesSinAsesor[1].id);
    }
    if (tipo === 'TERCER_DICT' && disponiblesSinTerna.length > 0) {
      setDict3Id(disponiblesSinTerna[0].id);
    }
    if (tipo === 'APTO') {
      const sinApto = tesistasActivos.find((t) => !t.aptoResolucionId);
      if (sinApto) setTesistaSeleccionadoId(sinApto.id);
    }
    if (tipo === 'FECHA_HORA') {
      setPresidenteId(ficha.dictaminante1Id || '');
      setSecretarioId(ficha.dictaminante2Id || '');
      setVocalId(ficha.dictaminante3Id || '');
      const manana = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      setFechaSustProgramada(manana);
    }
    if (tipo === 'TITULO') {
      const sinTit = tesistasActivos.find((t) => !t.tituloResolucionId);
      if (sinTit) setTesistaSeleccionadoId(sinTit.id);
    }
    if (tipo === 'CAMBIO_ASESOR') {
      if (disponiblesSinTerna.length > 0) setAsesorId(disponiblesSinTerna[0].id);
      const c = causas.find((x) => x.ambito === 'CAMBIO_ASESOR');
      if (c) setCausaIdSeleccionada(c.id);
    }
    if (tipo === 'CAMBIO_TITULO') {
      setTituloProyecto(ficha.tituloActual || '');
    }
    if (tipo === 'CAMBIO_DICTAMINANTE') {
      setDictSalienteId(ficha.dictaminante3Id || ficha.dictaminante1Id || '');
      if (disponiblesSinTerna.length > 0) setDictEntranteId(disponiblesSinTerna[0].id);
      const c = causas.find((x) => x.ambito === 'CAMBIO_DICTAMINANTE');
      if (c) setCausaIdSeleccionada(c.id);
    }
    if (tipo === 'DESISTIMIENTO') {
      if (tesistasActivos.length > 0) setTesistaSeleccionadoId(tesistasActivos[0].id);
    }
    if (tipo === 'DSE') {
      const vigentes = ficha.resoluciones.filter(
        (r) => r.situacionJuridica === 'VIGENTE' && r.tipo !== 'DSE',
      );
      if (vigentes.length > 0) {
        setIdsAfectadosDse([vigentes[vigentes.length - 1].id]);
      }
      const c = causas.find((x) => x.ambito === 'DSE');
      if (c) setCausaIdSeleccionada(c.id);
    }
  };

  // Renderizado del selector de docentes agrupado por el Embudo de 3 Niveles
  const renderOpcionesEmbudo = (excluirIds: Array<string | null | undefined>) => {
    const filtrados = docentesEmbudo.filter((d) => !excluirIds.includes(d.id));
    const n1 = filtrados.filter((d) => d.nivelPrioridad === 1);
    const n2 = filtrados.filter((d) => d.nivelPrioridad === 2);
    const n3 = filtrados.filter((d) => d.nivelPrioridad === 3);

    return (
      <>
        {n1.length > 0 && (
          <optgroup label="★ Nivel 1: Docentes de la misma Escuela Profesional">
            {n1.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombreParaResolucion} ({d.escuelaProfesional.nombre.replace('Escuela Profesional de ', '')})
              </option>
            ))}
          </optgroup>
        )}
        {n2.length > 0 && (
          <optgroup label="● Nivel 2: Mismo Departamento Académico">
            {n2.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombreParaResolucion} ({d.departamentoAcademico.nombre.replace('Departamento Académico de ', '')})
              </option>
            ))}
          </optgroup>
        )}
        {n3.length > 0 && (
          <optgroup label="◆ Nivel 3: Otros Departamentos FCSa (Interdisciplinario)">
            {n3.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombreParaResolucion} — [{d.departamentoAcademico.nombre.replace('Departamento Académico de ', '')}]
              </option>
            ))}
          </optgroup>
        )}
      </>
    );
  };

  const calcularMencionPreview = (nota: number) => {
    if (nota < 14 || nota > 20) return 'BLOQUEADO (Nota debe ser entre 14 y 20)';
    if (nota <= 16) return 'APROBADO';
    if (nota <= 18) return 'APROBADO CON DISTINCIÓN';
    return 'APROBADO CON DISTINCIÓN Y FELICITACIÓN PÚBLICA';
  };

  // Enviar emisión al backend (Pasos 1-7 o Complementarias)
  const handleEjecutarEmision = async (e: FormEvent) => {
    e.preventDefault();
    if (!accionActiva) return;

    setProcesandoAccion(true);
    try {
      if (accionActiva === 'CORREGIR_BORRADOR' && resolucionBorradorEditar) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bodyPatch: Record<string, any> = {};
        if (resolucionBorradorEditar.tipo === 'DICTAMEN') {
          bodyPatch.tituloProyecto = tituloProyecto;
        } else if (resolucionBorradorEditar.tipo === 'APTO') {
          bodyPatch.numeroInformeSecretaria = numInformeSec;
        } else if (resolucionBorradorEditar.tipo === 'FECHA_HORA') {
          bodyPatch.horaSustentacion = horaSustProgramada;
          bodyPatch.lugarReferencia = lugarSust;
        } else if (resolucionBorradorEditar.tipo === 'TITULO') {
          bodyPatch.notaSustentacion = Number(notaSust);
        }

        const reg = await apiFetch<ResolucionDetalle>(
          `/resoluciones/${resolucionBorradorEditar.id}/corregir-borrador-emitido`,
          {
            servicio: 'titulacion',
            method: 'PATCH',
            body: JSON.stringify(bodyPatch),
          },
        );
        toast.success(
          `Borrador ${reg.numeroCompleto} actualizado a v${reg.versionPdf} (Nuevo Hash: ${reg.hashVersionGenerado}).`,
        );
      } else if (
        [
          'ASESOR',
          'DICTAMEN',
          'INSCRIPCION',
          'TERCER_DICT',
          'APTO',
          'FECHA_HORA',
          'TITULO',
        ].includes(accionActiva)
      ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: Record<string, any> = {};
        if (accionActiva === 'ASESOR') {
          payload = { asesorDocenteId: asesorId };
        } else if (accionActiva === 'DICTAMEN') {
          payload = {
            tituloProyecto,
            departamentoAcademicoId:
              ficha.escuelaProfesional.departamentoDefecto.id,
            dictaminante1Id: dict1Id,
            dictaminante2Id: dict2Id,
          };
        } else if (accionActiva === 'INSCRIPCION') {
          payload = {};
        } else if (accionActiva === 'TERCER_DICT') {
          payload = { dictaminante3Id: dict3Id };
        } else if (accionActiva === 'APTO') {
          payload = {
            tesistaId: tesistaSeleccionadoId,
            numeroInformeSecretaria: numInformeSec,
            fechaInformeSecretaria: fechaInformeSec,
          };
        } else if (accionActiva === 'FECHA_HORA') {
          payload = {
            presidenteDocenteId: presidenteId,
            secretarioDocenteId: secretarioId,
            vocalDocenteId: vocalId,
            fechaSustentacion: fechaSustProgramada,
            horaSustentacion: horaSustProgramada,
            modalidad: modalidadSust,
            lugarReferencia: lugarSust,
          };
        } else if (accionActiva === 'TITULO') {
          payload = {
            tesistaId: tesistaSeleccionadoId,
            notaSustentacion: Number(notaSust),
            fechaSustentacionReal: fechaSustReal,
          };
        }

        const creada = await apiFetch<ResolucionDetalle>(
          `/expedientes/${ficha.id}/pasos/${accionActiva}`,
          {
            servicio: 'titulacion',
            method: 'POST',
            body: JSON.stringify(payload),
          },
        );
        toast.success(
          `Resolución ${creada.numeroCompleto} emitida con éxito (Estado: EMITIDO).`,
        );
      } else if (accionActiva === 'CAMBIO_ASESOR') {
        const res = await apiFetch<ResolucionDetalle>(
          `/expedientes/${ficha.id}/complementarias/cambio-asesor`,
          {
            servicio: 'titulacion',
            method: 'POST',
            body: JSON.stringify({
              nuevoAsesorDocenteId: asesorId,
              causaId: Number(causaIdSeleccionada),
              ...(detalleCausaManual.trim()
                ? { detalleCausaManual: detalleCausaManual.trim() }
                : {}),
            }),
          },
        );
        toast.success(`Cambio de Asesor ${res.numeroCompleto} emitido.`);
      } else if (accionActiva === 'CAMBIO_TITULO') {
        const res = await apiFetch<ResolucionDetalle>(
          `/expedientes/${ficha.id}/complementarias/cambio-titulo`,
          {
            servicio: 'titulacion',
            method: 'POST',
            body: JSON.stringify({ nuevoTitulo: tituloProyecto }),
          },
        );
        toast.success(`Cambio de Título ${res.numeroCompleto} emitido.`);
      } else if (accionActiva === 'CAMBIO_DICTAMINANTE') {
        const res = await apiFetch<ResolucionDetalle>(
          `/expedientes/${ficha.id}/complementarias/cambio-dictaminante`,
          {
            servicio: 'titulacion',
            method: 'POST',
            body: JSON.stringify({
              dictaminanteSalienteId: dictSalienteId,
              dictaminanteEntranteId: dictEntranteId,
              causaId: Number(causaIdSeleccionada),
              ...(detalleCausaManual.trim()
                ? { detalleCausaManual: detalleCausaManual.trim() }
                : {}),
            }),
          },
        );
        toast.success(`Cambio de Dictaminante ${res.numeroCompleto} emitido.`);
      } else if (accionActiva === 'DESISTIMIENTO') {
        const res = await apiFetch<ResolucionDetalle>(
          `/expedientes/${ficha.id}/complementarias/desistimiento`,
          {
            servicio: 'titulacion',
            method: 'POST',
            body: JSON.stringify({
              tesistaDesistenteId: tesistaSeleccionadoId,
              referenciaSolicitudExterna: refSolicitudDesistimiento,
              ...(fundamentoDesistimiento.trim()
                ? { fundamentoSolicitud: fundamentoDesistimiento.trim() }
                : {}),
            }),
          },
        );
        toast.success(`Desistimiento ${res.numeroCompleto} emitido.`);
      } else if (accionActiva === 'DSE') {
        const res = await apiFetch<ResolucionDetalle>(
          `/expedientes/${ficha.id}/complementarias/dse`,
          {
            servicio: 'titulacion',
            method: 'POST',
            body: JSON.stringify({
              serie: serieDse,
              resolucionesAfectadasIds: idsAfectadosDse,
              causaId: Number(causaIdSeleccionada),
              reinicioIntegral: reinicioIntegralDse,
              ...(detalleCausaManual.trim()
                ? { detalleCausaManual: detalleCausaManual.trim() }
                : {}),
            }),
          },
        );
        toast.success(
          `Resolución DSE ${res.numeroCompleto} emitida. Punteros del expediente recalculados.`,
        );
      }

      setAccionActiva(null);
      await cargarTodo();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Ocurrió un error al procesar la resolución.');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleConfirmarFirma = async (res: ResolucionDetalle) => {
    try {
      await apiFetch(`/resoluciones/${res.id}/confirmar-firma`, {
        servicio: 'titulacion',
        method: 'PATCH',
      });
      toast.success(
        `Firma confirmada: ${res.numeroCompleto} pasó a estado FIRMADO e inmutable.`,
      );
      await cargarTodo();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
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
      nombre: ficha.informacionVigenteConsolidada.dictaminante1Actual || 'Dictaminante 1',
    },
    {
      id: ficha.dictaminante2Id || '',
      nombre: ficha.informacionVigenteConsolidada.dictaminante2Actual || 'Dictaminante 2',
    },
    {
      id: ficha.dictaminante3Id || '',
      nombre: ficha.informacionVigenteConsolidada.dictaminante3Actual || 'Dictaminante 3',
    },
  ].filter((x) => Boolean(x.id));

  const causaSeleccionadaObj = causas.find(
    (c) => c.id === Number(causaIdSeleccionada),
  );

  return (
    <div className="space-y-6">
      {/* Barra Superior de Regreso y Estado General */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/expedientes"
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-base font-extrabold text-[#0B2B5A]">
                {ficha.codigoExpediente}
              </span>
              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded">
                {ficha.escuelaProfesional.nombre}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Grado: <b>{ficha.escuelaProfesional.gradoBachiller}</b> → Título:{' '}
              <b>{ficha.escuelaProfesional.tituloProfesional}</b>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {ficha.informacionVigenteConsolidada.dictaminantesCongeladosPorPaso6 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <Lock className="w-3.5 h-3.5" />
              <span>Dictaminantes Congelados (Paso 6 Vigente)</span>
            </span>
          )}

          <span
            className={`px-3.5 py-1 rounded-full text-xs font-extrabold ${
              ficha.estado === 'ACTIVO'
                ? 'bg-blue-100 text-blue-800'
                : ficha.estado === 'TITULADO'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
            }`}
          >
            EXPEDIENTE: {ficha.estado}
          </span>
        </div>
      </div>

      {/* =================================================================== */}
      {/* GRILLA PRINCIPAL: IZQUIERDA (7 PASOS + DATOS) | DERECHA (FORMULARIO)*/}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA (7 Columnas) */}
        <div className="xl:col-span-7 space-y-6">
          {/* 1. Punteros Consolidados Vigentes del Expediente */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Información Vigente Consolidada del Expediente
              </h3>
              {ficha.asientosLibroInscripcion[0] && (
                <span className="font-mono text-xs font-bold bg-blue-50 text-[#0B2B5A] px-2.5 py-1 rounded border border-blue-200">
                  Folio Libro: {ficha.asientosLibroInscripcion[0].numeroFolioFormateado} (
                  {ficha.asientosLibroInscripcion[0].estadoAsiento})
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
                  {ficha.informacionVigenteConsolidada.asesorActual || 'Sin designar'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <span className="text-[10px] font-bold uppercase text-gray-400 block">
                  Terna de Dictaminantes Vigente:
                </span>
                <div className="font-semibold text-gray-800 space-y-0.5 mt-0.5">
                  <p>
                    1. {ficha.informacionVigenteConsolidada.dictaminante1Actual || '—'}
                  </p>
                  <p>
                    2. {ficha.informacionVigenteConsolidada.dictaminante2Actual || '—'}
                  </p>
                  <p>
                    3. {ficha.informacionVigenteConsolidada.dictaminante3Actual || '—'}
                  </p>
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
                      return (
                        <tr key={t.id}>
                          <td className="py-2 font-bold text-gray-900">
                            {t.nombresApellidos}
                          </td>
                          <td className="py-2 font-mono">{t.codigoEstudiante}</td>
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
                              ? `${rTit.numeroCompleto} [Nota: ${t.notaSustentacion} - ${t.resultadoSustentacion}] (${rTit.estadoDocumental})`
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
            <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-gray-500 mr-1">
                Complementarias:
              </span>
              <button
                type="button"
                onClick={() => abrirFormulario('CAMBIO_ASESOR')}
                disabled={!p1Firmado || ficha.estado !== 'ACTIVO'}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-40"
              >
                Cambio de Asesor
              </button>
              <button
                type="button"
                onClick={() => abrirFormulario('CAMBIO_TITULO')}
                disabled={!p2Firmado || ficha.estado !== 'ACTIVO'}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-40"
              >
                Cambio de Título (DICE/DEBE DECIR)
              </button>
              <button
                type="button"
                onClick={() => abrirFormulario('CAMBIO_DICTAMINANTE')}
                disabled={
                  !p4Firmado ||
                  Boolean(ficha.fechaHoraResolucionId) ||
                  ficha.estado !== 'ACTIVO'
                }
                title={
                  ficha.fechaHoraResolucionId
                    ? 'Bloqueado por RN-CD-20: Los dictaminantes están congelados en Paso 6'
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
                  Boolean(ficha.fechaHoraResolucionId) ||
                  ficha.estado !== 'ACTIVO'
                }
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 disabled:opacity-40"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Desistimiento</span>
              </button>
              <button
                type="button"
                onClick={() => abrirFormulario('DSE')}
                disabled={ficha.resoluciones.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-100 hover:bg-rose-200 text-rose-900 disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Dejar Sin Efecto (DSE)</span>
              </button>
            </div>
          </div>

          {/* 2. Flujo Secuencial de los 7 Pasos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
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
                              ? 'bg-[#0B2B5A] text-white'
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

                  {etapa.habilitado && (
                    <button
                      type="button"
                      onClick={() => abrirFormulario(etapa.tipo)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#0B2B5A] hover:bg-[#082044] text-white text-xs font-bold shadow-xs transition"
                    >
                      Preparar Paso {etapa.numero}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* COLUMNA DERECHA (5 Columnas): PANEL DE EMISIÓN Y FORMULARIO ACTIVO  */}
        {/* =================================================================== */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm sticky top-20">
            {!accionActiva ? (
              <div className="py-12 text-center space-y-2">
                <Sparkles className="w-8 h-8 text-[#0B2B5A] mx-auto opacity-70" />
                <h3 className="text-sm font-bold text-gray-900">
                  Asistente de Emisión de Resoluciones
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Seleccione el botón <b>&quot;Preparar Paso&quot;</b> en la línea de progreso o cualquiera de las <b>Resoluciones Complementarias</b> para abrir su formulario validado.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEjecutarEmision} className="space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <h3 className="text-sm font-bold text-[#0B2B5A]">
                    {accionActiva === 'CORREGIR_BORRADOR'
                      ? `Corregir Borrador EMITIDO (${resolucionBorradorEditar?.numeroCompleto})`
                      : `Formulario de Emisión: ${accionActiva}`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setAccionActiva(null)}
                    className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ✕ Cerrar
                  </button>
                </div>

                {/* PASO 1: NOMBRAMIENTO DE ASESOR */}
                {accionActiva === 'ASESOR' && (
                  <div className="space-y-3">
                    <label className="block font-bold text-gray-700">
                      Seleccionar Docente Asesor (Embudo de 3 Niveles):
                    </label>
                    <select
                      value={asesorId}
                      onChange={(e) => setAsesorId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2.5 text-xs bg-white"
                    >
                      {renderOpcionesEmbudo([])}
                    </select>
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
                      <select
                        value={dict1Id}
                        onChange={(e) => setDict1Id(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        {renderOpcionesEmbudo([ficha.asesorDocenteId])}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        Dictaminante 2 (Excluye Asesor y Dictaminante 1):
                      </label>
                      <select
                        value={dict2Id}
                        onChange={(e) => setDict2Id(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        {renderOpcionesEmbudo([ficha.asesorDocenteId, dict1Id])}
                      </select>
                    </div>
                  </div>
                )}

                {/* PASO 3: INSCRIPCIÓN DE PROYECTO */}
                {accionActiva === 'INSCRIPCION' && (
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1.5">
                    <p className="font-bold text-[#0B2B5A]">
                      Generación Automática de Asiento en Libro de Inscripción
                    </p>
                    <p className="text-gray-700">
                      <b>Título a inscribir:</b> {ficha.tituloActual}
                    </p>
                    <p className="text-[11px] text-gray-600">
                      Al confirmar, el sistema asignará un número ORD y creará el folio correlativo anual en el Libro de Inscripción de la{' '}
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
                    <select
                      value={dict3Id}
                      onChange={(e) => setDict3Id(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2.5 text-xs bg-white"
                    >
                      {renderOpcionesEmbudo([
                        ficha.asesorDocenteId,
                        ficha.dictaminante1Id,
                        ficha.dictaminante2Id,
                      ])}
                    </select>
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
                        onChange={(e) => setTesistaSeleccionadoId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        {tesistasActivos
                          .filter((t) => !t.aptoResolucionId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nombresApellidos} ({t.codigoEstudiante})
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
                      Distribuya los 3 Dictaminantes vigentes en los cargos de Presidente, Secretario y Vocal. El Asesor (<b>{ficha.informacionVigenteConsolidada.asesorActual}</b>) se integra automáticamente como 4.° miembro.
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
                          Fecha Programada (Futura):
                        </label>
                        <input
                          type="date"
                          required
                          value={fechaSustProgramada}
                          onChange={(e) => setFechaSustProgramada(e.target.value)}
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
                          onChange={(e) => setHoraSustProgramada(e.target.value)}
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
                        onChange={(e) => setTesistaSeleccionadoId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        {tesistasActivos
                          .filter((t) => !t.tituloResolucionId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.nombresApellidos} ({t.codigoEstudiante})
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
                        Mención Calculada Automáticamente en Servidor (RB-TP-12):
                      </span>
                      <span className="font-extrabold text-[#0B2B5A] text-xs">
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
                      <select
                        value={asesorId}
                        onChange={(e) => setAsesorId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        {renderOpcionesEmbudo([
                          ficha.asesorDocenteId,
                          ficha.dictaminante1Id,
                          ficha.dictaminante2Id,
                          ficha.dictaminante3Id,
                        ])}
                      </select>
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
                          onChange={(e) => setDetalleCausaManual(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* COMPLEMENTARIA 2: CAMBIO DE TÍTULO (DICE / DEBE DECIR - SIN CAUSA POR RN-CT-16) */}
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
                      <label className="block font-bold text-[#0B2B5A] mb-1">
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
                      <select
                        value={dictEntranteId}
                        onChange={(e) => setDictEntranteId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        {renderOpcionesEmbudo([
                          ficha.asesorDocenteId,
                          ficha.dictaminante1Id,
                          ficha.dictaminante2Id,
                          ficha.dictaminante3Id,
                        ])}
                      </select>
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
                        onChange={(e) => setTesistaSeleccionadoId(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white"
                      >
                        {tesistasActivos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombresApellidos} ({t.codigoEstudiante})
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
                        {ficha.resoluciones
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
                                    setIdsAfectadosDse((prev) => [...prev, r.id]);
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
                    <label className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reinicioIntegralDse}
                        onChange={(e) => setReinicioIntegralDse(e.target.checked)}
                      />
                      <span>
                        Aplicar Reinicio Integral (Pasa el Expediente a ANULADO)
                      </span>
                    </label>
                  </div>
                )}

                {/* CORRECCIÓN DE BORRADOR EN ESTADO EMITIDO */}
                {accionActiva === 'CORREGIR_BORRADOR' &&
                  resolucionBorradorEditar && (
                    <div className="space-y-3">
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                        Esta resolución sigue en estado <b>EMITIDO</b>. Al guardar, conservará el mismo número correlativo (<b>{resolucionBorradorEditar.numeroCompleto}</b>), incrementará a <b>v{resolucionBorradorEditar.versionPdf + 1}</b> y generará un nuevo código HASH.
                      </div>
                      {resolucionBorradorEditar.tipo === 'DICTAMEN' && (
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            Corregir Título del Proyecto:
                          </label>
                          <textarea
                            rows={3}
                            required
                            value={tituloProyecto}
                            onChange={(e) => setTituloProyecto(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase"
                          />
                        </div>
                      )}
                      {resolucionBorradorEditar.tipo === 'APTO' && (
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            Corregir N.° de Informe de Secretaría Académica:
                          </label>
                          <input
                            type="text"
                            required
                            value={numInformeSec}
                            onChange={(e) => setNumInformeSec(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-xs uppercase"
                          />
                        </div>
                      )}
                      {resolucionBorradorEditar.tipo === 'FECHA_HORA' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block font-bold text-gray-700 mb-1">
                              Nueva Hora:
                            </label>
                            <input
                              type="time"
                              value={horaSustProgramada}
                              onChange={(e) =>
                                setHoraSustProgramada(e.target.value)
                              }
                              className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-gray-700 mb-1">
                              Nuevo Lugar:
                            </label>
                            <input
                              type="text"
                              value={lugarSust}
                              onChange={(e) => setLugarSust(e.target.value)}
                              className="w-full rounded-lg border border-gray-300 p-2 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      {resolucionBorradorEditar.tipo === 'TITULO' && (
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">
                            Corregir Nota Entera (14 a 20):
                          </label>
                          <input
                            type="number"
                            min={14}
                            max={20}
                            value={notaSust}
                            onChange={(e) => setNotaSust(Number(e.target.value))}
                            className="w-full rounded-lg border border-gray-300 p-2 text-xs font-bold"
                          />
                        </div>
                      )}
                    </div>
                  )}

                <button
                  type="submit"
                  disabled={procesandoAccion}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0B2B5A] py-2.5 px-4 text-xs font-bold text-white shadow hover:bg-[#082044] disabled:opacity-60 transition"
                >
                  {procesandoAccion ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando Transacción...</span>
                    </>
                  ) : (
                    <span>
                      {accionActiva === 'CORREGIR_BORRADOR'
                        ? 'Regenerar PDF Conservando Número'
                        : 'Confirmar Emisión y Asignar Número Oficial'}
                    </span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* HISTORIAL DOCUMENTAL INMUTABLE DEL EXPEDIENTE                       */}
      {/* =================================================================== */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Historial Documental del Expediente ({ficha.resoluciones.length})
            </h3>
            <p className="text-xs text-gray-500">
              Cadena de antecedentes, Sello de Doble Vía (ID-TRAMITE + HASH) y descarga de PDF oficial
            </p>
          </div>
          <button
            type="button"
            onClick={cargarTodo}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B2B5A] hover:underline"
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
              {ficha.resoluciones.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-gray-400 italic"
                  >
                    Aún no se han emitido resoluciones en este expediente.
                  </td>
                </tr>
              ) : (
                [...ficha.resoluciones].reverse().map((res) => (
                  <tr key={res.id} className="hover:bg-gray-50/70">
                    <td className="py-3 px-3 font-mono font-bold text-[#0B2B5A]">
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
                      {res.idTramiteControl} | v{res.versionPdf} (
                      {res.hashVersionGenerado.slice(0, 8)})
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleVerPdf(res)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0B2B5A] text-white text-[11px] font-semibold hover:bg-[#082044]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Ver PDF</span>
                      </button>

                      {res.estadoDocumental === 'EMITIDO' &&
                        res.situacionJuridica === 'VIGENTE' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setResolucionBorradorEditar(res);
                                setTituloProyecto(
                                  String(
                                    res.datosEspecificos?.tituloProyecto ||
                                      ficha.tituloActual ||
                                      '',
                                  ),
                                );
                                setAccionActiva('CORREGIR_BORRADOR');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-gray-300 bg-white text-gray-700 text-[11px] font-semibold hover:bg-gray-100"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Regenerar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleConfirmarFirma(res)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              <span>Confirmar Firma</span>
                            </button>
                          </>
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