# Esquema de Backend — DERMASENSE

Backend: **Supabase** (PostgreSQL 15 + GoTrue Auth + PostgREST).
Toda la autorización se apoya en **Row Level Security**, no en la lógica de aplicación.

---

## 1. Diagrama entidad-relación

```mermaid
erDiagram
    auth_users ||--|| profiles : "1:1"
    profiles ||--o{ simulations : "crea"
    ingredients ||--o{ simulations : "referenciado"
    vehicles ||--o{ simulations : "referenciado"
    simulations ||--o| ai_reports : "genera"

    profiles {
        uuid id PK_FK
        text email
        text full_name
        text organization
        text role
        timestamptz created_at
    }
    ingredients {
        uuid id PK
        text name
        text inci_name
        numeric molecular_weight
        numeric log_p
        numeric pka
        text category
        text[] risk_flags
        numeric reference_threshold
        text source
    }
    vehicles {
        uuid id PK
        text name
        numeric enhancer_factor
        text description
    }
    simulations {
        uuid id PK
        uuid user_id FK
        uuid ingredient_id FK
        uuid vehicle_id FK
        text title
        numeric concentration_pct
        numeric ph
        numeric duration_hours
        numeric applied_dose_mg_cm2
        jsonb input_snapshot
        jsonb metrics
        text engine_version
        timestamptz created_at
    }
    ai_reports {
        uuid id PK
        uuid simulation_id FK_UK
        text content
        text model
        int input_tokens
        int output_tokens
        timestamptz created_at
    }
```

---

## 2. DDL

```sql
-- ─────────────────────────────────────────────────────────────
-- 001_init.sql
-- ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- Perfiles: extiende auth.users
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  organization text,
  role         text not null default 'formulator'
               check (role in ('formulator','researcher','student','admin')),
  created_at   timestamptz not null default now()
);

-- Catálogo de ingredientes activos (lectura pública)
create table public.ingredients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  inci_name           text,
  molecular_weight    numeric(8,2) not null check (molecular_weight > 0),
  log_p               numeric(5,2) not null,
  pka                 numeric(5,2),
  category            text not null,
  risk_flags          text[] not null default '{}',
  reference_threshold numeric(10,4),   -- umbral de exposición para el índice heurístico
  source              text,            -- procedencia del dato fisicoquímico
  created_at          timestamptz not null default now()
);

-- Catálogo de vehículos
create table public.vehicles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  enhancer_factor numeric(4,2) not null default 1.00
                  check (enhancer_factor between 0.10 and 5.00),
  description     text,
  created_at      timestamptz not null default now()
);

-- Simulaciones del usuario
create table public.simulations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  ingredient_id       uuid references public.ingredients(id) on delete set null,
  vehicle_id          uuid references public.vehicles(id) on delete set null,
  title               text not null default 'Simulación sin título',
  concentration_pct   numeric(6,3) not null check (concentration_pct > 0 and concentration_pct <= 30),
  ph                  numeric(4,2)  not null check (ph between 3.0 and 9.0),
  duration_hours      numeric(6,2)  not null check (duration_hours between 1 and 48),
  applied_dose_mg_cm2 numeric(6,3)  not null default 2.0 check (applied_dose_mg_cm2 > 0),
  -- Snapshot inmutable del input: los catálogos pueden cambiar,
  -- una simulación guardada debe seguir siendo reproducible.
  input_snapshot      jsonb not null,
  metrics             jsonb not null,
  engine_version      text  not null,
  notes               text,
  created_at          timestamptz not null default now()
);

-- Reportes generados por IA (1:1 con la simulación)
create table public.ai_reports (
  id            uuid primary key default gen_random_uuid(),
  simulation_id uuid not null unique references public.simulations(id) on delete cascade,
  content       text not null,
  model         text not null,
  input_tokens  integer,
  output_tokens integer,
  created_at    timestamptz not null default now()
);

-- Índices
create index simulations_user_created_idx
  on public.simulations (user_id, created_at desc);
create index simulations_ingredient_idx
  on public.simulations (ingredient_id);
create index simulations_metrics_gin
  on public.simulations using gin (metrics jsonb_path_ops);
create index ingredients_name_trgm_idx
  on public.ingredients using gin (name gin_trgm_ops);
```

> `input_snapshot` es deliberadamente redundante con las columnas escalares. Las columnas
> permiten filtrar e indexar; el snapshot garantiza que una simulación de hace seis meses
> siga siendo reproducible aunque el catálogo haya sido actualizado. Reproducibilidad es
> una promesa del producto, no un detalle técnico.

---

## 3. Row Level Security

```sql
-- ─────────────────────────────────────────────────────────────
-- 002_rls.sql
-- ─────────────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.simulations enable row level security;
alter table public.ai_reports  enable row level security;
alter table public.ingredients enable row level security;
alter table public.vehicles    enable row level security;

-- Perfiles: cada usuario ve y edita solo el suyo
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Catálogos: lectura para cualquier usuario autenticado, escritura solo por service_role
create policy "ingredients_read" on public.ingredients
  for select to authenticated using (true);
create policy "vehicles_read" on public.vehicles
  for select to authenticated using (true);

-- Simulaciones: aislamiento total por usuario
create policy "simulations_select_own" on public.simulations
  for select using (auth.uid() = user_id);
create policy "simulations_insert_own" on public.simulations
  for insert with check (auth.uid() = user_id);
create policy "simulations_update_own" on public.simulations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "simulations_delete_own" on public.simulations
  for delete using (auth.uid() = user_id);

-- Reportes: accesibles solo a través de la simulación propia
create policy "ai_reports_select_own" on public.ai_reports
  for select using (
    exists (select 1 from public.simulations s
            where s.id = ai_reports.simulation_id and s.user_id = auth.uid())
  );
create policy "ai_reports_insert_own" on public.ai_reports
  for insert with check (
    exists (select 1 from public.simulations s
            where s.id = ai_reports.simulation_id and s.user_id = auth.uid())
  );
```

