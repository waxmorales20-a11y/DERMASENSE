'use client';

import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { Confidence } from '@/packages/engine/types';

interface ConfidenceBannerProps {
  confidence: Confidence;
  reasons: string[];
}

export const ConfidenceBanner: React.FC<ConfidenceBannerProps> = ({ confidence, reasons }) => {
  if (confidence === 'high') return null;

  const isLow = confidence === 'low';

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 text-xs ${
        isLow
          ? 'border-warn/50 bg-warn/10 text-warn'
          : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
      }`}
      role="alert"
    >
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          {isLow ? 'Simulación Fuera del Dominio (Confianza Baja)' : 'Confianza Moderada'}
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-text/90">
        Los parámetros ingresados exceden los límites empíricos de la correlación de Potts-Guy
        (1992). El motor computa la difusión, pero las magnitudes derivadas deben interpretarse con
        cautela:
      </p>

      {reasons && reasons.length > 0 && (
        <ul className="list-inside list-disc space-y-1 font-mono text-[10px] text-text">
          {reasons.map((reason, idx) => (
            <li key={idx} className="leading-snug">
              {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
