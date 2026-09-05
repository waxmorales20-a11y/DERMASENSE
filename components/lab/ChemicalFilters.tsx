'use client';

import React from 'react';
import { useLabStore } from '@/lib/store/useLabStore';
import {
  MOCK_INGREDIENTS,
  MOCK_VEHICLES,
  ANATOMICAL_SITES,
} from '@/lib/mock-catalog';
import {
  FlaskConical,
  Droplet,
  Sparkles,
  ChevronDown,
  RotateCcw,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

export const ChemicalFilters: React.FC = () => {
  const {
    selectedIngredientId,
    selectedVehicleId,
    selectedSiteId,
    concentrationPct,
    pH,
    status,
    setIngredientId,
    setVehicleId,
    setSiteId,
    setConcentrationPct,
    setPH,
    runSimulation,
    resetToDefaults,
    getIngredient,
    getVehicle,
  } = useLabStore();

  const currentIngredient = getIngredient();
  const currentVehicle = getVehicle();
  const isConfiguring = status === 'configuring';
  const isRunning = status === 'running';

  return (
    <div className="flex flex-col gap-3 border-b border-border/80 bg-surface-2/30 p-3.5">
      {/* Encabezado compacto de los filtros */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FlaskConical className="h-4 w-4 text-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text">
            Filtros de Formulación
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            href="/formulation"
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-text-muted hover:text-accent transition-colors cursor-pointer"
            title="Abrir biblioteca completa de activos y parámetros"
          >
            <span>Catálogo</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
          <button
            onClick={resetToDefaults}
            className="rounded p-1 text-text-muted hover:text-text transition-colors cursor-pointer"
            title="Restaurar parámetros iniciales de demo"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Selector de Activo Químico */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-muted">Activo Químico:</span>
          <span className="font-mono text-[10px] text-text-muted">
            MW: <strong className="text-text">{currentIngredient.molecularWeight.toFixed(0)}</strong> · logP: <strong className="text-text">{currentIngredient.logP.toFixed(1)}</strong>
          </span>
        </div>
        <div className="relative">
          <select
            value={selectedIngredientId}
            onChange={(e) => setIngredientId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-border bg-surface py-1.5 pl-2.5 pr-8 text-xs font-semibold text-text transition-colors hover:border-accent focus:border-accent focus:outline-none cursor-pointer"
          >
            {MOCK_INGREDIENTS.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name} ({ing.category})
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>
      </div>

      {/* Grid de Concentración y pH */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Slider de Concentración */}
        <div className="flex flex-col gap-1 rounded-lg border border-border/80 bg-surface/60 p-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-muted">Conc. (%)</span>
            <span className="font-mono text-xs font-bold tabular-nums text-accent">
              {concentrationPct.toFixed(2)}%
            </span>
          </div>
          <input
            type="range"
            min="0.05"
            max="15.0"
            step="0.05"
            value={concentrationPct}
            onChange={(e) => setConcentrationPct(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-2 accent-accent"
          />
        </div>

        {/* Slider de pH */}
        <div className="flex flex-col gap-1 rounded-lg border border-border/80 bg-surface/60 p-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-muted">pH Fórmula</span>
            <span className={`font-mono text-xs font-bold tabular-nums ${pH < 4.0 ? 'text-risk' : 'text-text'}`}>
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
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-2 accent-accent"
          />
        </div>
      </div>

      {/* Selector de Vehículo Portador y Botón de Simulación */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <select
            value={selectedVehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-border bg-surface py-1.5 pl-2.5 pr-7 text-xs text-text transition-colors hover:border-accent focus:border-accent focus:outline-none cursor-pointer"
          >
            {MOCK_VEHICLES.map((veh) => (
              <option key={veh.id} value={veh.id}>
                {veh.name} ({veh.enhancerFactor.toFixed(1)}x)
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        </div>

        <button
          onClick={runSimulation}
          disabled={isRunning}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-all cursor-pointer shrink-0 ${
            isConfiguring
              ? 'bg-accent text-bg shadow-sm shadow-accent/20 animate-pulse'
              : 'bg-accent-soft text-accent hover:bg-accent hover:text-bg'
          } disabled:opacity-50`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{isRunning ? 'Calculando...' : 'Simular'}</span>
        </button>
      </div>
    </div>
  );
};