**Nota de seguridad:** sin políticas explícitas, `enable row level security` deniega todo
por defecto. Ese es el comportamiento deseado: se abre solo lo estrictamente necesario.

---

## 4. Triggers

```sql
-- ─────────────────────────────────────────────────────────────
-- 003_triggers.sql
-- ─────────────────────────────────────────────────────────────

-- Crear el perfil automáticamente al registrarse
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
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

---

## 5. Datos semilla (extracto)

```sql
-- ─────────────────────────────────────────────────────────────
-- 004_seed.sql — valores fisicoquímicos de referencia bibliográfica
-- ─────────────────────────────────────────────────────────────
insert into public.ingredients
  (name, inci_name, molecular_weight, log_p, pka, category, risk_flags, source) values
  ('Ácido salicílico',   'Salicylic Acid',      138.12,  2.26, 2.97, 'BHA',        '{bha}',            'PubChem CID 338'),
  ('Ácido glicólico',    'Glycolic Acid',        76.05, -1.11, 3.83, 'AHA',        '{aha}',            'PubChem CID 757'),
  ('Ácido láctico',      'Lactic Acid',          90.08, -0.72, 3.86, 'AHA',        '{aha}',            'PubChem CID 612'),
  ('Retinol',            'Retinol',             286.45,  5.68, null, 'Retinoide',  '{retinoid}',       'PubChem CID 445354'),
  ('Retinaldehído',      'Retinal',             284.44,  6.31, null, 'Retinoide',  '{retinoid}',       'PubChem CID 638015'),
  ('Niacinamida',        'Niacinamide',         122.12, -0.37, 3.35, 'Vitamina',   '{}',               'PubChem CID 936'),
  ('Ácido ascórbico',    'Ascorbic Acid',       176.12, -1.85, 4.10, 'Antioxidante','{}',              'PubChem CID 54670067'),
  ('Ácido ferúlico',     'Ferulic Acid',        194.18,  1.51, 4.58, 'Antioxidante','{}',              'PubChem CID 445858'),
  ('Cafeína',            'Caffeine',            194.19, -0.07, 10.4, 'Estimulante','{}',               'PubChem CID 2519'),
  ('Ácido hialurónico',  'Sodium Hyaluronate', 5000.00, -4.50, null, 'Humectante', '{}',               'Polímero de alto MW'),
  ('Ácido kójico',       'Kojic Acid',          142.11, -0.64, 7.90, 'Despigmentante','{}',            'PubChem CID 3840'),
  ('Alfa-bisabolol',     'Bisabolol',           222.37,  4.75, null, 'Calmante',   '{essential_oil}',  'PubChem CID 10586');

insert into public.vehicles (name, enhancer_factor, description) values
  ('Solución acuosa',    1.00, 'Referencia neutra'),
  ('Gel hidroalcohólico',1.60, 'Etanol como potenciador de penetración'),
  ('Emulsión O/W',       1.15, 'Crema convencional'),
  ('Emulsión W/O',       0.85, 'Fase externa oleosa, libera más lento'),
  ('Base anhidra',       0.70, 'Ungüento oleoso, oclusivo'),
  ('Propilenglicol 30%', 1.85, 'Potenciador de penetración marcado');
```

> El ácido hialurónico (MW 5000) se incluye **a propósito**: es el caso que dispara
> `confidence: 'low'` por exceder los 500 Da. Sirve para demostrar en vivo que el sistema
> reconoce sus propios límites en lugar de inventar un resultado.

---

## 6. Consultas frecuentes

```sql
-- Historial del usuario con ingrediente y estado del reporte
select s.id, s.title, s.created_at, s.concentration_pct,
       i.name as ingredient,
       (s.metrics->>'irritationIndex')::numeric as irritation,
       (s.metrics->>'absorbedFractionPct')::numeric as absorbed,
       (r.id is not null) as has_report
from   public.simulations s
left   join public.ingredients i on i.id = s.ingredient_id
left   join public.ai_reports  r on r.simulation_id = s.id
where  s.user_id = auth.uid()
order  by s.created_at desc
limit  50;

-- Comparación de dos simulaciones
select s.id, s.title, s.metrics
from   public.simulations s
where  s.id = any($1::uuid[]) and s.user_id = auth.uid();

-- Cuota de reportes de IA en las últimas 24 h (rate limiting)
select count(*)
from   public.ai_reports r
join   public.simulations s on s.id = r.simulation_id
where  s.user_id = auth.uid()
  and  r.created_at > now() - interval '24 hours';
```

---

## 7. Estructura de `metrics` (jsonb)

```json
{
  "logKp": -2.41,
  "permeabilityCmH": 0.0039,
  "maxFluxInfiniteDose": 230.7,
  "lagTimeHours": 1.36,
  "absorbedFractionPct": 96.98,
  "timeTo50PctHours": 5.61,
  "penetrationDepthUm": 310,
  "peakConcentrationVE": 86.2,
  "irritationIndex": 34,
  "irritationBand": "moderate",
  "confidence": "high",
  "outOfDomainReasons": []
}
```

Validado con Zod en el servidor antes de insertar; PostgreSQL no impone la forma del JSONB.

---

## 8. Migraciones

```
supabase/migrations/
├── 001_init.sql
├── 002_rls.sql
├── 003_triggers.sql
└── 004_seed.sql
```

Aplicación: `supabase db push` (o el editor SQL del panel durante la hackathon).
Ningún script de migración contiene credenciales.
