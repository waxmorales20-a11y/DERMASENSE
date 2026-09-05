'use client';

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useLabStore } from '@/lib/store/useLabStore';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Flame,
  Maximize2,
  Minimize2,
  Eye,
  CircleCheck,
} from 'lucide-react';
import { speakFullSimulation, stopSpeech } from '@/lib/narrator-speech';
import { createTorsoMesh } from '@/lib/render/torso-mesh';
import {
  heightToNormalMap,
  makeRandom,
  paintReaction,
  paintSkinBase,
  paintSkinBump,
} from '@/lib/render/skin-texture';

// Motor de render: Babylon.js. El abdomen es un elipsoide esculpido (superficie
// organica continua, sin caras planas) y el corte histologico son discos de alta
// teselacion con relieve, no cajas.

const MICRO_DISTANCE = 0.62; // radio de camara en la vista celular
const MICRO_VIEW_THRESHOLD = 0.45;
const AUTO_ZOOM_TARGET = 0.85; // adonde viaja la camara sola al pulsar Play

// Corte histologico. `revealAt` marca el punto del viaje de camara en el que
// cada capa se secciona; `depth` es su offset a lo largo de la normal de la piel.
const LAYER_DEFS = [
  { key: 'sc', label: 'Estrato córneo', depth: 0.0, thickness: 0.022, color: '#D4AF37', revealAt: 0.30 },
  { key: 've', label: 'Epidermis viable', depth: 0.026, thickness: 0.034, color: '#E0A88A', revealAt: 0.44 },
  { key: 'de', label: 'Dermis', depth: 0.068, thickness: 0.056, color: '#C97B7B', revealAt: 0.58 },
  { key: 'hy', label: 'Hipodermis', depth: 0.132, thickness: 0.042, color: '#E8C87E', revealAt: 0.72 },
];

const STACK_TOP = LAYER_DEFS[0].depth;
const STACK_BOTTOM = LAYER_DEFS[3].depth + LAYER_DEFS[3].thickness;

const REVEAL_SPAN = 0.16;

const ACCENT = BABYLON.Color3.FromHexString('#22D3EE');
const INFLAMED = BABYLON.Color3.FromHexString('#EF4444');
const SEVERE = BABYLON.Color3.FromHexString('#DC2626');
const CHEMICAL_TINT = BABYLON.Color3.FromHexString('#1D6E8E');

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function layerReveal(easedZoom: number, revealAt: number): number {
  return smoothstep((easedZoom - revealAt) / REVEAL_SPAN);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Ruido suave y determinista para dar irregularidad organica a los tejidos.
function tissueNoise(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 9.1 + y * 4.7) * 0.5 +
    Math.sin(y * 7.3 + z * 5.9) * 0.3 +
    Math.sin(z * 11.2 + x * 3.4) * 0.2
  );
}

interface SceneLayer {
  mesh: BABYLON.Mesh;
  material: BABYLON.PBRMaterial;
  baseColor: BABYLON.Color3;
  depth: number;
  revealAt: number;
}

// Estado quimico leido del motor y consumido por el bucle de render.
// Ningun valor se calcula aqui: todos provienen de `result`.
interface ReactionState {
  layerLoad: number[];
  frontDepth: number; // 0..1 dentro de la pila de capas
  surfaceLoad: number;
  inflammation: number;
  severe: boolean;
}

/** Detalle histológico (corneocitos, capilares, adipocitos, colágeno) atado a una capa. */
interface DetailGroup {
  layerIndex: number;
  maxAlpha: number;
  apply: (alpha: number) => void;
  pulse?: (intensity: number) => void;
}

interface SceneRefs {
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  camera: BABYLON.ArcRotateCamera;
  torso: BABYLON.Mesh;
  torsoMaterial: BABYLON.PBRMaterial;
  skinTexture: BABYLON.DynamicTexture;
  patchDisc: BABYLON.Mesh;
  dropletMesh: BABYLON.Mesh;
  incisionRing: BABYLON.Mesh;
  biopsyRoot: BABYLON.TransformNode;
  layers: SceneLayer[];
  frontDisc: BABYLON.Mesh;
  particles: BABYLON.ParticleSystem;
  glow: BABYLON.GlowLayer;
  burnLight: BABYLON.PointLight;
  macroTarget: BABYLON.Vector3;
  microTarget: BABYLON.Vector3;
  macroRadius: number;
  patchNormal: BABYLON.Vector3;
  patchUv: { u: number; v: number };
  /** Piel base ya pintada: se reutiliza como fondo al repintar el eritema. */
  skinBaseCanvas: HTMLCanvasElement;
  details: DetailGroup[];
  plume: BABYLON.Mesh;
}

