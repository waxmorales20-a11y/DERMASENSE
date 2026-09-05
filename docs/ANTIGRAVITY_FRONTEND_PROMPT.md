# Prompt para Antigravity — Construcción del Frontend de DERMASENSE

> Este archivo es el prompt en sí. Cópialo completo (desde "## Contexto" hasta el final)
> y pégalo en Antigravity. Se guarda aquí también para que quede versionado y cualquiera
> del equipo pueda ver exactamente qué instrucciones recibió el agente.

---

## Contexto

Estás trabajando en **DERMASENSE**, un laboratorio virtual de simulación de penetración
dérmica para I+D cosmética, construido en 7 horas de hackathon (track *Future of Health &
Wellbeing*). El repositorio ya existe y tiene trabajo real hecho — no es un proyecto vacío.

**Repositorio:** `https://github.com/waxmorales20-a11y/DERMASENSE` (rama `main`)
**Producción actual:** `https://dermasense-rose.vercel.app` (deploy automático en cada push)

**Tu tarea:** construir el frontend completo en Next.js. Tú te encargas de **todo el
frontend** — formularios, visor 3D, estado, integración con el motor de simulación,
persistencia contra Supabase, y el reporte de IA. No toques el motor de simulación como
lógica de negocio (ya está construido y probado), solo consúmelo.

Hay un equipo de 4 personas. Reparto de trabajo:

| Persona | Rol |
|---|---|
| Jeanfranco Chamorro | Tech Lead / Arquitectura / Simulación |
| **Max Morales** | **Frontend / Visualización 3D — esto es lo que tú vas a construir** |
| Tonny Hinostroza | Backend Python / ML / IA (proyecto aparte, ver §7) |
| Julio Rios | Producto / Investigación / Documentación |

---

## 1. Lee esto antes de escribir código

El repositorio tiene documentación completa en `/docs`. **Léela en este orden** antes de
tocar nada — te ahorra reinventar decisiones ya tomadas y evita que reintroduzcas errores
que ya se corrigieron:

1. `README.md` — visión general, problema, MVP, stack.
2. `docs/SIMULATION_MODEL.md` — la ciencia detrás del motor: qué calcula y qué NO calcula.
   **Sección 6 es crítica**: lista las limitaciones honestas del modelo. No las ignores.
3. `docs/TRD.md` — contratos de datos TypeScript exactos que ya existen en
   `packages/engine/types.ts`. Úsalos tal cual, no los redefinas.
4. `docs/APP_FLOW.md` — navegación, máquina de estados de una simulación, guion de demo.
   **La sección 3 (máquina de estados) es el contrato que tu UI debe respetar literalmente.**
5. `docs/UI_UX_DESIGN_BRIEF.md` — sistema de diseño completo: colores, tipografía,
   layout de 3 columnas, componentes. No inventes un sistema de diseño nuevo, usa este.
6. `docs/BACKEND_SCHEMA.md` — esquema de Supabase (tablas, RLS). Aún no está desplegado
   en una base de datos real — puede que tengas que crearlo tú mismo en el proyecto
   Supabase del equipo, o coordinarlo. Ver §6.
7. `docs/DATA_SOURCES.md` — qué datos del sistema son reales y cuáles son heurísticas
   declaradas. Esto determina qué debes etiquetar como "estimado" en la UI.
8. `docs/API_CONTRACT.md` — el contrato con el backend Python de Tonny. **Ese backend
   probablemente no existe todavía o está incompleto.** Tu UI debe funcionar razonablemente
   bien aunque esos endpoints fallen o no respondan (ver regla de degradación en §6 de
   ese documento).
9. `docs/adr/` (4 documentos) — decisiones de arquitectura ya tomadas y sus razones. En
   particular `adr/001` y `adr/004` explican por qué el motor de simulación corre en el
   navegador en TypeScript y no se reimplementa en Python.

---

## 2. Qué ya existe — NO lo reconstruyas

### 2.1 Motor de simulación (`packages/engine/`) — terminado, con 47 tests en verde

