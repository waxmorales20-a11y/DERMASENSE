'use client';

import React, { useEffect, useState } from 'react';
import {
  Microscope,
  Scale,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Info,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import type { CatalogIngredient } from '@/lib/mock-catalog';

/**
 * Panel de evidencia experimental y regulatoria.
 *
 * Lo que muestra y lo que deliberadamente NO muestra:
 *
 * El backend no tiene un modelo de aprendizaje automático que supere a la
 * correlación de Potts y Guy (1992) — se entrenó uno con 229 compuestos de
 * permeabilidad medida y no la superó. Así que este panel no presenta una
 * "predicción de IA": presenta la predicción de la correlación publicada junto
 * al **error que comete sobre moléculas parecidas a esta**, medido contra datos
 * experimentales.
 *
 * Esa cifra —el error local— es lo que responde a la única pregunta que importa
 * al formular: ¿cuánto me puedo fiar de este número para este activo?
 */

interface EvidencePanelProps {
  ingredient: CatalogIngredient;
  concentrationPct: number;
  productType?: string;
}

interface Neighbour {
  compound_name: string;
  molecular_weight: number;
  log_p: number;
  log_kp_measured: number;
  log_kp_predicted: number;
  absolute_error: number;
}

interface ValidationData {
  prediction: { log_kp: number; permeability_cm_h: number; model: string; formula: string };
  domain: { in_domain: boolean; reasons: string[] };
  evidence: {
    n_measured: number;
    global_mae: number;
    global_rmse: number;
    local_mae: number | null;
    n_neighbours: number;
    neighbours_representative: boolean;
    max_neighbour_distance: number | null;
    exact_match: {
      compound_name: string;
      log_kp_measured: number;
      log_kp_predicted: number;
      absolute_error: number;
      source: string;
    } | null;
    neighbours: Neighbour[];
  };
  disclaimer: string;
}

interface Finding {
  jurisdiction: string;
  regulation: string;
  requirement: string;
  outcome: 'pass' | 'attention' | 'fail' | 'not_applicable' | 'unknown';
  message: string;
  source: string;
  limit_pct: number | null;
}

interface RegulatoryData {
  summary: Finding['outcome'];
  findings: Finding[];
  disclaimer: string;
}

type Section<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

/**
 * Traduce un error en escala logarítmica a algo que se entiende sin química.
 *
 * «±0.65 unidades de log Kp» no le dice nada a nadie. «El valor real puede ser
 * hasta 4.5 veces mayor o menor» sí. Es la misma información: cada unidad
 * logarítmica es un factor de 10.
 */
function logErrorToFactor(logError: number): string {
  const factor = Math.pow(10, logError);
  if (factor < 10) return `${factor.toFixed(1)} veces`;
  return `${Math.round(factor)} veces`;
}

/** `PubChem CID 338` → enlace a la ficha real del compuesto. */
function pubchemUrl(source: string): string | null {
  const m = source.match(/CID\s*(\d+)/i);
  return m ? `https://pubchem.ncbi.nlm.nih.gov/compound/${m[1]}` : null;
}

/** Artículos que sostienen cada número del panel. */
const PAPERS = [
  {
    id: 'potts-guy',
    cite: 'Potts, R. O. & Guy, R. H. (1992)',
    title: 'Predicting skin permeability',
    journal: 'Pharmaceutical Research 9(5):663-669',
    doi: '10.1023/A:1015810312465',
    what: 'De aquí sale la fórmula que estima la velocidad de penetración.',
  },
  {
    id: 'bos-meinardi',
    cite: 'Bos, J. D. & Meinardi, M. M. (2000)',
    title: 'The 500 Dalton rule',
    journal: 'Experimental Dermatology 9(3):165-169',
    doi: '10.1034/j.1600-0625.2000.009003165.x',
    what: 'De aquí sale el límite de 500: por encima de ese peso, una molécula prácticamente no atraviesa la piel.',
  },
  {
    id: 'huskindb',
    cite: 'Fröhlich et al. (2020)',
    title: 'HuskinDB, a database for skin permeation of xenobiotics',
    journal: 'Scientific Data 7:414',
    doi: '10.1038/s41597-020-00764-z',
    what: 'Las 229 mediciones reales en piel humana contra las que se comprueba cuánto se equivoca la fórmula.',
  },
] as const;

const OUTCOME_STYLE: Record<Finding['outcome'], { label: string; cls: string; Icon: typeof Info }> =
  {
    pass: { label: 'Dentro de límite', cls: 'text-ok', Icon: CheckCircle2 },
    attention: { label: 'Requiere atención', cls: 'text-warn', Icon: AlertTriangle },
    fail: { label: 'Fuera de límite', cls: 'text-risk', Icon: XCircle },
    not_applicable: { label: 'No aplica', cls: 'text-text-muted', Icon: Info },
    unknown: { label: 'Sin cobertura', cls: 'text-text-muted', Icon: HelpCircle },
  };

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  ingredient,
  concentrationPct,
  productType = 'leave_on',
}) => {
  const [validation, setValidation] = useState<Section<ValidationData> | null>(null);
  const [regulatory, setRegulatory] = useState<Section<RegulatoryData> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    // La concentración cambia con un slider: sin este retardo se dispararía una
    // petición por cada píxel arrastrado.
    const timer = setTimeout(async () => {
      setLoading(true);
      const query = new URLSearchParams({
        name: ingredient.name,
        inciName: ingredient.inciName,
        molecularWeight: String(ingredient.molecularWeight),
        logP: String(ingredient.logP),
        concentrationPct: String(concentrationPct),
        productType,
      });

      try {
        const res = await fetch(`/api/evidence?${query}`, { signal: controller.signal });
        const body = await res.json();

        if (!res.ok) {
          const failure = {
            ok: false as const,
            code: body?.error?.code ?? 'ERROR',
            message: body?.error?.message ?? 'No disponible.',
          };
          setValidation(failure);
          setRegulatory(failure);
        } else {
          setValidation(body.validation);
          setRegulatory(body.regulatory);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const failure = {
            ok: false as const,
            code: 'NETWORK',
            message: 'Sin conexión con el servicio científico.',
          };
          setValidation(failure);
          setRegulatory(failure);
        }
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    ingredient.name,
    ingredient.inciName,
    ingredient.molecularWeight,
    ingredient.logP,
    concentrationPct,
    productType,
  ]);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border/80 bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <Microscope className="h-4 w-4 text-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text">
            Evidencia experimental y regulatoria
          </h3>
        </div>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />}
      </div>

      <Glossary />
      <HowItWorks />
      <Provenance ingredient={ingredient} validation={validation} />
      <Sources ingredient={ingredient} />
      <ValidationSection section={validation} />
      <div className="h-px bg-border/60" />
      <CatalogLimit ingredient={ingredient} concentrationPct={concentrationPct} />
      <RegulatorySection section={regulatory} concentrationPct={concentrationPct} />
    </div>
  );
};

