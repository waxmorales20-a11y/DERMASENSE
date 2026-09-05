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

export function getPythonBackendUrl(): string {
  return (process.env.NEXT_PUBLIC_PY_API_URL || '').replace(/\/+$/, '');
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
  | 'NOT_FOUND'
  | 'ML_MODEL_UNAVAILABLE'
  | 'RAG_UNAVAILABLE'
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

export function researchIngredient(
  query: string,
  options: RequestOptions = {}
): Promise<ResearchResponse> {
  return request(
    '/ingredients/research',
    { method: 'POST', body: JSON.stringify({ query }) },
    researchResponseSchema,
    options
  );
}

export function getIngredientResearch(
  jobId: string,
  options: RequestOptions = {}
): Promise<ResearchResponse> {
  return request(
    `/ingredients/research/${encodeURIComponent(jobId)}`,
    { method: 'GET' },
    researchResponseSchema,
    options
  );
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
export function predictDescriptors(
  smiles: string,
  options: RequestOptions = {}
): Promise<PredictedDescriptors> {
  return request(
    '/ml/predict-descriptors',
    { method: 'POST', body: JSON.stringify({ smiles }) },
    predictedDescriptorsSchema,
    options
  );
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

export async function requestExcelReport(
  payload: ExcelReportPayload,
  options: RequestOptions = {}
): Promise<Blob> {
  const response = await rawRequest(
    '/reports/excel',
    { method: 'POST', body: JSON.stringify(payload) },
    { ...options, timeoutMs: options.timeoutMs ?? 30_000 }
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

export function checkRegulatory(
  params: { ingredientName: string; concentrationPct: number; jurisdiction?: string },
  options: RequestOptions = {}
): Promise<RegulatoryCheck> {
  return request(
    '/regulatory/check',
    {
      method: 'POST',
      body: JSON.stringify({
        ingredient_name: params.ingredientName,
        concentration_pct: params.concentrationPct,
        jurisdiction: params.jurisdiction ?? 'EU',
      }),
    },
    regulatoryCheckSchema,
    options
  );
}
