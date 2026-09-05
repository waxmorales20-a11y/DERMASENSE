import { DEFAULT_SKIN_MODEL, ENGINE_VERSION, UM_PER_CM } from './constants';
import { solve } from './diffusion';
import { irritationBand, irritationIndex } from './irritation';
import { buildMesh } from './mesh';
import {
  checkDomain,
  lagTimeHours,
  logKp,
  partitionCoefficient,
  permeabilityCmH,
  stratumCorneumDiffusivity,
} from './qspr';
import type { SimulationInput, SimulationResult } from './types';

/** Densidad asumida del vehiculo (g/cm3) para convertir dosis a espesor de pelicula. */
const VEHICLE_DENSITY = 1.0;

/** Cota superior para magnitudes temporales derivadas ("no ocurre en escala util"). */
const MAX_REPORTED_HOURS = 9999;

export class SimulationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimulationError';
  }
}

function validate(input: SimulationInput): void {
  const { concentrationPct, pH, durationHours, appliedDoseMgCm2, ingredient } = input;

  if (!Number.isFinite(concentrationPct) || concentrationPct <= 0 || concentrationPct > 30) {
    throw new SimulationError('La concentracion debe estar entre 0 y 30 % p/p.');
  }
  if (!Number.isFinite(pH) || pH < 3 || pH > 9) {
    throw new SimulationError('El pH debe estar entre 3.0 y 9.0.');
  }
  if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 48) {
    throw new SimulationError('La duracion debe estar entre 0 y 48 horas.');
  }
  if (!Number.isFinite(appliedDoseMgCm2) || appliedDoseMgCm2 <= 0) {
    throw new SimulationError('La dosis aplicada debe ser mayor que cero.');
  }
  if (!Number.isFinite(ingredient.molecularWeight) || ingredient.molecularWeight <= 0) {
    throw new SimulationError('El peso molecular debe ser mayor que cero.');
  }
  if (!Number.isFinite(ingredient.logP)) {
    throw new SimulationError('El logP del ingrediente no es un numero valido.');
  }
}

/**
 * Motor determinista: los mismos parametros de entrada producen siempre el
 * mismo resultado. Por eso solo se persiste el input y la version del motor.
 */
export function simulate(input: SimulationInput): SimulationResult {
  validate(input);

  const { ingredient, vehicle, concentrationPct, pH, durationHours, appliedDoseMgCm2 } =
    input;
  const skin = input.skinModel ?? DEFAULT_SKIN_MODEL;

  const mesh = buildMesh(skin.layers);
  const scThicknessCm = skin.layers[0].thicknessUm / UM_PER_CM;

  // El potenciador de penetracion se modela como un aumento de la difusividad
  // del estrato corneo. Es una simplificacion empirica declarada, no fisica.
  const baseDsc = stratumCorneumDiffusivity(
    ingredient.molecularWeight,
    ingredient.logP,
    scThicknessCm,
  );
  const dSc = baseDsc * vehicle.enhancerFactor;

  const scStart = mesh.layerStartIndex[0];
  const scEnd = mesh.layerStartIndex[1];
  for (let j = scStart; j < scEnd; j++) mesh.diffusivity[j] = dSc;

  const kLipophilic = partitionCoefficient(ingredient.logP);
  const layerPartition = [kLipophilic, 1, 1, kLipophilic];

  // Dosis finita: 2 mg/cm2 de producto forman una pelicula de ~20 um.
  const vehicleThicknessCm = (appliedDoseMgCm2 * 1e-3) / VEHICLE_DENSITY;
  const activeMassUgCm2 = appliedDoseMgCm2 * 1000 * (concentrationPct / 100);
  const initialVehicleConcentration = activeMassUgCm2 / vehicleThicknessCm;

  const output = solve({
    mesh,
    layerPartition,
    vehicleThicknessCm,
    initialVehicleConcentration,
    durationHours,
  });

  const domain = checkDomain(ingredient);
  const kp = permeabilityCmH(ingredient.molecularWeight, ingredient.logP);

  const finalFrame = output.frames[output.frames.length - 1];
  const penetrationDepthUm = computePenetrationDepth(
    finalFrame.concentrations,
    mesh.positionsUm,
    mesh.layerIndex,
    layerPartition,
  );

  const index = irritationIndex({
    peakConcentrationVE: output.peakConcentrationVE,
    referenceThreshold: ingredient.referenceThreshold ?? initialVehicleConcentration * 0.05,
    pH,
    riskFlags: ingredient.riskFlags,
    enhancerFactor: vehicle.enhancerFactor,
  });

  // Fuera del dominio de aplicabilidad las magnitudes derivadas pierden
  // sentido fisico (un lag time de 1e29 h no informa a nadie). Se acotan a un
  // sentinel legible y la baja confianza queda registrada en las razones.
  const rawLag = lagTimeHours(scThicknessCm, dSc);
  const lag = Number.isFinite(rawLag) ? Math.min(rawLag, MAX_REPORTED_HOURS) : MAX_REPORTED_HOURS;

  const rawT50 = output.timeTo50PctHours;
  const t50 = Number.isFinite(rawT50) ? rawT50 : MAX_REPORTED_HOURS;

  return {
    input,
    mesh: {
      positionsUm: mesh.positionsUm,
      layerIndex: mesh.layerIndex,
      spacingUm: mesh.spacingUm,
    },
    frames: output.frames,
    metrics: {
      logKp: logKp(ingredient.molecularWeight, ingredient.logP),
      permeabilityCmH: kp,
      maxFluxInfiniteDose: kp * initialVehicleConcentration * vehicle.enhancerFactor,
      lagTimeHours: lag,
      absorbedFractionPct:
        activeMassUgCm2 > 0 ? (output.crossedStratumCorneum / activeMassUgCm2) * 100 : 0,
      timeTo50PctHours: t50,
      penetrationDepthUm,
      peakConcentrationVE: output.peakConcentrationVE,
      irritationIndex: index,
      irritationBand: irritationBand(index),
      confidence: domain.confidence,
      outOfDomainReasons: domain.reasons,
    },
    massBalance: output.massBalance,
    engineVersion: ENGINE_VERSION,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Profundidad a la que la senal cae al 5 % de su maximo.
 *
 * Se evalua sobre la actividad (C / K) y no sobre la concentracion bruta: la
 * concentracion salta en cada interfase por el coeficiente de particion, asi
 * que un activo lipofilico daria siempre la frontera del estrato corneo como
 * "profundidad", que es un artefacto y no un resultado.
 */
function computePenetrationDepth(
  concentrations: Float32Array,
  positionsUm: Float32Array,
  layerIndex: Uint8Array,
  layerPartition: number[],
): number {
  const n = concentrations.length;
  const activity = new Float64Array(n);
  let max = 0;
  for (let j = 0; j < n; j++) {
    activity[j] = concentrations[j] / layerPartition[layerIndex[j]];
    if (activity[j] > max) max = activity[j];
  }
  if (max <= 0) return 0;

  const threshold = 0.05 * max;
  let depth = 0;
  for (let j = 0; j < n; j++) {
    if (activity[j] >= threshold) depth = positionsUm[j];
  }
  return depth;
}
