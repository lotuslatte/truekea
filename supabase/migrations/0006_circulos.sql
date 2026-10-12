-- Truekea 0006: Círculos de saber (saberes grupales tipo evento), filtros
-- contextuales (estado del objeto, modalidad del saber) y chat grupal.

-- ---------------------------------------------------------------------------
-- 1. Tipos y columnas nuevas
-- ---------------------------------------------------------------------------
create type public.knowledge_format as enum ('one_on_one', 'circle');
create type public.knowledge_modality as enum ('in_person', 'virtual');
create type public.item_condition as enum ('new', 'like_new', 'used', 'for_repair');
create type public.circle_member_status as enum ('requested', 'accepted', 'rejected', 'cancelled', 'checked_in');

alter type public.notification_type add value if not exists 'circle_request';
alter type public.notification_type add value if not exists 'circle_accepted';
alter type public.notification_type add value if not exists 'circle_completed';

alter table public.items
  add column format public.knowledge_format,
  add column modality public.knowledge_modality,
  add column condition public.item_condition,
  add column event_at timestamptz,
  add column capacity smallint check (capacity is null or capacity between 2 and 50),
  add constraint items_circle_fields check (
    format is distinct from 'circle' or (event_at is not null and capacity is not null)
  );

create index items_event_idx on public.items (event_at) where format = 'circle';

-- ---------------------------------------------------------------------------
-- 2. Miembros de círculo
-- ---------------------------------------------------------------------------
create table public.circle_members (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  offering text check (char_length(offering) between 1 and 300),
  status public.circle_member_status not null default 'requested',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (item_id, user_id)
);

create index circle_members_item_idx on public.circle_members (item_id, status);
create index circle_members_user_idx on public.circle_members (user_id, status);

alter table public.circle_members enable row level security;

-- El anfitrión ve todas las solicitudes de su círculo; cada quien ve la suya;
-- los aceptados se ven entre sí (para el "quiénes van").
create policy circle_members_select on public.circle_members for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid())
  or (status in ('accepted', 'checked_in') and exists (
    select 1 from public.circle_members me
    where me.item_id = circle_members.item_id
      and me.user_id = auth.uid()
      and me.status in ('accepted', 'checked_in')
  ))
);
-- Mutaciones solo por RPC.
revoke insert, update, delete on public.circle_members from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Chat grupal: los chats ahora pueden nacer de un trade (1-1) o un círculo
-- ---------------------------------------------------------------------------
alter table public.chats alter column trade_id drop not null;
alter table public.chats add column circle_item_id uuid references public.items (id) on delete cascade;
alter table public.chats add constraint chats_one_source check (
  (trade_id is null) <> (circle_item_id is null)
);
create unique index chats_circle_idx on public.chats (circle_item_id) where circle_item_id is not null;

create or replace function public.is_chat_member(p_chat_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chats c
    left join public.trades t on t.id = c.trade_id
    where c.id = p_chat_id
      and (
        (t.id is not null and (t.owner_id = p_user or t.offerer_id = p_user))
        or (c.circle_item_id is not null and (
          exists (select 1 from public.items i where i.id = c.circle_item_id and i.owner_id = p_user)
          or exists (
            select 1 from public.circle_members m
            where m.item_id = c.circle_item_id and m.user_id = p_user
              and m.status in ('accepted', 'checked_in')
          )
        ))
      )
  )
$$;

-- Reescribir políticas de chats/messages sobre la membresía unificada
drop policy if exists chats_select on public.chats;
create policy chats_select on public.chats for select to authenticated using (
  public.is_chat_member(id, auth.uid())
);

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (
  public.is_chat_member(chat_id, auth.uid())
);

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and public.is_chat_member(chat_id, auth.uid())
  and exists (
    select 1 from public.chats c
    left join public.trades t on t.id = c.trade_id
    left join public.items ci on ci.id = c.circle_item_id
    where c.id = chat_id
      and ((t.id is not null and t.status = 'agreed')
        or (ci.id is not null and ci.status in ('available', 'reserved')))
  )
);

drop policy if exists messages_update_read on public.messages;
create policy messages_update_read on public.messages for update to authenticated
  using (sender_id <> auth.uid() and public.is_chat_member(chat_id, auth.uid()));

