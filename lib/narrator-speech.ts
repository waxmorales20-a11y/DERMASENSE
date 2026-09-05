import type { SimulationResult } from '@/packages/engine/types';
import { applyAssistantVoice, getAssistantVoice } from '@/lib/voice';

// Helper global para locucion sintetica con Web Speech API.
// La IA no calcula: toda cifra pronunciada proviene del motor determinista.

function hasSpeech(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Habla un texto con la voz del asistente. Si el navegador aun no ha cargado el
 * catalogo de voces, espera al evento `voiceschanged` y reintenta una sola vez.
 */
function speakWithAssistantVoice(text: string, rate: number = 0.98): void {
  if (!hasSpeech()) return;

  const emit = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    applyAssistantVoice(utterance, getAssistantVoice(), rate);
    window.speechSynthesis.speak(utterance);
  };

  window.speechSynthesis.cancel();

  if (window.speechSynthesis.getVoices().length === 0) {
    const onVoices = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
      emit();
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoices);
    // Reintento defensivo por si el evento no llega (Safari).
    window.setTimeout(emit, 400);
    return;
  }

  emit();
}

export function speakSimulationState(
  result: SimulationResult,
  currentFrameIndex: number,
  prefixMessage?: string,
  rate: number = 0.98
): void {
  if (!hasSpeech()) return;

  try {
    const { metrics, input, frames } = result;
    const currentFrame = frames[currentFrameIndex];
    const timeHours = currentFrame ? currentFrame.timeHours : 0;
    const isBurning = metrics.irritationIndex >= 45;
    const isSevereBurn = metrics.irritationIndex >= 70;

    let narrative = prefixMessage ? `${prefixMessage}. ` : '';

    narrative += `Simulación de ${input.ingredient.name} al ${input.concentrationPct}% en vehículo ${input.vehicle.name}. `;
    narrative += `Tiempo transcurrido: ${timeHours.toFixed(1)} horas. `;

    if (isSevereBurn) {
      narrative += `Atención crítica de seguridad. Se detecta quemadura química y citotoxicidad severa con un índice de irritación heurístico de ${metrics.irritationIndex} sobre cien. La simulación muestra eritema tisular en rojo intenso.`;
    } else if (isBurning) {
      narrative += `Advertencia biológica: se observa reacción eritematosa moderada con índice heurístico de ${metrics.irritationIndex} sobre cien en la epidermis viable.`;
    } else {
      narrative += `El compuesto difunde a través de la barrera cutánea sin estrés inflamatorio. Retardo estimado de ${metrics.lagTimeHours.toFixed(1)} horas con penetración de ${metrics.penetrationDepthUm.toFixed(0)} micrómetros.`;
    }

    speakWithAssistantVoice(narrative, rate);
  } catch (err) {
    console.error('Error al reproducir locución sintética:', err);
  }
}

/**
 * Narracion completa de la simulacion, de principio a fin. Se usa al entrar en
 * pantalla completa: el asistente recorre todo el experimento en voz alta.
 */
export function speakFullSimulation(result: SimulationResult, rate: number = 0.98): void {
  if (!hasSpeech()) return;

  try {
    const { metrics, input } = result;
    const isBurning = metrics.irritationIndex >= 45;
    const isSevereBurn = metrics.irritationIndex >= 70;
    const lag = metrics.lagTimeHours;

    const parts: string[] = [];

    parts.push(
      `Pantalla completa activada. Iniciando narración integral del experimento in sílico.`
    );
    parts.push(
      `Formulación: ${input.ingredient.name} al ${input.concentrationPct} por ciento, en vehículo ${input.vehicle.name}, a pH ${input.pH.toFixed(1)}, con una dosis aplicada de ${input.appliedDoseMgCm2.toFixed(1)} miligramos por centímetro cuadrado y una ventana de observación de ${input.durationHours} horas.`
    );
    parts.push(
      `Fase uno. La formulación se deposita sobre el estrato córneo. El coeficiente de permeabilidad estimado es un log Kp de ${metrics.logKp.toFixed(2)}.`
    );
    parts.push(
      `Fase dos. Travesía de la barrera lipídica. El tiempo de retardo calculado es de ${lag >= 9999 ? 'prácticamente infinito' : `${lag.toFixed(1)} horas`}, y el flujo máximo alcanza ${metrics.maxFluxInfiniteDose.toFixed(1)} microgramos por centímetro cuadrado y hora.`
    );
    parts.push(
      `Fase tres. Llegada a la epidermis viable. La concentración pico proyectada en queratinocitos es de ${metrics.peakConcentrationVE.toFixed(1)} microgramos por centímetro cúbico, con una fracción absorbida del ${metrics.absorbedFractionPct.toFixed(1)} por ciento.`
    );
    parts.push(
      `Fase cuatro. Distribución dérmica. La profundidad efectiva alcanzada es de ${metrics.penetrationDepthUm.toFixed(0)} micrómetros, y el tiempo hasta el cincuenta por ciento de la exposición es de ${metrics.timeTo50PctHours.toFixed(1)} horas.`
    );

    if (isSevereBurn) {
      parts.push(
        `Alerta crítica. El índice de irritación heurístico es de ${metrics.irritationIndex} sobre cien, banda ${metrics.irritationBand}. En el corte tridimensional observarás la epidermis viable y la dermis teñidas de rojo intenso: quemadura química y citotoxicidad.`
      );
    } else if (isBurning) {
      parts.push(
        `Precaución. El índice de irritación heurístico es de ${metrics.irritationIndex} sobre cien, banda ${metrics.irritationBand}. Las capas dérmicas muestran enrojecimiento inflamatorio en el corte tridimensional.`
      );
    } else {
      parts.push(
        `Sin señales de estrés inflamatorio relevante. El índice de irritación heurístico se mantiene en ${metrics.irritationIndex} sobre cien, banda ${metrics.irritationBand}.`
      );
    }

    parts.push(
      `Recuerda que el índice de irritación es heurístico y que este resultado es una estimación bajo supuestos declarados, no una validación de seguridad.`
    );

    speakWithAssistantVoice(parts.join(' '), rate);
  } catch (err) {
    console.error('Error al narrar la simulación completa:', err);
  }
}

export function stopSpeech(): void {
  if (hasSpeech()) {
    window.speechSynthesis.cancel();
  }
}
