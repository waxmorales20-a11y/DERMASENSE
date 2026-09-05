/**
 * Cliente del backend Python (FastAPI).
 *
 * Contrato: docs/API_CONTRACT.md. Este backend NO calcula difusión — eso lo hace
 * `packages/engine` en el navegador (ADR-004). Aquí solo viven investigación de
 * ingredientes, predicción ML/QSPR, reportes Excel y revisión regulatoria.
 *
 * Regla de degradación: ninguna pantalla se bloquea esperando a este backend.
 * Si no está desplegado, `isPythonBackendConfigured()` devuelve false y cada
 * llamada falla con un error tipado que la UI puede ignorar con gracia.
 */

import { z } from 'zod';

const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Base del backend, siempre con el prefijo de versión.
 *
 * El servicio expone todo bajo `/api/v1`. Se añade aquí y no en cada llamada
 * para que la variable de entorno pueda escribirse de las dos formas
 * (`http://localhost:8000` o `http://localhost:8000/api/v1`) sin romperse.
 */
export function getPythonBackendUrl(): string {
  const base = (process.env.NEXT_PUBLIC_PY_API_URL || '').replace(/\/+$/, '');
  if (!base) return '';
  return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
}

export function isPythonBackendConfigured(): boolean {
  const url = getPythonBackendUrl();
  if (!url) return false;
  if (url.includes('placeholder') || url.includes('tu-backend')) return false;
  return /^https?:\/\//.test(url);
}

// Códigos de error del contrato (§1).
export type BackendErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'NOT_CONFIGURED';

export class BackendApiError extends Error {
  readonly code: BackendErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: BackendErrorCode, message: string, status = 0, details: unknown = null) {
    super(message);
    this.name = 'BackendApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

interface RequestOptions {
  accessToken?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function request<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  options: RequestOptions = {}
): Promise<T> {
  const response = await rawRequest(path, init, options);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new BackendApiError(
      'INTERNAL_ERROR',
      'El backend devolvió una respuesta que no es JSON válido.',
      response.status
    );
  }

  if (!response.ok) throw toBackendError(payload, response.status);

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new BackendApiError(
      'VALIDATION_ERROR',
      'La respuesta del backend no cumple el contrato de API.',
      response.status,
      parsed.error.flatten()
    );
  }

  return parsed.data;
}

