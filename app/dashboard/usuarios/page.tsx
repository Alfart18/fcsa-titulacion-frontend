// Archivo: app/dashboard/usuarios/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState, FormEvent } from 'react';
import Link from 'next/link';
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
  ChevronRight,
  PanelLeft,
  Users,
  Power,
  Search,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Sparkles,
  History,
  UserCog,
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

type EstadoUsuario = 'ACTIVO' | 'DESACTIVADO';
type TabModalUsuario = 'DATOS' | 'PASSWORD' | 'ACTIVIDAD';

interface UsuarioInstitucional {
  id: string;
  nombresCompletos: string;
  gradoTitulo: string;
  correo: string;
  iniciales: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
  esDecanoFirmante: boolean;
  creadoEn: string;
}

interface ActividadUsuarioItem {
  id: string;
  accion: string;
  entidad: string;
  inicialesUsuario: string;
  detalle: Record<string, unknown> | null;
  fechaHora: string;
}

const ROLES_GESTION_USUARIOS: RolUsuario[] = ['ADMIN', 'DECANO'];

const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  ADMIN: 'Administrador',
  DECANO: 'Decano',
  SECRETARIA_ACADEMICA: 'Secretaría Académica',
  ADMINISTRATIVO: 'Administrativo',
};

const CLASE_BADGE_ROL: Record<RolUsuario, string> = {
  ADMIN: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  DECANO: 'bg-purple-50 text-purple-700 border border-purple-200',
  SECRETARIA_ACADEMICA: 'bg-blue-50 text-[#1E73BE] border border-blue-200',
  ADMINISTRATIVO: 'bg-gray-100 text-gray-700 border border-gray-200',
};

