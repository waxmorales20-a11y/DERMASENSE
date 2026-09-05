# Arquitectura — DERMASENSE

## 1. Vista de contexto (C4 nivel 1)

```mermaid
graph TB
    U["👤 Formulador / Investigador"]
    subgraph DS["DERMASENSE"]
        APP["Next.js App<br/>(Vercel) — Max"]
        PY["Backend Python/FastAPI<br/>(a desplegar) — Tonny"]
    end
    SB[("Supabase<br/>PostgreSQL + Auth")]
    AI["Claude API<br/>claude-sonnet-5"]

    U -->|"HTTPS"| APP
    APP -->|"SDK / JWT + RLS"| SB
    APP -->|"HTTPS server-side"| AI
    APP -->|"HTTPS · ver API_CONTRACT.md"| PY
    PY -->|"JWT compartido"| SB

    style DS fill:#0f172a,stroke:#38bdf8,color:#e2e8f0
    style APP fill:#1e293b,stroke:#38bdf8,color:#e2e8f0
    style PY fill:#1e293b,stroke:#a78bfa,color:#e2e8f0
```

**Decisión clave (ADR-001, reafirmada en [ADR-004](adr/004-arquitectura-hibrida-ts-python.md)):**
el motor de simulación corre **en el navegador**, no en ningún servidor. Es TypeScript puro
y determinista, así que no hay latencia de red, la interacción con el timeline es
instantánea y el costo de infraestructura es cero.

**Arquitectura híbrida de dos backends**, con reparto de trabajo del equipo:

| Backend | Dueño | Responsabilidad | NO hace |
|---|---|---|---|
| Next.js Route Handlers (Vercel) | Max | Persistencia de simulaciones, reporte con Claude, catálogo | No simula, no hace ML |
| FastAPI (Python) | Tonny | Investigación de ingredientes (RAG), predicción ML/QSPR, reportes Excel, revisión regulatoria | No recalcula la difusión — la recibe ya calculada |

El contrato exacto entre el frontend y el backend Python está en
[API_CONTRACT.md](API_CONTRACT.md), para que ambos lados avancen en paralelo sin
bloquearse.

---

## 2. Vista de contenedores (C4 nivel 2)

```mermaid
graph TB
    subgraph BROWSER["Navegador"]
        UI["React 19 + Tailwind<br/>Formulario y paneles"]
        R3F["React Three Fiber<br/>Escena 3D de piel"]
        ENG["packages/engine<br/>Motor de simulación TS"]
        STORE["Zustand<br/>Estado de simulación"]
        UI --> STORE
        R3F --> STORE
        STORE --> ENG
        ENG --> STORE
    end

    subgraph VERCEL["Vercel — Next.js App Router"]
        RSC["Server Components<br/>Dashboard, listados"]
        API1["/api/simulations<br/>CRUD"]
        API2["/api/report<br/>Generación IA"]
        API3["/api/ingredients<br/>Catálogo"]
    end

    subgraph SUPA["Supabase"]
        AUTH["GoTrue Auth"]
        PG[("PostgreSQL<br/>+ Row Level Security")]
    end

    ANTH["Anthropic API"]

    UI -->|"fetch"| API1
    UI -->|"fetch"| API2
    RSC --> PG
    API1 --> PG
    API3 --> PG
    API2 -->|"ANTHROPIC_API_KEY<br/>solo server-side"| ANTH
    UI --> AUTH
    AUTH --> PG
```

---

## 3. Estructura de módulos

