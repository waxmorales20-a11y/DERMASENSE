import { NODES_PER_LAYER, UM_PER_CM } from './constants';
import type { LayerProfile, SimulationMesh } from './types';

export interface BuiltMesh extends SimulationMesh {
  /** cm, espaciado uniforme dentro de cada capa */
  spacingCm: Float32Array;
  diffusivity: Float32Array;
  eliminationRate: Float32Array;
  layerStartIndex: number[];
  totalThicknessUm: number;
}

/**
 * Malla no uniforme: cada capa recibe su propio numero de nodos, de modo que
 * el estrato corneo (20 um) queda tan resuelto como la dermis (1800 um).
 * Sin este refinamiento la barrera limitante se representaria con 1-2 nodos.
 */
export function buildMesh(layers: LayerProfile[]): BuiltMesh {
  const counts = layers.map((l) => NODES_PER_LAYER[l.layer] ?? 20);
  const total = counts.reduce((a, b) => a + b, 0);

  const positionsUm = new Float32Array(total);
  const spacingUm = new Float32Array(total);
  const spacingCm = new Float32Array(total);
  const layerIndex = new Uint8Array(total);
  const diffusivity = new Float32Array(total);
  const eliminationRate = new Float32Array(total);
  const layerStartIndex: number[] = [];

  let node = 0;
  let depthUm = 0;

  layers.forEach((layer, li) => {
    layerStartIndex.push(node);
    const n = counts[li];
    const dxUm = layer.thicknessUm / n;

    for (let i = 0; i < n; i++) {
      positionsUm[node] = depthUm + dxUm * (i + 0.5);
      spacingUm[node] = dxUm;
      spacingCm[node] = dxUm / UM_PER_CM;
      layerIndex[node] = li;
      diffusivity[node] = layer.diffusivity;
      eliminationRate[node] = layer.eliminationRate;
      node++;
    }
    depthUm += layer.thicknessUm;
  });

  return {
    positionsUm,
    spacingUm,
    spacingCm,
    layerIndex,
    diffusivity,
    eliminationRate,
    layerStartIndex,
    totalThicknessUm: depthUm,
  };
}
