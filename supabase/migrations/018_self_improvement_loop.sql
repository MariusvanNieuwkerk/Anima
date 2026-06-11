-- Zelfverbeterloop, met respect voor de data-eigendom-belofte:
--   1. anon_tutor_stats: ANONIEME tellers (geen user_id, geen tekst).
--      Vertelt WAAR het product hapert over alle gebruikers heen.
--   2. feedback_reports: expliciete schenkingen via duimpje-omlaag.
--      Bevat WEL inhoud, maar alleen omdat de gebruiker die ene beurt
--      bewust doorstuurde. Cascade delete: "verwijder alles" blijft waar.

-- =====================================================================
-- 1) ANON_TUTOR_STATS — tellers per dag/route/canon/stap/resultaat
-- =====================================================================
create table if not exists public.anon_tutor_stats (
  day date not null,
  route text not null,
  canon_kind text not null default '',
  step text not null default '',
  result text not null default '',
  n bigint not null default 0,
  primary key (day, route, canon_kind, step, result)
);

alter table public.anon_tutor_stats enable row level security;
-- Geen policies: alleen de server (service role) leest en schrijft.
revoke all on public.anon_tutor_stats from anon, authenticated;

-- Atomisch optellen (Supabase JS upsert kan geen "n = n + 1").
create or replace function public.bump_anon_tutor_stat(
  p_route text,
  p_canon_kind text,
  p_step text,
  p_result text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.anon_tutor_stats (day, route, canon_kind, step, result, n)
  values (current_date, p_route, coalesce(p_canon_kind, ''), coalesce(p_step, ''), coalesce(p_result, ''), 1)
  on conflict (day, route, canon_kind, step, result)
  do update set n = anon_tutor_stats.n + 1;
$$;

revoke execute on function public.bump_anon_tutor_stat(text, text, text, text) from public, anon, authenticated;

-- =====================================================================
-- 2) FEEDBACK_REPORTS — bewust geschonken beurten (duimpje omlaag)
-- =====================================================================
create table if not exists public.feedback_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text,
  user_text text,
  assistant_text text
);

alter table public.feedback_reports enable row level security;
-- Schrijven loopt via de API (service role); geen client-toegang.
revoke all on public.feedback_reports from anon, authenticated;
