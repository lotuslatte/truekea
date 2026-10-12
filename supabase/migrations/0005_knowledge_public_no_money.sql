-- Truekea 0005: trueque puro (sin dinero visible), publicaciones de conocimiento,
-- y lectura anónima para visitantes sin cuenta.

-- 1. Tipo de publicación: objeto físico o conocimiento/servicio (clase, taller…)
create type public.item_kind as enum ('object', 'knowledge');
alter table public.items add column kind public.item_kind not null default 'object';
create index items_kind_idx on public.items (kind, status);

-- 2. El valor estimado deja de ser obligatorio (la UI ya no lo pide ni muestra;
--    la columna queda por si se reintroduce internamente).
alter table public.items drop constraint if exists items_check;
alter table public.items drop constraint if exists items_check1;

-- 3. Lectura anónima: el feed y los detalles son públicos; actuar requiere cuenta.
create policy items_select_anon on public.items for select to anon using (status = 'available');
create policy item_photos_select_anon on public.item_photos for select to anon using (
  exists (select 1 from public.items i where i.id = item_id)
);
create policy categories_select_anon on public.categories for select to anon using (true);
create policy profiles_select_anon on public.profiles for select to anon using (true);
create policy feature_flags_select_anon on public.feature_flags for select to anon using (true);

-- 4. feed_items v2: soporta visitantes (auth.uid() null), filtro por kind,
--    y devuelve kind. Cambia el tipo de retorno → drop + create.
drop function if exists public.feed_items(
  double precision, double precision, integer, smallint, numeric, numeric, text, boolean, timestamptz, integer
);

create or replace function public.feed_items(
  p_lat double precision,
  p_lng double precision,
  p_radius_km integer default 10,
  p_category smallint default null,
  p_search text default null,
  p_donations_only boolean default false,
  p_kind public.item_kind default null,
  p_before timestamptz default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  title text,
  is_donation boolean,
  kind public.item_kind,
  district text,
  distance_km numeric,
  created_at timestamptz,
  category_id smallint,
  photo_path text,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_avatar_url text,
  owner_rating_avg numeric,
  owner_rating_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id, i.title, i.is_donation, i.kind, i.district,
    round((st_distance(i.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 1),
    i.created_at, i.category_id,
    (select ph.storage_path from public.item_photos ph where ph.item_id = i.id order by ph.position limit 1),
    p.id, p.username, p.display_name, p.avatar_url, p.rating_avg, p.rating_count
  from public.items i
  join public.profiles p on p.id = i.owner_id
  where i.status = 'available'
    and (auth.uid() is null or (
      i.owner_id <> auth.uid()
      and not public.is_blocked_either(i.owner_id, auth.uid())
    ))
    and st_dwithin(i.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, least(p_radius_km, 50) * 1000)
    and (p_category is null or i.category_id = p_category)
    and (not p_donations_only or i.is_donation)
    and (p_kind is null or i.kind = p_kind)
    and (p_search is null or p_search = ''
      or i.search @@ websearch_to_tsquery('spanish', public.immutable_unaccent(p_search)))
    and (p_before is null or i.created_at < p_before)
  order by i.created_at desc
  limit least(coalesce(p_limit, 20), 50)
$$;

grant execute on function public.feed_items to anon, authenticated;
