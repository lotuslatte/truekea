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
values ('00000000-0000-0000-0000-0000000010a1', '00000000-0000-0000-0000-0000000000a1', 1, 'Tablet vieja', 'Funciona bien', 300, 'Miraflores', st_setsrid(st_makepoint(-77.0297, -12.1211), 4326));

-- A no puede poner su item en 'reserved' a mano (guard trigger)
do $$
begin
  update public.items set status = 'reserved' where id = '00000000-0000-0000-0000-0000000010a1';
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
values ('00000000-0000-0000-0000-0000000010b2', '00000000-0000-0000-0000-0000000000b2', 5, 'Bicicleta montañera', 'Aro 26', 350, 'Barranco', st_setsrid(st_makepoint(-77.0208, -12.1494), 4326));

-- B ve el item de A en el feed
do $$
declare n integer;
begin
  select count(*) into n from public.feed_items(p_lat => -12.1494, p_lng => -77.0208, p_radius_km => 10);
  if n < 1 then raise exception 'FALLO: el feed de B no muestra el item de A'; end if;
  raise notice 'OK: feed geográfico devuelve % item(s)', n;
end $$;

-- B no puede editar el item de A
update public.items set title = 'hackeado' where id = '00000000-0000-0000-0000-0000000010a1';
do $$
begin
  if exists (select 1 from public.items where title = 'hackeado') then
    raise exception 'FALLO: B editó un item ajeno';
  end if;
  raise notice 'OK: B no puede editar items ajenos';
end $$;

-- B oferta su bici por la tablet de A (+ S/ 50 encima)
insert into public.offers (id, item_id, offerer_id, offered_item_id, cash_top_up_pen, message)
values ('00000000-0000-0000-0000-000000000f01', '00000000-0000-0000-0000-0000000010a1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000010b2', 50, '¿Te interesa?');

-- B no puede aceptar su propia oferta
do $$
begin
  perform public.accept_offer('00000000-0000-0000-0000-000000000f01');
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
  v_trade := public.accept_offer('00000000-0000-0000-0000-000000000f01');
  if (select count(*) from public.items where status = 'reserved') <> 2 then
    raise exception 'FALLO: los items no quedaron reservados';
  end if;
  if not exists (select 1 from public.chats where trade_id = v_trade) then
    raise exception 'FALLO: no se creó el chat';
  end if;
  raise notice 'OK: accept_offer creó trade %, chat y reservó ambos items', v_trade;

  -- Fecha del encuentro (0017): A propone, solo B puede aceptar
  perform public.propose_meeting_time(v_trade, now() + interval '2 days');
  begin
    perform public.accept_meeting_time(v_trade);
    raise exception 'FALLO: quien propone aceptó su propia fecha';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;
  begin
    perform public.propose_meeting_time(v_trade, now() - interval '1 hour');
    raise exception 'FALLO: se aceptó una fecha pasada';
  exception when others then
    if sqlerrm like '%FALLO%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000b2', 'role', 'authenticated')::text, true);
  perform public.accept_meeting_time(v_trade);
  if (select meeting_accepted_at from public.trades where id = v_trade) is null then
    raise exception 'FALLO: la fecha del encuentro no quedó aceptada';
  end if;
  -- Una propuesta nueva vuelve a dejar la fecha sin aceptar
  perform public.propose_meeting_time(v_trade, now() + interval '3 days');
  if (select meeting_accepted_at from public.trades where id = v_trade) is not null then
    raise exception 'FALLO: una propuesta nueva conservó la aceptación anterior';
  end if;
  raise notice 'OK: fecha del encuentro propuesta por una parte y aceptada por la otra';
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated')::text, true);

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

-- Preguntas públicas (0016): A publica otro item, B pregunta, solo A responde.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated')::text, true);
insert into public.items (id, owner_id, category_id, title, description, estimated_value_pen, district, location)
values ('00000000-0000-0000-0000-0000000020a1', '00000000-0000-0000-0000-0000000000a1', 1, 'Licuadora', 'Tres velocidades', 80, 'Miraflores', st_setsrid(st_makepoint(-77.0297, -12.1211), 4326));

do $$
begin
  insert into public.item_questions (item_id, asker_id, body)
  values ('00000000-0000-0000-0000-0000000020a1', '00000000-0000-0000-0000-0000000000a1', '¿Me pregunto a mí misma?');
  raise exception 'FALLO: la dueña preguntó en su propio item';
exception when others then
  if sqlerrm like '%FALLO%' then raise; end if;
  raise notice 'OK: la dueña no puede preguntar en su propio item';
end $$;

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000b2', 'role', 'authenticated')::text, true);
insert into public.item_questions (id, item_id, asker_id, body)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000020a1', '00000000-0000-0000-0000-0000000000b2', '¿Incluye el vaso?');

do $$
begin
  insert into public.item_questions (item_id, asker_id, body)
  values ('00000000-0000-0000-0000-0000000020a1', '00000000-0000-0000-0000-0000000000a1', 'Suplantando a Ana');
  raise exception 'FALLO: B preguntó a nombre de A';
exception when others then
  if sqlerrm like '%FALLO%' then raise; end if;
  raise notice 'OK: solo se pregunta a nombre propio';
end $$;

-- B no puede responder su propia pregunta (la política filtra la fila)
update public.item_questions set answer = 'Sí, claro' where id = '00000000-0000-0000-0000-0000000000c1';
do $$
begin
  if exists (select 1 from public.item_questions where id = '00000000-0000-0000-0000-0000000000c1' and answer is not null) then
    raise exception 'FALLO: quien pregunta respondió su propia pregunta';
  end if;
  raise notice 'OK: quien pregunta no puede responder';
end $$;

-- Nadie edita el texto de la pregunta (sin privilegio de columna)
do $$
begin
  update public.item_questions set body = 'editada' where id = '00000000-0000-0000-0000-0000000000c1';
  raise exception 'FALLO: se editó el texto de una pregunta';
exception when others then
  if sqlerrm like '%FALLO%' then raise; end if;
  raise notice 'OK: el texto de la pregunta no se edita';
end $$;

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated')::text, true);
update public.item_questions set answer = 'Sí, con vaso y tapa' where id = '00000000-0000-0000-0000-0000000000c1';
do $$
begin
  if not exists (select 1 from public.item_questions where id = '00000000-0000-0000-0000-0000000000c1' and answer is not null and answered_at is not null) then
    raise exception 'FALLO: la dueña no pudo responder o no se selló answered_at';
  end if;
  if (select count(*) from public.notifications where type = 'item_question') <> 1 then
    raise exception 'FALLO: la dueña no recibió el aviso de la pregunta';
  end if;
  raise notice 'OK: la dueña responde y answered_at lo pone la base';
end $$;

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000b2', 'role', 'authenticated')::text, true);
do $$
begin
  if (select count(*) from public.notifications where type = 'item_answer') <> 1 then
    raise exception 'FALLO: quien preguntó no recibió el aviso de la respuesta';
  end if;
  delete from public.item_questions where id = '00000000-0000-0000-0000-0000000000c1';
  if not exists (select 1 from public.item_questions where id = '00000000-0000-0000-0000-0000000000c1') then
    raise exception 'FALLO: se borró una pregunta ya respondida';
  end if;
  raise notice 'OK: aviso de respuesta entregado y pregunta respondida no se borra';
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
  if exists (select 1 from public.item_questions) then
    raise exception 'FALLO: B sigue viendo preguntas de un item que ya no puede ver';
  end if;
  raise notice 'OK: bloqueo oculta contenido en ambas direcciones';
end $$;

rollback;
