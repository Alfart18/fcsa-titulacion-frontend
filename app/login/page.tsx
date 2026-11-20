// Archivo: app/login/page.tsx
'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, guardarSesion, iniciarSesionApi, RolUsuario } from '@/lib/api';
import Image from 'next/image';

const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  ADMIN: 'Administrador',
  DECANO: 'Decano',
  SECRETARIA_ACADEMICA: 'Secretaría Académica',
  ADMINISTRATIVO: 'Administrativo',
};

export default function LoginPage() {
  const router = useRouter();

  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMensaje(null);

    if (!correo.trim() || !password) {
      setErrorMensaje('Por favor, ingrese su correo institucional y contraseña.');
      return;
    }

    setCargando(true);

    try {
      const respuesta = await iniciarSesionApi(correo.trim(), password);
      guardarSesion(respuesta);

      const etiquetaRol = ETIQUETAS_ROL[respuesta.usuario.rol] ?? respuesta.usuario.rol;
      toast.success(`Bienvenido(a), ${respuesta.usuario.nombresCompletos}`, {
        description: `Sesión iniciada como ${etiquetaRol} (${respuesta.usuario.iniciales})`,
      });

      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMensaje(err.message || 'Credenciales incorrectas.');
        } else if (err.status === 429) {
          setErrorMensaje(
            'Demasiados intentos de inicio de sesión. Espere un minuto e intente nuevamente.',
          );
        } else {
          setErrorMensaje(err.message);
        }
      } else {
        setErrorMensaje(
          'No se pudo conectar con el servidor de identidad (Puerto 4000). Verifique que el servicio esté activo.',
        );
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center font-sans p-4">
      
      {/* Tarjeta del Login */}
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10">
        
        {/* Títulos */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Ingreso</h1>
          <p className="text-sm text-gray-500">Ingrese sus credenciales de acceso</p>
        </div>

        {/* Alerta de Error */}
        {errorMensaje && (
          <div className="mb-5 flex items-center gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="font-medium">{errorMensaje}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          
          {/* Email con Icono */}
          <div>
            <label htmlFor="correo" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Correo Institucional
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="correo"
                type="email"
                autoComplete="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                disabled={cargando}
                placeholder="usuario@uandina.edu.pe"
                className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#0B2B5A] focus:outline-none focus:ring-2 focus:ring-[#0B2B5A]/20 disabled:bg-gray-50 transition-colors"
              />
            </div>
          </div>

          {/* Contraseña con Iconos (SIN EL ENLACE) */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              {/* Icono Candado Izquierda */}
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              {/* Input */}
              <input
                id="password"
                type={mostrarPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={cargando}
                placeholder="••••••••••••"
                className="w-full border border-gray-300 rounded-xl pl-10 pr-10 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#0B2B5A] focus:outline-none focus:ring-2 focus:ring-[#0B2B5A]/20 disabled:bg-gray-50 transition-colors"
              />
              {/* Icono Ojito Derecha */}
              <button
                type="button"
                onClick={() => setMostrarPassword((prev) => !prev)}
                tabIndex={-1}
                disabled={cargando}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50"
              >
                {mostrarPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Botón Ingresar */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2 bg-[#2880C5] text-white font-semibold rounded-xl py-3 text-sm hover:bg-[#1E73BE] transition-colors mt-4 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {cargando ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Verificando...</span>
              </>
            ) : (
              <span>Ingresar al Sistema</span>
            )}
          </button>
        </form>

        {/* Zona de Logos */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center justify-center gap-4">
          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-widest text-center mb-1">
            Universidad Andina del Cusco<br />Facultad de Ciencias de la Salud
          </p>
          
          <div className="flex items-center justify-center gap-6">
            {/* Logo UAC (Más grande) */}
            <div className="relative h-12 w-32 sm:h-14 sm:w-36">
              <Image 
                src="/logo-uac.png" 
                alt="UAC" 
                fill
                className="object-contain" 
                priority
              />
            </div>
            
            {/* Separador (Más alto para acompañar el nuevo tamaño) */}
            <div className="w-px h-12 bg-gray-300"></div>

            {/* Logo FCSa (Más grande) */}
            <div className="relative h-16 w-16 sm:h-20 sm:w-20">
              <Image 
                src="/logo-fcsa.png" 
                alt="FCSa" 
                fill
                className="object-contain" 
                priority
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}