-- Persist deterministic tutor state (state machine) per session_id.
-- This avoids inferring state from chat text and enables robust step progression.

create table if not exists public.tutor_sessions (
  session_id text primary key,
  user_id uuid null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists tutor_sessions_user_id_updated_at_idx
  on public.tutor_sessions(user_id, updated_at desc);

create index if not exists tutor_sessions_updated_at_idx
  on public.tutor_sessions(updated_at desc);

alter table public.tutor_sessions enable row level security;

