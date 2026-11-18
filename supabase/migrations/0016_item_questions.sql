-- Truekea 0016: public questions on an item, asked before making an offer.

alter type public.notification_type add value if not exists 'item_question';
alter type public.notification_type add value if not exists 'item_answer';

create table public.item_questions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  asker_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 3 and 300),
  answer text check (answer is null or char_length(answer) between 1 and 500),
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create index item_questions_item_idx on public.item_questions (item_id, created_at desc);

alter table public.item_questions enable row level security;

-- Read: any signed-in person who can see the item (items RLS applies inside
-- the subquery), unless they and the asker blocked each other.
create policy item_questions_select on public.item_questions for select to authenticated using (
  exists (select 1 from public.items i where i.id = item_id)
  and not public.is_blocked_either(asker_id, auth.uid())
);

-- Ask: only as yourself, on someone else's available item.
create policy item_questions_insert on public.item_questions for insert to authenticated with check (
  asker_id = auth.uid()
  and answer is null
  and answered_at is null
  and exists (
    select 1 from public.items i
    where i.id = item_id
      and i.status = 'available'
      and i.owner_id <> auth.uid()
      and not public.is_blocked_either(i.owner_id, auth.uid())
  )
);

-- Answer: only the item owner, and only the answer column (grant below).
create policy item_questions_answer on public.item_questions for update to authenticated
  using (exists (select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid()))
  with check (exists (select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid()));

-- Remove: the asker while unanswered, or the item owner (moderating their listing).
create policy item_questions_delete on public.item_questions for delete to authenticated using (
  (asker_id = auth.uid() and answer is null)
  or exists (select 1 from public.items i where i.id = item_id and i.owner_id = auth.uid())
);

revoke insert, update on public.item_questions from authenticated, anon;
revoke all on public.item_questions from anon;
grant insert (id, item_id, asker_id, body) on public.item_questions to authenticated;
grant update (answer) on public.item_questions to authenticated;

-- answered_at is stamped by the database, never by the client.
create or replace function public.item_questions_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if new.answer is distinct from old.answer then
    new.answered_at := case when new.answer is null then null else now() end;
    if new.answer is not null and old.answer is null then
      select title into v_title from public.items where id = new.item_id;
      perform public.notify_user(new.asker_id, 'item_answer',
        jsonb_build_object('item_id', new.item_id, 'item_title', v_title, 'question_id', new.id));
    end if;
  end if;
  return new;
end;
$$;

create trigger item_questions_stamp before update on public.item_questions
for each row execute function public.item_questions_stamp();

create or replace function public.notify_on_item_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_title text;
begin
  select owner_id, title into v_owner, v_title from public.items where id = new.item_id;
  perform public.notify_user(v_owner, 'item_question',
    jsonb_build_object('item_id', new.item_id, 'item_title', v_title, 'question_id', new.id));
  return new;
end;
$$;

create trigger item_questions_notify after insert on public.item_questions
for each row execute function public.notify_on_item_question();
