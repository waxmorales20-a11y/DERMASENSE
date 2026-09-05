'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SkinDigitalTwin } from '@/components/lab/SkinDigitalTwin';
import { ViewerErrorBoundary } from '@/components/lab/ViewerErrorBoundary';
import { TimelineControls } from '@/components/lab/TimelineControls';
import { ChemicalFilters } from '@/components/lab/ChemicalFilters';
import { LiveStatusBar } from '@/components/lab/LiveStatusBar';
import { ScientificChat } from '@/components/lab/ScientificChat';
import { ModelAssumptionsModal } from '@/components/lab/ModelAssumptionsModal';
import { ReportModal } from '@/components/lab/ReportModal';
import { useLabStore } from '@/lib/store/useLabStore';
import { BrainCircuit, ChevronDown, Info, History, SlidersHorizontal } from 'lucide-react';

export default function LabPage() {
  const { result } = useLabStore();
  const [isAssumptionsOpen, setIsAssumptionsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  // Los filtros se pliegan para dejarle toda la columna al chat.
  const [areFiltersOpen, setAreFiltersOpen] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-text selection:bg-accent/20">
      {/* 1. LADO IZQUIERDO: SIMULADOR 3D A ALTURA COMPLETA */}
      <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-bg">
        {/* Visor 3D Babylon.js del abdomen y del corte celular */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ViewerErrorBoundary>
            <SkinDigitalTwin />
          </ViewerErrorBoundary>
        </div>

        {/* Barra de control de tiempo en la base del simulador */}
        <div className="shrink-0 border-t border-border/70 bg-surface-2/30">
          <TimelineControls />
        </div>
      </main>

      {/* 2. LADO DERECHO: FILTROS PLEGABLES + CHAT CIENTÍFICO CON VOZ */}
      <aside className="flex h-full w-[400px] shrink-0 flex-col overflow-hidden border-l border-border bg-surface shadow-2xl md:w-[460px] lg:w-[520px]">
        {/* Cabecera compacta del panel lateral */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-surface-2/40 px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-accent-soft text-xs font-bold text-accent">
              DS
            </span>
            <span className="text-xs font-semibold tracking-wide text-text">DERMASENSE LAB</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/simulations"
              className="flex items-center gap-1 rounded px-2 py-1 text-text-muted transition-colors hover:text-text"
              title="Historial de simulaciones"
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Historial</span>
            </Link>

            <button
              onClick={() => setIsAssumptionsOpen(true)}
              className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:text-text"
              title="Supuestos y limitaciones físicas"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Filtros de formulación, plegables */}
        <div className="shrink-0 border-b border-border">
          <button
            onClick={() => setAreFiltersOpen((prev) => !prev)}
            className="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-left transition-colors hover:bg-surface-2/40"
            aria-expanded={areFiltersOpen}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Formulación
            </span>
            <ChevronDown
              className={`h-4 w-4 text-text-muted transition-transform ${
                areFiltersOpen ? '' : '-rotate-90'
              }`}
            />
          </button>

          {areFiltersOpen && <ChemicalFilters />}
        </div>

        {/* Estado en vivo de la piel */}
        <div className="shrink-0">
          <LiveStatusBar />
        </div>

        {/* Chat científico con voz: ocupa todo el espacio restante */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
          <ScientificChat />
        </div>

        {/* Barra de acciones rápidas inferior */}
        <div className="flex shrink-0 items-center justify-between border-t border-border bg-surface-2/30 px-3.5 py-2 text-xs">
          <span className="font-mono text-[10px] text-text-muted">
            {result ? `Motor Fick v${result.engineVersion}` : 'In Silico'}
          </span>

          <button
            onClick={() => setIsReportOpen(true)}
            className="flex cursor-pointer items-center gap-1.5 rounded-md bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent hover:text-bg"
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>Reporte IA</span>
          </button>
        </div>
      </aside>

      {/* Modales de supuestos y reporte IA */}
      <ModelAssumptionsModal
        isOpen={isAssumptionsOpen}
        onClose={() => setIsAssumptionsOpen(false)}
      />

      <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </div>
  );
}