/* ── Qué significa cada dato, sin saber química ─────────────────────────── */

const TERMS = [
  {
    term: 'Peso molecular (MW)',
    unit: 'g/mol',
    plain:
      'Cuánto pesa la molécula. Es lo que más manda: la capa externa de la piel actúa como un colador muy fino, y cuanto más grande es la molécula, menos pasa.',
    rule: 'Por encima de 500 prácticamente no atraviesa la piel. Es la «regla de los 500 Dalton».',
  },
  {
    term: 'logP',
    unit: 'sin unidades',
    plain:
      'Si la molécula prefiere el agua o la grasa. Negativo = prefiere el agua. Positivo = prefiere la grasa.',
    rule: 'La capa externa de la piel es grasa, así que lo demasiado acuoso (muy negativo) no entra. Pero lo demasiado graso (muy positivo) entra y se queda atrapado ahí sin avanzar. El punto dulce está en medio.',
  },
  {
    term: 'log Kp',
    unit: 'log de cm/h',
    plain:
      'La velocidad a la que el activo atraviesa la piel, en escala logarítmica. Es el número que predice el modelo.',
    rule: 'Cada unidad es un factor de 10: un −2 penetra diez veces más rápido que un −3, y cien veces más rápido que un −4. Casi siempre es negativo porque la piel es muy buena barrera.',
  },
  {
    term: 'Dominio de aplicabilidad',
    unit: '—',
    plain: 'El rango de moléculas para el que la fórmula fue construida y comprobada.',
    rule: 'Fuera de ese rango la fórmula sigue dando un número, pero deja de significar nada. Por eso el ácido hialurónico (5000 de peso) aparece marcado: el sistema prefiere decir «no lo sé» a inventar.',
  },
] as const;

