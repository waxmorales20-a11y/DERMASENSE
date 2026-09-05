import { describe, it, expect } from 'vitest';
import {
  logKp,
  permeabilityCmH,
  partitionCoefficient,
  stratumCorneumDiffusivity,
  lagTimeHours,
  checkDomain,
} from '../../packages/engine/qspr';
import type { Ingredient } from '../../packages/engine/types';

const ing = (mw: number, logP: number): Ingredient => ({
  id: 'x',
  name: 'test',
  molecularWeight: mw,
  logP,
  riskFlags: [],
});

describe('Potts-Guy', () => {
  it('reproduce la ecuacion publicada', () => {
    // -2.7 + 0.71*2.26 - 0.0061*138.12
    expect(logKp(138.12, 2.26)).toBeCloseTo(-1.9376, 3);
  });

  it('el agua (MW 18, logP -1.38) cae en el rango experimental conocido', () => {
    // Kp del agua medido ~ 1e-3 cm/h; Potts-Guy predice del mismo orden.
    const value = logKp(18, -1.38);
    expect(value).toBeGreaterThan(-4);
    expect(value).toBeLessThan(-3);
  });

  it('permeabilidad es 10^logKp', () => {
    expect(permeabilityCmH(138.12, 2.26)).toBeCloseTo(
      Math.pow(10, logKp(138.12, 2.26)),
      10,
    );
  });

  it('mayor MW reduce la permeabilidad', () => {
    expect(logKp(400, 2)).toBeLessThan(logKp(100, 2));
  });

  it('mayor logP aumenta la permeabilidad', () => {
    expect(logKp(200, 4)).toBeGreaterThan(logKp(200, 1));
  });
});

describe('particion y difusividad', () => {
  it('logP 0 da coeficiente de particion 1', () => {
    expect(partitionCoefficient(0)).toBeCloseTo(1, 10);
  });

  it('la difusividad del SC es positiva y de orden fisico', () => {
    const d = stratumCorneumDiffusivity(138.12, 2.26, 20 / 10000);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(1e-6);
  });

  it('el lag time crece con el cuadrado del espesor', () => {
    const t1 = lagTimeHours(20 / 10000, 1e-10);
    const t2 = lagTimeHours(40 / 10000, 1e-10);
    expect(t2 / t1).toBeCloseTo(4, 6);
  });
});

describe('dominio de aplicabilidad', () => {
  it('acido salicilico esta dentro del dominio', () => {
    const r = checkDomain(ing(138.12, 2.26));
    expect(r.confidence).toBe('high');
    expect(r.reasons).toHaveLength(0);
  });

  it('acido hialuronico (MW 5000) queda fuera del dominio', () => {
    const r = checkDomain(ing(5000, -4.5));
    expect(r.confidence).toBe('low');
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons.join(' ')).toMatch(/500 Da/);
  });

  it('MW 900 marca baja confianza', () => {
    expect(checkDomain(ing(900, 3)).confidence).toBe('low');
  });

  it('logP extremo marca confianza reducida', () => {
    expect(checkDomain(ing(300, 8)).confidence).toBe('medium');
  });
});
