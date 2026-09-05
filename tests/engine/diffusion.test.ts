import { describe, it, expect } from 'vitest';
import { simulate } from '../../packages/engine/simulate';
import { baseInput, ethanolVehicle, niacinamide } from './fixtures';

describe('solver de difusion', () => {
  const result = simulate(baseInput());

  it('conserva la masa con error menor al 1 %', () => {
    expect(result.massBalance.relativeError).toBeLessThan(0.01);
  });

  it('no produce NaN ni valores no finitos', () => {
    for (const frame of result.frames) {
      for (const c of frame.concentrations) {
        expect(Number.isFinite(c)).toBe(true);
      }
      expect(Number.isFinite(frame.vehicleConcentration)).toBe(true);
    }
  });

  it('no produce concentraciones negativas', () => {
    for (const frame of result.frames) {
      for (const c of frame.concentrations) {
        expect(c).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('parte de piel limpia', () => {
    const first = result.frames[0];
    expect(first.timeHours).toBe(0);
    expect(Math.max(...first.concentrations)).toBe(0);
  });

  it('el vehiculo se agota conforme el activo penetra (dosis finita)', () => {
    const first = result.frames[0].vehicleConcentration;
    const last = result.frames[result.frames.length - 1].vehicleConcentration;
    expect(last).toBeLessThan(first);
    expect(last).toBeGreaterThanOrEqual(0);
  });

  it('la concentracion decrece con la profundidad al final de la simulacion', () => {
    const last = result.frames[result.frames.length - 1].concentrations;
    // Dentro del estrato corneo el frente avanza desde la superficie.
    expect(last[0]).toBeGreaterThan(last[35]);
  });

  it('el activo alcanza la epidermis viable en 24 h', () => {
    expect(result.metrics.peakConcentrationVE).toBeGreaterThan(0);
  });

  it('cubre toda la ventana temporal solicitada', () => {
    const last = result.frames[result.frames.length - 1];
    expect(last.timeHours).toBeCloseTo(24, 6);
  });

  it('mas tiempo implica mas masa absorbida', () => {
    const short = simulate(baseInput({ durationHours: 6 }));
    const long = simulate(baseInput({ durationHours: 24 }));
    expect(long.metrics.absorbedFractionPct).toBeGreaterThan(
      short.metrics.absorbedFractionPct,
    );
  });

  it('un potenciador de penetracion aumenta el flujo', () => {
    const plain = simulate(baseInput());
    const enhanced = simulate(baseInput({ vehicle: ethanolVehicle }));
    expect(enhanced.metrics.absorbedFractionPct).toBeGreaterThan(
      plain.metrics.absorbedFractionPct,
    );
  });

  it('un activo mas hidrofilico penetra menos el estrato corneo', () => {
    const lipophilic = simulate(baseInput());
    const hydrophilic = simulate(baseInput({ ingredient: niacinamide }));
    expect(hydrophilic.metrics.logKp).toBeLessThan(lipophilic.metrics.logKp);
  });
});
