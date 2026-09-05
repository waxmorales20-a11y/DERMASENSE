import { describe, it, expect } from 'vitest';
import { simulate } from '../../packages/engine/simulate';
import { ENGINE_VERSION } from '../../packages/engine/constants';
import { baseInput, ethanolVehicle, niacinamide } from './fixtures';

describe('happy path: acido salicilico 2 % en vehiculo acuoso', () => {
  const r = simulate(baseInput());
  const m = r.metrics;

  it('devuelve un resultado completo y trazable', () => {
    expect(r.engineVersion).toBe(ENGINE_VERSION);
    expect(r.frames.length).toBeGreaterThan(1);
    expect(new Date(r.computedAt).toString()).not.toBe('Invalid Date');
  });

  it('logKp coincide con Potts-Guy', () => {
    expect(m.logKp).toBeCloseTo(-1.9376, 3);
  });

  it('el lag time cae en la escala de horas esperada para el estrato corneo', () => {
    expect(m.lagTimeHours).toBeGreaterThan(0.1);
    expect(m.lagTimeHours).toBeLessThan(12);
  });

  it('todas las metricas son finitas', () => {
    for (const [key, value] of Object.entries(m)) {
      if (typeof value === 'number') {
        expect(Number.isFinite(value), `${key} no es finito`).toBe(true);
      }
    }
  });

  it('la fraccion absorbida esta entre 0 y 100 %', () => {
    expect(m.absorbedFractionPct).toBeGreaterThan(0);
    expect(m.absorbedFractionPct).toBeLessThanOrEqual(100);
  });

  it('la penetracion alcanza la dermis pero no atraviesa toda la piel', () => {
    expect(m.penetrationDepthUm).toBeGreaterThan(100);
    expect(m.penetrationDepthUm).toBeLessThan(3100);
  });

  it('el indice de irritacion esta acotado y con banda coherente', () => {
    expect(m.irritationIndex).toBeGreaterThanOrEqual(0);
    expect(m.irritationIndex).toBeLessThanOrEqual(100);
    expect(['low', 'moderate', 'high', 'very_high']).toContain(m.irritationBand);
  });

  it('la confianza es alta dentro del dominio del modelo', () => {
    expect(m.confidence).toBe('high');
    expect(m.outOfDomainReasons).toHaveLength(0);
  });
});

describe('determinismo', () => {
  it('los mismos inputs producen las mismas metricas', () => {
    const a = simulate(baseInput());
    const b = simulate(baseInput());
    expect(a.metrics).toEqual(b.metrics);
    expect(Array.from(a.frames[30].concentrations)).toEqual(
      Array.from(b.frames[30].concentrations),
    );
  });
});

describe('poder discriminante entre formulaciones', () => {
  it('el potenciador acelera la absorcion (t50 menor)', () => {
    const plain = simulate(baseInput());
    const enhanced = simulate(baseInput({ vehicle: ethanolVehicle }));
    expect(enhanced.metrics.timeTo50PctHours).toBeLessThan(
      plain.metrics.timeTo50PctHours,
    );
    expect(enhanced.metrics.penetrationDepthUm).toBeGreaterThan(
      plain.metrics.penetrationDepthUm,
    );
  });

  it('un activo hidrofilico penetra menos profundo que uno lipofilico', () => {
    const lipophilic = simulate(baseInput());
    const hydrophilic = simulate(baseInput({ ingredient: niacinamide }));
    expect(hydrophilic.metrics.penetrationDepthUm).toBeLessThan(
      lipophilic.metrics.penetrationDepthUm,
    );
  });

  it('mayor concentracion aumenta la exposicion en epidermis viable', () => {
    const low = simulate(baseInput({ concentrationPct: 0.5 }));
    const high = simulate(baseInput({ concentrationPct: 4 }));
    expect(high.metrics.peakConcentrationVE).toBeGreaterThan(
      low.metrics.peakConcentrationVE,
    );
  });
});

describe('rendimiento', () => {
  it('completa 24 h simuladas en menos de 2 s', () => {
    const t0 = performance.now();
    simulate(baseInput());
    expect(performance.now() - t0).toBeLessThan(2000);
  });
});
