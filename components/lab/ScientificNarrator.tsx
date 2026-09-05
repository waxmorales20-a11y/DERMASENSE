'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLabStore } from '@/lib/store/useLabStore';
import {
  Volume2,
  VolumeX,
  Radio,
  Flame,
  Layers,
  Activity,
  CheckCircle2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface NarrativeEntry {
  id: string;
  timeHours: number;
  type: 'info' | 'barrier' | 'warning' | 'burn' | 'success';
  title: string;
  message: string;
  spokenText: string;
  timestamp: string;
}

export const ScientificNarrator: React.FC = () => {
  const { result, currentFrameIndex, zoomLevel } = useLabStore();

  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [lastSpokenMilestone, setLastSpokenMilestone] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const prevZoomRef = useRef<number>(0.0);

  const currentFrame = result?.frames[currentFrameIndex];
  const metrics = result?.metrics;
  const input = result?.input;

  // 1. Detección y selección de voz en español
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      const spanishVoice =
        voices.find((v) => v.lang === 'es-ES') ||
        voices.find((v) => v.lang.startsWith('es-')) ||
        voices.find((v) => v.lang.includes('es')) ||
        voices[0];

      if (spanishVoice) {
        setSelectedVoice(spanishVoice);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 2. Función de síntesis de voz
  const speakText = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.lang = selectedVoice?.lang || 'es-ES';
        utterance.rate = speechRate;
        utterance.pitch = 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Error al emitir voz sintética:', err);
        setIsSpeaking(false);
      }
    },
    [selectedVoice, speechRate]
  );

  // 3. Generación de las entradas cronológicas del chat científico
  const narrativeFeed = useMemo<NarrativeEntry[]>(() => {
    if (!result || !currentFrame || !metrics || !input) return [];

    const currentTime = currentFrame.timeHours;
    const entries: NarrativeEntry[] = [];
    const isBurn = metrics.irritationIndex >= 45;
    const isSevereBurn = metrics.irritationIndex >= 70;

    // Entrada Inicial (t = 0)
    entries.push({
      id: 'init-application',
      timeHours: 0,
      type: 'info',
      title: 'Aplicación Tópica Inicial',
      message: `Formulación de ${input.ingredient.name} al ${input.concentrationPct}% en vehículo ${input.vehicle.name} (pH ${input.pH.toFixed(1)}). Dosis aplicada sobre el estrato córneo.`,
      spokenText: `Inicia la simulación. Se aplica ${input.ingredient.name} al ${input.concentrationPct} por ciento en vehículo ${input.vehicle.name} con pH de ${input.pH.toFixed(1)}. La masa inicial se deposita sobre el estrato córneo.`,
      timestamp: '0.0 h',
    });

    // Entrada de Retardo / Lag Time
    const lagTime = metrics.lagTimeHours;
    if (currentTime >= Math.min(lagTime * 0.5, 1.0)) {
      entries.push({
        id: 'barrier-diffusion',
        timeHours: Number(lagTime.toFixed(1)),
        type: 'barrier',
        title: 'Travesía del Estrato Córneo',
        message: `El principio activo particiona entre lípidos intercelulares. Lag time teórico calculado: ${lagTime >= 9999 ? '>9999' : lagTime.toFixed(2)} h con log Kp de ${metrics.logKp.toFixed(2)}.`,
        spokenText: `A las ${lagTime.toFixed(1)} horas, las moléculas activas difunden por la matriz lipídica del estrato córneo. El tiempo de retardo estimado es de ${lagTime.toFixed(1)} horas con un log Kp de ${metrics.logKp.toFixed(2)}.`,
        timestamp: `${lagTime.toFixed(1)} h`,
      });
    }

    // Entrada de Cruce a Epidermis Viable
    if (currentTime >= lagTime) {
      entries.push({
        id: 'viable-epidermis',
        timeHours: Number((lagTime + 1.5).toFixed(1)),
        type: isBurn ? 'burn' : 'info',
        title: isBurn ? 'Penetración con Riesgo de Irritación' : 'Llegada a Epidermis Viable',
        message: `Las moléculas superan la barrera del estrato córneo. Concentración pico proyectada en queratinocitos viables: ${metrics.peakConcentrationVE.toFixed(1)} µg/cm³.`,
        spokenText: `El principio activo comienza a cruzar hacia la epidermis viable. La concentración en queratinocitos alcanza un pico proyectado de ${metrics.peakConcentrationVE.toFixed(1)} microgramos por centímetro cúbico.`,
        timestamp: `${(lagTime + 1.5).toFixed(1)} h`,
      });
    }

    // Entrada Crítica de Quemadura / Eritema si el índice de irritación es alto
    if (isBurn) {
      entries.push({
        id: 'burn-alert',
        timeHours: Number((lagTime + 2.0).toFixed(1)),
        type: 'burn',
        title: isSevereBurn ? '¡ALERTA DE QUEMADURA QUÍMICA!' : 'Respuesta Inflamatoria / Eritema',
        message: `Índice de irritación heurístico elevado (${metrics.irritationIndex}/100 — Banda: ${metrics.irritationBand}). En el gemelo digital 3D se activa el flare rojo indicando citotoxicidad y estrés en la barrera.`,
        spokenText: isSevereBurn
          ? `¡Atención de seguridad! El índice de irritación heurístico es crítico, alcanzando ${metrics.irritationIndex} sobre 100. En el visor 3D se visualiza la quemadura química en color rojo intenso debido al estrés en la barrera epidérmica.`
          : `Precaución. Se detecta potencial eritema e irritación moderada con índice heurístico de ${metrics.irritationIndex} sobre 100. La simulación 3D muestra la zona coloreada en rojo alertando sobre reactividad biológica.`,
        timestamp: `${(lagTime + 2.0).toFixed(1)} h`,
      });
    }

    // Entrada de Profundidad Máxima / Dermis
    if (currentTime >= metrics.timeTo50PctHours || currentTime >= 12) {
      entries.push({
        id: 'dermal-delivery',
        timeHours: Number(currentTime.toFixed(1)),
        type: isBurn ? 'warning' : 'success',
        title: 'Distribución y Aclaramiento Cutáneo',
        message: `Profundidad efectiva alcanzada: ${metrics.penetrationDepthUm.toFixed(0)} µm. Fracción absorbida a través del estrato córneo: ${metrics.absorbedFractionPct.toFixed(1)}%. Flujo máximo: ${metrics.maxFluxInfiniteDose.toFixed(1)} µg/cm²/h.`,
        spokenText: `En este estadio de la simulación, la profundidad de penetración alcanza ${metrics.penetrationDepthUm.toFixed(0)} micrómetros, con una fracción absorbida de ${metrics.absorbedFractionPct.toFixed(1)} por ciento y un flujo máximo de ${metrics.maxFluxInfiniteDose.toFixed(1)} microgramos por centímetro cuadrado por hora.`,
        timestamp: `${currentTime.toFixed(1)} h`,
      });
    }

    return entries;
  }, [result, currentFrame, metrics, input]);

  // 4. Disparo automático de voz al avanzar por hitos si la voz está activada
  useEffect(() => {
    if (!isVoiceActive || narrativeFeed.length === 0) return;

    const latestEntry = narrativeFeed[narrativeFeed.length - 1];
    if (latestEntry && latestEntry.id !== lastSpokenMilestone) {
      setLastSpokenMilestone(latestEntry.id);
      speakText(latestEntry.spokenText);
    }
  }, [isVoiceActive, narrativeFeed, lastSpokenMilestone, speakText]);

  // 5. Narración de voz sincronizada con la transición Macro ⇄ Micro
  useEffect(() => {
    if (!isVoiceActive) {
      prevZoomRef.current = zoomLevel;
      return;
    }

    const prevZoom = prevZoomRef.current;
    prevZoomRef.current = zoomLevel;

    // Transición de Macro a Micro (Zoom In celular)
    if (prevZoom < 0.4 && zoomLevel >= 0.65) {
      if (metrics && metrics.irritationIndex >= 45) {
        speakText(
          'Acercando al estrato córneo... observe la degradación lipídica y la inflamación celular con eritema en la epidermis viable.'
        );
      } else {
        speakText(
          'Acercando al estrato córneo... observe la partición lipídica en la epidermis viable y la difusión pasiva.'
        );
      }
    }

    // Transición de Micro a Macro (Zoom Out abdomen)
    if (prevZoom > 0.6 && zoomLevel <= 0.35) {
      if (metrics && metrics.irritationIndex >= 45) {
        speakText(
          'Retornando a la vista macroscópica del abdomen. Observe la roncha eritematosa superficial en el área de aplicación.'
        );
      } else {
        speakText(
          'Retornando a la vista macroscópica del abdomen. Superficie cutánea íntegra con absorción tópica.'
        );
      }
    }
  }, [isVoiceActive, zoomLevel, metrics, speakText]);

  // Alternar voz
  const toggleVoice = () => {
    if (isVoiceActive) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      setIsVoiceActive(false);
    } else {
      setIsVoiceActive(true);
      const latestEntry = narrativeFeed[narrativeFeed.length - 1];
      if (latestEntry) {
        setLastSpokenMilestone(latestEntry.id);
        speakText(latestEntry.spokenText);
      }
    }
  };

  // Explicar inmediatamente el estado actual
  const handleExplainCurrent = () => {
    if (!narrativeFeed.length) return;
    const latestEntry = narrativeFeed[narrativeFeed.length - 1];
    if (latestEntry) {
      speakText(latestEntry.spokenText);
    }
  };

  if (!result || !currentFrame || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-text-muted">
        <Activity className="h-6 w-6 animate-pulse text-accent mb-2" />
        <p className="text-xs">Iniciando sistema de narración científica...</p>
      </div>
    );
  }

  const isErythemaActive = metrics.irritationIndex >= 45;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-surface/80 backdrop-blur-md">
      {/* Encabezado del Narrador con controles de Audio */}
      <div className="flex items-center justify-between border-b border-border/70 bg-surface-2/70 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Radio
            className={`h-4 w-4 ${
              isSpeaking
                ? 'animate-pulse text-accent'
                : isVoiceActive
                ? 'text-accent'
                : 'text-text-muted'
            }`}
          />
          <div className="flex flex-col">
            <span className="text-xs font-semibold tracking-wide text-text uppercase">
              Narrador Científico
            </span>
            <span className="font-mono text-[10px] text-text-muted">
              {isSpeaking
                ? 'Narrando en vivo...'
                : isVoiceActive
                ? 'Monitoreo de voz activo'
                : 'Voz silenciada'}
            </span>
          </div>
        </div>

        {/* Visualizador de ondas y controles */}
        <div className="flex items-center gap-2">
          {isSpeaking && (
            <div className="flex items-end gap-0.5 h-3.5 px-1.5 py-0.5 rounded bg-surface border border-accent/30">
              <span className="w-1 bg-accent rounded-full animate-bounce [animation-delay:0ms] h-full" />
              <span className="w-1 bg-accent rounded-full animate-bounce [animation-delay:150ms] h-2/3" />
              <span className="w-1 bg-accent rounded-full animate-bounce [animation-delay:300ms] h-full" />
              <span className="w-1 bg-accent rounded-full animate-bounce [animation-delay:75ms] h-1/2" />
            </div>
          )}

          {/* Selector de velocidad de voz */}
          <div className="flex items-center rounded-md border border-border bg-surface p-0.5 text-[10px] font-mono">
            {[0.85, 1.0, 1.2].map((rate) => (
              <button
                key={rate}
                onClick={() => setSpeechRate(rate)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  speechRate === rate
                    ? 'bg-accent text-bg font-bold'
                    : 'text-text-muted hover:text-text'
                }`}
                title={`Velocidad de locución ${rate}x`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Botón Principal de Mute / Unmute */}
          <button
            onClick={toggleVoice}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              isVoiceActive
                ? 'border border-accent/40 bg-accent/20 text-accent hover:bg-accent hover:text-bg shadow-xs shadow-accent/20'
                : 'border border-border bg-surface text-text-muted hover:border-accent hover:text-text'
            }`}
            title={isVoiceActive ? 'Silenciar voz del narrador' : 'Activar voz del narrador'}
          >
            {isVoiceActive ? (
              <>
                <Volume2 className="h-3.5 w-3.5 animate-pulse text-accent" />
                <span className="font-semibold">Voz ON</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                <span>Voz OFF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Banner reactivo si hay alerta de quemadura / irritación */}
      {isErythemaActive && (
        <div className="flex items-center gap-2 border-b border-red-500/40 bg-red-950/40 px-3.5 py-2 text-xs text-red-200">
          <Flame className="h-4 w-4 shrink-0 animate-bounce text-red-400" />
          <div className="flex-1 text-[11px] leading-snug">
            <span className="font-bold text-red-300">Respuesta reactiva detectada: </span>
            La piel exhibe tinte rojo por potencial daño citotóxico o irritación (Índice: {metrics.irritationIndex}/100).
          </div>
        </div>
      )}

      {/* Feed del Chat Científico con scroll */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3.5 text-xs">
        {narrativeFeed.map((entry) => {
          const isBurnType = entry.type === 'burn';
          const isBarrierType = entry.type === 'barrier';

          return (
            <div
              key={entry.id}
              className={`group relative flex flex-col gap-1 rounded-lg border p-2.5 transition-all ${
                isBurnType
                  ? 'border-red-500/50 bg-red-950/20 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                  : isBarrierType
                  ? 'border-accent/40 bg-surface-2/60 text-text'
                  : 'border-border/60 bg-surface/50 text-text'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {isBurnType ? (
                    <Flame className="h-3.5 w-3.5 text-red-400" />
                  ) : isBarrierType ? (
                    <Layers className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-ok" />
                  )}
                  <span
                    className={`font-semibold text-[11px] ${
                      isBurnType ? 'text-red-300 font-bold' : 'text-text'
                    }`}
                  >
                    {entry.title}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-text-muted tabular-nums">
                    t = {entry.timestamp}
                  </span>
                  <button
                    onClick={() => speakText(entry.spokenText)}
                    className="rounded p-1 text-text-muted hover:bg-surface-2 hover:text-accent transition-colors"
                    title="Escuchar esta explicación"
                  >
                    <Volume2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-text/90 font-sans">
                {entry.message}
              </p>
            </div>
          );
        })}
      </div>

      {/* Barra de estado inferior */}
      <div className="flex items-center justify-between border-t border-border/70 bg-surface-2/50 px-3.5 py-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-text-muted">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span>Física Fickiana continua</span>
        </div>

        <button
          onClick={handleExplainCurrent}
          className="flex items-center gap-1 text-[11px] font-medium text-accent hover:text-accent-soft transition-colors cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Explicar momento actual</span>
        </button>
      </div>
    </div>
  );
};