// Archivo: app/dashboard/layout.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FolderKanban,
  FileSignature,
  BookOpen,
  BookMarked,
  Users,
  GraduationCap,
  ShieldAlert,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Award,
  ListChecks,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  apiFetch,
  cerrarSesion,
  obtenerUsuarioSesion,
  RolUsuario,
  UsuarioSesion,
} from '@/lib/api';

interface ItemNavegacion {
  nombre: string;
  href: string;
  icono: React.ElementType;
  rolesPermitidos: RolUsuario[];
  seccion: 'OPERATIVO' | 'GOBIERNO';
  badgeTexto?: string;
}

interface DecanoVigenteInfo {
  id: string;
  nombreCompletoFormateado: string;
  iniciales: string;
  correo: string;
}

const MENU_ITEMS: ItemNavegacion[] = [
  {
    nombre: 'Resumen General',
    href: '/dashboard',
    icono: LayoutDashboard,
    rolesPermitidos: ['DECANO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO'],
    seccion: 'OPERATIVO',
  },
  {
    nombre: 'Expedientes y 7 Pasos',
    href: '/dashboard/expedientes',
    icono: FolderKanban,
    rolesPermitidos: ['DECANO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO'],
    seccion: 'OPERATIVO',
  },
  {
    nombre: 'Lotes y Firmas PKCS#7',
    href: '/dashboard/firmas',
    icono: FileSignature,
    rolesPermitidos: ['DECANO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO'],
    seccion: 'OPERATIVO',
  },
  {
    nombre: 'Libro de Numeración',
    href: '/dashboard/numeracion',
    icono: BookOpen,
    rolesPermitidos: ['DECANO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO'],
    seccion: 'OPERATIVO',
    badgeTexto: 'ORD / CF',
  },
  {
    nombre: 'Libro de Inscripción',
    href: '/dashboard/libro-inscripcion',
    icono: BookMarked,
    rolesPermitidos: ['DECANO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO'],
    seccion: 'OPERATIVO',
  },
  {
    nombre: 'Catálogo de Docentes',
    href: '/dashboard/docentes',
    icono: GraduationCap,
    rolesPermitidos: ['DECANO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO'],
    seccion: 'OPERATIVO',
  },
  {
    nombre: 'Catálogo de Causas',
    href: '/dashboard/causas',
    icono: ListChecks,
    rolesPermitidos: ['DECANO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO'],
    seccion: 'OPERATIVO',
  },
  {
    nombre: 'Mi Actividad',
    href: '/dashboard/mi-actividad',
    icono: History,
    rolesPermitidos: ['DECANO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO'],
    seccion: 'OPERATIVO',
  },
  // SECCIÓN DE SUPERVISIÓN Y GOBIERNO (Filtrada estrictamente por Rol)
  {
    nombre: 'Auditoría Global',
    href: '/dashboard/auditoria',
    icono: ShieldAlert,
    rolesPermitidos: ['DECANO', 'SECRETARIA_ACADEMICA'],
    seccion: 'GOBIERNO',
  },
  {
    nombre: 'Usuarios y Decano Firmante',
    href: '/dashboard/usuarios',
    icono: Users,
    rolesPermitidos: ['DECANO'],
    seccion: 'GOBIERNO',
    badgeTexto: 'DECANO',
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [decanoVigente, setDecanoVigente] = useState<DecanoVigenteInfo | null>(null);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  useEffect(() => {
    const sesionLocal = obtenerUsuarioSesion();
    if (!sesionLocal) {
      router.replace('/login');
      return;
    }
    setTimeout(() => setUsuario(sesionLocal), 0);

    // Consultar dinámicamente quién tiene el flag esDecanoFirmante = true en identidad-service
    apiFetch<DecanoVigenteInfo>('/institucional/decano-vigente', {
      servicio: 'identidad',
    })
      .then((data) => setDecanoVigente(data))
      .catch(() => {
        // Silencioso si ocurre error de red puntual
      });
  }, [router]);

  const handleCerrarSesion = () => {
    cerrarSesion();
    toast.info('Sesión finalizada correctamente.');
    router.replace('/login');
  };

  if (!usuario) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm font-medium text-gray-500 animate-pulse">
          Cargando entorno institucional FCSa - UAC...
        </div>
      </div>
    );
  }

  const itemsOperativos = MENU_ITEMS.filter(
    (item) =>
      item.seccion === 'OPERATIVO' && item.rolesPermitidos.includes(usuario.rol),
  );

  const itemsGobierno = MENU_ITEMS.filter(
    (item) =>
      item.seccion === 'GOBIERNO' && item.rolesPermitidos.includes(usuario.rol),
  );

  const formatearEtiquetaRol = (rol: RolUsuario) => {
    if (rol === 'DECANO') return 'Decano';
    if (rol === 'SECRETARIA_ACADEMICA') return 'Secretaría Académica';
    return 'Administrativo';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* =================================================================== */}
      {/* BARRA LATERAL INSTITUCIONAL (#0B2B5A)                               */}
      {/* =================================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0B2B5A] text-white flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          menuMovilAbierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Cabecera del Sidebar */}
          <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white text-[#0B2B5A] flex items-center justify-center font-extrabold text-sm tracking-wider shadow">
                UAC
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-wide leading-tight">
                  FCSa — UAC
                </h2>
                <p className="text-[11px] text-blue-200">
                  Sistema de Titulación
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(false)}
              className="lg:hidden text-blue-200 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navegación Operativa */}
          <nav className="p-3 space-y-1">
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-300/80">
              Gestión Operativa
            </p>
            {itemsOperativos.map((item) => {
              const Icono = item.icono;
              const activo =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuMovilAbierto(false)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    activo
                      ? 'bg-white text-[#0B2B5A] font-semibold shadow-sm'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icono className="w-4 h-4 shrink-0" />
                    <span>{item.nombre}</span>
                  </div>
                  {item.badgeTexto && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                        activo
                          ? 'bg-[#0B2B5A]/10 text-[#0B2B5A]'
                          : 'bg-white/10 text-blue-200'
                      }`}
                    >
                      {item.badgeTexto}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Navegación de Supervisión y Gobierno (Solo se muestra si el Rol tiene permisos) */}
            {itemsGobierno.length > 0 && (
              <div className="pt-4 mt-4 border-t border-white/10 space-y-1">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300/90">
                  Supervisión y Gobierno
                </p>
                {itemsGobierno.map((item) => {
                  const Icono = item.icono;
                  const activo = pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuMovilAbierto(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                        activo
                          ? 'bg-white text-[#0B2B5A] font-semibold shadow-sm'
                          : 'text-blue-100 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icono className="w-4 h-4 shrink-0" />
                        <span>{item.nombre}</span>
                      </div>
                      {item.badgeTexto && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-amber-400/20 text-amber-300">
                          {item.badgeTexto}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Pie del Sidebar: Ficha del Usuario en Sesión y Botón Salir */}
        <div className="p-4 border-t border-white/10 bg-[#082044]">
          <div className="flex items-center justify-between mb-3">
            <div className="truncate pr-2">
              <p className="text-xs font-bold text-white truncate">
                {usuario.nombresCompletos}
              </p>
              <p className="text-[11px] text-blue-200 truncate">
                {formatearEtiquetaRol(usuario.rol)}
              </p>
            </div>
            <span className="px-2 py-1 rounded bg-white/15 text-white font-mono text-xs font-bold shrink-0">
              /{usuario.iniciales}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCerrarSesion}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* =================================================================== */}
      {/* CONTENEDOR PRINCIPAL (CABECERA SUPERIOR + CONTENIDO)                */}
      {/* =================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra Superior Institucional */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(true)}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-gray-900">
                Facultad de Ciencias de la Salud — UAC
              </h1>
              <p className="text-xs text-gray-500">
                Panel de Control y Trazabilidad de Resoluciones de Titulación
              </p>
            </div>
          </div>

          {/* Indicador Dinámico del Decano Firmante Activo y Rol */}
          <div className="flex items-center gap-3 flex-wrap">
            {decanoVigente && (
              <div className="hidden md:flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-xs">
                <Award className="w-4 h-4 text-[#0B2B5A] shrink-0" />
                <span className="text-gray-600">Decano Firmante:</span>
                <span className="font-bold text-[#0B2B5A]">
                  {decanoVigente.nombreCompletoFormateado}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="font-semibold text-gray-700">
                {formatearEtiquetaRol(usuario.rol)}
              </span>
              <span className="text-gray-300">|</span>
              <span className="font-mono font-bold text-[#0B2B5A]">
                {usuario.iniciales}
              </span>
            </div>
          </div>
        </header>

        {/* Área Dinámica de Páginas */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}