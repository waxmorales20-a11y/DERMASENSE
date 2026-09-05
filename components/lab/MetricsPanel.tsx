'use client';

import React, { useState } from 'react';
import { useLabStore } from '@/lib/store/useLabStore';
import { ConfidenceBanner } from './ConfidenceBanner';
import { IrritationGauge } from './IrritationGauge';
import { MetricCard } from './MetricCard';
import { Save, BrainCircuit, Check, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveLocalSimulation } from '@/lib/storage/local-simulations';
import Link from 'next/link';

interface MetricsPanelProps {
  onOpenReport?: () => void;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ onOpenReport }) => {
  const { result, status } = useLabStore();
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!result) {
    return (
      <aside className="flex h-full w-full items-center justify-center border-l border-border bg-surface p-6 lg:w-[340px] lg:shrink-0">
        <p className="text-xs text-text-muted">Aguardando cálculo de simulación...</p>
      </aside>
    );
  }

  const { metrics, input } = result;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // 1. Guardado en almacenamiento local garantizado (nunca falla)
      const localItem = saveLocalSimulation({
        input,
        metrics,
        engineVersion: result.engineVersion,
      });

      // 2. Intento de persistencia contra la API / Supabase
      try {
        const res = await fetch('/api/simulations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input, metrics }),
        });

        if (res.ok) {
          const data = await res.json();
          toast.success('Simulación guardada', {
            description: `${input.ingredient.name} ${input.concentrationPct}% guardado con éxito.`,
          });
        } else {
          // Guardado local exitoso ante sesión no iniciada o falta de red
          toast.info('Guardado localmente', {
            description: 'Preservado en tu navegador. Inicia sesión para sincronizar en la nube.',
          });
        }
      } catch {
        // Red offline: resultado seguro en localStorage
        toast.info('Guardado localmente (Offline)', {
          description: 'La simulación se preservó en tu dispositivo.',
        });
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside className="flex h-full w-full flex-col justify-between overflow-y-auto border-l border-border bg-surface p-4 lg:w-[340px] lg:shrink-0">
      <div className="flex flex-col gap-4">
        {/* Encabezado del panel */}
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <h2 className="text-xs font-semibold tracking-wider text-text uppercase">
            Métricas de Simulación
          </h2>
          <span className="font-mono text-[11px] tabular-nums text-text-muted">
            {metrics.confidence === 'high' ? (
              <span className="text-ok font-medium">✓ Verificado</span>
            ) : (
              <span className="text-warn font-medium">⚠ Fuera de dominio</span>
            )}
          </span>
        </div>

        {/* Banner de aviso de confianza si está fuera de dominio */}
        <ConfidenceBanner
          confidence={metrics.confidence}
          reasons={metrics.outOfDomainReasons}
        />

        {/* 1. Indicador de irritación heurístico */}
        <IrritationGauge
          score={metrics.irritationIndex}
          band={metrics.irritationBand}
        />

        {/* 2. Grid de métricas físicas tabulares */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* log Kp */}
          <MetricCard
            label="log Kp"
            value={metrics.logKp.toFixed(2)}
            definition="Coeficiente Potts-Guy (cm/h)"
            numericVal={metrics.logKp}
            rangeMin={-6}
            rangeMax={0}
          />

          {/* Permeabilidad Kp */}
          <MetricCard
            label="Permeabilidad Kp"
            value={(metrics.permeabilityCmH * 1000).toFixed(3)}
            unit="×10⁻³ cm/h"
            definition="Permeabilidad SC"
            numericVal={metrics.permeabilityCmH * 1000}
            rangeMin={0}
            rangeMax={10}
          />

          {/* Flujo máximo teórico */}
          <MetricCard
            label="Flujo Máx. Teórico"
            value={metrics.maxFluxInfiniteDose.toFixed(1)}
            unit="µg/cm²/h"
            definition="Cota superior a dosis infinita"
            numericVal={metrics.maxFluxInfiniteDose}
            rangeMin={0}
            rangeMax={500}
          />

          {/* Lag time */}
          <MetricCard
            label="Lag Time"
            value={metrics.lagTimeHours >= 9999 ? '>9999' : metrics.lagTimeHours.toFixed(2)}
            unit="h"
            definition="Retardo estacionario"
            numericVal={metrics.lagTimeHours >= 9999 ? 48 : metrics.lagTimeHours}
            rangeMin={0}
            rangeMax={24}
          />

          {/* Tiempo al 50% de absorción */}
          <MetricCard
            label="Tiempo al 50%"
            value={metrics.timeTo50PctHours >= 9999 ? '>9999' : metrics.timeTo50PctHours.toFixed(1)}
            unit="h"
            definition="t₅₀ cruce estrato córneo"
            numericVal={metrics.timeTo50PctHours >= 9999 ? 48 : metrics.timeTo50PctHours}
            rangeMin={0}
            rangeMax={48}
          />

          {/* Fracción absorbida */}
          <MetricCard
            label="Fracción Cruzada"
            value={metrics.absorbedFractionPct.toFixed(1)}
            unit="%"
            definition="Masa que cruza el SC"
            numericVal={metrics.absorbedFractionPct}
            rangeMin={0}
            rangeMax={100}
          />

          {/* Profundidad alcanzada */}
          <MetricCard
            label="Profundidad"
            value={metrics.penetrationDepthUm.toFixed(0)}
            unit="µm"
            definition="Cota al 5% de actividad"
            numericVal={metrics.penetrationDepthUm}
            rangeMin={0}
            rangeMax={2500}
          />

          {/* Concentración pico en epidermis viable */}
          <MetricCard
            label="Pico Epidermis V."
            value={metrics.peakConcentrationVE.toFixed(1)}
            unit="µg/cm³"
            definition="Exposición viable máxima"
            numericVal={metrics.peakConcentrationVE}
            rangeMin={0}
            rangeMax={200}
          />
        </div>
      </div>

      {/* Botones de acción inferior */}
      <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span>Guardando...</span>
            </>
          ) : savedSuccess ? (
            <>
              <Check className="h-4 w-4 text-ok" />
              <span className="text-ok font-semibold">Guardado</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Guardar Simulación</span>
            </>
          )}
        </button>

        {onOpenReport ? (
          <button
            onClick={onOpenReport}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent-soft/70 px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-accent hover:text-bg"
          >
            <BrainCircuit className="h-4 w-4" />
            <span>Generar Reporte Técnico IA</span>
            <ArrowRight className="h-3.5 w-3.5 ml-auto" />
          </button>
        ) : (
          <Link
            href="/simulations"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent-soft/70 px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-accent hover:text-bg"
          >
            <BrainCircuit className="h-4 w-4" />
            <span>Generar Reporte Técnico IA</span>
            <ArrowRight className="h-3.5 w-3.5 ml-auto" />
          </Link>
        )}
      </div>
    </aside>
  );
};
