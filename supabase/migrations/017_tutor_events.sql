-- Observability: tutor_events — per beurt loggen wat er echt gebeurde.
-- Drie doelen (zie roadmap stap 3):
--   1. Kwaliteitsbewaking: welke canon leidt vaak tot "stuck"?
--   2. Roadmap op data: welke vragen vallen door naar de LLM?
--   3. Leerprofiel/moat: dezelfde events voeden het ouderdashboard.
-- Schrijven gebeurt ALLEEN server-side (service role). Lezen: eigen
-- events + ouders lezen events van gekoppelde kinderen.

create table if not exists public.tutor_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text,
  -- Welke laag beantwoordde deze beurt?
  --   'canon'   = deterministische reken-state machine
  --   'grammar' = grammatica-canon (via tutorPolicy preflight)
  --   'policy'  = andere deterministische preflight (stop/ack/closures)
  --   'llm'     = Gemini
  --   'error'   = backend-fout (fallback-bericht getoond)
  route text not null,
  canon_kind text,   -- bv. 'money_discount_vat' of grammatica-topic
  step text,         -- canon-stap (bv. 'disc_unit')
  result text,       -- 'start' | 'continue' | 'done' | 'stuck' | null
  user_text text,    -- ingekort (max ~300 tekens)
  assistant_text text -- ingekort (max ~300 tekens)
);

create index if not exists tutor_events_user_created_idx
  on public.tutor_events (user_id, created_at desc);

alter table public.tutor_events enable row level security;

-- Geen insert/update/delete policies: alleen de server (service role)
-- schrijft events. anon heeft nergens toegang.
revoke all on public.tutor_events from anon;

drop policy if exists "Own events read" on public.tutor_events;
create policy "Own events read"
  on public.tutor_events
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Parents read linked children events" on public.tutor_events;
create policy "Parents read linked children events"
  on public.tutor_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = tutor_events.user_id
    )
  );
