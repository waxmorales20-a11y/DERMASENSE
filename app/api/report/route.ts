import { NextRequest, NextResponse } from 'next/server';
import type { SimulationInput, SimulationMetrics } from '@/packages/engine/types';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/report — proxy hacia el backend Python.
 *
 * Este handler ya NO habla con Anthropic. El prompt, el modelo y el manejo de
 * fallos viven en un solo sitio: DERMASENSE-BACKEND (`app/prompts/report_es.py`).
 *
 * Por que se movio: tener el mismo prompt escrito en TypeScript y en Python
 * crea dos fuentes de verdad para el mismo texto. Divergen —siempre divergen— y
 * el dia que diverjan, dos usuarios reciben interpretaciones distintas de las
 * mismas metricas. Es el mismo argumento de ADR-001 sobre el motor, aplicado a
 * la capa de IA.
 *
 * El contrato con el cliente NO cambia: mismo body de entrada, misma forma de
 * respuesta `{ content, model, generatedAt, tokens }`. `ReportModal` no se toca.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

// Mensaje canonico de degradacion. La UI lo muestra tal cual y las pruebas de
// tests/api/report.test.ts comprueban esta cadena.
const UNAVAILABLE_MESSAGE =
  'El servicio de IA no se encuentra disponible en este momento. Las métricas de la simulación permanecen intactas y utilizables en pantalla.';

function aiUnavailable(message = UNAVAILABLE_MESSAGE) {
  return NextResponse.json({ error: { code: 'AI_UNAVAILABLE', message } }, { status: 503 });
}

/**
 * Plantilla local de demostracion. Se conserva para el modo exploratorio sin
 * backend (`allowMock`) y para las pruebas: no consume tokens ni requiere red.
 * No es un reporte de IA y no debe presentarse como tal.
 */
function getMockReportContent(input: SimulationInput, metrics: SimulationMetrics): string {
  const isOutOfDomain = metrics.confidence !== 'high';
  return `${isOutOfDomain ? `> **Aviso de Dominio**: Simulación clasificada con confianza **${metrics.confidence}** debido a: ${metrics.outOfDomainReasons.join(', ')}.\n\n` : ''}## Resumen
La formulación de ${input.ingredient.name} al ${input.concentrationPct}% en ${input.vehicle.name} exhibe un comportamiento de penetración regido por su logP de ${input.ingredient.logP} y peso molecular de ${input.ingredient.molecularWeight} g/mol. Se estima una fracción cruzada hacia tejido viable del ${metrics.absorbedFractionPct.toFixed(1)}% al cabo de ${input.durationHours} horas bajo los supuestos del modelo 1D de Fick.

## Interpretación de las métricas
El coeficiente de permeabilidad estimado (log Kp = ${metrics.logKp.toFixed(2)}) condiciona un lag time de ${metrics.lagTimeHours.toFixed(2)} h, indicando el tiempo requerido para el establecimiento del frente de difusión en el estrato córneo. El vehículo ${input.vehicle.name} modula la difusividad mediante un factor potenciador de ${input.vehicle.enhancerFactor}x, alcanzando un flujo máximo teórico a dosis infinita de ${metrics.maxFluxInfiniteDose.toFixed(1)} µg/cm²/h.

## Consideraciones de tolerancia
El índice de irritación obtenido es de ${metrics.irritationIndex}/100, correspondiente a la banda "${metrics.irritationBand}". Se recuerda que este índice es una **estimación heurística exploratoria — no es una evaluación de seguridad**, derivada de la concentración pico en epidermis viable (${metrics.peakConcentrationVE.toFixed(1)} µg/cm³) y el pH de ${input.pH}.

## Siguientes pasos sugeridos en formulación
1. **Vehículo**: Evaluar la transición a un vehículo de liberación más sostenida si se busca reducir el pico de exposición celular.
2. **Buffer de pH**: Mantener el pH cercano a 5.0 para optimizar la compatibilidad con el manto hidrolipídico cutáneo.
3. **Validación**: Conducir ensayos de permeación en celda de Franz antes de cualquier escalado experimental.

## Limitaciones
Este reporte se basa en difusión pasiva homogénea en 4 estratos. No contempla permeación por anexos foliculares, hidrólisis enzimática ni variación interindividual del estrato córneo.`;
}