const Glossary: React.FC = () => (
  <details className="group rounded-lg border border-border/60 bg-surface-2/30 p-2.5">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
      <span className="text-[11px] font-medium text-text">
        ¿Qué significa cada dato? · Explicado sin química
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
    </summary>

    <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
      {TERMS.map((t) => (
        <div key={t.term} className="flex flex-col gap-1 rounded-md bg-surface/60 p-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold text-text">{t.term}</span>
            <span className="font-mono text-[9px] text-text-muted">{t.unit}</span>
          </div>
          <p className="text-[10px] leading-relaxed text-text-muted">{t.plain}</p>
          <p className="border-l-2 border-accent/40 pl-2 text-[10px] leading-relaxed text-text-muted/90">
            {t.rule}
          </p>
        </div>
      ))}
    </div>
  </details>
);

/* ── De dónde salen los datos de ESTE ingrediente ───────────────────────── */

const Sources: React.FC<{ ingredient: CatalogIngredient }> = ({ ingredient }) => {
  const url = pubchemUrl(ingredient.source);

  return (
    <details className="group rounded-lg border border-border/60 bg-surface-2/30 p-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-text">
          Fuentes de {ingredient.name} · Artículos y bases de datos
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-3 flex flex-col gap-3 border-t border-border/60 pt-3">
        <div className="flex flex-col gap-1.5 rounded-md bg-surface/60 p-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Propiedades de este activo
          </span>
          <p className="text-[10px] leading-relaxed text-text-muted">
            El peso molecular y el logP de <strong className="text-text">{ingredient.name}</strong>{' '}
            ({ingredient.inciName}) provienen de:
          </p>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-[10px] text-accent underline decoration-dotted underline-offset-2 hover:text-accent/80"
            >
              {ingredient.source}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="font-mono text-[10px] text-text-muted">{ingredient.source}</span>
          )}
          <p className="text-[10px] leading-relaxed text-text-muted/80">
            PubChem es la base de datos química pública del <span className="text-text">NIH</span>{' '}
            de Estados Unidos. Es gratuita y cada compuesto tiene un identificador estable (el CID),
            así que cualquiera puede comprobar los números de arriba.
          </p>
          {ingredient.regulationRef && (
            <p className="mt-1 border-t border-border/40 pt-1.5 text-[10px] leading-relaxed text-text-muted">
              <strong className="text-text">Límite de uso:</strong> {ingredient.regulationRef}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Artículos que sostienen el cálculo
          </span>
          {PAPERS.map((paper) => (
            <div key={paper.id} className="flex flex-col gap-1 rounded-md bg-surface/60 p-2">
              <span className="text-[10px] font-semibold leading-relaxed text-text">
                {paper.cite} · {paper.title}
              </span>
              <span className="text-[9px] italic text-text-muted">{paper.journal}</span>
              <p className="text-[10px] leading-relaxed text-text-muted">{paper.what}</p>
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono text-[9px] text-accent underline decoration-dotted underline-offset-2 hover:text-accent/80"
              >
                doi:{paper.doi}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          ))}
        </div>

        <p className="text-[10px] leading-relaxed text-text-muted/80">
          Todo lo que ves en este panel se puede rastrear hasta una de estas fuentes. Si un número
          no tiene procedencia declarada, es una estimación, y el panel lo marca como tal.
        </p>
      </div>
    </details>
  );
};

/* ── Procedencia de cada número ─────────────────────────────────────────── */

/**
 * El diferenciador visual del proyecto: cuatro niveles de calidad del dato.
 *
 * No es decoración. `docs/DATA_SOURCES.md` §1 define estos niveles y la regla
 * es que **cada valor viaja con el suyo**. Un logP medido en laboratorio y uno
 * calculado por un algoritmo se ven distintos aquí porque significan cosas
 * distintas: un error de 0.5 unidades en logP desplaza log Kp en 0.35, que es
 * un factor de más de 2 en permeabilidad.
 */
const LEVELS = {
  verified: { label: 'Verificado', cls: 'bg-ok/15 text-ok border-ok/30', icon: '✓' },
  literature: { label: 'Literatura', cls: 'bg-accent/15 text-accent border-accent/30', icon: '◆' },
  estimated: { label: 'Estimado', cls: 'bg-warn/15 text-warn border-warn/30', icon: '≈' },
  heuristic: { label: 'Heurístico', cls: 'bg-risk/15 text-risk border-risk/30', icon: '~' },
} as const;

