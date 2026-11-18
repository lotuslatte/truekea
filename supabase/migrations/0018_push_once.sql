-- Truekea 0018: one push per event.
--
-- Two ways the same event could reach a phone twice:
-- 1. send-push can be invoked twice for one row: the function header documents
--    a Dashboard webhook and 0012 adds a pg_net trigger for the same INSERT,
--    and pg_net may retry. The function now claims the row through pushed_at
--    before sending, so a second call finds it claimed and stops.
-- 2. match_wishlists notified once per matching wishlist, so a person with two
--    wishes that match the same new item got two notifications.

alter table public.notifications add column if not exists pushed_at timestamptz;

-- Atomic claim used by the send-push edge function (service role only).
create or replace function public.claim_push(p_notification_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  with claimed as (
    update public.notifications set pushed_at = now()
    where id = p_notification_id and pushed_at is null
    returning 1
  )
  select exists (select 1 from claimed)
$$;

revoke execute on function public.claim_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_push(uuid) to service_role;

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
    -- distinct: one notification per person, however many of their wishes match
    select distinct w.user_id
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
