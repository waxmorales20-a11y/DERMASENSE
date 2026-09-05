-- ═════════════════════════════════════════════════════════════════════════════
--  DERMASENSE — migracion completa
--  Pegar TODO en el editor SQL de Supabase (Dashboard → SQL Editor) y ejecutar.
--  Es idempotente: se puede volver a ejecutar sin romper nada.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 001_init.sql — tablas e indices
-- DERMASENSE · pegar en el editor SQL de Supabase y ejecutar
--
-- Correcciones sobre docs/BACKEND_SCHEMA.md §2:
--   · Se crea la extension `pg_trgm`. El indice `ingredients_name_trgm_idx` usa
--     `gin_trgm_ops` y sin la extension la migracion falla en esa linea.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ── Perfiles: extiende auth.users ────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  organization text,
  role         text not null default 'formulator'
               check (role in ('formulator','researcher','student','admin')),
  created_at   timestamptz not null default now()
);

-- ── Catalogo de ingredientes activos ─────────────────────────────────────────
-- owner_id NULL = catalogo publico curado. owner_id con valor = ingrediente
-- privado del usuario, nunca visible para nadie mas (docs/DATA_SOURCES.md §3.6).
create table if not exists public.ingredients (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid references public.profiles(id) on delete cascade,
  name                text not null,
  inci_name           text,
  molecular_weight    numeric(8,2) not null check (molecular_weight > 0),
  log_p               numeric(5,2) not null check (log_p between -5 and 10),
  pka                 numeric(5,2),
  category            text not null,
  risk_flags          text[] not null default '{}',

  -- Procedencia por campo, no por fila: el MW puede estar verificado y el logP
  -- solo estimado (docs/DATA_SOURCES.md §3.3).
  --   { "log_p": { "db":"PubChem", "id":"CID 338",
  --                "type":"calculated", "level":"estimated" }, ... }
  sources             jsonb not null default '{}',

  -- Peor nivel entre todos los campos: gobierna la etiqueta que ve el usuario.
  data_level          text not null default 'heuristic'
                      check (data_level in ('verified','literature','estimated','heuristic')),

  -- Limite regulatorio de uso (docs/DATA_SOURCES.md §7).
  max_use_concentration numeric(6,3),
  regulation_ref        text,          -- p. ej. 'Reg. (CE) 1223/2009 Anexo III'
  regulation_version    text,          -- las restricciones cambian con el tiempo
  regulation_checked_at date,

  created_at          timestamptz not null default now(),

  -- El catalogo publico no admite nombres repetidos; los privados si pueden
  -- coincidir con uno publico (es el mismo activo con datos del proveedor).
  constraint ingredients_public_name_unique unique nulls not distinct (owner_id, name)
);

-- ── Modelos de piel por sitio anatomico ──────────────────────────────────────
-- El estrato corneo varia mas de 20x entre zonas: simular una crema facial con
-- datos de antebrazo es el error de parametrizacion mas caro del sistema.
create table if not exists public.skin_models (
  id            uuid primary key default gen_random_uuid(),
  site          text not null unique,   -- 'volar_forearm', 'cheek', 'scalp', ...
  label         text not null,
  -- Array de 4 objetos {layer, thickness_um, diffusivity, elimination_rate}
  layers        jsonb not null,
  data_level    text not null default 'literature'
                check (data_level in ('verified','literature','estimated','heuristic')),
  source        text,
  -- Advertencia mostrada al seleccionar el preset (p. ej. la via folicular del
  -- cuero cabelludo, que el modelo no simula).
  caveat        text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ── Conjunto de referencia con permeabilidades medidas ───────────────────────
-- Permite publicar un error real (predicho vs medido) en lugar de una promesa.
create table if not exists public.validation_records (
  id               uuid primary key default gen_random_uuid(),
  dataset          text not null default 'huskindb_2020',
  compound_name    text not null,
  molecular_weight numeric(8,2) not null,
  log_p            numeric(5,2) not null,
  log_kp_measured  numeric(6,3) not null,   -- valor experimental de referencia
  source           text not null,
  created_at       timestamptz not null default now(),
  unique (dataset, compound_name)
);

-- ── Catalogo de vehiculos ────────────────────────────────────────────────────
create table if not exists public.vehicles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  enhancer_factor numeric(4,2) not null default 1.00
                  check (enhancer_factor between 0.10 and 5.00),
  description     text,
  created_at      timestamptz not null default now()
);

-- ── Simulaciones del usuario ─────────────────────────────────────────────────
create table if not exists public.simulations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  ingredient_id       uuid references public.ingredients(id) on delete set null,
  vehicle_id          uuid references public.vehicles(id) on delete set null,
  skin_model_id       uuid references public.skin_models(id) on delete set null,
  title               text not null default 'Simulación sin título',
  concentration_pct   numeric(6,3) not null check (concentration_pct > 0 and concentration_pct <= 30),
  ph                  numeric(4,2)  not null check (ph between 3.0 and 9.0),
  duration_hours      numeric(6,2)  not null check (duration_hours between 1 and 48),
  applied_dose_mg_cm2 numeric(6,3)  not null default 2.0 check (applied_dose_mg_cm2 > 0),
  -- Snapshot inmutable del input: los catalogos pueden cambiar, una simulacion
  -- guardada debe seguir siendo reproducible.
  input_snapshot      jsonb not null,
  metrics             jsonb not null,
  engine_version      text  not null,
  notes               text,
  created_at          timestamptz not null default now()
);

