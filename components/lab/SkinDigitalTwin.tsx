'use client';

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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

// Geometria del torso en unidades de escena. Sirve tanto para construir la malla
// como para encuadrar la camara de forma proporcionada en cualquier viewport.
const TORSO_WIDTH = 4.0;
const TORSO_HEIGHT = 5.0;
const TORSO_SCALE = 0.85;
const CAMERA_FOV = 40;

// Punto clinico de aplicacion sobre el abdomen (ya escalado).
const PATCH_X = 0.65 * TORSO_SCALE;
const PATCH_Y = -0.15 * TORSO_SCALE;
const PATCH_Z = 0.73 * TORSO_SCALE;

// Distancia de camara en la vista celular (corte capa por capa).
const MICRO_DISTANCE = 1.05;

// Umbral a partir del cual la vista se considera microscopica.
const MICRO_VIEW_THRESHOLD = 0.45;

// Zoom automatico al que viaja la camara al pulsar Play.
const AUTO_ZOOM_TARGET = 0.85;

// Corte histologico: cuatro capas que se seccionan de forma escalonada.
// `revealAt` marca el punto del viaje de camara en el que cada capa se abre.
const LAYER_DEFS = [
  { key: 'sc', name: 'Estrato Corneo', y: 0.15, h: 0.07, color: 0xd4af37, rough: 0.4, revealAt: 0.30 },
  { key: 've', name: 'Epidermis Viable', y: 0.05, h: 0.11, color: 0xe0a88a, rough: 0.6, revealAt: 0.44 },
  { key: 'de', name: 'Dermis', y: -0.10, h: 0.18, color: 0xc97b7b, rough: 0.7, revealAt: 0.58 },
  { key: 'hy', name: 'Hipodermis', y: -0.25, h: 0.12, color: 0xe8c87e, rough: 0.8, revealAt: 0.72 },
];

const REVEAL_SPAN = 0.16;

// Extremos verticales de la pila de capas, usados por el frente de difusion.
const STACK_TOP_Y = 0.185;
const STACK_BOTTOM_Y = -0.31;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Curva de aceleracion cinematografica: arranque y frenada suaves.
function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

// Progreso de apertura de una capa concreta para un valor de zoom dado.
function layerReveal(easedZoom: number, revealAt: number): number {
  return smoothstep((easedZoom - revealAt) / REVEAL_SPAN);
}

interface CellLayer {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  baseY: number;
  baseColor: number;
  revealAt: number;
}

// Estado quimico leido del motor y consumido por el loop de animacion.
// Ningun valor se calcula aqui: todos derivan de `result` (motor determinista).
interface ReactionState {
  layerLoad: number[]; // saturacion 0..1 del activo por capa
  frontDepth: number; // 0..1 profundidad del frente de difusion
  surfaceLoad: number; // 0..1 masa restante en el vehiculo
  inflammation: number; // 0..1 intensidad de la respuesta inflamatoria
  severe: boolean;
}

interface ThreeState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  torsoMesh: THREE.Mesh;
  torsoMaterial: THREE.MeshStandardMaterial;
  skinTextureCanvas: HTMLCanvasElement;
  skinTexture: THREE.CanvasTexture;
  patchRingMesh: THREE.Mesh;
  dropletMesh: THREE.Mesh;
  biopsyGroup: THREE.Group;
  cutawayOpeningMesh: THREE.Mesh;
  edgeHelper: THREE.LineSegments;
  frontMesh: THREE.Mesh;
  burnLight: THREE.PointLight;
  particleSystem: THREE.Points;
  cellLayers: CellLayer[];
  macroDistance: number;
  animFrameId: number;
}

