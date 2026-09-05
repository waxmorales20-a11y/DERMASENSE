# ADR-001 — Motor de simulación en el cliente

**Estado:** Aceptada · **Fecha:** 2026-09-05

## Contexto

El motor calcula la difusión de un activo a través de cuatro capas de piel mediante un
solver de diferencias finitas. Puede ejecutarse en un Route Handler de Vercel o directamente
en el navegador. El producto depende de un bucle de iteración rápido: ajustar un parámetro,
volver a simular, leer el resultado.

## Decisión

El motor se implementa como TypeScript puro en `packages/engine` y **se ejecuta en el
navegador**. El servidor solo persiste resultados y genera reportes con IA.

## Consecuencias

**A favor**
- Latencia cero: mover un slider recalcula al instante, sin ida y vuelta de red.
- Costo de cómputo nulo para nosotros: escala con los dispositivos de los usuarios.
- El motor queda aislado y testeable sin infraestructura ni mocks.
- Funciona sin conexión una vez cargada la aplicación.

**En contra**
- El rendimiento depende del dispositivo del usuario. Se mitiga con un time-box de coste
  (< 2 s en gama media) y submuestreo de frames.
- La lógica del modelo es visible en el bundle. Se acepta: la ecuación de Potts-Guy está
  publicada desde 1992; el valor del producto está en la experiencia y los datos, no en
  ocultar una fórmula conocida.
- Los `frames` no viajan al servidor. Se resuelve persistiendo `input` + `engineVersion`,
  ya que el motor es determinista y el resultado es reproducible.

## Alternativas descartadas

- **Route Handler en Vercel:** añade 200-800 ms por iteración y coste por invocación,
  rompiendo el bucle rápido que define el producto.
- **Web Worker:** válido, pero con < 2 s de cómputo el bloqueo del hilo principal es
  tolerable. Se reserva como optimización si el benchmark lo exige.
