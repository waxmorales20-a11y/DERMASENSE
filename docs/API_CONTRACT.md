# Contrato de API — Frontend ↔ Backend Python

**Propósito de este documento:** que Max (frontend) y Tonny (backend) puedan construir en
paralelo sin bloquearse. Mientras ambos lados respeten estas formas de request/response,
no importa en qué orden se implementen ni cuánto tarde cada uno.

**Regla de trabajo:** si algo de aquí necesita cambiar a media tarde, se avisa en el chat
del equipo antes de tocar el código del otro lado. Un contrato que cambia sin avisar rompe
el trabajo paralelo que este documento existe para habilitar.

---

## 0. Qué NO pasa por este contrato

El **motor de simulación** (`packages/engine/`, TypeScript) corre en el navegador del
usuario y **no necesita el backend Python** para calcular. Ver
[ADR-004](adr/004-arquitectura-hibrida-ts-python.md). Este documento cubre únicamente lo
que sí requiere ir al servidor: investigación de ingredientes, predicción ML/QSPR,
reportes Excel y revisión regulatoria.

---

## 1. Base y convenciones

- **Base URL (desarrollo):** `http://localhost:8000`
- **Base URL (producción):** a definir cuando Tonny despliegue el backend (Railway,
  Render o similar — Vercel no ejecuta FastAPI de forma nativa)
- **Formato:** JSON en ambas direcciones, `Content-Type: application/json`
- **Autenticación:** el frontend reenvía el JWT de Supabase en
  `Authorization: Bearer <token>`. El backend Python lo valida contra el proyecto Supabase
  compartido (mismo `SUPABASE_URL`, verificación con la clave pública JWKS).
- **Errores:** mismo formato que ya usa el frontend en sus propios Route Handlers
  (ver `docs/TRD.md` §3), para que la UI tenga un solo manejador de errores:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
```

| Código | HTTP |
|---|---|
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `NOT_FOUND` | 404 |
| `ML_MODEL_UNAVAILABLE` | 503 |
| `RAG_UNAVAILABLE` | 503 |
| `INTERNAL_ERROR` | 500 |

---

## 2. Investigación automatizada de ingredientes

Caso de uso: el usuario busca un ingrediente que no está en la biblioteca. El backend
investiga automáticamente (RAG sobre papers/evidencia) y devuelve un perfil propuesto.

### `POST /ingredients/research`

**Request**
```json
{ "query": "bakuchiol" }
```

**Response 200**
```json
{
  "name": "Bakuchiol",
  "inci_name": "Bakuchiol",
  "molecular_weight": 256.34,
  "log_p": 4.5,
  "confidence": "medium",
  "evidence": [
    {
      "title": "Bakuchiol: a retinol alternative...",
      "authors": "Chaudhuri, Bojanowski",
      "year": 2014,
      "doi": "10.1111/ics.12117",
      "study_type": "clinical",
      "evidence_quality": "literature"
    }
  ],
  "risk_flags": ["retinoid_alternative"]
}
```

**Response 202** (la investigación toma tiempo, se procesa en segundo plano)
```json
{ "status": "processing", "job_id": "uuid" }
```

### `GET /ingredients/research/{job_id}`

Consulta el estado de una investigación en curso. Mismo `response 200` de arriba cuando
termina, o `{ "status": "processing" }` mientras tanto.

> **Nota para Max (frontend):** diseña el formulario de "nuevo ingrediente" para tolerar
> ambos casos (200 inmediato o 202 + polling), porque no sabemos aún cuánto tarda el RAG.

---

## 3. Predicción ML/QSPR de propiedades faltantes

Caso de uso: el ingrediente existe pero falta un descriptor (p. ej. no hay `log_p`
experimental, solo la estructura molecular).

### `POST /ml/predict-descriptors`

**Request**
```json
{ "smiles": "CC(C)=CCC/C(C)=C/c1ccc(O)cc1" }
```

**Response 200**
```json
{
  "molecular_weight": 256.34,
  "log_p": 4.5,
  "log_p_source": "predicted",
  "model": "rdkit_crippen_v1",
  "model_version": "1.0.0",
  "confidence": 0.82
}
```

**Regla de honestidad (heredada de `docs/DATA_SOURCES.md`):** todo valor que venga de este
endpoint se guarda con `data_level: "estimated"`, nunca `"verified"`. El frontend debe
mostrarlo con el icono ⚠️, no con el ✅ que llevan los datos experimentales.

---

## 4. Reportes Excel

Caso de uso: exportar una simulación ya calculada (por el motor TS) a un archivo `.xlsx`
multi-hoja.

### `POST /reports/excel`

**Request** — el frontend envía el resultado completo de su propio motor, el backend NO
recalcula nada, solo formatea:

```json
{
  "simulation_id": "uuid",
  "input": { "...": "SimulationInput serializado" },
  "metrics": { "...": "SimulationMetrics serializado" },
  "ingredient_evidence": [ "...opcional, del endpoint de investigación..." ]
}
```

**Response 200** — `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
el archivo binario directamente. El frontend dispara la descarga con el blob recibido.

