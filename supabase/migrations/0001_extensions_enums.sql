-- Truekea 0001: extensions + enums
create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- unaccent() is STABLE, which disqualifies it from generated columns; the
-- explicit-dictionary form is deterministic, so this wrapper is safe to mark IMMUTABLE.
create or replace function public.immutable_unaccent(p_text text)
returns text
language sql
immutable
parallel safe
as $$
  select public.unaccent('public.unaccent'::regdictionary, p_text)
$$;

create type public.item_status as enum ('draft', 'available', 'reserved', 'traded', 'paused', 'removed');
create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'countered', 'cancelled', 'expired');
create type public.trade_status as enum ('agreed', 'completed', 'cancelled');
create type public.report_target as enum ('item', 'user', 'message');
create type public.report_status as enum ('open', 'reviewed', 'actioned', 'dismissed');
create type public.notification_type as enum (
  'new_offer', 'offer_accepted', 'offer_rejected', 'offer_countered',
  'new_message', 'trade_completed', 'trade_cancelled', 'rating_received', 'wishlist_match'
);
create type public.report_reason as enum ('prohibido', 'estafa', 'ofensivo', 'spam', 'otro');
