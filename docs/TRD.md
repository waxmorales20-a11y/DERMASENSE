# Technical Requirement Document (TRD) — DERMASENSE

**Versión:** 1.0 · Complementa a [PRD.md](PRD.md) y [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 1. Stack y versiones fijadas

| Capa | Paquete | Versión objetivo |
|---|---|---|
| Runtime | Node.js | >= 20 LTS |
| Framework | `next` | 15.x (App Router) |
| UI | `react`, `react-dom` | 19.x |
| Lenguaje | `typescript` | 5.x, `strict: true` |
| Estilos | `tailwindcss` | 4.x |
| Componentes | `shadcn/ui` + `lucide-react` | latest |
| 3D | `three`, `@react-three/fiber`, `@react-three/drei` | latest compatible con React 19 |
| Estado | `zustand` | 5.x |
| Validación | `zod` | 3.x |
| Backend | `@supabase/supabase-js`, `@supabase/ssr` | 2.x |
| IA | `@anthropic-ai/sdk` | latest |
| Tests | `vitest`, `@testing-library/react` | latest |

**Modelo de IA:** `claude-sonnet-5` para generación de reportes (balance
calidad/latencia/costo en un flujo interactivo).

---

## 2. Contratos de datos (TypeScript)

```ts
// packages/engine/types.ts

export interface Ingredient {
  id: string;
  name: string;
  molecularWeight: number;   // g/mol
  logP: number;              // partición octanol/agua
  pka?: number;
  riskFlags: RiskFlag[];     // 'retinoid' | 'aha' | 'bha' | 'surfactant' | 'essential_oil'
}

export interface Vehicle {
  id: string;
  name: string;              // agua, gel, emulsión O/W, etanólico, anhidro
  enhancerFactor: number;    // 1.0 = neutro; > 1 potencia la penetración
}

export interface SimulationInput {
  ingredient: Ingredient;
  vehicle: Vehicle;
  concentrationPct: number;  // 0.01 - 30 (% p/p)
  pH: number;                // 3.0 - 9.0
  durationHours: number;     // 1 - 48
  appliedDoseMgCm2: number;  // por defecto 2.0 (norma cosmética)
  skinModel?: Partial<SkinModel>;
}

export interface LayerProfile {
  layer: 'stratum_corneum' | 'viable_epidermis' | 'dermis' | 'hypodermis';
  thicknessUm: number;
  diffusivity: number;       // cm²/s
  eliminationRate: number;   // 1/s
}

export interface SimulationFrame {
  timeHours: number;
  concentrations: Float32Array; // µg/cm³ por nodo de la malla
}

export interface SimulationMetrics {
  logKp: number;
  permeabilityCmH: number;
  steadyStateFlux: number;      // µg/cm²/h
  lagTimeHours: number;
  absorbedFractionPct: number;
  penetrationDepthUm: number;
  peakConcentrationVE: number;
  irritationIndex: number;      // 0-100, HEURÍSTICO
  irritationBand: 'low' | 'moderate' | 'high' | 'very_high';
  confidence: 'high' | 'medium' | 'low';
  outOfDomainReasons: string[];
}

export interface SimulationResult {
  input: SimulationInput;
  mesh: { positionsUm: Float32Array; layerIndex: Uint8Array };
  frames: SimulationFrame[];
  metrics: SimulationMetrics;
  engineVersion: string;
  computedAt: string;           // ISO 8601
}
```

---

## 3. API — Route Handlers

Todas las respuestas de error siguen un formato único:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
```

| Código | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Payload inválido según Zod |
| `UNAUTHORIZED` | 401 | Sin sesión válida |
| `FORBIDDEN` | 403 | Recurso de otro usuario |
| `NOT_FOUND` | 404 | Recurso inexistente |
| `RATE_LIMITED` | 429 | Cuota de simulaciones/reportes excedida |
| `AI_UNAVAILABLE` | 503 | Fallo o timeout del proveedor de IA |
| `INTERNAL_ERROR` | 500 | No controlado |

### GET /api/ingredients

Catálogo público de activos y vehículos. Cacheado (`revalidate: 3600`).

### POST /api/simulations

Persiste una simulación ya calculada en el cliente.

```jsonc
// request
{ "input": { /* SimulationInput serializado */ }, "metrics": { /* SimulationMetrics */ } }
// 201
{ "id": "uuid", "createdAt": "2026-09-05T13:00:00Z" }
```

No se persisten los `frames` completos: son reproducibles de forma determinista a partir de
`input` + `engineVersion`. Esto mantiene las filas pequeñas y la base barata.

### GET /api/simulations · GET|DELETE /api/simulations/[id]

Listado y detalle del usuario autenticado. RLS garantiza el aislamiento incluso si la lógica
de aplicación fallara.

### POST /api/report

```jsonc
{ "simulationId": "uuid" }
// 200
{ "content": "…", "model": "claude-sonnet-5", "generatedAt": "…" }
```

Timeout de 30 s. Ante fallo devuelve `AI_UNAVAILABLE` y la UI conserva las métricas visibles.

---

## 4. Requisitos del motor de simulación

| ID | Requisito | Verificación |
|---|---|---|
| ENG-01 | Determinista: mismos inputs producen los mismos outputs | Test de igualdad en dos corridas |
| ENG-02 | Sin dependencias de React, DOM ni red | Revisión de imports en CI |
| ENG-03 | Conservación de masa con error < 1 % | Test de balance de masa |
| ENG-04 | Estabilidad numérica garantizada (CFL con margen 0.4) | Test: sin `NaN` ni concentraciones negativas |
| ENG-05 | Monotonicidad física: mayor logP (hasta el óptimo) implica mayor flujo | Test de propiedad |
| ENG-06 | < 2 s para 24 h simuladas en hardware de gama media | Benchmark |
| ENG-07 | Marca `confidence: 'low'` fuera del dominio Potts-Guy | Test con MW = 900 |

---

## 5. Seguridad

- **Autenticación:** Supabase Auth (email/contraseña), cookies HTTP-only vía `@supabase/ssr`.
- **Autorización:** RLS activo en todas las tablas de usuario. La `service_role` key **no se
  usa en ningún camino accesible desde el cliente**.
- **Secretos:** solo en variables de entorno. `.env.local` en `.gitignore`; `.env.example`
  con placeholders. Nunca claves reales en commits, documentación ni memoria de agentes.
- **Validación:** todo input externo pasa por Zod en el borde del servidor.
- **Prompt injection:** el contenido enviado a Claude son valores numéricos y nombres de un
  catálogo cerrado; los campos libres del usuario (notas) se envían delimitados y marcados
  explícitamente como datos no confiables en el prompt de sistema.
- **Rate limiting:** cuota por usuario en reportes de IA (control de costo y abuso).

---

## 6. Estrategia de pruebas

```
tests/
├── engine/
│   ├── qspr.test.ts         # Potts-Guy contra valores de referencia
│   ├── diffusion.test.ts    # Balance de masa, estabilidad, sin negativos
│   ├── simulate.test.ts     # HAPPY PATH end-to-end del motor
│   └── domain.test.ts       # ERROR CRÍTICO: fuera de dominio y entradas inválidas
└── api/
    ├── simulations.test.ts  # 201 con payload válido · 400 inválido · 401 sin sesión
    └── report.test.ts       # 503 controlado cuando el proveedor de IA falla
```

**Cobertura obligatoria por reglas de la hackathon:**

- *Happy path:* configurar ácido salicílico 2 % en vehículo etanólico produce métricas dentro
  de rangos físicos esperados y un reporte generado correctamente.
- *Error crítico:* la API de IA no responde; el sistema devuelve `AI_UNAVAILABLE`, no rompe
  la UI y las métricas de la simulación siguen disponibles.

Comandos: `npm test` · `npm run test:watch` · `npm run test:coverage`.

---

## 7. Rendimiento

| Objetivo | Métrica | Técnica |
|---|---|---|
| Simulación < 2 s | Wall clock | `Float32Array`, sin asignaciones en el bucle, submuestreo a 60 frames para 24 h |
| 3D >= 30 FPS | FPS medio | Geometría instanciada, textura de datos 1D para el gradiente, sin re-render de React por frame |
| LCP < 2.5 s | Lighthouse | RSC para el shell, carga diferida (`dynamic`) de la escena Three.js |

---

## 8. Variables de entorno

| Variable | Ámbito | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | público | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | Clave anónima (protegida por RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **servidor** | Solo para migraciones/seed. Nunca en el cliente |
| `ANTHROPIC_API_KEY` | **servidor** | Clave de la API de Claude |
| `ANTHROPIC_MODEL` | servidor | Por defecto `claude-sonnet-5` |
