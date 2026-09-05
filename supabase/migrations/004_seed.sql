-- ─────────────────────────────────────────────────────────────────────────────
-- 004_seed.sql — catalogos publicos
--
-- Correccion sobre docs/BACKEND_SCHEMA.md §5:
--   · El seed original insertaba en una columna `source` (texto) que NO existe:
--     la tabla define `sources` (jsonb). Tal cual estaba, la migracion fallaba
--     con "column source of relation ingredients does not exist".
--   · Se rellena `sources` con procedencia POR CAMPO y `data_level` con el peor
--     nivel de la fila, que es lo que gobierna la etiqueta que ve el usuario
--     (docs/DATA_SOURCES.md §3.3).
--
-- Sobre el nivel del logP: PubChem publica casi siempre XLogP3, que es
-- CALCULADO por computadora, no medido. Por eso baja a `estimated` y arrastra
-- consigo el `data_level` de la fila. Declararlo `verified` seria el tipo de
-- sobredeclaracion que este proyecto no admite.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Vehiculos ────────────────────────────────────────────────────────────────
insert into public.vehicles (name, enhancer_factor, description) values
  ('Solución acuosa',      1.00, 'Referencia neutra'),
  ('Gel hidroalcohólico',  1.60, 'Etanol como potenciador de penetración'),
  ('Emulsión O/W',         1.15, 'Crema convencional'),
  ('Emulsión W/O',         0.85, 'Fase externa oleosa, libera más lento'),
  ('Base anhidra',         0.70, 'Ungüento oleoso, oclusivo'),
  ('Propilenglicol 30%',   1.85, 'Potenciador de penetración marcado')
on conflict (name) do nothing;

-- ── Ingredientes ─────────────────────────────────────────────────────────────
insert into public.ingredients
  (name, inci_name, molecular_weight, log_p, pka, category, risk_flags,
   sources, data_level, max_use_concentration, regulation_ref, regulation_version,
   regulation_checked_at)
values
  ('Ácido salicílico', 'Salicylic Acid', 138.12, 2.26, 2.97, 'BHA', '{bha}',
   '{"molecular_weight":{"db":"PubChem","id":"CID 338","level":"verified"},
     "log_p":{"db":"PubChem","id":"CID 338","type":"calculated","level":"estimated"},
     "pka":{"db":"PubChem","id":"CID 338","level":"literature"}}'::jsonb,
   'estimated', 2.000, 'Reg. (CE) 1223/2009 Anexo III, entrada 98', 'consolidado', '2026-09-05'),

  ('Ácido glicólico', 'Glycolic Acid', 76.05, -1.11, 3.83, 'AHA', '{aha}',
   '{"molecular_weight":{"db":"PubChem","id":"CID 757","level":"verified"},
     "log_p":{"db":"PubChem","id":"CID 757","type":"calculated","level":"estimated"},
     "pka":{"db":"PubChem","id":"CID 757","level":"literature"}}'::jsonb,
   'estimated', null, null, null, null),

  ('Ácido láctico', 'Lactic Acid', 90.08, -0.72, 3.86, 'AHA', '{aha}',
   '{"molecular_weight":{"db":"PubChem","id":"CID 612","level":"verified"},
     "log_p":{"db":"PubChem","id":"CID 612","type":"calculated","level":"estimated"},
     "pka":{"db":"PubChem","id":"CID 612","level":"literature"}}'::jsonb,
   'estimated', null, null, null, null),

  ('Retinol', 'Retinol', 286.45, 5.68, null, 'Retinoide', '{retinoid}',
   '{"molecular_weight":{"db":"PubChem","id":"CID 445354","level":"verified"},
     "log_p":{"db":"PubChem","id":"CID 445354","type":"calculated","level":"estimated"}}'::jsonb,
   'estimated', 0.300, 'Reg. (UE) 2024/996 (modifica Anexo III)', '2024/996', '2026-09-05'),

  ('Retinaldehído', 'Retinal', 284.44, 6.31, null, 'Retinoide', '{retinoid}',
   '{"molecular_weight":{"db":"PubChem","id":"CID 638015","level":"verified"},
     "log_p":{"db":"PubChem","id":"CID 638015","type":"calculated","level":"estimated"}}'::jsonb,
   'estimated', null, null, null, null),

  ('Niacinamida', 'Niacinamide', 122.12, -0.37, 3.35, 'Vitamina', '{}',
   '{"molecular_weight":{"db":"PubChem","id":"CID 936","level":"verified"},
     "log_p":{"db":"PubChem","id":"CID 936","type":"calculated","level":"estimated"},
     "pka":{"db":"PubChem","id":"CID 936","level":"literature"}}'::jsonb,
   'estimated', null, null, null, null),

  ('Ácido ascórbico', 'Ascorbic Acid', 176.12, -1.85, 4.10, 'Antioxidante', '{}',
   '{"molecular_weight":{"db":"PubChem","id":"CID 54670067","level":"verified"},
     "log_p":{"db":"PubChem","id":"CID 54670067","type":"calculated","level":"estimated"},
     "pka":{"db":"PubChem","id":"CID 54670067","level":"literature"}}'::jsonb,
   'estimated', null, null, null, null),

  ('Ácido ferúlico', 'Ferulic Acid', 194.18, 1.51, 4.58, 'Antioxidante', '{}',
   '{"molecular_weight":{"db":"PubChem","id":"CID 445858","level":"verified"},
     "log_p":{"db":"PubChem","id":"CID 445858","type":"calculated","level":"estimated"},
     "pka":{"db":"PubChem","id":"CID 445858","level":"literature"}}'::jsonb,
   'estimated', null, null, null, null),

  ('Cafeína', 'Caffeine', 194.19, -0.07, 10.40, 'Estimulante', '{}',
   '{"molecular_weight":{"db":"PubChem","id":"CID 2519","level":"verified"},
     "log_p":{"db":"PubChem","id":"CID 2519","type":"calculated","level":"estimated"},
     "pka":{"db":"PubChem","id":"CID 2519","level":"literature"}}'::jsonb,
   'estimated', null, null, null, null),

  -- Incluido A PROPOSITO: MW 5000 excede los 500 Da y dispara confidence 'low'.
  -- Sirve para demostrar en vivo que el sistema reconoce sus propios limites en
  -- lugar de inventar un resultado.
  ('Ácido hialurónico', 'Sodium Hyaluronate', 5000.00, -4.50, null, 'Humectante', '{}',
   '{"molecular_weight":{"db":"Ficha de proveedor","type":"declared","level":"heuristic"},
     "log_p":{"db":"Estimación de polímero","type":"predicted","level":"heuristic"}}'::jsonb,
   'heuristic', null, null, null, null),

  ('Ácido kójico', 'Kojic Acid', 142.11, -0.64, 7.90, 'Despigmentante', '{}',
   '{"molecular_weight":{"db":"PubChem","id":"CID 3840","level":"verified"},
     "log_p":{"db":"PubChem","id":"CID 3840","type":"calculated","level":"estimated"},
     "pka":{"db":"PubChem","id":"CID 3840","level":"literature"}}'::jsonb,
   'estimated', 1.000, 'Reg. (UE) 2024/996 (modifica Anexo III)', '2024/996', '2026-09-05'),

  ('Alfa-bisabolol', 'Bisabolol', 222.37, 4.75, null, 'Calmante', '{essential_oil}',
   '{"molecular_weight":{"db":"PubChem","id":"CID 10586","level":"verified"},
     "log_p":{"db":"PubChem","id":"CID 10586","type":"calculated","level":"estimated"}}'::jsonb,
   'estimated', null, null, null, null)
