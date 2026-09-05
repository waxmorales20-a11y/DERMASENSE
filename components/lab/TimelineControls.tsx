'use client';

import React, { useEffect } from 'react';
import { useLabStore, type PlaybackSpeed } from '@/lib/store/useLabStore';
import { Play, Pause, RotateCcw, FastForward, SkipBack, SkipForward } from 'lucide-react';

export const TimelineControls: React.FC = () => {
  const {
    result,
    currentFrameIndex,
    isPlaying,
    playbackSpeed,
    setCurrentFrameIndex,
    togglePlayPause,
    setIsPlaying,
    setPlaybackSpeed,
  } = useLabStore();

  const frames = result?.frames ?? [];
  const totalFrames = frames.length;
  const currentFrame = frames[currentFrameIndex];
  const currentHours = currentFrame ? currentFrame.timeHours : 0;
  const totalHours = result?.input.durationHours ?? 24;

  // Concentración pico para la leyenda
  const peakConcentration = result?.metrics.peakConcentrationVE ?? 100;

  // Bucle de animación de reproducción continua del timeline
  useEffect(() => {
    if (!isPlaying || totalFrames === 0) return;

    // Intervalo base de avance: 150ms a 1x, 50ms a 4x, 16ms a 12x
    const intervalMs = Math.round(150 / playbackSpeed);

    const interval = setInterval(() => {
      const nextIndex = currentFrameIndex + 1;
      if (nextIndex >= totalFrames) {
        setIsPlaying(false); // Pausa al finalizar
      } else {
        setCurrentFrameIndex(nextIndex);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, currentFrameIndex, totalFrames, playbackSpeed, setCurrentFrameIndex, setIsPlaying]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentFrameIndex(parseInt(e.target.value, 10));
  };

  const handleRewind = () => {
    setCurrentFrameIndex(0);
    setIsPlaying(false);
  };

  const handleEnd = () => {
    setCurrentFrameIndex(totalFrames - 1);
    setIsPlaying(false);
  };

  return (
    <div className="flex w-full flex-col gap-3 border-t border-border bg-surface px-4 py-3 lg:px-6">
      {/* Fila superior: Slider de tiempo y lectura horaria */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-text">
          <span className="font-semibold text-accent">t =</span>
          <span className="text-sm font-bold text-text w-12 text-right">
            {currentHours.toFixed(1)}
          </span>
          <span className="text-text-muted">/ {totalHours} h</span>
        </div>

        {/* Barra de progreso interactiva (Scrub) */}
        <div className="relative flex flex-1 items-center">
          <input
            type="range"
            min="0"
            max={Math.max(0, totalFrames - 1)}
            value={currentFrameIndex}
            onChange={handleSliderChange}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-2 accent-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Fila inferior: Botones de transporte y Leyenda de color */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Controles de reproducción */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRewind}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-text-muted transition-colors hover:border-accent hover:text-text"
            title="Volver al inicio (0h)"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={togglePlayPause}
            className="flex h-8 w-10 items-center justify-center rounded-md bg-accent text-bg font-semibold shadow-sm transition-all hover:bg-accent/90"
            title={isPlaying ? 'Pausar simulación' : 'Reproducir difusión temporal'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={handleEnd}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-text-muted transition-colors hover:border-accent hover:text-text"
            title="Ir al final de la simulación"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>

          {/* Selector de velocidad */}
          <div className="ml-2 flex items-center rounded-md border border-border bg-surface-2 p-0.5 text-[11px] font-mono">
            {([1, 4, 12] as PlaybackSpeed[]).map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`rounded px-2 py-1 font-semibold transition-colors ${
                  playbackSpeed === speed
                    ? 'bg-accent-soft text-text'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Leyenda secuencial de concentración */}
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="font-mono text-[10px]">0</span>
          <div
            className="h-3.5 w-36 rounded border border-border/80 shadow-xs"
            style={{
              background:
                'linear-gradient(to right, #000000, #143A5A, #1D6E8E, #21A0A0, #6FCF7F, #E8E36B, #F5A25D)',
            }}
            title="Escala secuencial de concentración (perceptualmente uniforme)"
          />
          <span className="font-mono text-[10px] tabular-nums text-text font-medium">
            {(peakConcentration * 1.2).toFixed(1)} µg/cm³
          </span>
        </div>
      </div>
    </div>
  );
};
