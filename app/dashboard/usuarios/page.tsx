// Archivo: app/dashboard/usuarios/page.tsx
'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import {
  UserPlus,
  Award,
  ShieldCheck,
  Lock,
  CheckCircle2,
  XCircle,
  Edit3,
  RefreshCw,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch,
  ApiError,
  obtenerUsuarioSesion,
  RolUsuario,
  UsuarioSesion,
} from '@/lib/api';

interface UsuarioInstitucional {
  id: string;
  nombresCompletos: string;
  gradoTitulo: string;
  correo: string;
  iniciales: string;
  rol: RolUsuario;
  estado: 'ACTIVO' | 'DESACTIVADO';
  esDecanoFirmante: boolean;
  creadoEn: string;
}

export default function UsuariosDecanoPage() {
  const [sesion, setSesion] = useState<UsuarioSesion | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioInstitucional[]>([]);
  const [cargando, setCargando] = useState(true);

  // Modal Crear / Editar Usuario
  const [modalAbierto, setModalAbierto] = useState(false);
  const [usuarioEditar, setUsuarioEditar] =
    useState<UsuarioInstitucional | null>(null);
  const [gradoTitulo, setGradoTitulo] = useState('Lic.');
  const [nombresCompletos, setNombresCompletos] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [iniciales, setIniciales] = useState('');
  const [rol, setRol] = useState<RolUsuario>('ADMINISTRATIVO');
  const [estado, setEstado] = useState<'ACTIVO' | 'DESACTIVADO'>('ACTIVO');
  const [esDecanoFirmante, setEsDecanoFirmante] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargarUsuarios = async () => {
    setCargando(true);
    try {
      const data = await apiFetch<UsuarioInstitucional[]>('/usuarios', {
        servicio: 'identidad',
      });
      setUsuarios(data);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setCargando(false);
    }
  };

       useEffect(() => {
    const u = obtenerUsuarioSesion();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSesion(u);
    if (u && u.rol === 'DECANO') {
      cargarUsuarios();
    } else {
      setCargando(false);
    }
  }, []);

  if (sesion && sesion.rol !== 'DECANO') {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-10 text-center max-w-lg mx-auto my-12 space-y-3">
        <Lock className="w-10 h-10 text-rose-600 mx-auto" />
        <h2 className="text-base font-bold text-gray-900">
          Módulo Exclusivo de la Autoridad Decanal (Rol: DECANO)
        </h2>
        <p className="text-xs text-gray-600">
          Por seguridad institucional, la administración de cuentas de usuario, bajas en caliente y la designación del <b>Decano Firmante</b> están restringidas exclusivamente al rol <b>DECANO</b>.
        </p>
      </div>
    );
  }

  const decanoFirmanteActual = usuarios.find((u) => u.esDecanoFirmante);

  const abrirModalCrear = () => {
    setUsuarioEditar(null);
    setGradoTitulo('Lic.');
    setNombresCompletos('');
    setCorreo('');
    setPassword('');
    setIniciales('');
    setRol('ADMINISTRATIVO');
    setEstado('ACTIVO');
    setEsDecanoFirmante(false);
    setModalAbierto(true);
  };

  const abrirModalEditar = (u: UsuarioInstitucional) => {
    setUsuarioEditar(u);
    setGradoTitulo(u.gradoTitulo || 'Dr.');
    setNombresCompletos(u.nombresCompletos);
    setCorreo(u.correo);
    setPassword('');
    setIniciales(u.iniciales);
    setRol(u.rol);
    setEstado(u.estado);
    setEsDecanoFirmante(u.esDecanoFirmante);
    setModalAbierto(true);
  };

  const handleGuardarUsuario = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);

    try {
      if (!usuarioEditar) {
        await apiFetch('/usuarios', {
          servicio: 'identidad',
          method: 'POST',
          body: JSON.stringify({
            gradoTitulo: gradoTitulo.trim(),
            nombresCompletos: nombresCompletos.trim().toUpperCase(),
            correo: correo.trim().toLowerCase(),
            password,
            iniciales: iniciales.trim().toUpperCase(),
            rol,
            esDecanoFirmante: rol === 'DECANO' ? esDecanoFirmante : false,
          }),
        });
        toast.success('Nuevo usuario institucional registrado.');
      } else {
        await apiFetch(`/usuarios/${usuarioEditar.id}`, {
          servicio: 'identidad',
          method: 'PATCH',
          body: JSON.stringify({
            gradoTitulo: gradoTitulo.trim(),
            nombresCompletos: nombresCompletos.trim().toUpperCase(),
            iniciales: iniciales.trim().toUpperCase(),
            rol,
            estado,
            esDecanoFirmante: rol === 'DECANO' ? esDecanoFirmante : false,
            ...(password.trim() ? { password: password.trim() } : {}),
          }),
        });
        toast.success('Cuenta de usuario actualizada y auditada.');
      }

      setModalAbierto(false);
      await cargarUsuarios();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleDesignarDecanoFirmanteDirecto = async (u: UsuarioInstitucional) => {
    try {
      await apiFetch(`/usuarios/${u.id}`, {
        servicio: 'identidad',
        method: 'PATCH',
        body: JSON.stringify({
          esDecanoFirmante: true,
          estado: 'ACTIVO',
        }),
      });
      toast.success(
        `${u.gradoTitulo} ${u.nombresCompletos} es ahora el Decano Firmante Vigente.`,
        {
          description:
            'Las nuevas resoluciones tomarán su nombre en el snapshot sin modificar las resoluciones históricas.',
        },
      );
      await cargarUsuarios();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Gobierno de Usuarios, Roles RBAC y Decano Firmante
          </h2>
          <p className="text-xs text-gray-500">
            Administración de credenciales, iniciales de trazabilidad para pie de página y sucesión de autoridad decanal
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={cargarUsuarios}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            onClick={abrirModalCrear}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0B2B5A] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#082044]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear Usuario Institucional</span>
          </button>
        </div>
      </div>

      {/* Tarjeta Destacada del Decano Firmante Vigente */}
      {decanoFirmanteActual && (
        <div className="bg-[#0B2B5A] text-white rounded-2xl p-5 shadow-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-xl bg-amber-400/20 text-amber-300">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                Autoridad Firmante Activa (esDecanoFirmante = true)
              </span>
              <h3 className="text-base font-extrabold mt-0.5">
                {decanoFirmanteActual.gradoTitulo}{' '}
                {decanoFirmanteActual.nombresCompletos}
              </h3>
              <p className="text-xs text-blue-200 mt-0.5">
                Correo: {decanoFirmanteActual.correo} | Siglas de Pie de Página:{' '}
                <b className="font-mono text-white">
                  /{decanoFirmanteActual.iniciales}
                </b>
              </p>
            </div>
          </div>

          <div className="text-xs bg-white/10 border border-white/15 rounded-xl p-3 max-w-md text-blue-100">
            <div className="flex items-center gap-1.5 font-bold text-white mb-0.5">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>Transición de Mando sin Mutación Histórica</span>
            </div>
            Al designar un nuevo Decano Firmante, el sistema retira automáticamente el flag al anterior y estampa a la nueva autoridad únicamente en las resoluciones que se emitan a partir de ese instante.
          </div>
        </div>
      )}

      {/* Tabla de Usuarios */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                <th className="py-3.5 px-4">Grado y Nombres</th>
                <th className="py-3.5 px-4">Correo Institucional</th>
                <th className="py-3.5 px-4">Iniciales (/Pie PDF)</th>
                <th className="py-3.5 px-4">Rol RBAC</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/80 transition">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">
                        {u.gradoTitulo} {u.nombresCompletos}
                      </span>
                      {u.esDecanoFirmante && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold">
                          ★ FIRMANTE VIGENTE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-gray-600">
                    {u.correo}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-gray-100 font-mono font-bold text-[#0B2B5A]">
                      /{u.iniciales}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.rol === 'DECANO'
                          ? 'bg-purple-100 text-purple-900'
                          : u.rol === 'SECRETARIA_ACADEMICA'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {u.rol}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.estado === 'ACTIVO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {u.estado === 'ACTIVO' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      <span>{u.estado}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    {u.rol === 'DECANO' && !u.esDecanoFirmante && u.estado === 'ACTIVO' && (
                      <button
                        type="button"
                        onClick={() => handleDesignarDecanoFirmanteDirecto(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Hacer Firmante</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => abrirModalEditar(u)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#0B2B5A]" />
                      <span>Editar</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Usuario */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden">
            <div className="bg-[#0B2B5A] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  {usuarioEditar
                    ? `Editar Cuenta: ${usuarioEditar.nombresCompletos}`
                    : 'Registrar Nuevo Usuario Institucional'}
                </h3>
                <p className="text-[11px] text-blue-200">
                  Control de acceso RBAC y siglas de responsabilidad en PDF
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

            <form onSubmit={handleGuardarUsuario} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Grado / Título
                  </label>
                  <input
                    type="text"
                    required
                    value={gradoTitulo}
                    onChange={(e) => setGradoTitulo(e.target.value)}
                    placeholder="Dr. / Lic. / Ing."
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Nombres y Apellidos Completos
                  </label>
                  <input
                    type="text"
                    required
                    value={nombresCompletos}
                    onChange={(e) => setNombresCompletos(e.target.value)}
                    placeholder="NOMBRE COMPLETO DEL USUARIO"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Correo Institucional
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(usuarioEditar)}
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    placeholder="usuario@uandina.edu.pe"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs font-mono disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Iniciales (/PDF)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={iniciales}
                    onChange={(e) => setIniciales(e.target.value)}
                    placeholder="Ej. JAAFD"
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Rol en el Sistema (RBAC)
                  </label>
                  <select
                    value={rol}
                    onChange={(e) => setRol(e.target.value as RolUsuario)}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs bg-white font-semibold"
                  >
                    <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                    <option value="SECRETARIA_ACADEMICA">
                      SECRETARIA_ACADEMICA
                    </option>
                    <option value="DECANO">DECANO</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    {usuarioEditar
                      ? 'Nueva Contraseña (Opcional)'
                      : 'Contraseña Inicial'}
                  </label>
                  <input
                    type="password"
                    required={!usuarioEditar}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      usuarioEditar ? 'Dejar vacío para conservar' : 'Mín. 8 caracteres'
                    }
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs"
                  />
                </div>
              </div>

              {usuarioEditar && (
                <div>
                  <label className="block font-bold uppercase text-gray-700 mb-1">
                    Estado de la Cuenta (Baja en Caliente)
                  </label>
                  <select
                    value={estado}
                    onChange={(e) =>
                      setEstado(e.target.value as 'ACTIVO' | 'DESACTIVADO')
                    }
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs bg-white"
                  >
                    <option value="ACTIVO">
                      ACTIVO (Acceso permitido según su rol)
                    </option>
                    <option value="DESACTIVADO">
                      DESACTIVADO (Revoca acceso inmediatamente en JwtRolesGuard)
                    </option>
                  </select>
                </div>
              )}

              {rol === 'DECANO' && (
                <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={esDecanoFirmante}
                    onChange={(e) => setEsDecanoFirmante(e.target.checked)}
                  />
                  <span>
                    Establecer como el único Decano Firmante Vigente (esDecanoFirmante = true)
                  </span>
                </label>
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
                    <span>Guardar Usuario</span>
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