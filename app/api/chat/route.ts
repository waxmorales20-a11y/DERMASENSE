import { NextRequest, NextResponse } from 'next/server';
import type { SimulationInput, SimulationMetrics } from '@/packages/engine/types';

/**
 * POST /api/chat — proxy hacia el backend Python.
 *
 * El prompt del asistente, el modelo y el manejo de fallos viven en un solo
 * sitio (`app/prompts/chat_es.py` del backend). Antes este handler tenía su
 * propia copia del prompt en TypeScript: dos textos que dicen lo mismo acaban
 * divirgiendo, y con ellos las reglas de honestidad que sostienen el producto.
 *
 * El contrato con el cliente no cambia: mismo body, misma respuesta
 * `{ content, model, generatedAt }`.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

function unavailable(message: string, status = 503) {
  return NextResponse.json({ error: { code: 'AI_UNAVAILABLE', message } }, { status });
}

export async function POST(request: NextRequest) {
  let body: {
    messages?: ChatMessagePayload[];
    input?: SimulationInput;
    metrics?: SimulationMetrics;
    currentTimeHours?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'El cuerpo no es JSON válido.' } },
      { status: 400 },
    );
  }

  const { messages, input, metrics, currentTimeHours } = body;

  if (!input || !metrics || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Se requieren "messages", "input" y "metrics".',
        },
      },
      { status: 400 },
    );
  }

  if (!BACKEND_URL) {
    return unavailable(
      'El asistente con IA no está configurado. Las respuestas se generan localmente a partir de las métricas del motor.',
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        input,
        metrics,
        current_time_hours: currentTimeHours ?? null,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return unavailable('No se pudo contactar con el asistente. Las métricas siguen intactas.');
  }

  if (!upstream.ok) {
    // El backend ya habla el formato de error del contrato (TRD §3).
    const payload = await upstream.json().catch(() => null);
    if (payload?.error) return NextResponse.json(payload, { status: upstream.status });
    return unavailable('El asistente no está disponible ahora mismo.');
  }

  const data = await upstream.json();

  return NextResponse.json({
    content: data.content,
    model: data.model,
    generatedAt: new Date().toISOString(),
    tokens: { input: data.input_tokens, output: data.output_tokens },
  });
}
