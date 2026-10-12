-- Truekea 0008: la ofrenda de un círculo puede ser una publicación tuya
-- (objeto o saber ya en vitrina), texto libre, o ambos.

alter table public.circle_members
  add column offered_item_id uuid references public.items (id) on delete set null;

alter table public.circle_members drop constraint if exists circle_members_offering_check;
alter table public.circle_members add constraint circle_members_offering_check
  check (offering is null or char_length(offering) between 1 and 300);

-- Nueva firma: hay que retirar la anterior para no crear una sobrecarga ambigua
drop function if exists public.join_circle(uuid, text);

create or replace function public.join_circle(
  p_item_id uuid,
  p_offering text default null,
  p_offered_item_id uuid default null
)
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

  if coalesce(trim(p_offering), '') = '' and p_offered_item_id is null then
    raise exception 'Cuéntale al anfitrión qué ofreces: describe algo o elige una de tus publicaciones';
  end if;
  if p_offered_item_id is not null then
    perform 1 from public.items
    where id = p_offered_item_id and owner_id = auth.uid() and status = 'available';
    if not found then raise exception 'Esa publicación tuya ya no está disponible'; end if;
  end if;

  select count(*) into v_accepted from public.circle_members
  where item_id = p_item_id and status in ('accepted', 'checked_in');
  if v_accepted >= v_item.capacity then raise exception 'Los cupos ya están llenos'; end if;

  insert into public.circle_members (item_id, user_id, offering, offered_item_id)
  values (p_item_id, auth.uid(), nullif(trim(coalesce(p_offering, '')), ''), p_offered_item_id)
  on conflict (item_id, user_id) do update
    set status = 'requested',
        offering = excluded.offering,
        offered_item_id = excluded.offered_item_id,
        responded_at = null
    where circle_members.status in ('cancelled', 'rejected')
  returning id into v_member_id;
  if v_member_id is null then raise exception 'Ya pediste tu cupo en este círculo'; end if;

  perform public.notify_user(v_item.owner_id, 'circle_request',
    jsonb_build_object('item_id', p_item_id, 'item_title', v_item.title, 'member_id', v_member_id));
  return v_member_id;
end;
$$;