```
packages/engine/
  types.ts        Todos los contratos de datos: SimulationInput, SimulationResult,
                   SimulationMetrics, Ingredient, Vehicle, LayerProfile, etc.
  constants.ts     Capas de piel por defecto, dominio de aplicabilidad del modelo
  qspr.ts          Correlación Potts-Guy, chequeo de dominio (logKp, checkDomain, etc.)
  mesh.ts          Construcción de la malla espacial (buildMesh)
  diffusion.ts     Solver numérico de difusión (solve)
  irritation.ts    Índice heurístico de irritación (irritationIndex, irritationBand)
  simulate.ts      Función principal: simulate(input: SimulationInput): SimulationResult
                   Lanza SimulationError si el input es inválido.
```

**Punto de entrada único que necesitas:**

```typescript
import { simulate, SimulationError } from '@/packages/engine/simulate';
import type { SimulationInput, SimulationResult } from '@/packages/engine/types';

const result: SimulationResult = simulate(input); // síncrono, determinista, <2s
```

- Es **síncrono y determinista**: mismos inputs → mismos outputs, siempre. No hace falta
  loading state para el cálculo en sí (toma <2 segundos), pero sí conviene un
  `requestIdleCallback` o debounce si lo llamas en cada cambio de un slider en tiempo real.
