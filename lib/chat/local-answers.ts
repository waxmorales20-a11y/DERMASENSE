import type { SimulationResult } from '@/packages/engine/types';

/**
 * Motor de respuestas local y determinista del asistente.
 *
 * Se usa cuando `/api/chat` no está disponible (sin ANTHROPIC_API_KEY o sin red).
 * No calcula nada: solo lee las métricas del motor y las redacta. Igual que la IA,
 * nunca declara que una formulación sea segura ni valida la irritación.
 */

export interface LocalAnswer {
  content: string;
  source: 'local';
}

function fmt(value: number, digits = 1): string {
  return value >= 9999 ? '>9999' : value.toFixed(digits);
}

function matches(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

export function answerLocally(
  question: string,
  result: SimulationResult,
  currentTimeHours: number
): LocalAnswer {
  // Se comparan palabras clave sin tildes para tolerar cómo escriba el usuario.
  const q = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  const { metrics, input } = result;
  const ing = input.ingredient;
  const isIrritant = metrics.irritationIndex >= 45;
  const isSevere = metrics.irritationIndex >= 70;

  const content = (() => {
    if (matches(q, ['profund', 'penetr', 'lejos', 'capa alcanz', 'hasta donde'])) {
      return `A las **${currentTimeHours.toFixed(1)} h** el frente de difusión llega a **${metrics.penetrationDepthUm.toFixed(0)} µm**. Para situarlo: el estrato córneo ocupa los primeros ~15 µm, la epidermis viable hasta ~100 µm y la dermis desde ahí hasta ~1500 µm. La fracción que ha cruzado la barrera córnea es del **${metrics.absorbedFractionPct.toFixed(1)} %**.`;
    }

    if (matches(q, ['irrit', 'quema', 'roja', 'rojo', 'eritema', 'inflam', 'dana', 'toler'])) {
      if (isSevere) {
        return `El índice heurístico de irritación es **${metrics.irritationIndex}/100** (banda ${metrics.irritationBand}), el rango más alto del modelo. Por eso ves la epidermis viable y la dermis teñidas de rojo en el corte 3D: la concentración pico en queratinocitos viables llega a **${metrics.peakConcentrationVE.toFixed(1)} µg/cm³** con un pH de ${input.pH}. Insisto en que es una heurística exploratoria, no una evaluación de seguridad.`;
      }
      if (isIrritant) {
        return `Hay señal de irritación moderada: índice heurístico **${metrics.irritationIndex}/100** (banda ${metrics.irritationBand}), con un pico en epidermis viable de **${metrics.peakConcentrationVE.toFixed(1)} µg/cm³**. En el visor eso se traduce en el enrojecimiento progresivo de la epidermis viable y la dermis. Es una estimación heurística no validada experimentalmente.`;
      }
      return `No aparece estrés inflamatorio relevante: el índice heurístico se queda en **${metrics.irritationIndex}/100** (banda ${metrics.irritationBand}), con un pico en epidermis viable de ${metrics.peakConcentrationVE.toFixed(1)} µg/cm³. Ojo: que la heurística sea baja no equivale a que la fórmula sea segura, eso requiere ensayo.`;
    }

    if (matches(q, ['lag', 'retardo', 'cuanto tarda', 'tiempo hasta', 'cuando empieza'])) {
      return `El lag time calculado es de **${fmt(metrics.lagTimeHours, 2)} h**: el tiempo que tarda el frente en establecerse a través de los lípidos del estrato córneo. El 50 % de la dosis que llega a cruzar lo hace a las **${fmt(metrics.timeTo50PctHours)} h**, dentro de la ventana simulada de ${input.durationHours} h.`;
    }

    if (matches(q, ['vehiculo', 'excipiente', 'portador', 'potenciador'])) {
      return `El vehículo es **${input.vehicle.name}**, con un factor potenciador de **${input.vehicle.enhancerFactor}×** sobre la difusividad del estrato córneo. Eso empuja el flujo máximo teórico a **${metrics.maxFluxInfiniteDose.toFixed(1)} µg/cm²/h**. Un vehículo menos potenciador bajaría el pico de exposición celular a costa de una absorción más lenta.`;
    }

    if (matches(q, ['ph'])) {
      return `La fórmula está a **pH ${input.pH}**. El pH entra en el índice heurístico de irritación y, en activos ionizables, condiciona la fracción no ionizada que realmente particiona hacia los lípidos. Con este pH el índice queda en ${metrics.irritationIndex}/100.`;
    }

    if (matches(q, ['concentr', 'dosis', 'cuanto producto'])) {
      return `Se aplican **${input.appliedDoseMgCm2} mg/cm²** de una fórmula al **${input.concentrationPct} %** de ${ing.name}. De esa masa, el **${metrics.absorbedFractionPct.toFixed(1)} %** cruza el estrato córneo en ${input.durationHours} h, alcanzando ${metrics.peakConcentrationVE.toFixed(1)} µg/cm³ de pico en epidermis viable.`;
    }

    if (matches(q, ['kp', 'permeab', 'flujo', 'flux'])) {
      return `El log Kp estimado por la correlación de Potts y Guy es **${metrics.logKp.toFixed(2)}**, es decir una permeabilidad de **${(metrics.permeabilityCmH * 1000).toFixed(4)} × 10⁻³ cm/h**. El flujo máximo teórico a dosis infinita es de **${metrics.maxFluxInfiniteDose.toFixed(1)} µg/cm²/h**; con dosis finita como esta, el vehículo se agota antes de llegar a ese techo.`;
    }

    if (matches(q, ['capas', 'estrato', 'epidermis', 'dermis', 'hipodermis', 'anatom'])) {
      return `El corte que ves atraviesa cuatro capas: **estrato córneo** (0–15 µm, la barrera real, lípidos intercelulares), **epidermis viable** (15–100 µm, queratinocitos vivos, donde se juega la tolerancia), **dermis** (100–1500 µm, colágeno y capilares, donde el activo puede pasar a circulación) e **hipodermis** (>1500 µm, tejido adiposo). Ahora mismo el frente va por los ${metrics.penetrationDepthUm.toFixed(0)} µm.`;
    }

    if (matches(q, ['limitac', 'supuesto', 'confia', 'fiab', 'valid'])) {
      const reasons =
        metrics.outOfDomainReasons.length > 0
          ? metrics.outOfDomainReasons.join('; ')
          : 'dentro del dominio empírico de aplicabilidad';
      return `Confianza del modelo: **${metrics.confidence}** (${reasons}). El motor resuelve difusión pasiva en 4 capas con la 2ª ley de Fick; no modela metabolismo cutáneo, vía folicular, piel dañada ni interacciones entre varios activos. Es una estimación bajo supuestos declarados, no una validación.`;
    }

    if (matches(q, ['segur', 'apto', 'puedo usar', 'aprob'])) {
      return `No puedo afirmar que sea segura ni apta para uso humano: este simulador estima transporte pasivo bajo supuestos declarados y su índice de irritación es heurístico, no validado. Lo que sí puedo decirte es qué muestran los números: ${metrics.absorbedFractionPct.toFixed(1)} % de fracción absorbida, ${metrics.peakConcentrationVE.toFixed(1)} µg/cm³ de pico en epidermis viable e índice ${metrics.irritationIndex}/100. La decisión requiere ensayo experimental.`;
    }

    if (matches(q, ['mejor', 'reduc', 'optimiz', 'sugier', 'recomend', 'como bajo', 'ajust'])) {
      return `Con estos números hay tres palancas: bajar la **concentración** desde el ${input.concentrationPct} % actual reduce proporcionalmente el pico en epidermis viable; cambiar a un vehículo con menor factor potenciador que ${input.vehicle.name} (${input.vehicle.enhancerFactor}×) aplana el flujo; y acercar el **pH** a ~5 alinea la fórmula con el manto hidrolipídico. Mueve un parámetro y pulsa Simular: el motor recalcula y verás el cambio en el corte.`;
    }

    if (matches(q, ['que esta pasando', 'que pasa', 'que veo', 'explica', 'ahora'])) {
      const phase =
        currentTimeHours < metrics.lagTimeHours * 0.5
          ? 'la fórmula todavía se está depositando sobre el estrato córneo'
          : currentTimeHours < metrics.lagTimeHours
            ? 'el activo está atravesando la matriz lipídica del estrato córneo'
            : 'el activo ya cruzó la barrera y difunde hacia el tejido viable';
      return `En este instante (**${currentTimeHours.toFixed(1)} h**) ${phase}. El frente va por **${metrics.penetrationDepthUm.toFixed(0)} µm** y el índice heurístico de irritación marca ${metrics.irritationIndex}/100.${isIrritant ? ' Por eso las capas viables aparecen enrojecidas en el visor.' : ''}`;
    }

    return `Sobre esta simulación de **${ing.name} al ${input.concentrationPct} %** en ${input.vehicle.name}: log Kp **${metrics.logKp.toFixed(2)}**, lag time **${fmt(metrics.lagTimeHours, 2)} h**, fracción absorbida **${metrics.absorbedFractionPct.toFixed(1)} %**, profundidad **${metrics.penetrationDepthUm.toFixed(0)} µm** e índice heurístico de irritación **${metrics.irritationIndex}/100**. Pregúntame por la profundidad, la irritación, el vehículo, el pH o las limitaciones del modelo y lo desarrollo.`;
  })();

  return { content, source: 'local' };
}
