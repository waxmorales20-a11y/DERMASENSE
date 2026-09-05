# DERMASENSE

> Laboratorio virtual de simulación 3D de piel para experimentación cosmética.
> Convierte semanas de ensayo-error físico en minutos de simulación in silico,
> con visualización interactiva de penetración dérmica por capas.

**Track:** Future of Health & Wellbeing

---

## 1. Problema y Enfoque Lean

### Problemática

La I+D cosmética depende de ciclos de prueba física repetitivos: caros, lentos y con
restricciones éticas crecientes (Reglamento (CE) 1223/2009 prohíbe el testeo en animales
para cosméticos en la UE). Los formuladores carecen de una herramienta ágil para **descartar
hipótesis antes de tocar el laboratorio**. El status quo son hojas de cálculo y experiencia
empírica, sin visualización ni trazabilidad.

### Usuario objetivo

| Segmento | Necesidad concreta |
|---|---|
| Formulador cosmético (I+D) | Comparar vehículos y concentraciones sin gastar reactivos |
| Investigador / estudiante | Visualizar difusión dérmica sin infraestructura física |
| Startup cosmética | Validar hipótesis técnicas con presupuesto limitado |

### MVP (lo que se construye hoy)

1. Configurar una formulación: ingrediente activo + concentración + vehículo + pH.
2. Ejecutar una simulación de penetración transdérmica sobre 4 capas
   (estrato córneo, epidermis viable, dermis, hipodermis).
3. Visualizar en 3D el frente de concentración avanzando en el tiempo.
4. Obtener métricas: `log Kp`, flujo en estado estacionario, *lag time*, fracción
   absorbida a 24 h, profundidad efectiva e **índice heurístico de irritación**.
5. Generar un reporte interpretativo con IA.
6. Guardar, listar y comparar simulaciones por usuario.

### Fuera de alcance (declarado explícitamente)

- No es un dispositivo médico ni una validación regulatoria.
- No sustituye ensayos OECD TG 428 / Franz cell.
- El índice de irritación es **heurístico exploratorio**, no un modelo validado.
- El benchmarking contra laboratorio físico es **roadmap**, no entregable de esta versión.

---

## 2. Stack Tecnológico e IA

| Componente | Tecnología | Justificación |
|---|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript | SSR/RSC, despliegue nativo en Vercel |
| Visualización 3D | Three.js + React Three Fiber + drei | Renderizado WebGL de capas y gradiente en el navegador |
| UI | Tailwind CSS v4 + shadcn/ui | Velocidad de construcción y consistencia visual |
| Motor de simulación | TypeScript puro (`packages/engine`) | Determinista, testeable, sin dependencia de red |
| Backend / DB | Supabase (PostgreSQL + Auth + RLS) | Auth gestionada, multi-tenant por Row Level Security |
| IA | Claude API (`claude-sonnet-5`) vía Route Handler | Interpretación de resultados numéricos en lenguaje técnico |
| Infra | Vercel (serverless, CI/CD) | Deploy continuo con timestamp verificable |
| Testing | Vitest (unitario + integración) | Valida happy path y errores críticos del motor y la API |

**Modelo científico:** difusión pasiva (2ª ley de Fick, esquema explícito de diferencias
finitas) + correlación QSPR de **Potts & Guy (1992)** para permeabilidad del estrato córneo.
Detalle completo y supuestos en [`docs/SIMULATION_MODEL.md`](docs/SIMULATION_MODEL.md).

---

## 3. Setup Local

```bash
git clone https://github.com/<org>/dermasense.git
cd dermasense
npm install

cp .env.example .env.local   # completar credenciales

npm run dev                  # http://localhost:3000
npm test                     # suite de pruebas
```

Requisitos: Node.js >= 20, cuenta Supabase, API key de Anthropic.

---

## 4. Documentación

| Documento | Contenido |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product Requirement Document |
| [docs/TRD.md](docs/TRD.md) | Technical Requirement Document |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Diagramas de arquitectura (Mermaid) |
| [docs/APP_FLOW.md](docs/APP_FLOW.md) | Flujo de la aplicación y estados |
| [docs/UI_UX_DESIGN_BRIEF.md](docs/UI_UX_DESIGN_BRIEF.md) | Design brief, tokens y componentes |
| [docs/BACKEND_SCHEMA.md](docs/BACKEND_SCHEMA.md) | Esquema PostgreSQL, RLS y contratos API |
| [docs/SIMULATION_MODEL.md](docs/SIMULATION_MODEL.md) | Modelo matemático, supuestos y limitaciones |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Plan de implementación por horas |
| [docs/AI_PROMPTS.md](docs/AI_PROMPTS.md) | Prompts de sistema del módulo de IA |
| [docs/adr/](docs/adr/) | Architecture Decision Records |

---

## 5. Integrantes y Roles

| Nombre completo | GitHub | Rol |
|---|---|---|
| Mauricio Morales | `@` | Tech Lead / Arquitectura y motor de simulación |
| _(pendiente)_ | `@` | Frontend / Visualización 3D |
| _(pendiente)_ | `@` | Backend / Supabase e IA |
| _(pendiente)_ | `@` | Producto / Pitch y documentación |

---

## 6. Aviso de uso

DERMASENSE es un **sistema de soporte a la decisión en fase exploratoria de I+D**.
No constituye diagnóstico médico, evidencia de seguridad ni validación regulatoria.
La responsabilidad de la formulación final recae en el equipo de I+D cliente.

## Licencia

MIT