function generarClaveSegura(): string {
  const mayus = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minus = 'abcdefghijkmnopqrstuvwxyz';
  const nums = '23456789';
  const simbs = '!@#$%&*';
  const todos = mayus + minus + nums + simbs;

  const pick = (pool: string) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return pool[arr[0] % pool.length];
  };

  const chars = [
    pick(mayus),
    pick(mayus),
    pick(minus),
    pick(minus),
    pick(nums),
    pick(nums),
    pick(simbs),
  ];
  while (chars.length < 12) {
    chars.push(pick(todos));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export default function UsuariosDecanoPage() {
  const { sidebarAbierto, toggleSidebar } = useSidebar();

  const [sesion, setSesion] = useState<UsuarioSesion | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioInstitucional[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  // Filtros de tabla
  const [busqueda, setBusqueda] = useState('');
  const [rolFiltro, setRolFiltro] = useState<'' | RolUsuario>('');
  const [estadoFiltro, setEstadoFiltro] = useState<'' | EstadoUsuario>('');

  // Modal Crear / Gestionar Usuario
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tabModal, setTabModal] = useState<TabModalUsuario>('DATOS');
  const [usuarioEditar, setUsuarioEditar] =
    useState<UsuarioInstitucional | null>(null);

  // Campos de formulario
  const [gradoTitulo, setGradoTitulo] = useState('Lic.');
  const [nombresCompletos, setNombresCompletos] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [iniciales, setIniciales] = useState('');
  const [rol, setRol] = useState<RolUsuario>('ADMINISTRATIVO');
  const [estado, setEstado] = useState<EstadoUsuario>('ACTIVO');
  const [esDecanoFirmante, setEsDecanoFirmante] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Actividad reciente del usuario seleccionado
  const [actividadUsuario, setActividadUsuario] = useState<
    ActividadUsuarioItem[]
  >([]);
  const [cargandoActividad, setCargandoActividad] = useState(false);

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    try {
      const data = await apiFetch<UsuarioInstitucional[]>('/admin/usuarios', {
        servicio: 'identidad',
      });
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudo cargar el padrón de usuarios institucionales.');
      }
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarActividadUsuario = useCallback(async (userId: string) => {
    setCargandoActividad(true);
    setActividadUsuario([]);
    try {
      const data = await apiFetch<ActividadUsuarioItem[]>(
        `/admin/usuarios/${userId}/actividad`,
        { servicio: 'identidad' },
      );
      setActividadUsuario(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudo cargar el historial de actividad del usuario.');
      }
    } finally {
      setCargandoActividad(false);
    }
  }, []);

  useEffect(() => {
    const u = obtenerUsuarioSesion();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSesion(u);
    if (u && ROLES_GESTION_USUARIOS.includes(u.rol)) {
      cargarUsuarios();
    } else {
      setCargando(false);
    }
  }, [cargarUsuarios]);

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      if (rolFiltro && u.rol !== rolFiltro) return false;
      if (estadoFiltro && u.estado !== estadoFiltro) return false;
      if (!busqueda.trim()) return true;
      const q = busqueda.toLowerCase();
      return (
        u.nombresCompletos.toLowerCase().includes(q) ||
        u.gradoTitulo.toLowerCase().includes(q) ||
        u.correo.toLowerCase().includes(q) ||
        u.iniciales.toLowerCase().includes(q)
      );
    });
  }, [usuarios, busqueda, rolFiltro, estadoFiltro]);

  if (sesion && !ROLES_GESTION_USUARIOS.includes(sesion.rol)) {
    return (
      <div className="space-y-6 pb-12 w-full">
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
            Usuarios y Decano Firmante
          </span>
        </nav>

        <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-10 text-center max-w-lg mx-auto my-12 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-rose-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">
            Módulo Exclusivo de Gobierno Institucional
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Por seguridad institucional, la administración de cuentas de usuario,
            restablecimiento de contraseñas y la designación del{' '}
            <b>Decano Firmante</b> están restringidas exclusivamente a los roles{' '}
            <b>ADMIN</b> y <b>DECANO</b>.
          </p>
        </div>
      </div>
    );
  }

  const esAdmin = sesion?.rol === 'ADMIN';
  const decanoFirmanteActual = usuarios.find(
    (u) => u.esDecanoFirmante && u.estado === 'ACTIVO',
  );
  const totalActivos = usuarios.filter((u) => u.estado === 'ACTIVO').length;
  const totalDesactivados = usuarios.length - totalActivos;

  const abrirModalCrear = () => {
    setUsuarioEditar(null);
    setTabModal('DATOS');
    setGradoTitulo('Lic.');
    setNombresCompletos('');
    setCorreo('');
    setPassword('');
    setConfirmarPassword('');
    setMostrarPassword(false);
    setIniciales('');
    setRol('ADMINISTRATIVO');
    setEstado('ACTIVO');
    setEsDecanoFirmante(false);
    setModalAbierto(true);
  };

  const abrirModalEditar = (
    u: UsuarioInstitucional,
    tabInicial: TabModalUsuario = 'DATOS',
  ) => {
    setUsuarioEditar(u);
    setTabModal(tabInicial);
    setGradoTitulo(u.gradoTitulo || 'Dr.');
    setNombresCompletos(u.nombresCompletos);
    setCorreo(u.correo);
    setPassword('');
    setConfirmarPassword('');
    setMostrarPassword(false);
    setIniciales(u.iniciales);
    setRol(u.rol);
    setEstado(u.estado);
    setEsDecanoFirmante(u.esDecanoFirmante);
    setModalAbierto(true);
    if (tabInicial === 'ACTIVIDAD') {
      void cargarActividadUsuario(u.id);
    }
  };

  const handleCambiarTabModal = (nuevaTab: TabModalUsuario) => {
    setTabModal(nuevaTab);
    if (nuevaTab === 'ACTIVIDAD' && usuarioEditar) {
      void cargarActividadUsuario(usuarioEditar.id);
    }
  };

  const handleGenerarPassword = () => {
    const clave = generarClaveSegura();
    setPassword(clave);
    setConfirmarPassword(clave);
    setMostrarPassword(true);
    toast.info('Contraseña segura generada. Recuerde copiarla antes de guardar.');
  };

  const handleCopiarPassword = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Contraseña copiada al portapapeles.');
    } catch {
      toast.error('No se pudo copiar al portapapeles.');
    }
  };

  const handleGuardarUsuario = async (e: FormEvent) => {
    e.preventDefault();

    // Validación de contraseña cuando se crea usuario o se está en la pestaña de contraseña
    if (!usuarioEditar) {
      if (password.length < 8) {
        toast.error('La contraseña inicial debe tener al menos 8 caracteres.');
        return;
      }
    } else if (tabModal === 'PASSWORD') {
      if (!password) {
        toast.error('Ingrese la nueva contraseña para el usuario.');
        return;
      }
      if (password !== confirmarPassword) {
        toast.error('Las contraseñas ingresadas no coinciden.');
        return;
      }
    }

    setGuardando(true);

    try {
      if (!usuarioEditar) {
        await apiFetch('/admin/usuarios', {
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
      } else if (tabModal === 'PASSWORD') {
        await apiFetch(`/admin/usuarios/${usuarioEditar.id}`, {
          servicio: 'identidad',
          method: 'PATCH',
          body: JSON.stringify({
            nuevaPassword: password,
          }),
        });
        toast.success(
          `Contraseña de ${usuarioEditar.nombresCompletos} restablecida y auditada.`,
        );
      } else {
        const payloadActualizar: {
          gradoTitulo: string;
          nombresCompletos: string;
          correo: string;
          iniciales: string;
          rol: RolUsuario;
          estado: EstadoUsuario;
          esDecanoFirmante: boolean;
        } = {
          gradoTitulo: gradoTitulo.trim(),
          nombresCompletos: nombresCompletos.trim().toUpperCase(),
          correo: correo.trim().toLowerCase(),
          iniciales: iniciales.trim().toUpperCase(),
          rol,
          estado,
          esDecanoFirmante:
            rol === 'DECANO' && estado === 'ACTIVO' ? esDecanoFirmante : false,
        };

        await apiFetch(`/admin/usuarios/${usuarioEditar.id}`, {
          servicio: 'identidad',
          method: 'PATCH',
          body: JSON.stringify(payloadActualizar),
        });
        toast.success('Datos, rol y estado de la cuenta actualizados y auditados.');
      }

      setModalAbierto(false);
      await cargarUsuarios();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudieron guardar los cambios del usuario.');
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleAlternarEstado = async (u: UsuarioInstitucional) => {
    const nuevoEstado: EstadoUsuario =
      u.estado === 'ACTIVO' ? 'DESACTIVADO' : 'ACTIVO';
    setProcesandoId(u.id);
    try {
      const payload: { estado: EstadoUsuario; esDecanoFirmante?: boolean } = {
        estado: nuevoEstado,
      };
      if (nuevoEstado === 'DESACTIVADO' && u.esDecanoFirmante) {
        payload.esDecanoFirmante = false;
      }

      await apiFetch(`/admin/usuarios/${u.id}`, {
        servicio: 'identidad',
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      toast.success(
        nuevoEstado === 'ACTIVO'
          ? `Cuenta de ${u.nombresCompletos} reactivada.`
          : `Cuenta de ${u.nombresCompletos} desactivada (acceso revocado inmediatamente).`,
      );
      await cargarUsuarios();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudo actualizar el estado de la cuenta.');
      }
    } finally {
      setProcesandoId(null);
    }
  };

  const handleDesignarDecanoFirmanteDirecto = async (
    u: UsuarioInstitucional,
  ) => {
    setProcesandoId(u.id);
    try {
      await apiFetch(`/admin/usuarios/${u.id}`, {
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
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('No se pudo designar al Decano Firmante.');
      }
    } finally {
      setProcesandoId(null);
    }
  };

  const puedeEditarObjetivo = (u: UsuarioInstitucional) => {
    if (esAdmin) return true;
    return u.rol !== 'ADMIN';
  };

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
            Usuarios y Decano Firmante
          </span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Administración de Usuarios y Permisos
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              Gestión completa de cuentas institucionales: edición de datos y
              roles RBAC, restablecimiento de contraseñas, bajas inmediatas,
              auditoría por usuario y sucesión del Decano Firmante.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={cargarUsuarios}
              disabled={cargando}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs transition-colors disabled:opacity-60"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`}
              />
              <span>Actualizar</span>
            </button>

            <button
              type="button"
              onClick={abrirModalCrear}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E73BE] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#155A9C] transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Crear Usuario</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPIs de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Total de Usuarios
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {usuarios.length}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#1E73BE]" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Cuentas Activas
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {totalActivos}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Cuentas Desactivadas
            </p>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              {totalDesactivados}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-rose-600" />
          </div>
        </div>
      </div>

      {/* 3. Tarjeta Destacada del Decano Firmante Vigente */}
      {decanoFirmanteActual && (
        <div className="bg-white rounded-2xl border border-blue-200 p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#1E73BE]">
                Autoridad Firmante Vigente
              </span>
              <h2 className="text-base font-bold text-gray-900 mt-0.5">
                {decanoFirmanteActual.gradoTitulo}{' '}
                {decanoFirmanteActual.nombresCompletos}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {decanoFirmanteActual.correo} · Siglas de Pie de Página:{' '}
                <span className="font-mono font-semibold text-[#1E73BE]">
                  /{decanoFirmanteActual.iniciales}
                </span>
              </p>
            </div>
          </div>

          <div className="text-xs bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 max-w-md text-gray-600">
            <div className="flex items-center gap-1.5 font-semibold text-gray-800 mb-1">
              <ShieldCheck className="w-4 h-4 text-[#1E73BE]" />
              <span>Transición de Mando sin Mutación Histórica</span>
            </div>
            Al designar un nuevo Decano Firmante, el sistema retira automáticamente
            el indicador al anterior y estampa a la nueva autoridad únicamente en las
            resoluciones futuras.
          </div>
        </div>
      )}

      {/* 4. Barra de Búsqueda y Filtros */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, correo institucional o iniciales..."
            className="w-full rounded-xl border border-gray-300 pl-10 pr-3 py-2.5 text-xs focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={rolFiltro}
            onChange={(e) => setRolFiltro(e.target.value as '' | RolUsuario)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs bg-white focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
          >
            <option value="">Todos los roles</option>
            <option value="ADMIN">Administrador (ADMIN)</option>
            <option value="DECANO">Decano (DECANO)</option>
            <option value="SECRETARIA_ACADEMICA">Secretaría Académica</option>
            <option value="ADMINISTRATIVO">Administrativo</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={estadoFiltro}
            onChange={(e) =>
              setEstadoFiltro(e.target.value as '' | EstadoUsuario)
            }
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs bg-white focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Solo Activos</option>
            <option value="DESACTIVADO">Solo Desactivados</option>
          </select>
        </div>
      </div>

      {/* 5. Tabla de Usuarios */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-bold uppercase text-gray-500">
                <th className="py-3.5 px-4">Grado y Nombres</th>
                <th className="py-3.5 px-4">Correo Institucional</th>
                <th className="py-3.5 px-4">Iniciales (/PDF)</th>
                <th className="py-3.5 px-4">Rol RBAC</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-gray-400 italic"
                  >
                    {cargando
                      ? 'Cargando usuarios institucionales...'
                      : 'No se encontraron usuarios con los filtros seleccionados.'}
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => {
                  const esMiCuenta = sesion?.id === u.id;
                  const ocupado = procesandoId === u.id;
                  const editable = puedeEditarObjetivo(u);
                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-gray-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {u.gradoTitulo} {u.nombresCompletos}
                          </span>
                          {esMiCuenta && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#1E73BE] border border-blue-200 text-[10px] font-semibold">
                              Tú
                            </span>
                          )}
                          {u.esDecanoFirmante && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                              ★ FIRMANTE VIGENTE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-600">
                        {u.correo}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 font-mono font-semibold text-[#1E73BE]">
                          /{u.iniciales}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            CLASE_BADGE_ROL[u.rol] ??
                            'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                        >
                          {ETIQUETAS_ROL[u.rol] ?? u.rol}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            u.estado === 'ACTIVO'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
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
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                          {u.rol === 'DECANO' &&
                            !u.esDecanoFirmante &&
                            u.estado === 'ACTIVO' && (
                              <button
                                type="button"
                                disabled={ocupado}
                                onClick={() =>
                                  handleDesignarDecanoFirmanteDirecto(u)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50"
                              >
                                <Award className="w-3.5 h-3.5" />
                                <span>Firmante</span>
                              </button>
                            )}

                          {editable && (
                            <button
                              type="button"
                              onClick={() => abrirModalEditar(u, 'PASSWORD')}
                              title="Restablecer contraseña"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-semibold hover:bg-amber-100 transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Clave</span>
                            </button>
                          )}

                          {editable && (
                            <button
                              type="button"
                              onClick={() => abrirModalEditar(u, 'DATOS')}
                              title="Editar datos, rol y actividad"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-[11px] font-semibold hover:bg-gray-50 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#1E73BE]" />
                              <span>Editar</span>
                            </button>
                          )}

                          {!esMiCuenta && editable && (
                            <button
                              type="button"
                              disabled={ocupado}
                              onClick={() => handleAlternarEstado(u)}
                              title={
                                u.estado === 'ACTIVO'
                                  ? 'Desactivar cuenta'
                                  : 'Reactivar cuenta'
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                u.estado === 'ACTIVO'
                                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>
                                {u.estado === 'ACTIVO'
                                  ? 'Desactivar'
                                  : 'Activar'}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Modal Crear / Gestionar Usuario Completo */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {usuarioEditar
                    ? `Administrar Cuenta: ${usuarioEditar.nombresCompletos}`
                    : 'Registrar Nuevo Usuario Institucional'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {usuarioEditar
                    ? `${usuarioEditar.correo} · /${usuarioEditar.iniciales}`
                    : 'Control de acceso RBAC, credenciales iniciales y siglas en PDF'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas del Modal en modo Edición */}
            {usuarioEditar && (
              <div className="px-6 pt-3 border-b border-gray-100 flex items-center gap-2 bg-white">
                <button
                  type="button"
                  onClick={() => handleCambiarTabModal('DATOS')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                    tabModal === 'DATOS'
                      ? 'border-[#1E73BE] text-[#1E73BE]'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <UserCog className="w-3.5 h-3.5" />
                  <span>Datos y Permisos</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCambiarTabModal('PASSWORD')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                    tabModal === 'PASSWORD'
                      ? 'border-amber-600 text-amber-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Restablecer Contraseña</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCambiarTabModal('ACTIVIDAD')}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                    tabModal === 'ACTIVIDAD'
                      ? 'border-[#1E73BE] text-[#1E73BE]'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Actividad Reciente</span>
                </button>
              </div>
            )}

            <div className="overflow-y-auto flex-1">
              {usuarioEditar && tabModal === 'ACTIVIDAD' ? (
                <div className="p-6 space-y-3 text-xs">
                  {cargandoActividad ? (
                    <div className="py-10 text-center text-gray-400 flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-[#1E73BE]" />
                      <span>Cargando últimos registros de actividad...</span>
                    </div>
                  ) : actividadUsuario.length === 0 ? (
                    <div className="py-10 text-center text-gray-400 italic">
                      Este usuario aún no registra eventos recientes en auditoría.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                      {actividadUsuario.map((ev) => (
                        <div
                          key={ev.id}
                          className="p-3 bg-white hover:bg-gray-50/80 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-[#1E73BE] border border-blue-200 font-mono text-[10px] font-bold">
                              {ev.accion}
                            </span>
                            <span className="ml-2 text-gray-500 font-mono text-[11px]">
                              {ev.entidad}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-gray-500">
                            {new Date(ev.fechaHora).toLocaleString('es-PE')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setModalAbierto(false)}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleGuardarUsuario}
                  className="p-6 space-y-4 text-xs"
                >
                  {(!usuarioEditar || tabModal === 'DATOS') && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">
                            Grado / Título
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={50}
                            value={gradoTitulo}
                            onChange={(e) => setGradoTitulo(e.target.value)}
                            placeholder="Dr. / Lic. / Ing."
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block font-semibold text-gray-700 mb-1">
                            Nombres y Apellidos Completos
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={180}
                            value={nombresCompletos}
                            onChange={(e) =>
                              setNombresCompletos(e.target.value)
                            }
                            placeholder="NOMBRE COMPLETO DEL USUARIO"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs uppercase focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block font-semibold text-gray-700 mb-1">
                            Correo Institucional
                          </label>
                          <input
                            type="email"
                            required
                            maxLength={150}
                            value={correo}
                            onChange={(e) => setCorreo(e.target.value)}
                            placeholder="usuario@uandina.edu.pe"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs font-mono focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">
                            Iniciales (/PDF)
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={10}
                            value={iniciales}
                            onChange={(e) => setIniciales(e.target.value)}
                            placeholder="Ej. JCPG"
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs font-mono uppercase focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">
                            Rol en el Sistema (RBAC)
                          </label>
                          <select
                            value={rol}
                            disabled={usuarioEditar?.id === sesion?.id}
                            onChange={(e) => {
                              const nuevoRol = e.target.value as RolUsuario;
                              setRol(nuevoRol);
                              if (nuevoRol !== 'DECANO')
                                setEsDecanoFirmante(false);
                            }}
                            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs bg-white font-semibold disabled:bg-gray-100 disabled:text-gray-500 focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                          >
                            <option value="ADMINISTRATIVO">
                              Administrativo (ADMINISTRATIVO)
                            </option>
                            <option value="SECRETARIA_ACADEMICA">
                              Secretaría Académica (SECRETARIA_ACADEMICA)
                            </option>
                            <option value="DECANO">Decano (DECANO)</option>
                            {esAdmin && (
                              <option value="ADMIN">
                                Administrador (ADMIN)
                              </option>
                            )}
                          </select>
                          {usuarioEditar?.id === sesion?.id && (
                            <p className="text-[11px] text-amber-700 mt-1">
                              No puede cambiar su propio rol en sesión.
                            </p>
                          )}
                        </div>

                        {!usuarioEditar ? (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="font-semibold text-gray-700">
                                Contraseña Inicial
                              </label>
                              <button
                                type="button"
                                onClick={handleGenerarPassword}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E73BE] hover:underline"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Generar</span>
                              </button>
                            </div>
                            <div className="relative">
                              <input
                                type={mostrarPassword ? 'text' : 'password'}
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mín. 8 chars (Mayús, minús, núm)"
                                className="w-full rounded-xl border border-gray-300 pl-3 pr-16 py-2.5 text-xs focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                              />
                              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                                {password && (
                                  <button
                                    type="button"
                                    onClick={() => void handleCopiarPassword()}
                                    title="Copiar contraseña"
                                    className="p-1 text-gray-400 hover:text-[#1E73BE] rounded"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMostrarPassword((prev) => !prev)
                                  }
                                  title={
                                    mostrarPassword ? 'Ocultar' : 'Mostrar'
                                  }
                                  className="p-1 text-gray-400 hover:text-gray-700 rounded"
                                >
                                  {mostrarPassword ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block font-semibold text-gray-700 mb-1">
                              Estado de la Cuenta
                            </label>
                            <select
                              value={estado}
                              disabled={usuarioEditar.id === sesion?.id}
                              onChange={(e) => {
                                const nuevoEstado = e.target
                                  .value as EstadoUsuario;
                                setEstado(nuevoEstado);
                                if (nuevoEstado === 'DESACTIVADO') {
                                  setEsDecanoFirmante(false);
                                }
                              }}
                              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs bg-white disabled:bg-gray-100 disabled:text-gray-500 focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                            >
                              <option value="ACTIVO">
                                ACTIVO (Acceso permitido)
                              </option>
                              <option value="DESACTIVADO">
                                DESACTIVADO (Revoca acceso inmediatamente)
                              </option>
                            </select>
                          </div>
                        )}
                      </div>

                      {!usuarioEditar && (
                        <p className="text-[11px] text-gray-500">
                          La contraseña debe tener al menos 8 caracteres,
                          incluyendo una mayúscula, una minúscula y un número.
                        </p>
                      )}

                      {rol === 'DECANO' && (
                        <label
                          className={`flex items-center gap-2.5 p-3.5 rounded-xl border font-semibold ${
                            estado === 'ACTIVO'
                              ? 'bg-amber-50 border-amber-200 text-amber-900 cursor-pointer'
                              : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={estado !== 'ACTIVO'}
                            checked={esDecanoFirmante}
                            onChange={(e) =>
                              setEsDecanoFirmante(e.target.checked)
                            }
                            className="rounded border-amber-300"
                          />
                          <span>
                            Establecer como Decano Firmante Vigente
                            (esDecanoFirmante)
                          </span>
                        </label>
                      )}
                    </>
                  )}

                  {usuarioEditar && tabModal === 'PASSWORD' && (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-amber-700" />
                          <span>Restablecimiento Administrativo de Contraseña</span>
                        </p>
                        <p className="text-[11px] leading-relaxed">
                          Útil si{' '}
                          <b>
                            {usuarioEditar.gradoTitulo}{' '}
                            {usuarioEditar.nombresCompletos}
                          </b>{' '}
                          olvidó su clave o necesita rotar sus credenciales. El
                          cambio queda auditado sin registrar la clave en texto
                          plano.
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-gray-700">
                          Nueva Contraseña *
                        </label>
                        <button
                          type="button"
                          onClick={handleGenerarPassword}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#1E73BE] border border-blue-200 text-[11px] font-semibold hover:bg-blue-100"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Generar clave segura</span>
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type={mostrarPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Mín. 8 caracteres (mayúscula, minúscula y número)"
                          className="w-full rounded-xl border border-gray-300 pl-3.5 pr-20 py-2.5 text-xs font-mono focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {password && (
                            <button
                              type="button"
                              onClick={() => void handleCopiarPassword()}
                              title="Copiar contraseña"
                              className="p-1 text-gray-500 hover:text-[#1E73BE] rounded"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setMostrarPassword((prev) => !prev)}
                            title={mostrarPassword ? 'Ocultar' : 'Mostrar'}
                            className="p-1 text-gray-500 hover:text-gray-800 rounded"
                          >
                            {mostrarPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">
                          Confirmar Nueva Contraseña *
                        </label>
                        <input
                          type={mostrarPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={confirmarPassword}
                          onChange={(e) => setConfirmarPassword(e.target.value)}
                          placeholder="Repita la nueva contraseña"
                          className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs font-mono focus:border-[#1E73BE] focus:outline-none focus:ring-2 focus:ring-[#1E73BE]/20"
                        />
                        {confirmarPassword && password !== confirmarPassword && (
                          <p className="text-[11px] text-rose-600 mt-1 font-medium">
                            Las contraseñas no coinciden.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setModalAbierto(false)}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardando}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold shadow-sm transition-colors disabled:opacity-50 ${
                        usuarioEditar && tabModal === 'PASSWORD'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-[#1E73BE] hover:bg-[#155A9C]'
                      }`}
                    >
                      {guardando ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <span>
                          {!usuarioEditar
                            ? 'Registrar Usuario'
                            : tabModal === 'PASSWORD'
                              ? 'Restablecer Contraseña'
                              : 'Guardar Cambios'}
                        </span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
