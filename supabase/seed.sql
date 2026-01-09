-- ANIMA Database Schema - Definitief
-- Run deze SQL in je Supabase SQL Editor

-- Tabel voor gebruikersprofielen
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL, -- Lokale user ID (van localStorage)
  current_level INTEGER DEFAULT 1 CHECK (current_level >= 1 AND current_level <= 12),
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel voor chat historie
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Lokale user ID (van localStorage)
  message_text TEXT NOT NULL,
  is_ai BOOLEAN NOT NULL DEFAULT false,
  board_url TEXT, -- URL van afbeelding voor het bord
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes voor betere performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);

-- RLS (Row Level Security) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Policies: voor development - alle operaties toestaan (pas aan voor productie!)
-- In productie: gebruik Supabase Auth en pas policies aan op auth.uid()
DROP POLICY IF EXISTS "Enable all operations for profiles" ON profiles;
CREATE POLICY "Enable all operations for profiles" 
  ON profiles FOR ALL 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all operations for chats" ON chats;
CREATE POLICY "Enable all operations for chats" 
  ON chats FOR ALL 
  USING (true) 
  WITH CHECK (true);
