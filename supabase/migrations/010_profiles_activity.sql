-- Track recent activity for dashboards.
-- Safe to run multiple times.

alter table if exists public.profiles
  add column if not exists last_session_id text;

alter table if exists public.profiles
  add column if not exists last_active_at timestamptz;

create index if not exists profiles_last_active_at_idx on public.profiles(last_active_at desc);


