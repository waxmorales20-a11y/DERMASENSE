'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Bot,
  Flame,
  Layers,
  Volume2,
  VolumeX,
  Activity,
  Sparkles,
  User,
} from 'lucide-react';
import { useLabStore } from '@/lib/store/useLabStore';
import { applyAssistantVoice, pickAssistantVoice } from '@/lib/voice';
import { answerLocally } from '@/lib/chat/local-answers';

type MessageKind = 'milestone' | 'chat';
type MilestoneType = 'info' | 'barrier' | 'burn' | 'progress';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  kind: MessageKind;
  content: string;
  /** Texto optimizado para locución (los hitos suenan distinto a como se leen). */
  spokenText?: string;
  milestoneType?: MilestoneType;
  timestamp?: string;
}

const QUICK_PROMPTS = [
  '¿Qué está pasando ahora en la piel?',
  '¿Hasta dónde ha llegado el activo?',
  '¿Por qué se pone roja la dermis?',
  '¿Cómo bajo la irritación?',
];

/** Render ligero de negritas y viñetas: el asistente responde en Markdown simple. */
function renderRichText(text: string): React.ReactNode {
  return text.split('\n').map((line, lineIdx) => {
    const isBullet = /^\s*[-•]\s+/.test(line);
    const clean = isBullet ? line.replace(/^\s*[-•]\s+/, '') : line;

    const parts = clean.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    const rendered = parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i} className="font-semibold text-text">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );

    if (isBullet) {
      return (
        <span key={lineIdx} className="flex gap-1.5">
          <span className="text-text-muted">•</span>
          <span>{rendered}</span>
        </span>
      );
    }

    return (
      <span key={lineIdx} className={line.trim() === '' ? 'h-2' : undefined}>
        {rendered}
      </span>
    );
  });
}

