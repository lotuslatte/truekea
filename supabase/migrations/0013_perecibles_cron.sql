-- Truekea 0013: regalos perecibles (comida que se rescata antes de botarse)
-- + mantenimiento programado con pg_cron.

-- 1. Hora límite de recojo: solo para regalos (comida recién hecha, cosecha…)
alter table public.items add column pickup_until timestamptz;
alter table public.items add constraint items_perishable_donation check (
  pickup_until is null or is_donation
);

-- 2. feed_items v5: los perecibles vigentes suben con urgencia; los vencidos
--    desaparecen del feed. Devuelve pickup_until para el badge.
drop function if exists public.feed_items(
  double precision, double precision, integer, smallint, text, boolean,
  public.item_kind, public.knowledge_format, public.knowledge_modality,
  public.item_condition, integer, integer
);

create or replace function public.feed_items(
  p_lat double precision,
  p_lng double precision,
  p_radius_km integer default 10,
  p_category smallint default null,
  p_search text default null,
  p_donations_only boolean default false,
  p_kind public.item_kind default null,
  p_format public.knowledge_format default null,
  p_modality public.knowledge_modality default null,
  p_condition public.item_condition default null,
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id uuid,
  title text,
  is_donation boolean,
  kind public.item_kind,
  format public.knowledge_format,
  modality public.knowledge_modality,
  condition public.item_condition,
  event_at timestamptz,
  capacity smallint,
  accepted_count integer,
  pickup_until timestamptz,
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
    i.id, i.title, i.is_donation, i.kind, i.format, i.modality, i.condition,
    i.event_at, i.capacity,
    (select count(*)::integer from public.circle_members m
      where m.item_id = i.id and m.status in ('accepted', 'checked_in')),
    i.pickup_until,
    i.district,
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
    and (
      i.modality = 'virtual'
      or st_dwithin(i.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, least(p_radius_km, 50) * 1000)
    )
    and (i.format is distinct from 'circle' or i.event_at > now())
    and (i.pickup_until is null or i.pickup_until > now())
    and (p_category is null or i.category_id = p_category)
    and (not p_donations_only or i.is_donation)
    and (p_kind is null or i.kind = p_kind)
    and (p_format is null or i.format = p_format)
    and (p_modality is null or i.modality = p_modality)
    and (p_condition is null or i.condition = p_condition)
    and (p_search is null or p_search = ''
      or i.search @@ websearch_to_tsquery('spanish', public.immutable_unaccent(p_search)))
  order by
    (extract(epoch from (now() - i.created_at)) / 3600.0) * 0.02
    + case
        when i.modality = 'virtual' then 1.2
        else least(st_distance(i.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000.0, 50) * 0.4
      end
    - case when i.format = 'circle' and i.event_at < now() + interval '3 days' then 0.8 else 0 end
    - case when i.pickup_until is not null then 2.0 else 0 end
    asc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(coalesce(p_limit, 20), 50)
$$;

grant execute on function public.feed_items to anon, authenticated;

-- 3. Mantenimiento diario: retirar perecibles vencidos y ofertas de 30 días.
create or replace function public.expire_perishables()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.items set status = 'removed'
    where status = 'available' and pickup_until is not null and pickup_until < now() - interval '6 hours'
    returning 1
  )
  select count(*)::integer from expired
$$;

create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('truekea-expire-offers');
exception when others then null;
end;
$$;
do $$
begin
  perform cron.unschedule('truekea-expire-perishables');
exception when others then null;
end;
$$;

select cron.schedule('truekea-expire-offers', '0 8 * * *', 'select public.expire_stale_offers()');
select cron.schedule('truekea-expire-perishables', '0 * * * *', 'select public.expire_perishables()');
