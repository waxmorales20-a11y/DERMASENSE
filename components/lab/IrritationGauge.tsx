'use client';

import React from 'react';
import type { IrritationBand } from '@/packages/engine/types';
import { AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface IrritationGaugeProps {
  score: number; // 0 - 100
  band: IrritationBand;
}

const BAND_META: Record<
  IrritationBand,
  { label: string; color: string; bg: string; border: string; desc: string }
> = {
  low: {
    label: 'Baja',
    color: '#34D399', // --ok
    bg: 'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.3)',
    desc: 'Exposición cutánea moderada; perfil compatible con formulación estándar.',
  },
  moderate: {
    label: 'Moderada',
    color: '#FBBF24', // --warn
    bg: 'rgba(251, 191, 36, 0.12)',
    border: 'rgba(251, 191, 36, 0.3)',
    desc: 'Exposición celular relevante en epidermis viable; considerar atenuadores o buffer.',
  },
  high: {
    label: 'Alta',
    color: '#F87171', // --risk
    bg: 'rgba(248, 113, 113, 0.12)',
    border: 'rgba(248, 113, 113, 0.3)',
    desc: 'Fuerte acumulación en epidermis viable o pH en extremos. Posible eritema.',
  },
  very_high: {
    label: 'Muy Alta',
    color: '#DC2626', // --risk-high
    bg: 'rgba(220, 38, 38, 0.15)',
    border: 'rgba(220, 38, 38, 0.4)',
    desc: 'Nivel crítico de exposición tisular en el modelo.',
  },
};

export const IrritationGauge: React.FC<IrritationGaugeProps> = ({ score, band }) => {
  const currentMeta = BAND_META[band] ?? BAND_META.low;
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/60 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
          Índice de Irritación
        </span>
        <span
          className="rounded px-2 py-0.5 text-xs font-semibold"
          style={{
            backgroundColor: currentMeta.bg,
            color: currentMeta.color,
            border: `1px solid ${currentMeta.border}`,
          }}
        >
          {currentMeta.label}
        </span>
      </div>

      {/* Valor numérico grande y barra de 4 bandas */}
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-3xl font-bold tabular-nums text-text">
          {clampedScore}
        </span>
        <span className="font-mono text-xs text-text-muted">/ 100</span>
      </div>

      {/* Barra segmentada de las 4 bandas de riesgo */}
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-4 gap-1 h-2 rounded overflow-hidden bg-surface">
          <div
            className="h-full rounded-xs transition-opacity"
            style={{
              backgroundColor: '#34D399',
              opacity: clampedScore <= 25 ? 1 : 0.4,
            }}
            title="0-25: Baja"
          />
          <div
            className="h-full rounded-xs transition-opacity"
            style={{
              backgroundColor: '#FBBF24',
              opacity: clampedScore > 25 && clampedScore <= 50 ? 1 : 0.4,
            }}
            title="26-50: Moderada"
          />
          <div
            className="h-full rounded-xs transition-opacity"
            style={{
              backgroundColor: '#F87171',
              opacity: clampedScore > 50 && clampedScore <= 75 ? 1 : 0.4,
            }}
            title="51-75: Alta"
          />
          <div
            className="h-full rounded-xs transition-opacity"
            style={{
              backgroundColor: '#DC2626',
              opacity: clampedScore > 75 ? 1 : 0.4,
            }}
            title="76-100: Muy Alta"
          />
        </div>

        {/* Indicador de posición */}
        <div className="relative h-1 w-full">
          <div
            className="absolute -top-1.5 h-3 w-1.5 -translate-x-1/2 rounded bg-text shadow-sm transition-all duration-300"
            style={{ left: `${clampedScore}%` }}
          />
        </div>
      </div>

      {/* TEXTO OBLIGATORIO Y NO NEGOCIABLE (docs/ANTIGRAVITY_FRONTEND_PROMPT.md §5) */}
      <div className="flex items-start gap-1.5 rounded border border-border/80 bg-surface/80 p-2 text-[11px] leading-snug text-text-muted">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-accent mt-0.5" />
        <p>
          <strong className="text-text font-medium">estimación heurística exploratoria</strong> — no es una evaluación de seguridad.
        </p>
      </div>
    </div>
  );
};
