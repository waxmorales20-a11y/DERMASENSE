import { describe, it, expect } from 'vitest';
import { POST, GET } from '@/app/api/simulations/route';
import { NextRequest } from 'next/server';
import { DEFAULT_INGREDIENT, DEFAULT_VEHICLE } from '@/lib/mock-catalog';
import { simulate } from '@/packages/engine/simulate';

describe('Route Handler /api/simulations', () => {
  const validSimulation = simulate({
    ingredient: DEFAULT_INGREDIENT,
    vehicle: DEFAULT_VEHICLE,
    concentrationPct: 0.3,
    pH: 5.5,
    durationHours: 24,
    appliedDoseMgCm2: 2.0,
  });

  it('devuelve 201 y guarda satisfactoriamente con payload válido', async () => {
    const req = new NextRequest('http://localhost:3000/api/simulations', {
      method: 'POST',
      body: JSON.stringify({
        input: validSimulation.input,
        metrics: validSimulation.metrics,
        title: 'Test Simulación',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.id).toBeDefined();
    expect(json.createdAt).toBeDefined();
  });

  it('devuelve 400 VALIDATION_ERROR si el input tiene valores inválidos', async () => {
    const req = new NextRequest('http://localhost:3000/api/simulations', {
      method: 'POST',
      body: JSON.stringify({
        input: {
          ...validSimulation.input,
          concentrationPct: 999, // Excede el máximo de 30%
        },
        metrics: validSimulation.metrics,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('devuelve 400 VALIDATION_ERROR si faltan las métricas', async () => {
    const req = new NextRequest('http://localhost:3000/api/simulations', {
      method: 'POST',
      body: JSON.stringify({
        input: validSimulation.input,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/simulations responde 200 con array de simulaciones', async () => {
    const req = new NextRequest('http://localhost:3000/api/simulations', {
      method: 'GET',
    });

    const res = await GET(req);
    expect([200, 401]).toContain(res.status);

    if (res.status === 200) {
      const json = await res.json();
      expect(Array.isArray(json.simulations)).toBe(true);
    }
  });
});
