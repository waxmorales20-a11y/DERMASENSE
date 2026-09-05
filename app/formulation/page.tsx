'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLabStore } from '@/lib/store/useLabStore';
import {
  MOCK_INGREDIENTS,
  MOCK_VEHICLES,
  ANATOMICAL_SITES,
  type CatalogIngredient,
} from '@/lib/mock-catalog';
import {
  ArrowLeft,
  Sparkles,
  FlaskConical,
  Droplet,
  Layers,
  Check,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { toast } from 'sonner';

export default function FormulationPage() {
  const router = useRouter();

  const {
    selectedIngredientId,
    selectedVehicleId,
    selectedSiteId,
    concentrationPct,
    pH,
    durationHours,
    setIngredientId,
    setVehicleId,
    setSiteId,
    setConcentrationPct,
    setPH,
    setDurationHours,
    runSimulation,
    getIngredient,
    getVehicle,
    getSite,
  } = useLabStore();

  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const currentIngredient = getIngredient();
  const currentVehicle = getVehicle();
  const currentSite = getSite();

  const categories = ['all', ...Array.from(new Set(MOCK_INGREDIENTS.map((i) => i.category)))];

  const filteredIngredients = MOCK_INGREDIENTS.filter((ing) => {
    const matchesCategory = categoryFilter === 'all' || ing.category === categoryFilter;
    const matchesSearch =
      ing.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      ing.inciName.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleApplyAndSimulate = () => {
    runSimulation();
    toast.success('Formulación cargada en el laboratorio', {
      description: `${currentIngredient.name} ${concentrationPct}% en ${currentVehicle.name}.`,
    });
    router.push('/lab');
  };

  return (
    <div className="min-h-screen w-full bg-bg text-text selection:bg-accent/20">
      {/* 1. Header Minimalista Editorial */}
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-md lg:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/lab"
            className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-text cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver al Laboratorio</span>
          </Link>

          <div className="h-4 w-px bg-border/80" />

          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-accent" />
            <h1 className="text-sm font-semibold tracking-tight text-text">
              Selección de Químicos y Formulación
            </h1>
          </div>
        </div>

        {/* Botón de Aplicar superior */}
        <button
          onClick={handleApplyAndSimulate}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-bg transition-all hover:bg-accent-soft hover:shadow-sm cursor-pointer shadow-xs shadow-accent/20"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Aplicar al Simulador 3D</span>
        </button>
      </header>

      {/* 2. Contenido Principal en Layout Espacioso y Minimalista */}
      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        {/* Banner introductorio sobrio */}
        <div className="mb-8 flex flex-col gap-1 border-b border-border/80 pb-6">
          <h2 className="text-2xl font-medium tracking-tight text-text">
            Biblioteca de Principios Activos & Parámetros
          </h2>
          <p className="text-xs text-text-muted max-w-2xl leading-relaxed">
            Selecciona el ingrediente activo de interés y calibra la formulación cosmética.
            Los parámetros se integran en el motor determinista de difusión Fickiana de DERMASENSE.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Columna Izquierda: Catálogo de Ingredientes (7 cols) */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Activos ({filteredIngredients.length})
                </span>
              </div>

              {/* Filtros de categoría */}
              <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-0.5 text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                      categoryFilter === cat
                        ? 'bg-surface-2 text-accent font-semibold'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {cat === 'all' ? 'Todos' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de 12 Activos */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {filteredIngredients.map((ing) => {
                const isSelected = ing.id === selectedIngredientId;

                return (
                  <button
                    key={ing.id}
                    onClick={() => setIngredientId(ing.id)}
                    className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-accent bg-surface-2/90 shadow-xs shadow-accent/10'
                        : 'border-border/80 bg-surface/70 hover:border-border hover:bg-surface-2/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-text group-hover:text-accent transition-colors">
                            {ing.name}
                          </span>
                          <span className="font-mono text-[10px] text-text-muted">
                            {ing.inciName}
                          </span>
                        </div>

                        {isSelected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-bg shrink-0">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-[11px] text-text-muted font-mono">
                        <span>MW: <strong className="text-text tabular-nums">{ing.molecularWeight.toFixed(0)}</strong></span>
                        <span>•</span>
                        <span>logP: <strong className="text-text tabular-nums">{ing.logP.toFixed(2)}</strong></span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[10px]">
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-text-muted">
                        {ing.category}
                      </span>
                      <span className="text-text-muted">
                        Máx rec: <strong className="text-text font-mono">{ing.maxUseConcentration ? `${ing.maxUseConcentration}%` : 'Libre'}</strong>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Columna Derecha: Controles de Formulación y Vehículo (5 cols) */}
          <div className="flex flex-col gap-6 lg:col-span-5">
            {/* Tarjeta de Formulación Activa */}
            <div className="flex flex-col gap-5 rounded-2xl border border-border/80 bg-surface p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-accent" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text">
                    Parámetros de Formulación
                  </h3>
                </div>
                <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-mono text-accent">
                  {currentIngredient.name}
                </span>
              </div>

              {/* Concentración (%) Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text">
                    Concentración del Activo
                  </label>
                  <span className="font-mono text-sm font-bold tabular-nums text-accent">
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
                <div className="flex items-center justify-between text-[10px] text-text-muted font-mono">
                  <span>0.05% (Traza)</span>
                  <span>5.0% (Terapéutico)</span>
                  <span>15.0% (Peeling)</span>
                </div>
              </div>

              {/* pH Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text">
                    pH de la Solución
                  </label>
                  <span className="font-mono text-sm font-bold tabular-nums text-text">
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
                <div className="flex items-center justify-between text-[10px] text-text-muted">
                  <span className={pH < 4.0 ? 'text-risk font-semibold' : ''}>3.0 (Ácido / Exfoliante)</span>
                  <span>5.5 (Fisiológico)</span>
                  <span>9.0 (Alcalino)</span>
                </div>
              </div>

              {/* Selector de Vehículo Portador */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-text flex items-center gap-1.5">
                  <Droplet className="h-3.5 w-3.5 text-accent" />
                  <span>Vehículo Portador</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {MOCK_VEHICLES.map((veh) => {
                    const isSelected = veh.id === selectedVehicleId;
                    return (
                      <button
                        key={veh.id}
                        onClick={() => setVehicleId(veh.id)}
                        className={`flex items-center justify-between rounded-lg border p-2.5 text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-accent bg-surface-2 text-text font-semibold'
                            : 'border-border bg-surface-2/40 text-text-muted hover:text-text'
                        }`}
                      >
                        <div className="flex flex-col text-left">
                          <span className="text-[11px] font-medium">{veh.name}</span>
                          <span className="text-[10px] text-text-muted">{veh.description}</span>
                        </div>
                        <span className="font-mono text-[10px] text-accent font-bold tabular-nums">
                          {veh.enhancerFactor.toFixed(2)}x flujo
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de Sitio Anatómico */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-text flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-text-muted" />
                  <span>Sitio Anatómico de la Piel</span>
                </label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 p-2 text-xs font-medium text-text transition-colors hover:border-accent focus:border-accent focus:outline-none cursor-pointer"
                >
                  {ANATOMICAL_SITES.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.label} {site.isDefault ? '★ (Recomendado Abdomen)' : ''}
                    </option>
                  ))}
                </select>
                {currentSite.caveat && (
                  <p className="flex items-center gap-1 text-[11px] text-warn bg-warn/10 p-2 rounded-md border border-warn/20">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    <span>{currentSite.caveat}</span>
                  </p>
                )}
              </div>

              {/* Duración de la simulación */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-text">
                  Duración del Ensayo Virtual
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[6, 12, 24, 48].map((hours) => (
                    <button
                      key={hours}
                      onClick={() => setDurationHours(hours)}
                      className={`rounded-lg border py-1.5 text-center font-mono text-xs font-bold transition-colors cursor-pointer ${
                        durationHours === hours
                          ? 'border-accent bg-accent text-bg font-bold'
                          : 'border-border bg-surface-2 text-text-muted hover:text-text'
                      }`}
                    >
                      {hours} h
                    </button>
                  ))}
                </div>
              </div>

              {/* Botón Principal Inferior de Aplicación */}
              <button
                onClick={handleApplyAndSimulate}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent p-3 text-xs font-bold text-bg transition-all hover:bg-accent-soft hover:shadow-md cursor-pointer shadow-sm shadow-accent/20"
              >
                <Sparkles className="h-4 w-4" />
                <span>Aplicar Formulación e Ir a Simulación 3D</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}