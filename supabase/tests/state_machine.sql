-- Truekea: offer and trade state machine, transition by transition.
-- Run with `npm run test:db` (in-memory database) or against a database with
-- the migrations and the seed applied. Transactional: ends in ROLLBACK.

begin;

insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '+51900000011', now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '+51900000012', now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '+51900000013', now(), now(), now());

-- Wishlist alerts on for this transaction (the seed ships them off).
insert into public.feature_flags (key, enabled) values ('wishlist_alerts', true)
on conflict (key) do update set enabled = true;

create or replace function pg_temp.as_user(p_sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into public.profiles (id, username, display_name, district, location)
values ('00000000-0000-0000-0000-0000000000a1', 'ana_sm', 'Ana', 'Miraflores', st_setsrid(st_makepoint(-77.0297, -12.1211), 4326));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
insert into public.profiles (id, username, display_name, district, location)
values ('00000000-0000-0000-0000-0000000000b2', 'beto_sm', 'Beto', 'Barranco', st_setsrid(st_makepoint(-77.0208, -12.1494), 4326));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
insert into public.profiles (id, username, display_name, district, location)
values ('00000000-0000-0000-0000-0000000000c3', 'caro_sm', 'Caro', 'Miraflores', st_setsrid(st_makepoint(-77.0297, -12.1211), 4326));

-- Caro has two wishes that both match "guitarra"
insert into public.wishlists (user_id, query, radius_km) values
  ('00000000-0000-0000-0000-0000000000c3', 'guitarra', 20),
  ('00000000-0000-0000-0000-0000000000c3', 'guitarra acústica', 20);

-- Items: Ana has a guitar and a lamp; Beto a bike and a tent; Caro a book
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into public.items (id, owner_id, category_id, title, description, estimated_value_pen, district, location) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1', 1, 'Guitarra acústica', 'Con funda', 200, 'Miraflores', st_setsrid(st_makepoint(-77.0297, -12.1211), 4326)),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-0000000000a1', 1, 'Lámpara de pie', 'Funciona', 60, 'Miraflores', st_setsrid(st_makepoint(-77.0297, -12.1211), 4326));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
insert into public.items (id, owner_id, category_id, title, description, estimated_value_pen, district, location) values
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-0000000000b2', 5, 'Bicicleta', 'Aro 26', 300, 'Barranco', st_setsrid(st_makepoint(-77.0208, -12.1494), 4326)),
  ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-0000000000b2', 5, 'Carpa', 'Para dos', 150, 'Barranco', st_setsrid(st_makepoint(-77.0208, -12.1494), 4326));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
insert into public.items (id, owner_id, category_id, title, description, estimated_value_pen, district, location) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000c3', 1, 'Libro de cocina', 'Como nuevo', 40, 'Miraflores', st_setsrid(st_makepoint(-77.0297, -12.1211), 4326));

-- 0018: two matching wishes, one notification
do $$
declare n integer;
begin
  select count(*) into n from public.notifications where type = 'wishlist_match';
  if n <> 1 then raise exception 'FALLO: % avisos de deseo para una sola publicación', n; end if;
  raise notice 'OK: una publicación que calza con dos deseos avisa una vez';
end $$;

-- 0019: matches both ways. Caro wishes a guitar and Ana published one.
do $$
declare n integer;
begin
  -- still acting as Caro
  select count(*) into n from public.my_matches() where direction = 'i_want' and item_id = '00000000-0000-0000-0000-00000000a001';
  if n <> 1 then raise exception 'FALLO: Caro ve % coincidencias para su deseo de guitarra (dos deseos, un item)', n; end if;
  if exists (select 1 from public.my_matches() where direction = 'i_want' and other_id = '00000000-0000-0000-0000-0000000000c3') then
    raise exception 'FALLO: un item propio aparece como coincidencia';
  end if;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  select count(*) into n from public.my_matches()
  where direction = 'they_want' and item_id = '00000000-0000-0000-0000-00000000a001' and other_id = '00000000-0000-0000-0000-0000000000c3';
  if n <> 1 then raise exception 'FALLO: Ana ve % filas de «te buscan» por su guitarra', n; end if;
  if exists (select 1 from public.my_matches() where direction = 'they_want' and wish_query is not null) then
    raise exception 'FALLO: «te buscan» devuelve el texto del deseo ajeno';
  end if;
  if exists (select 1 from public.my_matches() where item_id = '00000000-0000-0000-0000-00000000a002') then
    raise exception 'FALLO: la lámpara aparece como coincidencia sin deseo que calce';
  end if;
  -- a blocked person disappears from both lists
  insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3');
  if exists (select 1 from public.my_matches()) then raise exception 'FALLO: una persona bloqueada sigue en las coincidencias'; end if;
  delete from public.blocks where blocker_id = '00000000-0000-0000-0000-0000000000a1';
  -- Beto has no wishes and nobody wants his items
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
  if exists (select 1 from public.my_matches()) then raise exception 'FALLO: Beto ve coincidencias que no le corresponden'; end if;
  raise notice 'OK: coincidencias en los dos sentidos, sin duplicados, sin texto ajeno y sin bloqueados';
