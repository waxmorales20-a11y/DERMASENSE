'use client';

import React from 'react';
import { X, ShieldAlert, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react';

interface ModelAssumptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelAssumptionsModal: React.FC<ModelAssumptionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent">
              <BookOpen className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-text">
              Supuestos y Limitaciones del Modelo Físico
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido deslizable */}
        <div className="flex flex-col gap-4 overflow-y-auto p-5 text-xs text-text-muted leading-relaxed">
          {/* DECLARACIÓN OBLIGATORIA DE HONESTIDAD */}
          <div className="rounded-lg border border-accent/40 bg-accent-soft/20 p-3.5 text-text">
            <p className="font-medium text-xs leading-normal">
              <strong>DERMASENSE es un sistema de soporte a la decisión en fase exploratoria de I+D. No constituye diagnóstico médico, evidencia de seguridad ni validación regulatoria.</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Qué calcula el modelo */}
            <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-surface-2/40 p-3">
              <div className="flex items-center gap-1.5 font-semibold text-ok">
                <CheckCircle2 className="h-4 w-4" />
                <span>Qué calcula el motor</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-text/90">
                <li>Difusión pasiva transepidérmica 1D (2ª Ley de Fick, solver FTCS explícito).</li>
                <li>Permeabilidad de estrato córneo por correlación QSPR Potts-Guy (1992).</li>
                <li>Dosis finita aplicada (película superficial que se agota gradualmente).</li>
                <li>Clearance fisiológico por microcirculación capilar en dermis (1e-3 s⁻¹).</li>
                <li>Perfil espacial continuo en 4 capas biológicas discretizadas.</li>
              </ul>
            </div>

            {/* Qué NO calcula el modelo */}
            <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-surface-2/40 p-3">
              <div className="flex items-center gap-1.5 font-semibold text-warn">
                <ShieldAlert className="h-4 w-4" />
                <span>Qué NO calcula el motor</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-text/90">
                <li>No modela vías anexiales (folículos pilosos ni glándulas sebáceas).</li>
                <li>No simula metabolismo cutáneo enzimático ni degradación química.</li>
                <li>No asume piel patológica, lesionada o con barrera rota.</li>
                <li>No evalúa sinergias ni incompatibilidades multi-activo complejas.</li>
                <li>El índice de irritación es heurístico y exploratorio, no clínico.</li>
              </ul>
            </div>
          </div>

          {/* Citas y procedencia */}
          <div className="rounded-lg border border-border bg-surface-2/30 p-3 text-[11px]">
            <span className="font-semibold text-text uppercase tracking-wider text-[10px]">
              Fuentes Bibliográficas de Referencia:
            </span>
            <p className="mt-1">
              Potts R.O. & Guy R.H. (1992) <em>Predicting Skin Permeability via QSPR</em>, Pharm Res. Flynn G.L. (1990) <em>Physicochemical Keys to Percutaneous Absorption</em>. Datos fisicoquímicos de activos indexados desde NIH PubChem.
            </p>
          </div>
        </div>

        {/* Pie */}
        <div className="flex justify-end border-t border-border bg-surface-2/40 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-accent/90"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