> Este es el único endpoint donde el backend recibe resultados de simulación ya
> calculados por el motor TS, en lugar de calcularlos él mismo. Ver ADR-004: no se duplica
> la lógica de difusión en Python.

---

## 5. Revisión regulatoria preliminar

Basada en reglas, no en ML (ver README §18).

### `POST /regulatory/check`

**Request**
```json
{
  "ingredient_name": "Ácido salicílico",
  "concentration_pct": 2,
  "jurisdiction": "EU"
}
```

**Response 200**
```json
{
  "jurisdiction": "EU",
  "status": "requires_review",
  "max_use_concentration": 2.0,
  "regulation_ref": "Reg. (CE) 1223/2009, Anexo III",
  "message": "Revisión regulatoria preliminar — requiere evaluación profesional.",
  "checked_at": "2026-09-05"
}
```

`status` es siempre uno de: `"ok"`, `"requires_review"`, `"restricted"`, `"insufficient_data"`.
**Nunca** `"approved"` — el sistema no emite autorizaciones (README §18).

---

## 6. Qué necesita el frontend del backend para no bloquearse hoy

Orden de prioridad si el tiempo aprieta (recomendación, a confirmar con Tonny):

1. **`POST /regulatory/check`** — el más simple (reglas, sin ML ni RAG), y alimenta
   directamente el `max_use_concentration` que `docs/DATA_SOURCES.md` §7 pide para
   corregir el índice de irritación circular. Alto impacto, bajo esfuerzo.
2. **`POST /reports/excel`** — formateo puro, sin IA. Segundo más simple.
3. **`POST /ml/predict-descriptors`** — necesita RDKit pero no necesita datos propios,
   es una librería instalable. Factible en el tiempo restante.
4. **`POST /ingredients/research`** — el más costoso (RAG, fuentes externas, pgvector).
   Si no llega a tiempo, el frontend permite cargar ingredientes con entrada manual (ya
   decidido en `docs/DATA_SOURCES.md` §3.6) como *fallback* que no depende de este endpoint.

**El frontend no debe bloquear ninguna pantalla esperando al backend Python.** Cada
llamada a estos endpoints debe tener un estado de error que degrade con gracia (igual que
ya se diseñó para el reporte de Claude en `docs/APP_FLOW.md` §5): si `/ingredients/research`
falla o no existe todavía, el usuario simplemente introduce los datos a mano.

---

## 7. Variables de entorno del lado backend (para Tonny)

No se listan aquí valores reales, solo qué debe existir en su `.env`:

```
SUPABASE_URL=
SUPABASE_JWT_SECRET=       # o las claves publicas JWKS, segun libreria de verificacion
ANTHROPIC_API_KEY=         # si el RAG usa Claude para sintesis
OPENAI_API_KEY=            # si usa embeddings de OpenAI para pgvector, alternativa: modelo local
```

Mismo principio de todo el proyecto: nunca en el repositorio, solo en variables de entorno
del servicio donde se despliegue el backend.
