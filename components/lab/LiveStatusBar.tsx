'use client';

import React, { useMemo } from 'react';
import { useLabStore } from '@/lib/store/useLabStore';

/**
 * Franja de estado en vivo: qué está ocurriendo en la piel en el instante que
 * muestra el visor. Todos los valores se leen del motor, no se calculan aquí.
 */
export const LiveStatusBar: React.FC = () => {
  const { result, currentFrameIndex, getSite } = useLabStore();
  const currentFrame = result?.frames[currentFrameIndex];
  const metrics = result?.metrics;

  const status = useMemo(() => {
    if (!result || !currentFrame || !metrics) return null;

    const { mesh, frames } = result;
    const layers = getSite().layers;

    let maxConc = 1e-6;
    for (const frame of frames) {
      for (let i = 0; i < frame.concentrations.length; i++) {
        if (frame.concentrations[i] > maxConc) maxConc = frame.concentrations[i];
      }
    }

    const threshold = maxConc * 0.02;
    let deepestIdx = 0;
    for (let i = 0; i < mesh.positionsUm.length; i++) {
      if (currentFrame.concentrations[i] >= threshold) deepestIdx = i;
    }

    const timeHours = currentFrame.timeHours;
    const totalHours = frames[frames.length - 1].timeHours;
    const lag = metrics.lagTimeHours;

    const phase =
      timeHours < lag * 0.5
        ? 'Depósito sobre el estrato córneo'
        : timeHours < lag
          ? 'Travesía de la barrera lipídica'
          : metrics.irritationIndex >= 45
            ? 'Difusión con respuesta inflamatoria'
            : 'Difusión y distribución dérmica';

    return {
      phase,
      timeHours,
      totalHours,
      frontDepthUm: mesh.positionsUm[deepestIdx],
      frontLayerLabel: layers[mesh.layerIndex[deepestIdx]]?.label ?? '—',
      progressPct: totalHours > 0 ? Math.min(100, (timeHours / totalHours) * 100) : 0,
      irritationIndex: metrics.irritationIndex,
      isReactive: metrics.irritationIndex >= 45,
    };
  }, [result, currentFrame, metrics, getSite]);

  if (!status) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-border bg-surface-2/50 px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-semibold text-text">{status.phase}</span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
          {status.timeHours.toFixed(1)} h / {status.totalHours.toFixed(0)} h
        </span>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${status.progressPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px] text-text-muted">
        <span>
          Frente:{' '}
          <span className="tabular-nums font-medium text-text">
            {status.frontDepthUm.toFixed(0)} µm
          </span>{' '}
          · {status.frontLayerLabel}
        </span>
        <span>
          Irritación:{' '}
          <span
            className={`tabular-nums font-medium ${
              status.isReactive ? 'text-risk-high' : 'text-text'
            }`}
          >
            {status.irritationIndex}/100
          </span>
        </span>
      </div>
    </div>
  );
};
