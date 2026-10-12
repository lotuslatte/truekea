-- Truekea 0010 (Ola 1): guardados, fotos en el chat, alertas de wishlist
-- y orden inteligente del feed.

-- ---------------------------------------------------------------------------
-- 1. Guardados ❤️
-- ---------------------------------------------------------------------------
create table public.saved_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.saved_items enable row level security;
create policy saved_items_all on public.saved_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Fotos en el chat
-- ---------------------------------------------------------------------------
alter table public.messages alter column body drop not null;
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add column image_path text;
alter table public.messages add constraint messages_content check (
  (body is not null and char_length(body) between 1 and 2000) or image_path is not null
);

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

create policy storage_chat_read on storage.objects for select using (bucket_id = 'chat-images');
create policy storage_chat_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- 3. Alertas de wishlist: trigger puro en Postgres — el push sale por el
--    webhook de notifications (send-push) que ya maneja 'wishlist_match'.
-- ---------------------------------------------------------------------------
create or replace function public.match_wishlists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled boolean;
  v_wish record;
begin
  select enabled into v_enabled from public.feature_flags where key = 'wishlist_alerts';
  if not coalesce(v_enabled, false) then return new; end if;
  if new.status <> 'available' then return new; end if;

  for v_wish in (
    select w.user_id
    from public.wishlists w
    join public.profiles p on p.id = w.user_id
    where w.is_active
      and w.user_id <> new.owner_id
      and (w.category_id is null or w.category_id = new.category_id)
      and p.location is not null
      and st_dwithin(new.location, p.location, w.radius_km * 1000)
      and new.search @@ websearch_to_tsquery('spanish', public.immutable_unaccent(w.query))
      and not public.is_blocked_either(new.owner_id, w.user_id)
    limit 50
  ) loop
    perform public.notify_user(v_wish.user_id, 'wishlist_match',
      jsonb_build_object('item_id', new.id, 'item_title', new.title));
  end loop;
  return new;
end;
$$;

create trigger items_match_wishlists after insert on public.items
for each row execute function public.match_wishlists();

update public.feature_flags set enabled = true where key = 'wishlist_alerts';

-- ---------------------------------------------------------------------------
-- 4. feed_items v4: orden inteligente (cercanía + novedad) con paginación
--    por offset. Lo virtual puntúa como si estuviera a ~3 km.
-- ---------------------------------------------------------------------------
drop function if exists public.feed_items(
  double precision, double precision, integer, smallint, text, boolean,
  public.item_kind, public.knowledge_format, public.knowledge_modality,
  public.item_condition, timestamptz, integer
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
    and (p_category is null or i.category_id = p_category)
    and (not p_donations_only or i.is_donation)
    and (p_kind is null or i.kind = p_kind)
    and (p_format is null or i.format = p_format)
    and (p_modality is null or i.modality = p_modality)
    and (p_condition is null or i.condition = p_condition)
    and (p_search is null or p_search = ''
      or i.search @@ websearch_to_tsquery('spanish', public.immutable_unaccent(p_search)))
  order by
    -- puntaje: horas de antigüedad * 0.02 + km * 0.4 (virtual ≈ 3 km);
    -- los círculos próximos a suceder suben un poco
    (extract(epoch from (now() - i.created_at)) / 3600.0) * 0.02
    + case
        when i.modality = 'virtual' then 1.2
        else least(st_distance(i.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000.0, 50) * 0.4
      end
    - case when i.format = 'circle' and i.event_at < now() + interval '3 days' then 0.8 else 0 end
    asc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(coalesce(p_limit, 20), 50)
$$;

grant execute on function public.feed_items to anon, authenticated;
