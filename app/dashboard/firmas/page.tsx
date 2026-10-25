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
  Cpu,
  Download,
  PlusCircle,
  Loader2,
  ExternalLink,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  abrirPdfAutenticado,
  apiFetch,
  ApiError,
  descargarZipPendientesApi,
  simularFirmaPkcs7Api,
} from '@/lib/api';

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
  };
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estado de resoluciones pendientes (EMITIDO + VIGENTE)
  const [pendientes, setPendientes] = useState<ResolucionPendienteItem[]>([]);
  const [serieFiltro, setSerieFiltro] = useState<'' | 'ORD' | 'CF'>('');
  const [busqueda, setBusqueda] = useState('');
  const [cargandoPendientes, setCargandoPendientes] = useState(true);
  const [descargandoZip, setDescargandoZip] = useState(false);

  // Estado del Simulador PKCS#7 (Defensa de Tesis / Pruebas)
  const [simularModoTocapu, setSimularModoTocapu] = useState(false);
  const [simulandoId, setSimulandoId] = useState<string | null>(null);

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
      item.expediente.codigoExpediente.toLowerCase().includes(q) ||
      item.expediente.escuelaProfesional.nombre.toLowerCase().includes(q)
    );
  });

  // 1. Descargar paquete ZIP masivo
  const handleDescargarZipMasivo = async () => {
    setDescargandoZip(true);
    try {
      await descargarZipPendientesApi({
        serie: serieFiltro || undefined,
      });
      toast.success('Paquete ZIP generado con resoluciones pendientes y manifiesto_lote.json.');
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setDescargandoZip(false);
    }
  };

  // 2. Simular firma PKCS#7 (Descargar a PC o enviar directo a la bandeja Drag & Drop)
  const handleSimularFirma = async (
    res: ResolucionPendienteItem,
    enviarDirectoABandeja: boolean,
  ) => {
    setSimulandoId(res.id);
    try {
      const archivoFirmado = await simularFirmaPkcs7Api(
        res.id,
        res.numeroCompleto,
        res.versionPdf,
        simularModoTocapu,
        !enviarDirectoABandeja,
      );

      if (enviarDirectoABandeja) {
        agregarArchivosABandeja([archivoFirmado]);
        toast.success(
          `${archivoFirmado.name} firmado con RSA-2048 y añadido a la bandeja de validación.`,
          {
            description: simularModoTocapu
              ? 'Modo Tocapu activo: Se limpió el diccionario /Info para probar extracción de Nivel 2.'
              : 'Metadatos /Info y pie de página intactos (Nivel 1).',
          },
        );
      } else {
        toast.success(`PDF firmado descargado: ${archivoFirmado.name}`);
      }
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setSimulandoId(null);
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
    <div className="space-y-6">
      {/* Cabecera e Indicadores */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Lotes de Resoluciones y Validación Criptográfica PKCS#7 / CAdES
          </h2>
          <p className="text-xs text-gray-500">
            Descarga masiva en ZIP para firma externa (Tocapu) y recepción multipropósito con verificación de integridad SHA-256
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={cargarPendientes}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${cargandoPendientes ? 'animate-spin' : ''}`}
            />
            <span>Actualizar Bandeja</span>
          </button>

          <button
            type="button"
            onClick={handleDescargarZipMasivo}
            disabled={pendientes.length === 0 || descargandoZip}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0B2B5A] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#082044] disabled:opacity-50 transition"
          >
            {descargandoZip ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderArchive className="w-4 h-4" />
            )}
            <span>
              Descargar Lote Pendientes en .ZIP ({pendientes.length})
            </span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* GRILLA DE 2 COLUMNAS: PENDIENTES + SIMULADOR | DRAG & DROP          */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA (7 Columnas): Resoluciones en estado EMITIDO + Simulador */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div>
            {/* Barra de filtros y Simulador Tocapu */}
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-900">
                  1. Resoluciones Pendientes de Firma (Estado: EMITIDO)
                </h3>
                <div className="flex items-center gap-1.5">
                  {(['', 'ORD', 'CF'] as const).map((s) => (
                    <button
                      key={s || 'TODAS'}
                      type="button"
                      onClick={() => setSerieFiltro(s)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                        serieFiltro === s
                          ? 'bg-[#0B2B5A] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s === '' ? 'Todas' : `Serie ${s}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Filtrar por número (0001-2026...), ID-Trámite, tipo o expediente..."
                  className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-1.5 text-xs text-gray-900 focus:border-[#0B2B5A] focus:outline-none"
                />
              </div>

              {/* Barra del Simulador Criptográfico para Sustentación de Tesis */}
              <div className="p-3 rounded-xl bg-blue-50/90 border border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-[#0B2B5A] font-bold">
                  <Cpu className="w-4 h-4 shrink-0" />
                  <span>Simulador PKCS#7 / RSA-2048 (Para Pruebas y Sustentación):</span>
                </div>
                <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simularModoTocapu}
                    onChange={(e) => setSimularModoTocapu(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>
                    Simular Tocapu borrando diccionario /Info (Prueba Nivel 2 de cascada)
                  </span>
                </label>
              </div>
            </div>

            {/* Tabla de resoluciones pendientes */}
            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase text-gray-500">
                  <tr>
                    <th className="py-2.5 px-3">Resolución / Exp.</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Sello Doble Vía</th>
                    <th className="py-2.5 px-3 text-right">
                      Descarga / Simulador PKCS#7
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendientesFiltrados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-10 text-center text-gray-400 italic"
                      >
                        {cargandoPendientes
                          ? 'Consultando resoluciones en estado EMITIDO...'
                          : '¡Excelente! No hay resoluciones pendientes de firma en este momento.'}
                      </td>
                    </tr>
                  ) : (
                    pendientesFiltrados.map((res) => (
                      <tr key={res.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-3 align-top">
                          <span className="font-mono font-bold text-[#0B2B5A] block">
                            {res.numeroCompleto}
                          </span>
                          <Link
                            href={`/dashboard/expedientes/${res.expediente.id}`}
                            className="text-[11px] text-gray-500 hover:underline inline-flex items-center gap-1"
                          >
                            <span>{res.expediente.codigoExpediente}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </td>

                        <td className="py-3 px-3 align-top">
                          <span className="font-semibold text-gray-800 block">
                            {res.tipo}
                          </span>
                          <span
                            className={`inline-block mt-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              res.serie === 'CF'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            Serie {res.serie}
                          </span>
                        </td>

                        <td className="py-3 px-3 align-top font-mono text-[10px] text-gray-600">
                          <span className="block font-bold text-gray-800">
                            {res.idTramiteControl}
                          </span>
                          <span>
                            v{res.versionPdf} | HASH:{' '}
                            {res.hashVersionGenerado.slice(0, 8)}...
                          </span>
                        </td>

                        <td className="py-3 px-3 align-top text-right space-y-1">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Botón 1: Descargar PDF Original Sin Firma (Para Tocapu real o probar rechazo) */}
                            <button
                              type="button"
                              onClick={() =>
                                abrirPdfAutenticado(
                                  `/documentos/${res.id}/pdf`,
                                  'documentos',
                                  true,
                                  `${res.numeroCompleto}_v${res.versionPdf}_SIN_FIRMA.pdf`,
                                )
                              }
                              title="Descargar PDF original sin firma"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 text-[11px] font-semibold hover:bg-gray-100"
                            >
                              <Download className="w-3 h-3" />
                              <span>Sin Firma</span>
                            </button>

                            {/* Botón 2: Simular Firma PKCS#7 y Descargar a PC */}
                            <button
                              type="button"
                              disabled={simulandoId === res.id}
                              onClick={() => handleSimularFirma(res, false)}
                              title="Genera y descarga el PDF firmado con llave RSA-2048 del Decano"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-300 bg-blue-50 text-[#0B2B5A] text-[11px] font-semibold hover:bg-blue-100 disabled:opacity-50"
                            >
                              <FileSignature className="w-3 h-3" />
                              <span>Descargar Firmado</span>
                            </button>

                            {/* Botón 3: Simular Firma PKCS#7 y Enviar Directo a Bandeja Drag & Drop */}
                            <button
                              type="button"
                              disabled={simulandoId === res.id}
                              onClick={() => handleSimularFirma(res, true)}
                              title="Firma el PDF con PKCS#7 y lo coloca directamente en la bandeja derecha"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0B2B5A] text-white text-[11px] font-semibold hover:bg-[#082044] disabled:opacity-50"
                            >
                              {simulandoId === res.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <PlusCircle className="w-3 h-3" />
                              )}
                              <span>Firmar → Bandeja</span>
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

          <div className="p-3.5 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500 flex justify-between items-center">
            <span>
              Total pendientes de firma: <b>{pendientes.length}</b> resolución(es)
            </span>
            <span>
              Usa <b>&quot;Firmar → Bandeja&quot;</b> para probar la validación de lotes al instante
            </span>
          </div>
        </div>

        {/* COLUMNA DERECHA (5 Columnas): Zona Drag-and-Drop de Subida en Lote */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                2. Área Drag-and-Drop de Validación de PDFs Firmados
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Arrastre aquí de 1 a 50 archivos PDF firmados con Tocapu o con el Simulador PKCS#7. El sistema aísla los fallos archivo por archivo.
              </p>
            </div>

            {/* Zona Interactiva Drag and Drop */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                arrastrandoSobreZona
                  ? 'border-[#0B2B5A] bg-blue-50/70 scale-[1.01]'
                  : 'border-gray-300 hover:border-[#0B2B5A] bg-gray-50/60'
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
              <UploadCloud className="w-10 h-10 text-[#0B2B5A] mx-auto mb-2.5" />
              <p className="text-xs font-bold text-gray-800">
                Arrastre y suelte los PDFs firmados aquí, o haga clic para explorar
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Verifica Magic Bytes (%PDF-), cascada de 3 niveles (ID-TRAMITE + HASH) y firma RSA/PKCS#7
              </p>
            </div>

            {/* Lista de archivos actualmente en cola para validar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700">
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

              <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-gray-50">
                {archivosEnBandeja.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 italic">
                    Ningún archivo en cola. Arrastre sus PDFs o pulse &quot;Firmar → Bandeja&quot;.
                  </div>
                ) : (
                  archivosEnBandeja.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="p-2.5 px-3 flex items-center justify-between gap-2 text-xs bg-white hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-[#0B2B5A] shrink-0" />
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
                        className="p-1 text-gray-400 hover:text-rose-600"
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
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0B2B5A] py-3 px-4 text-xs font-bold text-white shadow-md hover:bg-[#082044] disabled:opacity-50 transition"
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
      {/* REPORTE FORENSE Y RESULTADO DEL LOTE PROCESADO                      */}
      {/* =================================================================== */}
      {resultadoLote && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Reporte de Validación Criptográfica del Lote
              </h3>
              <p className="text-xs text-gray-500">
                Cada archivo fue verificado en una transacción independiente con registro en Auditoría
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-800">
                Recibidos: {resultadoLote.totalRecibidos}
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                Exitosos (FIRMADO): {resultadoLote.exitosos}
              </span>
              <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-800">
                Rechazados: {resultadoLote.fallidos}
              </span>
            </div>
          </div>

          {/* 1. Lista de Archivos Exitosos */}
          {resultadoLote.procesados.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Resoluciones Validadas y Pasadas a Estado FIRMADO (
                  {resultadoLote.procesados.length})
                </span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {resultadoLote.procesados.map((item, idx) => (
                  <div
                    key={`${item.nombreArchivo}-${idx}`}
                    className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-extrabold text-emerald-950">
                        {item.numeroCompleto}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900">
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

                    <div className="pt-1 flex items-center justify-between">
                      {item.expedienteCerradoComoTitulado ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px] font-bold">
                          ★ Expediente Cerrado como TITULADO
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-800 font-semibold">
                          Almacenado en ./storage/firmados/
                        </span>
                      )}

                      {item.resolucionId && (
                        <button
                          type="button"
                          onClick={() =>
                            abrirPdfAutenticado(
                              `/firmas/${item.resolucionId}/pdf-firmado`,
                              'firmas',
                            )
                          }
                          className="text-xs font-bold text-[#0B2B5A] hover:underline"
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
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                <span>
                  Archivos Rechazados y Registrados en Auditoría Forense (
                  {resultadoLote.errores.length})
                </span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {resultadoLote.errores.map((errItem, idx) => (
                  <div
                    key={`${errItem.nombreArchivo}-${idx}`}
                    className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-rose-950 truncate">
                        {errItem.nombreArchivo}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-900 shrink-0">
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
                      <span className="inline-flex items-center gap-1 font-sans font-bold">
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