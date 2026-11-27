// Archivo: app/dashboard/layout.tsx
'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  FolderKanban, FileSignature, Users, GraduationCap,
  ShieldAlert, LayoutDashboard, LogOut, Menu, X,
  BookOpen, BarChart3, FileText, Settings, UserSquare2
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, cerrarSesion, obtenerUsuarioSesion, RolUsuario, UsuarioSesion } from '@/lib/api';

// IMPORTAMOS EL CONTEXTO DESDE EL ARCHIVO NUEVO
import { SidebarContext } from './sidebar-context';

interface ItemNavegacion {
  nombre: string;
  href: string;
  icono: React.ElementType;
  rolesPermitidos: RolUsuario[];
  seccion: 'OPERATIVO' | 'GOBIERNO';
  badgeTexto?: string;
}

const TODOS_LOS_ROLES: RolUsuario[] = ['ADMIN', 'DECANO', 'SECRETARIA_ACADEMICA', 'ADMINISTRATIVO'];

const MENU_ITEMS: ItemNavegacion[] = [
  { nombre: 'Resumen General', href: '/dashboard', icono: LayoutDashboard, rolesPermitidos: TODOS_LOS_ROLES, seccion: 'OPERATIVO' },
  { nombre: 'Expedientes y 7 Pasos', href: '/dashboard/expedientes', icono: FolderKanban, rolesPermitidos: TODOS_LOS_ROLES, seccion: 'OPERATIVO' },
  { nombre: 'Lotes y Firmas PKCS#7', href: '/dashboard/firmas', icono: FileSignature, rolesPermitidos: TODOS_LOS_ROLES, seccion: 'OPERATIVO' },
  { nombre: 'Libros Oficiales', href: '/dashboard/libros', icono: BookOpen, rolesPermitidos: TODOS_LOS_ROLES, seccion: 'OPERATIVO', badgeTexto: 'ORD / CF' },
  { nombre: 'Catálogo de Docentes', href: '/dashboard/docentes', icono: GraduationCap, rolesPermitidos: TODOS_LOS_ROLES, seccion: 'OPERATIVO' },
  { nombre: 'Estudiantes', href: '/dashboard/estudiantes', icono: UserSquare2, rolesPermitidos: TODOS_LOS_ROLES, seccion: 'OPERATIVO' },
  { nombre: 'Plantillas', href: '/dashboard/plantillas', icono: FileText, rolesPermitidos: TODOS_LOS_ROLES, seccion: 'OPERATIVO' },
  { nombre: 'Reportes y Estadísticas', href: '/dashboard/reportes', icono: BarChart3, rolesPermitidos: ['ADMIN', 'DECANO'], seccion: 'GOBIERNO' },
  { nombre: 'Configuración y Causas', href: '/dashboard/configuracion', icono: Settings, rolesPermitidos: TODOS_LOS_ROLES, seccion: 'GOBIERNO' },
  { nombre: 'Auditoría Global', href: '/dashboard/auditoria', icono: ShieldAlert, rolesPermitidos: ['ADMIN', 'DECANO', 'SECRETARIA_ACADEMICA'], seccion: 'GOBIERNO' },
  { nombre: 'Usuarios y Decano Firmante', href: '/dashboard/usuarios', icono: Users, rolesPermitidos: ['ADMIN', 'DECANO'], seccion: 'GOBIERNO', badgeTexto: 'ADMIN / DECANO' },
];

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(true);

  useEffect(() => {
    const sesionLocal = obtenerUsuarioSesion();
    if (!sesionLocal) {
      router.replace('/login');
      return;
    }
    let cancelado = false;
    setTimeout(() => {
      if (!cancelado) setUsuario(sesionLocal);
    }, 0);

    // Verifica en vivo contra identidad-service que la cuenta siga ACTIVA y sincroniza el rol real
    void apiFetch<{ id?: string; sub?: string; rol: RolUsuario; iniciales?: string }>('/auth/me', {
      servicio: 'identidad',
    })
      .then((perfilServidor) => {
        if (cancelado || !perfilServidor?.rol) return;
        if (
          perfilServidor.rol !== sesionLocal.rol ||
          (perfilServidor.iniciales && perfilServidor.iniciales !== sesionLocal.iniciales)
        ) {
          const actualizado: UsuarioSesion = {
            ...sesionLocal,
            rol: perfilServidor.rol,
            iniciales: perfilServidor.iniciales || sesionLocal.iniciales,
          };
          localStorage.setItem('usuario', JSON.stringify(actualizado));
          setUsuario(actualizado);
        }
      })
      .catch(() => {
        // Si es 401 (cuenta desactivada o token revocado), apiFetch cierra sesión y redirige a /login
      });

    return () => {
      cancelado = true;
    };
  }, [router]);

  const handleCerrarSesion = () => {
    cerrarSesion();
    toast.info('Sesión finalizada correctamente.');
    router.replace('/login');
  };

  const toggleSidebar = () => setSidebarAbierto(!sidebarAbierto);

  if (!usuario) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm font-medium text-[#1E73BE] animate-pulse">
          Cargando entorno institucional FCSa - UAC...
        </div>
      </div>
    );
  }

  const itemsOperativos = MENU_ITEMS.filter((item) => item.seccion === 'OPERATIVO' && item.rolesPermitidos.includes(usuario.rol));
  const itemsGobierno = MENU_ITEMS.filter((item) => item.seccion === 'GOBIERNO' && item.rolesPermitidos.includes(usuario.rol));

  const formatearEtiquetaRol = (rol: RolUsuario) => {
    if (rol === 'ADMIN') return 'Administrador';
    if (rol === 'DECANO') return 'Decano';
    if (rol === 'SECRETARIA_ACADEMICA') return 'Secretaría Académica';
    return 'Administrativo';
  };

  const obtenerNombreLimpio = (nombreCrudo: string) => {
    const nombre = nombreCrudo.replace(/^(Ing\.|Dr\.|Dra\.|Mg\.|Lic\.|Mtro\.|Mtra\.)\s+/i, '');
    const partes = nombre.split(' ');
    if (partes.length > 3) {
      return `${partes[0]} ${partes.slice(2).join(' ')}`;
    }
    return nombre;
  };

  const nombreMostrar = obtenerNombreLimpio(usuario.nombresCompletos);

  return (
    <SidebarContext.Provider value={{ sidebarAbierto, toggleSidebar }}>
      <div className="min-h-screen bg-[#F8FAFC] flex font-sans overflow-hidden">
        
        {/* BARRA LATERAL */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 flex flex-col justify-between transition-all duration-300 ease-in-out
            ${menuMovilAbierto ? 'translate-x-0 w-72' : '-translate-x-full w-72'}
            ${sidebarAbierto ? 'lg:static lg:translate-x-0 lg:w-72' : 'lg:w-0 lg:opacity-0 lg:overflow-hidden lg:border-none'}
          `}
        >
          <div className="flex flex-col h-full min-w-[288px]">
            {/* Cabecera del Sidebar (SIN BOTÓN) */}
            <div className="px-6 py-8 flex flex-col items-center justify-center border-b border-gray-100 relative">
              <div className="relative w-16 h-16 mb-3">
                <Image src="/logo-fcsa.png" alt="Logo FCSa" fill className="object-contain" priority />
              </div>
              <h2 className="text-xs font-bold text-gray-800 text-center tracking-wide leading-relaxed uppercase">
                Facultad de Ciencias<br />de la Salud
              </h2>
              
              <button
                type="button"
                onClick={() => setMenuMovilAbierto(false)}
                className="lg:hidden absolute top-4 right-4 text-gray-500 hover:text-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navegación */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Gestión Operativa</p>
              {itemsOperativos.map((item) => {
                const Icono = item.icono;
                const activo = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMenuMovilAbierto(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${activo ? 'bg-blue-50 text-[#1E73BE]' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icono className={`w-4 h-4 shrink-0 ${activo ? 'text-[#1E73BE]' : 'text-gray-400 group-hover:text-gray-600'}`} />
                      <span>{item.nombre}</span>
                    </div>
                    {item.badgeTexto && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${activo ? 'bg-[#1E73BE]/10 text-[#1E73BE]' : 'bg-gray-100 text-gray-500'}`}>
                        {item.badgeTexto}
                      </span>
                    )}
                  </Link>
                );
              })}

              {itemsGobierno.length > 0 && (
                <div className="pt-4 mt-4 border-t border-gray-100 space-y-1">
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-500">Supervisión y Gobierno</p>
                  {itemsGobierno.map((item) => {
                    const Icono = item.icono;
                    const activo = pathname.startsWith(item.href);
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setMenuMovilAbierto(false)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${activo ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                      >
                        <div className="flex items-center gap-3">
                          <Icono className={`w-4 h-4 shrink-0 ${activo ? 'text-amber-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                          <span>{item.nombre}</span>
                        </div>
                        {item.badgeTexto && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${activo ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                            {item.badgeTexto}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </nav>

            {/* Perfil */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <div className="flex items-center justify-between p-2 rounded-xl transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-9 h-9 rounded-full bg-[#1E73BE] text-white flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                    {nombreMostrar.charAt(0)}
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-semibold text-gray-900 uppercase truncate">{nombreMostrar}</span>
                    <span className="text-xs text-gray-500 truncate">{formatearEtiquetaRol(usuario.rol)}</span>
                  </div>
                </div>
                <button type="button" onClick={handleCerrarSesion} title="Cerrar Sesión" className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* CONTENEDOR PRINCIPAL */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative bg-[#F8FAFC]">
          
          {/* Botón flotante solo para móvil */}
          <button
            type="button"
            onClick={() => setMenuMovilAbierto(true)}
            className="lg:hidden absolute top-6 left-6 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600"
          >
            <Menu className="w-5 h-5" />
          </button>

          <main className="flex-1 overflow-y-auto p-6 sm:p-8 w-full">
            <div className="w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-sm font-medium text-[#1E73BE] animate-pulse">
            Cargando entorno institucional FCSa - UAC...
          </div>
        </div>
      }
    >
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}