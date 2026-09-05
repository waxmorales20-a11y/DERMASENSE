import { create } from 'zustand';
import { simulate, SimulationError } from '@/packages/engine/simulate';
import type { SimulationResult } from '@/packages/engine/types';
import {
  MOCK_INGREDIENTS,
  MOCK_VEHICLES,
  ANATOMICAL_SITES,
  DEFAULT_INGREDIENT,
  DEFAULT_VEHICLE,
  DEFAULT_ANATOMICAL_SITE,
  getIngredientById,
  getVehicleById,
  getSkinModelForSite,
  type CatalogIngredient,
  type CatalogVehicle,
  type AnatomicalSite,
} from '@/lib/mock-catalog';

export type LabStatus = 'idle' | 'configuring' | 'running' | 'ready' | 'failed';
export type ScaleMode = 'proportional' | 'linear';
export type PlaybackSpeed = 1 | 4 | 12;

interface LabState {
  // Input de formulación
  selectedIngredientId: string;
  selectedVehicleId: string;
  selectedSiteId: string;
  concentrationPct: number;
  pH: number;
  durationHours: number;
  appliedDoseMgCm2: number;

  // Estado de simulación
  status: LabStatus;
  result: SimulationResult | null;
  errorMessage: string | null;

  // Control del Timeline y Visor
  currentFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  scaleMode: ScaleMode;
  zoomLevel: number; // 0.0 = Macro Abdomen, 1.0 = Micro Celular

  // Getters auxiliares
  getIngredient: () => CatalogIngredient;
  getVehicle: () => CatalogVehicle;
  getSite: () => AnatomicalSite;

  // Acciones
  setIngredientId: (id: string) => void;
  setVehicleId: (id: string) => void;
  setSiteId: (id: string) => void;
  setConcentrationPct: (val: number) => void;
  setPH: (val: number) => void;
  setDurationHours: (val: number) => void;
  setAppliedDoseMgCm2: (val: number) => void;
  setScaleMode: (mode: ScaleMode) => void;
  setZoomLevel: (level: number | ((prev: number) => number)) => void;
  setCurrentFrameIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlayPause: () => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  runSimulation: () => void;
  resetToDefaults: () => void;
}

// Simulación inicial por defecto para que la app cargue en estado Ready
function getInitialSimulation(): SimulationResult {
  return simulate({
    ingredient: DEFAULT_INGREDIENT,
    vehicle: DEFAULT_VEHICLE,
    concentrationPct: 0.3,
    pH: 5.5,
    durationHours: 24,
    appliedDoseMgCm2: 2.0,
    skinModel: getSkinModelForSite(DEFAULT_ANATOMICAL_SITE.id),
  });
}

const initialResult = getInitialSimulation();

export const useLabStore = create<LabState>((set, get) => ({
  selectedIngredientId: DEFAULT_INGREDIENT.id,
  selectedVehicleId: DEFAULT_VEHICLE.id,
  selectedSiteId: DEFAULT_ANATOMICAL_SITE.id,
  concentrationPct: 0.3,
  pH: 5.5,
  durationHours: 24,
  appliedDoseMgCm2: 2.0,

  status: 'ready',
  result: initialResult,
  errorMessage: null,

  currentFrameIndex: initialResult.frames.length - 1,
  isPlaying: false,
  playbackSpeed: 1,
  scaleMode: 'proportional',
  zoomLevel: 0.0,

  getIngredient: () =>
    getIngredientById(get().selectedIngredientId) ?? DEFAULT_INGREDIENT,

  getVehicle: () =>
    getVehicleById(get().selectedVehicleId) ?? DEFAULT_VEHICLE,

  getSite: () =>
    ANATOMICAL_SITES.find((s) => s.id === get().selectedSiteId) ?? DEFAULT_ANATOMICAL_SITE,

  setIngredientId: (id) => {
    const ing = getIngredientById(id);
    set({
      selectedIngredientId: id,
      // Si el ingrediente tiene una concentración máxima recomendada menor que la actual, adaptarla
      concentrationPct:
        ing?.maxUseConcentration && get().concentrationPct > ing.maxUseConcentration * 2
          ? ing.maxUseConcentration
          : get().concentrationPct,
      status: 'configuring',
    });
  },

  setVehicleId: (id) => set({ selectedVehicleId: id, status: 'configuring' }),
  setSiteId: (id) => set({ selectedSiteId: id, status: 'configuring' }),
  setConcentrationPct: (val) => set({ concentrationPct: val, status: 'configuring' }),
  setPH: (val) => set({ pH: val, status: 'configuring' }),
  setDurationHours: (val) => set({ durationHours: val, status: 'configuring' }),
  setAppliedDoseMgCm2: (val) => set({ appliedDoseMgCm2: val, status: 'configuring' }),

  setScaleMode: (mode) => set({ scaleMode: mode }),
  setZoomLevel: (val) =>
    set((state) => {
      const nextVal = typeof val === 'function' ? val(state.zoomLevel) : val;
      return { zoomLevel: Math.max(0, Math.min(1, nextVal)) };
    }),

  setCurrentFrameIndex: (index) => {
    const framesCount = get().result?.frames.length ?? 0;
    const clamped = Math.max(0, Math.min(index, framesCount - 1));
    set({ currentFrameIndex: clamped });
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  togglePlayPause: () => {
    const isPlaying = get().isPlaying;
    const current = get().currentFrameIndex;
    const framesCount = get().result?.frames.length ?? 0;

    // Si estaba pausado al final del timeline, volver al inicio al dar play
    if (!isPlaying && current >= framesCount - 1) {
      set({ currentFrameIndex: 0, isPlaying: true });
    } else {
      set({ isPlaying: !isPlaying });
    }
  },

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  runSimulation: () => {
    set({ status: 'running', errorMessage: null });

    const state = get();
    const ingredient = getIngredientById(state.selectedIngredientId) ?? DEFAULT_INGREDIENT;
    const vehicle = getVehicleById(state.selectedVehicleId) ?? DEFAULT_VEHICLE;
    const skinModel = getSkinModelForSite(state.selectedSiteId);

    try {
      const result = simulate({
        ingredient,
        vehicle,
        concentrationPct: state.concentrationPct,
        pH: state.pH,
        durationHours: state.durationHours,
        appliedDoseMgCm2: state.appliedDoseMgCm2,
        skinModel,
      });

      set({
        result,
        status: 'ready',
        errorMessage: null,
        currentFrameIndex: result.frames.length - 1, // Ir por defecto al frame final
        isPlaying: false,
      });
    } catch (err) {
      // Preservar el resultado previo si existe (Invariante de APP_FLOW.md §3)
      const message =
        err instanceof SimulationError
          ? err.message
          : 'Ocurrió un error inesperado durante el cálculo numérico.';
      set({
        status: 'failed',
        errorMessage: message,
      });
    }
  },

  resetToDefaults: () => {
    set({
      selectedIngredientId: DEFAULT_INGREDIENT.id,
      selectedVehicleId: DEFAULT_VEHICLE.id,
      selectedSiteId: DEFAULT_ANATOMICAL_SITE.id,
      concentrationPct: 0.3,
      pH: 5.5,
      durationHours: 24,
      appliedDoseMgCm2: 2.0,
      status: 'ready',
      errorMessage: null,
      isPlaying: false,
    });
    get().runSimulation();
  },
}));
