// Archivo: app/login/page.tsx
'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, guardarSesion, iniciarSesionApi } from '@/lib/api';

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

      toast.success(`Bienvenido(a), ${respuesta.usuario.nombresCompletos}`, {
        description: `Sesión iniciada como ${respuesta.usuario.rol} (${respuesta.usuario.iniciales})`,
      });

      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMensaje('Credenciales incorrectas');
        } else {
          // Por ejemplo 403 cuando la cuenta está DESACTIVADA o 400 por formato de correo
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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4 py-12">
      {/* Tarjeta Blanca Centrada con Sombra */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 sm:p-10">
        {/* Encabezado y Logo Institucional UAC */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#0B2B5A] text-white flex items-center justify-center font-bold text-xl tracking-wider shadow-md mb-4 select-none">
            UAC
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Universidad Andina del Cusco
          </h1>
          <p className="text-sm font-medium text-[#0B2B5A] mt-0.5">
            Facultad de Ciencias de la Salud
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Sistema de Gestión de Resoluciones para Titulación
          </p>
        </div>

        {/* Alerta de Error (401 Credenciales incorrectas / 403 Cuenta desactivada) */}
        {errorMensaje && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2.5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="font-medium">{errorMensaje}</span>
          </div>
        )}

        {/* Formulario de Inicio de Sesión */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Campo de Correo Institucional */}
          <div>
            <label
              htmlFor="correo"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
            >
              Correo Institucional
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="correo"
                name="correo"
                type="email"
                autoComplete="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="usuario@uandina.edu.pe"
                disabled={cargando}
                className="block w-full rounded-lg border border-gray-300 bg-white pl-11 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#0B2B5A] focus:outline-none focus:ring-2 focus:ring-[#0B2B5A]/20 disabled:bg-gray-100 transition"
              />
            </div>
          </div>

          {/* Campo de Contraseña con Candado y Ojito */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
            >
              Contraseña
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type={mostrarPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={cargando}
                className="block w-full rounded-lg border border-gray-300 bg-white pl-11 pr-11 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#0B2B5A] focus:outline-none focus:ring-2 focus:ring-[#0B2B5A]/20 disabled:bg-gray-100 transition"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {mostrarPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Botón Institucional UAC (#0B2B5A) */}
          <button
            type="submit"
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0B2B5A] px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#082044] focus:outline-none focus:ring-2 focus:ring-[#0B2B5A] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {cargando ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Verificando credenciales...</span>
              </>
            ) : (
              <span>Iniciar Sesión</span>
            )}
          </button>
        </form>

        {/* Pie de tarjeta informativo */}
        <div className="mt-8 pt-5 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Acceso exclusivo para personal autorizado del Decanato y Secretaría Académica — FCSa UAC
          </p>
        </div>
      </div>
    </div>
  );
}