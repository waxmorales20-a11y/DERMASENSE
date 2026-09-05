'use client';

import React, { useState, useEffect } from 'react';
import { useLabStore } from '@/lib/store/useLabStore';
import {
  X,
  BrainCircuit,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose }) => {
  const { result } = useLabStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchReport = async (forceMock = false) => {
    if (!result) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: result.input,
          metrics: result.metrics,
          allowMock: forceMock,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(
          data.error?.message ||
            'El servicio de IA no se encuentra disponible. Las métricas siguen intactas.',
        );
      } else {
        setReportText(data.content);
      }
    } catch (err) {
      setError('Error de conexión con el endpoint de reporte. Las métricas permanecen disponibles.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar reporte automáticamente al abrir si no hay uno previo
  useEffect(() => {
    if (isOpen && !reportText && !loading) {
      fetchReport(false);
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (!reportText) return;
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    toast.success('Informe copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent">
              <BrainCircuit className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-text">
                Reporte Técnico de Formulación (IA)
              </h2>
              <p className="text-[11px] text-text-muted">
                Interpretación cualitativa de penetración dérmica asistida por modelo LLM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex flex-1 flex-col overflow-y-auto p-5 text-xs leading-relaxed text-text">
          {loading && (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-text">
                  Interpretando simulación con Claude...
                </span>
                <span className="text-xs text-text-muted">
                  Analizando coeficientes de reparto, flujo límite y tiempo de difusión.
                </span>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col gap-4 py-8">
              <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 p-4 text-xs text-warn">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <strong className="text-sm font-semibold">Servicio de IA temporalmente no disponible (503)</strong>
                  <p className="text-[11px] leading-relaxed text-text/90">{error}</p>
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface-2/60 p-3 text-[11px] text-text-muted">
                <p>
                  <strong>Invariante de diseño:</strong> Los resultados físicos, las métricas numéricas y el corte
                  3D continúan 100% operativos en el Laboratorio sin afectación.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => fetchReport(false)}
                  className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-accent/90"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reintentar con Claude</span>
                </button>
                <button
                  onClick={() => fetchReport(true)}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-accent hover:text-accent"
                >
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  <span>Cargar informe en modo demostración</span>
                </button>
              </div>
            </div>
          )}

          {reportText && !loading && (
            <div className="flex flex-col gap-3 font-sans whitespace-pre-line leading-relaxed text-text/90">
              {reportText}
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="flex items-center justify-between border-t border-border bg-surface-2/40 px-5 py-3">
          <span className="text-[10px] text-text-muted">
            La IA no calcula números; interpreta resultados bajo supuestos declarados.
          </span>
          <div className="flex items-center gap-2">
            {reportText && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-accent hover:text-accent"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md bg-accent-soft px-3 py-1.5 text-xs font-semibold text-text hover:bg-accent hover:text-bg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
