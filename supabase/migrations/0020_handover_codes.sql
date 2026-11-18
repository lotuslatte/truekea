-- Truekea 0020: confirm an in-person handover with a code shown as a QR.
--
-- One person opens the trade and shows a six-digit code (also drawn as a QR
-- that opens the trade with the code). The other person scans or types it.
-- Redeeming proves both were together, so it records both confirmations and
-- completes the trade through confirm_trade, the same path as the two buttons.
-- Codes last ten minutes, work once, and lock after five wrong attempts.

create table public.trade_handover_codes (
  trade_id uuid primary key references public.trades (id) on delete cascade,
  issuer_id uuid not null references public.profiles (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{6}$'),
  expires_at timestamptz not null,
  failed_attempts smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Only reachable through the two RPCs below.
alter table public.trade_handover_codes enable row level security;
revoke all on public.trade_handover_codes from anon, authenticated;

create or replace function public.issue_handover_code(p_trade_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade public.trades%rowtype;
  v_code text;
  v_expires timestamptz := now() + interval '10 minutes';
begin
  select * into v_trade from public.trades where id = p_trade_id;
  if not found then raise exception 'Trueke no encontrado'; end if;
  if auth.uid() is null or auth.uid() not in (v_trade.owner_id, v_trade.offerer_id) then
    raise exception 'No participas en este trueke';
  end if;
  if v_trade.status <> 'agreed' then raise exception 'El trueke ya no está activo'; end if;

  -- gen_random_uuid() draws from the system's secure generator.
  v_code := lpad((abs(('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::int) % 1000000)::text, 6, '0');

  insert into public.trade_handover_codes as c (trade_id, issuer_id, code, expires_at, failed_attempts, created_at)
  values (p_trade_id, auth.uid(), v_code, v_expires, 0, now())
  on conflict (trade_id) do update
    set issuer_id = excluded.issuer_id, code = excluded.code, expires_at = excluded.expires_at,
        failed_attempts = 0, created_at = now();

  return query select v_code, v_expires;
end;
$$;

create or replace function public.redeem_handover_code(p_trade_id uuid, p_code text)
returns public.trade_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade public.trades%rowtype;
  v_row public.trade_handover_codes%rowtype;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then raise exception 'Trueke no encontrado'; end if;
  if auth.uid() is null or auth.uid() not in (v_trade.owner_id, v_trade.offerer_id) then
    raise exception 'No participas en este trueke';
  end if;
  if v_trade.status <> 'agreed' then raise exception 'El trueke ya no está activo'; end if;

  select * into v_row from public.trade_handover_codes where trade_id = p_trade_id for update;
  if not found then raise exception 'Pide a la otra persona que muestre su código'; end if;
  if v_row.issuer_id = auth.uid() then raise exception 'Este código lo debe ingresar la otra persona'; end if;
  if v_row.expires_at <= now() then raise exception 'El código venció. Pide uno nuevo.'; end if;
  if v_row.failed_attempts >= 5 then raise exception 'Demasiados intentos. Pide un código nuevo.'; end if;

  if v_row.code <> regexp_replace(coalesce(p_code, ''), '\D', '', 'g') then
    update public.trade_handover_codes set failed_attempts = failed_attempts + 1 where trade_id = p_trade_id;
    -- Returned, not raised: an exception would roll the counter back.
    return null;
  end if;

  delete from public.trade_handover_codes where trade_id = p_trade_id;

  -- The issuer showed the code in person: that is their confirmation.
  if v_row.issuer_id = v_trade.owner_id then
    update public.trades set owner_confirmed_at = coalesce(owner_confirmed_at, now()) where id = p_trade_id;
  else
    update public.trades set offerer_confirmed_at = coalesce(offerer_confirmed_at, now()) where id = p_trade_id;
  end if;

  -- The redeemer confirms through the usual path, which completes the trade.
  return public.confirm_trade(p_trade_id);
end;
$$;

revoke execute on function public.issue_handover_code(uuid) from public, anon;
revoke execute on function public.redeem_handover_code(uuid, text) from public, anon;
grant execute on function public.issue_handover_code(uuid) to authenticated;
grant execute on function public.redeem_handover_code(uuid, text) to authenticated;
