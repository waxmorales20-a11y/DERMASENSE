import { describe, it, expect } from 'vitest';
import {
  MOCK_INGREDIENTS,
  MOCK_VEHICLES,
  ANATOMICAL_SITES,
  getSkinModelForSite,
  DEFAULT_INGREDIENT,
  DEFAULT_VEHICLE,
} from '@/lib/mock-catalog';
import { simulate } from '@/packages/engine/simulate';

describe('Catálogo Curado Mock (lib/mock-catalog.ts)', () => {
  it('contiene exactamente los 5 ingredientes curados', () => {
    // Se recortó de 12 a 5 conservando los mejor sostenidos por evidencia:
    // permeabilidad medida, límite regulatorio real y error local estimable.
    // El ácido hialurónico se mantiene como caso deliberado fuera de dominio.
    expect(MOCK_INGREDIENTS).toHaveLength(5);
    for (const ing of MOCK_INGREDIENTS) {
      expect(ing.id).toBeTruthy();
      expect(ing.name).toBeTruthy();
      expect(ing.molecularWeight).toBeGreaterThan(0);
      expect(typeof ing.logP).toBe('number');
      expect(Array.isArray(ing.riskFlags)).toBe(true);
      expect(ing.source).toBeTruthy();
      expect(ing.dataLevel).toBeDefined();
    }
  });

  it('contiene exactamente los 6 vehículos requeridos', () => {
    expect(MOCK_VEHICLES).toHaveLength(6);
    for (const veh of MOCK_VEHICLES) {
      expect(veh.id).toBeTruthy();
      expect(veh.name).toBeTruthy();
      expect(veh.enhancerFactor).toBeGreaterThan(0);
      expect(veh.description).toBeTruthy();
    }
  });

  it('incluye modelos de piel por sitio anatómico con Abdomen como default', () => {
    expect(ANATOMICAL_SITES.length).toBeGreaterThanOrEqual(6);
    const defaultSite = ANATOMICAL_SITES.find((s) => s.isDefault);
    expect(defaultSite).toBeDefined();
    expect(defaultSite?.id).toBe('abdomen');

    const abdomenModel = getSkinModelForSite('abdomen');
    expect(abdomenModel.layers).toHaveLength(4);
    expect(abdomenModel.layers[0].thicknessUm).toBe(16);
  });

  it('permite simular con el activo y vehículo por defecto (Retinol 0.3% en Emulsión O/W)', () => {
    const result = simulate({
      ingredient: DEFAULT_INGREDIENT,
      vehicle: DEFAULT_VEHICLE,
      concentrationPct: 0.3,
      pH: 5.5,
      durationHours: 24,
      appliedDoseMgCm2: 2.0,
      skinModel: getSkinModelForSite('abdomen'),
    });

    expect(result.metrics).toBeDefined();
    expect(result.metrics.confidence).toBe('high');
    expect(result.metrics.irritationBand).toBeDefined();
    expect(result.frames.length).toBeGreaterThan(0);
  });

  it('detecta correctamente fuera de dominio con ácido hialurónico 5 kDa', () => {
    const ha = MOCK_INGREDIENTS.find((i) => i.id === 'hyaluronic-acid-5k');
    expect(ha).toBeDefined();
    if (!ha) return;

    const result = simulate({
      ingredient: ha,
      vehicle: DEFAULT_VEHICLE,
      concentrationPct: 1.0,
      pH: 5.5,
      durationHours: 24,
      appliedDoseMgCm2: 2.0,
    });

    expect(result.metrics.confidence).toBe('low');
    expect(result.metrics.outOfDomainReasons.some((r) => r.includes('500 Da'))).toBe(true);
  });
});
