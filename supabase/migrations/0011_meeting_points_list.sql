-- Truekea 0011: puntos de encuentro con coordenadas legibles (para el mapa
-- y los enlaces "cómo llegar" de Google Maps).
create or replace function public.meeting_points_list()
returns table (
  id bigint,
  name text,
  description text,
  address text,
  district text,
  lat double precision,
  lng double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, description, address, district,
    st_y(location::geometry), st_x(location::geometry)
  from public.meeting_points
  where is_active
  order by district, name
$$;

grant execute on function public.meeting_points_list to anon, authenticated;
