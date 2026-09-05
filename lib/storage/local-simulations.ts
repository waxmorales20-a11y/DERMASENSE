import type { SimulationInput, SimulationMetrics } from '@/packages/engine/types';

export interface SavedSimulationItem {
  id: string;
  title: string;
  createdAt: string;
  concentrationPct: number;
  ingredientName: string;
  vehicleName: string;
  input: SimulationInput;
  metrics: SimulationMetrics;
  engineVersion: string;
  hasReport?: boolean;
}

const STORAGE_KEY = 'dermasense_simulations_v1';

export function getLocalSimulations(): SavedSimulationItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getLocalSimulationById(id: string): SavedSimulationItem | undefined {
  const items = getLocalSimulations();
  return items.find((item) => item.id === id);
}

export function saveLocalSimulation(payload: {
  input: SimulationInput;
  metrics: SimulationMetrics;
  title?: string;
  engineVersion?: string;
}): SavedSimulationItem {
  const items = getLocalSimulations();

  const title =
    payload.title ||
    `${payload.input.ingredient.name} ${payload.input.concentrationPct}% en ${payload.input.vehicle.name}`;

  const newItem: SavedSimulationItem = {
    id: `sim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    createdAt: new Date().toISOString(),
    concentrationPct: payload.input.concentrationPct,
    ingredientName: payload.input.ingredient.name,
    vehicleName: payload.input.vehicle.name,
    input: payload.input,
    metrics: payload.metrics,
    engineVersion: payload.engineVersion || '1.0.0',
    hasReport: false,
  };

  // Guardar en cabeza del array (más recientes primero)
  const updated = [newItem, ...items.filter((i) => i.id !== newItem.id)];

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('No se pudo persistir en localStorage:', e);
    }
  }

  return newItem;
}

export function deleteLocalSimulation(id: string): boolean {
  if (typeof window === 'undefined') return false;

  const items = getLocalSimulations();
  const filtered = items.filter((item) => item.id !== id);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}
