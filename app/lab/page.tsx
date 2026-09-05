'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SkinDigitalTwin } from '@/components/lab/SkinDigitalTwin';
import { TimelineControls } from '@/components/lab/TimelineControls';
import { ChemicalFilters } from '@/components/lab/ChemicalFilters';
import { ScientificNarrator } from '@/components/lab/ScientificNarrator';
import { ModelAssumptionsModal } from '@/components/lab/ModelAssumptionsModal';
import { ReportModal } from '@/components/lab/ReportModal';
import { useLabStore } from '@/lib/store/useLabStore';
import {
  FlaskConical,
  BarChart3,
  BrainCircuit,
  Info,
  History,
} from 'lucide-react';

export default function LabPage() {
  const { result } = useLabStore();
  const [isAssumptionsOpen, setIsAssumptionsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-text selection:bg-accent/20">
      {/* 1. LADO IZQUIERDO: SIMULADOR 3D AMPLIADO HACIA ARRIBA (Sin barras principales) */}
      <main className="relative flex flex-1 h-full flex-col overflow-hidden bg-bg">
        {/* Visor 3D Three.js del Abdomen y Corte Celular */}
        <div className="flex flex-1 overflow-hidden">
          <SkinDigitalTwin />
        </div>

        {/* Barra de Control de Tiempo en la base del simulador */}
        <div className="shrink-0 border-t border-border/70 bg-surface-2/30">
          <TimelineControls />
        </div>
      </main>

      {/* 2. LADO DERECHO: FILTROS DE QUÍMICOS ARRIBA + CHAT CIENTÍFICO CON VOZ ABAJO */}
      <aside className="flex h-full w-[360px] md:w-[400px] lg:w-[430px] shrink-0 flex-col border-l border-border bg-surface overflow-hidden shadow-2xl">
        {/* Cabecera ultra-compacta del panel lateral */}
        <div className="flex h-11 items-center justify-between border-b border-border/80 bg-surface-2/40 px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-accent-soft text-accent text-xs font-bold">
              DS
            </span>
            <span className="text-xs font-semibold tracking-wide text-text">
              DERMASENSE LAB
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/simulations"
              className="flex items-center gap-1 rounded px-2 py-1 text-text-muted hover:text-text transition-colors"
              title="Historial de simulaciones"
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Historial</span>
            </Link>

            <button
              onClick={() => setIsAssumptionsOpen(true)}
              className="rounded p-1 text-text-muted hover:text-text transition-colors cursor-pointer"
              title="Supuestos y limitaciones físicas"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* PARTE SUPERIOR: Filtros de Selección de Químicos */}
        <div className="shrink-0">
          <ChemicalFilters />
        </div>

        {/* PARTE INFERIOR: Chat Científico con Narrador de Voz en Vivo */}
        <div className="flex flex-1 flex-col overflow-hidden p-3 min-h-[300px]">
          <ScientificNarrator />
        </div>

        {/* Barra de acciones rápidas inferior */}
        <div className="flex items-center justify-between border-t border-border/80 bg-surface-2/30 px-3.5 py-2 text-xs">
          <span className="text-[10px] text-text-muted font-mono">
            {result ? `Motor Fick v${result.engineVersion}` : 'In Silico'}
          </span>

          <button
            onClick={() => setIsReportOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-accent/20 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent hover:text-bg transition-colors cursor-pointer"
          >
            <BrainCircuit className="h-3.5 w-3.5" />
            <span>Reporte IA</span>
          </button>
        </div>
      </aside>

      {/* Modales de Supuestos y Reporte IA */}
      <ModelAssumptionsModal
        isOpen={isAssumptionsOpen}
        onClose={() => setIsAssumptionsOpen(false)}
      />

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  );
}