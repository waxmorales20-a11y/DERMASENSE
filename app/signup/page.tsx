'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { FlaskConical, Lock, Mail, User, Building, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    if (!isConfigured) {
      router.push('/lab');
      return;
    }

    try {
      const supabase = createClient();
      if (!supabase) {
        router.push('/lab');
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            organization,
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push('/lab');
      } else {
        setSuccessMessage(
          'Registro exitoso. Se ha enviado un correo de confirmación para verificar su cuenta.',
        );
        setLoading(false);
      }
    } catch (err) {
      setErrorMessage('Error al procesar el registro de usuario.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg px-4 text-text py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl md:p-8">
        {/* Cabecera */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent mb-3">
            <FlaskConical className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text">Crear Cuenta Profesional</h1>
          <p className="mt-1 text-xs text-text-muted">
            Únete al entorno de simulación in silico de formulación y penetración cutánea.
          </p>
        </div>

        {/* Notificaciones */}
        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-risk/40 bg-risk/10 p-3 text-xs text-risk">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-ok/40 bg-ok/10 p-3 text-xs text-ok">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="fullName"
              className="text-[11px] font-medium tracking-wider text-text-muted uppercase"
            >
              Nombre Completo
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3 h-4 w-4 text-text-muted" />
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dra. Elena Ramos"
                className="w-full rounded-md border border-border bg-surface-2 py-2 pl-9 pr-3 text-xs text-text transition-colors placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="organization"
              className="text-[11px] font-medium tracking-wider text-text-muted uppercase"
            >
              Organización / Laboratorio
            </label>
            <div className="relative flex items-center">
              <Building className="absolute left-3 h-4 w-4 text-text-muted" />
              <input
                id="organization"
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Laboratorios Dermocosméticos S.A."
                className="w-full rounded-md border border-border bg-surface-2 py-2 pl-9 pr-3 text-xs text-text transition-colors placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
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
                placeholder="investigador@instituto.org"
                className="w-full rounded-md border border-border bg-surface-2 py-2 pl-9 pr-3 text-xs text-text transition-colors placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="text-[11px] font-medium tracking-wider text-text-muted uppercase"
            >
              Contraseña
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 h-4 w-4 text-text-muted" />
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-md border border-border bg-surface-2 py-2 pl-9 pr-3 text-xs text-text transition-colors placeholder:text-text-muted/60 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-xs font-semibold text-bg transition-all hover:bg-accent/90 disabled:opacity-50"
          >
            <span>{loading ? 'Registrando...' : 'Registrar Cuenta'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>

        <div className="mt-5 flex flex-col gap-2 pt-3 border-t border-border/80 text-center">
          <Link href="/lab" className="text-xs font-medium text-accent hover:underline">
            Continuar en modo exploratorio sin registro →
          </Link>

          <p className="text-[11px] text-text-muted">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="text-text hover:text-accent font-medium">
              Iniciar Sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
