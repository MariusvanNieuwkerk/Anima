-- Demo / onboarding: start with 10 image credits by default

alter table if exists public.profiles
  add column if not exists image_credits integer;

alter table if exists public.profiles
  alter column image_credits set default 10;

-- Backfill only missing values (do not overwrite existing credit balances)
update public.profiles
set image_credits = 10
where image_credits is null;


