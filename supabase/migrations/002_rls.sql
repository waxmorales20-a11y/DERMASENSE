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
