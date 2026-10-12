-- Truekea 0007: ocupación de círculos visible para cualquiera.
-- La RLS de circle_members protege QUIÉNES van; el número de cupos ocupados
-- es información pública del círculo (ya la expone feed_items).
create or replace function public.circle_occupancy(p_item_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.circle_members
  where item_id = p_item_id and status in ('accepted', 'checked_in')
$$;

grant execute on function public.circle_occupancy to anon, authenticated;