type Level = keyof typeof LEVELS;

const LevelBadge: React.FC<{ level: Level }> = ({ level }) => {
  const l = LEVELS[level];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${l.cls}`}
    >
      <span className="font-mono">{l.icon}</span>
      {l.label}
    </span>
  );
};

interface Row {
  property: string;
  value: string;
  origin: string;
  level: Level;
  note?: string;
}

const Provenance: React.FC<{
  ingredient: CatalogIngredient;
  validation: Section<ValidationData> | null;
}> = ({ ingredient, validation }) => {
  const predicted = validation?.ok ? validation.data.prediction.log_kp : null;
  const measured = validation?.ok ? validation.data.evidence.exact_match : null;

  const rows: Row[] = [
    {
      property: 'Peso molecular',
      value: `${ingredient.molecularWeight} g/mol`,
      origin: ingredient.source,
      level: 'verified',
      note: 'Se deriva de la fórmula molecular: es exacto, no una medida.',
    },
    {
      property: 'logP',
      value: ingredient.logP.toFixed(2),
      origin: `${ingredient.source} · XLogP3`,
      level: 'estimated',
      note: 'XLogP3 lo calcula un algoritmo, no un laboratorio. Un error de 0.5 aquí mueve log Kp en 0.35.',
    },
    {
      property: 'log Kp',
      value: predicted !== null ? predicted.toFixed(2) : '—',
      origin: 'Potts & Guy (1992), calculado',
      level: 'estimated',
      note: 'log Kp = -2.7 + 0.71·logP - 0.0061·MW',
    },
  ];

  if (measured) {
    rows.push({
      property: 'log Kp medido',
      value: measured.log_kp_measured.toFixed(2),
      origin: 'HuskinDB · celda de difusión, piel humana',
      level: 'verified',
      note: `Medición experimental. La fórmula se desvía ${measured.absolute_error.toFixed(2)} unidades.`,
    });
  }

  return (
    <details className="group rounded-lg border border-border/60 bg-surface-2/30 p-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-text">
          ¿De dónde sale cada número? · Fórmulas y procedencia
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
        {rows.map((r) => (
          <div key={r.property} className="flex flex-col gap-1 rounded-md bg-surface/60 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-text">{r.property}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold tabular-nums text-text">
                  {r.value}
                </span>
                <LevelBadge level={r.level} />
              </div>
            </div>
            <span className="font-mono text-[9px] leading-relaxed text-text-muted/80">
              {r.origin}
            </span>
            {r.note && (
              <span className="text-[10px] leading-relaxed text-text-muted">{r.note}</span>
            )}
          </div>
        ))}

        <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
          <span className="text-[9px] uppercase tracking-wider text-text-muted">Niveles:</span>
          {(Object.keys(LEVELS) as Level[]).map((l) => (
            <LevelBadge key={l} level={l} />
          ))}
        </div>
        <p className="text-[10px] leading-relaxed text-text-muted/80">
          El nivel del activo en el catálogo es{' '}
          <strong className="text-text">{LEVELS[ingredient.dataLevel as Level]?.label ?? ingredient.dataLevel}</strong>:
          el peor de todos sus campos, porque una fila no es más fiable que su dato más débil.
        </p>
      </div>
    </details>
  );
};

/* ── Cómo funciona esto ─────────────────────────────────────────────────── */

/**
 * La explicación va dentro del panel y no en la documentación porque la
 * pregunta "¿de dónde sale este número?" se hace mirando el número, no leyendo
 * un README.
 */
const HowItWorks: React.FC = () => (
  <details className="group rounded-lg border border-border/60 bg-surface-2/30 p-2.5">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
      <span className="text-[11px] font-medium text-text">
        ¿Cómo se calcula esto? ¿Dónde está el machine learning?
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
    </summary>

    <div className="mt-3 flex flex-col gap-3 border-t border-border/60 pt-3 text-[10px] leading-relaxed text-text-muted">
      <p>
        <strong className="text-text">No hay un modelo de IA prediciendo la permeabilidad.</strong>{' '}
        El valor de log&nbsp;Kp sale de la correlación de{' '}
        <span className="font-mono text-text">Potts y Guy (1992)</span>, publicada y citable, que
        relaciona la permeabilidad con solo dos propiedades: peso molecular y logP.
      </p>

      <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface p-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Se intentó entrenar un modelo. No ganó.
        </span>
        <p>
          Se entrenó una regresión ridge con{' '}
          <strong className="text-text">229 compuestos de permeabilidad medida en piel humana</strong>{' '}
          (HuskinDB), validada leave-one-out. Resultado:
        </p>
        <div className="my-1 overflow-x-auto">
          <table className="w-full font-mono text-[10px] tabular-nums">
            <tbody>
              <tr className="border-b border-border/40">
                <td className="py-0.5 pr-3">Ridge (MW + logP)</td>
                <td className="py-0.5 pr-2 text-right">MAE 0.900</td>
                <td className="py-0.5 text-right text-text-muted">RMSE 1.199</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-3 text-text">Potts-Guy (1992)</td>
                <td className="py-0.5 pr-2 text-right text-text">MAE 0.898</td>
                <td className="py-0.5 text-right text-text-muted">RMSE 1.304</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          El modelo entrenado <strong className="text-text">no supera</strong> a una fórmula de
          1992. Añadir más descriptores (TPSA, donores, aceptores) lo empeora: sobreajuste con
          pocos datos. Por eso el motor sigue usando Potts-Guy, y por una razón medida, no por
          falta de intentarlo.
        </p>
      </div>

      <p>
        <strong className="text-text">Hay un motivo de fondo:</strong> 82 de esos compuestos se
        midieron en más de un laboratorio, y entre ellos discrepan{' '}
        <strong className="text-text">0.96 unidades de log&nbsp;Kp</strong> para la misma molécula.
        Ese es el suelo de error. Ningún modelo puede bajar de la variabilidad de sus propios
        datos.
      </p>

      <div className="flex flex-col gap-1 rounded-md border border-accent/25 bg-accent/5 p-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
          Lo que sí aporta este panel
        </span>
        <p>
          En vez de una predicción nueva, se mide{' '}
          <strong className="text-text">cuánto se equivoca la fórmula con moléculas parecidas a
          la que has elegido</strong>. Se buscan los 8 compuestos medidos más cercanos en peso
          molecular y logP, y se promedia su error real. Ese margen (el «±» de arriba) suele ser
          bastante más estrecho que el error global, y responde a la única pregunta que importa al
          formular: ¿me puedo fiar de este número <em>para este activo</em>?
        </p>
        <p>
          Si no hay compuestos medidos parecidos, no se inventa un margen: el panel lo declara.
        </p>
      </div>

      <p className="text-text-muted/70">
        Datos: HuskinDB — Fröhlich et al. (2020), Scientific Data 7:414,{' '}
        <span className="font-mono">doi:10.1038/s41597-020-00764-z</span>. Los descriptores (MW,
        logP) son calculados, no medidos.
      </p>
    </div>
  </details>
);

/* ── Límite del catálogo ────────────────────────────────────────────────── */

/**
 * El límite que viene con el ingrediente en el catálogo, que **no siempre es
 * un límite legal**. De los 12 activos, solo retinol, ácido salicílico y ácido
 * kójico tienen una entrada en el Reglamento (CE) 1223/2009; el resto lleva un
 * valor de referencia del CIR Expert Panel o de literatura.
 *
 * Se muestra aparte de la verificación regulatoria justamente para que no se
 * confundan: es el mismo umbral que pinta de rojo la tarjeta del activo, y hay
 * que poder ver de dónde sale.
 */
const CatalogLimit: React.FC<{ ingredient: CatalogIngredient; concentrationPct: number }> = ({
  ingredient,
  concentrationPct,
}) => {
  const limit = ingredient.maxUseConcentration;
  if (limit === undefined) return null;

  const exceeded = concentrationPct > limit;
  const cerca = !exceeded && concentrationPct >= limit * 0.8;

  return (
    <div
      className={`flex flex-col gap-1 rounded-md border p-2.5 ${
        exceeded
          ? 'border-risk/30 bg-risk/10'
          : cerca
            ? 'border-warn/25 bg-warn/10'
            : 'border-border/60 bg-surface-2/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-text">Máximo de referencia del catálogo</span>
        <span
          className={`font-mono text-[11px] font-bold tabular-nums ${
            exceeded ? 'text-risk' : cerca ? 'text-warn' : 'text-text-muted'
          }`}
        >
          {concentrationPct.toFixed(2)}% / {limit}%
        </span>
      </div>
      {exceeded && (
        <span className="text-[10px] font-semibold leading-relaxed text-risk">
          La concentración excede el máximo de referencia de este activo.
        </span>
      )}
      {ingredient.regulationRef && (
        <p className="font-mono text-[9px] leading-relaxed text-text-muted/70">
          {ingredient.regulationRef}
        </p>
      )}
    </div>
  );
};

