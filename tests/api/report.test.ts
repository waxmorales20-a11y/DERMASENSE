import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/report/route';
import { NextRequest } from 'next/server';
import { DEFAULT_INGREDIENT, DEFAULT_VEHICLE } from '@/lib/mock-catalog';
import { simulate } from '@/packages/engine/simulate';

describe('Route Handler /api/report', () => {
  const validSimulation = simulate({
    ingredient: DEFAULT_INGREDIENT,
    vehicle: DEFAULT_VEHICLE,
    concentrationPct: 0.3,
    pH: 5.5,
    durationHours: 24,
    appliedDoseMgCm2: 2.0,
  });

  it('devuelve 400 VALIDATION_ERROR si faltan input o metrics', async () => {
    const req = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('devuelve 503 AI_UNAVAILABLE de forma controlada cuando no hay API key configurada', async () => {
    const req = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      body: JSON.stringify({
        input: validSimulation.input,
        metrics: validSimulation.metrics,
      }),
    });

    const res = await POST(req);

    // Si no hay key real configurada en runtime, debe devolver 503 con código AI_UNAVAILABLE
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-...')) {
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error.code).toBe('AI_UNAVAILABLE');
      expect(json.error.message).toContain('Las métricas de la simulación permanecen intactas');
    }
  });

  it('permite generar reporte técnico exploratorio cuando se solicita allowMock: true', async () => {
    const req = new NextRequest('http://localhost:3000/api/report', {
      method: 'POST',
      body: JSON.stringify({
        input: validSimulation.input,
        metrics: validSimulation.metrics,
        allowMock: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.content).toBeDefined();
    expect(json.content).toContain('## Resumen');
    expect(json.content).toContain('## Interpretación de las métricas');
    expect(json.content).toContain('estimación heurística exploratoria');
  });
});
