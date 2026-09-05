export type RiskFlag =
  | 'retinoid'
  | 'aha'
  | 'bha'
  | 'surfactant'
  | 'essential_oil';

export type LayerId =
  | 'stratum_corneum'
  | 'viable_epidermis'
  | 'dermis'
  | 'hypodermis';

export interface Ingredient {
  id: string;
  name: string;
  molecularWeight: number;
  logP: number;
  pka?: number;
  category?: string;
  riskFlags: RiskFlag[];
  /** Concentracion de referencia (ug/cm3) usada para normalizar la exposicion. */
  referenceThreshold?: number;
}

export interface Vehicle {
  id: string;
  name: string;
  /** 1.0 = neutro; > 1 potencia la penetracion. */
  enhancerFactor: number;
}

export interface LayerProfile {
  layer: LayerId;
  label: string;
  thicknessUm: number;
  /** cm^2/s */
  diffusivity: number;
  /** 1/s, eliminacion de primer orden */
  eliminationRate: number;
}

export interface SkinModel {
  layers: LayerProfile[];
}

export interface SimulationInput {
  ingredient: Ingredient;
  vehicle: Vehicle;
  concentrationPct: number;
  pH: number;
  durationHours: number;
  appliedDoseMgCm2: number;
  skinModel?: SkinModel;
}

export interface SimulationFrame {
  timeHours: number;
  concentrations: Float32Array;
  vehicleConcentration: number;
}

export type Confidence = 'high' | 'medium' | 'low';
export type IrritationBand = 'low' | 'moderate' | 'high' | 'very_high';

export interface SimulationMetrics {
  logKp: number;
  permeabilityCmH: number;
  /**
   * Flujo maximo teorico bajo dosis infinita (J = Kp * C_vehiculo).
   * NO es un estado estacionario real: con dosis finita el vehiculo se agota
   * antes de alcanzarlo. Sirve como cota superior comparable entre formulas.
   */
  maxFluxInfiniteDose: number;
  lagTimeHours: number;
  absorbedFractionPct: number;
  /** Horas hasta que el 50 % de la dosis cruza el estrato corneo. */
  timeTo50PctHours: number;
  penetrationDepthUm: number;
  peakConcentrationVE: number;
  irritationIndex: number;
  irritationBand: IrritationBand;
  confidence: Confidence;
  outOfDomainReasons: string[];
}

export interface SimulationMesh {
  positionsUm: Float32Array;
  layerIndex: Uint8Array;
  spacingUm: Float32Array;
}

export interface MassBalance {
  appliedUgCm2: number;
  remainingInVehicleUgCm2: number;
  inSkinUgCm2: number;
  eliminatedUgCm2: number;
  throughBaseUgCm2: number;
  relativeError: number;
}

export interface SimulationResult {
  input: SimulationInput;
  mesh: SimulationMesh;
  frames: SimulationFrame[];
  metrics: SimulationMetrics;
  massBalance: MassBalance;
  engineVersion: string;
  computedAt: string;
}
