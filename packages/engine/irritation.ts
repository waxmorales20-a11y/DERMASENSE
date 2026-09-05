import { PH_OPTIMAL_MAX, PH_OPTIMAL_MIN } from './constants';
import type { IrritationBand, RiskFlag } from './types';

const FLAG_WEIGHT: Record<RiskFlag, number> = {
  retinoid: 1.0,
  bha: 0.7,
  aha: 0.8,
  surfactant: 0.9,
  essential_oil: 0.6,
};

export interface IrritationInput {
  peakConcentrationVE: number;
  referenceThreshold: number;
  pH: number;
  riskFlags: RiskFlag[];
  enhancerFactor: number;
}

/**
 * INDICE HEURISTICO, NO VALIDADO EXPERIMENTALMENTE.
 *
 * Agrega factores de riesgo conocidos para ordenar formulaciones entre si.
 * No es una prediccion de seguridad ni sustituye un ensayo de tolerancia.
 * Ver docs/SIMULATION_MODEL.md seccion 5.
 */
export function irritationIndex(input: IrritationInput): number {
  const { peakConcentrationVE, referenceThreshold, pH, riskFlags, enhancerFactor } =
    input;

  // Exposicion en epidermis viable, normalizada de forma logistica.
  const ratio = referenceThreshold > 0 ? peakConcentrationVE / referenceThreshold : 0;
  const fExposure = 1 / (1 + Math.exp(-2.5 * (Math.log10(ratio + 1e-6) + 0.3)));

  // Desviacion respecto al pH fisiologico cutaneo, penalizada de forma cuadratica.
  let phDeviation = 0;
  if (pH < PH_OPTIMAL_MIN) phDeviation = PH_OPTIMAL_MIN - pH;
  else if (pH > PH_OPTIMAL_MAX) phDeviation = pH - PH_OPTIMAL_MAX;
  const fPh = Math.min(1, (phDeviation / 2.5) ** 2);

  // Banderas de clase del ingrediente.
  const fIngredient = Math.min(
    1,
    riskFlags.reduce((acc, f) => acc + (FLAG_WEIGHT[f] ?? 0), 0),
  );

  // Los potenciadores de penetracion aumentan la exposicion efectiva.
  const fVehicle = Math.min(1, Math.max(0, (enhancerFactor - 1) / 1.0));

  const raw = 35 * fExposure + 25 * fPh + 25 * fIngredient + 15 * fVehicle;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function irritationBand(index: number): IrritationBand {
  if (index <= 25) return 'low';
  if (index <= 50) return 'moderate';
  if (index <= 75) return 'high';
  return 'very_high';
}
