'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useLabStore } from '@/lib/store/useLabStore';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Flame,
  AlertTriangle,
  Sparkles,
  Maximize2,
  Minimize2,
  Info,
  RotateCcw,
  Activity,
  Droplet,
  Eye,
  Volume2,
  Play,
  Pause,
} from 'lucide-react';
import { speakSimulationState } from '@/lib/narrator-speech';

export const SkinDigitalTwin: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const {
    result,
    currentFrameIndex,
    zoomLevel,
    setZoomLevel,
    getIngredient,
    getVehicle,
    getSite,
  } = useLabStore();

  const [viewMode, setViewMode] = useState<'macro' | 'micro'>('macro');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentFrame = result?.frames[currentFrameIndex];
  const metrics = result?.metrics;
  const currentIngredient = getIngredient();
  const currentVehicle = getVehicle();
  const currentSite = getSite();

  const irritationIndex = metrics?.irritationIndex ?? 0;
  const isErythema = irritationIndex >= 45;
  const isSevereBurn = irritationIndex >= 70;

  // Refs mutables para Three.js
  const threeStateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    torsoMesh: THREE.Mesh;
    skinTextureCanvas: HTMLCanvasElement;
    skinTexture: THREE.CanvasTexture;
    patchRingMesh: THREE.Mesh;
    biopsyGroup: THREE.Group;
    cutawayOpeningMesh: THREE.Mesh;
    burnLight: THREE.PointLight;
    particleSystem: THREE.Points;
    cellLayers: THREE.Mesh[];
    targetCameraPos: THREE.Vector3;
    targetLookAt: THREE.Vector3;
    animFrameId: number;
  } | null>(null);

  // 1. Inicialización de la Escena Three.js
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // A. Escena y Fondo de Laboratorio (Negro Claro Minimalista)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12141A);
    scene.fog = new THREE.FogExp2(0x12141A, 0.04);

    // B. Cámara Perspectiva (Encuadre más lejano para que el abdomen se vea proporcionado)
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    const macroCamPos = new THREE.Vector3(0.0, -0.1, 7.2);
    const macroLookAt = new THREE.Vector3(0.0, -0.15, 0.0);
    camera.position.copy(macroCamPos);
    camera.lookAt(macroLookAt);

    // C. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // D. Controles de Cámara (Orbit suave y lento)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.035; // Amortiguación suave y deliberada
    controls.rotateSpeed = 0.55;
    controls.minDistance = 0.6;
    controls.maxDistance = 10.0;
    controls.target.copy(macroLookAt);

    // E. Iluminación Anatómica y de Laboratorio
    const ambientLight = new THREE.AmbientLight(0x283344, 1.4);
    scene.add(ambientLight);

    const mainDirLight = new THREE.DirectionalLight(0xFFF5EA, 2.3);
    mainDirLight.position.set(3.5, 4.5, 4.5);
    scene.add(mainDirLight);

    const rimLight = new THREE.DirectionalLight(0x38BDF8, 1.5);
    rimLight.position.set(-4.0, 1.5, 2.5);
    scene.add(rimLight);

    // Luz reactiva puntual para quemadura / eritema celular
    const patchX = 0.65 * 0.85;
    const patchY = -0.15 * 0.85;
    const patchZ = 0.73 * 0.85;

    const burnLight = new THREE.PointLight(0xEF4444, 0, 3.5);
    burnLight.position.set(patchX, patchY, 0.45);
    scene.add(burnLight);

    // F. Malla 3D del Torso / Abdomen Anatómico Realista (Escalado proporcionado)
    const torsoGeom = new THREE.PlaneGeometry(4.0, 5.0, 90, 90);
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

      const distNavel = Math.hypot(x - 0.0, y - (-0.55));
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

    const torsoMat = new THREE.MeshStandardMaterial({
      map: skinTexture,
      roughness: 0.58,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });

    const torsoMesh = new THREE.Mesh(torsoGeom, torsoMat);
    torsoMesh.scale.set(0.85, 0.85, 0.85);
    scene.add(torsoMesh);

    // G. Parche / Anillo Clínico de Aplicación en Abdomen
    const patchRingGeom = new THREE.RingGeometry(0.15, 0.18, 48);
    const patchRingMat = new THREE.MeshBasicMaterial({
      color: 0x38BDF8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const patchRingMesh = new THREE.Mesh(patchRingGeom, patchRingMat);
    patchRingMesh.position.set(patchX, patchY, patchZ);
    scene.add(patchRingMesh);

    // Gota / Menisco de suero cosmético sobre la piel
    const dropletGeom = new THREE.CircleGeometry(0.15, 48);
    const dropletMat = new THREE.MeshStandardMaterial({
      color: 0x38BDF8,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const dropletMesh = new THREE.Mesh(dropletGeom, dropletMat);
    dropletMesh.position.set(patchX, patchY, patchZ - 0.001);
    scene.add(dropletMesh);

    // H. Grupo Biopsia 3D Micro (Estructura Celular Interna Capa por Capa)
    const biopsyGroup = new THREE.Group();
    biopsyGroup.position.set(patchX, patchY, 0.22);
    scene.add(biopsyGroup);

    const cellLayers: THREE.Mesh[] = [];
    const layerDefs = [
      { name: 'SC', y: 0.15, h: 0.07, color: 0xD4AF37, rough: 0.4 }, // Estrato Córneo
      { name: 'VE', y: 0.05, h: 0.11, color: 0xE0A88A, rough: 0.6 }, // Epidermis Viable
      { name: 'DE', y: -0.10, h: 0.18, color: 0xC97B7B, rough: 0.7 }, // Dermis
      { name: 'HY', y: -0.25, h: 0.12, color: 0xE8C87E, rough: 0.8 }, // Hipodermis
    ];

    layerDefs.forEach((ld) => {
      const boxGeom = new THREE.BoxGeometry(0.44, ld.h, 0.38);
      const boxMat = new THREE.MeshStandardMaterial({
        color: ld.color,
        roughness: ld.rough,
        metalness: 0.05,
      });
      const layerMesh = new THREE.Mesh(boxGeom, boxMat);
      layerMesh.position.set(0, ld.y, 0);
      biopsyGroup.add(layerMesh);
      cellLayers.push(layerMesh);
    });

    const boxEdges = new THREE.BoxGeometry(0.445, 0.50, 0.385);
    const edgeHelper = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxEdges),
      new THREE.LineBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.4 })
    );
    edgeHelper.position.set(0, -0.04, 0);
    biopsyGroup.add(edgeHelper);

    // Sistema de partículas moleculares descendiendo capa por capa
    const particleCount = 110;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let p = 0; p < particleCount; p++) {
      particlePositions[p * 3] = (Math.random() - 0.5) * 0.38;
      particlePositions[p * 3 + 1] = 0.18 - Math.random() * 0.42;
      particlePositions[p * 3 + 2] = (Math.random() - 0.5) * 0.32;
    }
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x38BDF8,
      size: 0.016,
      transparent: true,
      opacity: 0.85,
    });
    const particleSystem = new THREE.Points(particleGeom, particleMat);
    biopsyGroup.add(particleSystem);

    // Abertura de corte en piel
    const cutawayGeom = new THREE.RingGeometry(0.22, 0.30, 48);
    const cutawayMat = new THREE.MeshBasicMaterial({
      color: 0x12141A,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const cutawayOpeningMesh = new THREE.Mesh(cutawayGeom, cutawayMat);
    cutawayOpeningMesh.position.set(patchX, patchY, patchZ - 0.005);
    scene.add(cutawayOpeningMesh);

    // I. Estado inicial Three.js
    threeStateRef.current = {
      scene,
      camera,
      renderer,
      controls,
      torsoMesh,
      skinTextureCanvas: skinCanvas,
      skinTexture,
      patchRingMesh,
      biopsyGroup,
      cutawayOpeningMesh,
      burnLight,
      particleSystem,
      cellLayers,
      targetCameraPos: macroCamPos.clone(),
      targetLookAt: macroLookAt.clone(),
      animFrameId: 0,
    };

    // J. Loop de Renderizado con Lerp LENTO y SUAVE (0.035)
    let timeClock = 0;
    const animate = () => {
      timeClock += 0.02;

      if (threeStateRef.current) {
        const {
          camera,
          renderer,
          scene,
          controls,
          patchRingMesh,
          particleSystem,
          targetCameraPos,
          targetLookAt,
        } = threeStateRef.current;

        // Suavizado LENTO y correcto de cámara
        camera.position.lerp(targetCameraPos, 0.035);
        controls.target.lerp(targetLookAt, 0.035);
        controls.update();

        const pulse = 1.0 + Math.sin(timeClock * 3.0) * 0.05;
        patchRingMesh.scale.set(pulse, pulse, 1.0);

        // Movimiento de penetración química capa por capa
        const pPos = particleSystem.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < particleCount; i++) {
          let y = pPos.getY(i) - 0.0015;
          if (y < -0.30) {
            y = 0.18;
          }
          pPos.setY(i, y);
        }
        pPos.needsUpdate = true;

        renderer.render(scene, camera);
      }

      threeStateRef.current!.animFrameId = requestAnimationFrame(animate);
    };

    animate();

    // K. Resize handler
    const handleResize = () => {
      if (!container || !threeStateRef.current) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 600;
      threeStateRef.current.camera.aspect = w / h;
      threeStateRef.current.camera.updateProjectionMatrix();
      threeStateRef.current.renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // L. Zoom Lento y Controlado con rueda de ratón (delta = 0.025)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoomLevel((prev) => {
        const delta = e.deltaY > 0 ? -0.025 : 0.025;
        return Math.max(0.0, Math.min(1.0, prev + delta));
      });
    };
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('wheel', handleWheel);

      if (threeStateRef.current) {
        cancelAnimationFrame(threeStateRef.current.animFrameId);
        controls.dispose();
        renderer.dispose();
        torsoGeom.dispose();
        torsoMat.dispose();
        skinTexture.dispose();
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Sincronización del Zoom Lento (Macro ⇄ Micro)
  useEffect(() => {
    if (!threeStateRef.current) return;

    const {
      targetCameraPos,
      targetLookAt,
      biopsyGroup,
      patchRingMesh,
    } = threeStateRef.current;

    const macroCam = new THREE.Vector3(0.0, -0.1, 7.2);
    const macroLook = new THREE.Vector3(0.0, -0.15, 0.0);

    const patchX = 0.65 * 0.85;
    const patchY = -0.15 * 0.85;
    const microCam = new THREE.Vector3(patchX, patchY, 1.05);
    const microLook = new THREE.Vector3(patchX, patchY, 0.12);

    targetCameraPos.lerpVectors(macroCam, microCam, zoomLevel);
    targetLookAt.lerpVectors(macroLook, microLook, zoomLevel);

    if (zoomLevel > 0.4) {
      biopsyGroup.visible = true;
      biopsyGroup.scale.setScalar(0.75 + zoomLevel * 0.25);
    } else {
      biopsyGroup.visible = zoomLevel > 0.15;
      biopsyGroup.scale.setScalar(Math.max(0.01, zoomLevel * 2.0));
    }

    (patchRingMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
      0.1,
      1.0 - zoomLevel * 0.9
    );

    setViewMode(zoomLevel > 0.5 ? 'micro' : 'macro');
  }, [zoomLevel]);

  // 3. Reacción Química y Eritema Capa por Capa
  useEffect(() => {
    if (!threeStateRef.current || !result || !currentFrame) return;

    const {
      skinTextureCanvas,
      skinTexture,
      burnLight,
      cellLayers,
      particleSystem,
    } = threeStateRef.current;

    const ctx = skinTextureCanvas.getContext('2d')!;
    const w = skinTextureCanvas.width;
    const h = skinTextureCanvas.height;

    // A. Superficie del Abdomen (Piel Natural con Melanosomas)
    const skinGrad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.55,
      w * 0.1,
      w * 0.5,
      h * 0.5,
      w * 0.65
    );
    skinGrad.addColorStop(0.0, '#D9A98D');
    skinGrad.addColorStop(0.5, '#CF9D81');
    skinGrad.addColorStop(1.0, '#B68469');

    ctx.fillStyle = skinGrad;
    ctx.fillRect(0, 0, w, h);

    // Ombligo
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, 12, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6E4432';
    ctx.filter = 'blur(4px)';
    ctx.fill();
    ctx.restore();

    // B. Reacción de Eritema / Roncha en la Superficie del Abdomen
    const patchU = w * (0.5 + 0.65 / 4.0);
    const patchV = h * (0.5 - -0.15 / 5.0);

    const currentTime = currentFrame.timeHours;
    const lagTime = metrics?.lagTimeHours ?? 2.0;

    if (isErythema && currentTime >= Math.min(lagTime * 0.4, 1.0)) {
      const timeFactor = Math.min(1.0, currentTime / (lagTime + 3.0));
      const rashRadius = isSevereBurn ? 135 * timeFactor : 90 * timeFactor;

      ctx.save();
      const rashGrad = ctx.createRadialGradient(
        patchU,
        patchV,
        5,
        patchU,
        patchV,
        rashRadius
      );

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
      burnLight.color.setHex(isSevereBurn ? 0xDC2626 : 0xEF4444);
    } else {
      burnLight.intensity = 0;
    }

    // Parche tópico
    ctx.save();
    ctx.beginPath();
    ctx.arc(patchU, patchV, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    skinTexture.needsUpdate = true;

    // C. Reacción Capa por Capa a Nivel Celular Micro
    if (cellLayers.length >= 4) {
      const scLayer = cellLayers[0]; // Estrato Córneo
      const veLayer = cellLayers[1]; // Epidermis Viable (Diana de quemadura)
      const deLayer = cellLayers[2]; // Dermis Capilar
      const hyLayer = cellLayers[3]; // Hipodermis

      const scMat = scLayer.material as THREE.MeshStandardMaterial;
      const veMat = veLayer.material as THREE.MeshStandardMaterial;
      const deMat = deLayer.material as THREE.MeshStandardMaterial;

      if (isErythema && currentTime >= lagTime) {
        // Epidermis Viable enrojecida por estrés oxidativo / quemadura
        veMat.color.setHex(isSevereBurn ? 0xDC2626 : 0xEF4444);
        veMat.emissive.setHex(isSevereBurn ? 0x7F1D1D : 0x450A0A);
        veMat.emissiveIntensity = 0.55;

        // Dermis vasodilatada en rojo capilar
        deMat.color.setHex(isSevereBurn ? 0xB91C1C : 0xDC2626);
        deMat.emissive.setHex(0x3B0707);
        deMat.emissiveIntensity = 0.35;
      } else {
        veMat.color.setHex(0xE0A88A);
        veMat.emissive.setHex(0x000000);
        veMat.emissiveIntensity = 0.0;

        deMat.color.setHex(0xC97B7B);
        deMat.emissive.setHex(0x000000);
        deMat.emissiveIntensity = 0.0;
      }

      const pMat = particleSystem.material as THREE.PointsMaterial;
      pMat.color.setHex(isSevereBurn ? 0xF87171 : 0x38BDF8);
    }
  }, [result, currentFrame, isErythema, isSevereBurn, metrics]);

  // Manejadores de zoom botones
  const handleGoMacro = useCallback(() => setZoomLevel(0.0), [setZoomLevel]);
  const handleGoMicro = useCallback(() => setZoomLevel(1.0), [setZoomLevel]);

  // Manejador de Pantalla Grande (Tamaño pestaña completa) con voz
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;

      setTimeout(() => {
        if (threeStateRef.current && mountRef.current) {
          const w = mountRef.current.clientWidth;
          const h = mountRef.current.clientHeight;
          threeStateRef.current.camera.aspect = w / h;
          threeStateRef.current.camera.updateProjectionMatrix();
          threeStateRef.current.renderer.setSize(w, h);
        }
      }, 120);

      if (next && result) {
        speakSimulationState(
          result,
          currentFrameIndex,
          'Pantalla completa activada. Iniciando monitoreo inmersivo en alta resolución'
        );
      }

      return next;
    });
  }, [result, currentFrameIndex]);

  return (
    <div
      className={`relative flex flex-col overflow-hidden transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen rounded-none border-none bg-bg p-3'
          : 'h-full w-full bg-bg'
      }`}
    >
      {/* Barra de Control de Cámara Superior */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-surface/80 px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Toggles Macro / Micro */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
            <button
              onClick={handleGoMacro}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'macro'
                  ? 'bg-accent text-bg font-bold shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
              title="Vista de cuerpo entero y contorno del abdomen"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Abdomen</span>
            </button>

            <button
              onClick={handleGoMicro}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'micro'
                  ? 'bg-accent text-bg font-bold shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
              title="Zoom microscópico celular y corte de capas dérmicas"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Celular</span>
            </button>
          </div>

          {/* Slider de zoom lento */}
          <div className="flex items-center gap-1.5 pl-1 text-xs">
            <ZoomOut className="h-3 w-3 text-text-muted" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
              className="h-1.5 w-24 cursor-pointer appearance-none rounded-lg bg-surface-2 accent-accent"
              title="Zoom continuo lento y progresivo"
            />
            <ZoomIn className="h-3 w-3 text-accent" />
            <span className="font-mono text-[10px] tabular-nums text-text-muted">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Alerta de quemadura / tolerancia */}
          {isErythema ? (
            <div
              className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold border ${
                isSevereBurn
                  ? 'border-red-500 bg-red-950/60 text-red-200 animate-pulse'
                  : 'border-amber-500/50 bg-amber-950/40 text-amber-200'
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-red-400" />
              <span>{isSevereBurn ? 'Quemadura' : 'Eritema'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-md border border-ok/30 bg-ok/10 px-2 py-0.5 text-[11px] font-medium text-ok">
              <Sparkles className="h-3 w-3 text-ok" />
              <span>Tolerada</span>
            </div>
          )}

          {/* Botón de Pantalla Grande (Pestaña Completa) con voz */}
          <button
            onClick={handleToggleFullscreen}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
              isFullscreen
                ? 'border-accent bg-accent text-bg font-bold shadow-xs'
                : 'border-border bg-surface-2 text-text hover:border-accent hover:text-accent'
            }`}
            title="Agrandar simulación a la pestaña completa de la laptop"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Normal</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 text-accent" />
                <span className="hidden sm:inline">Pantalla Grande</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contenedor del Lienzo WebGL Three.js */}
      <div
        ref={mountRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
      >
        {/* HUD Flotante: Inspección Capa por Capa en el Abdomen */}
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-1.5 rounded-xl border border-border/80 bg-surface/90 p-2.5 shadow-xl backdrop-blur-md max-w-[240px]">
          <div className="flex items-center justify-between text-[11px] font-bold text-accent">
            <span>{viewMode === 'macro' ? 'ABDOMEN HUMANO' : 'CORTE CAPA POR CAPA'}</span>
            <span className="font-mono text-[9px] text-text-muted">
              {viewMode === 'macro' ? 'Vista Macro 3D' : 'Biopsia Celular'}
            </span>
          </div>

          {viewMode === 'macro' ? (
            <p className="text-[10px] leading-tight text-text-muted">
              Abdomen completo. Parche de {currentIngredient.name} {result?.input.concentrationPct}%. {
                isErythema ? 'Roncha eritematosa visible en piel.' : 'Piel fisiológica basal.'
              }
            </p>
          ) : (
            <div className="flex flex-col gap-1 text-[9px] font-mono">
              <div className="flex items-center justify-between border-b border-border/40 pb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
                  <span className="text-text font-bold">1. Estrato Córneo</span>
                </div>
                <span className="text-text-muted">0 - 15 µm</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${isErythema ? 'bg-red-500 animate-pulse' : 'bg-[#E0A88A]'}`} />
                  <span className={`font-bold ${isErythema ? 'text-red-300' : 'text-text'}`}>2. Epidermis Viable</span>
                </div>
                <span className="text-text-muted">15 - 100 µm</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/40 pb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${isErythema ? 'bg-red-600' : 'bg-[#C97B7B]'}`} />
                  <span className="text-text font-bold">3. Dermis Capilar</span>
                </div>
                <span className="text-text-muted">100 - 1500 µm</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#E8C87E]" />
                  <span className="text-text font-bold">4. Hipodermis</span>
                </div>
                <span className="text-text-muted">&gt; 1500 µm</span>
              </div>
            </div>
          )}
        </div>

        {/* Notificación de quemadura si está activa */}
        {isErythema && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2 rounded-xl border border-red-500/60 bg-red-950/70 p-2.5 text-xs text-red-200 shadow-xl backdrop-blur-md max-w-[240px]">
            <Flame className="h-4 w-4 shrink-0 animate-bounce text-red-400" />
            <div className="flex flex-col text-[10px] leading-tight">
              <strong className="text-red-300 font-bold">
                {isSevereBurn ? 'Quemadura Química' : 'Eritema Tisular'}
              </strong>
              <span>
                {viewMode === 'macro'
                  ? 'Roncha visible en la pared abdominal.'
                  : 'Inflamación y daño en queratinocitos viables.'}
              </span>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-2 left-3 text-[9px] text-text-muted">
          <span>* Usa la rueda del ratón lentamente para viajar entre el abdomen y las capas celulares.</span>
        </div>
      </div>
    </div>
  );
};