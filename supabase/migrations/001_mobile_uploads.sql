-- Mobile Uploads Table
-- Deze tabel wordt gebruikt voor de QR bridge tussen mobiel en desktop

CREATE TABLE IF NOT EXISTS mobile_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  image_path TEXT, -- Pad naar bestand in Storage (bijv. 'mobile-uploads/session-123.jpg')
  image_url TEXT, -- Publieke URL van het bestand
  image_data TEXT, -- Fallback: Base64 data (voor backwards compatibility)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index voor snelle queries op session_id
CREATE INDEX IF NOT EXISTS idx_mobile_uploads_session_id ON mobile_uploads(session_id);
CREATE INDEX IF NOT EXISTS idx_mobile_uploads_created_at ON mobile_uploads(created_at);

-- RLS Policies
-- ANONIEME inserts toestaan (zodat telefoon zonder login kan posten)
ALTER TABLE mobile_uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Iedereen kan INSERT (anoniem uploaden)
-- BELANGRIJK: session_id is verplicht (NOT NULL constraint), maar gebruiker hoeft niet ingelogd te zijn
CREATE POLICY "Allow anonymous inserts on mobile_uploads"
  ON mobile_uploads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    session_id IS NOT NULL AND 
    length(session_id) > 0
  );

-- Policy: Iedereen kan SELECT (om eigen uploads te lezen)
CREATE POLICY "Allow select on mobile_uploads"
  ON mobile_uploads
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Iedereen kan DELETE (om eigen uploads te verwijderen na verwerking)
CREATE POLICY "Allow delete on mobile_uploads"
  ON mobile_uploads
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- Storage Bucket Setup
-- Maak de 'chat-images' bucket aan (als deze nog niet bestaat)
-- Let op: Dit moet handmatig in Supabase Dashboard worden gedaan, of via de Storage API

-- RLS Policy voor Storage: Publieke uploads toestaan
-- Dit moet in Supabase Dashboard > Storage > Policies worden ingesteld:
-- Policy Name: "Allow public uploads to chat-images"
-- Policy Type: INSERT
-- Target Roles: anon, authenticated
-- Policy Definition: bucket_id = 'chat-images'
-- 
-- Policy Name: "Allow public reads from chat-images"
-- Policy Type: SELECT
-- Target Roles: anon, authenticated
-- Policy Definition: bucket_id = 'chat-images'