interface SseResult {
  text: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  truncated?: boolean;
  error?: { code: string; message: string };
}

/**
 * Consume el `text/event-stream` del backend y lo reduce a un objeto.
 *
 * El backend emite en streaming porque es lo que le da frases a la voz; aqui se
 * acumula porque `ReportModal` hace `res.json()`. Cuando la UI quiera mostrar el
 * texto conforme llega, este handler puede reenviar el stream sin tocar el
 * backend.
 */
async function readSse(response: Response): Promise<SseResult> {
  const raw = await response.text();
  const result: SseResult = { text: '' };

  for (const block of raw.split('\n\n')) {
    let event = '';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      else if (line.startsWith('data: ')) data = line.slice(6);
    }
    if (!event || !data) continue;

    try {
      const payload = JSON.parse(data);
      if (event === 'delta') result.text += payload.text ?? '';
      else if (event === 'meta') result.model = payload.model;
      else if (event === 'done') {
        result.inputTokens = payload.input_tokens;
        result.outputTokens = payload.output_tokens;
        result.truncated = payload.truncated;
      } else if (event === 'error') result.error = payload;
    } catch {
      // Un bloque ilegible no debe tumbar un reporte que ya trae texto.
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  let body: {
    input?: SimulationInput;
    metrics?: SimulationMetrics;
    notes?: string;
    allowMock?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'El cuerpo de la petición no es JSON válido.' } },
      { status: 400 },
    );
  }

  const { input, metrics, notes, allowMock } = body;

  if (!input || !metrics) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Se requieren los campos "input" y "metrics" para generar el informe técnico.',
        },
      },
      { status: 400 },
    );
  }

  const isMockRequested =
    allowMock === true ||
    request.headers.get('x-mock-report') === 'true' ||
    request.nextUrl.searchParams.get('mock') === 'true';

  if (isMockRequested) {
    return NextResponse.json({
      content: getMockReportContent(input, metrics),
      model: 'plantilla local (modo exploratorio)',
      generatedAt: new Date().toISOString(),
      isMock: true,
    });
  }

  if (!BACKEND_URL) {
    console.warn('POST /api/report: BACKEND_URL no configurada.');
    return aiUnavailable();
  }

  // La vista previa del backend no exige sesión, así que el informe funciona sin
  // haber entrado. Si hay sesión se reenvía el JWT igualmente: permite al
  // backend aplicar la cuota por usuario en vez del límite genérico por IP.
  const supabase = await createClient();
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const accessToken = data.session?.access_token;

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/api/v1/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ input, metrics, notes }),
      // Un reporte completo ronda los 20 s; se deja margen sobre el limite del
      // propio backend para que sea el quien decida rendirse, no este proxy.
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    console.error('POST /api/report: el backend no respondió.', err);
    return aiUnavailable();
  }

  if (!upstream.ok) {
    // El backend ya habla el mismo formato de error (TRD §3): se reenvia tal
    // cual en vez de reinventar el mensaje.
    const payload = await upstream.json().catch(() => null);
    if (payload?.error) {
      return NextResponse.json(payload, { status: upstream.status });
    }
    return aiUnavailable();
  }

  const result = await readSse(upstream);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }
  if (!result.text.trim()) {
    return aiUnavailable();
  }

  return NextResponse.json({
    content: result.text,
    model: result.model ?? 'claude-sonnet-5',
    generatedAt: new Date().toISOString(),
    truncated: result.truncated ?? false,
    tokens: {
      input: result.inputTokens ?? 0,
      output: result.outputTokens ?? 0,
    },
  });
}
