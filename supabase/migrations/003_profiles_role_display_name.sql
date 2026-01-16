-- Phase 2: Auth & Roles
-- Ensure profiles has a role + display_name for role-based routing.

-- 1) Add columns (safe if rerun)
alter table if exists public.profiles
  add column if not exists role text not null default 'student';

alter table if exists public.profiles
  add column if not exists display_name text;

-- 2) Role constraint (safe-ish: only adds if missing)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('student', 'parent', 'teacher'));
  end if;
end $$;

-- 3) Backfill display_name if empty
update public.profiles
set display_name = coalesce(
  nullif(display_name, ''),
  nullif(student_name, ''),
  nullif(parent_name, ''),
  nullif(teacher_name, ''),
  split_part(email, '@', 1)
)
where display_name is null or display_name = '';


