'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  definition?: string;
  rangeMin?: number;
  rangeMax?: number;
  numericVal?: number;
  badge?: string;
  badgeColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  definition,
  rangeMin = 0,
  rangeMax = 100,
  numericVal,
  badge,
  badgeColor,
}) => {
  // Calcular porcentaje para la micro-barra si aplica
  const hasBar = typeof numericVal === 'number' && rangeMax > rangeMin;
  const progressPct = hasBar
    ? Math.max(0, Math.min(100, ((numericVal! - rangeMin) / (rangeMax - rangeMin)) * 100))
    : null;

  return (
    <div className="group relative flex flex-col justify-between rounded-lg border border-border bg-surface-2/40 p-3 transition-colors hover:border-border/90 hover:bg-surface-2/70">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">
          {label}
        </span>
        {badge && (
          <span
            className="rounded px-1.5 py-0.2 text-[9px] font-semibold font-mono"
            style={{
              backgroundColor: badgeColor ? `${badgeColor}20` : 'rgba(34, 211, 238, 0.15)',
              color: badgeColor || '#22D3EE',
              border: `1px solid ${badgeColor ? `${badgeColor}40` : 'rgba(34, 211, 238, 0.3)'}`,
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Valor numérico en monoespaciada tabular */}
      <div className="my-1.5 flex items-baseline gap-1">
        <span className="font-mono text-xl font-bold tabular-nums text-text">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-[11px] text-text-muted">
            {unit}
          </span>
        )}
      </div>

      {/* Micro-barra de contexto físico */}
      {progressPct !== null && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-accent/70 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Subtexto explicativo si existe */}
      {definition && (
        <p className="mt-1 text-[10px] text-text-muted/80 leading-tight">
          {definition}
        </p>
      )}
    </div>
  );
};
