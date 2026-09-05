'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useLabStore } from '@/lib/store/useLabStore';
import { Layers, Eye, Maximize2, Sparkles, Scale } from 'lucide-react';

// Escala secuencial de concentración perceptualmente uniforme (docs/UI_UX_DESIGN_BRIEF.md §3)
const COLOR_STOPS = [
  { stop: 0.0, color: [11, 17, 32] }, // #0B1120 (fondo)
  { stop: 0.16, color: [20, 58, 90] }, // #143A5A
  { stop: 0.33, color: [29, 110, 142] }, // #1D6E8E
  { stop: 0.5, color: [33, 160, 160] }, // #21A0A0
  { stop: 0.66, color: [111, 207, 127] }, // #6FCF7F
  { stop: 0.83, color: [232, 227, 107] }, // #E8E36B
  { stop: 1.0, color: [245, 162, 93] }, // #F5A25D
];

// Colores base de capa
const LAYER_COLORS: Record<string, { hex: string; rgb: number[] }> = {
  stratum_corneum: { hex: '#C4B59A', rgb: [196, 181, 154] },
  viable_epidermis: { hex: '#E0A88A', rgb: [224, 168, 138] },
  dermis: { hex: '#C97B7B', rgb: [201, 123, 123] },
  hypodermis: { hex: '#E8C87E', rgb: [232, 200, 126] },
};

function interpolateColor(valNormalized: number): string {
  const t = Math.max(0, Math.min(1, valNormalized));
  let low = COLOR_STOPS[0];
  let high = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (t >= COLOR_STOPS[i].stop && t <= COLOR_STOPS[i + 1].stop) {
      low = COLOR_STOPS[i];
      high = COLOR_STOPS[i + 1];
      break;
    }
  }

  const range = high.stop - low.stop || 1;
  const factor = (t - low.stop) / range;
  const r = Math.round(low.color[0] + factor * (high.color[0] - low.color[0]));
  const g = Math.round(low.color[1] + factor * (high.color[1] - low.color[1]));
  const b = Math.round(low.color[2] + factor * (high.color[2] - low.color[2]));

  return `rgb(${r}, ${g}, ${b})`;
}