- Corre **enteramente en el navegador**. No hay API route que envolver para simular.
- Puede lanzar `SimulationError` con un mensaje accionable (ej. "El pH debe estar entre
  3.0 y 9.0") — captúrala y muéstrala inline en el formulario, no como error genérico.
- El resultado (`SimulationResult.metrics`) incluye `confidence: 'high' | 'medium' | 'low'`
  y `outOfDomainReasons: string[]`. **Cuando `confidence !== 'high'`, la UI debe mostrar
  un aviso visible con los motivos**, no ocultarlo. Esto no es opcional — es la
  característica que más le importa al equipo (ver `docs/DATA_SOURCES.md`).

**Antes de usar el motor, corre los tests para confirmar que todo compila en tu entorno:**

```bash
npm install
npm test          # deben pasar 47/47
npm run typecheck # tsc --noEmit
```

### 2.2 Scaffold de Next.js — mínimo, listo para construir encima

```
app/
  layout.tsx    Fuentes (Inter + JetBrains Mono para cifras tabulares), metadata
  page.tsx      Landing minimalista de un solo párrafo — reemplázalo o constrúyelo
  globals.css   Reset de Tailwind v4, sin tokens de color todavía
```

Stack ya decidido en `package.json` (no lo cambies sin razón fuerte):
Next.js 16 (App Router) · React 19 · TypeScript 5 (`strict: true`) · Tailwind CSS v4 ·
Zustand 5 · Zod 3 · `@react-three/fiber` + `@react-three/drei` + `three` ·
`@supabase/supabase-js` + `@supabase/ssr` · `@anthropic-ai/sdk` · Vitest.

**Nota:** `@react-three/fiber`, `three`, `@supabase/*` y `@anthropic-ai/sdk` están en
`package.json` pero **aún no se ha escrito código que los use**. Vas a ser tú quien los
integre por primera vez.

### 2.3 Lo que NO existe todavía (todo esto es tu trabajo)

- Ningún componente de UI real (formularios, visor 3D, paneles de métricas).
- Ninguna Route Handler de Next.js (`/api/simulations`, `/api/report`, `/api/ingredients`).
- Ningún cliente de Supabase configurado, ni las tablas creadas en un proyecto real.
- Ningún catálogo de ingredientes con datos reales (hay una lista de ~60 propuesta en
  `docs/DATA_SOURCES.md` §3.5, pero sin curar todavía).
- El sistema de diseño (tokens de color, tipografía) está especificado en el brief pero no
  implementado en `globals.css` ni en `tailwind.config`.

---

## 3. Qué construir, en orden de prioridad

Sigue este orden. Cada paso debe quedar funcional (aunque sea con datos mock) antes de
pasar al siguiente — no dejes nada a medias que bloquee una demo.

### Paso 1 — Sistema de diseño base (30–45 min)
Implementa los tokens de color y tipografía de `docs/UI_UX_DESIGN_BRIEF.md` §3–4 en
`app/globals.css` (tema oscuro por defecto, con soporte de tema claro). Usa
`font-variant-numeric: tabular-nums` en todo dato numérico, como pide el brief §4.

### Paso 2 — Catálogo mock de ingredientes y vehículos
Crea `lib/mock-catalog.ts` con ~10-15 ingredientes (usa los datos reales de PubChem del
seed en `docs/BACKEND_SCHEMA.md` §5 — ya están curados, no inventes números nuevos) y los
6 vehículos ahí listados. Esto te desbloquea para construir la UI sin esperar a que exista
la base de datos real.

### Paso 3 — El Laboratorio (`/lab`) — la pantalla central del producto
Implementa el layout de 3 columnas de `docs/UI_UX_DESIGN_BRIEF.md` §6:
- **Columna izquierda:** formulario de formulación (ingrediente, concentración, vehículo,
  pH, duración, sitio anatómico — default **Abdomen**, ver `docs/DATA_SOURCES.md`).
  Validación con Zod, reflejando los rangos de `SimulationInput` en `types.ts`.
- **Columna central:** visor 3D con `@react-three/fiber`. Cuatro capas con espesor
  proporcional (con conmutador de escala lineal/logarítmica — el estrato córneo es
  invisible a escala lineal, ver brief §7). Gradiente de concentración por frame usando
  una textura de datos 1D, no regenerando geometría en cada frame.
  **Si el 3D te toma más de un tiempo razonable, implementa primero el fallback 2D en
  canvas** (un corte lateral con el gradiente, sin Three.js) y vuelve al 3D después. El
  brief §6 dice explícitamente que un 3D a medias es peor que un 2D funcional.
- **Columna derecha:** panel de métricas (`MetricCard`, `IrritationGauge` con la etiqueta
  obligatoria "estimación heurística exploratoria", `ConfidenceBanner` cuando
  `confidence !== 'high'`) y controles del timeline.

Sigue la máquina de estados exacta de `docs/APP_FLOW.md` §3
(`Idle → Configuring → Running → Ready → Saving/Reporting`). Es importante la invariante
que ahí se documenta: **una vez alcanzado `Ready`, ningún fallo posterior (red, IA,
guardado) puede hacer desaparecer el resultado ya calculado en pantalla.**

### Paso 4 — Autenticación y persistencia
- Cliente de Supabase (`lib/supabase/client.ts` y `server.ts`, con `@supabase/ssr`).
- Páginas `/login` y `/signup`.
- Route Handlers `POST/GET /api/simulations`, `GET/DELETE /api/simulations/[id]` según
  contratos exactos de `docs/TRD.md` §3. Importante: **no se persisten los `frames`
  completos**, solo `input` + `metrics` + `engineVersion` (el motor es determinista, así
  que la simulación es reproducible sin guardar el histórico completo).
- Si el proyecto de Supabase del equipo aún no tiene las tablas de
  `docs/BACKEND_SCHEMA.md` creadas, dilo explícitamente en tu respuesta y usa datos mock
  mientras tanto — no bloquees el resto del frontend por esto.

### Paso 5 — Reporte con IA (Claude)
Route Handler `POST /api/report` según `docs/AI_PROMPTS.md` (el prompt de sistema y la
plantilla ya están escritos ahí, cópialos literalmente, no los reescribas). Estado de
carga, error y reintento en la UI — si la IA falla, las métricas de la simulación deben
seguir visibles (ver invariante del Paso 3).

### Paso 6 — Historial (`/simulations`)
Listado de simulaciones guardadas del usuario, con estado vacío cuando no hay ninguna
(ver `docs/APP_FLOW.md` §5).

### Paso 7 — Pruebas
Añade tests de integración para las Route Handlers (`tests/api/`) cubriendo al menos:
happy path de `/api/simulations` (201) y el caso de error crítico de `/api/report` cuando
la IA no responde (debe devolver `503 AI_UNAVAILABLE` sin romper nada, según
`docs/TRD.md` §6).

---

## 4. Reglas que no son negociables

Estas vienen de `AGENTS.md` en la raíz del repo y de decisiones ya tomadas por el equipo.
Rómperlas no es un error de estilo, es deshacer trabajo ya validado:

1. **Nunca subas credenciales.** `.env.local` ya está en `.gitignore`. Usa
   `.env.example` como referencia de qué variables existen.
2. **No muevas la lógica de simulación al servidor.** El motor corre en el cliente por
   diseño (ADR-001) — es lo que permite que mover un slider recalcule al instante.
3. **No inventes datos fisicoquímicos nuevos de ingredientes.** Usa únicamente los del
   seed curado en `docs/BACKEND_SCHEMA.md` §5, que ya tienen procedencia verificada
   (PubChem). Si necesitas más ingredientes, avísalo, no los inventes.
4. **Nunca ocultes la incertidumbre del modelo.** El índice de irritación es heurístico y
   debe decirlo en la UI. `confidence: 'medium' | 'low'` debe mostrarse, no silenciarse.
5. **Ninguna pantalla debe bloquearse esperando al backend Python de Tonny**
   (`docs/API_CONTRACT.md` §6). Ese backend puede no estar listo. Todo lo que dependa de
   él necesita un camino de fallback (ej. entrada manual de datos si
   `/ingredients/research` no responde).
6. **No cambies el contrato de `docs/API_CONTRACT.md` sin avisar al equipo** — Tonny está
   construyendo su backend contra ese mismo documento en paralelo.

---

## 5. Aviso de honestidad que debe llegar a la interfaz

Este producto se apoya en no prometer más de lo que puede cumplir. Dos textos deben
aparecer literalmente en la UI, no parafraseados:

- Junto al índice de irritación: **"estimación heurística exploratoria — no es una
  evaluación de seguridad"**.
- En algún lugar persistente y visible (footer, panel de "Supuestos del modelo"):
  **"DERMASENSE es un sistema de soporte a la decisión en fase exploratoria de I+D. No
  constituye diagnóstico médico, evidencia de seguridad ni validación regulatoria."**

---

## 6. Sobre Supabase

El equipo tiene un proyecto Supabase (`project_ref: pgjkyupbnmufswzgajid`) y un servidor
MCP configurado en `.mcp.json` en la raíz del repo (sin credenciales, solo el
`project_ref` público). Si tienes acceso a herramientas MCP de Supabase, puedes usarlas
para crear las tablas de `docs/BACKEND_SCHEMA.md` directamente. Si no, coordina con el
equipo antes de asumir que las tablas existen — verifica antes de escribir código que
depende de un esquema que podría no estar desplegado aún.

---

## 7. Sobre el backend de Tonny (Python/FastAPI)

No construyas nada de esto — es responsabilidad de Tonny. Solo necesitas saber que existe
un contrato (`docs/API_CONTRACT.md`) con 4 endpoints (investigación de ingredientes,
predicción ML/QSPR, reportes Excel, revisión regulatoria) que **probablemente no estarán
listos durante buena parte del desarrollo**. Diseña tu UI asumiendo que esos endpoints
pueden no existir todavía, con degradación explícita como se indica en la sección 6 de
ese documento.

---

## 8. Cuando termines una parte

- Corre `npm test` y `npm run typecheck` — deben seguir en verde (motor incluido).
- Corre `npm run build` para confirmar que compila para producción.
- No hagas commit de `.env.local`, `node_modules`, `.next`, ni de las carpetas
  `.claude/`, `.agents/`, `agent/`, `.engram/` (son configuración local de herramientas de
  IA, no código del proyecto — ya están en `.gitignore`).
- Si algo de esta documentación está desactualizado respecto al código real que
  encuentres, dilo explícitamente en tu respuesta en vez de asumir que la documentación
  es la fuente de verdad absoluta — el repositorio puede haber cambiado desde que se
  escribió este prompt.
