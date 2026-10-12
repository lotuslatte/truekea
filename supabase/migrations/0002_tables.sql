-- Truekea 0002: tables + indexes

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  avatar_url text,
  bio text check (char_length(bio) <= 300),
  district text,
  -- District centroid only; never a precise home address.
  location geography (point, 4326),
  phone_verified boolean not null default false,
  rating_avg numeric(3, 2),
  rating_count integer not null default 0,
  trades_completed integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.categories (
  id smallint primary key,
  slug text not null unique,
  name text not null,
  icon text not null,
  sort_order smallint not null default 0
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  category_id smallint not null references public.categories (id),
  title text not null check (char_length(title) between 3 and 80),
  description text not null check (char_length(description) between 1 and 2000),
  estimated_value_pen numeric(10, 2) check (estimated_value_pen is null or estimated_value_pen >= 0),
  looking_for text check (char_length(looking_for) <= 200),
  is_donation boolean not null default false,
  status public.item_status not null default 'available',
  district text not null,
  location geography (point, 4326) not null,
  search tsvector generated always as (
    to_tsvector('spanish', public.immutable_unaccent(coalesce(title, '') || ' ' || coalesce(description, '')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_donation or estimated_value_pen is not null)
);

create index items_location_idx on public.items using gist (location);
create index items_search_idx on public.items using gin (search);
create index items_status_created_idx on public.items (status, created_at desc);
create index items_category_status_idx on public.items (category_id, status);
create index items_owner_status_idx on public.items (owner_id, status);

create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index item_photos_item_idx on public.item_photos (item_id, position);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  offerer_id uuid not null references public.profiles (id) on delete cascade,
  -- Null only when the target item is a donation (enforced by the insert policy).
  offered_item_id uuid references public.items (id) on delete set null,
  cash_top_up_pen numeric(10, 2) not null default 0 check (cash_top_up_pen >= 0),
  message text check (char_length(message) <= 500),
  status public.offer_status not null default 'pending',
  parent_offer_id uuid references public.offers (id),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index offers_one_pending_idx on public.offers (item_id, offerer_id) where status = 'pending';
create index offers_item_status_idx on public.offers (item_id, status);
create index offers_offerer_status_idx on public.offers (offerer_id, status);

create table public.meeting_points (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  address text not null,
  district text not null,
  location geography (point, 4326) not null,
  is_active boolean not null default true
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers (id),
  owner_id uuid not null references public.profiles (id),
  offerer_id uuid not null references public.profiles (id),
  owner_item_id uuid not null references public.items (id),
  offerer_item_id uuid references public.items (id),
  cash_top_up_pen numeric(10, 2) not null default 0,
  status public.trade_status not null default 'agreed',
  meeting_point_id bigint references public.meeting_points (id),
  owner_confirmed_at timestamptz,
  offerer_confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index trades_owner_idx on public.trades (owner_id, status);
create index trades_offerer_idx on public.trades (offerer_id, status);

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null unique references public.trades (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_chat_created_idx on public.messages (chat_id, created_at desc);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  ratee_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (trade_id, rater_id)
);

create index ratings_ratee_idx on public.ratings (ratee_id, created_at desc);

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  query text not null check (char_length(query) between 2 and 80),
  category_id smallint references public.categories (id),
  max_value_pen numeric(10, 2),
  radius_km smallint not null default 10 check (radius_km between 1 and 50),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index wishlists_user_idx on public.wishlists (user_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  payload jsonb not null default '{}'::jsonb
);

-- Storage buckets (public read; write policies in 0003)
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;
