-- Attach messages to a user (student) so dashboards can show real learning activity.
-- Safe to run multiple times.

alter table if exists public.messages
  add column if not exists user_id uuid;

alter table if exists public.messages
  add column if not exists topic text;

create index if not exists messages_user_id_created_at_idx
  on public.messages(user_id, created_at desc);

create index if not exists messages_session_id_created_at_idx
  on public.messages(session_id, created_at asc);