end $$;

-- pending -> cancelled (only the offerer)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
insert into public.offers (id, item_id, offerer_id, offered_item_id)
values ('00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000b002');

do $$
begin
  -- a second pending offer for the same item by the same person is refused
  begin
    insert into public.offers (item_id, offerer_id, offered_item_id)
    values ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000b001');
    raise exception 'FALLO: dos ofertas pendientes de la misma persona por el mismo item';
  exception when unique_violation then null;
  end;
  -- an offer cannot use someone else's item
  begin
    insert into public.offers (item_id, offerer_id, offered_item_id)
    values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000c001');
    raise exception 'FALLO: se ofreció un item ajeno';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;

  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  begin
    perform public.cancel_offer('00000000-0000-0000-0000-000000000f01');
    raise exception 'FALLO: la dueña canceló una oferta ajena';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
  perform public.cancel_offer('00000000-0000-0000-0000-000000000f01');
  if (select status from public.offers where id = '00000000-0000-0000-0000-000000000f01') <> 'cancelled' then
    raise exception 'FALLO: cancel_offer no dejó la oferta cancelada';
  end if;
  -- final: a cancelled offer cannot be accepted, rejected or cancelled again
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  begin
    perform public.accept_offer('00000000-0000-0000-0000-000000000f01');
    raise exception 'FALLO: se aceptó una oferta cancelada';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;
  begin
    perform public.reject_offer('00000000-0000-0000-0000-000000000f01');
    raise exception 'FALLO: se rechazó una oferta cancelada';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;
  raise notice 'OK: pending -> cancelled solo por quien ofertó, y es final';
end $$;

-- pending -> rejected (only the item owner)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
insert into public.offers (id, item_id, offerer_id, offered_item_id)
values ('00000000-0000-0000-0000-000000000f02', '00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000b002');
do $$
begin
  begin
    perform public.reject_offer('00000000-0000-0000-0000-000000000f02');
    raise exception 'FALLO: quien ofertó rechazó su propia oferta';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  perform public.reject_offer('00000000-0000-0000-0000-000000000f02');
  if (select status from public.offers where id = '00000000-0000-0000-0000-000000000f02') <> 'rejected' then
    raise exception 'FALLO: reject_offer no dejó la oferta rechazada';
  end if;
  if (select count(*) from public.items where status <> 'available') <> 0 then
    raise exception 'FALLO: un rechazo cambió el estado de algún item';
  end if;
  raise notice 'OK: pending -> rejected solo por la dueña; los items siguen disponibles';
end $$;

