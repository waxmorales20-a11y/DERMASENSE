import type { LayerProfile, SkinModel } from './types';

export const ENGINE_VERSION = '1.0.0';

/**
 * Espesores y difusividades de referencia bibliografica para piel humana sana.
 * Ver docs/SIMULATION_MODEL.md seccion 1.
 */
export const DEFAULT_LAYERS: LayerProfile[] = [
  {
    layer: 'stratum_corneum',
    label: 'Estrato corneo',
    thicknessUm: 20,
    diffusivity: 1.0e-10,
    eliminationRate: 0,
  },
  {
    layer: 'viable_epidermis',
    label: 'Epidermis viable',
    thicknessUm: 80,
    diffusivity: 1.0e-7,
    eliminationRate: 0,
  },
  {
    layer: 'dermis',
    label: 'Dermis',
    thicknessUm: 1800,
    diffusivity: 5.0e-7,
    // Clearance por microcirculacion capilar: el sumidero fisiologico
    // que impide acumulacion indefinida.
    eliminationRate: 1.0e-3,
  },
  {
    layer: 'hypodermis',
    label: 'Hipodermis',
    thicknessUm: 1200,
    diffusivity: 1.0e-7,
    eliminationRate: 0,
  },
];

export const DEFAULT_SKIN_MODEL: SkinModel = { layers: DEFAULT_LAYERS };

/** Dominio de aplicabilidad de la correlacion Potts-Guy. */
export const DOMAIN = {
  maxMolecularWeight: 500,
  minLogP: -1,
  maxLogP: 6,
} as const;

/** Margen de seguridad sobre la condicion CFL de difusion. */
export const CFL_SAFETY = 0.4;

/** Numero de nodos por capa (el estrato corneo va refinado). */
export const NODES_PER_LAYER: Record<string, number> = {
  // El SC va refinado: es la barrera limitante y solo mide 20 um.
  stratum_corneum: 40,
  viable_epidermis: 20,
  dermis: 30,
  hypodermis: 15,
};

/** Frames guardados por simulacion (submuestreo para mantener memoria acotada). */
export const OUTPUT_FRAMES = 60;

/** pH fisiologico cutaneo. */
export const PH_OPTIMAL_MIN = 4.5;
export const PH_OPTIMAL_MAX = 5.5;

export const SECONDS_PER_HOUR = 3600;
export const UM_PER_CM = 10_000;
