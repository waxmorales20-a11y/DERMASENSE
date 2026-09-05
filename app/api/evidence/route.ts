import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/evidence — proxy hacia el backend Python.
 *
 * Reúne, para un activo concreto, las dos cosas que el backend sabe y el
 * navegador no:
 *
 *  1. **Cuánto se equivoca el modelo** con moléculas parecidas a esta, medido
 *     contra permeabilidades experimentales publicadas (`/api/v1/validation`).
 *  2. **Si la concentración elegida respeta los límites regulatorios**, con la
 *     cita del reglamento (`/api/v1/regulatory/check`).
 *
 * Las dos llamadas van en paralelo y cada una falla por su cuenta: una de las
 * dos caída no debe dejar la pantalla sin la otra.
 *
 * **No requiere sesión.** Ambos endpoints del backend son públicos: evalúan
 * reglamentos publicados y datos experimentales citables. No gastan tokens ni
 * tocan datos de usuario, así que pedir login solo dejaría la pantalla de
 * formulación vacía. El único endpoint que sí exige identidad es el de IA, por
 * el coste.
 *
 * Query: ?name=&inciName=&molecularWeight=&logP=&concentrationPct=&productType=
 */

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

type Section<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

function failed(code: string, message: string): Section<never> {
  return { ok: false, code, message };
}

async function callBackend<T>(path: string): Promise<Section<T>> {
  try {
    const res = await fetch(`${BACKEND_URL.replace(/\/$/, '')}${path}`, {
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      return failed(
        payload?.error?.code ?? 'UPSTREAM_ERROR',
        payload?.error?.message ?? `El backend respondió ${res.status}.`,
      );
    }

    return { ok: true, data: (await res.json()) as T };
  } catch {
    return failed('UPSTREAM_ERROR', 'No se pudo contactar con el servicio científico.');
  }
}

async function postBackend<T>(path: string, body: unknown): Promise<Section<T>> {
  try {
    const res = await fetch(`${BACKEND_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      return failed(
        payload?.error?.code ?? 'UPSTREAM_ERROR',
        payload?.error?.message ?? `El backend respondió ${res.status}.`,
      );
    }

    return { ok: true, data: (await res.json()) as T };
  } catch {
    return failed('UPSTREAM_ERROR', 'No se pudo contactar con el servicio científico.');
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const name = params.get('name') ?? '';
  const inciName = params.get('inciName') ?? '';
  const molecularWeight = Number(params.get('molecularWeight'));
  const logP = Number(params.get('logP'));
  const concentrationPct = Number(params.get('concentrationPct'));
  const productType = params.get('productType') || 'leave_on';

  if (!name || !Number.isFinite(molecularWeight) || !Number.isFinite(logP)) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Se requieren name, molecularWeight y logP.',
        },
      },
      { status: 400 },
    );
  }

  if (!BACKEND_URL) {
    return NextResponse.json(
      {
        error: {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'BACKEND_URL no está configurada; la capa científica no está disponible.',
        },
      },
      { status: 503 },
    );
  }

  const query = new URLSearchParams({
    molecular_weight: String(molecularWeight),
    log_p: String(logP),
    name,
  });
  if (inciName) query.set('inci_name', inciName);

  // En paralelo: son independientes y juntas tardan lo que la más lenta.
  const [validation, regulatory] = await Promise.all([
    callBackend<unknown>(`/api/v1/validation?${query.toString()}`),
    Number.isFinite(concentrationPct) && concentrationPct > 0
      ? postBackend<unknown>('/api/v1/regulatory/check', {
          ingredient_name: name,
          inci_name: inciName || null,
          concentration_pct: concentrationPct,
          product_type: productType,
          jurisdictions: ['eu', 'us'],
        })
      : Promise.resolve(failed('SKIPPED', 'Sin concentración que verificar.')),
  ]);

  return NextResponse.json({ validation, regulatory });
}
