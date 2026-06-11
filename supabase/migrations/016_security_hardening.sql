-- Security hardening n.a.v. Supabase security advisors.
-- Toegepast op productie op 2026-06-11 (via MCP, migratie "security_hardening").

-- 1) handle_new_user: vaste search_path + niet aanroepbaar via de API.
--    (De trigger blijft gewoon werken; die draait als eigenaar.)
alter function public.handle_new_user() set search_path = public, pg_temp;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2) Storage: list-policy op de publieke uploads-bucket is niet nodig
--    (de app gebruikt alleen publieke object-URLs, geen listing).
drop policy if exists "Iedereen mag plaatjes zien" on storage.objects;

-- 3) Niet-ingelogde bezoekers hoeven deze tabellen niet eens te zien
--    (RLS beschermt al; dit haalt ze ook uit het GraphQL/REST-schema voor anon).
revoke all on public.profiles from anon;
revoke all on public.messages from anon;
revoke all on public.family_links from anon;
-- QR-bridge: telefoon (anon) mag alleen INSERTen, niet lezen.
revoke select on public.mobile_uploads from anon;

-- 4) tutor_sessions is service-role-only: helemaal geen client-toegang.
revoke all on public.tutor_sessions from anon, authenticated;
