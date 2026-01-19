-- Baseline / Reset-proof schema for Anima
-- Use this if tables/columns were deleted manually in Supabase.
-- Safe to run multiple times.

-- 1) PROFILES: ensure table exists with required columns
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student',
  display_name text,
  username text,
  email text,
  student_name text,
  parent_name text,
  teacher_name text,
  avatar_url text,
  deep_read_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure required columns exist (if the table exists but is missing columns)
alter table if exists public.profiles
  add column if not exists role text not null default 'student';
alter table if exists public.profiles
  add column if not exists display_name text;
alter table if exists public.profiles
  add column if not exists username text;
alter table if exists public.profiles
  add column if not exists email text;
alter table if exists public.profiles
  add column if not exists student_name text;
alter table if exists public.profiles
  add column if not exists parent_name text;
alter table if exists public.profiles
  add column if not exists teacher_name text;
alter table if exists public.profiles
  add column if not exists avatar_url text;
alter table if exists public.profiles
  add column if not exists deep_read_mode boolean not null default false;
alter table if exists public.profiles
  add column if not exists created_at timestamptz not null default now();
alter table if exists public.profiles
  add column if not exists updated_at timestamptz not null default now();

-- Role constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('student', 'parent', 'teacher'));
  end if;
end $$;

-- Username: case-insensitive uniqueness (nullable)
create unique index if not exists profiles_username_lower_unique
  on public.profiles ((lower(username)))
  where username is not null and length(trim(username)) > 0;

create index if not exists profiles_email_idx on public.profiles(email);

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- RLS: users can read/update their own profile
alter table public.profiles enable row level security;

drop policy if exists "Profiles: read own" on public.profiles;
create policy "Profiles: read own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Profiles: update own" on public.profiles;
create policy "Profiles: update own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2) FAMILY LINKS: ensure table exists + RLS
create table if not exists public.family_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint family_links_parent_child_unique unique (parent_id, child_id),
  constraint family_links_no_self check (parent_id <> child_id)
);

create index if not exists family_links_parent_id_idx on public.family_links(parent_id);
create index if not exists family_links_child_id_idx on public.family_links(child_id);

alter table public.family_links enable row level security;

drop policy if exists "Parents can read their family links" on public.family_links;
create policy "Parents can read their family links"
  on public.family_links
  for select
  to authenticated
  using (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
  );

drop policy if exists "Parents can create family links" on public.family_links;
create policy "Parents can create family links"
  on public.family_links
  for insert
  to authenticated
  with check (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
  );

drop policy if exists "Parents can delete their family links" on public.family_links;
create policy "Parents can delete their family links"
  on public.family_links
  for delete
  to authenticated
  using (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
  );

-- PostgREST schema cache refresh (run manually if needed):
-- notify pgrst, 'reload schema';


