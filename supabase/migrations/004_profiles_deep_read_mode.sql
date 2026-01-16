-- Phase 2: Parent controls
-- Add deep_read_mode flag to profiles (used by Parent dashboard toggle)

alter table if exists public.profiles
  add column if not exists deep_read_mode boolean not null default false;


