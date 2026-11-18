-- Truekea 0017: the two people in a trade agree on a date and time to meet.
-- One side proposes, the other accepts or proposes another time.

alter type public.notification_type add value if not exists 'meeting_proposed';
alter type public.notification_type add value if not exists 'meeting_accepted';

alter table public.trades
  add column if not exists meeting_at timestamptz,
  add column if not exists meeting_proposed_by uuid references public.profiles (id),
  add column if not exists meeting_accepted_at timestamptz;

create or replace function public.propose_meeting_time(p_trade_id uuid, p_at timestamptz)
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
  if auth.uid() is null or auth.uid() not in (v_trade.owner_id, v_trade.offerer_id) then
    raise exception 'No participas en este trueke';
  end if;
  if v_trade.status <> 'agreed' then raise exception 'El trueke ya no está activo'; end if;
  if p_at is null or p_at <= now() then raise exception 'Elige una fecha que todavía no haya pasado'; end if;
  if p_at > now() + interval '90 days' then raise exception 'Elige una fecha dentro de los próximos 90 días'; end if;

  update public.trades
  set meeting_at = p_at, meeting_proposed_by = auth.uid(), meeting_accepted_at = null
  where id = p_trade_id;

  v_other := case when auth.uid() = v_trade.owner_id then v_trade.offerer_id else v_trade.owner_id end;
  perform public.notify_user(v_other, 'meeting_proposed',
    jsonb_build_object('trade_id', p_trade_id, 'meeting_at', p_at));
end;
$$;

create or replace function public.accept_meeting_time(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade public.trades%rowtype;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then raise exception 'Trueke no encontrado'; end if;
  if auth.uid() is null or auth.uid() not in (v_trade.owner_id, v_trade.offerer_id) then
    raise exception 'No participas en este trueke';
  end if;
  if v_trade.status <> 'agreed' then raise exception 'El trueke ya no está activo'; end if;
  if v_trade.meeting_at is null then raise exception 'Todavía no hay una fecha propuesta'; end if;
  if v_trade.meeting_proposed_by = auth.uid() then raise exception 'La otra persona debe aceptar tu propuesta'; end if;
  if v_trade.meeting_at <= now() then raise exception 'Esa fecha ya pasó. Propón otra.'; end if;

  update public.trades set meeting_accepted_at = now() where id = p_trade_id;

  perform public.notify_user(v_trade.meeting_proposed_by, 'meeting_accepted',
    jsonb_build_object('trade_id', p_trade_id, 'meeting_at', v_trade.meeting_at));
end;
$$;

revoke execute on function public.propose_meeting_time(uuid, timestamptz) from public, anon;
revoke execute on function public.accept_meeting_time(uuid) from public, anon;
grant execute on function public.propose_meeting_time(uuid, timestamptz) to authenticated;
grant execute on function public.accept_meeting_time(uuid) to authenticated;