-- El fan-out de notificaciones de mensajes ahora cubre chats grupales
create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
begin
  for v_recipient in (
    select t.owner_id from public.chats c join public.trades t on t.id = c.trade_id
    where c.id = new.chat_id and t.owner_id <> new.sender_id
    union
    select t.offerer_id from public.chats c join public.trades t on t.id = c.trade_id
    where c.id = new.chat_id and t.offerer_id <> new.sender_id
    union
    select i.owner_id from public.chats c join public.items i on i.id = c.circle_item_id
    where c.id = new.chat_id and i.owner_id <> new.sender_id
    union
    select m.user_id from public.chats c
    join public.circle_members m on m.item_id = c.circle_item_id
    where c.id = new.chat_id and m.status in ('accepted', 'checked_in') and m.user_id <> new.sender_id
  ) loop
    perform public.notify_user(v_recipient, 'new_message',
      jsonb_build_object('chat_id', new.chat_id, 'message_id', new.id, 'preview', left(new.body, 80)));
  end loop;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Calificaciones de círculos (asistente → anfitrión)
-- ---------------------------------------------------------------------------
alter table public.ratings alter column trade_id drop not null;
alter table public.ratings add column circle_item_id uuid references public.items (id) on delete cascade;
alter table public.ratings add constraint ratings_one_source check (
  (trade_id is null) <> (circle_item_id is null)
);
create unique index ratings_circle_unique on public.ratings (circle_item_id, rater_id)
  where circle_item_id is not null;

create policy ratings_insert_circle on public.ratings for insert to authenticated with check (
  circle_item_id is not null
  and rater_id = auth.uid()
  and exists (
    select 1 from public.items i
    join public.circle_members m on m.item_id = i.id
    where i.id = circle_item_id
      and i.status = 'traded'
      and i.owner_id = ratee_id
      and m.user_id = auth.uid()
      and m.status = 'checked_in'
  )
);

-- ---------------------------------------------------------------------------
-- 5. Contadores para Ayni e insignias
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column circles_hosted integer not null default 0,
  add column donations_given integer not null default 0;

-- Al completar un trade, si el objeto del dueño era donación, cuenta como regalo dado
create or replace function public.confirm_trade(p_trade_id uuid)
returns public.trade_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade public.trades%rowtype;
  v_owner_donation boolean;
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

    select is_donation into v_owner_donation from public.items where id = v_trade.owner_item_id;
    if coalesce(v_owner_donation, false) then
      update public.profiles set donations_given = donations_given + 1 where id = v_trade.owner_id;
    end if;

    perform public.notify_user(v_trade.owner_id, 'trade_completed', jsonb_build_object('trade_id', p_trade_id));
    perform public.notify_user(v_trade.offerer_id, 'trade_completed', jsonb_build_object('trade_id', p_trade_id));
  end if;

  return v_trade.status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPCs de círculos
