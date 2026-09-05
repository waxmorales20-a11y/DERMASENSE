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
