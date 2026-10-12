-- Truekea 0004: triggers + RPCs (all state transitions live here, never in raw UPDATEs)

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.notify_user(p_user uuid, p_type public.notification_type, p_payload jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, payload) values (p_user, p_type, p_payload)
$$;

-- Items: touch updated_at and block reserved/traded transitions outside RPCs.
-- RPCs opt out with a transaction-local flag before touching item status.
create or replace function public.guard_item_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and (new.status in ('reserved', 'traded') or old.status in ('reserved', 'traded'))
     and coalesce(current_setting('app.status_guard_bypass', true), '') <> 'on' then
    raise exception 'Transición de estado no permitida';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger items_guard_status before update on public.items
for each row execute function public.guard_item_status();

-- Mirror auth phone confirmation onto the profile at creation time.
create or replace function public.profiles_set_phone_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select (phone_confirmed_at is not null) into new.phone_verified
  from auth.users where id = new.id;
  return new;
end;
$$;

create trigger profiles_phone_verified before insert on public.profiles
for each row execute function public.profiles_set_phone_verified();

-- ---------------------------------------------------------------------------
-- Notification triggers
-- ---------------------------------------------------------------------------

create or replace function public.notify_on_offer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
begin
  select owner_id, title into v_owner, v_title from public.items where id = new.item_id;
  perform public.notify_user(
    v_owner,
    case when new.parent_offer_id is null then 'new_offer'::public.notification_type else 'offer_countered' end,
    jsonb_build_object('offer_id', new.id, 'item_id', new.item_id, 'item_title', v_title)
  );
  return new;
end;
$$;

create trigger offers_notify after insert on public.offers
for each row execute function public.notify_on_offer();

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
begin
  select case when t.owner_id = new.sender_id then t.offerer_id else t.owner_id end
  into v_recipient
  from public.chats c join public.trades t on t.id = c.trade_id
  where c.id = new.chat_id;

  perform public.notify_user(
    v_recipient,
    'new_message',
    jsonb_build_object('chat_id', new.chat_id, 'message_id', new.id, 'preview', left(new.body, 80))
  );
  return new;
end;
$$;

create trigger messages_notify after insert on public.messages
for each row execute function public.notify_on_message();

create or replace function public.apply_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set
    rating_avg = (select round(avg(stars)::numeric, 2) from public.ratings where ratee_id = new.ratee_id),
    rating_count = (select count(*) from public.ratings where ratee_id = new.ratee_id)
  where id = new.ratee_id;

  perform public.notify_user(new.ratee_id, 'rating_received',
    jsonb_build_object('trade_id', new.trade_id, 'stars', new.stars));
  return new;
end;
$$;

create trigger ratings_apply after insert on public.ratings
for each row execute function public.apply_rating();

-- ---------------------------------------------------------------------------
-- Offer / trade state machine
-- ---------------------------------------------------------------------------

create or replace function public.accept_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers%rowtype;
  v_target public.items%rowtype;
  v_trade_id uuid;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Oferta no encontrada'; end if;
  if v_offer.status <> 'pending' then raise exception 'La oferta ya no está pendiente'; end if;

  select * into v_target from public.items where id = v_offer.item_id for update;
  if v_target.owner_id <> auth.uid() then raise exception 'Solo el dueño del objeto puede aceptar la oferta'; end if;
  if v_target.status <> 'available' then raise exception 'Tu objeto ya no está disponible'; end if;

  if v_offer.offered_item_id is not null then
    perform 1 from public.items where id = v_offer.offered_item_id and status = 'available' for update;
    if not found then raise exception 'El objeto ofrecido ya no está disponible'; end if;
  end if;

  update public.offers set status = 'accepted', responded_at = now() where id = p_offer_id;

  insert into public.trades (offer_id, owner_id, offerer_id, owner_item_id, offerer_item_id, cash_top_up_pen)
  values (p_offer_id, v_target.owner_id, v_offer.offerer_id, v_target.id, v_offer.offered_item_id, v_offer.cash_top_up_pen)
  returning id into v_trade_id;

  insert into public.chats (trade_id) values (v_trade_id);

  perform set_config('app.status_guard_bypass', 'on', true);
  update public.items set status = 'reserved'
  where id = v_target.id or id = v_offer.offered_item_id;
  perform set_config('app.status_guard_bypass', '', true);

  -- Any other pending offer touching either item is no longer viable.
  update public.offers set status = 'rejected', responded_at = now()
  where status = 'pending' and id <> p_offer_id
    and (item_id in (v_target.id, v_offer.offered_item_id)
      or offered_item_id in (v_target.id, v_offer.offered_item_id));

  perform public.notify_user(v_offer.offerer_id, 'offer_accepted',
    jsonb_build_object('offer_id', p_offer_id, 'trade_id', v_trade_id, 'item_title', v_target.title));

  return v_trade_id;
