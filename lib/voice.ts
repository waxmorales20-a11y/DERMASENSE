// Seleccion de voz del asistente para la Web Speech API.
//
// Objetivo: una voz femenina en espanol, serena y de cadencia regular, al estilo de
// un asistente de IA de laboratorio. La Web Speech API solo permite elegir entre las
// voces instaladas en el sistema del usuario, por lo que aqui se ordenan por
// preferencia y se ajusta el timbre (pitch/rate) para acercarlo a ese caracter.

// Voces femeninas en espanol habituales en Windows, macOS, Chrome y Edge.
const FEMALE_ES_VOICE_HINTS = [
  'elvira',
  'laura',
  'helena',
  'sabina',
  'dalia',
  'ximena',
  'paloma',
  'monica',
  'mónica',
  'lucia',
  'lucía',
  'esperanza',
  'abril',
  'isidora',
  'catalina',
  'marisol',
  'female',
  'mujer',
];

const MALE_ES_VOICE_HINTS = [
  'pablo',
  'jorge',
  'diego',
  'alvaro',
  'álvaro',
  'raul',
  'raúl',
  'carlos',
  'miguel',
  'andres',
  'andrés',
  'male',
  'hombre',
];

// Las voces "Natural" / "Online" de Edge suenan notablemente mas humanas.
const HIGH_QUALITY_HINTS = ['natural', 'online', 'neural', 'premium', 'enhanced'];

/** Timbre del asistente: femenino, calmado y ligeramente brillante. */
export const ASSISTANT_VOICE_PROFILE = {
  pitch: 1.15,
  rate: 0.98,
  lang: 'es-ES',
} as const;

function includesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function isSpanish(voice: SpeechSynthesisVoice): boolean {
  return voice.lang.toLowerCase().startsWith('es');
}

/**
 * Devuelve la mejor voz disponible para el asistente, priorizando:
 * 1. Femenina en espanol y de alta calidad (Natural / Neural).
 * 2. Femenina en espanol.
 * 3. Cualquier voz en espanol que no sea masculina conocida.
 * 4. Cualquier voz en espanol.
 */
export function pickAssistantVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const spanish = voices.filter(isSpanish);
  const pool = spanish.length > 0 ? spanish : voices;

  const scored = pool.map((voice) => {
    const name = voice.name.toLowerCase();
    const isFemale = includesAny(name, FEMALE_ES_VOICE_HINTS);
    const isMale = includesAny(name, MALE_ES_VOICE_HINTS);
    const isHighQuality = includesAny(name, HIGH_QUALITY_HINTS);

    let score = 0;
    if (isFemale) score += 100;
    if (isMale) score -= 80;
    if (isHighQuality) score += 25;
    if (voice.lang.toLowerCase() === 'es-es') score += 10;
    if (voice.localService) score += 2;

    return { voice, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice ?? null;
}

/** Obtiene la voz del asistente directamente del navegador (o null en SSR). */
export function getAssistantVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return pickAssistantVoice(window.speechSynthesis.getVoices());
}

/** Aplica voz y timbre del asistente a una locucion. */
export function applyAssistantVoice(
  utterance: SpeechSynthesisUtterance,
  voice: SpeechSynthesisVoice | null,
  rate: number = ASSISTANT_VOICE_PROFILE.rate
): void {
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? ASSISTANT_VOICE_PROFILE.lang;
  utterance.pitch = ASSISTANT_VOICE_PROFILE.pitch;
  utterance.rate = rate;
}
