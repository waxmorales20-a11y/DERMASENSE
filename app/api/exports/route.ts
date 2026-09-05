import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/exports — libro Excel de una simulación aún no guardada.
 *
 * Proxy hacia `POST /api/v1/exports` del backend, que arma las 7 hojas con
 * `openpyxl` a partir de las métricas que el motor calculó en el navegador.
 *
 * **No exige sesión**, a diferencia de `GET /api/exports/[id]`: aquí los datos
 * los acaba de calcular el propio usuario en su máquina, así que pedir login
 * para devolvérselos en un .xlsx no protege nada. La ruta con `id` sigue
 * cerrada porque esa sí lee una fila de la base.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function POST(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'El cuerpo no es JSON válido.' } },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/api/v1/exports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
    const payload = await upstream.json().catch(() => null);
    return NextResponse.json(
      payload ?? { error: { code: 'UPSTREAM_ERROR', message: 'La exportación falló.' } },
      { status: upstream.status },
    );
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': XLSX,
      'Content-Disposition':
        upstream.headers.get('content-disposition') ?? 'attachment; filename="dermasense.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
