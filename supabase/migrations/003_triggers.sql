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
