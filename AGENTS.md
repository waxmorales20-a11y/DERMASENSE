# AGENTS.md — DERMASENSE

Guía para agentes de IA que trabajen en este repositorio.

## Qué es este proyecto

Laboratorio virtual de simulación de penetración dérmica para I+D cosmética.
Lee primero [docs/SIMULATION_MODEL.md](docs/SIMULATION_MODEL.md): define qué afirma y qué
NO afirma el producto. Es la restricción más importante del proyecto.

## Reglas no negociables

1. **Ninguna credencial en el repositorio.** Ni en código, ni en documentación, ni en
   commits, ni en memoria de agentes. Solo `.env.example` con placeholders.
2. **`packages/engine` no importa de `app/`, `components/` ni `lib/`.** Es TypeScript puro,
   determinista y sin acceso a red ni DOM.
3. **La IA no calcula números.** Todo valor numérico proviene del motor. La IA solo
   interpreta.
4. **No se sobredeclara la capacidad del modelo.** Nunca escribir que el sistema "valida",
   "garantiza" o "asegura" la seguridad de una formulación. Se estima, bajo supuestos
   declarados.
5. **El índice de irritación es heurístico** y debe etiquetarse así en todo lugar donde
   aparezca, incluida la UI.

## Comandos

```bash
npm run dev            # desarrollo
npm test               # suite completa
npm run test:watch
npm run build          # build de producción
npm run lint
```

## Convenciones

- TypeScript `strict`. Sin `any` en `packages/engine`.
- Nombres de dominio en inglés en el código (`stratumCorneum`, `logKp`); textos de UI y
  documentación en español.
- Unidades explícitas en los nombres: `thicknessUm`, `steadyStateFlux` (µg/cm²/h),
  `durationHours`. Los errores de unidades son la fuente de bug más probable en este
  proyecto.
- Cada módulo del motor tiene su archivo de test en `tests/engine/`.
- Componentes de React en PascalCase; utilidades en camelCase.

## Antes de dar por terminada una tarea

- `npm test` en verde.
- `git grep -iE "sk-ant|service_role|eyJhbGci"` sin resultados.
- Documentación actualizada si cambió el comportamiento, la arquitectura o el modelo.