-- pending -> countered: roles reverse in the child offer
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
insert into public.offers (id, item_id, offerer_id, offered_item_id)
values ('00000000-0000-0000-0000-000000000f03', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000b002');
-- Caro also wants the guitar
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
insert into public.offers (id, item_id, offerer_id, offered_item_id)
values ('00000000-0000-0000-0000-000000000f04', '00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-00000000c001');

do $$
declare
  v_counter uuid;
  v_trade uuid;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  -- Ana prefers the bike: she counters Beto's offer asking for... her lamp for his tent
  v_counter := public.counter_offer('00000000-0000-0000-0000-000000000f03', '00000000-0000-0000-0000-00000000a002', 0, 'Mejor mi lámpara');
  if (select status from public.offers where id = '00000000-0000-0000-0000-000000000f03') <> 'countered' then
    raise exception 'FALLO: la oferta original no quedó como contraofertada';
  end if;
  if not exists (
    select 1 from public.offers
    where id = v_counter and status = 'pending' and parent_offer_id = '00000000-0000-0000-0000-000000000f03'
      and offerer_id = '00000000-0000-0000-0000-0000000000a1'
      and item_id = '00000000-0000-0000-0000-00000000b002'
      and offered_item_id = '00000000-0000-0000-0000-00000000a002'
  ) then
    raise exception 'FALLO: la contraoferta no invirtió los roles';
  end if;
  raise notice 'OK: pending -> countered crea una oferta hija con los roles invertidos';

  -- Ana cannot accept her own counter; Beto (owner of the tent) can
  begin
    perform public.accept_offer(v_counter);
    raise exception 'FALLO: quien contraofertó aceptó su propia contraoferta';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;

  -- Meanwhile Ana accepts Caro's offer for the guitar: pending -> accepted
  v_trade := public.accept_offer('00000000-0000-0000-0000-000000000f04');
  if (select status from public.offers where id = '00000000-0000-0000-0000-000000000f04') <> 'accepted' then
    raise exception 'FALLO: accept_offer no dejó la oferta aceptada';
  end if;
  if (select count(*) from public.items where status = 'reserved'
      and id in ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001')) <> 2 then
    raise exception 'FALLO: los dos items del trueke no quedaron reservados';
  end if;
  -- the counter (lamp for tent) touches neither item, so it stays pending
  if (select status from public.offers where id = v_counter) <> 'pending' then
    raise exception 'FALLO: aceptar una oferta rechazó otra que no comparte items';
  end if;
  raise notice 'OK: pending -> accepted reserva los dos items y no toca ofertas ajenas';

  -- agreed -> cancelled: only a participant; items go back to available
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
  begin
    perform public.cancel_trade(v_trade);
    raise exception 'FALLO: alguien ajeno canceló el trueke';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;
  begin
    perform public.confirm_trade(v_trade);
    raise exception 'FALLO: alguien ajeno confirmó el trueke';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
  perform public.confirm_trade(v_trade);
  if (select status from public.trades where id = v_trade) <> 'agreed' then
    raise exception 'FALLO: una sola confirmación completó el trueke';
  end if;
  perform public.cancel_trade(v_trade);
  if (select status from public.trades where id = v_trade) <> 'cancelled' then
    raise exception 'FALLO: cancel_trade no dejó el trueke cancelado';
  end if;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  if (select count(*) from public.items where status = 'available'
      and id in ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000c001')) <> 2 then
    raise exception 'FALLO: cancelar el trueke no liberó los items';
  end if;
  begin
    perform public.confirm_trade(v_trade);
    raise exception 'FALLO: se confirmó un trueke cancelado';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;
  begin
    perform public.propose_meeting_time(v_trade, now() + interval '1 day');
    raise exception 'FALLO: se propuso fecha en un trueke cancelado';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;
  raise notice 'OK: agreed -> cancelled libera los items y es final';

  -- Beto accepts the counter: competing pending offers on those items are rejected
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
  insert into public.offers (id, item_id, offerer_id, offered_item_id)
  values ('00000000-0000-0000-0000-000000000f05', '00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-00000000c001');
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
  v_trade := public.accept_offer(v_counter);
  if (select status from public.offers where id = '00000000-0000-0000-0000-000000000f05') <> 'rejected' then
    raise exception 'FALLO: la oferta que competía por el mismo item siguió pendiente';
  end if;
  raise notice 'OK: aceptar rechaza las otras ofertas pendientes sobre los mismos items';

  -- 0020: handover code. Beto shows it, Ana redeems it; that completes the trade.
  declare
    v_code text;
    v_result public.trade_status;
  begin
    -- still acting as Beto (owner of the tent in this trade)
    select c.code into v_code from public.issue_handover_code(v_trade) c;
    if v_code !~ '^[0-9]{6}$' then raise exception 'FALLO: el código no tiene seis dígitos'; end if;
    begin
      perform public.redeem_handover_code(v_trade, v_code);
      raise exception 'FALLO: quien mostró el código lo canjeó';
    exception when others then
      if sqlerrm like '%FALLO%' then raise; end if;
    end;
    begin
      perform 1 from public.trade_handover_codes;
      raise exception 'FALLO: la tabla de códigos se puede leer directamente';
    exception when insufficient_privilege then null;
    end;
    perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c3');
    begin
      perform public.redeem_handover_code(v_trade, v_code);
      raise exception 'FALLO: alguien ajeno canjeó el código';
    exception when others then
      if sqlerrm like '%FALLO%' then raise; end if;
    end;
    perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
    v_result := public.redeem_handover_code(v_trade, case when v_code = '000000' then '000001' else '000000' end);
    if v_result is not null or (select status from public.trades where id = v_trade) <> 'agreed' then
      raise exception 'FALLO: un código incorrecto avanzó el trueke';
    end if;
    v_result := public.redeem_handover_code(v_trade, v_code);
    if v_result <> 'completed' then raise exception 'FALLO: el código correcto no completó el trueke (%)', v_result; end if;
    if (select owner_confirmed_at is null or offerer_confirmed_at is null from public.trades where id = v_trade) then
      raise exception 'FALLO: el canje no registró las dos confirmaciones';
    end if;
    begin
      perform public.issue_handover_code(v_trade);
      raise exception 'FALLO: se emitió un código para un trueke completado';
    exception when others then
      if sqlerrm like '%FALLO%' then raise; end if;
    end;
    raise notice 'OK: el código de entrega solo lo canjea la otra parte, una vez, y completa el trueke';
  end;

  if (select count(*) from public.items where status = 'traded'
      and id in ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000b002')) <> 2 then
    raise exception 'FALLO: los items no quedaron como truekeados';
  end if;
  begin
    perform public.cancel_trade(v_trade);
    raise exception 'FALLO: se canceló un trueke completado';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;
  if (select count(*) from public.notifications where type = 'trade_completed') <> 1 then
    raise exception 'FALLO: Ana no ve exactamente un aviso de trueke completado';
  end if;
  raise notice 'OK: agreed -> completed con las dos confirmaciones, final, un aviso por persona';
end $$;

-- 0018: the push claim succeeds once per notification
reset role;
do $$
declare v_id uuid;
begin
  select id into v_id from public.notifications limit 1;
  if not public.claim_push(v_id) then raise exception 'FALLO: el primer reclamo de push falló'; end if;
  if public.claim_push(v_id) then raise exception 'FALLO: el mismo aviso se reclamó dos veces'; end if;
  raise notice 'OK: cada notificación se reclama para push una sola vez';
end $$;

rollback;
