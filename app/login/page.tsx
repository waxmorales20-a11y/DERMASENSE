'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { FlaskConical, Lock, Mail, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/lab';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    if (!isConfigured) {
      router.push(next);
      return;
    }

    try {
      const supabase = createClient();
      if (!supabase) {
        router.push(next);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(
          error.message === 'Invalid login credentials'
            ? 'Credenciales inválidas. Compruebe su correo y contraseña.'
            : error.message,
        );
        setLoading(false);
        return;
      }

      router.push(next);
    } catch (err) {
      setErrorMessage('Ocurrió un error inesperado al conectar con el servicio de autenticación.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl md:p-8">
      {/* Cabecera */}
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent mb-3">
          <FlaskConical className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-text">Iniciar Sesión</h1>
        <p className="mt-1 text-xs text-text-muted">
          Accede al laboratorio in silico de DERMASENSE y a tu historial de simulaciones.
        </p>
      </div>

      {/* Aviso si Supabase está en modo local */}
      {!isConfigured && (
        <div className="mt-5 rounded-lg border border-accent/40 bg-accent-soft/20 p-3 text-xs leading-relaxed text-text">
          <div className="flex items-center gap-1.5 font-semibold text-accent mb-1">
            <ShieldCheck className="h-4 w-4" />
            <span>Modo exploratorio activo</span>
          </div>
          <p className="text-[11px] text-text-muted">
            El entorno no requiere credenciales activas. Puedes acceder directamente al simulador
            o continuar como invitado.
          </p>
        </div>
      )}

      {/* Error */}
      {errorMessage && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-risk/40 bg-risk/10 p-3 text-xs text-risk">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-[11px] font-medium tracking-wider text-text-muted uppercase"
          >
            Correo Electrónico
          </label>
          <div className="relative flex items-center">
            <Mail className="absolute left-3 h-4 w-4 text-text-muted" />
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="quimico@laboratorio.com"
              className="w-full rounded-md border border-border bg-surface-2 py-2 pl-9 pr-3 text-xs text-text transition-colors placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-[11px] font-medium tracking-wider text-text-muted uppercase"
            >
              Contraseña
            </label>
          </div>
          <div className="relative flex items-center">
            <Lock className="absolute left-3 h-4 w-4 text-text-muted" />
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-surface-2 py-2 pl-9 pr-3 text-xs text-text transition-colors placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-xs font-semibold text-bg transition-all hover:bg-accent/90 disabled:opacity-50"
        >
          <span>{loading ? 'Accediendo...' : 'Acceder al Laboratorio'}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </form>

      {/* Acceso directo como invitado */}
      <div className="mt-4 flex flex-col gap-3 pt-3 border-t border-border/80 text-center">
        <Link
          href="/lab"
          className="text-xs font-medium text-accent hover:underline"
        >
          Continuar sin cuenta (Modo Invitado) →
        </Link>

        <p className="text-[11px] text-text-muted">
          ¿No tienes cuenta?{' '}
          <Link href="/signup" className="text-text hover:text-accent font-medium">
            Registrarse
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg px-4 text-text">
      <Suspense fallback={<div className="text-xs text-text-muted">Cargando autenticación...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
