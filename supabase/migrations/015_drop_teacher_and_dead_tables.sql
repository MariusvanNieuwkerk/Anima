-- Gezinsproduct: teacher-spoor en dode tabellen verwijderd.
-- Toegepast op productie op 2026-06-11 (via MCP, migratie "drop_teacher_and_dead_tables").
--
-- classrooms / classroom_students: teacher-feature, leeg, code verwijderd.
-- visual_misses: oude debug-logging, leeg, code verwijderd.
-- insights: oud test-systeem (6 testrijen), route verwijderd.

drop table if exists public.classroom_students;
drop table if exists public.classrooms;
drop table if exists public.visual_misses;
drop table if exists public.insights;
