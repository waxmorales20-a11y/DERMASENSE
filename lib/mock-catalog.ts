import type {
  Ingredient as EngineIngredient,
  Vehicle as EngineVehicle,
  SkinModel,
  LayerProfile,
  RiskFlag,
} from '@/packages/engine/types';

export type DataLevel = 'verified' | 'literature' | 'estimated' | 'heuristic';

export interface CatalogIngredient extends EngineIngredient {
  inciName: string;
  category: string;
  source: string;
  dataLevel: DataLevel;
  maxUseConcentration?: number; // % p/p límite regulatorio habitual
  regulationRef?: string;
  description: string;
}

export interface CatalogVehicle extends EngineVehicle {
  description: string;
  dataLevel: DataLevel;
  usageContext: string;
}

export interface AnatomicalSite {
  id: string;
  name: string;
  label: string;
  description: string;
  dataLevel: DataLevel;
  isDefault?: boolean;
  caveat?: string;
  layers: LayerProfile[];
}

/**
 * Catálogo curado de 5 ingredientes activos.
 *
 * La selección NO es arbitraria: se ordenó el catálogo completo por calidad de
 * evidencia disponible en el backend (permeabilidad medida, cobertura
 * regulatoria real, y si hay compuestos medidos parecidos con los que estimar
 * el error del modelo) y se conservaron los mejor sostenidos.
 *
 *   · Ácido salicílico  — único con permeabilidad MEDIDA en el conjunto de
 *                         validación (error del modelo 0.34 unidades log) y
 *                         límite legal en el Anexo III del Reg. (CE) 1223/2009.
 *   · Retinol           — límite legal (Reg. UE 2024/996). El modelo predice
 *                         mal en su vecindario (error local 2.19): el panel de
 *                         evidencia lo declara en lugar de ocultarlo.
 *   · Ácido kójico      — límite legal (Reg. UE 2024/996) y error local 0.38.
 *   · Niacinamida       — error local 0.38, el más estrecho del catálogo.
 *   · Ácido hialurónico — incluido A PROPÓSITO como caso fuera de dominio:
 *                         5 kDa excede los 500 Da y dispara confidence 'low'.
 *                         Demuestra que el sistema reconoce sus propios límites.
 *
 * Datos fisicoquímicos de PubChem (docs/DATA_SOURCES.md §3). El backend expone
 * el mismo catálogo en GET /api/v1/ingredients con procedencia por campo.
 */
export const MOCK_INGREDIENTS: CatalogIngredient[] = [
  {
    id: 'retinol',
    name: 'Retinol',
    inciName: 'Retinol',
    molecularWeight: 286.45,
    logP: 5.68,
    category: 'Retinoide',
    riskFlags: ['retinoid'],
    source: 'PubChem CID 445354',
    dataLevel: 'verified',
    maxUseConcentration: 0.3,
    regulationRef: 'Reg. (UE) 2024/996 (límite 0.3% en productos faciales)',
    description:
      'Forma activa de vitamina A; alta afinidad lipídica en estrato córneo con acumulación y lenta liberación sostenida.',
  },
  {
    id: 'salicylic-acid',
    name: 'Ácido salicílico',
    inciName: 'Salicylic Acid',
    molecularWeight: 138.12,
    logP: 2.26,
    pka: 2.97,
    category: 'BHA',
    riskFlags: ['bha'],
    source: 'PubChem CID 338',
    dataLevel: 'verified',
    maxUseConcentration: 2.0,
    regulationRef: 'Reg. (CE) 1223/2009 Anexo III',
    description:
      'Beta-hidroxiácido lipófilo con permeación transepidérmica y acción queratolítica folicular.',
  },
  {
    id: 'kojic-acid',
    name: 'Ácido kójico',
    inciName: 'Kojic Acid',
    molecularWeight: 142.11,
    logP: -0.64,
    pka: 7.9,
    category: 'Despigmentante',
    riskFlags: [],
    source: 'PubChem CID 3840',
    dataLevel: 'verified',
    maxUseConcentration: 1.0,
    regulationRef: 'Opinión SCCS/1641/22',
    description:
      'Inhibidor de tirosinasa con moderada hidrofilicidad y restricción de concentración por perfil toxicológico.',
  },
  {
    id: 'niacinamide',
    name: 'Niacinamida',
    inciName: 'Niacinamide',
    molecularWeight: 122.12,
    logP: -0.37,
    pka: 3.35,
    category: 'Vitamina',
    riskFlags: [],
    source: 'PubChem CID 936',
    dataLevel: 'verified',
    maxUseConcentration: 5.0,
    regulationRef: 'Literatura dermatológica clínica',
    description:
      'Vitamina B3 soluble en agua; refuerza la síntesis de ceramidas cutáneas y posee óptima tolerancia.',
  },
  {
    id: 'hyaluronic-acid-5k',
    name: 'Ácido hialurónico (5 kDa)',
    inciName: 'Sodium Hyaluronate',
    molecularWeight: 5000.0,
    logP: -4.5,
    category: 'Humectante',
    riskFlags: [],
    source: 'Polímero sintético/biotecnológico',
    dataLevel: 'literature',
    maxUseConcentration: 2.0,
    description:
      'Caso de prueba deliberado fuera de dominio (MW 5000 > 500 Da) para comprobar transparencia y baja confianza del modelo.',
  },
];