export const SkinDigitalTwin: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const { result, currentFrameIndex, zoomLevel, setZoomLevel, isPlaying, getIngredient } =
    useLabStore();

  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentFrame = result?.frames[currentFrameIndex];
  const metrics = result?.metrics;
  const currentIngredient = getIngredient();

  const irritationIndex = metrics?.irritationIndex ?? 0;
  const isErythema = irritationIndex >= 45;
  const isSevereBurn = irritationIndex >= 70;

  const viewMode: 'macro' | 'micro' = zoomLevel > MICRO_VIEW_THRESHOLD ? 'micro' : 'macro';
  const easedZoomUi = useMemo(() => smoothstep(zoomLevel), [zoomLevel]);

  const sceneRef = useRef<SceneRefs | null>(null);
  const zoomTargetRef = useRef<number>(zoomLevel);
  const zoomRenderRef = useRef<number>(zoomLevel);
  const isDraggingRef = useRef<boolean>(false);
  const reactionRef = useRef<ReactionState>({
    layerLoad: [0, 0, 0, 0],
    frontDepth: 0,
    surfaceLoad: 1,
    inflammation: 0,
    severe: false,
  });

  useEffect(() => {
    zoomTargetRef.current = zoomLevel;
  }, [zoomLevel]);

  const maxConcentrationOverall = useMemo(() => {
    if (!result) return 1;
    let max = 1e-6;
    for (const frame of result.frames) {
      for (let i = 0; i < frame.concentrations.length; i++) {
        if (frame.concentrations[i] > max) max = frame.concentrations[i];
      }
    }
    return max;
  }, [result]);

  const maxVehicleConcentration = useMemo(() => {
    if (!result) return 1;
    let max = 1e-6;
    for (const frame of result.frames) {
      if (frame.vehicleConcentration > max) max = frame.vehicleConcentration;
    }
    return max;
  }, [result]);

  // 1. Construccion de la escena Babylon
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });
    engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.exposure = 1.1;
    scene.imageProcessingConfiguration.contrast = 1.15;

    // A. Camara orbital con inercia alta: el desplazamiento nunca es brusco.
    const macroTarget = new BABYLON.Vector3(0, -0.05, 0);
    const macroRadius = 4.9;
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 2,
      macroRadius,
      macroTarget,
      scene
    );
    camera.attachControl(canvas, true);
    camera.inertia = 0.9;
    camera.angularSensibilityX = 1800;
    camera.angularSensibilityY = 1800;
    camera.panningSensibility = 0; // sin paneo: el encuadre lo gobierna el zoom
    camera.lowerRadiusLimit = 0.25;
    camera.upperRadiusLimit = 8;
    camera.minZ = 0.01;
    camera.fov = 0.7;
    // El zoom nativo de la rueda se sustituye por el zoom cinematico del store.
    camera.inputs.removeByType('ArcRotateCameraMouseWheelInput');

    // B. Iluminacion de laboratorio
    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.35;
    hemi.diffuse = BABYLON.Color3.FromHexString('#8FA3BF');
    hemi.groundColor = BABYLON.Color3.FromHexString('#0A0A0C');

    const keyLight = new BABYLON.DirectionalLight(
      'key',
      new BABYLON.Vector3(-0.6, -0.7, -0.8),
      scene
    );
    keyLight.position = new BABYLON.Vector3(3, 3.5, 3.5);
    keyLight.intensity = 2.6;
    keyLight.diffuse = BABYLON.Color3.FromHexString('#FFF3E6');

    const rimLight = new BABYLON.DirectionalLight(
      'rim',
      new BABYLON.Vector3(0.8, -0.2, -0.6),
      scene
    );
    rimLight.intensity = 1.1;
    rimLight.diffuse = ACCENT;

    const burnLight = new BABYLON.PointLight('burn', new BABYLON.Vector3(0, 0, 1), scene);
    burnLight.diffuse = INFLAMED;
    burnLight.intensity = 0;
    burnLight.range = 3;

    const glow = new BABYLON.GlowLayer('glow', scene, {
      mainTextureFixedSize: 512,
      blurKernelSize: 48,
    });
    glow.intensity = 0.35;

    // C. Abdomen humano: malla parametrica construida a partir del perfil
    // anatomico real (torax ancho, cintura estrecha, caderas), no una esfera.
    const torso = createTorsoMesh(scene, 'torso');

    // Textura de piel dibujada por codigo: tono, poros, vello y venas subcutaneas.
    const TEX_SIZE = 2048;
    const skinTexture = new BABYLON.DynamicTexture(
      'skin',
      { width: TEX_SIZE, height: TEX_SIZE },
      scene,
      true
    );

    // La piel base se pinta una sola vez en un lienzo aparte y luego se usa como
    // fondo cada vez que hay que repintar la reaccion: repintar poros y vello en
    // cada frame de tiempo seria carisimo.
    const skinBaseCanvas = document.createElement('canvas');
    skinBaseCanvas.width = TEX_SIZE;
    skinBaseCanvas.height = TEX_SIZE;
    const baseCtx = skinBaseCanvas.getContext('2d');
    if (baseCtx) paintSkinBase(baseCtx, TEX_SIZE, TEX_SIZE);

    const skinCtx = skinTexture.getContext() as unknown as CanvasRenderingContext2D;
    skinCtx.drawImage(skinBaseCanvas, 0, 0);
    skinTexture.update();

    // Relieve real de la piel (poros y reticula cutanea) como mapa de normales.
    const bumpTexture = new BABYLON.DynamicTexture(
      'skinBump',
      { width: 1024, height: 1024 },
      scene,
      true
    );
    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = 1024;
    heightCanvas.height = 1024;
    const heightCtx = heightCanvas.getContext('2d');
    const bumpCtx = bumpTexture.getContext() as unknown as CanvasRenderingContext2D;
    if (heightCtx) {
      paintSkinBump(heightCtx, 1024, 1024);
      heightToNormalMap(heightCtx, bumpCtx, 1024);
    }
    bumpTexture.update();
    bumpTexture.level = 0.6;

    const torsoMaterial = new BABYLON.PBRMaterial('skinMat', scene);
    torsoMaterial.albedoTexture = skinTexture;
    torsoMaterial.bumpTexture = bumpTexture;
    torsoMaterial.metallic = 0;
    torsoMaterial.roughness = 0.62;
    torsoMaterial.subSurface.isTranslucencyEnabled = true;
    torsoMaterial.subSurface.translucencyIntensity = 0.22;
    torsoMaterial.subSurface.tintColor = BABYLON.Color3.FromHexString('#C97B7B');
    torsoMaterial.backFaceCulling = false;
    torso.material = torsoMaterial;

    // D. Punto exacto de aplicacion: se obtiene por raycast sobre la piel real,
    // asi el parche y el corte quedan pegados a la superficie esculpida.
    torso.computeWorldMatrix(true);
    torso.refreshBoundingInfo();

    const rayOrigin = new BABYLON.Vector3(0.34, -0.08, 3);
    const ray = new BABYLON.Ray(rayOrigin, new BABYLON.Vector3(0, 0, -1), 6);
    const pick = scene.pickWithRay(ray, (m) => m === torso);

    // Coordenadas UV reales del punto de aplicacion: el eritema se pinta
    // exactamente donde esta el parche, sin adivinar el mapeo de la esfera.
    const pickedUv = pick?.hit ? pick.getTextureCoordinates() : null;
    const patchUv = pickedUv ? { u: pickedUv.x, v: pickedUv.y } : { u: 0.25, v: 0.5 };

    const patchPoint =
      pick?.hit && pick.pickedPoint
        ? pick.pickedPoint.clone()
        : new BABYLON.Vector3(0.34, -0.08, 0.55);
    const patchNormal =
      pick?.hit && pick.getNormal(true)
        ? pick.getNormal(true)!.clone()
        : new BABYLON.Vector3(0, 0, 1);
    patchNormal.normalize();

    // E. Parche clinico y menisco de vehiculo, orientados a la piel.
    const orientToSkin = (mesh: BABYLON.Mesh, offset: number) => {
      mesh.position = patchPoint.add(patchNormal.scale(offset));
      mesh.lookAt(mesh.position.add(patchNormal));
    };

    const patchDisc = BABYLON.MeshBuilder.CreateDisc(
      'patch',
      { radius: 0.085, tessellation: 96 },
      scene
    );
    const patchMat = new BABYLON.StandardMaterial('patchMat', scene);
    patchMat.emissiveColor = ACCENT;
    patchMat.disableLighting = true;
    patchMat.alpha = 0.25;
    patchMat.backFaceCulling = false;
    patchDisc.material = patchMat;
    orientToSkin(patchDisc, 0.004);

    const dropletMesh = BABYLON.MeshBuilder.CreateSphere(
      'droplet',
      { diameterX: 0.16, diameterY: 0.16, diameterZ: 0.05, segments: 48 },
      scene
    );
    const dropletMat = new BABYLON.PBRMaterial('dropletMat', scene);
    dropletMat.albedoColor = ACCENT;
    dropletMat.metallic = 0;
    dropletMat.roughness = 0.08;
    dropletMat.alpha = 0.35;
    dropletMesh.material = dropletMat;
    orientToSkin(dropletMesh, 0.012);

    // Anillo de incision que se dilata al abrir la piel.
    const incisionRing = BABYLON.MeshBuilder.CreateTorus(
      'incision',
      { diameter: 0.24, thickness: 0.008, tessellation: 96 },
      scene
    );
    const incisionMat = new BABYLON.StandardMaterial('incisionMat', scene);
    incisionMat.emissiveColor = ACCENT;
    incisionMat.disableLighting = true;
    incisionMat.alpha = 0;
    incisionRing.material = incisionMat;
    incisionRing.position = patchPoint.add(patchNormal.scale(0.006));
    incisionRing.lookAt(incisionRing.position.add(patchNormal));
    incisionRing.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.LOCAL);

    // F. Corte histologico: cilindros de alta teselacion con relieve organico,
    // apilados a lo largo de la normal de la piel (hacia el interior del cuerpo).
    const biopsyRoot = new BABYLON.TransformNode('biopsy', scene);
    biopsyRoot.position = patchPoint.clone();
    const lookHelper = BABYLON.MeshBuilder.CreateBox('helper', { size: 0.001 }, scene);
    lookHelper.position = patchPoint.clone();
    lookHelper.lookAt(patchPoint.add(patchNormal));
    biopsyRoot.rotationQuaternion = lookHelper.rotationQuaternion
      ? lookHelper.rotationQuaternion.clone()
      : BABYLON.Quaternion.FromEulerVector(lookHelper.rotation);
    lookHelper.dispose();

    const sceneLayers: SceneLayer[] = LAYER_DEFS.map((def, idx) => {
      const mesh = BABYLON.MeshBuilder.CreateCylinder(
        `layer-${def.key}`,
        {
          diameter: 0.24,
          height: def.thickness,
          tessellation: 96,
          subdivisions: 6,
        },
        scene
      );

      // Relieve de la interfase: papilas dermicas y borde de tejido irregular,
      // para que ninguna capa se lea como un bloque recto.
      const layerPositions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      if (layerPositions) {
        for (let i = 0; i < layerPositions.length; i += 3) {
          const x = layerPositions[i];
          const y = layerPositions[i + 1];
          const z = layerPositions[i + 2];
          const radial = Math.hypot(x, z);
          const amplitude = idx === 1 || idx === 2 ? 0.0055 : 0.0035;
          const wave = tissueNoise(x * 6, y * 30, z * 6) * amplitude;
          const rim = radial > 0.001 ? 1 : 0;

          layerPositions[i] = x + (x / (radial || 1)) * wave * rim;
          layerPositions[i + 1] = y + wave * 0.6;
          layerPositions[i + 2] = z + (z / (radial || 1)) * wave * rim;
        }
        mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, layerPositions);
        mesh.createNormals(true);
      }

      const material = new BABYLON.PBRMaterial(`layerMat-${def.key}`, scene);
      const baseColor = BABYLON.Color3.FromHexString(def.color);
      material.albedoColor = baseColor;
      material.metallic = 0;
      material.roughness = 0.55 + idx * 0.06;
      material.subSurface.isTranslucencyEnabled = true;
      material.subSurface.translucencyIntensity = 0.3;
      material.alpha = 0;
      mesh.material = material;

      mesh.parent = biopsyRoot;
      // El cilindro crece en Y; se tumba para apilarse a lo largo de la normal.
      mesh.rotation.x = Math.PI / 2;
      mesh.position = new BABYLON.Vector3(0, 0, -(def.depth + def.thickness / 2));
      mesh.isVisible = false;

      return { mesh, material, baseColor, depth: def.depth, revealAt: def.revealAt };
    });

    // F-bis. Tejido real dentro de cada capa: corneocitos, capilares con flujo,
    // fibras de colageno y adipocitos. Se dibujan con thin instances (una sola
    // llamada de dibujo por grupo) para que no cueste rendimiento.
    const details: DetailGroup[] = [];
    const detailRandom = makeRandom(9182736);

    const layerCenterZ = (idx: number) =>
      -(LAYER_DEFS[idx].depth + LAYER_DEFS[idx].thickness / 2);

    // Corneocitos: escamas planas y solapadas del estrato corneo.
    const corneocyte = BABYLON.MeshBuilder.CreateDisc(
      'corneocyte',
      { radius: 0.014, tessellation: 6 },
      scene
    );
    const corneocyteMat = new BABYLON.PBRMaterial('corneocyteMat', scene);
    corneocyteMat.albedoColor = BABYLON.Color3.FromHexString('#E8D9B5');
    corneocyteMat.metallic = 0;
    corneocyteMat.roughness = 0.85;
    corneocyteMat.alpha = 0;
    corneocyteMat.backFaceCulling = false;
    corneocyte.material = corneocyteMat;
    corneocyte.parent = biopsyRoot;
    corneocyte.isPickable = false;

    {
      const count = 150;
      const matrices = new Float32Array(count * 16);
      for (let i = 0; i < count; i++) {
        const angle = detailRandom() * Math.PI * 2;
        const radius = Math.sqrt(detailRandom()) * 0.1;
        const matrix = BABYLON.Matrix.RotationZ(detailRandom() * Math.PI).multiply(
          BABYLON.Matrix.Translation(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            layerCenterZ(0) + (detailRandom() - 0.5) * 0.012
          )
        );
        matrix.copyToArray(matrices, i * 16);
      }
      corneocyte.thinInstanceSetBuffer('matrix', matrices, 16);
    }

    details.push({
      layerIndex: 0,
      maxAlpha: 0.9,
      apply: (alpha) => {
        corneocyteMat.alpha = alpha;
        corneocyte.isVisible = alpha > 0.01;
      },
    });

    // Capilares dermicos: tubos meandricos con flujo sanguineo luminoso.
    const capillaryMat = new BABYLON.PBRMaterial('capillaryMat', scene);
    capillaryMat.albedoColor = BABYLON.Color3.FromHexString('#8E2436');
    capillaryMat.emissiveColor = BABYLON.Color3.FromHexString('#3B0A12');
    capillaryMat.metallic = 0;
    capillaryMat.roughness = 0.35;
    capillaryMat.alpha = 0;

    const capillaries: BABYLON.Mesh[] = [];
    for (let c = 0; c < 6; c++) {
      const path: BABYLON.Vector3[] = [];
      const baseY = -0.08 + c * 0.032;
      const depthJitter = (detailRandom() - 0.5) * 0.02;
      for (let s = 0; s <= 28; s++) {
        const t = s / 28;
        path.push(
          new BABYLON.Vector3(
            -0.105 + t * 0.21,
            baseY + Math.sin(t * Math.PI * 3 + c) * 0.022,
            layerCenterZ(2) + depthJitter + Math.cos(t * Math.PI * 2 + c) * 0.008
          )
        );
      }

      const tube = BABYLON.MeshBuilder.CreateTube(
        `capillary-${c}`,
        { path, radius: 0.0026 + detailRandom() * 0.0016, tessellation: 12, cap: BABYLON.Mesh.CAP_ALL },
        scene
      );
      tube.material = capillaryMat;
      tube.parent = biopsyRoot;
      tube.isPickable = false;
      tube.isVisible = false;
      capillaries.push(tube);
    }

    details.push({
      layerIndex: 2,
      maxAlpha: 1,
      apply: (alpha) => {
        capillaryMat.alpha = alpha;
        capillaries.forEach((tube) => {
          tube.isVisible = alpha > 0.01;
        });
      },
      // El flujo late: mas intenso cuanto mayor es la vasodilatacion inflamatoria.
      pulse: (intensity) => {
        // Vasodilatacion: los capilares se engrosan y el flujo brilla mas.
        capillaryMat.emissiveColor.copyFromFloats(0.22 + intensity * 0.6, 0.04, 0.07);
        capillaryMat.albedoColor.copyFromFloats(0.56 + intensity * 0.35, 0.14, 0.21);
        const dilation = 1 + intensity * 0.85;
        capillaries.forEach((tube) => tube.scaling.set(1, dilation, dilation));
      },
    });

    // Fibras de colageno de la dermis.
    const collagenLines: BABYLON.Vector3[][] = [];
    for (let f = 0; f < 26; f++) {
      const line: BABYLON.Vector3[] = [];
      const y = -0.1 + detailRandom() * 0.2;
      const z = layerCenterZ(2) + (detailRandom() - 0.5) * 0.04;
      for (let s = 0; s <= 12; s++) {
        const t = s / 12;
        line.push(
          new BABYLON.Vector3(
            -0.11 + t * 0.22,
            y + Math.sin(t * Math.PI * 4 + f) * 0.012,
            z + Math.cos(t * Math.PI * 3 + f) * 0.006
          )
        );
      }
      collagenLines.push(line);
    }

    const collagen = BABYLON.MeshBuilder.CreateLineSystem(
      'collagen',
      { lines: collagenLines },
      scene
    );
    collagen.color = BABYLON.Color3.FromHexString('#E9C7B4');
    collagen.parent = biopsyRoot;
    collagen.isPickable = false;
    collagen.isVisible = false;

    details.push({
      layerIndex: 2,
      maxAlpha: 0.35,
      apply: (alpha) => {
        collagen.alpha = alpha;
        collagen.isVisible = alpha > 0.01;
      },
    });

    // Adipocitos de la hipodermis: lobulillos de grasa.
    const adipocyte = BABYLON.MeshBuilder.CreateSphere(
      'adipocyte',
      { diameter: 0.028, segments: 12 },
      scene
    );
    const adipocyteMat = new BABYLON.PBRMaterial('adipocyteMat', scene);
    adipocyteMat.albedoColor = BABYLON.Color3.FromHexString('#F0D48A');
    adipocyteMat.metallic = 0;
    adipocyteMat.roughness = 0.5;
    adipocyteMat.subSurface.isTranslucencyEnabled = true;
    adipocyteMat.subSurface.translucencyIntensity = 0.4;
    adipocyteMat.alpha = 0;
    adipocyte.material = adipocyteMat;
    adipocyte.parent = biopsyRoot;
    adipocyte.isPickable = false;

    {
      const count = 90;
      const matrices = new Float32Array(count * 16);
      for (let i = 0; i < count; i++) {
        const angle = detailRandom() * Math.PI * 2;
        const radius = Math.sqrt(detailRandom()) * 0.1;
        const scale = 0.7 + detailRandom() * 0.7;
        const matrix = BABYLON.Matrix.Scaling(scale, scale, scale).multiply(
          BABYLON.Matrix.Translation(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            layerCenterZ(3) + (detailRandom() - 0.5) * 0.026
          )
        );
        matrix.copyToArray(matrices, i * 16);
      }
      adipocyte.thinInstanceSetBuffer('matrix', matrices, 16);
    }

    details.push({
      layerIndex: 3,
      maxAlpha: 0.95,
      apply: (alpha) => {
        adipocyteMat.alpha = alpha;
        adipocyte.isVisible = alpha > 0.01;
      },
    });

    // Pluma de difusion: el volumen de tejido que el activo ya ha invadido,
    // en forma de cono porque el frente se ensancha menos conforme profundiza.
    const plume = BABYLON.MeshBuilder.CreateCylinder(
      'plume',
      { height: 1, diameterTop: 0.2, diameterBottom: 0.06, tessellation: 48 },
      scene
    );
    const plumeMat = new BABYLON.StandardMaterial('plumeMat', scene);
    plumeMat.emissiveColor = ACCENT;
    plumeMat.disableLighting = true;
    plumeMat.alpha = 0;
    plumeMat.alphaMode = BABYLON.Engine.ALPHA_ADD;
    plumeMat.backFaceCulling = false;
    plume.material = plumeMat;
    plume.parent = biopsyRoot;
    plume.rotation.x = Math.PI / 2; // el eje del cono sigue la normal de la piel
    plume.isPickable = false;

    // Frente de difusion: disco luminoso que desciende a la profundidad del motor.
    const frontDisc = BABYLON.MeshBuilder.CreateDisc(
      'front',
      { radius: 0.125, tessellation: 96 },
      scene
    );
    const frontMat = new BABYLON.StandardMaterial('frontMat', scene);
    frontMat.emissiveColor = ACCENT;
    frontMat.disableLighting = true;
    frontMat.alpha = 0;
    frontMat.backFaceCulling = false;
    frontDisc.material = frontMat;
    frontDisc.parent = biopsyRoot;
    frontDisc.position = new BABYLON.Vector3(0, 0, -STACK_TOP);

    // G. Particulas del activo penetrando el tejido.
    const particleTexture = new BABYLON.DynamicTexture(
      'particleTex',
      { width: 64, height: 64 },
      scene,
      true
    );
    const pCtx = particleTexture.getContext() as unknown as CanvasRenderingContext2D;
    const pGrad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    pGrad.addColorStop(0, 'rgba(255,255,255,1)');
    pGrad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    pGrad.addColorStop(1, 'rgba(255,255,255,0)');
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 64, 64);
    particleTexture.update();
    particleTexture.hasAlpha = true;

    // Emisor invisible anclado al corte: mantiene la orientacion de la piel.
    const particleEmitter = BABYLON.MeshBuilder.CreateBox(
      'particleEmitter',
      { size: 0.001 },
      scene
    );
    particleEmitter.parent = biopsyRoot;
    particleEmitter.isVisible = false;
    particleEmitter.isPickable = false;

    const particles = new BABYLON.ParticleSystem('molecules', 900, scene);
    particles.particleTexture = particleTexture;
    particles.emitter = particleEmitter;
    particles.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, 0.005);
    particles.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.005);
    particles.color1 = new BABYLON.Color4(ACCENT.r, ACCENT.g, ACCENT.b, 0.85);
    particles.color2 = new BABYLON.Color4(ACCENT.r, ACCENT.g, ACCENT.b, 0.35);
    particles.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    particles.minSize = 0.004;
    particles.maxSize = 0.011;
    particles.minLifeTime = 1.4;
    particles.maxLifeTime = 3.2;
    particles.emitRate = 0;
    particles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    particles.direction1 = new BABYLON.Vector3(-0.01, -0.01, -0.06);
    particles.direction2 = new BABYLON.Vector3(0.01, 0.01, -0.02);
    particles.minEmitPower = 0.01;
    particles.maxEmitPower = 0.045;
    particles.updateSpeed = 0.012;
    particles.isLocal = true;
    particles.start();

    burnLight.position = patchPoint.add(patchNormal.scale(0.25));

    const microTarget = patchPoint.subtract(patchNormal.scale(0.07));

    sceneRef.current = {
      engine,
      scene,
      camera,
      torso,
      torsoMaterial,
      skinTexture,
      patchDisc,
      dropletMesh,
      incisionRing,
      biopsyRoot,
      layers: sceneLayers,
      frontDisc,
      particles,
      glow,
      burnLight,
      macroTarget,
      microTarget,
      macroRadius,
      patchNormal,
      patchUv,
      skinBaseCanvas,
      details,
      plume,
    };

    // H. Bucle de render: zoom cinematico, apertura del corte y reaccion quimica.
    // Angulos que enfrentan la camara al parche cuando entramos en vista celular.
    const microAlpha = Math.atan2(patchNormal.z, patchNormal.x);
    const microBeta = Math.acos(clamp01(patchNormal.y * 0.5 + 0.5));

    const workColor = new BABYLON.Color3();
    let clock = 0;

    scene.registerBeforeRender(() => {
      const refs = sceneRef.current;
      if (!refs) return;

      const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1);
      clock += dt;

      // Persecucion amortiguada del objetivo de zoom.
      zoomRenderRef.current += (zoomTargetRef.current - zoomRenderRef.current) * (1 - Math.pow(0.02, dt));
      const eased = smoothstep(zoomRenderRef.current);
      const reaction = reactionRef.current;

      // Encuadre: el objetivo viaja del abdomen al parche y el radio se cierra.
      const desiredTarget = BABYLON.Vector3.Lerp(refs.macroTarget, refs.microTarget, eased);
      refs.camera.target = BABYLON.Vector3.Lerp(refs.camera.target, desiredTarget, 0.08);
      refs.camera.radius = lerp(
        refs.camera.radius,
        lerp(refs.macroRadius, MICRO_DISTANCE, eased),
        0.08
      );

      // Al acercarse, la camara se alinea sola con la normal de la piel, salvo
      // que el usuario este orbitando manualmente.
      if (!isDraggingRef.current && eased > 0.05) {
        refs.camera.alpha = lerp(refs.camera.alpha, microAlpha, 0.03 * eased);
        refs.camera.beta = lerp(refs.camera.beta, microBeta, 0.03 * eased);
      }

      // Respiracion sutil del cuerpo: nada queda completamente estatico.
      const breathe = 1 + Math.sin(clock * 0.9) * 0.006 * (1 - eased);
      refs.torso.scaling.set(breathe, 1 + Math.sin(clock * 0.9) * 0.003 * (1 - eased), breathe);

      // La piel se abre conforme la camara entra.
      const skinFade = smoothstep((eased - 0.22) / 0.5);
      refs.torsoMaterial.alpha = lerp(1, 0.05, skinFade);
      refs.torsoMaterial.transparencyMode = skinFade > 0.01 ? BABYLON.PBRMaterial.MATERIAL_ALPHABLEND : BABYLON.PBRMaterial.MATERIAL_OPAQUE;

      const pulse = 0.5 + Math.sin(clock * 3) * 0.5;
      (refs.patchDisc.material as BABYLON.StandardMaterial).alpha =
        (0.18 + pulse * 0.14) * (1 - skinFade);
      refs.patchDisc.scaling.setAll(1 + pulse * 0.05);

      const dropletMaterial = refs.dropletMesh.material as BABYLON.PBRMaterial;
      dropletMaterial.alpha = 0.42 * reaction.surfaceLoad * (1 - skinFade);
      const dropScale = 0.7 + reaction.surfaceLoad * 0.3;
      refs.dropletMesh.scaling.set(dropScale, dropScale, dropScale);

      const incision = smoothstep((eased - 0.18) / 0.3);
      const incisionMaterial = refs.incisionRing.material as BABYLON.StandardMaterial;
      incisionMaterial.alpha = incision * (1 - skinFade) * 0.85;
      refs.incisionRing.scaling.setAll(0.7 + incision * 1.2);

      // Apertura escalonada de las capas + reaccion quimica en cada una.
      const breath = 0.5 + Math.sin(clock * 2.4) * 0.5;

      refs.layers.forEach((layer, idx) => {
        const reveal = layerReveal(eased, layer.revealAt);
        layer.material.alpha = reveal;
        layer.mesh.isVisible = reveal > 0.01;
        // Cada capa desciende a su posicion anatomica al seccionarse.
        layer.mesh.position.z =
          -(layer.depth + LAYER_DEFS[idx].thickness / 2) + (1 - reveal) * 0.05;
        layer.mesh.scaling.set(0.9 + reveal * 0.1, 1, 0.9 + reveal * 0.1);

        const load = reaction.layerLoad[idx] ?? 0;
        const inflame =
          idx === 1 || idx === 2 ? reaction.inflammation : reaction.inflammation * 0.35;

        // Tincion: el activo azulea el tejido; la inflamacion lo enrojece.
        BABYLON.Color3.LerpToRef(layer.baseColor, CHEMICAL_TINT, load * 0.5, workColor);
        BABYLON.Color3.LerpToRef(
          workColor,
          reaction.severe ? SEVERE : INFLAMED,
          inflame,
          workColor
        );
        layer.material.albedoColor.copyFrom(workColor);

        // Destello extra en la capa que el frente esta atravesando ahora mismo:
        // asi se ve exactamente por donde va entrando el quimico.
        const frontAbsolute = lerp(STACK_TOP, STACK_BOTTOM, reaction.frontDepth);
        const def = LAYER_DEFS[idx];
        const isFrontHere =
          frontAbsolute >= def.depth && frontAbsolute <= def.depth + def.thickness;
        const frontGlow = isFrontHere ? 0.22 + breath * 0.28 : 0;

        const emissive = load * 0.12 + inflame * (0.35 + breath * 0.3) + frontGlow;
        layer.material.emissiveColor.copyFromFloats(
          (inflame > 0.05 ? (reaction.severe ? 0.86 : 0.94) : 0.13) * emissive,
          (inflame > 0.05 ? 0.15 : 0.83) * emissive,
          (inflame > 0.05 ? 0.15 : 0.93) * emissive
        );
      });

      // El tejido de cada capa (corneocitos, capilares, colageno, adipocitos)
      // aparece con su capa y late con la vasodilatacion inflamatoria.
      refs.details.forEach((detail) => {
        const reveal = layerReveal(eased, LAYER_DEFS[detail.layerIndex].revealAt);
        detail.apply(reveal * detail.maxAlpha);
        detail.pulse?.(reaction.inflammation * (0.6 + breath * 0.4));
      });

      // La pluma crece hasta la profundidad alcanzada por el activo.
      const plumeLength = Math.max(
        0.012,
        (STACK_BOTTOM - STACK_TOP) * reaction.frontDepth
      );
      refs.plume.scaling.y += (plumeLength - refs.plume.scaling.y) * 0.06;
      refs.plume.position.z = -(STACK_TOP + refs.plume.scaling.y / 2);
      const plumeMaterial = refs.plume.material as BABYLON.StandardMaterial;
      plumeMaterial.alpha =
        smoothstep((eased - 0.28) / 0.25) * (0.1 + breath * 0.14) * (0.45 + reaction.surfaceLoad * 0.55);
      plumeMaterial.emissiveColor = reaction.inflammation > 0.4 ? INFLAMED : ACCENT;
      refs.plume.isVisible = plumeMaterial.alpha > 0.01;

      // Frente de difusion a la profundidad exacta que reporta el motor.
      const frontZ = -lerp(STACK_TOP, STACK_BOTTOM, reaction.frontDepth);
      refs.frontDisc.position.z += (frontZ - refs.frontDisc.position.z) * 0.06;
      const frontMaterial = refs.frontDisc.material as BABYLON.StandardMaterial;
      frontMaterial.alpha = smoothstep((eased - 0.3) / 0.25) * (0.25 + breath * 0.35);
      frontMaterial.emissiveColor = reaction.inflammation > 0.4 ? INFLAMED : ACCENT;
      refs.frontDisc.scaling.setAll(0.85 + breath * 0.06);

      // Particulas: caudal y velocidad proporcionales al avance del activo.
      refs.particles.emitRate = eased > 0.28 ? 40 + reaction.frontDepth * 260 : 0;
      refs.particles.maxEmitPower = 0.02 + reaction.frontDepth * 0.08;
      const particleColor = reaction.inflammation > 0.4 ? INFLAMED : ACCENT;
      refs.particles.color1 = new BABYLON.Color4(
        particleColor.r,
        particleColor.g,
        particleColor.b,
        0.85
      );
      refs.particles.color2 = new BABYLON.Color4(
        particleColor.r,
        particleColor.g,
        particleColor.b,
        0.3
      );

      refs.glow.intensity = 0.28 + reaction.inflammation * 0.5 + eased * 0.15;
      refs.burnLight.intensity = reaction.inflammation * (reaction.severe ? 3.2 : 1.6);
      refs.burnLight.diffuse = reaction.severe ? SEVERE : INFLAMED;
    });

    engine.runRenderLoop(() => {
      scene.render();
    });

    // I. Reencuadre ante cualquier cambio de tamano (incluida pantalla completa).
    const handleResize = () => engine.resize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);
    window.addEventListener('resize', handleResize);

    // J. Zoom cinematico con la rueda, y deteccion de orbita manual.
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const normalized = Math.max(-1, Math.min(1, e.deltaY / 100));
      setZoomLevel((prev) => prev - normalized * 0.04);
    };
    const handlePointerDown = () => {
      isDraggingRef.current = true;
    };
    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);

      sceneRef.current = null;
      particles.dispose();
      particleTexture.dispose();
      skinTexture.dispose();
      scene.dispose();
      engine.dispose();
    };
  }, [setZoomLevel]);

  // 2. Lectura del estado quimico del motor -> parametros de animacion
  useEffect(() => {
    if (!result || !currentFrame) return;

    const { mesh, frames } = result;
    const layerSums = [0, 0, 0, 0];
    const layerCounts = [0, 0, 0, 0];
    let deepestIndex = 0;

    const detectionThreshold = maxConcentrationOverall * 0.02;

    for (let i = 0; i < mesh.positionsUm.length; i++) {
      const layerIdx = Math.min(3, mesh.layerIndex[i]);
      const conc = currentFrame.concentrations[i];
      layerSums[layerIdx] += conc;
      layerCounts[layerIdx] += 1;
      if (conc >= detectionThreshold) deepestIndex = i;
    }

    const totalThicknessUm = mesh.positionsUm[mesh.positionsUm.length - 1] || 1;
    const frontDepth = clamp01(mesh.positionsUm[deepestIndex] / totalThicknessUm);

    const layerLoad = layerSums.map((sum, idx) =>
      layerCounts[idx] > 0 ? clamp01(sum / layerCounts[idx] / maxConcentrationOverall) : 0
    );

    const surfaceLoad = clamp01(currentFrame.vehicleConcentration / maxVehicleConcentration);

    const lagTime = metrics?.lagTimeHours ?? 2;
    const afterLag =
      currentFrame.timeHours >= Math.min(lagTime, frames[frames.length - 1].timeHours);
    const inflammation = isErythema && afterLag ? clamp01((irritationIndex - 40) / 45) : 0;

    reactionRef.current = {
      layerLoad,
      frontDepth,
      surfaceLoad,
      inflammation,
      severe: isSevereBurn,
    };
  }, [
    result,
    currentFrame,
    metrics,
    maxConcentrationOverall,
    maxVehicleConcentration,
    isErythema,
    isSevereBurn,
    irritationIndex,
  ]);

  // 3. Reaccion pintada sobre la piel: se repinta solo el eritema, usando la
  // piel base (poros, vello, venas) ya renderizada como fondo.
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs || !result || !currentFrame) return;

    const ctx = refs.skinTexture.getContext() as unknown as CanvasRenderingContext2D;
    const size = refs.skinBaseCanvas.width;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(refs.skinBaseCanvas, 0, 0);

    const currentTime = currentFrame.timeHours;
    const lagTime = metrics?.lagTimeHours ?? 2.0;
    const visible = isErythema && currentTime >= Math.min(lagTime * 0.4, 1.0);
    const timeFactor = visible ? Math.min(1, currentTime / (lagTime + 3)) : 0;

    paintReaction(ctx, {
      width: size,
      height: size,
      patchU: refs.patchUv.u,
      patchV: refs.patchUv.v,
      erythema: timeFactor,
      severe: isSevereBurn,
      rashRadius: (isSevereBurn ? 260 : 190) * timeFactor,
    });

    refs.burnLight.intensity = visible ? (isSevereBurn ? 2.8 : 1.4) * timeFactor : 0;
    refs.burnLight.diffuse = isSevereBurn ? SEVERE : INFLAMED;

    refs.skinTexture.update();
  }, [result, currentFrame, isErythema, isSevereBurn, metrics]);
  // 4-bis. Al pulsar Play, el asistente narra la simulacion completa en voz alta.
  // Al pausar, la voz se detiene para no hablar sobre una escena congelada.
  useEffect(() => {
    if (!isPlaying) {
      stopSpeech();
      return;
    }
    if (result) speakFullSimulation(result);
  }, [isPlaying, result]);

  // 4. Zoom automatico y lento al pulsar Play: la camara viaja sola hasta el
  // area donde ocurre la reaccion quimica.
  useEffect(() => {
    if (!isPlaying) return;
    if (useLabStore.getState().zoomLevel >= AUTO_ZOOM_TARGET - 0.01) return;

    const intervalId = window.setInterval(() => {
      const current = useLabStore.getState().zoomLevel;
      if (current >= AUTO_ZOOM_TARGET - 0.005) {
        window.clearInterval(intervalId);
        return;
      }
      setZoomLevel(Math.min(AUTO_ZOOM_TARGET, current + 0.02));
    }, 110);

    return () => window.clearInterval(intervalId);
  }, [isPlaying, setZoomLevel]);

  const handleGoMacro = useCallback(() => setZoomLevel(0), [setZoomLevel]);
  const handleGoMicro = useCallback(() => setZoomLevel(1), [setZoomLevel]);

  // Pantalla completa: el visor ocupa el 100% de la pestana y el asistente narra
  // la simulacion completa. Al reducir el tamano, la voz se detiene.
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        if (result) speakFullSimulation(result);
      } else {
        stopSpeech();
      }
      return next;
    });
  }, [result]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopSpeech();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  useEffect(() => () => stopSpeech(), []);

  const layerHudRows = [
    { label: '1. Estrato córneo', range: '0 – 15 µm', dot: '#D4AF37', inflamed: false },
    { label: '2. Epidermis viable', range: '15 – 100 µm', dot: '#E0A88A', inflamed: isErythema },
    { label: '3. Dermis', range: '100 – 1500 µm', dot: '#C97B7B', inflamed: isErythema },
    { label: '4. Hipodermis', range: '> 1500 µm', dot: '#E8C87E', inflamed: false },
  ];

  return (
    <div
      ref={shellRef}
      className={`relative overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen bg-bg' : 'h-full w-full bg-bg'
      }`}
    >
      {/* Lienzo Babylon a altura completa: sin barras superiores sobre el visor */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full cursor-grab touch-none outline-none active:cursor-grabbing"
      />

      <button
        onClick={handleToggleFullscreen}
        className="absolute right-3 top-3 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface/80 text-text-muted backdrop-blur-md transition-colors hover:border-accent hover:text-accent"
        title={
          isFullscreen
            ? 'Salir de pantalla completa y detener la narración (Esc)'
            : 'Pantalla completa y narración de la simulación'
        }
        aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      <div className="pointer-events-none absolute right-14 top-3 z-20">
        {isErythema ? (
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold backdrop-blur-md ${
              isSevereBurn
                ? 'border-risk-high/70 bg-risk-high/15 text-risk-high'
                : 'border-risk/50 bg-risk/10 text-risk'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            <span>{isSevereBurn ? 'Quemadura' : 'Eritema'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/80 px-2 py-1 text-[11px] font-medium text-text-muted backdrop-blur-md">
            <CircleCheck className="h-3.5 w-3.5" />
            <span>Tolerada</span>
          </div>
        )}
      </div>

      {!isFullscreen && (
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[250px] flex-col gap-1.5 rounded-xl border border-border bg-surface/85 p-2.5 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between text-[11px] font-semibold text-accent">
          <span>{viewMode === 'macro' ? 'ABDOMEN HUMANO' : 'CORTE CAPA POR CAPA'}</span>
          <span className="font-mono text-[9px] tabular-nums text-text-muted">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        {viewMode === 'macro' ? (
          <p className="text-[10px] leading-tight text-text-muted">
            Abdomen completo. Parche de {currentIngredient.name}{' '}
            {result?.input.concentrationPct}%.{' '}
            {isErythema ? 'Roncha eritematosa visible en piel.' : 'Piel fisiológica basal.'}
          </p>
        ) : (
          <div className="flex flex-col gap-1 font-mono text-[9px]">
            {layerHudRows.map((row, idx) => {
              const opened = layerReveal(easedZoomUi, LAYER_DEFS[idx].revealAt) > 0.5;
              const inflamedNow = row.inflamed && opened;
              return (
                <div
                  key={row.label}
                  className={`flex items-center justify-between border-b border-border/60 pb-0.5 transition-opacity last:border-b-0 ${
                    opened ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: inflamedNow ? '#EF4444' : row.dot }}
                    />
                    <span
                      className={`font-semibold ${inflamedNow ? 'text-risk-high' : 'text-text'}`}
                    >
                      {row.label}
                    </span>
                  </div>
                  <span className="tabular-nums text-text-muted">{row.range}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      )}

      {!isFullscreen && isErythema && (
        <div className="pointer-events-none absolute right-3 top-14 z-10 flex max-w-[240px] items-center gap-2 rounded-xl border border-risk-high/50 bg-surface/90 p-2.5 text-xs shadow-xl backdrop-blur-md">
          <Flame className="h-4 w-4 shrink-0 text-risk-high" />
          <div className="flex flex-col text-[10px] leading-tight">
            <strong className="font-semibold text-risk-high">
              {isSevereBurn ? 'Quemadura química' : 'Eritema tisular'}
            </strong>
            <span className="text-text-muted">
              {viewMode === 'macro'
                ? 'Roncha visible en la pared abdominal.'
                : 'Inflamación en queratinocitos viables y dermis.'}
            </span>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-border bg-surface/85 px-2 py-1.5 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
          <button
            onClick={handleGoMacro}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === 'macro' ? 'bg-surface text-text' : 'text-text-muted hover:text-text'
            }`}
            title="Vista del abdomen completo"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Abdomen</span>
          </button>

          <button
            onClick={handleGoMicro}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === 'micro' ? 'bg-surface text-text' : 'text-text-muted hover:text-text'
            }`}
            title="Corte celular capa por capa"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Celular</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <ZoomOut className="h-3 w-3 text-text-muted" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.005"
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="h-1.5 w-28 cursor-pointer appearance-none rounded-lg bg-surface-2 accent-accent"
            title="Zoom cinematográfico continuo entre el abdomen y las capas dérmicas"
            aria-label="Nivel de zoom del simulador"
          />
          <ZoomIn className="h-3 w-3 text-text-muted" />
        </div>
      </div>

      {!isFullscreen && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 text-[9px] text-text-muted">
          <span>* Rueda del ratón: viaje lento entre el abdomen y las capas celulares.</span>
        </div>
      )}
    </div>
  );
};
