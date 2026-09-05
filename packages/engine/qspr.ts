import { DOMAIN } from './constants';
import type { Confidence, Ingredient } from './types';

/**
 * Potts & Guy (1992): log Kp = -2.7 + 0.71*logP - 0.0061*MW
 * Kp en cm/h, permeabilidad piel/agua.
 */
export function logKp(molecularWeight: number, logP: number): number {
  return -2.7 + 0.71 * logP - 0.0061 * molecularWeight;
}

export function permeabilityCmH(molecularWeight: number, logP: number): number {
  return Math.pow(10, logKp(molecularWeight, logP));
}

/**
 * Coeficiente de particion estrato corneo / vehiculo: log K = 0.74 * logP.
 * Determina el salto de concentracion en la interfase vehiculo -> SC.
 */
export function partitionCoefficient(logP: number): number {
  return Math.pow(10, 0.74 * logP);
}

/**
 * Difusividad efectiva del estrato corneo derivada de Kp y el espesor.
 * D = Kp * h / K, consistente con el modelo de membrana homogenea.
 * Anclar D a una correlacion publicada evita inventar un valor arbitrario.
 */
export function stratumCorneumDiffusivity(
  molecularWeight: number,
  logP: number,
  thicknessCm: number,
): number {
  const kpCmPerSecond = permeabilityCmH(molecularWeight, logP) / 3600;
  const k = partitionCoefficient(logP);
  return (kpCmPerSecond * thicknessCm) / k;
}

/** Tiempo de retardo: t_lag = h^2 / (6 D), en horas. */
export function lagTimeHours(thicknessCm: number, diffusivity: number): number {
  return (thicknessCm * thicknessCm) / (6 * diffusivity) / 3600;
}

export interface DomainCheck {
  confidence: Confidence;
  reasons: string[];
}

/**
 * El modelo debe reconocer sus propios limites en lugar de inventar un
 * resultado. Ver docs/adr/002-modelo-potts-guy.md.
 */
export function checkDomain(ingredient: Ingredient): DomainCheck {
  const reasons: string[] = [];
  const { molecularWeight: mw, logP } = ingredient;

  if (mw > DOMAIN.maxMolecularWeight) {
    reasons.push(
      `Peso molecular ${mw} g/mol excede el limite de ${DOMAIN.maxMolecularWeight} Da ` +
        `para penetracion cutanea (regla de Bos y Meinardi).`,
    );
  }
  if (logP < DOMAIN.minLogP) {
    reasons.push(
      `logP ${logP} por debajo del dominio de la correlacion Potts-Guy ` +
        `(${DOMAIN.minLogP} a ${DOMAIN.maxLogP}): compuesto muy hidrofilico.`,
    );
  }
  if (logP > DOMAIN.maxLogP) {
    reasons.push(
      `logP ${logP} por encima del dominio de la correlacion Potts-Guy ` +
        `(${DOMAIN.minLogP} a ${DOMAIN.maxLogP}): compuesto muy lipofilico.`,
    );
  }

  let confidence: Confidence = 'high';
  if (reasons.length === 1) confidence = 'medium';
  if (reasons.length > 1) confidence = 'low';
  // Exceder 500 Da invalida el mecanismo de difusion pasiva asumido,
  // no solo reduce la precision.
  if (mw > DOMAIN.maxMolecularWeight) confidence = 'low';

  return { confidence, reasons };
}