/**
 * Catálogo de 6 vehículos representativos con sus factores potenciadores
 * (ver docs/BACKEND_SCHEMA.md §5 y docs/DATA_SOURCES.md §6).
 */
export const MOCK_VEHICLES: CatalogVehicle[] = [
  {
    id: 'aqueous',
    name: 'Solución acuosa',
    enhancerFactor: 1.0,
    description: 'Referencia neutra sin promotores de penetración.',
    dataLevel: 'literature',
    usageContext: 'Tónicos, esencias acuosas ligeras y soluciones acuosas de control.',
  },
  {
    id: 'hydroalcoholic',
    name: 'Gel hidroalcohólico',
    enhancerFactor: 1.6,
    description: 'Etanol como acelerador por desorganización transitoria de lípidos del SC.',
    dataLevel: 'literature',
    usageContext: 'Geles purificantes y formulaciones de absorción rápida.',
  },
  {
    id: 'emulsion-ow',
    name: 'Emulsión O/W',
    enhancerFactor: 1.15,
    description: 'Fase continua acuosa con micelas lipídicas; crema cosmética estándar.',
    dataLevel: 'literature',
    usageContext: 'Cremas hidratantes diarias, emulsiones fluidas y serums cremosos.',
  },
  {
    id: 'emulsion-wo',
    name: 'Emulsión W/O',
    enhancerFactor: 0.85,
    description: 'Fase externa oleosa oclusiva; liberación sostenida y más lenta.',
    dataLevel: 'literature',
    usageContext: 'Cremas nutritivas de noche y preparados de alta protección de barrera.',
  },
  {
    id: 'anhydrous',
    name: 'Base anhidra',
    enhancerFactor: 0.7,
    description: 'Ungüento lipídico oclusivo libre de agua; retarda el flujo transepidérmico.',
    dataLevel: 'literature',
    usageContext: 'Bálsamos labiales, pomadas de barrera y ungüentos cicatrizantes.',
  },
  {
    id: 'propylene-glycol',
    name: 'Propilenglicol 30%',
    enhancerFactor: 1.85,
    description: 'Cosolvente higroscópico con incremento marcado de partición en estrato córneo.',
    dataLevel: 'literature',
    usageContext: 'Vehículos cosmecéuticos avanzados de penetración intensiva.',
  },
];

/**
 * Modelos de piel humana por sitio anatómico (ver docs/DATA_SOURCES.md §4).
 * El estrato córneo varía drásticamente según la zona corporal.
 */
