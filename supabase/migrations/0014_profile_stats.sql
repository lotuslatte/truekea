-- Truekea 0014: estadísticas de perfil para las insignias coleccionables.
-- Un solo RPC devuelve todos los contadores que el perfil no guarda.

create or replace function public.profile_stats(p_user_id uuid)
returns table (
  perishables_given integer,
  perishable_fast integer,
  knowledge_published integer,
  knowledge_categories integer,
  circles_attended integer,
  own_district_trades integer,
  cross_district_trades integer,
  distinct_districts integer,
  week_pair boolean,
  early_posts integer,
  night_posts integer,
  messages_sent integer,
  ratings_given integer,
  offers_sent integer,
  offers_accepted integer,
  object_trades integer,
  knowledge_trades integer,
  has_published boolean,
  circle_attendees_total integer
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select district from public.profiles where id = p_user_id
  ),
  completed as (
    select t.*,
      case when t.owner_id = p_user_id then t.offerer_id else t.owner_id end as other_id,
      case when t.owner_id = p_user_id then t.owner_item_id else t.offerer_item_id end as my_item_id
    from public.trades t
    where t.status = 'completed' and (t.owner_id = p_user_id or t.offerer_id = p_user_id)
  )
  select
    (select count(*)::integer from public.items i
      where i.owner_id = p_user_id and i.is_donation and i.pickup_until is not null and i.status = 'traded'),
    (select count(*)::integer from completed c
      join public.items i on i.id = c.my_item_id
      where i.pickup_until is not null and c.completed_at - i.created_at < interval '3 hours'),
    (select count(*)::integer from public.items i
      where i.owner_id = p_user_id and i.kind = 'knowledge' and i.status <> 'removed'),
    (select count(distinct i.category_id)::integer from public.items i
      where i.owner_id = p_user_id and i.kind = 'knowledge' and i.status <> 'removed'),
    (select count(*)::integer from public.circle_members m
      where m.user_id = p_user_id and m.status = 'checked_in'),
    (select count(*)::integer from completed c
      join public.profiles p on p.id = c.other_id
      where p.district is not null and p.district = (select district from me)),
    (select count(*)::integer from completed c
      join public.profiles p on p.id = c.other_id
      where p.district is not null and p.district is distinct from (select district from me)),
    (select count(distinct p.district)::integer from completed c
      join public.profiles p on p.id = c.other_id
      where p.district is not null),
    (select exists (
      select 1 from completed a join completed b on a.id <> b.id
      where abs(extract(epoch from (a.completed_at - b.completed_at))) < 604800
    )),
    (select count(*)::integer from public.items i
      where i.owner_id = p_user_id
        and extract(hour from (i.created_at at time zone 'America/Lima')) >= 4
        and extract(hour from (i.created_at at time zone 'America/Lima')) < 7),
    (select count(*)::integer from public.items i
      where i.owner_id = p_user_id
        and extract(hour from (i.created_at at time zone 'America/Lima')) < 4),
    (select count(*)::integer from public.messages m where m.sender_id = p_user_id),
    (select count(*)::integer from public.ratings r where r.rater_id = p_user_id),
    (select count(*)::integer from public.offers o where o.offerer_id = p_user_id),
    (select count(*)::integer from public.offers o
      where o.offerer_id = p_user_id and o.status = 'accepted'),
    (select count(*)::integer from completed c
      join public.items i on i.id = c.my_item_id where i.kind = 'object'),
    (select count(*)::integer from completed c
      join public.items i on i.id = c.my_item_id where i.kind = 'knowledge'),
    (select exists (select 1 from public.items i where i.owner_id = p_user_id and i.status <> 'removed')),
    (select count(*)::integer from public.circle_members m
      join public.items i on i.id = m.item_id
      where i.owner_id = p_user_id and m.status = 'checked_in')
$$;

grant execute on function public.profile_stats to anon, authenticated;