```
dermasense/
├── app/
│   ├── (marketing)/page.tsx           # Landing + propuesta de valor
│   ├── (auth)/login/ · signup/
│   ├── (app)/
│   │   ├── lab/page.tsx               # Laboratorio: config + 3D + métricas
│   │   ├── simulations/page.tsx       # Historial del usuario
│   │   └── simulations/[id]/page.tsx  # Detalle + reporte IA
│   └── api/
│       ├── ingredients/route.ts
│       ├── simulations/route.ts       # GET lista · POST crear
│       ├── simulations/[id]/route.ts  # GET · DELETE
│       └── report/route.ts            # POST → Claude
├── packages/engine/                   # ⚠ SIN dependencias de React ni red
│   ├── constants.ts                   # Capas, D, k por defecto
│   ├── qspr.ts                        # Potts–Guy, partición, dominio
│   ├── diffusion.ts                   # Solver FTCS multicapa
│   ├── metrics.ts                     # Métricas derivadas
│   ├── irritation.ts                  # Índice heurístico
│   ├── simulate.ts                    # Orquestador → SimulationResult
│   └── types.ts
├── components/
│   ├── skin3d/                        # SkinScene, LayerMesh, ConcentrationField
│   ├── lab/                           # FormulationForm, MetricsPanel, Timeline
│   └── ui/                            # shadcn/ui
├── lib/
│   ├── supabase/{client,server}.ts
│   ├── anthropic.ts
│   └── validation.ts                  # Esquemas Zod compartidos
├── tests/
│   ├── engine/                        # Unitarias del motor
│   └── api/                           # Integración de Route Handlers
└── docs/
```

**Regla de dependencias:** `packages/engine` no importa nada de `app/`, `components/` ni
`lib/`. Esto lo hace testeable de forma aislada y reutilizable en un futuro worker o backend.

---

## 4. Flujo de una simulación

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as FormulationForm
    participant E as engine/simulate
    participant S as Escena 3D
    participant A as /api/simulations
    participant R as /api/report
    participant C as Claude API
    participant DB as PostgreSQL

    U->>F: Selecciona activo, concentración, vehículo, pH
    F->>F: Valida con Zod
    F->>E: simulate(input)
    E->>E: Potts–Guy → Kp, D_sc
    E->>E: Solver FTCS multicapa (0→24 h)
    E-->>F: SimulationResult (métricas + frames)
    F->>S: Renderiza gradiente por frame
    U->>S: Reproduce/desplaza el timeline
    U->>A: "Guardar simulación"
    A->>DB: INSERT (RLS: user_id = auth.uid())
    DB-->>A: id
    A-->>U: 201 Created
    U->>R: "Generar reporte"
    R->>C: Prompt + métricas + supuestos
    C-->>R: Interpretación técnica
    R->>DB: UPDATE ai_report
    R-->>U: Reporte
```

---

## 5. Modelo de datos (resumen)

```mermaid
erDiagram
    profiles ||--o{ simulations : "posee"
    ingredients ||--o{ simulations : "usado en"
    vehicles ||--o{ simulations : "usado en"
    simulations ||--o| ai_reports : "genera"

    profiles {
        uuid id PK
        text email
        text organization
        text role
    }
    ingredients {
        uuid id PK
        text name
        numeric molecular_weight
        numeric log_p
        numeric pka
        text[] risk_flags
    }
    vehicles {
        uuid id PK
        text name
        numeric enhancer_factor
    }
    simulations {
        uuid id PK
        uuid user_id FK
        jsonb input
        jsonb metrics
        timestamptz created_at
    }
    ai_reports {
        uuid id PK
        uuid simulation_id FK
        text content
        text model
    }
```

Detalle completo, índices y políticas RLS en [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md).

---

## 6. Despliegue

```mermaid
graph LR
    DEV["Local<br/>npm run dev"] -->|"git push"| GH["GitHub<br/>main"]
    GH -->|"Preview Deploy"| PRV["Vercel Preview"]
    GH -->|"Production Deploy"| PROD["Vercel Production"]
    GH -->|"CI"| TEST["Vitest<br/>GitHub Actions"]
    TEST -->|"bloquea si falla"| PROD
    PROD --> SUPA[("Supabase<br/>proyecto prod")]
```

- Cada push a `main` dispara build + tests + deploy con timestamp verificable.
- Secretos gestionados como *Environment Variables* de Vercel; nunca en el repositorio.
- Variables con prefijo `NEXT_PUBLIC_` son públicas por diseño; `ANTHROPIC_API_KEY` y
  `SUPABASE_SERVICE_ROLE_KEY` **jamás** llevan ese prefijo.

---

## 7. Decisiones arquitectónicas

| ADR | Decisión |
|---|---|
| [ADR-001](adr/001-motor-de-simulacion-en-el-cliente.md) | Motor de simulación en el cliente |
| [ADR-002](adr/002-modelo-potts-guy.md) | Potts–Guy como base del modelo predictivo |
| [ADR-003](adr/003-supabase-rls.md) | Supabase con RLS para aislamiento multi-tenant |
