-- =========================================================
-- PENITENTIA · Stock y lotes
-- Pegá todo esto en Supabase → SQL Editor → New query → Run.
-- Crea la tabla de pizzas y la deja visible SÓLO para usuarios
-- que entraron con usuario y contraseña.
-- =========================================================

create table if not exists public.pizzas (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,                 -- 261028-AG-1
  variedad    text not null,                        -- agridulce, mozzarella...
  fecha_lote  date not null,
  numero      int  not null,                        -- el 1 de 261028-AG-1
  vencimiento date not null,                        -- fecha_lote + 3 meses
  peso        int,                                  -- contenido neto en gramos
  estado      text not null default 'stock' check (estado in ('stock', 'vendida', 'baja')),
  vendida_el  timestamptz,
  canal       text,
  nota        text,
  creada_el   timestamptz not null default now(),
  creada_por  uuid default auth.uid()
);

create index if not exists pizzas_estado_idx on public.pizzas (estado, vencimiento);

alter table public.pizzas enable row level security;

drop policy if exists "Equipo Penitentia" on public.pizzas;
create policy "Equipo Penitentia" on public.pizzas
  for all to authenticated
  using (true) with check (true);

-- Nadie sin usuario puede leer ni escribir
revoke all on public.pizzas from anon;


-- =========================================================
-- CÓDIGOS ELIMINADOS (agregado el 28/10/2026)
-- Cuando se elimina una pizza, su código queda anotado acá y la
-- base no deja volver a crearlo. Así nunca hay dos etiquetas
-- impresas con el mismo código.
-- =========================================================

create table if not exists public.codigos_eliminados (
  codigo        text primary key,
  eliminado_el  timestamptz not null default now(),
  eliminado_por uuid default auth.uid()
);

alter table public.codigos_eliminados enable row level security;

drop policy if exists "Equipo Penitentia lee" on public.codigos_eliminados;
create policy "Equipo Penitentia lee" on public.codigos_eliminados
  for select to authenticated using (true);

revoke all on public.codigos_eliminados from anon;

-- Al borrar una pizza, anotar su código
create or replace function public.anotar_codigo_eliminado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.codigos_eliminados (codigo) values (old.codigo) on conflict do nothing;
  return old;
end $$;

drop trigger if exists pizzas_anotar_codigo on public.pizzas;
create trigger pizzas_anotar_codigo
  after delete on public.pizzas
  for each row execute function public.anotar_codigo_eliminado();

-- Al crear una pizza, rechazar un código que ya se usó y se eliminó
create or replace function public.rechazar_codigo_eliminado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.codigos_eliminados where codigo = new.codigo) then
    raise exception 'El código % ya se usó y se eliminó', new.codigo using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists pizzas_rechazar_codigo on public.pizzas;
create trigger pizzas_rechazar_codigo
  before insert on public.pizzas
  for each row execute function public.rechazar_codigo_eliminado();