-- ---------------------------------------------------------------------------
create or replace function public.join_circle(p_item_id uuid, p_offering text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items%rowtype;
  v_member_id uuid;
  v_accepted integer;
begin
  select * into v_item from public.items where id = p_item_id for update;
  if not found or v_item.format is distinct from 'circle' then raise exception 'Círculo no encontrado'; end if;
  if v_item.owner_id = auth.uid() then raise exception 'Es tu propio círculo'; end if;
  if v_item.status <> 'available' then raise exception 'Este círculo ya no acepta solicitudes'; end if;
  if v_item.event_at < now() then raise exception 'Este círculo ya pasó'; end if;
  if public.is_blocked_either(v_item.owner_id, auth.uid()) then raise exception 'No puedes unirte a este círculo'; end if;
  if p_offering is null or char_length(trim(p_offering)) < 1 then raise exception 'Cuéntale al anfitrión qué ofreces a cambio'; end if;

  select count(*) into v_accepted from public.circle_members
  where item_id = p_item_id and status in ('accepted', 'checked_in');
  if v_accepted >= v_item.capacity then raise exception 'Los cupos ya están llenos'; end if;

  insert into public.circle_members (item_id, user_id, offering)
  values (p_item_id, auth.uid(), trim(p_offering))
  on conflict (item_id, user_id) do update
    set status = 'requested', offering = excluded.offering, responded_at = null
    where circle_members.status in ('cancelled', 'rejected')
  returning id into v_member_id;
  if v_member_id is null then raise exception 'Ya pediste tu cupo en este círculo'; end if;

  perform public.notify_user(v_item.owner_id, 'circle_request',
    jsonb_build_object('item_id', p_item_id, 'item_title', v_item.title, 'member_id', v_member_id));
  return v_member_id;
end;
$$;

create or replace function public.respond_circle_request(p_member_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.circle_members%rowtype;
  v_item public.items%rowtype;
  v_accepted integer;
begin
  select * into v_member from public.circle_members where id = p_member_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  select * into v_item from public.items where id = v_member.item_id for update;
  if v_item.owner_id <> auth.uid() then raise exception 'Solo el anfitrión puede responder solicitudes'; end if;
  if v_member.status <> 'requested' then raise exception 'La solicitud ya fue respondida'; end if;

  if p_accept then
    select count(*) into v_accepted from public.circle_members
    where item_id = v_item.id and status in ('accepted', 'checked_in');
    if v_accepted >= v_item.capacity then raise exception 'Los cupos ya están llenos'; end if;

    update public.circle_members set status = 'accepted', responded_at = now() where id = p_member_id;
    insert into public.chats (circle_item_id) values (v_item.id) on conflict do nothing;
    perform public.notify_user(v_member.user_id, 'circle_accepted',
      jsonb_build_object('item_id', v_item.id, 'item_title', v_item.title));
  else
    update public.circle_members set status = 'rejected', responded_at = now() where id = p_member_id;
  end if;
end;
$$;

create or replace function public.leave_circle(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.circle_members set status = 'cancelled', responded_at = now()
  where item_id = p_item_id and user_id = auth.uid() and status in ('requested', 'accepted');
  if not found then raise exception 'No tienes cupo en este círculo'; end if;
end;
$$;

create or replace function public.checkin_circle_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.circle_members%rowtype;
begin
  select * into v_member from public.circle_members where id = p_member_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if not exists (select 1 from public.items i where i.id = v_member.item_id and i.owner_id = auth.uid()) then
    raise exception 'Solo el anfitrión puede hacer check-in';
  end if;
  if v_member.status <> 'accepted' then raise exception 'Solo se hace check-in a cupos aceptados'; end if;
  update public.circle_members set status = 'checked_in' where id = p_member_id;
end;
$$;

create or replace function public.complete_circle(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items%rowtype;
  v_member record;
begin
  select * into v_item from public.items where id = p_item_id for update;
  if not found or v_item.format is distinct from 'circle' then raise exception 'Círculo no encontrado'; end if;
  if v_item.owner_id <> auth.uid() then raise exception 'Solo el anfitrión puede completar el círculo'; end if;
  if v_item.status not in ('available', 'reserved') then raise exception 'El círculo ya fue completado'; end if;

  perform set_config('app.status_guard_bypass', 'on', true);
  update public.items set status = 'traded' where id = p_item_id;
  perform set_config('app.status_guard_bypass', '', true);

  update public.profiles set circles_hosted = circles_hosted + 1 where id = v_item.owner_id;

  for v_member in (
    select user_id from public.circle_members
    where item_id = p_item_id and status = 'checked_in'
  ) loop
    perform public.notify_user(v_member.user_id, 'circle_completed',
      jsonb_build_object('item_id', p_item_id, 'item_title', v_item.title));
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. feed_items v3: círculos, condición, modalidad; lo virtual ignora el radio
-- ---------------------------------------------------------------------------
drop function if exists public.feed_items(
  double precision, double precision, integer, smallint, text, boolean, public.item_kind, timestamptz, integer
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
  p_before timestamptz default null,
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
    and (p_before is null or i.created_at < p_before)
  order by i.created_at desc
  limit least(coalesce(p_limit, 20), 50)
$$;

grant execute on function public.feed_items to anon, authenticated;

-- my_chats v2: incluye chats de círculo (nombre del círculo como "otro")
drop function if exists public.my_chats();
create or replace function public.my_chats()
returns table (
  chat_id uuid,
  trade_id uuid,
  circle_item_id uuid,
  trade_status public.trade_status,
  is_circle boolean,
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
    c.id, t.id, c.circle_item_id, t.status,
    (c.circle_item_id is not null),
    coalesce(p.id, hp.id), coalesce(p.username, hp.username),
    coalesce(p.display_name, hp.display_name), coalesce(p.avatar_url, hp.avatar_url),
    coalesce(oi.title, ci.title), fi.title,
    lm.body, lm.created_at, lm.sender_id,
    (select count(*) from public.messages m2
     where m2.chat_id = c.id and m2.sender_id <> auth.uid() and m2.read_at is null)
  from public.chats c
  left join public.trades t on t.id = c.trade_id
  left join public.profiles p on t.id is not null
    and p.id = case when t.owner_id = auth.uid() then t.offerer_id else t.owner_id end
  left join public.items oi on oi.id = t.owner_item_id
  left join public.items fi on fi.id = t.offerer_item_id
  left join public.items ci on ci.id = c.circle_item_id
  left join public.profiles hp on hp.id = ci.owner_id
  left join lateral (
    select body, created_at, sender_id from public.messages m
    where m.chat_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where public.is_chat_member(c.id, auth.uid())
  order by coalesce(lm.created_at, c.created_at) desc
$$;
