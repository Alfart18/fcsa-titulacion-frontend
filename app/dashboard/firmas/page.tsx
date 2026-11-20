// Archivo: app/dashboard/firmas/page.tsx
'use client';

import React, { useEffect, useState, useRef, DragEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import {
  FileSignature,
  FolderArchive,
  UploadCloud,
  FileText,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Download,
  Eye,
  Loader2,
  ExternalLink,
  Search,
  ChevronRight,
  PanelLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  abrirPdfAutenticado,
  apiFetch,
  ApiError,
  descargarZipPendientesApi,
  MicroservicioDestino,
} from '@/lib/api';
import { useSidebar } from '../sidebar-context';

interface ResolucionPendienteItem {
  id: string;
  numeroCompleto: string;
  serie: 'ORD' | 'CF';
  tipo: string;
  fechaEmision: string;
  nombreDecanoSnapshot: string;
  idTramiteControl: string;
  versionPdf: number;
  hashVersionGenerado: string;
  expediente: {
    id: string;
    codigoExpediente: string;
    escuelaProfesional: {
      nombre: string;
    };
  } | null;
}

interface ResultadoArchivoLote {
  nombreArchivo: string;
  sha256Archivo: string;
  exito: boolean;
  resolucionId?: string;
  numeroCompleto?: string;
  idTramiteDetectado?: string;
  metodoIdentificacion?:
    | 'NIVEL_1_METADATOS'
    | 'NIVEL_2_PIE_PAGINA_STREAM'
    | 'NIVEL_3_NUMERO_RESOLUCION';
  firmanteCertificado?: string;
  expedienteCerradoComoTitulado?: boolean;
  codigoError?: string;
  mensajeError?: string;
}

interface RespuestaValidacionLote {
  totalRecibidos: number;
  exitosos: number;
  fallidos: number;
  procesados: ResultadoArchivoLote[];
  errores: ResultadoArchivoLote[];
}

export default function FirmasLotesPage() {
  const { sidebarAbierto, toggleSidebar } = useSidebar();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estado de resoluciones pendientes (EMITIDO + VIGENTE)
  const [pendientes, setPendientes] = useState<ResolucionPendienteItem[]>([]);
  const [serieFiltro, setSerieFiltro] = useState<'' | 'ORD' | 'CF'>('');
  const [busqueda, setBusqueda] = useState('');
  const [cargandoPendientes, setCargandoPendientes] = useState(true);
  const [descargandoZip, setDescargandoZip] = useState(false);

  // Estado de la Bandeja Drag-and-Drop de archivos PDF
  const [archivosEnBandeja, setArchivosEnBandeja] = useState<File[]>([]);
  const [arrastrandoSobreZona, setArrastrandoSobreZona] = useState(false);
  const [validandoLote, setValidandoLote] = useState(false);
  const [resultadoLote, setResultadoLote] =
    useState<RespuestaValidacionLote | null>(null);

  const cargarPendientes = async () => {
    setCargandoPendientes(true);
    try {
      const query = serieFiltro ? `?serie=${serieFiltro}` : '';
      const data = await apiFetch<ResolucionPendienteItem[]>(
        `/firmas/pendientes${query}`,
        { servicio: 'firmas' },
      );
      setPendientes(data);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudieron cargar las resoluciones pendientes de firma.');
    } finally {
      setCargandoPendientes(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarPendientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serieFiltro]);

  const pendientesFiltrados = pendientes.filter((item) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      item.numeroCompleto.toLowerCase().includes(q) ||
      item.idTramiteControl.toLowerCase().includes(q) ||
      item.tipo.toLowerCase().includes(q) ||
      (item.expediente?.codigoExpediente.toLowerCase().includes(q) ?? false) ||
      (item.expediente?.escuelaProfesional?.nombre.toLowerCase().includes(q) ?? false)
    );
  });

  // 1. Abrir o descargar PDF autenticado con manejo de errores
  const handleAbrirPdf = async (
    endpoint: string,
    servicio: MicroservicioDestino,
    descargar = false,
    nombreArchivo?: string,
  ) => {
    try {
      await abrirPdfAutenticado(endpoint, servicio, descargar, nombreArchivo);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('No se pudo obtener el documento PDF.');
    }
  };

  // 2. Descargar paquete ZIP masivo
  const handleDescargarZipMasivo = async () => {
    setDescargandoZip(true);
    try {
      await descargarZipPendientesApi({
        serie: serieFiltro || undefined,
      });
      toast.success(
        'Paquete ZIP generado con resoluciones pendientes y manifiesto_lote.json.',
      );
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Error al generar el paquete ZIP de pendientes.');
    } finally {
      setDescargandoZip(false);
    }
  };

  // 3. Gestión de archivos en la Bandeja Drag-and-Drop
  const agregarArchivosABandeja = (nuevos: File[]) => {
    setArchivosEnBandeja((prev) => {
      const mapa = new Map<string, File>();
      for (const f of prev) mapa.set(`${f.name}-${f.size}`, f);
      for (const f of nuevos) mapa.set(`${f.name}-${f.size}`, f);
      return Array.from(mapa.values()).slice(0, 50);
    });
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrandoSobreZona(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrandoSobreZona(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setArrastrandoSobreZona(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const lista = Array.from(e.dataTransfer.files);
      agregarArchivosABandeja(lista);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const lista = Array.from(e.target.files);
      agregarArchivosABandeja(lista);
      e.target.value = '';
    }
  };

  const eliminarArchivoDeBandeja = (index: number) => {
    setArchivosEnBandeja((prev) => prev.filter((_, idx) => idx !== index));
  };

  // 4. Enviar lote de PDFs al validador criptográfico (POST /api/firmas/validar-lote)
  const handleValidarLote = async () => {
    if (archivosEnBandeja.length === 0) {
      toast.error('Arrastre o seleccione al menos un archivo PDF para validar.');
      return;
    }

    setValidandoLote(true);
    setResultadoLote(null);

    try {
      const formData = new FormData();
      for (const file of archivosEnBandeja) {
        formData.append('archivos', file);
      }

      const respuesta = await apiFetch<RespuestaValidacionLote>(
        '/firmas/validar-lote',
        {
          servicio: 'firmas',
          method: 'POST',
          body: formData,
        },
      );

      setResultadoLote(respuesta);

      if (respuesta.exitosos > 0 && respuesta.fallidos === 0) {
        toast.success(
          `Lote validado con éxito: ${respuesta.exitosos} resolución(es) pasaron a FIRMADO.`,
        );
        setArchivosEnBandeja([]);
      } else if (respuesta.exitosos > 0 && respuesta.fallidos > 0) {
        toast.warning(
          `Procesamiento parcial con aislamiento de fallos: ${respuesta.exitosos} exitosos y ${respuesta.fallidos} rechazados.`,
        );
        setArchivosEnBandeja([]);
      } else {
        toast.error(
          `Ningún archivo superó la validación criptográfica (${respuesta.fallidos} rechazados y auditados).`,
        );
      }

      await cargarPendientes();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error('Error al comunicarse con firmas-service (Puerto 4003).');
    } finally {
      setValidandoLote(false);
    }
  };

  const formatearTamano = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* 1. Header con Breadcrumbs y Botón de Sidebar */}
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
          <span className="font-medium text-gray-800">Lotes y Firmas PKCS#7</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Firmas Digitales y Validación PKCS#7
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1 max-w-3xl">
              Descarga individual o masiva en ZIP para firma digital externa (Tocapu) y recepción con verificación criptográfica de integridad SHA-256.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={cargarPendientes}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${cargandoPendientes ? 'animate-spin' : ''}`}
              />
              <span>Actualizar Bandeja</span>
            </button>

            <button
              type="button"
              onClick={handleDescargarZipMasivo}
              disabled={pendientes.length === 0 || descargandoZip}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E73BE] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#175B96] disabled:opacity-50 transition-colors"
            >
              {descargandoZip ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderArchive className="w-4 h-4" />
              )}
              <span>
                Descargar Lote Pendientes .ZIP ({pendientes.length})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. GRILLA DE 2 COLUMNAS: PENDIENTES DE FIRMA | DRAG & DROP          */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA (7 Columnas): Resoluciones en estado EMITIDO */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            {/* Cabecera de tarjeta y filtros */}
            <div className="p-6 border-b border-gray-100 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                    <FileSignature className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      1. Resoluciones Pendientes de Firma
                    </h2>
                    <p className="text-xs text-gray-500">
                      Documentos emitidos y vigentes en estado EMITIDO
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {(['', 'ORD', 'CF'] as const).map((s) => (
                    <button
                      key={s || 'TODAS'}
                      type="button"
                      onClick={() => setSerieFiltro(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        serieFiltro === s
                          ? 'bg-[#1E73BE] text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s === '' ? 'Todas' : `Serie ${s}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Filtrar por número (0001-2026...), ID-Trámite, tipo, escuela o expediente..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 pl-10 pr-4 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-[#1E73BE] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              {/* Guía breve del flujo oficial con Tocapu */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-gray-700 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#1E73BE] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <span className="font-semibold text-gray-900">
                    Flujo oficial con Tocapu:
                  </span>{' '}
                  descargue cada PDF o el paquete <span className="font-semibold">.ZIP</span>{' '}
                  (con <span className="font-mono text-[11px]">manifiesto_lote.json</span>),
                  firme con certificado digital X.509 en <span className="font-semibold">Tocapu</span>{' '}
                  (PAdES / PKCS#7) y suba los archivos firmados en el panel derecho.
                </p>
              </div>
            </div>

            {/* Tabla de resoluciones pendientes */}
            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-3 px-4">Resolución / Exp.</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Sello Doble Vía</th>
                    <th className="py-3 px-4 text-right">PDF Sin Firma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendientesFiltrados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-12 text-center text-sm text-gray-400"
                      >
                        {cargandoPendientes
                          ? 'Consultando resoluciones en estado EMITIDO...'
                          : '¡Excelente! No hay resoluciones pendientes de firma en este momento.'}
                      </td>
                    </tr>
                  ) : (
                    pendientesFiltrados.map((res) => (
                      <tr key={res.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3.5 px-4 align-top">
                          <span className="font-mono font-bold text-[#1E73BE] block">
                            {res.numeroCompleto}
                          </span>
                          {res.expediente ? (
                            <>
                              <Link
                                href={`/dashboard/expedientes/${res.expediente.id}`}
                                className="text-[11px] text-gray-500 hover:text-[#1E73BE] hover:underline inline-flex items-center gap-1 mt-0.5"
                              >
                                <span>{res.expediente.codigoExpediente}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                              <span className="block text-[10px] text-gray-400 truncate max-w-[180px] mt-0.5">
                                {res.expediente.escuelaProfesional.nombre}
                              </span>
                            </>
                          ) : (
                            <span className="block text-[11px] text-gray-400 mt-0.5">
                              Sin expediente asociado
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <span className="font-semibold text-gray-800 block">
                            {res.tipo}
                          </span>
                          <span
                            className={`inline-block mt-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                              res.serie === 'CF'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-blue-50 text-[#1E73BE] border-blue-200'
                            }`}
                          >
                            Serie {res.serie}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 align-top font-mono text-[10px] text-gray-600">
                          <span className="block font-semibold text-gray-800">
                            {res.idTramiteControl}
                          </span>
                          <span className="block mt-0.5 text-gray-500">
                            v{res.versionPdf} · HASH:{' '}
                            {res.hashVersionGenerado.slice(0, 8)}...
                          </span>
                        </td>

                        <td className="py-3.5 px-4 align-top text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                handleAbrirPdf(
                                  `/documentos/${res.id}/pdf`,
                                  'documentos',
                                  false,
                                )
                              }
                              title="Visualizar PDF emitido sin firma"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-[11px] font-semibold hover:bg-gray-100 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleAbrirPdf(
                                  `/documentos/${res.id}/pdf`,
                                  'documentos',
                                  true,
                                  `${res.numeroCompleto}_v${res.versionPdf}.pdf`,
                                )
                              }
                              title="Descargar PDF emitido para firmar en Tocapu"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1E73BE] text-white text-[11px] font-semibold hover:bg-[#175B96] transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Descargar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/70 text-xs text-gray-500 flex flex-wrap justify-between items-center gap-2">
            <span>
              Total pendientes de firma:{' '}
              <b className="text-gray-800">{pendientes.length}</b> resolución(es)
            </span>
            <span>
              Firme en <b className="text-gray-700">Tocapu</b> y valide en el panel derecho
            </span>
          </div>
        </div>

        {/* COLUMNA DERECHA (5 Columnas): Zona Drag-and-Drop de Subida en Lote */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <UploadCloud className="w-5 h-5 text-[#1E73BE]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  2. Recepción y Validación de Lote
                </h2>
                <p className="text-xs text-gray-500">
                  Arrastre de 1 a 50 PDFs firmados (aislamiento archivo por archivo)
                </p>
              </div>
            </div>

            {/* Zona Interactiva Drag and Drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                arrastrandoSobreZona
                  ? 'border-[#1E73BE] bg-blue-50/70 scale-[1.01]'
                  : 'border-gray-200 hover:border-[#1E73BE] bg-gray-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,application/pdf"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mx-auto mb-3">
                <UploadCloud className="w-6 h-6 text-[#1E73BE]" />
              </div>
              <p className="text-sm font-semibold text-gray-800">
                Arrastre y suelte los PDFs firmados aquí
              </p>
              <p className="text-xs text-gray-500 mt-1">
                o haga clic para seleccionar desde su equipo
              </p>
              <p className="text-[11px] text-gray-400 mt-2">
                Verifica cabecera %PDF-, cascada de 3 niveles (ID-TRAMITE + HASH) y firma PKCS#7 / CAdES
              </p>
            </div>

            {/* Lista de archivos actualmente en cola para validar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">
                  Archivos en bandeja ({archivosEnBandeja.length})
                </span>
                {archivosEnBandeja.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setArchivosEnBandeja([])}
                    className="text-rose-600 hover:underline font-semibold text-[11px]"
                  >
                    Vaciar bandeja
                  </button>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-gray-50/50">
                {archivosEnBandeja.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    Ningún archivo en cola. Arrastre sus PDFs firmados o haga clic arriba para seleccionarlos.
                  </div>
                ) : (
                  archivosEnBandeja.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="p-2.5 px-3.5 flex items-center justify-between gap-2 text-xs bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-[#1E73BE] shrink-0" />
                        <div className="truncate">
                          <p className="font-semibold text-gray-800 truncate">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {formatearTamano(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminarArchivoDeBandeja(idx)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Quitar archivo de la bandeja"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Botón Principal de Validación de Lote */}
          <button
            type="button"
            disabled={archivosEnBandeja.length === 0 || validandoLote}
            onClick={handleValidarLote}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1E73BE] py-3 px-4 text-xs font-bold text-white shadow-sm hover:bg-[#175B96] disabled:opacity-50 transition-colors"
          >
            {validandoLote ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando firmas PKCS#7 y /ByteRange...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>
                  Validar Lote Criptográficamente ({archivosEnBandeja.length}{' '}
                  archivo{archivosEnBandeja.length === 1 ? '' : 's'})
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. REPORTE FORENSE Y RESULTADO DEL LOTE PROCESADO                   */}
      {/* =================================================================== */}
      {resultadoLote && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Reporte de Validación Criptográfica del Lote
                </h3>
                <p className="text-xs text-gray-500">
                  Cada archivo fue verificado en una transacción independiente con registro en Auditoría
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold flex-wrap">
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                Recibidos: {resultadoLote.totalRecibidos}
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Exitosos (FIRMADO): {resultadoLote.exitosos}
              </span>
              <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                Rechazados: {resultadoLote.fallidos}
              </span>
            </div>
          </div>

          {/* 1. Lista de Archivos Exitosos */}
          {resultadoLote.procesados.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Resoluciones Validadas y Pasadas a Estado FIRMADO (
                  {resultadoLote.procesados.length})
                </span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resultadoLote.procesados.map((item, idx) => (
                  <div
                    key={`${item.nombreArchivo}-${idx}`}
                    className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-emerald-950">
                        {item.numeroCompleto}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {item.metodoIdentificacion}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-700">
                      <b>Archivo:</b> {item.nombreArchivo} ({item.idTramiteDetectado})
                    </p>
                    <p className="text-[11px] text-gray-700">
                      <b>Certificado X.509 (CN):</b> {item.firmanteCertificado}
                    </p>
                    <p className="text-[10px] font-mono text-gray-500 truncate">
                      SHA-256: {item.sha256Archivo}
                    </p>

                    <div className="pt-2 flex items-center justify-between gap-2">
                      {item.expedienteCerradoComoTitulado ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-semibold">
                          ★ Expediente Cerrado como TITULADO
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-700 font-medium">
                          Almacenado en repositorio firmado
                        </span>
                      )}

                      {item.resolucionId && (
                        <button
                          type="button"
                          onClick={() =>
                            handleAbrirPdf(
                              `/firmas/${item.resolucionId}/pdf-firmado`,
                              'firmas',
                              false,
                            )
                          }
                          className="text-xs font-semibold text-[#1E73BE] hover:underline"
                        >
                          Abrir PDF Firmado →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Lista de Archivos Rechazados (Auditoría Forense) */}
          {resultadoLote.errores.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                <span>
                  Archivos Rechazados y Registrados en Auditoría Forense (
                  {resultadoLote.errores.length})
                </span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resultadoLote.errores.map((errItem, idx) => (
                  <div
                    key={`${errItem.nombreArchivo}-${idx}`}
                    className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-rose-950 truncate">
                        {errItem.nombreArchivo}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                        {errItem.codigoError}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-800 font-medium">
                      {errItem.mensajeError}
                    </p>
                    <div className="flex items-center justify-between text-[10px] font-mono text-rose-600/80 pt-1">
                      <span className="truncate max-w-[240px]">
                        SHA-256: {errItem.sha256Archivo}
                      </span>
                      <span className="inline-flex items-center gap-1 font-sans font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        Auditado
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
