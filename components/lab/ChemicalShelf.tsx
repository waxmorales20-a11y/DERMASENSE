'use client';

import React from 'react';
import { useLabStore } from '@/lib/store/useLabStore';
import {
  MOCK_INGREDIENTS,
  MOCK_VEHICLES,
  ANATOMICAL_SITES,
  type CatalogIngredient,
} from '@/lib/mock-catalog';
import {
  FlaskConical,
  Droplet,
  Sparkles,
  Sliders,
  RotateCcw,
  ShieldAlert,
  ChevronDown,
  Layers,
} from 'lucide-react';

export const ChemicalShelf: React.FC = () => {
  const {
    selectedIngredientId,
    selectedVehicleId,
    selectedSiteId,
    concentrationPct,
    pH,
    durationHours,
    status,
    setIngredientId,
    setVehicleId,
    setSiteId,
    setConcentrationPct,
    setPH,
    setDurationHours,
    runSimulation,
    resetToDefaults,
    getIngredient,
    getVehicle,
    getSite,
  } = useLabStore();

  const currentIngredient = getIngredient();
  const currentVehicle = getVehicle();
  const currentSite = getSite();
  const isConfiguring = status === 'configuring';
  const isRunning = status === 'running';

  return (
    <div className="flex w-full flex-col border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur-md lg:px-6">
      {/* Fila principal del Shelf: Selección horizontal rápida */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Selector de Activos Químicos */}
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent-soft text-accent">
            <FlaskConical className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Activo Químico
            </span>
            <div className="relative">
              <select
                value={selectedIngredientId}
                onChange={(e) => setIngredientId(e.target.value)}
                className="appearance-none rounded border border-border bg-surface-2 py-1 pl-2.5 pr-7 text-xs font-semibold text-text transition-colors hover:border-accent focus:border-accent focus:outline-none cursor-pointer"
              >
                {MOCK_INGREDIENTS.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.category} · MW {ing.molecularWeight.toFixed(0)})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            </div>
          </div>
        </div>

        {/* Concentración rápida */}
        <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-surface-2/60 px-3 py-1">
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Concentración
              </span>
              <span className="font-mono text-xs font-bold tabular-nums text-accent">
                {concentrationPct.toFixed(2)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="15"
              step="0.05"
              value={concentrationPct}
              onChange={(e) => setConcentrationPct(parseFloat(e.target.value))}
              className="h-1.5 w-28 cursor-pointer appearance-none rounded-lg bg-border accent-accent"
            />
          </div>

          <div className="h-6 w-px bg-border/60" />

          {/* pH */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                pH
              </span>
              <span className="font-mono text-xs font-bold tabular-nums text-text">
                {pH.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="3.0"
              max="9.0"
              step="0.1"
              value={pH}
              onChange={(e) => setPH(parseFloat(e.target.value))}
              className="h-1.5 w-20 cursor-pointer appearance-none rounded-lg bg-border accent-accent"
            />
          </div>
        </div>

        {/* Selector de Vehículo */}
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-surface-2 text-text-muted">
            <Droplet className="h-4 w-4 text-accent" />
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Vehículo Portador
            </span>
            <div className="relative">
              <select
                value={selectedVehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="appearance-none rounded border border-border bg-surface-2 py-1 pl-2.5 pr-7 text-xs font-semibold text-text transition-colors hover:border-accent focus:border-accent focus:outline-none cursor-pointer"
              >
                {MOCK_VEHICLES.map((veh) => (
                  <option key={veh.id} value={veh.id}>
                    {veh.name} ({veh.enhancerFactor.toFixed(2)}x)
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            </div>
          </div>
        </div>

        {/* Sitio Anatómico de la piel */}
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-surface-2 text-text-muted">
            <Layers className="h-4 w-4 text-text-muted" />
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Sitio Cutáneo
            </span>
            <div className="relative">
              <select
                value={selectedSiteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="appearance-none rounded border border-border bg-surface-2 py-1 pl-2.5 pr-7 text-xs font-semibold text-text transition-colors hover:border-accent focus:border-accent focus:outline-none cursor-pointer"
              >
                {ANATOMICAL_SITES.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.label} {site.isDefault ? '★' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            </div>
          </div>
        </div>

        {/* Botón de Re-simular con iluminación */}
        <div className="flex items-center gap-2">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-1 rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text"
            title="Restaurar parámetros de demo del pitch (Retinol 0.3% en Abdomen)"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={runSimulation}
            disabled={isRunning}
            className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-semibold tracking-wide uppercase transition-all ${
              isConfiguring
                ? 'bg-accent text-bg shadow-[0_0_20px_rgba(34,211,238,0.5)] animate-pulse'
                : 'bg-accent-soft text-text hover:bg-accent hover:text-bg'
            } disabled:opacity-50`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isRunning ? 'Calculando...' : isConfiguring ? 'Actualizar Cálculo' : 'Simular'}</span>
          </button>
        </div>
      </div>

      {/* Tira informativa de propiedades moleculares en tiempo real */}
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
        <span className="font-mono">
          Fórmula: <strong className="text-text">{currentIngredient.name}</strong> ({currentIngredient.inciName})
        </span>
        <span>•</span>
        <span className="font-mono">
          logP: <strong className="tabular-nums text-text">{currentIngredient.logP.toFixed(2)}</strong>
        </span>
        <span>•</span>
        <span className="font-mono">
          MW: <strong className="tabular-nums text-text">{currentIngredient.molecularWeight.toFixed(1)} g/mol</strong>
        </span>
        <span>•</span>
        <span className="font-mono">
          Vehículo: <strong className="text-text">{currentVehicle.name}</strong> (factor {currentVehicle.enhancerFactor}x)
        </span>
        {currentSite.caveat && (
          <span className="flex items-center gap-1 text-[10px] text-warn bg-warn/10 px-2 py-0.5 rounded border border-warn/20 ml-auto">
            <ShieldAlert className="h-3 w-3" />
            <span>{currentSite.caveat}</span>
          </span>
        )}
      </div>
    </div>
  );
};
