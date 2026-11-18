// Applies supabase/migrations and the seed to an in-memory Postgres (PGlite +
// PostGIS) and runs the SQL tests in supabase/tests. Nothing leaves this machine:
// no Supabase project is contacted. The Supabase-only pieces (auth, storage,
// pg_net, pg_cron, roles) are replaced by the stubs below, so this checks the
// SQL of the migrations and the policies, not the hosted platform.
// Usage: npm run test:db
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tests = process.argv.length > 2 ? process.argv.slice(2) : ['supabase/tests/rls_smoke.sql', 'supabase/tests/state_machine.sql'];
const pg = new PGlite({ extensions: { postgis, pg_trgm, unaccent } });

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage; create schema net; create schema cron; create schema extensions;
create table auth.users (id uuid primary key, instance_id uuid, aud text, role text, email text, phone text,
  phone_confirmed_at timestamptz, email_confirmed_at timestamptz, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claims', true)::json ->> 'role' $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $$ select 1::bigint $$;
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$ select 1::bigint $$;
create function cron.unschedule(job_name text) returns boolean language sql as $$ select true $$;
create table cron.job (jobid bigint, jobname text);
grant usage on schema public, auth, storage, net, cron to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant select on auth.users to authenticated;
grant all on storage.objects, storage.buckets to authenticated, anon;
create publication supabase_realtime;
`;
await pg.exec(STUBS);

const dir = path.join(root, 'supabase/migrations');
for (const f of fs.readdirSync(dir).sort()) {
  let sql = fs.readFileSync(path.join(dir, f), 'utf8');
  sql = sql.replace(/create extension if not exists (pg_net|pg_cron)[^;]*;/g, '-- $1 stubbed');
  try {
    await pg.exec(sql);
    console.log('applied', f);
  } catch (e) {
    console.error('FAILED', f, '\n ', e.message, e.where ?? '', e.position ? `pos ${e.position}: ${sql.slice(Math.max(0, e.position - 120), +e.position + 80)}` : '');
    process.exit(1);
  }
}
const seed = path.join(root, 'supabase/seed.sql');
if (fs.existsSync(seed)) { try { await pg.exec(fs.readFileSync(seed, 'utf8')); console.log('applied seed.sql'); } catch (e) { console.error('seed FAILED', e.message); process.exit(1); } }

for (const t of tests) {
  const sql = fs.readFileSync(path.join(root, t), 'utf8');
  try {
    await pg.exec(sql, { onNotice: (n) => console.log('  ', n.message) });
    console.log('test ok', t);
  } catch (e) {
    console.error('TEST FAILED', t, '\n ', e.message, e.where ?? '');
    try { await pg.exec('rollback'); } catch {}
    process.exitCode = 1;
  }
}
