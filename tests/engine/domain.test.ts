import { describe, it, expect } from 'vitest';
import { simulate, SimulationError } from '../../packages/engine/simulate';
import { baseInput, hyaluronicAcid, salicylicAcid } from './fixtures';

/**
 * Caso de error critico: el motor debe reconocer sus propios limites y
 * rechazar entradas invalidas en lugar de devolver un numero sin sentido.
 */
describe('entradas invalidas', () => {
  it('rechaza concentracion fuera de rango', () => {
    expect(() => simulate(baseInput({ concentrationPct: 0 }))).toThrow(SimulationError);
    expect(() => simulate(baseInput({ concentrationPct: 50 }))).toThrow(SimulationError);
  });

  it('rechaza pH fuera de rango', () => {
    expect(() => simulate(baseInput({ pH: 1 }))).toThrow(SimulationError);
    expect(() => simulate(baseInput({ pH: 14 }))).toThrow(SimulationError);
  });

  it('rechaza duracion invalida', () => {
    expect(() => simulate(baseInput({ durationHours: 0 }))).toThrow(SimulationError);
    expect(() => simulate(baseInput({ durationHours: 200 }))).toThrow(SimulationError);
  });

  it('rechaza dosis no positiva', () => {
    expect(() => simulate(baseInput({ appliedDoseMgCm2: 0 }))).toThrow(SimulationError);
  });

  it('rechaza propiedades fisicoquimicas invalidas', () => {
    expect(() =>
      simulate(baseInput({ ingredient: { ...salicylicAcid, molecularWeight: 0 } })),
    ).toThrow(SimulationError);
    expect(() =>
      simulate(baseInput({ ingredient: { ...salicylicAcid, logP: Number.NaN } })),
    ).toThrow(SimulationError);
  });

  it('el mensaje de error es accionable para el usuario', () => {
    try {
      simulate(baseInput({ pH: 12 }));
      expect.unreachable('deberia haber lanzado');
    } catch (e) {
      expect(e).toBeInstanceOf(SimulationError);
      expect((e as Error).message).toMatch(/pH/);
    }
  });
});

describe('fuera del dominio de aplicabilidad', () => {
  const r = simulate(baseInput({ ingredient: hyaluronicAcid, concentrationPct: 1 }));

  it('no lanza: entrega resultado marcado como poco fiable', () => {
    expect(r.metrics.confidence).toBe('low');
    expect(r.metrics.outOfDomainReasons.length).toBeGreaterThan(0);
  });

  it('explica el motivo concreto al usuario', () => {
    expect(r.metrics.outOfDomainReasons.join(' ')).toMatch(/500 Da/);
  });

  it('no reporta magnitudes temporales absurdas', () => {
    // Sin la guarda, el lag time de una macromolecula da ~1e29 h.
    expect(Number.isFinite(r.metrics.lagTimeHours)).toBe(true);
    expect(r.metrics.lagTimeHours).toBeLessThanOrEqual(9999);
    expect(Number.isFinite(r.metrics.timeTo50PctHours)).toBe(true);
  });

  it('predice que una macromolecula no atraviesa el estrato corneo', () => {
    expect(r.metrics.absorbedFractionPct).toBeLessThan(0.1);
  });

  it('conserva la masa incluso en el caso degenerado', () => {
    expect(r.massBalance.relativeError).toBeLessThan(0.01);
  });
});
