# Product Requirement Document (PRD) — DERMASENSE

**Versión:** 1.0 · **Fase:** Hackathon (MVP) · **Owner:** Producto

---

## 1. Resumen ejecutivo

DERMASENSE es un laboratorio virtual que permite a formuladores cosméticos simular la
penetración de un ingrediente activo a través de las capas de la piel humana, visualizarla
en 3D y obtener un reporte interpretativo generado por IA — sin tocar el laboratorio físico.

**Métrica norte del MVP:** número de simulaciones completadas y guardadas por usuario
(proxy de iteración real de formulación).

---

## 2. Problema

| Dolor | Evidencia | Costo actual |
|---|---|---|
| Ciclos de I+D lentos | Cada iteración físico-química requiere días de preparación y ensayo | Semanas por hipótesis |
| Prohibición de testeo animal | Reglamento (CE) 1223/2009 | Alternativas in vitro caras |
| Sin preevaluación ágil | Se llevan al laboratorio hipótesis que podían descartarse antes | Reactivos desperdiciados |
| Baja reproducibilidad | Hojas de cálculo dispersas, sin trazabilidad ni versionado | Análisis no comparables |

**Insight central:** no competimos contra el laboratorio; competimos contra la
**experimentación a ciegas** que ocurre antes del laboratorio.

---

## 3. Usuarios y Jobs To Be Done

### Persona 1 — Valeria, Formuladora Senior (usuario primario)

- **Contexto:** 8 años en I+D de skincare, maneja 6 proyectos simultáneos.
- **JTBD:** *"Cuando estoy decidiendo entre tres vehículos para un activo nuevo, quiero
  comparar su penetración estimada en minutos, para llevar al laboratorio solo el candidato
  más prometedor."*
- **Éxito:** descarta ≥1 hipótesis sin gastar reactivos.

### Persona 2 — Daniel, Estudiante de Química Farmacéutica

- **JTBD:** *"Cuando estudio absorción percutánea, quiero ver el gradiente moviéndose por
  las capas, para entender por qué el estrato córneo es la barrera limitante."*
- **Éxito:** comprende el efecto de logP y MW sin infraestructura física.

### Persona 3 — Camila, CTO de startup cosmética

- **JTBD:** *"Quiero un artefacto visual y numérico que respalde mi decisión de formulación
  ante inversionistas y ante el laboratorio contratado."*
- **Éxito:** exporta un reporte compartible.

---

## 4. Alcance del MVP

### 4.1 Historias de usuario (priorizadas MoSCoW)

| ID | Historia | Prioridad | Criterio de aceptación |
|---|---|---|---|
| US-01 | Como formulador quiero seleccionar un ingrediente activo del catálogo | **Must** | Catálogo con ≥12 activos con MW, logP, pKa; búsqueda por nombre |
| US-02 | Como formulador quiero definir concentración, vehículo y pH | **Must** | Sliders y selects validados por rango; error visible si fuera de rango |
| US-03 | Como formulador quiero ejecutar la simulación | **Must** | Resultado en < 2 s en cliente; barra de progreso |
| US-04 | Como formulador quiero ver el corte 3D de la piel con el gradiente | **Must** | 4 capas etiquetadas, color mapeado a concentración, ≥30 FPS en laptop media |
| US-05 | Como formulador quiero controlar el tiempo de la simulación | **Must** | Timeline 0–24 h con play/pausa/scrub |
| US-06 | Como formulador quiero ver métricas cuantitativas | **Must** | logKp, flujo, lag time, % absorbido, profundidad, índice de irritación |
| US-07 | Como formulador quiero un reporte interpretativo por IA | **Must** | Texto técnico ≤400 palabras, con supuestos y limitaciones explícitas |
| US-08 | Como usuario quiero autenticarme | **Must** | Email + contraseña vía Supabase Auth |
| US-09 | Como usuario quiero guardar y listar mis simulaciones | **Must** | Persistencia con RLS; solo veo las mías |
| US-10 | Como formulador quiero comparar 2 simulaciones lado a lado | **Should** | Tabla diferencial de métricas |
| US-11 | Como formulador quiero exportar el reporte a PDF | **Should** | Descarga cliente-side |
| US-12 | Como usuario quiero ver los supuestos y limitaciones del modelo | **Must** | Panel siempre accesible, enlazado desde cada resultado |
| US-13 | Como formulador quiero simular formulaciones multi-activo | **Won't (v1)** | — |
| US-14 | Como usuario quiero colaboración en tiempo real | **Won't (v1)** | — |

### 4.2 No-objetivos explícitos

- No es dispositivo médico ni herramienta de validación regulatoria.
- No predice eficacia clínica ni sensibilización alérgica.
- No sustituye OECD TG 428.

---

## 5. Requisitos no funcionales

| Categoría | Requisito |
|---|---|
| Rendimiento | Simulación completa < 2 s; render 3D ≥ 30 FPS a 1080p |
| Disponibilidad | Despliegue serverless en Vercel, sin estado en el servidor |
| Seguridad | RLS en todas las tablas; API keys solo en variables de entorno del servidor |
| Privacidad | Las formulaciones son propiedad del usuario; aislamiento por `user_id` |
| Accesibilidad | Contraste AA; navegación por teclado; el 3D nunca es el único canal de información (siempre hay tabla numérica equivalente) |
| Observabilidad | Logs estructurados de errores en Route Handlers |
| Legal | Disclaimer de no-uso-regulatorio visible en resultados y reportes |

---

## 6. Métricas de éxito

**Del MVP (hackathon):**
- Flujo completo ejecutable end-to-end en producción antes del límite.
- ≥1 suite de pruebas cubriendo happy path y error crítico.
- Simulación reproducible: mismos inputs → mismos outputs (motor determinista).

**Del producto (post-hackathon, proyecciones no medidas):**
- Reducción del ciclo de preevaluación de semanas a ~2 días.
- Reducción proyectada de ~30 % en costos directos de reactivos en fase exploratoria.
- Adopción académica como puerta de entrada al mercado profesional.

> Nota de honestidad: estas cifras son **hipótesis de impacto**, no resultados medidos.
> Requieren un piloto con usuarios reales para ser validadas.

---

## 7. Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Credibilidad científica cuestionada | Alto | Modelo basado en correlación publicada (Potts–Guy), supuestos y limitaciones documentados y visibles en producto |
| Usuario interpreta el resultado como validación de seguridad | Alto | Disclaimer persistente + etiqueta "estimación exploratoria" junto a cada métrica de riesgo |
| Rendimiento 3D en equipos modestos | Medio | Nivel de detalle degradable; fallback a vista 2D de corte |
| Latencia o fallo de la API de IA | Medio | El reporte es aditivo: las métricas se muestran aunque la IA falle; estado de error explícito |
| Alcance excesivo para 7 h | Alto | MoSCoW estricto; US-10/11 solo si sobra tiempo |

---

## 8. Modelo de negocio (contexto)

- **B2B SaaS:** suscripción por niveles para laboratorios y marcas.
- **Licenciamiento educativo:** convenios institucionales con universidades.
- **Freemium:** cuota limitada de simulaciones para estudiantes e independientes.

## 9. Roadmap posterior

1. **Benchmarking:** comparación sistemática contra datos de celda de Franz.
2. **Multi-activo** e interacciones entre componentes.
3. **Otros tejidos:** cuero cabelludo, cabello, mucosas.
4. **API pública** para integración con LIMS.
