'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Plug } from 'lucide-react';
import { useLabStore } from '@/lib/store/useLabStore';
import {
  checkRegulatory,
  isPythonBackendConfigured,
  type RegulatoryCheck,
} from '@/lib/api/python-backend';

/**
 * Revisión regulatoria preliminar servida por el backend Python
 * (docs/API_CONTRACT.md §5). Nunca bloquea la pantalla: si el backend no está
 * desplegado o falla, el panel se repliega a una nota discreta.
 *
 * El estado nunca es "aprobado": el sistema no emite autorizaciones.
 */
export const RegulatoryStatus: React.FC = () => {
  const { concentrationPct, getIngredient } = useLabStore();
  const ingredient = getIngredient();

  const [check, setCheck] = useState<RegulatoryCheck | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const configured = isPythonBackendConfigured();

  useEffect(() => {
    if (!configured) return;

    const controller = new AbortController();
    let cancelled = false;

    // Pequeño retardo: el usuario suele mover el slider de concentración.
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setFailed(false);

      checkRegulatory(
        { ingredientName: ingredient.name, concentrationPct, jurisdiction: 'EU' },
        { signal: controller.signal }
      )
        .then((res) => {
          if (cancelled) return;
          setCheck(res);
        })
        .catch(() => {
          if (cancelled) return;
          setCheck(null);
          setFailed(true);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [configured, ingredient.name, concentrationPct]);

  if (!configured) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
        <Plug className="h-3 w-3" />
        <span>
          Revisión regulatoria sin conectar — define{' '}
          <code className="font-mono">NEXT_PUBLIC_PY_API_URL</code>
        </span>
      </div>
    );
  }

  if (isLoading && !check) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
        <ShieldQuestion className="h-3 w-3 animate-pulse" />
        <span>Consultando revisión regulatoria…</span>
      </div>
    );
  }

  if (failed || !check) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
        <Plug className="h-3 w-3" />
        <span>Backend regulatorio no disponible ahora mismo.</span>
      </div>
    );
  }

  const isRestricted = check.status === 'restricted';
  const needsReview = check.status === 'requires_review';
  const Icon = isRestricted ? ShieldAlert : needsReview ? ShieldQuestion : ShieldCheck;

  const label: Record<RegulatoryCheck['status'], string> = {
    ok: 'Dentro del límite declarado',
    requires_review: 'Requiere revisión profesional',
    restricted: 'Uso restringido',
    insufficient_data: 'Datos insuficientes',
  };

  return (
    <div
      className={`flex flex-col gap-1 rounded-md border px-2 py-1.5 text-[10px] ${
        isRestricted
          ? 'border-risk-high/50 bg-risk-high/10 text-text'
          : 'border-border bg-surface text-text-muted'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${isRestricted ? 'text-risk-high' : 'text-text-muted'}`} />
        <span className={`font-semibold ${isRestricted ? 'text-risk-high' : 'text-text'}`}>
          {check.jurisdiction} · {label[check.status]}
        </span>
      </div>

      {typeof check.max_use_concentration === 'number' && (
        <span className="tabular-nums">
          Máximo declarado: {check.max_use_concentration}% · actual {concentrationPct}%
        </span>
      )}

      {check.regulation_ref && <span>{check.regulation_ref}</span>}
    </div>
  );
};