export const ANATOMICAL_SITES: AnatomicalSite[] = [
  {
    id: 'abdomen',
    name: 'Abdomen',
    label: 'Abdomen (Estándar I+D)',
    description: 'Sitio anatómico estándar por defecto. Típico en ensayos ex vivo con piel de reducción abdominal.',
    dataLevel: 'literature',
    isDefault: true,
    layers: [
      {
        layer: 'stratum_corneum',
        label: 'Estrato córneo',
        thicknessUm: 16,
        diffusivity: 1.0e-10,
        eliminationRate: 0,
      },
      {
        layer: 'viable_epidermis',
        label: 'Epidermis viable',
        thicknessUm: 65,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
      {
        layer: 'dermis',
        label: 'Dermis',
        thicknessUm: 1800,
        diffusivity: 5.0e-7,
        eliminationRate: 1.0e-3,
      },
      {
        layer: 'hypodermis',
        label: 'Hipodermis',
        thicknessUm: 1200,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
    ],
  },
  {
    id: 'volar_forearm',
    name: 'Antebrazo (volar)',
    label: 'Antebrazo volar',
    description: 'Sitio de referencia en la literatura in vitro y en el dataset experimental de Flynn (1990).',
    dataLevel: 'literature',
    layers: [
      {
        layer: 'stratum_corneum',
        label: 'Estrato córneo',
        thicknessUm: 18,
        diffusivity: 1.0e-10,
        eliminationRate: 0,
      },
      {
        layer: 'viable_epidermis',
        label: 'Epidermis viable',
        thicknessUm: 70,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
      {
        layer: 'dermis',
        label: 'Dermis',
        thicknessUm: 1200,
        diffusivity: 5.0e-7,
        eliminationRate: 1.0e-3,
      },
      {
        layer: 'hypodermis',
        label: 'Hipodermis',
        thicknessUm: 1000,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
    ],
  },
  {
    id: 'cheek',
    name: 'Rostro (mejilla)',
    label: 'Rostro (mejilla)',
    description: 'Barrera cutánea más delgada con mayor permeabilidad y sensibilidad cosmética.',
    dataLevel: 'literature',
    caveat: 'Estrato córneo delgado: la velocidad de penetración y el riesgo de irritación aumentan.',
    layers: [
      {
        layer: 'stratum_corneum',
        label: 'Estrato córneo',
        thicknessUm: 12,
        diffusivity: 1.0e-10,
        eliminationRate: 0,
      },
      {
        layer: 'viable_epidermis',
        label: 'Epidermis viable',
        thicknessUm: 50,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
      {
        layer: 'dermis',
        label: 'Dermis',
        thicknessUm: 1000,
        diffusivity: 5.0e-7,
        eliminationRate: 1.0e-3,
      },
      {
        layer: 'hypodermis',
        label: 'Hipodermis',
        thicknessUm: 800,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
    ],
  },
  {
    id: 'forehead',
    name: 'Frente',
    label: 'Frente',
    description: 'Zona de alta secreción sebácea y moderado espesor de barrera.',
    dataLevel: 'literature',
    caveat: 'El sebo natural cutáneo puede alterar la partición de moléculas altamente lipófilas.',
    layers: [
      {
        layer: 'stratum_corneum',
        label: 'Estrato córneo',
        thicknessUm: 14,
        diffusivity: 1.0e-10,
        eliminationRate: 0,
      },
      {
        layer: 'viable_epidermis',
        label: 'Epidermis viable',
        thicknessUm: 60,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
      {
        layer: 'dermis',
        label: 'Dermis',
        thicknessUm: 1200,
        diffusivity: 5.0e-7,
        eliminationRate: 1.0e-3,
      },
      {
        layer: 'hypodermis',
        label: 'Hipodermis',
        thicknessUm: 800,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
    ],
  },
  {
    id: 'scalp',
    name: 'Cuero cabelludo',
    label: 'Cuero cabelludo',
    description: 'Densidad folicular muy alta.',
    dataLevel: 'literature',
    caveat: 'Alta densidad folicular: la vía anexial, que el modelo de difusión no simula, puede acelerar la absorción temprana en la práctica.',
    layers: [
      {
        layer: 'stratum_corneum',
        label: 'Estrato córneo',
        thicknessUm: 18,
        diffusivity: 1.0e-10,
        eliminationRate: 0,
      },
      {
        layer: 'viable_epidermis',
        label: 'Epidermis viable',
        thicknessUm: 60,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
      {
        layer: 'dermis',
        label: 'Dermis',
        thicknessUm: 1500,
        diffusivity: 5.0e-7,
        eliminationRate: 1.0e-3,
      },
      {
        layer: 'hypodermis',
        label: 'Hipodermis',
        thicknessUm: 1000,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
    ],
  },
  {
    id: 'palm_sole',
    name: 'Palma / Planta',
    label: 'Palma / Planta',
    description: 'Barrera hiperqueratinizada extrema.',
    dataLevel: 'literature',
    caveat: 'Estrato córneo engrosado: caso límite donde la penetración transdérmica es mínima.',
    layers: [
      {
        layer: 'stratum_corneum',
        label: 'Estrato córneo',
        thicknessUm: 450,
        diffusivity: 1.0e-10,
        eliminationRate: 0,
      },
      {
        layer: 'viable_epidermis',
        label: 'Epidermis viable',
        thicknessUm: 350,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
      {
        layer: 'dermis',
        label: 'Dermis',
        thicknessUm: 1800,
        diffusivity: 5.0e-7,
        eliminationRate: 1.0e-3,
      },
      {
        layer: 'hypodermis',
        label: 'Hipodermis',
        thicknessUm: 1200,
        diffusivity: 1.0e-7,
        eliminationRate: 0,
      },
    ],
  },
];

// Valores por defecto para el laboratorio inicial (según docs/APP_FLOW.md §6 y docs/DATA_SOURCES.md §4.2)
export const DEFAULT_INGREDIENT = MOCK_INGREDIENTS[0]; // Retinol
export const DEFAULT_VEHICLE = MOCK_VEHICLES[2]; // Emulsión O/W
export const DEFAULT_ANATOMICAL_SITE = ANATOMICAL_SITES[0]; // Abdomen

export function getIngredientById(id: string): CatalogIngredient | undefined {
  return MOCK_INGREDIENTS.find((item) => item.id === id);
}

export function getVehicleById(id: string): CatalogVehicle | undefined {
  return MOCK_VEHICLES.find((item) => item.id === id);
}

export function getAnatomicalSiteById(id: string): AnatomicalSite | undefined {
  return ANATOMICAL_SITES.find((item) => item.id === id);
}

export function getSkinModelForSite(siteId: string): SkinModel {
  const site = getAnatomicalSiteById(siteId) ?? DEFAULT_ANATOMICAL_SITE;
  return {
    layers: site.layers,
  };
}
