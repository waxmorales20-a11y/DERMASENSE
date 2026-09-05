import type { Ingredient, SimulationInput, Vehicle } from '../../packages/engine/types';

export const salicylicAcid: Ingredient = {
  id: 'sa',
  name: 'Acido salicilico',
  molecularWeight: 138.12,
  logP: 2.26,
  pka: 2.97,
  category: 'BHA',
  riskFlags: ['bha'],
};

export const niacinamide: Ingredient = {
  id: 'nia',
  name: 'Niacinamida',
  molecularWeight: 122.12,
  logP: -0.37,
  category: 'Vitamina',
  riskFlags: [],
};

export const hyaluronicAcid: Ingredient = {
  id: 'ha',
  name: 'Acido hialuronico',
  molecularWeight: 5000,
  logP: -4.5,
  category: 'Humectante',
  riskFlags: [],
};

export const waterVehicle: Vehicle = {
  id: 'aq',
  name: 'Solucion acuosa',
  enhancerFactor: 1.0,
};

export const ethanolVehicle: Vehicle = {
  id: 'eth',
  name: 'Gel hidroalcoholico',
  enhancerFactor: 1.6,
};

export function baseInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    ingredient: salicylicAcid,
    vehicle: waterVehicle,
    concentrationPct: 2,
    pH: 4.8,
    durationHours: 24,
    appliedDoseMgCm2: 2,
    ...overrides,
  };
}