async function rawRequest(
  path: string,
  init: RequestInit,
  { accessToken, signal, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions
): Promise<Response> {
  if (!isPythonBackendConfigured()) {
    throw new BackendApiError(
      'NOT_CONFIGURED',
      'El backend Python no está configurado (falta NEXT_PUBLIC_PY_API_URL).'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  // El backend valida este JWT de Supabase contra el proyecto compartido (§1).
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  try {
    return await fetch(`${getPythonBackendUrl()}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof BackendApiError) throw err;
    throw new BackendApiError(
      'NETWORK_ERROR',
      'No se pudo contactar con el backend Python.',
      0,
      err instanceof Error ? err.message : String(err)
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function toBackendError(payload: unknown, status: number): BackendApiError {
  const parsed = errorEnvelopeSchema.safeParse(payload);
  if (!parsed.success) {
    return new BackendApiError('INTERNAL_ERROR', `Error ${status} del backend Python.`, status);
  }
  const { code, message, details } = parsed.data.error;
  return new BackendApiError(code as BackendErrorCode, message, status, details ?? null);
}

// ─────────────────────────────────────────────────────────────
// §2. Investigación automatizada de ingredientes
// ─────────────────────────────────────────────────────────────

export const ingredientEvidenceSchema = z.object({
  title: z.string(),
  authors: z.string().optional(),
  year: z.number().optional(),
  doi: z.string().optional(),
  study_type: z.string().optional(),
  evidence_quality: z.string().optional(),
});

export const ingredientProfileSchema = z.object({
  name: z.string(),
  inci_name: z.string().optional(),
  molecular_weight: z.number(),
  log_p: z.number(),
  confidence: z.string().optional(),
  evidence: z.array(ingredientEvidenceSchema).default([]),
  risk_flags: z.array(z.string()).default([]),
});

const researchJobSchema = z.object({
  status: z.literal('processing'),
  job_id: z.string().optional(),
});

// El contrato admite 200 con perfil o 202 con job para hacer polling (§2).
export const researchResponseSchema = z.union([ingredientProfileSchema, researchJobSchema]);

export type IngredientProfile = z.infer<typeof ingredientProfileSchema>;
export type ResearchResponse = z.infer<typeof researchResponseSchema>;

export function isResearchPending(
  response: ResearchResponse
): response is z.infer<typeof researchJobSchema> {
  return 'status' in response && response.status === 'processing';
}

/**
 * Resuelve un nombre contra PubChem: `POST /ingredients/resolve`.
 *
 * El backend responde de forma síncrona (no hay cola de trabajos), así que
 * `isResearchPending` nunca será cierto por esta vía. Se conserva la firma para
 * no romper a quien ya la consume.
 *
 * Requiere sesión: sale a una API externa con límite de cuota.
 */
const pubchemCandidateSchema = z.object({
  cid: z.number(),
  name: z.string(),
  iupac_name: z.string().nullable().optional(),
  molecular_weight: z.number().nullable().optional(),
  xlogp: z.number().nullable().optional(),
  canonical_smiles: z.string().nullable().optional(),
  warnings: z.array(z.string()).default([]),
});

const resolveResponseSchema = z.object({
  query: z.string(),
  candidates: z.array(pubchemCandidateSchema),
  note: z.string(),
});

export async function researchIngredient(
  query: string,
  options: RequestOptions = {}
): Promise<ResearchResponse> {
  const res = await request(
    '/ingredients/resolve',
    { method: 'POST', body: JSON.stringify({ name: query, limit: 5 }) },
    resolveResponseSchema,
    options
  );

  const best = res.candidates[0];
  if (!best) {
    throw new BackendApiError('NOT_FOUND', `PubChem no encontró "${query}".`, 404);
  }

  return {
    name: best.name,
    inci_name: best.iupac_name ?? undefined,
    molecular_weight: best.molecular_weight ?? 0,
    log_p: best.xlogp ?? 0,
    // PubChem publica XLogP3, que es calculado: nunca 'verified'.
    confidence: 'estimated',
    evidence: [],
    risk_flags: [],
  };
}

// ─────────────────────────────────────────────────────────────
// §3. Predicción ML/QSPR de descriptores
// ─────────────────────────────────────────────────────────────

export const predictedDescriptorsSchema = z.object({
  molecular_weight: z.number(),
  log_p: z.number(),
  log_p_source: z.string().optional(),
  model: z.string().optional(),
  model_version: z.string().optional(),
  confidence: z.number().optional(),
});

export type PredictedDescriptors = z.infer<typeof predictedDescriptorsSchema>;

/**
 * Todo valor devuelto aquí es `data_level: "estimated"`, nunca `"verified"`
 * (regla de honestidad del contrato §3 y de docs/DATA_SOURCES.md).
 */
const descriptorsResponseSchema = z.object({
  molecular_weight: z.number(),
  log_p: z.number(),
  tpsa: z.number(),
  formula: z.string(),
  canonical_smiles: z.string(),
  source: z.object({
    db: z.string(),
    version: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    level: z.string(),
  }),
});

/**
 * `POST /descriptors` — descriptores moleculares con RDKit.
 *
 * No es un modelo de aprendizaje automático: RDKit los calcula de forma
 * determinista a partir de la estructura. El `level` que devuelve es siempre
 * `estimated`, porque `Crippen.MolLogP` es un logP calculado, no medido.
 *
 * Requiere sesión.
 */
export async function predictDescriptors(
  smiles: string,
  options: RequestOptions = {}
): Promise<PredictedDescriptors> {
  const res = await request(
    '/descriptors',
    { method: 'POST', body: JSON.stringify({ smiles }) },
    descriptorsResponseSchema,
    options
  );

  return {
    molecular_weight: res.molecular_weight,
    log_p: res.log_p,
    log_p_source: `${res.source.db} ${res.source.version ?? ''}`.trim(),
    model: 'RDKit (Crippen)',
    model_version: res.source.version ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// §4. Reporte Excel (el backend formatea, no recalcula)
// ─────────────────────────────────────────────────────────────

export interface ExcelReportPayload {
  simulation_id?: string;
  input: unknown;
  metrics: unknown;
  ingredient_evidence?: unknown[];
}

/**
 * `GET /exports/{id}.xlsx` — libro de 7 hojas.
 *
 * El backend lo arma leyendo la simulación de Supabase con el JWT del usuario,
 * así que **exige una simulación ya guardada** y un `accessToken`. RLS decide si
 * esa fila es suya; si es de otro, responde 404.
 */
export async function requestExcelReport(
  payload: ExcelReportPayload,
  options: RequestOptions = {}
): Promise<Blob> {
  if (!payload.simulation_id) {
    throw new BackendApiError(
      'VALIDATION_ERROR',
      'El reporte Excel necesita una simulación guardada (simulation_id).'
    );
  }

  const response = await rawRequest(
    `/exports/${encodeURIComponent(payload.simulation_id)}.xlsx`,
    { method: 'GET' },
    { ...options, timeoutMs: options.timeoutMs ?? 60_000 }
  );

  if (!response.ok) {
    let payloadJson: unknown = null;
    try {
      payloadJson = await response.json();
    } catch {
      /* el backend puede fallar sin cuerpo JSON */
    }
    throw toBackendError(payloadJson, response.status);
  }

  return response.blob();
}

// ─────────────────────────────────────────────────────────────
// §5. Revisión regulatoria preliminar (reglas, no ML)
// ─────────────────────────────────────────────────────────────

export const regulatoryStatusSchema = z.enum([
  'ok',
  'requires_review',
  'restricted',
  'insufficient_data',
]);

export const regulatoryCheckSchema = z.object({
  jurisdiction: z.string(),
  status: regulatoryStatusSchema,
  max_use_concentration: z.number().nullable().optional(),
  regulation_ref: z.string().optional(),
  message: z.string().optional(),
  checked_at: z.string().optional(),
});

export type RegulatoryStatus = z.infer<typeof regulatoryStatusSchema>;
export type RegulatoryCheck = z.infer<typeof regulatoryCheckSchema>;

// Forma real que devuelve el backend: un veredicto global más los hallazgos
// individuales, cada uno con su cita y su fecha de verificación.
const backendFindingSchema = z.object({
  jurisdiction: z.string(),
  regulation: z.string(),
  requirement: z.string(),
  outcome: z.enum(['pass', 'attention', 'fail', 'not_applicable', 'unknown']),
  message: z.string(),
  source: z.string(),
  checked_at: z.string(),
  limit_pct: z.number().nullable(),
});

const backendRegulatorySchema = z.object({
  ingredient_name: z.string(),
  concentration_pct: z.number(),
  summary: z.enum(['pass', 'attention', 'fail', 'not_applicable', 'unknown']),
  findings: z.array(backendFindingSchema),
  disclaimer: z.string(),
});

// El backend habla en términos de resultado de regla; la UI, en términos de
// estado. Se traduce aquí para no cambiar el componente que ya lo consume.
const OUTCOME_TO_STATUS: Record<string, RegulatoryStatus> = {
  pass: 'ok',
  attention: 'requires_review',
  fail: 'restricted',
  not_applicable: 'insufficient_data',
  unknown: 'insufficient_data',
};

/**
 * `POST /regulatory/check` — verificación preliminar contra reglas versionadas.
 *
 * **Público, sin sesión**: evalúa reglamentos publicados, no gasta dinero ni
 * toca datos de usuario.
 *
 * El estado nunca es "aprobado". La ausencia de una regla se traduce como
 * `insufficient_data`, nunca como `ok`: que el conjunto no cubra un activo no
 * significa que su uso esté permitido.
 */
export async function checkRegulatory(
  params: { ingredientName: string; concentrationPct: number; jurisdiction?: string },
  options: RequestOptions = {}
): Promise<RegulatoryCheck> {
  const res = await request(
    '/regulatory/check',
    {
      method: 'POST',
      body: JSON.stringify({
        ingredient_name: params.ingredientName,
        concentration_pct: params.concentrationPct,
        product_type: 'leave_on',
        jurisdictions: [(params.jurisdiction ?? 'EU').toLowerCase() === 'us' ? 'us' : 'eu'],
      }),
    },
    backendRegulatorySchema,
    options
  );

  // Se prioriza el hallazgo con límite numérico: es el que la UI puede mostrar
  // como "2.5% / 2%". Si no lo hay, el primero que no sea una obligación genérica.
  const withLimit = res.findings.find((f) => f.limit_pct !== null);
  const relevant = withLimit ?? res.findings[0];

  return {
    jurisdiction: relevant?.jurisdiction.toUpperCase() ?? (params.jurisdiction ?? 'EU'),
    status: OUTCOME_TO_STATUS[res.summary] ?? 'insufficient_data',
    max_use_concentration: withLimit?.limit_pct ?? null,
    regulation_ref: relevant?.source,
    message: relevant?.message ?? res.disclaimer,
    checked_at: relevant?.checked_at,
  };
}