/* ── Evidencia experimental ─────────────────────────────────────────────── */

const ValidationSection: React.FC<{ section: Section<ValidationData> | null }> = ({ section }) => {
  if (!section) return <Skeleton lines={3} />;
  if (!section.ok) return <Unavailable message={section.message} />;

  const { prediction, domain, evidence } = section.data;
  const { local_mae, global_mae, neighbours_representative, exact_match, neighbours } = evidence;

  // El error que se muestra como principal es el local si la vecindad es
  // representativa; si no lo es, el global, y se dice que es global.
  const shownError = neighbours_representative ? local_mae : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Permeabilidad estimada
        </span>
        <span className="font-mono text-[10px] text-text-muted">{prediction.model}</span>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex flex-col">
          <span className="font-mono text-2xl font-bold tabular-nums text-accent">
            {prediction.log_kp.toFixed(2)}
          </span>
          <span className="text-[10px] text-text-muted">log Kp (cm/h)</span>
        </div>

        {shownError !== null && (
          <div className="flex flex-col pb-1">
            <span className="font-mono text-sm font-semibold tabular-nums text-text">
              ± {shownError.toFixed(2)}
            </span>
            <span className="text-[10px] text-text-muted">
              error medido en {evidence.n_neighbours} compuestos similares
            </span>
          </div>
        )}
      </div>

      {shownError !== null && (
        <p className="rounded-md border border-border/60 bg-surface-2/40 p-2 text-[10px] leading-relaxed text-text-muted">
          <strong className="text-text">Qué significa ese ±:</strong> la escala es logarítmica, así
          que cada unidad es un factor de 10. Un margen de {shownError.toFixed(2)} quiere decir que
          la velocidad real de penetración podría ser hasta{' '}
          <strong className="text-text">{logErrorToFactor(shownError)}</strong> mayor o menor que la
          estimada.
          {shownError > 1 && (
            <span className="text-warn">
              {' '}
              Es un margen amplio: úsalo para comparar formulaciones entre sí, no como una cifra
              absoluta.
            </span>
          )}
        </p>
      )}

      <p className="rounded-md border border-border/60 bg-surface-2/40 p-2 font-mono text-[10px] leading-relaxed text-text-muted">
        {prediction.formula}
      </p>

      {!domain.in_domain && (
        <div className="flex gap-1.5 rounded-md border border-risk/20 bg-risk/10 p-2 text-[11px] text-risk">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Fuera del dominio de aplicabilidad</span>
            {domain.reasons.map((r) => (
              <span key={r} className="text-[10px] leading-relaxed opacity-90">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {!neighbours_representative && (
        <div className="flex gap-1.5 rounded-md border border-warn/20 bg-warn/10 p-2 text-[11px] text-warn">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[10px] leading-relaxed">
            No hay compuestos medidos parecidos a este activo, así que{' '}
            <strong>no se puede estimar un error específico</strong>. Sobre el conjunto completo
            ({evidence.n_measured} compuestos) el error medio es de {global_mae.toFixed(2)} unidades.
          </span>
        </div>
      )}

      {exact_match && (
        <div className="flex flex-col gap-1 rounded-md border border-ok/25 bg-ok/10 p-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ok">
            Este activo tiene permeabilidad medida
          </span>
          <div className="flex items-center gap-4 font-mono text-[11px] tabular-nums text-text">
            <span>
              predicho <strong>{exact_match.log_kp_predicted.toFixed(2)}</strong>
            </span>
            <span>
              medido <strong>{exact_match.log_kp_measured.toFixed(2)}</strong>
            </span>
            <span className="text-text-muted">
              error {exact_match.absolute_error.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {neighbours_representative && neighbours.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[11px] text-text-muted transition-colors hover:text-text">
            <span className="underline decoration-dotted underline-offset-2">
              Ver los {neighbours.length} compuestos medidos usados como referencia
            </span>
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left font-mono text-[10px] tabular-nums">
              <thead className="text-text-muted">
                <tr className="border-b border-border/60">
                  <th className="py-1 pr-2 font-medium">Compuesto</th>
                  <th className="py-1 pr-2 text-right font-medium">MW</th>
                  <th className="py-1 pr-2 text-right font-medium">logP</th>
                  <th className="py-1 pr-2 text-right font-medium">pred.</th>
                  <th className="py-1 pr-2 text-right font-medium">medido</th>
                  <th className="py-1 text-right font-medium">error</th>
                </tr>
              </thead>
              <tbody className="text-text">
                {neighbours.map((n) => (
                  <tr key={n.compound_name} className="border-b border-border/30">
                    <td className="max-w-[130px] truncate py-1 pr-2" title={n.compound_name}>
                      {n.compound_name}
                    </td>
                    <td className="py-1 pr-2 text-right">{n.molecular_weight.toFixed(0)}</td>
                    <td className="py-1 pr-2 text-right">{n.log_p.toFixed(2)}</td>
                    <td className="py-1 pr-2 text-right">{n.log_kp_predicted.toFixed(2)}</td>
                    <td className="py-1 pr-2 text-right">{n.log_kp_measured.toFixed(2)}</td>
                    <td className="py-1 text-right text-text-muted">
                      {n.absolute_error.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] leading-relaxed text-text-muted">
              Permeabilidades medidas en piel humana. Fuente: HuskinDB — Fröhlich et al. (2020),
              <span className="font-mono"> doi:10.1038/s41597-020-00764-z</span>.
            </p>
          </div>
        </details>
      )}
    </div>
  );
};

/* ── Verificación regulatoria ───────────────────────────────────────────── */

const RegulatorySection: React.FC<{
  section: Section<RegulatoryData> | null;
  concentrationPct: number;
}> = ({ section, concentrationPct }) => {
  if (!section) return <Skeleton lines={2} />;
  if (!section.ok) {
    if (section.code === 'SKIPPED') return null;
    return <Unavailable message={section.message} />;
  }

  const { summary, findings, disclaimer } = section.data;
  const style = OUTCOME_STYLE[summary];
  // Las obligaciones de proceso (informe de seguridad, notificación) aplican
  // siempre y no dependen de la concentración: se separan de los límites.
  const limits = findings.filter((f) => f.limit_pct !== null || f.outcome === 'fail');
  const relevant = limits.length > 0 ? limits : findings.slice(0, 2);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-text-muted" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Verificación preliminar
          </span>
        </div>
        <span className={`flex items-center gap-1 text-[11px] font-semibold ${style.cls}`}>
          <style.Icon className="h-3.5 w-3.5" />
          {style.label}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {relevant.map((f) => {
          const s = OUTCOME_STYLE[f.outcome];
          return (
            <div
              key={`${f.jurisdiction}-${f.requirement}`}
              className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface-2/40 p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-text">
                  <span className="mr-1.5 rounded bg-surface-2 px-1 py-0.5 font-mono text-[9px] uppercase text-text-muted">
                    {f.jurisdiction}
                  </span>
                  {f.requirement}
                </span>
                {f.limit_pct !== null && (
                  <span className={`shrink-0 font-mono text-[10px] font-bold ${s.cls}`}>
                    {concentrationPct.toFixed(2)}% / {f.limit_pct}%
                  </span>
                )}
              </div>
              <p className="text-[10px] leading-relaxed text-text-muted">{f.message}</p>
              <p className="font-mono text-[9px] text-text-muted/70">{f.source}</p>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] leading-relaxed text-text-muted/80">{disclaimer}</p>
    </div>
  );
};

/* ── Estados auxiliares ─────────────────────────────────────────────────── */

const Skeleton: React.FC<{ lines: number }> = ({ lines }) => (
  <div className="flex animate-pulse flex-col gap-2">
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="h-3 rounded bg-surface-2" style={{ width: `${90 - i * 18}%` }} />
    ))}
  </div>
);

const Unavailable: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start gap-1.5 rounded-md border border-border/60 bg-surface-2/40 p-2 text-[11px] text-text-muted">
    <Info className="h-3.5 w-3.5 shrink-0" />
    <span className="leading-relaxed">{message}</span>
  </div>
);