export const SkinViewer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { result, currentFrameIndex, scaleMode, setScaleMode, getSite, getIngredient, getVehicle } =
    useLabStore();

  const [hoveredNode, setHoveredNode] = useState<{
    depthUm: number;
    conc: number;
    layerName: string;
    yPos: number;
  } | null>(null);

  const currentFrame = result?.frames[currentFrameIndex];
  const mesh = result?.mesh;
  const site = getSite();
  const layers = site.layers;

  // Concentración máxima en toda la simulación para normalizar el mapa de color de manera consistente
  const maxConcentrationOverall = useMemo(() => {
    if (!result) return 100;
    let max = 0.001;
    for (const frame of result.frames) {
      for (let i = 0; i < frame.concentrations.length; i++) {
        if (frame.concentrations[i] > max) max = frame.concentrations[i];
      }
    }
    return max;
  }, [result]);

  // Renderizado en canvas del corte 3D / 2D
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result || !mesh || !currentFrame) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Márgenes para reglas y etiquetas
    const padLeft = 80;
    const padRight = 140;
    const padTop = 40;
    const padBottom = 30;

    const blockWidth = width - padLeft - padRight;
    const blockHeight = height - padTop - padBottom;

    // Calcular distribución vertical de capas según modo de escala
    const totalRealThickness = layers.reduce((acc, l) => acc + l.thicknessUm, 0);

    // En escala proporcional ajustamos para que el estrato córneo no sea microscópico (18% SC, 22% VE, 40% Dermis, 20% Hipo)
    const proportionalFractions: Record<string, number> = {
      stratum_corneum: 0.18,
      viable_epidermis: 0.22,
      dermis: 0.40,
      hypodermis: 0.20,
    };

    let layerYBounds: { layer: string; label: string; yStart: number; yEnd: number; thicknessUm: number }[] = [];
    let currentY = padTop;

    layers.forEach((l) => {
      const frac =
        scaleMode === 'linear'
          ? l.thicknessUm / totalRealThickness
          : proportionalFractions[l.layer] ?? 0.25;

      const layerHeightPx = frac * blockHeight;
      layerYBounds.push({
        layer: l.layer,
        label: l.label,
        yStart: currentY,
        yEnd: currentY + layerHeightPx,
        thicknessUm: l.thicknessUm,
      });
      currentY += layerHeightPx;
    });

    // Mapear cada nodo de la malla a una coordenada Y en el canvas
    const nodeCount = mesh.positionsUm.length;
    const nodeYCoords = new Float32Array(nodeCount);

    for (let i = 0; i < nodeCount; i++) {
      const depth = mesh.positionsUm[i];
      const layerIdx = mesh.layerIndex[i];
      const layerMeta = layers[layerIdx];
      const bounds = layerYBounds[layerIdx];

      if (scaleMode === 'linear') {
        nodeYCoords[i] = padTop + (depth / totalRealThickness) * blockHeight;
      } else {
        // Interpolar dentro de la banda de la capa proporcional
        // Calcular offset relativo dentro de la capa
        let prevThicknessSum = 0;
        for (let k = 0; k < layerIdx; k++) prevThicknessSum += layers[k].thicknessUm;
        const localRelDepth = (depth - prevThicknessSum) / layerMeta.thicknessUm;
        nodeYCoords[i] = bounds.yStart + Math.max(0, Math.min(1, localRelDepth)) * (bounds.yEnd - bounds.yStart);
      }
    }

    // Dibujar fondo de capas base
    layerYBounds.forEach((b) => {
      const baseColor = LAYER_COLORS[b.layer];
      ctx.fillStyle = `rgba(${baseColor.rgb.join(',')}, 0.12)`;
      ctx.fillRect(padLeft, b.yStart, blockWidth, b.yEnd - b.yStart);

      // Línea divisoria de interfaz
      ctx.strokeStyle = 'rgba(34, 48, 76, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, b.yEnd);
      ctx.lineTo(padLeft + blockWidth, b.yEnd);
      ctx.stroke();
    });

    // Renderizar gradiente continuo de difusión interpolando entre nodos
    for (let i = 0; i < nodeCount - 1; i++) {
      const y1 = nodeYCoords[i];
      const y2 = nodeYCoords[i + 1];
      const h = Math.max(1, y2 - y1);

      const c1 = currentFrame.concentrations[i];
      const c2 = currentFrame.concentrations[i + 1];

      const norm1 = c1 / maxConcentrationOverall;
      const norm2 = c2 / maxConcentrationOverall;

      const grad = ctx.createLinearGradient(0, y1, 0, y2);
      grad.addColorStop(0, interpolateColor(norm1));
      grad.addColorStop(1, interpolateColor(norm2));

      ctx.fillStyle = grad;
      // Añadir mezcla sutil sobre el fondo
      ctx.globalAlpha = 0.88;
      ctx.fillRect(padLeft, y1, blockWidth, h);
      ctx.globalAlpha = 1.0;
    }

    // Dibujar efecto de volumen 3D en perspectiva isométrica sobre el borde derecho
    const isoDepthX = 24;
    const isoDepthY = -12;

    ctx.save();
    layerYBounds.forEach((b) => {
      const baseColor = LAYER_COLORS[b.layer];
      ctx.fillStyle = `rgba(${baseColor.rgb.join(',')}, 0.18)`;
      ctx.beginPath();
      ctx.moveTo(padLeft + blockWidth, b.yStart);
      ctx.lineTo(padLeft + blockWidth + isoDepthX, b.yStart + isoDepthY);
      ctx.lineTo(padLeft + blockWidth + isoDepthX, b.yEnd + isoDepthY);
      ctx.lineTo(padLeft + blockWidth, b.yEnd);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(34, 48, 76, 0.9)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Cara superior (Vehículo / Superficie de aplicación)
    const vehConcNorm = Math.min(1, currentFrame.vehicleConcentration / maxConcentrationOverall);
    ctx.fillStyle = interpolateColor(vehConcNorm);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft + isoDepthX, padTop + isoDepthY);
    ctx.lineTo(padLeft + blockWidth + isoDepthX, padTop + isoDepthY);
    ctx.lineTo(padLeft + blockWidth, padTop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.restore();

    // Borde exterior del bloque
    ctx.strokeStyle = '#22304C';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padLeft, padTop, blockWidth, blockHeight);

    // Calipers y regla de profundidad en el lado izquierdo
    ctx.fillStyle = '#93A4BF';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    ctx.fillText('0 µm', padLeft - 10, padTop);

    layerYBounds.forEach((b, idx) => {
      let cumulativeUm = 0;
      for (let k = 0; k <= idx; k++) cumulativeUm += layers[k].thicknessUm;

      // Tick mark
      ctx.beginPath();
      ctx.strokeStyle = '#22304C';
      ctx.moveTo(padLeft - 6, b.yEnd);
      ctx.lineTo(padLeft, b.yEnd);
      ctx.stroke();

      ctx.fillText(`${cumulativeUm.toLocaleString()} µm`, padLeft - 10, b.yEnd);
    });

    // Etiquetas de capas a la derecha
    ctx.textAlign = 'left';
    layerYBounds.forEach((b) => {
      const midY = (b.yStart + b.yEnd) / 2;
      const baseColor = LAYER_COLORS[b.layer];

      // Pill indicador
      ctx.fillStyle = baseColor.hex;
      ctx.beginPath();
      ctx.arc(padLeft + blockWidth + isoDepthX + 12, midY + isoDepthY / 2, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#E8EEF7';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(b.label, padLeft + blockWidth + isoDepthX + 22, midY + isoDepthY / 2 - 6);

      ctx.fillStyle = '#93A4BF';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(`${b.thicknessUm} µm`, padLeft + blockWidth + isoDepthX + 22, midY + isoDepthY / 2 + 8);
    });

    // Etiqueta de la superficie de película
    ctx.fillStyle = '#22D3EE';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Superficie de aplicación (Vehículo)', padLeft + blockWidth / 2, padTop - 18);
  }, [result, currentFrame, mesh, scaleMode, layers, maxConcentrationOverall]);

  // Manejador de hover sobre el canvas para sonda de concentración
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !result || !mesh || !currentFrame) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padLeft = 80;
    const blockWidth = canvas.width - padLeft - 140;
    const padTop = 40;
    const blockHeight = canvas.height - padTop - 30;

    if (x >= padLeft && x <= padLeft + blockWidth && y >= padTop && y <= padTop + blockHeight) {
      // Encontrar nodo más cercano
      const totalRealThickness = layers.reduce((acc, l) => acc + l.thicknessUm, 0);
      let foundNode = 0;
      let minDiff = 999999;

      const proportionalFractions: Record<string, number> = {
        stratum_corneum: 0.18,
        viable_epidermis: 0.22,
        dermis: 0.4,
        hypodermis: 0.2,
      };

      for (let i = 0; i < mesh.positionsUm.length; i++) {
        const layerIdx = mesh.layerIndex[i];
        let nodeY = 0;

        if (scaleMode === 'linear') {
          nodeY = padTop + (mesh.positionsUm[i] / totalRealThickness) * blockHeight;
        } else {
          let prevThicknessSum = 0;
          let prevFracSum = 0;
          for (let k = 0; k < layerIdx; k++) {
            prevThicknessSum += layers[k].thicknessUm;
            prevFracSum += proportionalFractions[layers[k].layer] ?? 0.25;
          }
          const layerFrac = proportionalFractions[layers[layerIdx].layer] ?? 0.25;
          const localRel = (mesh.positionsUm[i] - prevThicknessSum) / layers[layerIdx].thicknessUm;
          nodeY = padTop + (prevFracSum + localRel * layerFrac) * blockHeight;
        }

        const diff = Math.abs(y - nodeY);
        if (diff < minDiff) {
          minDiff = diff;
          foundNode = i;
        }
      }

      const layerIdx = mesh.layerIndex[foundNode];
      setHoveredNode({
        depthUm: mesh.positionsUm[foundNode],
        conc: currentFrame.concentrations[foundNode],
        layerName: layers[layerIdx].label,
        yPos: y,
      });
    } else {
      setHoveredNode(null);
    }
  };

  const handleMouseLeave = () => setHoveredNode(null);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-bg p-4 select-none">
      {/* Barra superior de controles del visor */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="flex items-center gap-1.5 rounded-md border border-border bg-surface/90 px-2.5 py-1 text-xs font-medium text-text backdrop-blur-sm">
            <Layers className="h-3.5 w-3.5 text-accent" />
            <span>Corte Transversal 3D</span>
          </span>

          <span className="rounded-md border border-border bg-surface/90 px-2 py-1 text-[11px] font-mono text-text-muted">
            {site.label}
          </span>
        </div>

        {/* Conmutador de escala (Proporcional vs Lineal) */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/90 p-0.5 backdrop-blur-sm pointer-events-auto">
          <button
            onClick={() => setScaleMode('proportional')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              scaleMode === 'proportional'
                ? 'bg-accent text-bg font-semibold shadow-xs'
                : 'text-text-muted hover:text-text'
            }`}
            title="Escala optimizada para I+D: magnifica el estrato córneo para observar la barrera crítica"
          >
            <Scale className="h-3 w-3" />
            <span>Proporcional I+D</span>
          </button>
          <button
            onClick={() => setScaleMode('linear')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              scaleMode === 'linear'
                ? 'bg-accent text-bg font-semibold shadow-xs'
                : 'text-text-muted hover:text-text'
            }`}
            title="Escala micrométrica lineal física real (el estrato córneo de 16 µm se muestra a escala real)"
          >
            <span>Lineal Real</span>
          </button>
        </div>
      </div>

      {/* Contenedor del Canvas */}
      <div
        ref={containerRef}
        className="relative flex h-full max-h-[580px] w-full max-w-[680px] items-center justify-center"
      >
        <canvas
          ref={canvasRef}
          width={640}
          height={520}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="h-auto w-full cursor-crosshair rounded-xl border border-border/80 bg-surface/50 shadow-2xl backdrop-blur-xs"
        />

        {/* Tooltip de sonda de profundidad y concentración */}
        {hoveredNode && (
          <div
            className="pointer-events-none absolute right-4 z-20 flex flex-col gap-1 rounded-md border border-accent/40 bg-surface-2/95 p-2 font-mono text-xs shadow-xl backdrop-blur-md"
            style={{ top: Math.max(50, Math.min(440, hoveredNode.yPos - 20)) }}
          >
            <div className="text-[10px] font-sans font-semibold text-accent">
              {hoveredNode.layerName}
            </div>
            <div className="flex items-center justify-between gap-4 text-text-muted">
              <span>Profundidad:</span>
              <strong className="tabular-nums text-text">{hoveredNode.depthUm.toFixed(1)} µm</strong>
            </div>
            <div className="flex items-center justify-between gap-4 text-text-muted">
              <span>Concentración:</span>
              <strong className="tabular-nums text-ok">{hoveredNode.conc.toFixed(2)} µg/cm³</strong>
            </div>
          </div>
        )}
      </div>

      {/* Nota metodológica visible de escala */}
      <div className="absolute bottom-3 left-4 text-[10px] font-sans text-text-muted/80">
        {scaleMode === 'proportional' ? (
          <span>
            * Vista en <strong>escala proporcional</strong>: estrato córneo ampliado para legibilidad analítica.
          </span>
        ) : (
          <span>
            * Vista en <strong>escala lineal estricta</strong>: espesores anatómicos 1:1 en micrómetros.
          </span>
        )}
      </div>
    </div>
  );
};
