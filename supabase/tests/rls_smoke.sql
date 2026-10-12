-- Truekea — smoke test de RLS y de la máquina de estados.
-- Ejecutar contra una BD con las migraciones y el seed aplicados:
--   psql "$DB_URL" -f supabase/tests/rls_smoke.sql
-- El script es transaccional y termina en ROLLBACK: no deja datos.

begin;

-- Dos usuarios de prueba directamente en auth.users
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '+51900000001', now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '+51900000002', now(), now(), now());

-- Impersonar al usuario A
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated')::text, true);

insert into public.profiles (id, username, display_name, district, location)
values ('00000000-0000-0000-0000-0000000000a1', 'ana_test', 'Ana Test', 'Miraflores', st_setsrid(st_makepoint(-77.0297, -12.1211), 4326));

insert into public.items (id, owner_id, category_id, title, description, estimated_value_pen, district, location)
values ('00000000-0000-0000-0000-00000000i0a1', '00000000-0000-0000-0000-0000000000a1', 1, 'Tablet vieja', 'Funciona bien', 300, 'Miraflores', st_setsrid(st_makepoint(-77.0297, -12.1211), 4326));

-- A no puede poner su item en 'reserved' a mano (guard trigger)
do $$
begin
  update public.items set status = 'reserved' where id = '00000000-0000-0000-0000-00000000i0a1';
  raise exception 'FALLO: el guard de status no bloqueó reserved manual';
exception when others then
  if sqlerrm like '%FALLO%' then raise; end if;
  raise notice 'OK: transición manual a reserved bloqueada';
end $$;

-- Usuario B
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000b2', 'role', 'authenticated')::text, true);

insert into public.profiles (id, username, display_name, district, location)
values ('00000000-0000-0000-0000-0000000000b2', 'beto_test', 'Beto Test', 'Barranco', st_setsrid(st_makepoint(-77.0208, -12.1494), 4326));

insert into public.items (id, owner_id, category_id, title, description, estimated_value_pen, district, location)
values ('00000000-0000-0000-0000-00000000i0b2', '00000000-0000-0000-0000-0000000000b2', 5, 'Bicicleta montañera', 'Aro 26', 350, 'Barranco', st_setsrid(st_makepoint(-77.0208, -12.1494), 4326));

-- B ve el item de A en el feed
do $$
declare n integer;
begin
  select count(*) into n from public.feed_items(-12.1494, -77.0208, 10, null, null, null, null, false, null, 20);
  if n < 1 then raise exception 'FALLO: el feed de B no muestra el item de A'; end if;
  raise notice 'OK: feed geográfico devuelve % item(s)', n;
end $$;

-- B no puede editar el item de A
update public.items set title = 'hackeado' where id = '00000000-0000-0000-0000-00000000i0a1';
do $$
begin
  if exists (select 1 from public.items where title = 'hackeado') then
    raise exception 'FALLO: B editó un item ajeno';
  end if;
  raise notice 'OK: B no puede editar items ajenos';
end $$;

-- B oferta su bici por la tablet de A (+ S/ 50 encima)
insert into public.offers (id, item_id, offerer_id, offered_item_id, cash_top_up_pen, message)
values ('00000000-0000-0000-0000-00000000of01', '00000000-0000-0000-0000-00000000i0a1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000i0b2', 50, '¿Te interesa?');

-- B no puede aceptar su propia oferta
do $$
begin
  perform public.accept_offer('00000000-0000-0000-0000-00000000of01');
  raise exception 'FALLO: B aceptó una oferta sobre un item ajeno';
exception when others then
  if sqlerrm like '%FALLO%' then raise; end if;
  raise notice 'OK: solo el dueño puede aceptar';
end $$;

-- A acepta → trade + chat + items reservados
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated')::text, true);

do $$
declare v_trade uuid;
begin
  v_trade := public.accept_offer('00000000-0000-0000-0000-00000000of01');
  if (select count(*) from public.items where status = 'reserved') <> 2 then
    raise exception 'FALLO: los items no quedaron reservados';
  end if;
  if not exists (select 1 from public.chats where trade_id = v_trade) then
    raise exception 'FALLO: no se creó el chat';
  end if;
  raise notice 'OK: accept_offer creó trade %, chat y reservó ambos items', v_trade;

  -- Confirmación mutua
  perform public.confirm_trade(v_trade);
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000b2', 'role', 'authenticated')::text, true);
  perform public.confirm_trade(v_trade);

  if (select status from public.trades where id = v_trade) <> 'completed' then
    raise exception 'FALLO: el trade no se completó con confirmación mutua';
  end if;
  if (select count(*) from public.items where status = 'traded') <> 2 then
    raise exception 'FALLO: los items no quedaron truekeados';
  end if;
  raise notice 'OK: confirmación mutua completó el trueke';

  -- B califica a A
  insert into public.ratings (trade_id, rater_id, ratee_id, stars, comment)
  values (v_trade, '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 5, 'Excelente trueke');

  if (select rating_avg from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') <> 5.00 then
    raise exception 'FALLO: rating_avg no se recalculó';
  end if;
  raise notice 'OK: rating aplicado y promedio recalculado';
end $$;

-- Bloqueo: A bloquea a B → B deja de ver los items de A
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated')::text, true);
insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000b2', 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select 1 from public.items where owner_id = '00000000-0000-0000-0000-0000000000a1' and status = 'available') then
    raise exception 'FALLO: B sigue viendo items de A tras el bloqueo';
  end if;
  raise notice 'OK: bloqueo oculta contenido en ambas direcciones';
end $$;

rollback;
