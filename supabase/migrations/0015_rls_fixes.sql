-- Truekea 0015: two RLS fixes found by running the smoke test on a clean database.
--
-- 1. The two sides of an offer or a trade keep seeing the items in it.
--
-- items_select (0003) hides an item from everyone but its owner once it is
-- traded, paused or removed. The other side of the deal then gets a null
-- embedded item in its offers list and in the finished trade. This policy adds
-- read access for the people in an offer or trade that involves the item.
-- SECURITY DEFINER: the check reads offers, whose own policy reads items, and
-- a plain subquery would recurse.
create or replace function public.is_deal_party(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.trades t
      where p_item_id in (t.owner_item_id, t.offerer_item_id)
        and auth.uid() in (t.owner_id, t.offerer_id)
    )
    or exists (
      select 1 from public.offers o
      join public.items target on target.id = o.item_id
      where p_item_id in (o.item_id, o.offered_item_id)
        and auth.uid() in (o.offerer_id, target.owner_id)
    )
  )
$$;

revoke execute on function public.is_deal_party(uuid) from public, anon;
grant execute on function public.is_deal_party(uuid) to authenticated;

create policy items_select_deal_party on public.items for select to authenticated using (
  status <> 'removed' and public.is_deal_party(id)
);

-- 2. circle_members_select (0006) queried circle_members from inside its own
-- policy. Postgres rejects that with "infinite recursion detected in policy"
-- on every read that touches the table, including the ratings insert check.
-- The same rule now goes through a SECURITY DEFINER helper.
create or replace function public.is_circle_attendee(p_item_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members m
    where m.item_id = p_item_id
      and m.user_id = p_user
      and m.status in ('accepted', 'checked_in')
  )
$$;

revoke execute on function public.is_circle_attendee(uuid, uuid) from public, anon;
grant execute on function public.is_circle_attendee(uuid, uuid) to authenticated;

drop policy if exists circle_members_select on public.circle_members;
create policy circle_members_select on public.circle_members for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid())
  or (status in ('accepted', 'checked_in') and public.is_circle_attendee(item_id, auth.uid()))
);
