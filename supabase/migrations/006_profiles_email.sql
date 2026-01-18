-- Phase 2: Roblox auth model compatibility
-- Some existing Supabase templates don't include an `email` column on public.profiles.
-- Our app uses `profiles.email` for:
-- - proxy-email mapping for student accounts ([username]@student.anima.app)
-- - display_name backfill fallbacks
--
-- This migration adds a nullable email column.

alter table if exists public.profiles
  add column if not exists email text;

-- Optional index for lookups (not unique; multiple profiles could share email in edge cases)
create index if not exists profiles_email_idx on public.profiles(email);


