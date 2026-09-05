'use client';

import React, { useState } from 'react';
import { useLabStore } from '@/lib/store/useLabStore';
import { ScientificNarrator } from './ScientificNarrator';
import { ConfidenceBanner } from './ConfidenceBanner';
import { IrritationGauge } from './IrritationGauge';
import { MetricCard } from './MetricCard';
import {
  Save,
  BrainCircuit,
  Check,
  ArrowRight,
  Loader2,
  Activity,
  SlidersHorizontal,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { saveLocalSimulation } from '@/lib/storage/local-simulations';

interface TelemetryPanelProps {
  onOpenReport?: () => void;
  onOpenFormulationDrawer?: () => void;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  onOpenReport,
  onOpenFormulationDrawer,
}) => {
  const { result, status } = useLabStore();
  const [activeTab, setActiveTab] = useState<'narrator' | 'metrics'>('narrator');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!result) {
    return (
      <aside className="flex h-full w-full items-center justify-center border-l border-border bg-surface p-6">
        <div className="flex flex-col items-center gap-2 text-center text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <p className="text-xs font-mono">Calculando campos de penetración...</p>
        </div>
      </aside>
    );
  }

  const { metrics, input } = result;

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // 1. Guardado local inmediato garantizado
      saveLocalSimulation({
        input,
        metrics,
        engineVersion: result.engineVersion,
      });

      // 2. Intento de persistencia contra Supabase API
      try {
        const res = await fetch('/api/simulations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input, metrics }),
        });

        if (res.ok) {
          toast.success('Simulación guardada', {
            description: `${input.ingredient.name} ${input.concentrationPct}% guardado con éxito.`,
          });
        } else {
          toast.info('Guardado localmente', {
            description: 'Preservado en este dispositivo (Modo local / sin sesión activa).',
          });
        }
      } catch {
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
    <aside className="flex h-full w-full flex-col justify-between overflow-hidden border-l border-border bg-surface">
      {/* 1. Selector superior de Vista: Chat Narrador vs Telemetría Detallada */}
      <div className="flex items-center justify-between border-b border-border/80 bg-surface-2/40 px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
          <button
            onClick={() => setActiveTab('narrator')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'narrator'
                ? 'bg-accent text-bg font-bold shadow-xs'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Chat & Voz</span>
          </button>
          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'metrics'
                ? 'bg-accent text-bg font-bold shadow-xs'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Telemetría</span>
          </button>
        </div>

        {onOpenFormulationDrawer && (
          <button
            onClick={onOpenFormulationDrawer}
            className="flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-accent transition-colors"
            title="Ajustar parámetros avanzados de formulación"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Avanzado</span>
          </button>
        )}
      </div>

      {/* 2. Contenido Central Alternable */}
      <div className="flex flex-1 flex-col overflow-y-auto p-3.5 gap-3">
        {activeTab === 'narrator' ? (
          <div className="flex flex-1 flex-col gap-3 min-h-[420px]">
            {/* Componente del Narrador Científico con Voz */}
            <div className="flex-1 min-h-[320px]">
              <ScientificNarrator />
            </div>

            {/* Gauge de Irritación compacto debajo del Narrador */}
            <div className="rounded-xl border border-border/80 bg-surface/60 p-3">
              <IrritationGauge
                score={metrics.irritationIndex}
                band={metrics.irritationBand}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Banner de confianza si está fuera de dominio */}
            <ConfidenceBanner
              confidence={metrics.confidence}
              reasons={metrics.outOfDomainReasons}
            />

            {/* Gauge de Irritación heurístico */}
            <IrritationGauge
              score={metrics.irritationIndex}
              band={metrics.irritationBand}
            />

            {/* Grid completo de Métricas Físicas Fickianas */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                label="log Kp"
                value={metrics.logKp.toFixed(2)}
                definition="Coeficiente Potts-Guy (cm/h)"
                numericVal={metrics.logKp}
                rangeMin={-6}
                rangeMax={0}
              />
              <MetricCard
                label="Permeabilidad Kp"
                value={(metrics.permeabilityCmH * 1000).toFixed(3)}
                unit="×10⁻³ cm/h"
                definition="Permeabilidad SC"
                numericVal={metrics.permeabilityCmH * 1000}
                rangeMin={0}
                rangeMax={10}
              />
              <MetricCard
                label="Flujo Máx. Teórico"
                value={metrics.maxFluxInfiniteDose.toFixed(1)}
                unit="µg/cm²/h"
                definition="Cota superior a dosis infinita"
                numericVal={metrics.maxFluxInfiniteDose}
                rangeMin={0}
                rangeMax={500}
              />
              <MetricCard
                label="Lag Time"
                value={metrics.lagTimeHours >= 9999 ? '>9999' : metrics.lagTimeHours.toFixed(2)}
                unit="h"
                definition="Retardo estacionario"
                numericVal={metrics.lagTimeHours >= 9999 ? 48 : metrics.lagTimeHours}
                rangeMin={0}
                rangeMax={24}
              />
              <MetricCard
                label="Tiempo al 50%"
                value={metrics.timeTo50PctHours >= 9999 ? '>9999' : metrics.timeTo50PctHours.toFixed(1)}
                unit="h"
                definition="t₅₀ cruce estrato córneo"
                numericVal={metrics.timeTo50PctHours >= 9999 ? 48 : metrics.timeTo50PctHours}
                rangeMin={0}
                rangeMax={48}
              />
              <MetricCard
                label="Fracción Cruzada"
                value={metrics.absorbedFractionPct.toFixed(1)}
                unit="%"
                definition="Masa que cruza el SC"
                numericVal={metrics.absorbedFractionPct}
                rangeMin={0}
                rangeMax={100}
              />
              <MetricCard
                label="Profundidad"
                value={metrics.penetrationDepthUm.toFixed(0)}
                unit="µm"
                definition="Cota al 5% de actividad"
                numericVal={metrics.penetrationDepthUm}
                rangeMin={0}
                rangeMax={2500}
              />
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
        )}
      </div>

      {/* 3. Botones de Acción Fijos Inferiores */}
      <div className="flex flex-col gap-2 border-t border-border bg-surface-2/30 p-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span>Guardando simulación...</span>
            </>
          ) : savedSuccess ? (
            <>
              <Check className="h-4 w-4 text-ok" />
              <span className="text-ok font-semibold">Simulación Guardada</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Guardar Simulación</span>
            </>
          )}
        </button>

        {onOpenReport && (
          <button
            onClick={onOpenReport}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg transition-colors hover:bg-accent-soft cursor-pointer shadow-xs shadow-accent/20"
          >
            <BrainCircuit className="h-4 w-4" />
            <span>Generar Reporte Técnico IA</span>
            <ArrowRight className="h-3.5 w-3.5 ml-auto" />
          </button>
        )}
      </div>
    </aside>
  );
};