-- Phase 2: Auth (Roblox Model) + Family Structure
-- One login screen:
-- - Parents login with email
-- - Children login with username (mapped to a system email on the backend)
--
-- This migration adds:
-- 1) profiles.username (nullable, unique/case-insensitive)
-- 2) family_links table to link parent profiles <-> child profiles

-- 1) profiles.username (nullable)
alter table if exists public.profiles
  add column if not exists username text;

-- Case-insensitive uniqueness for usernames (allows multiple NULLs; blocks duplicates like "Rens" vs "rens")
create unique index if not exists profiles_username_lower_unique
  on public.profiles ((lower(username)))
  where username is not null and length(trim(username)) > 0;

-- 2) family_links (parent <-> child)
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

-- RLS: parent can only see/manage rows where they are the parent_id
alter table public.family_links enable row level security;

-- Read
drop policy if exists "Parents can read their family links" on public.family_links;
create policy "Parents can read their family links"
  on public.family_links
  for select
  to authenticated
  using (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
  );

-- Create
drop policy if exists "Parents can create family links" on public.family_links;
create policy "Parents can create family links"
  on public.family_links
  for insert
  to authenticated
  with check (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
  );

-- Update (rare, but keep locked down)
drop policy if exists "Parents can update their family links" on public.family_links;
create policy "Parents can update their family links"
  on public.family_links
  for update
  to authenticated
  using (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
  )
  with check (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
  );

-- Delete
drop policy if exists "Parents can delete their family links" on public.family_links;
create policy "Parents can delete their family links"
  on public.family_links
  for delete
  to authenticated
  using (
    parent_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent')
  );