export const ScientificChat: React.FC = () => {
  const { result, currentFrameIndex, getSite } = useLabStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [usingLocalBrain, setUsingLocalBrain] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const spokenMilestonesRef = useRef<Set<string>>(new Set());

  const currentFrame = result?.frames[currentFrameIndex];
  const metrics = result?.metrics;
  const input = result?.input;
  const currentTimeHours = currentFrame?.timeHours ?? 0;

  // 1. Voz femenina del asistente
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;
      const assistantVoice = pickAssistantVoice(voices);
      if (assistantVoice) setSelectedVoice(assistantVoice);
    };

    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        applyAssistantVoice(utterance, selectedVoice);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    },
    [selectedVoice]
  );

  // 2. Hitos de la simulación: lo que le va ocurriendo a la piel, en orden.
  const milestones = useMemo<ChatMessage[]>(() => {
    if (!result || !currentFrame || !metrics || !input) return [];

    const layers = getSite().layers;
    const entries: ChatMessage[] = [];
    const isBurn = metrics.irritationIndex >= 45;
    const isSevere = metrics.irritationIndex >= 70;
    const lag = metrics.lagTimeHours;

    entries.push({
      id: 'ms-application',
      role: 'assistant',
      kind: 'milestone',
      milestoneType: 'info',
      timestamp: '0.0 h',
      content: `Aplicación tópica sobre ${layers[0]?.label ?? 'el estrato córneo'}. Se deposita ${input.ingredient.name} al ${input.concentrationPct} % en ${input.vehicle.name}, a pH ${input.pH.toFixed(1)} y ${input.appliedDoseMgCm2} mg/cm². A partir de aquí todo lo que veas en el corte 3D sale del motor de difusión.`,
      spokenText: `Comienza la simulación. Se aplica ${input.ingredient.name} al ${input.concentrationPct} por ciento en vehículo ${input.vehicle.name}, con pH ${input.pH.toFixed(1)}.`,
    });

    if (currentTimeHours >= Math.min(lag * 0.5, 1.0)) {
      entries.push({
        id: 'ms-barrier',
        role: 'assistant',
        kind: 'milestone',
        milestoneType: 'barrier',
        timestamp: `${lag.toFixed(1)} h`,
        content: `El activo está atravesando la matriz lipídica del estrato córneo. Lag time de **${lag >= 9999 ? '>9999' : lag.toFixed(2)} h** con un log Kp de **${metrics.logKp.toFixed(2)}**. En el visor es el momento en que el frente luminoso empieza a bajar.`,
        spokenText: `A las ${lag.toFixed(1)} horas las moléculas difunden por la matriz lipídica del estrato córneo, con un log Kp de ${metrics.logKp.toFixed(2)}.`,
      });
    }

    if (currentTimeHours >= lag) {
      entries.push({
        id: 'ms-viable',
        role: 'assistant',
        kind: 'milestone',
        milestoneType: isBurn ? 'burn' : 'progress',
        timestamp: `${(lag + 1.5).toFixed(1)} h`,
        content: `El frente cruza hacia la **epidermis viable**, donde ya hay queratinocitos vivos. Concentración pico proyectada: **${metrics.peakConcentrationVE.toFixed(1)} µg/cm³**.${isBurn ? ' Es aquí donde empieza el enrojecimiento que ves en el corte.' : ''}`,
        spokenText: `El activo cruza hacia la epidermis viable, con un pico de ${metrics.peakConcentrationVE.toFixed(1)} microgramos por centímetro cúbico.`,
      });
    }

    if (isBurn) {
      entries.push({
        id: 'ms-irritation',
        role: 'assistant',
        kind: 'milestone',
        milestoneType: 'burn',
        timestamp: `${(lag + 2.0).toFixed(1)} h`,
        content: isSevere
          ? `Respuesta reactiva intensa: índice heurístico de irritación **${metrics.irritationIndex}/100** (banda ${metrics.irritationBand}). La epidermis viable y la dermis se tiñen de rojo en el corte 3D. Recuerda que este índice es heurístico, no una evaluación de seguridad.`
          : `Respuesta inflamatoria moderada: índice heurístico **${metrics.irritationIndex}/100** (banda ${metrics.irritationBand}). El enrojecimiento aparece primero en la epidermis viable y se propaga a la dermis capilar. Índice heurístico, no validado experimentalmente.`,
        spokenText: isSevere
          ? `Atención. El índice heurístico de irritación alcanza ${metrics.irritationIndex} sobre cien. Las capas viables muestran quemadura química en rojo intenso.`
          : `Precaución. Se detecta irritación moderada con índice heurístico de ${metrics.irritationIndex} sobre cien.`,
      });
    }

    if (currentTimeHours >= metrics.timeTo50PctHours || currentTimeHours >= 12) {
      entries.push({
        id: 'ms-distribution',
        role: 'assistant',
        kind: 'milestone',
        milestoneType: 'progress',
        timestamp: `${currentTimeHours.toFixed(1)} h`,
        content: `Distribución y aclaramiento: profundidad efectiva **${metrics.penetrationDepthUm.toFixed(0)} µm**, fracción absorbida **${metrics.absorbedFractionPct.toFixed(1)} %** y flujo máximo teórico **${metrics.maxFluxInfiniteDose.toFixed(1)} µg/cm²/h**.`,
        spokenText: `La profundidad alcanza ${metrics.penetrationDepthUm.toFixed(0)} micrómetros, con una fracción absorbida del ${metrics.absorbedFractionPct.toFixed(1)} por ciento.`,
      });
    }

    return entries;
  }, [result, currentFrame, metrics, input, currentTimeHours, getSite]);

  // 3. Los hitos entran en la conversación conforme ocurren, sin duplicarse.
  useEffect(() => {
    if (milestones.length === 0) return;

    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const incoming = milestones.filter((m) => !known.has(m.id));
      if (incoming.length === 0) return prev;
      return [...prev, ...incoming];
    });
  }, [milestones]);

  // 4. Locución automática del último hito cuando la voz está activa.
  useEffect(() => {
    if (!isVoiceActive || milestones.length === 0) return;

    const latest = milestones[milestones.length - 1];
    if (spokenMilestonesRef.current.has(latest.id)) return;

    spokenMilestonesRef.current.add(latest.id);
    speak(latest.spokenText ?? latest.content);
  }, [isVoiceActive, milestones, speak]);

  // 5. El hilo siempre muestra lo último.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, isThinking]);

  const sendMessage = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || !result || !metrics || !input || isThinking) return;

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        kind: 'chat',
        content: question,
      };

      const history = [...messages, userMessage];
      setMessages(history);
      setDraft('');
      setIsThinking(true);

      const conversation = history
        .filter((m) => m.kind === 'chat' || m.role === 'assistant')
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      let answer: string;
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversation,
            input,
            metrics,
            currentTimeHours,
          }),
        });

        if (!response.ok) throw new Error('AI_UNAVAILABLE');

        const data = await response.json();
        answer = data.content;
        setUsingLocalBrain(false);
      } catch {
        // Degradación: se responde con las métricas del motor, sin inventar nada.
        answer = answerLocally(question, result, currentTimeHours).content;
        setUsingLocalBrain(true);
      }

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        kind: 'chat',
        content: answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsThinking(false);

      if (isVoiceActive) speak(answer.replace(/\*\*/g, ''));
    },
    [messages, result, metrics, input, currentTimeHours, isThinking, isVoiceActive, speak]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(draft);
    }
  };

  const toggleVoice = () => {
    if (isVoiceActive) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      setIsVoiceActive(false);
      return;
    }
    setIsVoiceActive(true);
    const latest = [...messages].reverse().find((m) => m.role === 'assistant');
    if (latest) speak((latest.spokenText ?? latest.content).replace(/\*\*/g, ''));
  };

  if (!result || !currentFrame || !metrics) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-text-muted">
        <Activity className="h-6 w-6 animate-pulse text-accent" />
        <p className="text-xs">Iniciando el asistente científico…</p>
      </div>
    );
  }

  const hasUserMessages = messages.some((m) => m.role === 'user');

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      {/* Cabecera */}
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface-2/60 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Bot className="h-4 w-4" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-text">Asistente científico</span>
            <span className="text-[10px] text-text-muted">
              {isSpeaking
                ? 'Narrando en voz alta…'
                : isThinking
                  ? 'Analizando la simulación…'
                  : usingLocalBrain
                    ? 'Respondiendo con las métricas del motor'
                    : 'Interpreta lo que ocurre en la piel'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSpeaking && (
            <div className="flex h-3.5 items-end gap-0.5 rounded border border-accent/30 bg-surface px-1.5 py-0.5">
              <span className="h-full w-1 rounded-full bg-accent animate-voice-bar [animation-delay:0ms]" />
              <span className="h-2/3 w-1 rounded-full bg-accent animate-voice-bar [animation-delay:150ms]" />
              <span className="h-full w-1 rounded-full bg-accent animate-voice-bar [animation-delay:300ms]" />
            </div>
          )}

          <button
            onClick={toggleVoice}
            className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
              isVoiceActive
                ? 'border-accent/50 bg-accent-soft text-accent'
                : 'border-border bg-surface text-text-muted hover:text-text'
            }`}
            title={isVoiceActive ? 'Silenciar la voz del asistente' : 'Activar la voz del asistente'}
          >
            {isVoiceActive ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>{isVoiceActive ? 'Voz activa' : 'Voz'}</span>
          </button>
        </div>
      </header>

      {/* Hilo de conversación */}
      <div ref={scrollRef} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <div key={message.id} className="flex justify-end gap-2.5">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent-soft px-3.5 py-2.5 text-sm leading-relaxed text-text">
                  {message.content}
                </div>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-text-muted">
                  <User className="h-3.5 w-3.5" />
                </span>
              </div>
            );
          }

          const isBurn = message.milestoneType === 'burn';
          const Icon =
            message.milestoneType === 'barrier'
              ? Layers
              : isBurn
                ? Flame
                : message.kind === 'milestone'
                  ? Sparkles
                  : Bot;

          return (
            <div key={message.id} className="flex gap-2.5">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                  isBurn
                    ? 'border-risk-high/50 bg-risk-high/10 text-risk-high'
                    : 'border-border bg-surface-2 text-accent'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>

              <div className="flex max-w-[88%] flex-col gap-1">
                {message.kind === 'milestone' && message.timestamp && (
                  <span className="font-mono text-[10px] tabular-nums text-text-muted">
                    t = {message.timestamp}
                  </span>
                )}

                <div
                  className={`flex flex-col gap-0.5 rounded-2xl rounded-tl-sm border px-3.5 py-2.5 text-sm leading-relaxed text-text/90 ${
                    isBurn ? 'border-risk-high/40 bg-risk-high/5' : 'border-border bg-surface-2/50'
                  }`}
                >
                  {renderRichText(message.content)}
                </div>

                <button
                  onClick={() => speak((message.spokenText ?? message.content).replace(/\*\*/g, ''))}
                  className="flex w-fit cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[10px] text-text-muted transition-colors hover:text-accent"
                  title="Escuchar esta explicación"
                >
                  <Volume2 className="h-3 w-3" />
                  <span>Escuchar</span>
                </button>
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="flex gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-accent">
              <Bot className="h-3.5 w-3.5" />
            </span>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-surface-2/50 px-3.5 py-3">
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-voice-bar [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-voice-bar [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-voice-bar [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {/* Sugerencias rápidas mientras el usuario no ha preguntado nada */}
      {!hasUserMessages && (
        <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-border px-4 py-2.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => void sendMessage(prompt)}
              className="cursor-pointer rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-text-muted transition-colors hover:border-accent hover:text-text"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-surface-2/40 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-surface px-3 py-2 focus-within:border-accent">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Pregunta sobre la reacción del químico en la piel…"
            className="max-h-28 flex-1 resize-none bg-transparent py-1 text-sm text-text placeholder:text-text-muted focus:outline-none"
          />
          <button
            onClick={() => void sendMessage(draft)}
            disabled={!draft.trim() || isThinking}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-bg transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
            title="Enviar pregunta"
            aria-label="Enviar pregunta"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="px-1 pt-1.5 text-[10px] text-text-muted">
          El asistente interpreta; todos los números provienen del motor de simulación.
        </p>
      </div>
    </div>
  );
};