-- ── Reportes generados por IA (1:1 con la simulacion) ────────────────────────
create table if not exists public.ai_reports (
  id            uuid primary key default gen_random_uuid(),
  simulation_id uuid not null unique references public.simulations(id) on delete cascade,
  content       text not null,
  model         text not null,
  input_tokens  integer,
  output_tokens integer,
  created_at    timestamptz not null default now()
);

-- ── Indices ──────────────────────────────────────────────────────────────────
create index if not exists simulations_user_created_idx
  on public.simulations (user_id, created_at desc);
create index if not exists simulations_ingredient_idx
  on public.simulations (ingredient_id);
create index if not exists simulations_metrics_gin
  on public.simulations using gin (metrics jsonb_path_ops);
create index if not exists ingredients_name_trgm_idx
  on public.ingredients using gin (name gin_trgm_ops);
create index if not exists ingredients_owner_idx
  on public.ingredients (owner_id) where owner_id is not null;
create index if not exists ai_reports_created_idx
  on public.ai_reports (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 002_rls.sql — Row Level Security
--
-- Esta es la frontera de seguridad real del sistema (ADR-003). Ni el frontend ni
-- el backend deciden quien ve que: lo decide Postgres, fila por fila.
--
-- Sin politicas explicitas, `enable row level security` deniega TODO. Ese es el
-- comportamiento deseado: se abre solo lo estrictamente necesario.
--
-- Correccion sobre docs/BACKEND_SCHEMA.md §3:
--   · Se anade `ai_reports_delete_own`. El backend borra el reporte anterior
--     cuando se pide `force_regenerate` (docs/AI_PROMPTS.md §5: "regenerar exige
--     borrar el reporte anterior de forma explicita"). Sin politica de DELETE,
--     RLS lo bloquea en silencio y la regeneracion nunca funciona.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles           enable row level security;
alter table public.simulations        enable row level security;
alter table public.ai_reports         enable row level security;
alter table public.ingredients        enable row level security;
alter table public.vehicles           enable row level security;
alter table public.skin_models        enable row level security;
alter table public.validation_records enable row level security;

-- ── Perfiles: cada usuario ve y edita solo el suyo ───────────────────────────
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ── Ingredientes ─────────────────────────────────────────────────────────────
-- Catalogo publico: legible por cualquier autenticado.
-- Ingredientes privados: SOLO su dueno. Esta politica protege la propiedad
-- intelectual del cliente, el dato mas sensible de la plataforma.
drop policy if exists "ingredients_read_public_or_own" on public.ingredients;
create policy "ingredients_read_public_or_own" on public.ingredients
  for select to authenticated
  using (owner_id is null or owner_id = auth.uid());

drop policy if exists "ingredients_insert_own" on public.ingredients;
create policy "ingredients_insert_own" on public.ingredients
  for insert to authenticated
  with check (owner_id = auth.uid());   -- nadie puede insertar en el catalogo publico

drop policy if exists "ingredients_update_own" on public.ingredients;
create policy "ingredients_update_own" on public.ingredients
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "ingredients_delete_own" on public.ingredients;
create policy "ingredients_delete_own" on public.ingredients
  for delete to authenticated using (owner_id = auth.uid());

-- ── Catalogos de solo lectura ────────────────────────────────────────────────
drop policy if exists "vehicles_read" on public.vehicles;
create policy "vehicles_read" on public.vehicles
  for select to authenticated using (true);

drop policy if exists "skin_models_read" on public.skin_models;
create policy "skin_models_read" on public.skin_models
  for select to authenticated using (true);

drop policy if exists "validation_read" on public.validation_records;
create policy "validation_read" on public.validation_records
  for select to authenticated using (true);

-- ── Simulaciones: aislamiento total por usuario ──────────────────────────────
drop policy if exists "simulations_select_own" on public.simulations;
create policy "simulations_select_own" on public.simulations
  for select using (auth.uid() = user_id);

drop policy if exists "simulations_insert_own" on public.simulations;
create policy "simulations_insert_own" on public.simulations
  for insert with check (auth.uid() = user_id);

drop policy if exists "simulations_update_own" on public.simulations;
create policy "simulations_update_own" on public.simulations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "simulations_delete_own" on public.simulations;
create policy "simulations_delete_own" on public.simulations
  for delete using (auth.uid() = user_id);

-- ── Reportes: accesibles solo a traves de la simulacion propia ───────────────
drop policy if exists "ai_reports_select_own" on public.ai_reports;
create policy "ai_reports_select_own" on public.ai_reports
  for select using (
    exists (select 1 from public.simulations s
            where s.id = ai_reports.simulation_id and s.user_id = auth.uid())
  );

drop policy if exists "ai_reports_insert_own" on public.ai_reports;
create policy "ai_reports_insert_own" on public.ai_reports
  for insert with check (
    exists (select 1 from public.simulations s
            where s.id = ai_reports.simulation_id and s.user_id = auth.uid())
  );

-- Necesaria para `force_regenerate`: sin ella el borrado del reporte anterior
-- no falla con error, simplemente no borra nada, y el insert posterior choca
-- contra el unique de simulation_id.
drop policy if exists "ai_reports_delete_own" on public.ai_reports;
create policy "ai_reports_delete_own" on public.ai_reports
  for delete using (
    exists (select 1 from public.simulations s
            where s.id = ai_reports.simulation_id and s.user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 003_triggers.sql — creacion automatica del perfil
--
-- `security definer` es lo que hace que esto funcione: el trigger corre con los
-- privilegios del propietario de la funcion, no del usuario que se registra, asi
-- que puede insertar en `profiles` pese a que RLS solo permita leer la fila
-- propia. `set search_path = public` evita el ataque clasico contra funciones
-- security definer (colar un esquema propio antes en el path).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para cuentas que ya existieran antes de crear el trigger.
insert into public.profiles (id, email, full_name)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from   auth.users u
where  not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 005_validation.sql — conjunto de referencia con permeabilidades MEDIDAS
--
-- GENERADO por scripts/export_validation_sql.py del repositorio backend.
-- No editar a mano: regenerar desde el dataset.
--
-- Fuente: HuskinDB — Fröhlich et al. (2020), Scientific Data 7:414
--         doi:10.1038/s41597-020-00764-z · datos en https://osf.io/26hdm/
--         Mediciones de permeación en piel humana, con DOI por medición.
--
-- Estos son valores EXPERIMENTALES (log Kp en cm/h, convertidos desde los cm/s
-- que publica HuskinDB). MW y logP, en cambio, los calcula RDKit desde el SMILES:
-- son 'estimated', no medidos.
--
-- Para que sirve: contrastar la predicción de Potts-Guy contra la medida y
-- publicar el error. Medido sobre estos 229 compuestos, Potts-Guy da
-- MAE = 0.898 y RMSE = 1.304 unidades de log Kp. La dispersión entre
-- laboratorios para un mismo compuesto es de 0.96 unidades: ese es el suelo,
-- y ningún modelo puede bajar de ahí.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.validation_records
  (dataset, compound_name, molecular_weight, log_p, log_kp_measured, source)
values
  ('huskindb_2020', '1,1,1-Trichloropropanone', 161.42, 1.95, -1.62, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', '1,1-Dichloropropanone', 126.97, 1.38, -1.367, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', '1,2,4-Benzenetriol', 126.11, 0.8, -3.9, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0928-0987(02)00085-4'),
  ('huskindb_2020', '1,6-hexanediol diglycidyl ether', 230.3, 1.38, -3.867, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1080/004982500237488'),
  ('huskindb_2020', '1-Butanol', 74.12, 0.78, -2.523, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600840607'),
  ('huskindb_2020', '1-Decanol', 158.28, 3.12, -1.959, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.yrtph.2010.02.008'),
  ('huskindb_2020', '1-Dodecyl glycidyl ether', 242.4, 4.32, -5.48, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1080/004982500237488'),
  ('huskindb_2020', '1-Heptanol', 116.2, 1.95, -1.495, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1965.140'),
  ('huskindb_2020', '1-Hexanol', 102.18, 1.56, -1.728, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-010-0181-z'),
  ('huskindb_2020', '1-Hexyl-2-Pyrrolidone', 169.27, 2.19, -1.652, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-010-0181-z'),
  ('huskindb_2020', '1-Methoxy-2-Propanol', 90.12, 0.01, -2.872, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s00420-002-0367-8'),
  ('huskindb_2020', '1-Nonanol', 144.26, 2.73, -1.222, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12723090'),
  ('huskindb_2020', '1-Octanol', 130.23, 2.34, -1.284, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-010-0181-z'),
  ('huskindb_2020', '1-Octyl-2-Azacycloheptanone', 225.38, 3.75, -1.199, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-010-0181-z'),
  ('huskindb_2020', '1-Octyl-2-Pyrrolidone', 197.32, 2.97, -1.262, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-010-0181-z'),
  ('huskindb_2020', '1-Pentanol', 88.15, 1.17, -2.222, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-010-0181-z'),
  ('huskindb_2020', '1-Propanol', 60.1, 0.39, -2.812, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1964.174'),
  ('huskindb_2020', '17-Hydroxyprogesterone', 330.47, 3.84, -3.222, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1969.9'),
  ('huskindb_2020', '2,3-Butanediol', 90.12, -0.25, -4.301, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1967.11'),
  ('huskindb_2020', '2,4,6-Trichlorophenol', 197.45, 3.35, -1.227, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/j.2042-7158.1977.tb11434.x'),
  ('huskindb_2020', '2,4-Dichlorophenol', 163.0, 2.7, -1.365, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.yrtph.2010.02.008'),
  ('huskindb_2020', '2-(2-Ethoxyethoxy)ethanol', 134.18, 0.03, -3.88, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1289/ehp.8457193'),
  ('huskindb_2020', '2-(2-Methoxyethoxy)ethanol', 120.15, -0.36, -3.686, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1289/ehp.8457193'),
  ('huskindb_2020', '2-Amino-4-Nitrophenol', 154.12, 0.88, -3.852, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12263302'),
  ('huskindb_2020', '2-Butoxyethanol', 118.18, 0.8, -2.691, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s00420-002-0367-8'),
  ('huskindb_2020', '2-Ethoxyethanol', 90.12, 0.02, -3.075, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9373'),
  ('huskindb_2020', '2-Ethoxyethyl acetate', 132.16, 0.59, -1.188, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0272-0590(92)90086-W'),
  ('huskindb_2020', '2-Ethylhexanol', 130.23, 2.2, -0.787, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0272-0590(92)90086-W'),
  ('huskindb_2020', '2-Hydroxypropyl Nicotinate', 181.19, 0.62, -4.469, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600800114'),
  ('huskindb_2020', '2-Methoxyethanol', 76.09, -0.37, -2.539, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1289/ehp.8457193'),
  ('huskindb_2020', '2-Naphthol', 144.17, 2.55, -1.378, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-009-9912-4'),
  ('huskindb_2020', '2-Nitro-p-Phenylenediamine', 153.14, 0.76, -3.301, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12263302'),
  ('huskindb_2020', '2-Phenylethanol', 122.17, 1.22, -1.72, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-010-0181-z'),
  ('huskindb_2020', '2-Phenylphenol', 170.21, 3.06, -2.268, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/rtph.2001.1530'),
  ('huskindb_2020', '2-Propoxyethanol', 104.15, 0.41, -2.987, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0272-0590(92)90086-W'),
  ('huskindb_2020', '2-phenoxyethanol', 138.17, 1.06, -2.874, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/s0278-6915(97)00109-9'),
  ('huskindb_2020', '3,4-Xylenol', 122.17, 2.01, -1.444, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/j.2042-7158.1977.tb11434.x'),
  ('huskindb_2020', '4,4''-Methylenedianiline', 198.27, 2.44, -2.663, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.tox.2003.11.004'),
  ('huskindb_2020', '4-Amino-2-Nitrophenol', 154.12, 0.88, -3.309, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12263302'),
  ('huskindb_2020', '4-Chloro-m-Phenylenediamine', 142.59, 1.5, -2.678, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12263302'),
  ('huskindb_2020', '4-Cyanophenol', 119.12, 1.26, -2.175, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1159/000272121'),
  ('huskindb_2020', '4-Hydroxybenzyl alcohol', 124.14, 0.88, -2.699, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12277592'),
  ('huskindb_2020', '4-Hydroxyphenylacetamide', 151.16, 0.42, -3.347, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12277592'),
  ('huskindb_2020', '4-Hydroxyphenylacetic acid', 152.15, 1.02, -2.602, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12277592'),
  ('huskindb_2020', '4-Propoxyphenol', 152.19, 2.18, -1.824, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-009-9912-4'),
  ('huskindb_2020', '5-Aminolevulinic acid', 131.13, -0.62, -4.155, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/bip.21520'),
  ('huskindb_2020', '5-Fluorouracil', 130.08, -0.8, -4.018, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(92)90032-W'),
  ('huskindb_2020', 'Acetic acid', 60.05, 0.09, -2.523, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.yrtph.2010.02.008'),
  ('huskindb_2020', 'Acetylsalicylic Acid', 180.16, 1.31, -2.14, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(98)00113-6'),
  ('huskindb_2020', 'Aldosterone', 360.45, 1.85, -4.412, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600840922'),
  ('huskindb_2020', 'Amobarbital', 226.28, 1.18, -2.645, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(87)90210-9'),
  ('huskindb_2020', 'Amphetamine', 135.21, 1.58, -2.944, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12598596'),
  ('huskindb_2020', 'Atenolol', 266.34, 0.45, -4.301, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(99)00380-4'),
  ('huskindb_2020', 'Atropine', 289.38, 1.93, -4.599, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/aic.690210522'),
  ('huskindb_2020', 'Barbital', 184.19, 0.16, -3.953, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(87)90210-9'),
  ('huskindb_2020', 'Benzene', 78.11, 1.69, -0.875, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600840607'),
  ('huskindb_2020', 'Benzoic acid', 122.12, 1.38, -1.859, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(98)00113-6'),
  ('huskindb_2020', 'Benzyl nicotinate', 213.24, 2.44, -1.792, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600800114'),
  ('huskindb_2020', 'Betamethasone', 392.47, 1.9, -3.597, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600821017'),
  ('huskindb_2020', 'Betamethasone-17-valerate', 476.59, 3.64, -2.454, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600821017'),
  ('huskindb_2020', 'Bisoprolol Fumarate', 441.52, 2.08, -3.569, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(98)00214-2'),
  ('huskindb_2020', 'Bisphenol A diglycidyl ether', 340.42, 3.57, -6.319, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1080/004982500237488'),
  ('huskindb_2020', 'Bromoacetic acid', 138.95, 0.47, -2.854, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', 'Bromochloroacetic acid', 173.39, 1.03, -2.796, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', 'Bromochloroacetonitrile', 154.39, 1.47, -0.796, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jat.1657'),
  ('huskindb_2020', 'Bromodichloromethane', 163.83, 2.14, -0.745, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', 'Bromoform', 252.73, 2.45, -0.678, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', 'Butan-2-one', 72.11, 0.99, -2.347, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1967.11'),
  ('huskindb_2020', 'Butobarbital', 212.25, 0.94, -3.712, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(87)90210-9'),
  ('huskindb_2020', 'Butoxyethanol', 118.18, 1.14, -2.444, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s00420-005-0056-5'),
  ('huskindb_2020', 'Butyl 4-hydroxybenzoat', 194.23, 2.35, -0.982, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.20773'),
  ('huskindb_2020', 'Butyl nicotinate', 179.22, 2.04, -1.779, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600800114'),
  ('huskindb_2020', 'Butyl p-aminobenzoate', 193.25, 2.23, -0.952, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600821217'),
  ('huskindb_2020', 'Carvacrol', 150.22, 2.82, -1.27, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-009-9912-4'),
  ('huskindb_2020', 'Catechol', 110.11, 1.1, -2.51, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0928-0987(02)00085-4'),
  ('huskindb_2020', 'Celiprolol Hydrochloride', 415.96, 3.31, -3.229, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(98)00214-2'),
  ('huskindb_2020', 'Chloral hydrate', 165.4, 0.67, -2.409, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jat.1657'),
  ('huskindb_2020', 'Chloroacetic acid', 94.5, 0.31, -2.959, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', 'Chloroacetonitrile', 75.5, 0.75, -1.005, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jat.1657'),
  ('huskindb_2020', 'Chlorocresol', 142.58, 2.35, -1.352, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-009-9912-4'),
  ('huskindb_2020', 'Chlorodibromomethane', 208.28, 2.3, -0.699, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', 'Chloroform', 119.38, 1.99, -0.796, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', 'Chloroxylenol', 156.61, 2.66, -1.162, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-009-9912-4'),
  ('huskindb_2020', 'Chlorpheniramine', 274.8, 3.82, -2.797, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/aic.690210522'),
  ('huskindb_2020', 'Chlorpyrifos', 350.59, 4.72, -3.602, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1191/096032700678815684'),
  ('huskindb_2020', 'Clotrimazole', 344.85, 5.38, -5.699, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(00)00665-7'),
  ('huskindb_2020', 'Codeine', 299.37, 1.5, -4.31, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/A:1015944018555'),
  ('huskindb_2020', 'Cortexolone', 346.47, 2.81, -4.125, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1969.9'),
  ('huskindb_2020', 'Cortexone', 330.47, 3.7, -3.347, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1969.9'),
  ('huskindb_2020', 'Corticosterone', 346.47, 2.67, -4.0, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600840607'),
  ('huskindb_2020', 'Cortisone', 360.45, 1.99, -4.412, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.yrtph.2010.02.008'),
  ('huskindb_2020', 'Dexamethasone', 392.47, 1.9, -4.194, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1021/js960079z'),
  ('huskindb_2020', 'Diazinon', 304.35, 3.58, -2.061, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.yrtph.2010.02.008'),
  ('huskindb_2020', 'Dibromoacetic acid', 217.84, 1.19, -2.585, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', 'Dibromoacetonitrile', 198.84, 1.63, -0.77, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jat.1657'),
  ('huskindb_2020', 'Dibutyl Phthalate', 278.35, 3.6, -5.639, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1289/ehp.8774223'),
  ('huskindb_2020', 'Dichloroacetic acid', 128.94, 0.87, -2.722, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', 'Dichloroacetonitrile', 109.94, 1.31, -0.824, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jat.1657'),
  ('huskindb_2020', 'Diclofenac', 296.15, 4.36, -3.0, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(98)00113-6'),
  ('huskindb_2020', 'Diethyl Phthalate', 222.24, 2.04, -4.943, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1289/ehp.8774223'),
  ('huskindb_2020', 'Diethyl ether', 74.12, 1.04, -1.782, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1967.11'),
  ('huskindb_2020', 'Diethylcarbamazine', 199.3, 0.7, -3.903, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/aic.690210522'),
  ('huskindb_2020', 'Diethylene glycol mono n-butyl ether acetate', 204.27, 1.38, -3.858, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.tiv.2004.03.004'),
  ('huskindb_2020', 'Diethylene glycol monobutyl ether', 162.23, 0.81, -2.203, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0272-0590(92)90086-W'),
  ('huskindb_2020', 'Dimethyl Phthalate', 194.19, 1.26, -4.479, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1289/ehp.8774223'),
  ('huskindb_2020', 'Dimethylethylamine', 73.14, 0.57, -2.523, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s004200050223'),
  ('huskindb_2020', 'Dipropylene glycol mono methyl ether', 148.2, 0.42, -4.028, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.tiv.2004.03.004'),
  ('huskindb_2020', 'Ephedrine', 165.24, 1.33, -2.222, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/aic.690210522'),
  ('huskindb_2020', 'Epikote YX4000', 354.45, 4.14, -7.328, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1080/004982500237488'),
  ('huskindb_2020', 'Estradiol', 272.39, 3.61, -2.411, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/aic.690210522'),
  ('huskindb_2020', 'Estriol', 288.39, 2.58, -4.398, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1969.9'),
  ('huskindb_2020', 'Estrone', 270.37, 3.82, -2.444, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1969.9'),
  ('huskindb_2020', 'Ethacrynic acid', 303.14, 3.61, -3.824, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.yrtph.2010.02.008'),
  ('huskindb_2020', 'Ethanol', 46.07, -0.0, -2.796, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1964.174'),
  ('huskindb_2020', 'Ethyl 3-ethoxypropionate', 146.19, 0.98, 0.443, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0272-0590(92)90086-W'),
  ('huskindb_2020', 'Ethyl nicotinate', 151.16, 1.26, -2.199, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600800114'),
  ('huskindb_2020', 'Ethyl p-aminobenzoate', 165.19, 1.45, -1.699, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600821217'),
  ('huskindb_2020', 'Ethylene glycol mono isopropyl ether', 104.15, 0.4, -3.463, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.tiv.2004.03.004'),
  ('huskindb_2020', 'Ethylene glycol mono methyl ether acetate', 118.13, 0.2, -2.912, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.tiv.2004.03.004'),
  ('huskindb_2020', 'Etodolac', 287.36, 3.38, -2.127, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.10312'),
  ('huskindb_2020', 'Etorphine', 411.54, 3.16, -2.444, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/A:1015877621976'),
  ('huskindb_2020', 'Famotidine', 337.46, -0.77, -4.789, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.10312'),
  ('huskindb_2020', 'Fentanyl', 336.48, 4.14, -1.973, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/aic.690210522'),
  ('huskindb_2020', 'Flufenamic acid', 281.23, 4.15, -2.596, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1159/000112958'),
  ('huskindb_2020', 'Fluocinonide', 494.53, 2.94, -2.77, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/a:1015989929342'),
  ('huskindb_2020', 'Flurbiprofen', 244.27, 3.68, -1.775, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.ijpharm.2005.05.030'),
  ('huskindb_2020', 'Flurbiprofen glucoside', 406.41, 0.94, -2.921, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.ijpharm.2005.05.030'),
  ('huskindb_2020', 'Flurbiprofen mannoside', 406.41, 0.94, -3.379, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.ijpharm.2005.05.030'),
  ('huskindb_2020', 'Haloperidol', 375.87, 4.43, -3.474, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1248/cpb.49.1395'),
  ('huskindb_2020', 'Histidine', 155.16, -0.64, -4.347, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(93)90321-6'),
  ('huskindb_2020', 'Hydrocortisone', 362.47, 1.78, -3.973, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600840922'),
  ('huskindb_2020', 'Hydrocortisone 21-(6-hydroxyhexanoate)', 476.61, 2.89, -3.041, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/a:1015989929342'),
  ('huskindb_2020', 'Hydrocortisone 21-(N,N-dimethylsuccinamate)', 489.61, 2.2, -4.174, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/a:1015989929342'),
  ('huskindb_2020', 'Hydrocortisone 21-Hemisuccinate', 462.54, 2.2, -3.201, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/a:1015989929342'),
  ('huskindb_2020', 'Hydrocortisone 21-Hexanoate', 460.61, 3.91, -1.745, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/a:1015989929342'),
  ('huskindb_2020', 'Hydrocortisone 21-methylsuccinate', 476.57, 2.29, -3.678, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/a:1015989929342'),
  ('huskindb_2020', 'Hydrocortisone 21-octanoate', 488.67, 4.69, -1.208, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/a:1015989929342'),
  ('huskindb_2020', 'Hydrocortisone 21-propionate', 418.53, 2.74, -2.475, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/a:1015989929342'),
  ('huskindb_2020', 'Hydrocortisone 21-succinamate', 461.56, 1.6, -4.585, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/a:1015989929342'),
  ('huskindb_2020', 'Hydromorphone', 285.34, 1.63, -4.824, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/A:1015944018555'),
  ('huskindb_2020', 'Hydroquinone', 110.11, 1.1, -3.99, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-4274(95)03393-Y'),
  ('huskindb_2020', 'Hydroxypregnenolone', 332.48, 3.84, -3.222, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1969.9'),
  ('huskindb_2020', 'Ibuprofen', 206.28, 3.07, -1.693, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(98)00113-6'),
  ('huskindb_2020', 'Ibuprofen glucoside', 368.43, 0.33, -3.389, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.ijpharm.2005.05.030'),
  ('huskindb_2020', 'Ibuprofen mannoside', 368.43, 0.33, -2.992, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.ijpharm.2005.05.030'),
  ('huskindb_2020', 'Indomethacin', 357.79, 3.93, -6.998, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/a:1015824100788'),
  ('huskindb_2020', 'Isonicotinic acid', 123.11, 0.78, -4.617, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600800114'),
  ('huskindb_2020', 'Isoquinoline', 129.16, 2.23, -1.776, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(87)90210-9'),
  ('huskindb_2020', 'Ketoprofen', 254.28, 3.11, -2.903, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.10312'),
  ('huskindb_2020', 'Ketoprofen glucoside', 416.43, 0.36, -4.175, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.ijpharm.2005.05.030'),
  ('huskindb_2020', 'Ketoprofen mannoside', 416.43, 0.36, -4.038, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.ijpharm.2005.05.030'),
  ('huskindb_2020', 'Ketorolac', 255.27, 2.29, -2.243, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600841010'),
  ('huskindb_2020', 'L-alanyl-L-tryptophan', 275.31, 0.63, -4.952, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/bip.21520'),
  ('huskindb_2020', 'Levosimendan', 280.29, 1.36, -3.663, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0928-0987(00)00120-2'),
  ('huskindb_2020', 'Lidocaine', 234.34, 2.58, -2.462, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(91)90387-4'),
  ('huskindb_2020', 'Lindane', 290.83, 3.64, -3.942, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1177/096032719701601104'),
  ('huskindb_2020', 'Linolenic acid', 278.44, 5.66, -2.432, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.yrtph.2010.02.008'),
  ('huskindb_2020', 'Lysine', 146.19, -0.47, -3.538, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(93)90321-6'),
  ('huskindb_2020', 'Malathion', 330.36, 2.12, -0.693, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0278-6915(96)00030-0'),
  ('huskindb_2020', 'Meperidine', 247.34, 2.21, -2.432, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/A:1015944018555'),
  ('huskindb_2020', 'Methanol', 32.04, -0.39, -1.983, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(84)90145-5'),
  ('huskindb_2020', 'Methotrexate', 454.45, 0.27, -3.284, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(85)90106-1'),
  ('huskindb_2020', 'Methyl 4-hydroxybenzoate', 152.15, 1.18, -2.058, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.20773'),
  ('huskindb_2020', 'Methyl 4-hydroxyphenylacetate', 166.18, 1.11, -1.699, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12277592'),
  ('huskindb_2020', 'Methyl nicotinate', 137.14, 0.87, -2.45, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600800114'),
  ('huskindb_2020', 'Methyl p-aminobenzoate', 151.16, 1.06, -1.547, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600821217'),
  ('huskindb_2020', 'Methyl salicylate', 152.15, 1.18, -1.444, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-009-9912-4'),
  ('huskindb_2020', 'Methyltriglycol nicotinate', 269.3, 0.92, -3.752, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600800114'),
  ('huskindb_2020', 'Metoprolol', 267.37, 1.61, -3.081, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(99)00380-4'),
  ('huskindb_2020', 'Morphine', 285.34, 1.2, -5.414, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600831215'),
  ('huskindb_2020', 'N,N-Diethyl-m-toluamide', 191.27, 2.48, -3.877, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0168-3659(00)00210-8'),
  ('huskindb_2020', 'N4-hexanoyl-4-amino-1-[(2R,3S,4R,5R)-3,4-dihydroxy-5 (hydroxymethyl)oxolan-2-yl] pyrimidin-2-one', 341.36, -0.63, -2.181, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1211/jpp.62.06.0012'),
  ('huskindb_2020', 'Naphthol', 144.17, 2.55, -1.585, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/A:1007547809430'),
  ('huskindb_2020', 'Naproxen', 230.26, 3.04, -3.101, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(98)00113-6'),
  ('huskindb_2020', 'Naproxen glucoside', 392.4, 0.29, -4.33, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.ijpharm.2005.05.030'),
  ('huskindb_2020', 'Naproxen mannoside', 392.4, 0.29, -4.144, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.ijpharm.2005.05.030'),
  ('huskindb_2020', 'Nicorandil', 211.18, 0.02, -3.575, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600800203'),
  ('huskindb_2020', 'Nicotine', 162.24, 1.85, -1.99, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(87)90210-9'),
  ('huskindb_2020', 'Nimesulide', 308.32, 2.76, -2.995, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.10312'),
  ('huskindb_2020', 'Nizatidine', 331.47, 1.32, -4.425, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.10312'),
  ('huskindb_2020', 'Nortriptyline hydrocloride', 299.84, 4.25, -3.645, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.ejpb.2007.11.012'),
  ('huskindb_2020', 'Octylparaben', 250.34, 3.91, -2.032, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.yrtph.2010.02.008'),
  ('huskindb_2020', 'Oxprenolol', 265.35, 1.99, -2.813, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(99)00380-4'),
  ('huskindb_2020', 'Paraquat', 186.26, 1.0, -5.061, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12475447'),
  ('huskindb_2020', 'Parathion', 291.27, 3.27, -3.724, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2000.9028'),
  ('huskindb_2020', 'Phenobarbital', 232.24, 0.7, -3.344, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(87)90210-9'),
  ('huskindb_2020', 'Phenol', 94.11, 1.39, -2.044, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0928-0987(02)00085-4'),
  ('huskindb_2020', 'Phloroglucinol', 126.11, 0.8, -2.51, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0928-0987(02)00085-4'),
  ('huskindb_2020', 'Prednisolone', 360.45, 1.56, -4.35, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/bf01061455'),
  ('huskindb_2020', 'Pregnenolone', 316.49, 4.52, -2.824, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1038/jid.1969.9'),
  ('huskindb_2020', 'Progesterone', 314.47, 4.72, -1.792, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600840607'),
  ('huskindb_2020', 'Propoxur', 209.24, 2.19, -2.339, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s00420-005-0056-5'),
  ('huskindb_2020', 'Propranolol', 259.35, 2.58, -2.75, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(99)00380-4'),
  ('huskindb_2020', 'Propranolol-HCl', 295.81, 3.0, -7.88, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/a:1015824100788'),
  ('huskindb_2020', 'Propylparaben', 180.2, 1.96, -1.854, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.yrtph.2010.02.008'),
  ('huskindb_2020', 'Pyrogallol', 126.11, 0.8, -2.81, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0928-0987(02)00085-4'),
  ('huskindb_2020', 'Ranitidine', 314.41, 1.46, -4.052, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.10312'),
  ('huskindb_2020', 'Resorcinol', 110.11, 1.1, -3.345, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0928-0987(02)00085-4'),
  ('huskindb_2020', 'Salicylic acid', 138.12, 1.09, -2.432, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0378-5173(87)90210-9'),
  ('huskindb_2020', 'Scopolamine', 303.36, 0.92, -4.985, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/aic.690210522'),
  ('huskindb_2020', 'Sufentanil', 386.56, 4.21, -1.818, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1023/A:1015912932416'),
  ('huskindb_2020', 'Terbinafine', 291.44, 4.88, -6.0, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0378-5173(00)00665-7'),
  ('huskindb_2020', 'Testosterone', 288.43, 3.88, -2.222, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600840607'),
  ('huskindb_2020', 'Thymol', 150.22, 2.82, -1.278, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-009-9912-4'),
  ('huskindb_2020', 'Toluene', 92.14, 2.0, -0.081, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12277592'),
  ('huskindb_2020', 'Triamcinolone', 394.44, 0.62, -5.4, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/bf01061455'),
  ('huskindb_2020', 'Triamcinolone acetonide', 434.5, 2.42, -4.695, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/bf01061455'),
  ('huskindb_2020', 'Trichloroacetic acid', 163.39, 1.44, -2.722, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1006/taap.2002.9494'),
  ('huskindb_2020', 'Trichloroacetonitrile', 144.39, 1.88, -1.048, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jat.1657'),
  ('huskindb_2020', 'Triclosan', 289.54, 5.14, -0.713, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/S0278-6915(99)00164-7'),
  ('huskindb_2020', 'Triglycol nicotinate', 255.27, 0.26, -5.005, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600800114'),
  ('huskindb_2020', 'Trimethylamine', 59.11, 0.18, -3.728, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/j.fct.2004.05.007'),
  ('huskindb_2020', 'Urea', 60.06, -0.98, -2.017, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1016/0272-0590(92)90086-W'),
  ('huskindb_2020', 'Water', 18.02, -0.82, -2.882, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600650210'),
  ('huskindb_2020', 'm-Cresol', 108.14, 1.7, -1.817, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/j.2042-7158.1977.tb11434.x'),
  ('huskindb_2020', 'm-Nitrophenol', 139.11, 1.3, -2.249, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/j.2042-7158.1977.tb11434.x'),
  ('huskindb_2020', 'n-Hexyl nicotinate', 207.27, 2.82, -1.747, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1002/jps.2600800114'),
  ('huskindb_2020', 'o-Chlorophenol', 128.56, 2.05, -1.481, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/j.2042-7158.1977.tb11434.x'),
  ('huskindb_2020', 'o-Cresol', 108.14, 1.7, -1.804, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/j.2042-7158.1977.tb11434.x'),
  ('huskindb_2020', 'o-Cresyl glycidyl ether', 164.2, 1.77, -4.032, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1080/004982500237488'),
  ('huskindb_2020', 'o-Phenylenediamine', 108.14, 0.85, -3.347, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12263302'),
  ('huskindb_2020', 'o-t-Butylphenol', 150.22, 2.69, -1.129, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-009-9912-4'),
  ('huskindb_2020', 'p-Bromophenol', 173.01, 2.15, -1.443, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/j.2042-7158.1977.tb11434.x'),
  ('huskindb_2020', 'p-Chlorophenol', 128.56, 2.05, -1.44, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/j.2042-7158.1977.tb11434.x'),
  ('huskindb_2020', 'p-Cresol', 108.14, 1.7, -1.339, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12277592'),
  ('huskindb_2020', 'p-Ethylphenol', 122.17, 1.95, -1.458, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/j.2042-7158.1977.tb11434.x'),
  ('huskindb_2020', 'p-Nitrophenol', 139.11, 1.3, -2.254, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/j.2042-7158.1977.tb11434.x'),
  ('huskindb_2020', 'p-Phenylenediamine', 108.14, 0.85, -3.62, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1111/1523-1747.ep12263302'),
  ('huskindb_2020', 'p-n-Butylphenol', 150.22, 2.73, -1.115, 'HuskinDB (doi:10.1038/s41597-020-00764-z) · medición: 10.1007/s11095-009-9912-4')
on conflict (dataset, compound_name) do nothing;

-- ═════════════════════════════════════════════════════════════════════════════
--  Verificacion: si estas cuatro filas salen como se indica, la migracion fue bien.
-- ═════════════════════════════════════════════════════════════════════════════
select 'ingredientes'  as tabla, count(*) as filas, 12  as esperado from public.ingredients
union all
select 'vehiculos',           count(*), 6           from public.vehicles
union all
select 'modelos de piel',     count(*), 6           from public.skin_models
union all
select 'validacion (medida)', count(*), 229         from public.validation_records;
