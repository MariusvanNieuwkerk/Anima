-- Storage Policies voor Mobile Uploads
-- Deze policies zorgen dat anonieme gebruikers (telefoons) kunnen uploaden naar Storage

-- BELANGRIJK: Storage policies kunnen NIET via SQL worden aangemaakt in Supabase.
-- Je moet deze handmatig instellen in Supabase Dashboard > Storage > Policies.
-- 
-- Maar we kunnen wel de bucket aanmaken en configureren via de Storage API of Dashboard.
-- Deze migratie bevat de exacte SQL die je nodig hebt voor de policies.

-- ============================================
-- STORAGE BUCKET SETUP (via Dashboard)
-- ============================================
-- 1. Ga naar Supabase Dashboard > Storage
-- 2. Klik op "New bucket"
-- 3. Naam: `chat-images`
-- 4. Public bucket: **AAN** (zodat anonieme uploads mogelijk zijn)
-- 5. File size limit: 5MB (of hoger)
-- 6. Allowed MIME types: `image/jpeg, image/png, image/webp`

-- ============================================
-- STORAGE RLS POLICIES (via Dashboard)
-- ============================================
-- Ga naar Supabase Dashboard > Storage > Policies > chat-images
-- Voeg de volgende policies toe:

-- Policy 1: Allow Anonymous Uploads (INSERT)
-- Policy Name: "Allow Anonymous Uploads"
-- Policy Type: INSERT
-- Target Roles: anon, authenticated
-- Policy Definition (SQL):
--   bucket_id = 'chat-images'
-- 
-- Policy 2: Allow Public Reads (SELECT)
-- Policy Name: "Allow Public Reads from chat-images"
-- Policy Type: SELECT
-- Target Roles: anon, authenticated
-- Policy Definition (SQL):
--   bucket_id = 'chat-images'
--
-- Policy 3: Allow Deletes (voor cleanup)
-- Policy Name: "Allow Deletes from chat-images"
-- Policy Type: DELETE
-- Target Roles: anon, authenticated
-- Policy Definition (SQL):
--   bucket_id = 'chat-images'

-- ============================================
-- ALTERNATIEF: Via Supabase Management API
-- ============================================
-- Als je de Supabase Management API gebruikt, kun je deze policies programmatisch aanmaken.
-- Zie: https://supabase.com/docs/reference/api/creating-storage-policies

-- ============================================
-- VERIFICATIE
-- ============================================
-- Test of de policies werken:
-- 1. Open een incognito venster (anonieme sessie)
-- 2. Probeer een bestand te uploaden naar de 'chat-images' bucket
-- 3. Als het werkt, zijn de policies correct ingesteld

