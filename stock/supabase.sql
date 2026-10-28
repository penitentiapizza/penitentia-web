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
