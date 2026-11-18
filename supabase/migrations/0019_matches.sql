-- Truekea 0019: matches between published items and wishlists, both ways.
--
-- Same rule as match_wishlists (0010/0018): the wish text matches the item's
-- search vector, the category fits, and the item is inside the wish radius
-- measured from the wisher's profile location. That trigger only fires when an
-- item is created; this function answers the question at any time.
--   'i_want'    : items of other people that match my active wishes.
--   'they_want' : my available items that match someone else's active wish.
-- 'they_want' tells the item owner who is looking for it. The wish text of the
-- other person is not returned: only the item that matched.
create or replace function public.my_matches(p_limit integer default 40)
returns table (
  direction text,
  item_id uuid,
  item_title text,
  item_kind public.item_kind,
  is_donation boolean,
  district text,
  photo_path text,
  other_id uuid,
  other_display_name text,
  other_avatar_url text,
  wish_query text,
  distance_km numeric,
  matched_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select distinct on (i.id)
      'i_want'::text as direction, i.id as item_id, i.title, i.kind, i.is_donation, i.district,
      (select ph.storage_path from public.item_photos ph where ph.item_id = i.id order by ph.position limit 1) as photo_path,
      o.id as other_id, o.display_name, o.avatar_url, w.query as wish_query,
      case when me.location is null then null
        else round((st_distance(i.location, me.location) / 1000)::numeric, 1) end as distance_km,
      i.created_at as matched_at
    from public.wishlists w
    join public.profiles me on me.id = w.user_id
    join public.items i
      on i.status = 'available'
     and i.owner_id <> w.user_id
     and (w.category_id is null or w.category_id = i.category_id)
     and i.search @@ websearch_to_tsquery('spanish', public.immutable_unaccent(w.query))
     and (i.modality = 'virtual' or me.location is null or st_dwithin(i.location, me.location, w.radius_km * 1000))
     and (i.format is distinct from 'circle' or i.event_at > now())
    join public.profiles o on o.id = i.owner_id
    where w.user_id = auth.uid()
      and w.is_active
      and not public.is_blocked_either(i.owner_id, w.user_id)
    order by i.id, w.created_at
  ),
  theirs as (
    select distinct on (i.id, w.user_id)
      'they_want'::text as direction, i.id as item_id, i.title, i.kind, i.is_donation, i.district,
      (select ph.storage_path from public.item_photos ph where ph.item_id = i.id order by ph.position limit 1) as photo_path,
      o.id as other_id, o.display_name, o.avatar_url, null::text as wish_query,
      round((st_distance(i.location, o.location) / 1000)::numeric, 1) as distance_km,
      w.created_at as matched_at
    from public.items i
    join public.wishlists w
      on w.is_active
     and w.user_id <> i.owner_id
     and (w.category_id is null or w.category_id = i.category_id)
     and i.search @@ websearch_to_tsquery('spanish', public.immutable_unaccent(w.query))
    join public.profiles o
      on o.id = w.user_id
     and o.location is not null
     and st_dwithin(i.location, o.location, w.radius_km * 1000)
    where i.owner_id = auth.uid()
      and i.status = 'available'
      and not public.is_blocked_either(i.owner_id, w.user_id)
    order by i.id, w.user_id, w.created_at
  )
  select * from (
    (select * from mine order by matched_at desc limit least(coalesce(p_limit, 40), 100))
    union all
    (select * from theirs order by matched_at desc limit least(coalesce(p_limit, 40), 100))
  ) matches
$$;

revoke execute on function public.my_matches(integer) from public, anon;
grant execute on function public.my_matches(integer) to authenticated;
