-- Adds display_name to profiles for older DBs.
-- Safe to run multiple times.

alter table if exists public.profiles
  add column if not exists display_name text;

create index if not exists profiles_display_name_idx on public.profiles(display_name);


