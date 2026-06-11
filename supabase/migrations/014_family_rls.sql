-- Gezinsproduct: Row Level Security op alle kern-tabellen.
-- Principe: data is eigendom van het gezin.
--   - Iedereen ziet/bewerkt alleen zijn EIGEN profiel en berichten.
--   - Ouders zien daarnaast de profielen en berichten van hun GEKOPPELDE kinderen.
--   - tutor_sessions blijft service-role-only (geen client policies).
-- Veilig om meerdere keren te draaien.

-- =====================================================================
-- 1) PROFILES
-- =====================================================================
alter table public.profiles enable row level security;

drop policy if exists "Own profile read" on public.profiles;
create policy "Own profile read"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Parents read linked children profiles" on public.profiles;
create policy "Parents read linked children profiles"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = profiles.id
    )
  );

drop policy if exists "Own profile update" on public.profiles;
create policy "Own profile update"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Geen insert/delete via de client: profielen worden server-side
-- (service role) aangemaakt en verwijderd.

-- =====================================================================
-- 2) MESSAGES
-- =====================================================================
alter table public.messages enable row level security;

drop policy if exists "Own messages read" on public.messages;
create policy "Own messages read"
  on public.messages
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Parents read linked children messages" on public.messages;
create policy "Parents read linked children messages"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.family_links fl
      where fl.parent_id = auth.uid()
        and fl.child_id = messages.user_id
    )
  );

drop policy if exists "Own messages insert" on public.messages;
create policy "Own messages insert"
  on public.messages
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Geen update/delete via de client. Verwijderen van gezinsdata loopt
-- via de ouder-acties (service role) zodat het compleet en consistent is.

-- =====================================================================
-- 3) TUTOR_SESSIONS
-- =====================================================================
-- RLS staat al aan (migratie 013) en er zijn bewust GEEN policies:
-- alleen de server (service role) leest/schrijft tutor-state.
alter table public.tutor_sessions enable row level security;

-- =====================================================================
-- 4) MOBILE_UPLOADS (QR-bridge) - opruimen van te brede policies
-- =====================================================================
-- Insert blijft anoniem mogelijk (telefoon zonder login), maar select
-- en delete waren USING (true) voor iedereen. De session_id (random
-- UUID) is het capability-token; zonder kolomfilter kan dat niet in
-- RLS worden afgedwongen. We beperken select/delete tot rijen jonger
-- dan 1 uur zodat de tabel niet als doorzoekbaar archief kan dienen.
drop policy if exists "Allow select on mobile_uploads" on public.mobile_uploads;
create policy "Allow select on recent mobile_uploads"
  on public.mobile_uploads
  for select
  to anon, authenticated
  using (created_at > now() - interval '1 hour');

drop policy if exists "Allow delete on mobile_uploads" on public.mobile_uploads;
create policy "Allow delete on recent mobile_uploads"
  on public.mobile_uploads
  for delete
  to anon, authenticated
  using (created_at > now() - interval '1 hour');
