import type { SimulationResult } from '@/packages/engine/types';

// Helper global para locución sintética con Web Speech API
export function speakSimulationState(
  result: SimulationResult,
  currentFrameIndex: number,
  prefixMessage?: string,
  rate: number = 1.0
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();

    const { metrics, input, frames } = result;
    const currentFrame = frames[currentFrameIndex];
    const timeHours = currentFrame ? currentFrame.timeHours : 0;
    const isBurning = metrics.irritationIndex >= 45;
    const isSevereBurn = metrics.irritationIndex >= 70;

    let narrative = prefixMessage ? `${prefixMessage}. ` : '';

    narrative += `Simulación de ${input.ingredient.name} al ${input.concentrationPct}% en vehículo ${input.vehicle.name}. `;
    narrative += `Tiempo transcurrido: ${timeHours.toFixed(1)} horas. `;

    if (isSevereBurn) {
      narrative += `¡Atención crítica de seguridad! Se detecta quemadura química y citotoxicidad severa con un índice de irritación heurístico de ${metrics.irritationIndex} sobre cien. La simulación muestra eritema tisular en color rojo intenso.`;
    } else if (isBurning) {
      narrative += `Advertencia biológica: se observa reacción eritematosa moderada con índice heurístico de ${metrics.irritationIndex} sobre cien en la epidermis viable.`;
    } else {
      narrative += `El compuesto difunde a través de la barrera cutánea sin estrés inflamatorio. Retardo estimado de ${metrics.lagTimeHours.toFixed(1)} horas con penetración de ${metrics.penetrationDepthUm.toFixed(0)} micrómetros.`;
    }

    const utterance = new SpeechSynthesisUtterance(narrative);
    utterance.lang = 'es-ES';
    utterance.rate = rate;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const spanishVoice =
      voices.find((v) => v.lang === 'es-ES') ||
      voices.find((v) => v.lang.startsWith('es-')) ||
      voices.find((v) => v.lang.includes('es'));

    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('Error al reproducir locución sintética:', err);
  }
}

export function stopSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}