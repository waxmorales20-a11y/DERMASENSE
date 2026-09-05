import * as BABYLON from '@babylonjs/core';

/**
 * Malla paramétrica del torso humano.
 *
 * No es una esfera deformada: se construye anillo a anillo a partir del perfil
 * anatómico real (tórax ancho, cintura estrecha, caderas anchas) y con sección
 * transversal de superelipse, que es lo que da la silueta aplanada de un abdomen
 * en lugar de un óvalo.
 */

/** Perfil del cuerpo: v va de 0 (arriba, bajo el pecho) a 1 (abajo, pelvis). */
interface ProfileKey {
  v: number;
  /** Semiancho lateral. */
  halfWidth: number;
  /** Semiprofundidad (espesor de delante hacia atrás). */
  halfDepth: number;
}

const PROFILE: ProfileKey[] = [
  { v: 0.0, halfWidth: 0.66, halfDepth: 0.42 }, // corte superior, bajo el pecho
  { v: 0.12, halfWidth: 0.86, halfDepth: 0.52 }, // caja torácica
  { v: 0.3, halfWidth: 0.88, halfDepth: 0.54 }, // arco costal
  { v: 0.46, halfWidth: 0.76, halfDepth: 0.47 }, // cintura
  { v: 0.56, halfWidth: 0.74, halfDepth: 0.46 }, // cintura baja
  { v: 0.72, halfWidth: 0.9, halfDepth: 0.52 }, // crestas ilíacas
  { v: 0.86, halfWidth: 0.92, halfDepth: 0.54 }, // caderas
  { v: 1.0, halfWidth: 0.72, halfDepth: 0.46 }, // corte inferior, pelvis
];

const TOP_Y = 1.5;
const BOTTOM_Y = -1.5;

/** Exponente de la superelipse: >2 aplana el frente y la espalda. */
const SECTION_EXPONENT = 2.7;

function smoothstep(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function sampleProfile(v: number): { halfWidth: number; halfDepth: number } {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const a = PROFILE[i];
    const b = PROFILE[i + 1];
    if (v >= a.v && v <= b.v) {
      const t = smoothstep((v - a.v) / (b.v - a.v));
      return {
        halfWidth: a.halfWidth + (b.halfWidth - a.halfWidth) * t,
        halfDepth: a.halfDepth + (b.halfDepth - a.halfDepth) * t,
      };
    }
  }
  const last = PROFILE[PROFILE.length - 1];
  return { halfWidth: last.halfWidth, halfDepth: last.halfDepth };
}

/** Superelipse: da la sección transversal aplanada característica del tronco. */
function sectionPoint(theta: number, halfWidth: number, halfDepth: number): [number, number] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const p = 2 / SECTION_EXPONENT;
  const x = Math.sign(c) * Math.pow(Math.abs(c), p) * halfWidth;
  const z = Math.sign(s) * Math.pow(Math.abs(s), p) * halfDepth;
  return [x, z];
}

/** Relieve muscular del frente: línea alba, rectos, arco costal y ombligo. */
function frontRelief(x: number, y: number, front: number): number {
  if (front <= 0) return 0;

  let relief = 0;
  const lateral = Math.abs(x);

  // Surco medial (línea alba).
  relief -= Math.exp(-lateral * 10) * 0.055;

  // Rectos abdominales con intersecciones tendinosas.
  if (lateral > 0.05 && lateral < 0.6 && y > -0.95 && y < 0.72) {
    const belly = 1 - Math.abs(lateral - 0.28) * 1.7;
    relief += (Math.cos(y * 6.6) * 0.02 + 0.032) * Math.max(0, belly);
  }

  // Oblicuos: ligero abultamiento lateral.
  if (lateral > 0.45) {
    relief += (lateral - 0.45) * 0.06;
  }

  // Arco costal.
  if (y > 0.45 && y < 1.1) {
    const rib = (y - 0.45) / 0.65;
    relief += Math.sin(rib * Math.PI) * (0.018 + lateral * 0.032);
  }

  // Ombligo.
  const navel = Math.hypot(x, y + 0.2);
  if (navel < 0.15) {
    relief -= Math.exp(-navel * 17) * 0.085;
  }

  return relief * front;
}

/**
 * Construye el torso. `radialSegments` recorre la circunferencia y
 * `heightSegments` el eje vertical; los extremos se cierran con un casquete
 * suave para que el corte superior e inferior no se vea hueco.
 */
export function createTorsoMesh(
  scene: BABYLON.Scene,
  name = 'torso',
  radialSegments = 128,
  heightSegments = 160
): BABYLON.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= heightSegments; j++) {
    const v = j / heightSegments;
    const y = TOP_Y + (BOTTOM_Y - TOP_Y) * v;
    const { halfWidth, halfDepth } = sampleProfile(v);

    // Cierre suave en los extremos: el tronco se redondea en lugar de cortarse.
    const capTop = smoothstep(v / 0.06);
    const capBottom = smoothstep((1 - v) / 0.06);
    const cap = Math.min(capTop, capBottom);
    const w = halfWidth * (0.18 + 0.82 * cap);
    const d = halfDepth * (0.18 + 0.82 * cap);

    for (let i = 0; i <= radialSegments; i++) {
      const u = i / radialSegments;
      const theta = u * Math.PI * 2;
      const [x, z] = sectionPoint(theta, w, d);

      // Solo la cara anterior (z > 0) recibe el relieve muscular.
      const front = d > 0.001 ? Math.max(0, z / d) : 0;
      const relief = frontRelief(x, y, front) * cap;

      positions.push(x, y, z + relief);
      uvs.push(u, 1 - v);
    }
  }

  const ringSize = radialSegments + 1;
  for (let j = 0; j < heightSegments; j++) {
    for (let i = 0; i < radialSegments; i++) {
      const a = j * ringSize + i;
      const b = a + 1;
      const c = a + ringSize;
      const dIdx = c + 1;

      indices.push(a, c, b);
      indices.push(b, c, dIdx);
    }
  }

  const normals: number[] = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);

  const vertexData = new BABYLON.VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;

  const mesh = new BABYLON.Mesh(name, scene);
  vertexData.applyToMesh(mesh, true);

  return mesh;
}