end;
$$;

create or replace function public.reject_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers%rowtype;
  v_target public.items%rowtype;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Oferta no encontrada'; end if;
  if v_offer.status <> 'pending' then raise exception 'La oferta ya no está pendiente'; end if;

  select * into v_target from public.items where id = v_offer.item_id;
  if v_target.owner_id <> auth.uid() then raise exception 'Solo el dueño del objeto puede rechazar la oferta'; end if;

  update public.offers set status = 'rejected', responded_at = now() where id = p_offer_id;

  perform public.notify_user(v_offer.offerer_id, 'offer_rejected',
    jsonb_build_object('offer_id', p_offer_id, 'item_title', v_target.title));
end;
$$;

create or replace function public.cancel_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers%rowtype;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Oferta no encontrada'; end if;
  if v_offer.offerer_id <> auth.uid() then raise exception 'Solo quien ofertó puede cancelar'; end if;
  if v_offer.status <> 'pending' then raise exception 'La oferta ya no está pendiente'; end if;

  update public.offers set status = 'cancelled', responded_at = now() where id = p_offer_id;
end;
$$;

-- Counter: the target item's owner proposes different terms. Roles reverse:
-- the child offer targets the original offerer's item.
create or replace function public.counter_offer(
  p_offer_id uuid,
  p_offered_item_id uuid,
  p_cash_top_up_pen numeric default 0,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers%rowtype;
  v_target public.items%rowtype;
  v_counter_id uuid;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Oferta no encontrada'; end if;
  if v_offer.status <> 'pending' then raise exception 'La oferta ya no está pendiente'; end if;
  if v_offer.offered_item_id is null then raise exception 'No se puede contraofertar una oferta de donación'; end if;

  select * into v_target from public.items where id = v_offer.item_id;
  if v_target.owner_id <> auth.uid() then raise exception 'Solo el dueño del objeto puede contraofertar'; end if;

  perform 1 from public.items
  where id = p_offered_item_id and owner_id = auth.uid() and status = 'available';
  if not found then raise exception 'El objeto que ofreces no está disponible'; end if;

  if exists (
    select 1 from public.offers
    where item_id = v_offer.offered_item_id and offerer_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'Ya tienes una oferta pendiente por ese objeto';
  end if;

  update public.offers set status = 'countered', responded_at = now() where id = p_offer_id;

  insert into public.offers (item_id, offerer_id, offered_item_id, cash_top_up_pen, message, parent_offer_id)
  values (v_offer.offered_item_id, auth.uid(), p_offered_item_id, coalesce(p_cash_top_up_pen, 0), p_message, p_offer_id)
  returning id into v_counter_id;

  return v_counter_id;
end;
$$;

create or replace function public.confirm_trade(p_trade_id uuid)
returns public.trade_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade public.trades%rowtype;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then raise exception 'Trueke no encontrado'; end if;
  if auth.uid() not in (v_trade.owner_id, v_trade.offerer_id) then raise exception 'No participas en este trueke'; end if;
  if v_trade.status <> 'agreed' then raise exception 'El trueke ya no está activo'; end if;

  if auth.uid() = v_trade.owner_id then
    update public.trades set owner_confirmed_at = coalesce(owner_confirmed_at, now())
    where id = p_trade_id returning * into v_trade;
  else
    update public.trades set offerer_confirmed_at = coalesce(offerer_confirmed_at, now())
    where id = p_trade_id returning * into v_trade;
  end if;

  if v_trade.owner_confirmed_at is not null and v_trade.offerer_confirmed_at is not null then
    update public.trades set status = 'completed', completed_at = now()
    where id = p_trade_id returning * into v_trade;

    perform set_config('app.status_guard_bypass', 'on', true);
    update public.items set status = 'traded'
    where id = v_trade.owner_item_id or id = v_trade.offerer_item_id;
    perform set_config('app.status_guard_bypass', '', true);

    update public.profiles set trades_completed = trades_completed + 1
    where id in (v_trade.owner_id, v_trade.offerer_id);

    perform public.notify_user(v_trade.owner_id, 'trade_completed', jsonb_build_object('trade_id', p_trade_id));
    perform public.notify_user(v_trade.offerer_id, 'trade_completed', jsonb_build_object('trade_id', p_trade_id));
  end if;

  return v_trade.status;
end;
$$;

create or replace function public.cancel_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade public.trades%rowtype;
  v_other uuid;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then raise exception 'Trueke no encontrado'; end if;
  if auth.uid() not in (v_trade.owner_id, v_trade.offerer_id) then raise exception 'No participas en este trueke'; end if;
  if v_trade.status <> 'agreed' then raise exception 'El trueke ya no está activo'; end if;

  update public.trades set status = 'cancelled', cancelled_by = auth.uid() where id = p_trade_id;

  perform set_config('app.status_guard_bypass', 'on', true);
  update public.items set status = 'available'
  where (id = v_trade.owner_item_id or id = v_trade.offerer_item_id) and status = 'reserved';
  perform set_config('app.status_guard_bypass', '', true);

  v_other := case when auth.uid() = v_trade.owner_id then v_trade.offerer_id else v_trade.owner_id end;
  perform public.notify_user(v_other, 'trade_cancelled', jsonb_build_object('trade_id', p_trade_id));
end;
$$;

create or replace function public.set_meeting_point(p_trade_id uuid, p_meeting_point_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trades set meeting_point_id = p_meeting_point_id
  where id = p_trade_id
    and status = 'agreed'
    and auth.uid() in (owner_id, offerer_id);
  if not found then raise exception 'Trueke no encontrado o ya no está activo'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Feed + chat list
-- ---------------------------------------------------------------------------

create or replace function public.feed_items(
  p_lat double precision,
  p_lng double precision,
  p_radius_km integer default 10,
  p_category smallint default null,
  p_min_value numeric default null,
  p_max_value numeric default null,
  p_search text default null,
  p_donations_only boolean default false,
  p_before timestamptz default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  title text,
  estimated_value_pen numeric,
  is_donation boolean,
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
    i.id, i.title, i.estimated_value_pen, i.is_donation, i.district,
    round((st_distance(i.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) / 1000)::numeric, 1),
    i.created_at, i.category_id,
    (select ph.storage_path from public.item_photos ph where ph.item_id = i.id order by ph.position limit 1),
    p.id, p.username, p.display_name, p.avatar_url, p.rating_avg, p.rating_count
  from public.items i
  join public.profiles p on p.id = i.owner_id
  where i.status = 'available'
    and i.owner_id <> auth.uid()
    and not public.is_blocked_either(i.owner_id, auth.uid())
    and st_dwithin(i.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, least(p_radius_km, 50) * 1000)
    and (p_category is null or i.category_id = p_category)
    and (not p_donations_only or i.is_donation)
    and (p_min_value is null or i.estimated_value_pen >= p_min_value)
    and (p_max_value is null or i.estimated_value_pen <= p_max_value)
    and (p_search is null or p_search = ''
      or i.search @@ websearch_to_tsquery('spanish', public.immutable_unaccent(p_search)))
    and (p_before is null or i.created_at < p_before)
  order by i.created_at desc
  limit least(coalesce(p_limit, 20), 50)
$$;

create or replace function public.my_chats()
returns table (
  chat_id uuid,
  trade_id uuid,
  trade_status public.trade_status,
  other_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_url text,
  owner_item_title text,
  offerer_item_title text,
  last_message text,
  last_message_at timestamptz,
  last_sender_id uuid,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, t.id, t.status,
    p.id, p.username, p.display_name, p.avatar_url,
    oi.title, fi.title,
    lm.body, lm.created_at, lm.sender_id,
    (select count(*) from public.messages m2
     where m2.chat_id = c.id and m2.sender_id <> auth.uid() and m2.read_at is null)
  from public.chats c
  join public.trades t on t.id = c.trade_id
  join public.profiles p on p.id = case when t.owner_id = auth.uid() then t.offerer_id else t.owner_id end
  join public.items oi on oi.id = t.owner_item_id
  left join public.items fi on fi.id = t.offerer_item_id
  left join lateral (
    select body, created_at, sender_id from public.messages m
    where m.chat_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where t.owner_id = auth.uid() or t.offerer_id = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc
$$;

-- ---------------------------------------------------------------------------
-- Account + maintenance
-- ---------------------------------------------------------------------------

create or replace function public.delete_account()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users where id = auth.uid()
$$;

-- Run periodically (pg_cron or a scheduled edge function).
create or replace function public.expire_stale_offers()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.offers set status = 'expired', responded_at = now()
    where status = 'pending' and created_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from expired
$$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.messages;
  alter publication supabase_realtime add table public.notifications;
exception when others then
  null; -- publication may not exist outside the Supabase platform
end;
$$;
