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


-- =========================================================
-- PREPIZZAS (agregado el 30/10/2026)
-- Movimientos cargados a mano para llevar la cuenta de prepizzas:
-- producción, venta (con precio) y pérdida. Sólo con usuario.
-- =========================================================

create table if not exists public.prepizzas_movimientos (
  id              uuid primary key default gen_random_uuid(),
  fecha           date not null default current_date,
  tipo            text not null check (tipo in ('produccion', 'venta', 'perdida')),
  cantidad        int  not null check (cantidad > 0),
  precio_unitario numeric(12, 2) check (precio_unitario >= 0),   -- sólo en ventas, en pesos
  canal           text,
  nota            text,
  creado_el       timestamptz not null default now(),
  creado_por      uuid default auth.uid()
);

create index if not exists prepizzas_fecha_idx on public.prepizzas_movimientos (fecha);

alter table public.prepizzas_movimientos enable row level security;

drop policy if exists "Equipo Penitentia" on public.prepizzas_movimientos;
create policy "Equipo Penitentia" on public.prepizzas_movimientos
  for all to authenticated
  using (true) with check (true);

revoke all on public.prepizzas_movimientos from anon;


-- =========================================================
-- COSTOS (agregado el 30/10/2026)
-- El libro de costos (las pestañas del Excel «Costos Penitentia»,
-- con sus fórmulas) guardado como un solo documento. Sólo con usuario:
-- los costos y márgenes nunca quedan públicos.
-- =========================================================

create table if not exists public.costos_libro (
  id              text primary key default 'principal',
  datos           jsonb not null,
  actualizado_el  timestamptz not null default now(),
  actualizado_por uuid default auth.uid()
);

alter table public.costos_libro enable row level security;

drop policy if exists "Equipo Penitentia" on public.costos_libro;
create policy "Equipo Penitentia" on public.costos_libro
  for all to authenticated
  using (true) with check (true);

revoke all on public.costos_libro from anon;


-- =========================================================
-- CATÁLOGO WEB (agregado el 02/11/2026)
-- Lo que muestra el catálogo público de penitentia.com.ar.
-- Se maneja desde Acceso equipo → Catálogo:
--   - el precio lo pone Costos solo (Precios y Rentabilidad, cuadro 2,
--     redondeado a $100) cada vez que se guarda ahí;
--   - una receta nueva en Costos aparece acá oculta, hasta que se tilda
--     «Mostrar en la web».
-- El público SÓLO puede leer las filas tildadas, y sólo las columnas
-- que ya se ven en la web. Costos, márgenes y recetas siguen privados.
-- =========================================================

create table if not exists public.catalogo (
  id             text primary key,                    -- muzzarella, agridulce...
  receta         text unique,                         -- nombre de la receta en Costos (vacío = sin vincular)
  nombre         text not null,                       -- como se ve en la web y en el pedido
  descripcion    text not null default '',
  precio         int check (precio > 0),              -- lo pone Costos; vacío = «Consultá el precio»
  foto           text not null default '',            -- img/p-x-800.webp o la dirección de una foto subida
  mostrar        boolean not null default false,      -- «Mostrar en la web»
  disponible     boolean not null default true,       -- false = «Sin stock»
  orden          int not null default 0,
  actualizado_el timestamptz not null default now()
);

alter table public.catalogo enable row level security;

drop policy if exists "Equipo Penitentia" on public.catalogo;
create policy "Equipo Penitentia" on public.catalogo
  for all to authenticated
  using (true) with check (true);

drop policy if exists "Publico ve lo publicado" on public.catalogo;
create policy "Publico ve lo publicado" on public.catalogo
  for select to anon
  using (mostrar);

-- Sin usuario: sólo leer, y sólo estas columnas
revoke all on public.catalogo from anon;
grant select (id, nombre, descripcion, precio, foto, disponible, orden) on public.catalogo to anon;

-- Las 7 variedades que había en la web (js/productos.js) el 02/11/2026
insert into public.catalogo (id, receta, nombre, descripcion, precio, foto, mostrar, disponible, orden) values
  ('muzzarella',        'Muzzarella',                            'Muzzarella',        'Salsa de tomate, mozzarella, aceite de oliva y orégano.',                     8000,  'img/p-muzzarella-800.webp', true, true, 1),
  ('fugazza-con-queso', 'Fugazza con queso',                     'Fugazza con queso', 'Salsa de tomate, mozzarella y cebolla.',                                      8800,  'img/p-fugazza-800.webp',    true, true, 2),
  ('provolone',         'Provolone',                             'Provolone',         'Salsa de tomate, mozzarella y provolone.',                                    10500, '',                          true, true, 3),
  ('jamon-y-morron',    'Jamón y morrón',                        'Jamón y morrón',    'Salsa de tomate, mozzarella, jamón cocido y morrón.',                         13000, 'img/p-jamon-800.webp',      true, true, 4),
  ('agridulce',         'Agridulce de peras, miel y queso azul', 'Agridulce',         'Salsa de tomate, mozzarella, peras, miel levemente picante y queso azul.',    10900, 'img/p-agridulce-800.webp',  true, true, 5),
  ('tropical',          'Tropical',                              'Tropical',          'Salsa de tomate, mozzarella, ananá y jamón cocido.',                          13300, 'img/p-tropical-800.webp',   true, true, 6),
  ('americana',         'Americana',                             'Americana',         'Salsa de tomate, mozzarella, salchicha alemana y panceta.',                   14200, 'img/p-americana-800.webp',  true, true, 7)
on conflict (id) do nothing;

-- Fotos subidas desde el catálogo: se ven públicas (las usa la web), sólo el equipo sube o borra
insert into storage.buckets (id, name, public) values ('catalogo', 'catalogo', true)
on conflict (id) do update set public = true;

drop policy if exists "Equipo ve fotos del catalogo" on storage.objects;
create policy "Equipo ve fotos del catalogo" on storage.objects
  for select to authenticated using (bucket_id = 'catalogo');

drop policy if exists "Equipo sube fotos del catalogo" on storage.objects;
create policy "Equipo sube fotos del catalogo" on storage.objects
  for insert to authenticated with check (bucket_id = 'catalogo');

drop policy if exists "Equipo cambia fotos del catalogo" on storage.objects;
create policy "Equipo cambia fotos del catalogo" on storage.objects
  for update to authenticated using (bucket_id = 'catalogo');

drop policy if exists "Equipo borra fotos del catalogo" on storage.objects;
create policy "Equipo borra fotos del catalogo" on storage.objects
  for delete to authenticated using (bucket_id = 'catalogo');


-- =========================================================
-- PRECIO DE VENTA Y REVISIÓN (agregado el 03/11/2026)
-- - precio_venta: al marcar una pizza vendida se guarda el precio que
--   tenía publicado en la web en ese momento.
-- - estado «revision»: pizzas con la etiqueta dudosa (por ejemplo, si se
--   mezclaron), apartadas hasta revisarlas.
-- =========================================================

alter table public.pizzas add column if not exists precio_venta int check (precio_venta > 0);

alter table public.pizzas drop constraint if exists pizzas_estado_check;
alter table public.pizzas add constraint pizzas_estado_check
  check (estado in ('stock', 'vendida', 'baja', 'revision'));
