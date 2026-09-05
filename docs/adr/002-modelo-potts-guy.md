# ADR-002 — Potts-Guy como base del modelo predictivo

**Estado:** Aceptada · **Fecha:** 2026-09-05

## Contexto

DERMASENSE necesita estimar la permeabilidad cutánea de un activo. Las opciones eran:
inventar una heurística propia, entrenar un modelo con datos que no tenemos, o adoptar una
correlación QSPR publicada y ampliamente citada.

Ante un jurado técnico y, más adelante, ante formuladores profesionales, la pregunta
inevitable es: *"¿de dónde sale ese número?"*. La respuesta determina si la herramienta se
adopta o se descarta.

## Decisión

Se adopta la correlación de **Potts & Guy (1992)**:

```
log Kp = -2.7 + 0.71 · logP − 0.0061 · MW
```

como base para la permeabilidad del estrato córneo, acoplada a un solver de la 2ª ley de
Fick para la dinámica temporal a través de las cuatro capas.

Se declara y se aplica en el producto un **dominio de aplicabilidad explícito**
(MW <= 500 g/mol, -1 <= logP <= 6). Fuera de él, el resultado se marca con
`confidence: 'low'` y se muestran los motivos concretos al usuario.

## Consecuencias

**A favor**
- Trazabilidad: cada número tiene una referencia bibliográfica citable.
- Cálculo instantáneo, sin datos de entrenamiento ni infraestructura de ML.
- Solo requiere dos descriptores (MW y logP) disponibles públicamente en PubChem, lo que
  hace trivial ampliar el catálogo de ingredientes.
- Reconocer los propios límites es una ventaja competitiva frente a herramientas que
  presentan certeza infundada.

**En contra**
- Es un modelo de 1992 con precisión limitada; el error típico frente a datos
  experimentales es de aproximadamente un orden de magnitud en `Kp`. Se comunica
  explícitamente en el producto.
- No captura ionización dependiente del pH ni efectos de formulación complejos. El efecto
  del vehículo se aproxima mediante un `enhancerFactor` empírico, que se declara como
  simplificación, no como física.
- No aplica a macromoléculas ni a nanoacarreadores.

## Alternativas descartadas

- **Heurística propia sin base publicada:** indefendible ante cualquier revisor técnico.
- **Modelo de ML:** no disponemos de un conjunto de datos de permeabilidad, y entrenar uno
  con datos sintéticos sería fabricar credibilidad falsa.
- **Modelos más recientes (Magnusson, Mitragotri):** mejoran la precisión pero exigen
  descriptores adicionales que encarecen el llenado del catálogo. Quedan como línea de
  evolución una vez validado el flujo con usuarios.

## Compromiso de honestidad

El producto nunca presenta estos resultados como validación de seguridad. El benchmarking
contra datos de celda de Franz está declarado como **roadmap**, no como capacidad actual.
