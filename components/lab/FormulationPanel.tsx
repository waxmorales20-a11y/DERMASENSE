'use client';

import React from 'react';
import {
  MOCK_INGREDIENTS,
  MOCK_VEHICLES,
  ANATOMICAL_SITES,
  type CatalogIngredient,
} from '@/lib/mock-catalog';
import { useLabStore } from '@/lib/store/useLabStore';
import {
  FlaskConical,
  Layers,
  RotateCcw,
  Sparkles,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';

export const FormulationPanel: React.FC = () => {
  const {
    selectedIngredientId,
    selectedVehicleId,
    selectedSiteId,
    concentrationPct,
    pH,
    durationHours,
    appliedDoseMgCm2,
    status,
    errorMessage,
    getIngredient,
    getVehicle,
    getSite,
    setIngredientId,
    setVehicleId,
    setSiteId,
    setConcentrationPct,
    setPH,
    setDurationHours,
    setAppliedDoseMgCm2,
    runSimulation,
    resetToDefaults,
  } = useLabStore();

  const currentIngredient = getIngredient();
  const currentVehicle = getVehicle();
  const currentSite = getSite();

  const isConfiguring = status === 'configuring';
  const isRunning = status === 'running';

  const handleConcentrationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setConcentrationPct(Math.min(30, Math.max(0.01, val)));
    }
  };

  return (
    <aside className="flex h-full w-full flex-col justify-between overflow-y-auto border-r border-border bg-surface p-4 lg:w-[320px] lg:shrink-0">
      <div className="flex flex-col gap-5">
        {/* Encabezado del panel */}
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-accent-soft text-accent">
              <FlaskConical className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-xs font-semibold tracking-wider text-text uppercase">
              Formulación
            </h2>
          </div>
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
            title="Restaurar parámetros de demo (Retinol 0.3% en Emulsión O/W)"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset demo</span>
          </button>
        </div>

        {/* 1. Ingrediente Activo */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ingredient-select"
            className="text-[11px] font-medium tracking-wider text-text-muted uppercase"
          >
            Ingrediente Activo
          </label>
          <select
            id="ingredient-select"
            value={selectedIngredientId}
            onChange={(e) => setIngredientId(e.target.value)}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text transition-colors focus:border-accent focus:outline-none"
          >
            {MOCK_INGREDIENTS.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name} ({ing.category})
              </option>
            ))}
          </select>

          {/* Ficha técnica compacta del activo */}
          <div className="rounded-md border border-border/80 bg-surface-2/60 p-2.5 text-[11px]">
            <div className="flex items-center justify-between font-mono text-[11px] text-text-muted">
              <span>MW: <strong className="tabular-nums text-text">{currentIngredient.molecularWeight.toFixed(1)} g/mol</strong></span>
              <span>logP: <strong className="tabular-nums text-text">{currentIngredient.logP.toFixed(2)}</strong></span>
              {currentIngredient.pka && (
                <span>pKa: <strong className="tabular-nums text-text">{currentIngredient.pka.toFixed(1)}</strong></span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-text-muted border border-border/60">
                {currentIngredient.inciName}
              </span>
              {currentIngredient.riskFlags.map((rf) => (
                <span
                  key={rf}
                  className="rounded bg-warn/15 border border-warn/30 px-1.5 py-0.5 text-[10px] font-medium text-warn"
                >
                  {rf}
                </span>
              ))}
              <span className="ml-auto text-[10px] text-text-muted">
                {currentIngredient.source}
              </span>
            </div>

            {currentIngredient.maxUseConcentration && (
              <p className="mt-2 text-[10px] text-text-muted border-t border-border/40 pt-1.5">
                Uso habitual máx: <span className="tabular-nums font-semibold text-text">{currentIngredient.maxUseConcentration}%</span>
                {currentIngredient.regulationRef && ` (${currentIngredient.regulationRef})`}
              </p>
            )}
          </div>
        </div>

        {/* 2. Concentración */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="concentration-slider"
              className="text-[11px] font-medium tracking-wider text-text-muted uppercase"
            >
              Concentración (% p/p)
            </label>
            <div className="flex items-center gap-1">
              <input
                id="concentration-input"
                type="number"
                min="0.01"
                max="30"
                step="0.05"
                value={concentrationPct}
                onChange={handleConcentrationChange}
                className="w-16 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-right font-mono text-xs tabular-nums text-text focus:border-accent focus:outline-none"
              />
              <span className="font-mono text-xs text-text-muted">%</span>
            </div>
          </div>
          <input
            id="concentration-slider"
            type="range"
            min="0.05"
            max="15"
            step="0.05"
            value={concentrationPct}
            onChange={(e) => setConcentrationPct(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-2 accent-accent"
          />
          <div className="flex justify-between text-[10px] font-mono text-text-muted">
            <span>0.05 %</span>
            <span>7.5 %</span>
            <span>15 %</span>
          </div>
        </div>

        {/* 3. Vehículo */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="vehicle-select"
            className="text-[11px] font-medium tracking-wider text-text-muted uppercase"
          >
            Vehículo de formulación
          </label>
          <select
            id="vehicle-select"
            value={selectedVehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text transition-colors focus:border-accent focus:outline-none"
          >
            {MOCK_VEHICLES.map((veh) => (
              <option key={veh.id} value={veh.id}>
                {veh.name} ({veh.enhancerFactor.toFixed(2)}x penetración)
              </option>
            ))}
          </select>
          <p className="text-[10px] leading-relaxed text-text-muted">
            {currentVehicle.description}
          </p>
        </div>

        {/* 4. pH de la formulación */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="ph-slider"
              className="text-[11px] font-medium tracking-wider text-text-muted uppercase"
            >
              pH de la formulación
            </label>
            <span className="font-mono text-xs tabular-nums font-semibold text-text">
              {pH.toFixed(1)}
            </span>
          </div>
          <input
            id="ph-slider"
            type="range"
            min="3.0"
            max="9.0"
            step="0.1"
            value={pH}
            onChange={(e) => setPH(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-2 accent-accent"
          />
          <div className="flex items-center justify-between text-[10px] text-text-muted">
            <span>3.0 (Ácido)</span>
            <span className="rounded bg-ok/10 border border-ok/20 px-1 py-0.2 text-[9px] text-ok">
              4.5 - 5.5 (Fisiológico)
            </span>
            <span>9.0 (Básico)</span>
          </div>
        </div>

        {/* 5. Duración y Dosis */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="duration-slider"
                className="text-[10px] font-medium tracking-wider text-text-muted uppercase"
              >
                Duración
              </label>
              <span className="font-mono text-[11px] tabular-nums text-text">
                {durationHours} h
              </span>
            </div>
            <input
              id="duration-slider"
              type="range"
              min="1"
              max="48"
              step="1"
              value={durationHours}
              onChange={(e) => setDurationHours(parseInt(e.target.value, 10))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-2 accent-accent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="dose-input"
                className="text-[10px] font-medium tracking-wider text-text-muted uppercase"
              >
                Dosis
              </label>
              <span className="font-mono text-[11px] tabular-nums text-text">
                {appliedDoseMgCm2.toFixed(1)} mg/cm²
              </span>
            </div>
            <input
              id="dose-input"
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={appliedDoseMgCm2}
              onChange={(e) => setAppliedDoseMgCm2(parseFloat(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-2 accent-accent"
            />
          </div>
        </div>

        {/* 6. Sitio anatómico */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="site-select"
            className="flex items-center justify-between text-[11px] font-medium tracking-wider text-text-muted uppercase"
          >
            <span>Sitio Anatómico (Piel)</span>
            <span className="text-[10px] text-text-muted lowercase">SC: {currentSite.layers[0].thicknessUm} µm</span>
          </label>
          <select
            id="site-select"
            value={selectedSiteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text transition-colors focus:border-accent focus:outline-none"
          >
            {ANATOMICAL_SITES.map((site) => (
              <option key={site.id} value={site.id}>
                {site.label} {site.isDefault ? '(Default I+D)' : ''}
              </option>
            ))}
          </select>

          {currentSite.caveat && (
            <div className="flex items-start gap-1.5 rounded border border-warn/30 bg-warn/10 p-2 text-[10px] leading-tight text-warn">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{currentSite.caveat}</span>
            </div>
          )}
        </div>
      </div>

      {/* Acciones y errores al pie del panel */}
      <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
        {errorMessage && (
          <div className="flex items-start gap-1.5 rounded border border-risk/40 bg-risk/10 p-2 text-xs text-risk">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          onClick={runSimulation}
          disabled={isRunning}
          className={`flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs font-semibold tracking-wide uppercase transition-all ${
            isConfiguring
              ? 'bg-accent text-bg shadow-[0_0_15px_rgba(34,211,238,0.35)] hover:bg-accent/90'
              : 'bg-accent-soft text-text hover:bg-accent hover:text-bg'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{isRunning ? 'Calculando difusión...' : isConfiguring ? 'Recalcular simulación' : 'Simular penetración'}</span>
        </button>

        <p className="text-center text-[10px] text-text-muted">
          Cálculo Fick + Potts-Guy determinista en cliente (&lt;2 s)
        </p>
      </div>
    </aside>
  );
};
