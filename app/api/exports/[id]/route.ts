import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/exports/[id] — descarga el libro Excel de una simulación.
 *
 * Proxy hacia `GET /api/v1/exports/{id}.xlsx` del backend Python, que arma las
 * 7 hojas del README §16 con `openpyxl`.
 *
 * **Este sí exige sesión, y a diferencia del panel de evidencia, aquí está
 * justificado**: el libro contiene la simulación de una persona concreta. El
 * backend lo lee de Supabase con el JWT del usuario, así que RLS decide si esa
 * fila es suya. Si es de otro, devuelve 404 — no 403: un 403 confirmaría que la
 * simulación existe.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!BACKEND_URL) {
    return NextResponse.json(
      {
        error: {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'BACKEND_URL no está configurada; la exportación no está disponible.',
        },
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Inicia sesión para descargar el reporte de tu simulación.',
        },
      },
      { status: 401 },
    );
  }

  const url = new URL(`${BACKEND_URL.replace(/\/$/, '')}/api/v1/exports/${id}.xlsx`);
  // Se reenvían los parámetros opcionales del backend (área, si incluir la
  // revisión regulatoria) sin tener que conocerlos aquí uno a uno.
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      // El libro se arma en ~100 ms, pero la consulta a Supabase puede tardar.
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'No se pudo contactar con el servicio de exportación.',
        },
      },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    // El backend ya habla el formato de error del contrato (TRD §3).
    const payload = await upstream.json().catch(() => null);
    return NextResponse.json(
      payload ?? {
        error: { code: 'UPSTREAM_ERROR', message: 'La exportación falló.' },
      },
      { status: upstream.status },
    );
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': XLSX,
      'Content-Disposition':
        upstream.headers.get('content-disposition') ?? `attachment; filename="dermasense.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
