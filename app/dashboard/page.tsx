// Archivo: app/dashboard/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  FolderKanban, FileSignature, BookOpen, ShieldCheck, Code, Database,
  Palette, Server, Mail, Phone, MapPin, GraduationCap, CheckCircle2,
  ChevronRight, Building2, Lock, PanelLeft
} from 'lucide-react';

// IMPORTAMOS EL CONTEXTO DESDE EL ARCHIVO CORRECTO
import { useSidebar } from './sidebar-context';

export default function DashboardPage() {
  const { sidebarAbierto, toggleSidebar } = useSidebar();

  return (
    <div className="space-y-6 pb-12 w-full">
      
      {/* 1. Header con Breadcrumbs */}
      <div className="flex flex-col gap-4">
        
        <nav className="flex items-center text-sm text-gray-500">
          {/* BOTÓN FUNCIONAL CONECTADO AL LAYOUT */}
          <button 
            className="hidden lg:flex p-1.5 mr-3 rounded-md text-gray-500 hover:bg-gray-200 transition-colors"
            title={sidebarAbierto ? "Ocultar menú" : "Mostrar menú"}
            onClick={toggleSidebar}
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
            Inicio
          </Link>
          <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
          <span className="font-medium text-gray-800">Resumen General</span>
        </nav>

        {/* Título y Descripción */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Sistema de Resoluciones FCSa - UAC
          </h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1 max-w-3xl">
            Gestión integral para la emisión y trazabilidad de resoluciones de titulación en la Facultad de Ciencias de la Salud.
          </p>
        </div>
      </div>

      {/* 2. Módulos Principales (Tarjetas de Colores) */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Módulos Principales del Sistema</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
          
          <Link href="/dashboard/expedientes" className="group flex flex-col items-center justify-center p-6 bg-blue-50/50 border border-blue-100 rounded-2xl hover:shadow-md hover:border-blue-200 transition-all text-center">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <FolderKanban className="w-6 h-6 text-[#1E73BE]" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Expedientes</h3>
            <p className="text-xs text-gray-500">Gestión de los 7 Pasos</p>
          </Link>

          <Link href="/dashboard/firmas" className="group flex flex-col items-center justify-center p-6 bg-emerald-50/50 border border-emerald-100 rounded-2xl hover:shadow-md hover:border-emerald-200 transition-all text-center">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <FileSignature className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Firmas Digitales</h3>
            <p className="text-xs text-gray-500">Validación PKCS#7</p>
          </Link>

          <Link href="/dashboard/numeracion" className="group flex flex-col items-center justify-center p-6 bg-amber-50/50 border border-amber-100 rounded-2xl hover:shadow-md hover:border-amber-200 transition-all text-center">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Libros Oficiales</h3>
            <p className="text-xs text-gray-500">Numeración y Registro</p>
          </Link>

          <Link href="/dashboard/docentes" className="group flex flex-col items-center justify-center p-6 bg-rose-50/50 border border-rose-100 rounded-2xl hover:shadow-md hover:border-rose-200 transition-all text-center">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <GraduationCap className="w-6 h-6 text-rose-500" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Catálogos</h3>
            <p className="text-xs text-gray-500">Docentes y Causas</p>
          </Link>

          <Link href="/dashboard/auditoria" className="group flex flex-col items-center justify-center p-6 bg-purple-50/50 border border-purple-100 rounded-2xl hover:shadow-md hover:border-purple-200 transition-all text-center">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Auditoría</h3>
            <p className="text-xs text-gray-500">Control y Trazabilidad</p>
          </Link>
        </div>
      </div>

      {/* 3. Grid de Información Inferior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 w-full">
        
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Code className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Tecnologías</h3>
                <p className="text-xs text-gray-500">Stack tecnológico del sistema</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-700 font-semibold mb-1">
                  <Server className="w-4 h-4" /> Backend
                </div>
                <p className="text-xs text-gray-500">NestJS (Microservicios)</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-700 font-semibold mb-1">
                  <Code className="w-4 h-4" /> Frontend
                </div>
                <p className="text-xs text-gray-500">Next.js 16 + TypeScript</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-700 font-semibold mb-1">
                  <Database className="w-4 h-4" /> Base de Datos
                </div>
                <p className="text-xs text-gray-500">PostgreSQL + Prisma ORM</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-700 font-semibold mb-1">
                  <Palette className="w-4 h-4" /> Estilo
                </div>
                <p className="text-xs text-gray-500">TailwindCSS</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Propiedad y Licenciamiento</h3>
                <p className="text-xs text-gray-500">Condiciones legales del sistema</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm text-gray-600 space-y-2">
              <p className="font-semibold text-gray-800">Licencia de Uso Académico</p>
              <p>Este sistema es desarrollado como proyecto de tesis para optar al título profesional en la Universidad Andina del Cusco.</p>
              <p>Todos los derechos reservados. No está permitido distribuir o modificar el código sin autorización del autor y la institución.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Validación y Alcance</h3>
                <p className="text-xs text-gray-500">Escuelas profesionales evaluadas</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-4">
              <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Escuelas Profesionales</p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Psicología
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200">
                  <CheckCircle2 className="w-3 h-3" /> Medicina Humana
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200">
                  <CheckCircle2 className="w-3 h-3" /> Enfermería
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-medium border border-rose-200">
                  <CheckCircle2 className="w-3 h-3" /> Estomatología
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Sistema validado con expedientes reales y pruebas de integración en el flujo de los 7 pasos de titulación.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-fuchsia-50 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-fuchsia-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Contacto del Desarrollador</h3>
                <p className="text-xs text-gray-500">Datos de contacto y soporte</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm font-bold text-gray-900">Arnold Alfaro Torres</p>
              <p className="text-xs text-gray-500">Desarrollo de software e innovación tecnológica</p>
            </div>

            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <span>Cusco, Perú</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                <span>+51 900 000 000</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <span>contacto@uandina.edu.pe</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="text-center pt-6 pb-2">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} - Todos los derechos reservados.
        </p>
      </div>

    </div>
  );
}