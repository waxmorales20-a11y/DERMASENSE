import { describe, it } from 'vitest';
import { simulate } from '../../packages/engine/simulate';
import type { Ingredient, Vehicle } from '../../packages/engine/types';

const cafeina: Ingredient = {
  id: 'caf', name: 'Cafeina', molecularWeight: 194.19, logP: -0.07,
  pka: 10.4, category: 'Estimulante', riskFlags: [],
};
const niacinamida: Ingredient = {
  id: 'nia', name: 'Niacinamida', molecularWeight: 122.12, logP: -0.37,
  pka: 3.35, category: 'Vitamina', riskFlags: [],
};
const retinol: Ingredient = {
  id: 'ret', name: 'Retinol', molecularWeight: 286.45, logP: 5.68,
  category: 'Retinoide', riskFlags: ['retinoid'],
};

const agua: Vehicle = { id: 'v1', name: 'Solucion acuosa', enhancerFactor: 1.0 };
const etanol: Vehicle = { id: 'v2', name: 'Gel hidroalcoholico', enhancerFactor: 1.6 };
const pg: Vehicle = { id: 'v3', name: 'Propilenglicol 30%', enhancerFactor: 1.85 };

function row(ing: Ingredient, veh: Vehicle, pct: number, pH: number) {
  const r = simulate({
    ingredient: ing, vehicle: veh, concentrationPct: pct, pH,
    durationHours: 24, appliedDoseMgCm2: 2.0,
  });
  const m = r.metrics;
  console.log(
    [
      ing.name.padEnd(12),
      veh.name.padEnd(22),
      `${pct}%`.padEnd(6),
      `pH${pH}`.padEnd(6),
      `logKp=${m.logKp.toFixed(2)}`.padEnd(14),
      `lag=${m.lagTimeHours.toFixed(2)}h`.padEnd(12),
      `t50=${m.timeTo50PctHours.toFixed(2)}h`.padEnd(13),
      `abs=${m.absorbedFractionPct.toFixed(1)}%`.padEnd(12),
      `depth=${m.penetrationDepthUm.toFixed(0)}um`.padEnd(15),
      `peakVE=${m.peakConcentrationVE.toFixed(1)}`.padEnd(16),
      `irrit=${m.irritationIndex}(${m.irritationBand})`.padEnd(22),
      `conf=${m.confidence}`,
      `massErr=${(r.massBalance.relativeError * 100).toFixed(3)}%`,
    ].join(' '),
  );
}

describe('scratch', () => {
  it('cafeina y niacinamida', () => {
    console.log('\n=== VEHICULO: efecto sobre metricas ===');
    for (const v of [agua, etanol, pg]) row(cafeina, v, 3, 5.0);
    console.log('');
    for (const v of [agua, etanol, pg]) row(niacinamida, v, 5, 5.0);
    console.log('\n=== pH: efecto sobre metricas ===');
    for (const ph of [3.0, 5.0, 7.0, 9.0]) row(niacinamida, agua, 5, ph);
    console.log('\n=== CONCENTRACION ===');
    for (const c of [0.5, 2, 5, 10]) row(niacinamida, agua, c, 5.0);
    console.log('\n=== Comparativa con retinol (activo con flags) ===');
    row(retinol, agua, 0.3, 5.5);
    row(retinol, etanol, 0.3, 5.5);
  });
});
