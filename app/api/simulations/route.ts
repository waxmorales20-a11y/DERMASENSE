import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

// Esquema de validación estricto según TRD.md §3 y types.ts
const SimulationPayloadSchema = z.object({
  title: z.string().optional(),
  notes: z.string().optional(),
  input: z.object({
    ingredient: z.object({
      id: z.string(),
      name: z.string(),
      molecularWeight: z.number().positive(),
      logP: z.number(),
      riskFlags: z.array(z.string()),
    }),
    vehicle: z.object({
      id: z.string(),
      name: z.string(),
      enhancerFactor: z.number().positive(),
    }),
    concentrationPct: z.number().min(0.01).max(30),
    pH: z.number().min(3.0).max(9.0),
    durationHours: z.number().min(1).max(48),
    appliedDoseMgCm2: z.number().positive(),
  }),
  metrics: z.object({
    logKp: z.number(),
    permeabilityCmH: z.number(),
    maxFluxInfiniteDose: z.number(),
    lagTimeHours: z.number(),
    absorbedFractionPct: z.number(),
    timeTo50PctHours: z.number(),
    penetrationDepthUm: z.number(),
    peakConcentrationVE: z.number(),
    irritationIndex: z.number(),
    irritationBand: z.enum(['low', 'moderate', 'high', 'very_high']),
    confidence: z.enum(['high', 'medium', 'low']),
    outOfDomainReasons: z.array(z.string()),
  }),
});

/**
 * POST /api/simulations
 * Persiste una simulación calculada en el cliente.
 * Importante: No se persisten los frames pesados, solo input + metrics + engineVersion.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = SimulationPayloadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'El payload de simulación no cumple con el contrato requerido.',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    const { input, metrics, title, notes } = parseResult.data;
    const simTitle =
      title || `${input.ingredient.name} ${input.concentrationPct}% en ${input.vehicle.name}`;

    // Si Supabase no está configurado (degradación elegante para modo local / demo)
    if (!isSupabaseConfigured()) {
      const mockId = `mock-sim-${Date.now()}`;
      const now = new Date().toISOString();
      return NextResponse.json(
        {
          id: mockId,
          createdAt: now,
          mode: 'guest_local',
          message: 'Supabase no configurado; persistencia completada en modo local.',
        },
        { status: 201 },
      );
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'No se pudo inicializar el cliente de base de datos.',
          },
        },
        { status: 500 },
      );
    }

    // Verificar sesión del usuario
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Debe iniciar sesión para guardar la simulación en su cuenta.',
          },
        },
        { status: 401 },
      );
    }

    // Insertar en public.simulations
    const { data, error: insertError } = await supabase
      .from('simulations')
      .insert({
        user_id: user.id,
        title: simTitle,
        concentration_pct: input.concentrationPct,
        ph: input.pH,
        duration_hours: input.durationHours,
        applied_dose_mg_cm2: input.appliedDoseMgCm2,
        input_snapshot: input,
        metrics: metrics,
        engine_version: '1.0.0',
        notes: notes || null,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Error al insertar la simulación en la base de datos.',
            details: insertError.message,
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        id: data.id,
        createdAt: data.created_at,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error inesperado al procesar la simulación.',
        },
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/simulations
 * Obtiene el listado de simulaciones del usuario autenticado.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ simulations: [], mode: 'guest_local' });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Cliente no disponible.' } },
      { status: 500 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Sesión no iniciada.',
        },
      },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from('simulations')
    .select('id, title, created_at, concentration_pct, metrics, engine_version')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al consultar historial de simulaciones.',
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ simulations: data ?? [] });
}
