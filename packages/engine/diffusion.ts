import { CFL_SAFETY, OUTPUT_FRAMES, SECONDS_PER_HOUR } from './constants';
import type { BuiltMesh } from './mesh';
import type { MassBalance, SimulationFrame } from './types';

export interface SolverConfig {
  mesh: BuiltMesh;
  /** Coeficiente de particion capa/vehiculo, por capa. */
  layerPartition: number[];
  /** Espesor de la pelicula de vehiculo (cm). */
  vehicleThicknessCm: number;
  /** Concentracion inicial del activo en el vehiculo (ug/cm3). */
  initialVehicleConcentration: number;
  durationHours: number;
}

export interface SolverOutput {
  frames: SimulationFrame[];
  massBalance: MassBalance;
  /** Masa acumulada que cruzo la interfase SC / epidermis viable (ug/cm2). */
  crossedStratumCorneum: number;
  /** Horas hasta que la mitad de la dosis aplicada cruza el estrato corneo. */
  timeTo50PctHours: number;
  peakConcentrationVE: number;
  timeStepSeconds: number;
  steps: number;
}

/**
 * Resuelve la 2a ley de Fick en un medio multicapa mediante volumenes finitos
 * explicitos.
 *
 * Se trabaja con la actividad a = C / K en lugar de la concentracion: el
 * equilibrio en cada interfase exige continuidad del potencial quimico
 * (C_i/K_i = C_j/K_j), no de la concentracion, que es discontinua. Formularlo
 * asi hace que el esquema conserve masa por construccion.
 */
export function solve(config: SolverConfig): SolverOutput {
  const {
    mesh,
    layerPartition,
    vehicleThicknessCm,
    initialVehicleConcentration,
    durationHours,
  } = config;

  const n = mesh.positionsUm.length;
  const dx = mesh.spacingCm;

  // Permeabilidad del volumen de control: P = D * K
  const P = new Float64Array(n);
  const K = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    K[j] = layerPartition[mesh.layerIndex[j]];
    P[j] = mesh.diffusivity[j] * K[j];
  }

  // Resistencias entre volumenes contiguos (serie de medias semiceldas).
  // R[j] separa el nodo j-1 del nodo j; R[0] separa el vehiculo del nodo 0.
  const R = new Float64Array(n + 1);
  R[0] = dx[0] / (2 * P[0]);
  for (let j = 1; j < n; j++) {
    R[j] = dx[j - 1] / (2 * P[j - 1]) + dx[j] / (2 * P[j]);
  }
  R[n] = dx[n - 1] / (2 * P[n - 1]); // sumidero perfecto en la base

  // Paso temporal por estabilidad (CFL de difusion con margen de seguridad).
  let maxRate = 0;
  for (let j = 0; j < n; j++) {
    const gLeft = 1 / R[j];
    const gRight = 1 / R[j + 1];
    const rate = (gLeft + gRight) / (dx[j] * K[j]) + mesh.eliminationRate[j];
    if (rate > maxRate) maxRate = rate;
  }
  const dt = CFL_SAFETY / maxRate;

  const totalSeconds = durationHours * SECONDS_PER_HOUR;
  const steps = Math.max(1, Math.ceil(totalSeconds / dt));
  const dtActual = totalSeconds / steps;

  const C = new Float64Array(n);
  const flux = new Float64Array(n + 1);
  let vehicleC = initialVehicleConcentration;

  const appliedUgCm2 = initialVehicleConcentration * vehicleThicknessCm;
  let eliminated = 0;
  let throughBase = 0;
  let crossedSC = 0;
  let peakVE = 0;
  let timeTo50 = Number.NaN;
  const halfDose = 0.5 * appliedUgCm2;

  // Indice de la primera interfase fuera del estrato corneo.
  const scEndInterface = mesh.layerStartIndex[1];
  const veStart = mesh.layerStartIndex[1];
  const veEnd = mesh.layerStartIndex[2];

  const frames: SimulationFrame[] = [];
  const frameEvery = Math.max(1, Math.floor(steps / (OUTPUT_FRAMES - 1)));

  const pushFrame = (step: number) => {
    frames.push({
      timeHours: (step * dtActual) / SECONDS_PER_HOUR,
      concentrations: Float32Array.from(C),
      vehicleConcentration: vehicleC,
    });
  };

  pushFrame(0);

  for (let step = 1; step <= steps; step++) {
    // Flujos en las interfases, positivos hacia el interior de la piel.
    flux[0] = (vehicleC - C[0] / K[0]) / R[0];
    for (let j = 1; j < n; j++) {
      flux[j] = (C[j - 1] / K[j - 1] - C[j] / K[j]) / R[j];
    }
    flux[n] = C[n - 1] / K[n - 1] / R[n];

    // Actualizacion de los volumenes de control.
    for (let j = 0; j < n; j++) {
      const net = flux[j] - flux[j + 1];
      const loss = mesh.eliminationRate[j] * C[j];
      eliminated += loss * dx[j] * dtActual;
      C[j] += (net / dx[j] - loss) * dtActual;
      if (C[j] < 0) C[j] = 0;
    }

    // Dosis finita: el vehiculo se agota conforme el activo penetra.
    vehicleC -= (flux[0] * dtActual) / vehicleThicknessCm;
    if (vehicleC < 0) vehicleC = 0;

    throughBase += flux[n] * dtActual;
    crossedSC += flux[scEndInterface] * dtActual;
    if (Number.isNaN(timeTo50) && crossedSC >= halfDose) {
      timeTo50 = (step * dtActual) / SECONDS_PER_HOUR;
    }

    for (let j = veStart; j < veEnd; j++) {
      if (C[j] > peakVE) peakVE = C[j];
    }

    if (step % frameEvery === 0 || step === steps) pushFrame(step);
  }

  let inSkin = 0;
  for (let j = 0; j < n; j++) inSkin += C[j] * dx[j];

  const remaining = vehicleC * vehicleThicknessCm;
  const accounted = remaining + inSkin + eliminated + throughBase;
  const relativeError =
    appliedUgCm2 > 0 ? Math.abs(accounted - appliedUgCm2) / appliedUgCm2 : 0;

  return {
    frames,
    massBalance: {
      appliedUgCm2,
      remainingInVehicleUgCm2: remaining,
      inSkinUgCm2: inSkin,
      eliminatedUgCm2: eliminated,
      throughBaseUgCm2: throughBase,
      relativeError,
    },
    crossedStratumCorneum: crossedSC,
    timeTo50PctHours: timeTo50,
    peakConcentrationVE: peakVE,
    timeStepSeconds: dtActual,
    steps,
  };
}
