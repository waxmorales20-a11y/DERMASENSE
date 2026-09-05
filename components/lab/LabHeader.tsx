'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, AlertTriangle, FlaskConical, FileText, Info } from 'lucide-react';
import { useLabStore } from '@/lib/store/useLabStore';

interface LabHeaderProps {
  onOpenAssumptions: () => void;
}

export const LabHeader: React.FC<LabHeaderProps> = ({ onOpenAssumptions }) => {
  const { result, status } = useLabStore();
  const confidence = result?.metrics.confidence ?? 'high';

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-bg">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight text-text">
                DERMASENSE
              </span>
              <span className="hidden rounded border border-border/80 bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-accent uppercase sm:inline-block">
                In Silico Lab
              </span>
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1.5 md:flex ml-4">
          <Link
            href="/lab"
            className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-accent shadow-xs"
          >
            Simulador 3D
          </Link>
          <Link
            href="/formulation"
            className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-text cursor-pointer"
          >
            <FlaskConical className="h-3.5 w-3.5 text-accent" />
            <span>Seleccionar Químicos</span>
          </Link>
          <Link
            href="/simulations"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text hover:bg-surface-2/60"
          >
            Historial
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {/* Píldora de la formulación activa */}
        {result && (
          <Link
            href="/formulation"
            className="hidden items-center gap-2 rounded-lg border border-border bg-surface-2/80 px-3 py-1 text-xs text-text transition-colors hover:border-accent md:flex cursor-pointer"
            title="Haga clic para cambiar los activos o parámetros de formulación"
          >
            <span className="font-semibold text-accent">{result.input.ingredient.name}</span>
            <span className="font-mono text-text-muted">{result.input.concentrationPct}%</span>
            <span className="text-border">·</span>
            <span className="text-text-muted">{result.input.vehicle.name}</span>
          </Link>
        )}

        <button
          onClick={onOpenAssumptions}
          className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
          title="Ver supuestos y limitaciones del modelo físico"
        >
          <Info className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Supuestos del modelo</span>
        </button>
      </div>
    </header>
  );
};
