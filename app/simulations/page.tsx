'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FlaskConical,
  Clock,
  ArrowLeft,
  Trash2,
  Play,
  BrainCircuit,
  ShieldCheck,
  AlertTriangle,
  FolderOpen,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import {
  getLocalSimulations,
  deleteLocalSimulation,
  type SavedSimulationItem,
} from '@/lib/storage/local-simulations';
import { useLabStore } from '@/lib/store/useLabStore';
import { toast } from 'sonner';
import { ReportModal } from '@/components/lab/ReportModal';

export default function SimulationsHistoryPage() {
  const router = useRouter();
  const { setIngredientId, setVehicleId, setConcentrationPct, setPH, setDurationHours, setAppliedDoseMgCm2, runSimulation } =
    useLabStore();

  const [simulations, setSimulations] = useState<SavedSimulationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Cargar simulaciones (de API y de localStorage)
  const loadSimulations = async () => {
    setLoading(true);
    const localItems = getLocalSimulations();

    try {
      const res = await fetch('/api/simulations');
      if (res.ok) {
        const data = await res.json();
        const apiItems = (data.simulations || []).map((s: any) => ({
          id: s.id,
          title: s.title,
          createdAt: s.created_at,
          concentrationPct: s.concentration_pct,
          ingredientName: s.input_snapshot?.ingredient?.name || 'Activo',
          vehicleName: s.input_snapshot?.vehicle?.name || 'Vehículo',
          input: s.input_snapshot,
          metrics: s.metrics,
          engineVersion: s.engine_version,
        }));

        // Combinar evitando duplicados
        const combinedMap = new Map<string, SavedSimulationItem>();
        localItems.forEach((i) => combinedMap.set(i.id, i));
        apiItems.forEach((i: SavedSimulationItem) => combinedMap.set(i.id, i));

        const list = Array.from(combinedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setSimulations(list);
      } else {
        setSimulations(localItems);
      }
    } catch {
      setSimulations(localItems);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSimulations();
  }, []);

  // Solo las simulaciones guardadas en Supabase tienen UUID; las de
  // localStorage llevan el prefijo `sim-`. El backend arma el libro leyendo la
  // fila de la base, así que una simulación puramente local no se puede
  // exportar: en vez de fallar al pulsar, el botón no aparece.
  const isPersisted = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const handleExport = async (sim: SavedSimulationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (exportingId) return;
    setExportingId(sim.id);

    try {
      const res = await fetch(`/api/exports/${sim.id}`);

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error('No se pudo generar el Excel', {
          description: body?.error?.message ?? 'Inténtalo de nuevo en unos segundos.',
        });
        return;
      }

      // La descarga se dispara desde un blob para poder respetar el nombre de
      // archivo que envía el backend en Content-Disposition.
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = match?.[1] ?? `dermasense_${sim.id.slice(0, 8)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success('Reporte Excel descargado', {
        description: '7 hojas: formulación, propiedades, evidencia, simulación, ML, IA y regulatorio.',
      });
    } catch {
      toast.error('Error de red al descargar el reporte');
    } finally {
      setExportingId(null);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteLocalSimulation(id);
    setSimulations((prev) => prev.filter((s) => s.id !== id));
    toast.success('Simulación eliminada del historial local');
  };

  // Cargar una simulación guardada de vuelta al Laboratorio
  const handleLoadSimulation = (sim: SavedSimulationItem) => {
    if (sim.input) {
      if (sim.input.ingredient?.id) setIngredientId(sim.input.ingredient.id);
      if (sim.input.vehicle?.id) setVehicleId(sim.input.vehicle.id);
      if (sim.input.concentrationPct) setConcentrationPct(sim.input.concentrationPct);
      if (sim.input.pH) setPH(sim.input.pH);
      if (sim.input.durationHours) setDurationHours(sim.input.durationHours);
      if (sim.input.appliedDoseMgCm2) setAppliedDoseMgCm2(sim.input.appliedDoseMgCm2);

      // Ejecutar para reactivar el estado Ready en el Laboratorio
      setTimeout(() => {
        runSimulation();
        router.push('/lab');
      }, 50);
    } else {
      router.push('/lab');
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-bg text-text">
      {/* Cabecera */}
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur-md lg:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/lab"
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Laboratorio</span>
          </Link>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-sm font-semibold tracking-tight text-text">
            Historial de Simulaciones
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSimulations}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text"
            title="Recargar historial"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <Link
            href="/lab"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-accent/90"
          >
            Nueva Simulación
          </Link>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex flex-1 flex-col p-4 md:p-8 max-w-6xl w-full mx-auto">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-24 text-text-muted">
            <RefreshCw className="h-6 w-6 animate-spin text-accent mb-2" />
            <span className="text-xs ml-2">Cargando registro de simulaciones...</span>
          </div>
        ) : simulations.length === 0 ? (
          /* Estado Vacío Ilustrado (docs/APP_FLOW.md §5) */
          <div className="flex flex-1 flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-2 text-text-muted mb-4 shadow-inner">
              <FolderOpen className="h-8 w-8 text-accent/80" />
            </div>
            <h2 className="text-base font-semibold text-text">Aún no has simulado nada</h2>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              Todas las formulaciones evaluadas y guardadas aparecerán registradas aquí con sus
              métricas de penetración, índice de irritación y reportes de IA reproducibles.
            </p>
            <Link
              href="/lab"
              className="mt-6 flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-bg transition-all hover:bg-accent/90 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
            >
              <FlaskConical className="h-4 w-4" />
              <span>Comenzar en el Laboratorio</span>
            </Link>
          </div>
        ) : (
          /* Listado de Simulaciones */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{simulations.length} simulaciones registradas</span>
              <span className="font-mono text-[11px]">Motor v1.0.0</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {simulations.map((sim) => {
                const confidence = sim.metrics?.confidence || 'high';
                const band = sim.metrics?.irritationBand || 'low';
                const isOutOfDomain = confidence !== 'high';

                return (
                  <div
                    key={sim.id}
                    onClick={() => handleLoadSimulation(sim)}
                    className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:border-accent/60 hover:bg-surface-2/40 cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div>
                      {/* Cabecera de la tarjeta */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-text group-hover:text-accent transition-colors">
                            {sim.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-muted">
                            <Clock className="h-3 w-3" />
                            <span>
                              {new Date(sim.createdAt).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDelete(sim.id, e)}
                          className="opacity-0 group-hover:opacity-100 rounded p-1 text-text-muted hover:bg-risk/20 hover:text-risk transition-all"
                          title="Eliminar simulación"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Badges de calidad e irritación */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            band === 'low'
                              ? 'bg-ok/15 text-ok border border-ok/30'
                              : band === 'moderate'
                              ? 'bg-warn/15 text-warn border border-warn/30'
                              : 'bg-risk/15 text-risk border border-risk/30'
                          }`}
                        >
                          Irritación: {sim.metrics?.irritationIndex ?? '—'}/100 ({band})
                        </span>

                        {isOutOfDomain ? (
                          <span className="flex items-center gap-1 rounded bg-warn/15 border border-warn/30 px-1.5 py-0.5 text-[10px] text-warn font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Baja Confianza</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded bg-surface-2 border border-border px-1.5 py-0.5 text-[10px] text-text-muted font-medium">
                            <ShieldCheck className="h-3 w-3 text-ok" />
                            <span>Dominio Válido</span>
                          </span>
                        )}
                      </div>

                      {/* Métricas clave */}
                      {sim.metrics && (
                        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-surface-2/60 p-2 text-center">
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-text-muted">
                              log Kp
                            </span>
                            <span className="font-mono text-xs font-bold tabular-nums text-text">
                              {sim.metrics.logKp.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-text-muted">
                              Lag time
                            </span>
                            <span className="font-mono text-xs font-bold tabular-nums text-text">
                              {sim.metrics.lagTimeHours >= 9999
                                ? '>9999'
                                : `${sim.metrics.lagTimeHours.toFixed(1)} h`}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-text-muted">
                              Absorbido
                            </span>
                            <span className="font-mono text-xs font-bold tabular-nums text-text">
                              {sim.metrics.absorbedFractionPct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3">
                      <div className="flex items-center justify-between text-xs font-medium text-accent">
                        <span className="flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          <span>Cargar en Laboratorio</span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </div>

                      {isPersisted(sim.id) ? (
                        <button
                          onClick={(e) => handleExport(sim, e)}
                          disabled={exportingId === sim.id}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-2/60 px-2 py-1.5 text-[11px] font-medium text-text-muted transition-colors hover:border-accent/60 hover:text-text disabled:opacity-60 cursor-pointer"
                        >
                          {exportingId === sim.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {exportingId === sim.id ? 'Generando…' : 'Descargar Excel (7 hojas)'}
                          </span>
                        </button>
                      ) : (
                        <span className="text-center text-[10px] leading-relaxed text-text-muted/70">
                          Guardada solo en este navegador. Inicia sesión y vuelve a guardarla para
                          poder exportarla.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Modal de Reporte */}
      <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </div>
  );
}