export const SkinDigitalTwin: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

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

  const threeStateRef = useRef<ThreeState | null>(null);
  // Objetivo de zoom leido por el loop de render sin re-crear la escena.
  const zoomTargetRef = useRef<number>(zoomLevel);
  // Zoom efectivamente renderizado: persigue al objetivo con interpolacion lenta.
  const zoomRenderRef = useRef<number>(zoomLevel);
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

  // Normalizador de concentracion: maximo sobre toda la simulacion.
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

  // 1. Inicializacion de la escena Three.js
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // A. Escena en negro puro (modo laboratorio oscuro)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.035);

    // B. Camara perspectiva
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 60);
    const macroLookAt = new THREE.Vector3(0, -0.15 * TORSO_SCALE, 0);

    // Distancia que encuadra el abdomen completo con margen, segun el aspecto real
    // del viewport: el modelo nunca aparece gigante ni desbordado.
    const computeMacroDistance = (aspect: number): number => {
      const halfFov = THREE.MathUtils.degToRad(CAMERA_FOV) / 2;
      const halfH = (TORSO_HEIGHT * TORSO_SCALE) / 2;
      const halfW = (TORSO_WIDTH * TORSO_SCALE) / 2;
      const distForHeight = halfH / Math.tan(halfFov);
      const distForWidth = halfW / (Math.tan(halfFov) * Math.max(aspect, 0.2));
      return Math.max(distForHeight, distForWidth) * 1.18;
    };

    let macroDistance = computeMacroDistance(width / height);
    camera.position.set(0, macroLookAt.y, macroDistance);
    camera.lookAt(macroLookAt);

    // C. Renderer WebGL
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // D. Orbita. El dolly nativo queda desactivado: el acercamiento lo gobierna
    // el zoom cinematico amortiguado del loop de render.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.035;
    controls.rotateSpeed = 0.5;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.target.copy(macroLookAt);

    // E. Iluminacion anatomica
    scene.add(new THREE.AmbientLight(0x1b1f26, 1.5));

    const mainDirLight = new THREE.DirectionalLight(0xfff5ea, 2.3);
    mainDirLight.position.set(3.5, 4.5, 4.5);
    scene.add(mainDirLight);

    const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.2);
    rimLight.position.set(-4.0, 1.5, 2.5);
    scene.add(rimLight);

    const burnLight = new THREE.PointLight(0xef4444, 0, 3.5);
    burnLight.position.set(PATCH_X, PATCH_Y, 0.45);
    scene.add(burnLight);

    // F. Malla del torso / abdomen
    const torsoGeom = new THREE.PlaneGeometry(TORSO_WIDTH, TORSO_HEIGHT, 90, 90);
    const posAttr = torsoGeom.attributes.position;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);

      let z = Math.cos((x / 2.0) * (Math.PI * 0.48)) * 0.92 - Math.abs(x) * 0.14;

      if (y > 0.8 && y < 2.4) {
        const ribY = (y - 0.8) / 1.6;
        z += Math.sin(ribY * Math.PI) * (0.07 + Math.abs(x) * 0.05);
      }

      const distMedial = Math.abs(x);
      z -= Math.exp(-distMedial * 8.0) * 0.06;

      if (distMedial > 0.15 && distMedial < 0.9 && y > -1.8 && y < 1.6) {
        const rectusWave = Math.cos(y * 2.8) * 0.035 + 0.04;
        z += rectusWave * (1.0 - Math.abs(distMedial - 0.5) * 1.8);
      }

      const distNavel = Math.hypot(x - 0.0, y - -0.55);
      if (distNavel < 0.35) {
        z -= Math.exp(-distNavel * 12.0) * 0.28;
      }

      posAttr.setZ(i, z);
    }
    torsoGeom.computeVertexNormals();

    const skinCanvas = document.createElement('canvas');
    skinCanvas.width = 1024;
    skinCanvas.height = 1024;
    const skinTexture = new THREE.CanvasTexture(skinCanvas);
    skinTexture.wrapS = THREE.ClampToEdgeWrapping;
    skinTexture.wrapT = THREE.ClampToEdgeWrapping;
    skinTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const torsoMat = new THREE.MeshStandardMaterial({
      map: skinTexture,
      roughness: 0.58,
      metalness: 0.04,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    });

    const torsoMesh = new THREE.Mesh(torsoGeom, torsoMat);
    torsoMesh.scale.setScalar(TORSO_SCALE);
    scene.add(torsoMesh);

    // G. Parche clinico y menisco de vehiculo
    const patchRingGeom = new THREE.RingGeometry(0.15, 0.18, 48);
    const patchRingMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const patchRingMesh = new THREE.Mesh(patchRingGeom, patchRingMat);
    patchRingMesh.position.set(PATCH_X, PATCH_Y, PATCH_Z);
    scene.add(patchRingMesh);

    const dropletGeom = new THREE.CircleGeometry(0.15, 48);
    const dropletMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const dropletMesh = new THREE.Mesh(dropletGeom, dropletMat);
    dropletMesh.position.set(PATCH_X, PATCH_Y, PATCH_Z - 0.001);
    scene.add(dropletMesh);

    // H. Corte histologico capa por capa
    const biopsyGroup = new THREE.Group();
    biopsyGroup.position.set(PATCH_X, PATCH_Y, 0.22);
    biopsyGroup.visible = false;
    scene.add(biopsyGroup);

    const cellLayers: CellLayer[] = [];

    LAYER_DEFS.forEach((ld) => {
      const boxGeom = new THREE.BoxGeometry(0.44, ld.h, 0.38);
      const boxMat = new THREE.MeshStandardMaterial({
        color: ld.color,
        roughness: ld.rough,
        metalness: 0.05,
        transparent: true,
        opacity: 0,
      });
      const layerMesh = new THREE.Mesh(boxGeom, boxMat);
      layerMesh.position.set(0, ld.y, 0);
      layerMesh.visible = false;
      biopsyGroup.add(layerMesh);
      cellLayers.push({
        mesh: layerMesh,
        material: boxMat,
        baseY: ld.y,
        baseColor: ld.color,
        revealAt: ld.revealAt,
      });
    });

    const edgeBoxGeom = new THREE.BoxGeometry(0.445, 0.5, 0.385);
    const edgeHelper = new THREE.LineSegments(
      new THREE.EdgesGeometry(edgeBoxGeom),
      new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0 })
    );
    edgeHelper.position.set(0, -0.04, 0);
    biopsyGroup.add(edgeHelper);

    // Frente de difusion: lamina que desciende a la profundidad calculada por el motor.
    const frontGeom = new THREE.BoxGeometry(0.46, 0.006, 0.4);
    const frontMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0,
    });
    const frontMesh = new THREE.Mesh(frontGeom, frontMat);
    frontMesh.position.set(0, STACK_TOP_Y, 0);
    biopsyGroup.add(frontMesh);

    // Particulas del activo penetrando capa por capa
    const particleCount = 140;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let p = 0; p < particleCount; p++) {
      particlePositions[p * 3] = (Math.random() - 0.5) * 0.38;
      particlePositions[p * 3 + 1] = STACK_TOP_Y - Math.random() * 0.1;
      particlePositions[p * 3 + 2] = (Math.random() - 0.5) * 0.32;
    }
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x22d3ee,
      size: 0.016,
      transparent: true,
      opacity: 0,
    });
    const particleSystem = new THREE.Points(particleGeom, particleMat);
    biopsyGroup.add(particleSystem);

    // Abertura de la incision sobre la piel
    const cutawayGeom = new THREE.RingGeometry(0.22, 0.3, 48);
    const cutawayMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const cutawayOpeningMesh = new THREE.Mesh(cutawayGeom, cutawayMat);
    cutawayOpeningMesh.position.set(PATCH_X, PATCH_Y, PATCH_Z - 0.005);
    scene.add(cutawayOpeningMesh);

    threeStateRef.current = {
      scene,
      camera,
      renderer,
      controls,
      torsoMesh,
      torsoMaterial: torsoMat,
      skinTextureCanvas: skinCanvas,
      skinTexture,
      patchRingMesh,
      dropletMesh,
      biopsyGroup,
      cutawayOpeningMesh,
      edgeHelper,
      frontMesh,
      burnLight,
      particleSystem,
      cellLayers,
      macroDistance,
      animFrameId: 0,
    };

    // I. Loop de render: zoom cinematico, apertura del corte y reaccion quimica
    const macroLook = macroLookAt.clone();
    const microLook = new THREE.Vector3(PATCH_X, PATCH_Y, 0.16);
    const desiredLook = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const chemColor = new THREE.Color();
    const inflamedColor = new THREE.Color(0xef4444);
    const severeColor = new THREE.Color(0xdc2626);
    const baseColor = new THREE.Color();

    let timeClock = 0;

    const animate = () => {
      const state = threeStateRef.current;
      if (!state) return;

      timeClock += 0.02;

      // Persecucion lenta del objetivo de zoom (interpolacion amortiguada).
      zoomRenderRef.current += (zoomTargetRef.current - zoomRenderRef.current) * 0.035;
      const eased = smoothstep(zoomRenderRef.current);
      const reaction = reactionRef.current;

      // Encuadre: la mirada viaja del abdomen al parche y la distancia se cierra.
      desiredLook.lerpVectors(macroLook, microLook, eased);
      state.controls.target.lerp(desiredLook, 0.06);

      const desiredDistance = THREE.MathUtils.lerp(state.macroDistance, MICRO_DISTANCE, eased);
      offset.copy(state.camera.position).sub(state.controls.target);
      const currentDistance = Math.max(offset.length(), 0.0001);
      offset.setLength(THREE.MathUtils.lerp(currentDistance, desiredDistance, 0.06));
      state.camera.position.copy(state.controls.target).add(offset);

      state.controls.update();

      // La piel exterior se abre a medida que la camara se acerca.
      const skinFade = smoothstep((eased - 0.22) / 0.5);
      state.torsoMaterial.opacity = THREE.MathUtils.lerp(1, 0.06, skinFade);
      state.torsoMesh.visible = state.torsoMaterial.opacity > 0.02;

      const ringPulse = 1.0 + Math.sin(timeClock * 3.0) * 0.05;
      state.patchRingMesh.scale.set(ringPulse, ringPulse, 1.0);
      (state.patchRingMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.85 - skinFade * 0.85
      );
      // El menisco de vehiculo se consume conforme el activo penetra.
      (state.dropletMesh.material as THREE.MeshStandardMaterial).opacity =
        Math.max(0, 0.4 * reaction.surfaceLoad) * (1 - skinFade);
      const dropScale = 0.75 + reaction.surfaceLoad * 0.25;
      state.dropletMesh.scale.set(dropScale, dropScale, 1);

      // Incision: el anillo de corte se dilata mientras la piel se secciona.
      const cutaway = smoothstep((eased - 0.18) / 0.3);
      const cutawayMaterial = state.cutawayOpeningMesh.material as THREE.MeshBasicMaterial;
      cutawayMaterial.opacity = cutaway * (1 - skinFade) * 0.9;
      state.cutawayOpeningMesh.scale.setScalar(0.7 + cutaway * 1.1);
      state.cutawayOpeningMesh.visible = cutawayMaterial.opacity > 0.01;

      // Apertura escalonada: Estrato Corneo, Epidermis Viable, Dermis, Hipodermis.
      state.biopsyGroup.visible = eased > 0.02;
      state.biopsyGroup.scale.setScalar(0.55 + eased * 0.45);

      const breath = 0.5 + Math.sin(timeClock * 2.4) * 0.5;

      state.cellLayers.forEach((layer, idx) => {
        const reveal = layerReveal(eased, layer.revealAt);
        layer.material.opacity = reveal;
        layer.mesh.visible = reveal > 0.01;
        // Cada capa desciende a su posicion anatomica al seccionarse.
        layer.mesh.position.y = layer.baseY + (1 - reveal) * 0.09;
        layer.mesh.scale.set(0.9 + reveal * 0.1, 1, 0.9 + reveal * 0.1);

        // Reaccion quimica: la capa se tine segun la carga de activo que
        // el motor reporta en ella, y enrojece si hay respuesta inflamatoria.
        const load = reaction.layerLoad[idx] ?? 0;
        const inflame = idx === 1 || idx === 2 ? reaction.inflammation : reaction.inflammation * 0.35;

        baseColor.setHex(layer.baseColor);
        chemColor.copy(baseColor).lerp(new THREE.Color(0x1d6e8e), load * 0.55);
        chemColor.lerp(reaction.severe ? severeColor : inflamedColor, inflame);
        layer.material.color.copy(chemColor);

        layer.material.emissive.setHex(
          inflame > 0.05 ? (reaction.severe ? 0x7f1d1d : 0x450a0a) : 0x0b3a45
        );
        layer.material.emissiveIntensity =
          load * 0.18 + inflame * (0.3 + breath * 0.25);
      });

      (state.edgeHelper.material as THREE.LineBasicMaterial).opacity =
        smoothstep((eased - 0.26) / 0.25) * 0.4;

      // Frente de difusion: profundidad exacta reportada por el motor.
      const frontY = THREE.MathUtils.lerp(STACK_TOP_Y, STACK_BOTTOM_Y, reaction.frontDepth);
      state.frontMesh.position.y += (frontY - state.frontMesh.position.y) * 0.08;
      const frontMaterial = state.frontMesh.material as THREE.MeshBasicMaterial;
      frontMaterial.opacity = smoothstep((eased - 0.3) / 0.25) * (0.35 + breath * 0.35);
      frontMaterial.color.setHex(reaction.inflammation > 0.4 ? 0xef4444 : 0x22d3ee);
      state.frontMesh.visible = frontMaterial.opacity > 0.02;

      // Particulas: velocidad proporcional a la carga y acumulacion en el frente.
      const particleMaterial = state.particleSystem.material as THREE.PointsMaterial;
      particleMaterial.opacity = smoothstep((eased - 0.34) / 0.25) * (0.45 + reaction.surfaceLoad * 0.45);
      particleMaterial.color.setHex(reaction.inflammation > 0.4 ? 0xf87171 : 0x22d3ee);

      const descentSpeed = 0.0008 + reaction.frontDepth * 0.0032;
      const pPos = state.particleSystem.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        let y = pPos.getY(i) - descentSpeed;
        if (y < frontY) y = STACK_TOP_Y;
        pPos.setY(i, y);
      }
      pPos.needsUpdate = true;

      state.renderer.render(state.scene, state.camera);
      state.animFrameId = requestAnimationFrame(animate);
    };

    animate();

    // J. Reencuadre ante cualquier cambio de tamano del contenedor,
    // incluidas la entrada y la salida de pantalla completa.
    const applySize = () => {
      const state = threeStateRef.current;
      if (!state || !container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      state.camera.aspect = w / h;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(w, h);
      macroDistance = computeMacroDistance(w / h);
      state.macroDistance = macroDistance;
    };

    const resizeObserver = new ResizeObserver(applySize);
    resizeObserver.observe(container);
    window.addEventListener('resize', applySize);

    // K. Zoom cinematico con la rueda: incremento pequeno y normalizado.
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const normalized = Math.max(-1, Math.min(1, e.deltaY / 100));
      setZoomLevel((prev) => prev - normalized * 0.04);
    };
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', applySize);
      container.removeEventListener('wheel', handleWheel);

      const state = threeStateRef.current;
      if (state) {
        cancelAnimationFrame(state.animFrameId);
        state.cellLayers.forEach((l) => {
          l.mesh.geometry.dispose();
          l.material.dispose();
        });
        state.edgeHelper.geometry.dispose();
        (state.edgeHelper.material as THREE.Material).dispose();
        frontGeom.dispose();
        frontMat.dispose();
        particleGeom.dispose();
        particleMat.dispose();
        patchRingGeom.dispose();
        patchRingMat.dispose();
        dropletGeom.dispose();
        dropletMat.dispose();
        cutawayGeom.dispose();
        cutawayMat.dispose();
        edgeBoxGeom.dispose();
        controls.dispose();
        renderer.dispose();
        torsoGeom.dispose();
        torsoMat.dispose();
        skinTexture.dispose();
        threeStateRef.current = null;
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
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

    // Inflamacion: solo aparece una vez superado el lag time, escalada por el
    // indice heuristico de irritacion que reporta el motor.
    const lagTime = metrics?.lagTimeHours ?? 2;
    const afterLag = currentFrame.timeHours >= Math.min(lagTime, frames[frames.length - 1].timeHours);
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

  // 3. Eritema pintado sobre la textura de la piel del abdomen
  useEffect(() => {
    if (!threeStateRef.current || !result || !currentFrame) return;

    const { skinTextureCanvas, skinTexture, burnLight } = threeStateRef.current;

    const ctx = skinTextureCanvas.getContext('2d');
    if (!ctx) return;

    const w = skinTextureCanvas.width;
    const h = skinTextureCanvas.height;

    const skinGrad = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.1, w * 0.5, h * 0.5, w * 0.65);
    skinGrad.addColorStop(0.0, '#D9A98D');
    skinGrad.addColorStop(0.5, '#CF9D81');
    skinGrad.addColorStop(1.0, '#B68469');

    ctx.fillStyle = skinGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, 12, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6E4432';
    ctx.filter = 'blur(4px)';
    ctx.fill();
    ctx.restore();

    const patchU = w * (0.5 + 0.65 / TORSO_WIDTH);
    const patchV = h * (0.5 + 0.15 / TORSO_HEIGHT);

    const currentTime = currentFrame.timeHours;
    const lagTime = metrics?.lagTimeHours ?? 2.0;

    if (isErythema && currentTime >= Math.min(lagTime * 0.4, 1.0)) {
      const timeFactor = Math.min(1.0, currentTime / (lagTime + 3.0));
      const rashRadius = (isSevereBurn ? 135 : 90) * timeFactor;

      ctx.save();
      const rashGrad = ctx.createRadialGradient(patchU, patchV, 5, patchU, patchV, rashRadius);

      if (isSevereBurn) {
        rashGrad.addColorStop(0.0, 'rgba(185, 28, 28, 0.95)');
        rashGrad.addColorStop(0.4, 'rgba(220, 38, 38, 0.85)');
        rashGrad.addColorStop(0.7, 'rgba(239, 68, 68, 0.55)');
        rashGrad.addColorStop(1.0, 'rgba(239, 68, 68, 0.0)');
      } else {
        rashGrad.addColorStop(0.0, 'rgba(239, 68, 68, 0.75)');
        rashGrad.addColorStop(0.5, 'rgba(248, 113, 113, 0.45)');
        rashGrad.addColorStop(1.0, 'rgba(248, 113, 113, 0.0)');
      }

      ctx.fillStyle = rashGrad;
      ctx.beginPath();
      ctx.arc(patchU, patchV, rashRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      burnLight.intensity = isSevereBurn ? 2.8 : 1.4;
      burnLight.color.setHex(isSevereBurn ? 0xdc2626 : 0xef4444);
    } else {
      burnLight.intensity = 0;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(patchU, patchV, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    skinTexture.needsUpdate = true;
  }, [result, currentFrame, isErythema, isSevereBurn, metrics]);

  // 4. Zoom automatico y lento al pulsar Play: la camara viaja sola hasta el
  // area donde ocurre la reaccion quimica. Se detiene al alcanzar el objetivo.
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

  // Salir de pantalla completa con Escape (tambien detiene la voz).
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

  // Al desmontar, nunca dejar voz sonando.
  useEffect(() => () => stopSpeech(), []);

  const layerHudRows = [
    { label: '1. Estrato corneo', range: '0 – 15 µm', dot: '#D4AF37', inflamed: false },
    { label: '2. Epidermis viable', range: '15 – 100 µm', dot: '#E0A88A', inflamed: isErythema },
    { label: '3. Dermis', range: '100 – 1500 µm', dot: '#C97B7B', inflamed: isErythema },
    { label: '4. Hipodermis', range: '> 1500 µm', dot: '#E8C87E', inflamed: false },
  ];

  return (
    <div
      className={`relative overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen bg-bg' : 'h-full w-full bg-bg'
      }`}
    >
      {/* Lienzo WebGL a altura completa: sin barras superiores sobre el visor */}
      <div
        ref={mountRef}
        className="absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
      />

      {/* Boton flotante de pantalla completa */}
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

      {/* Estado de tolerancia / irritacion */}
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

      {/* HUD de inspeccion capa por capa */}
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
                    <span className={`font-semibold ${inflamedNow ? 'text-risk-high' : 'text-text'}`}>
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

      {/* Aviso de reaccion activa */}
      {isErythema && (
        <div className="pointer-events-none absolute right-3 top-14 z-10 flex max-w-[240px] items-center gap-2 rounded-xl border border-risk-high/50 bg-surface/90 p-2.5 text-xs text-text shadow-xl backdrop-blur-md">
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

      {/* Controles flotantes de camara: nada obstruye la parte superior del visor */}
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-border bg-surface/85 px-2 py-1.5 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
          <button
            onClick={handleGoMacro}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === 'macro'
                ? 'bg-surface text-text'
                : 'text-text-muted hover:text-text'
            }`}
            title="Vista del abdomen completo"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Abdomen</span>
          </button>

          <button
            onClick={handleGoMicro}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === 'micro'
                ? 'bg-surface text-text'
                : 'text-text-muted hover:text-text'
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

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 text-[9px] text-text-muted">
        <span>* Rueda del ratón: viaje lento entre el abdomen y las capas celulares.</span>
      </div>
    </div>
  );
};
