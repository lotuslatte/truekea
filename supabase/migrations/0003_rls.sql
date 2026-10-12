-- Truekea 0003: row level security + grants

-- Helper: block in either direction. SECURITY DEFINER so policies can consult
-- blocks without granting broad read access to the table itself.
create or replace function public.is_blocked_either(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  )
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.item_photos enable row level security;
alter table public.offers enable row level security;
alter table public.meeting_points enable row level security;
alter table public.trades enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.ratings enable row level security;
alter table public.wishlists enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.feature_flags enable row level security;

-- profiles: public read (reputation), self-managed writes. The denormalized
-- rating/trade counters are excluded via column-level grants below.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_url, bio, district, location) on public.profiles to authenticated;

-- categories / meeting_points / feature_flags: read-only reference data
create policy categories_select on public.categories for select to authenticated using (true);
create policy meeting_points_select on public.meeting_points for select to authenticated using (is_active);
create policy feature_flags_select on public.feature_flags for select to authenticated using (true);

-- items: visible while active unless blocked; owner always sees their own.
create policy items_select on public.items for select to authenticated using (
  owner_id = auth.uid()
  or (status in ('available', 'reserved') and not public.is_blocked_either(owner_id, auth.uid()))
);
create policy items_insert on public.items for insert to authenticated with check (
  owner_id = auth.uid() and status in ('draft', 'available')
);
create policy items_update on public.items for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy items_delete on public.items for delete to authenticated using (
  owner_id = auth.uid() and status not in ('reserved', 'traded')
);

-- item_photos: follow the parent item (items RLS applies inside the subquery).
create policy item_photos_select on public.item_photos for select to authenticated using (
  exists (select 1 from public.items i where i.id = item_id)
);
create policy item_photos_insert on public.item_photos for insert to authenticated with check (
  exists (select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid())
);
create policy item_photos_delete on public.item_photos for delete to authenticated using (
  exists (select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid())
);

-- offers: visible to offerer and to the target item's owner. Status changes
-- only through the RPCs (no UPDATE grant for authenticated).
create policy offers_select on public.offers for select to authenticated using (
  offerer_id = auth.uid()
  or exists (select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid())
);
create policy offers_insert on public.offers for insert to authenticated with check (
  offerer_id = auth.uid()
  and exists (
    select 1 from public.items t
    where t.id = item_id
      and t.status = 'available'
      and t.owner_id <> auth.uid()
      and not public.is_blocked_either(t.owner_id, auth.uid())
      -- offered item required unless the target is a donation
      and (
        (t.is_donation and offered_item_id is null)
        or exists (
          select 1 from public.items o
          where o.id = offered_item_id and o.owner_id = auth.uid() and o.status = 'available'
        )
      )
  )
);
revoke update, delete on public.offers from authenticated;

-- trades: participants only; all mutations via RPCs.
create policy trades_select on public.trades for select to authenticated using (
  owner_id = auth.uid() or offerer_id = auth.uid()
);
revoke insert, update, delete on public.trades from authenticated;

-- chats/messages: participants only; chat becomes read-only once the trade ends.
create policy chats_select on public.chats for select to authenticated using (
  exists (select 1 from public.trades t where t.id = trade_id and (t.owner_id = auth.uid() or t.offerer_id = auth.uid()))
);
create policy messages_select on public.messages for select to authenticated using (
  exists (
    select 1 from public.chats c join public.trades t on t.id = c.trade_id
    where c.id = chat_id and (t.owner_id = auth.uid() or t.offerer_id = auth.uid())
  )
);
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.chats c join public.trades t on t.id = c.trade_id
    where c.id = chat_id
      and t.status = 'agreed'
      and (t.owner_id = auth.uid() or t.offerer_id = auth.uid())
  )
);
create policy messages_update_read on public.messages for update to authenticated
  using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.chats c join public.trades t on t.id = c.trade_id
      where c.id = chat_id and (t.owner_id = auth.uid() or t.offerer_id = auth.uid())
    )
  );
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- ratings: public reputation; insert only by a participant of a completed
-- trade, about the other participant, once.
create policy ratings_select on public.ratings for select to authenticated using (true);
create policy ratings_insert on public.ratings for insert to authenticated with check (
  rater_id = auth.uid()
  and exists (
    select 1 from public.trades t
    where t.id = trade_id
      and t.status = 'completed'
      and ((t.owner_id = auth.uid() and t.offerer_id = ratee_id)
        or (t.offerer_id = auth.uid() and t.owner_id = ratee_id))
  )
);
revoke update, delete on public.ratings from authenticated;

-- owner-only tables
create policy wishlists_all on public.wishlists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy blocks_all on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy push_tokens_all on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- reports: write-only for users; moderation reads with the service role.
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = auth.uid());

-- Storage: public read; uploads namespaced by the uploader's uid ({uid}/...).
create policy storage_read_public on storage.objects for select using (bucket_id in ('item-photos', 'avatars'));
create policy storage_insert_own on storage.objects for insert to authenticated with check (
  bucket_id in ('item-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text
);
create policy storage_delete_own on storage.objects for delete to authenticated using (
  bucket_id in ('item-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text
);