on conflict (owner_id, name) do nothing;

-- ── Modelos de piel por sitio anatomico ──────────────────────────────────────
-- Espesores de docs/DATA_SOURCES.md §4.2 (punto medio del rango publicado).
-- Difusividades y tasas de eliminacion: valores por defecto del motor
-- (packages/engine/constants.ts). La difusividad del estrato corneo es un
-- respaldo: el motor la deriva de Kp para cada molecula (DATA_SOURCES §5).
--
-- data_level = 'literature' para todos: son rangos ampliamente reportados y el
-- ordenamiento relativo entre sitios es solido, pero falta fijar la cita exacta
-- de cada numero. La interfaz debe mostrar el rango, no un valor puntual con
-- falsa precision.
insert into public.skin_models (site, label, layers, data_level, source, caveat, is_default)
values
  ('volar_forearm', 'Antebrazo (volar)',
   '[{"layer":"stratum_corneum","label":"Estrato córneo","thickness_um":20,"thickness_um_min":15,"thickness_um_max":20,"diffusivity":1.0e-10,"elimination_rate":0},
     {"layer":"viable_epidermis","label":"Epidermis viable","thickness_um":80,"thickness_um_min":50,"thickness_um_max":80,"diffusivity":1.0e-7,"elimination_rate":0},
     {"layer":"dermis","label":"Dermis","thickness_um":1800,"thickness_um_min":1000,"thickness_um_max":1800,"diffusivity":5.0e-7,"elimination_rate":1.0e-3},
     {"layer":"hypodermis","label":"Hipodermis","thickness_um":1200,"diffusivity":1.0e-7,"elimination_rate":0}]'::jsonb,
   'literature', 'docs/DATA_SOURCES.md §4.2 · packages/engine/constants.ts',
   'Sitio de referencia de la mayoría de estudios in vitro. El espesor de dermis (1800 µm) es el valor por defecto del motor y queda por encima del rango 1000-1500 µm reportado para antebrazo: pendiente de fijar la cita.',
   true),

  ('cheek', 'Rostro (mejilla)',
   '[{"layer":"stratum_corneum","label":"Estrato córneo","thickness_um":13,"thickness_um_min":10,"thickness_um_max":15,"diffusivity":1.0e-10,"elimination_rate":0},
     {"layer":"viable_epidermis","label":"Epidermis viable","thickness_um":50,"thickness_um_min":40,"thickness_um_max":60,"diffusivity":1.0e-7,"elimination_rate":0},
     {"layer":"dermis","label":"Dermis","thickness_um":1050,"thickness_um_min":900,"thickness_um_max":1200,"diffusivity":5.0e-7,"elimination_rate":1.0e-3},
     {"layer":"hypodermis","label":"Hipodermis","thickness_um":1200,"diffusivity":1.0e-7,"elimination_rate":0}]'::jsonb,
   'literature', 'docs/DATA_SOURCES.md §4.2',
   'Barrera más delgada que el antebrazo: mayor penetración esperada.', false),

  ('forehead', 'Frente',
   '[{"layer":"stratum_corneum","label":"Estrato córneo","thickness_um":14,"thickness_um_min":12,"thickness_um_max":16,"diffusivity":1.0e-10,"elimination_rate":0},
     {"layer":"viable_epidermis","label":"Epidermis viable","thickness_um":60,"thickness_um_min":50,"thickness_um_max":70,"diffusivity":1.0e-7,"elimination_rate":0},
     {"layer":"dermis","label":"Dermis","thickness_um":1200,"thickness_um_min":1000,"thickness_um_max":1400,"diffusivity":5.0e-7,"elimination_rate":1.0e-3},
     {"layer":"hypodermis","label":"Hipodermis","thickness_um":1200,"diffusivity":1.0e-7,"elimination_rate":0}]'::jsonb,
   'literature', 'docs/DATA_SOURCES.md §4.2',
   'Alta densidad sebácea; el modelo no simula la vía sebácea.', false),

  ('scalp', 'Cuero cabelludo',
   '[{"layer":"stratum_corneum","label":"Estrato córneo","thickness_um":18,"thickness_um_min":15,"thickness_um_max":20,"diffusivity":1.0e-10,"elimination_rate":0},
     {"layer":"viable_epidermis","label":"Epidermis viable","thickness_um":60,"thickness_um_min":50,"thickness_um_max":70,"diffusivity":1.0e-7,"elimination_rate":0},
     {"layer":"dermis","label":"Dermis","thickness_um":1500,"thickness_um_min":1200,"thickness_um_max":1800,"diffusivity":5.0e-7,"elimination_rate":1.0e-3},
     {"layer":"hypodermis","label":"Hipodermis","thickness_um":1200,"diffusivity":1.0e-7,"elimination_rate":0}]'::jsonb,
   'literature', 'docs/DATA_SOURCES.md §4.2 y §4.3',
   'ADVERTENCIA: alta densidad folicular. La penetración por folículo piloso puede dominar en las primeras horas y el modelo SOLO simula difusión pasiva transepidérmica, así que aquí SUBESTIMA la penetración temprana.',
   false),

  ('abdomen', 'Abdomen',
   '[{"layer":"stratum_corneum","label":"Estrato córneo","thickness_um":16,"thickness_um_min":13,"thickness_um_max":18,"diffusivity":1.0e-10,"elimination_rate":0},
     {"layer":"viable_epidermis","label":"Epidermis viable","thickness_um":65,"thickness_um_min":50,"thickness_um_max":80,"diffusivity":1.0e-7,"elimination_rate":0},
     {"layer":"dermis","label":"Dermis","thickness_um":2000,"thickness_um_min":1500,"thickness_um_max":2500,"diffusivity":5.0e-7,"elimination_rate":1.0e-3},
     {"layer":"hypodermis","label":"Hipodermis","thickness_um":1200,"diffusivity":1.0e-7,"elimination_rate":0}]'::jsonb,
   'literature', 'docs/DATA_SOURCES.md §4.2',
   'Frecuente en estudios ex vivo con piel de cirugía.', false),

  ('palm_sole', 'Palma / planta',
   '[{"layer":"stratum_corneum","label":"Estrato córneo","thickness_um":500,"thickness_um_min":400,"thickness_um_max":600,"diffusivity":1.0e-10,"elimination_rate":0},
     {"layer":"viable_epidermis","label":"Epidermis viable","thickness_um":400,"thickness_um_min":300,"thickness_um_max":500,"diffusivity":1.0e-7,"elimination_rate":0},
     {"layer":"dermis","label":"Dermis","thickness_um":1750,"thickness_um_min":1500,"thickness_um_max":2000,"diffusivity":5.0e-7,"elimination_rate":1.0e-3},
     {"layer":"hypodermis","label":"Hipodermis","thickness_um":1200,"diffusivity":1.0e-7,"elimination_rate":0}]'::jsonb,
   'literature', 'docs/DATA_SOURCES.md §4.2',
   'Barrera extrema (estrato córneo ~25x el del antebrazo). Caso límite útil para demostrar el contraste entre sitios.',
   false)
on conflict (site) do nothing;
