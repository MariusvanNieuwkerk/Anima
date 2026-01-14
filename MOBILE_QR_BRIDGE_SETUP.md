# Mobile QR Bridge Setup Guide

## Overzicht
De Mobile QR Bridge maakt het mogelijk om foto's van een mobiel apparaat naar de desktop/laptop te sturen via een QR-code.

## Database Setup

### 1. Run de SQL Migration
Voer de SQL migratie uit in Supabase Dashboard > SQL Editor:

```sql
-- Zie: supabase/migrations/001_mobile_uploads.sql
```

Of run via Supabase CLI:
```bash
supabase db push
```

### 2. Storage Bucket Setup

**Stap 1: Maak de bucket aan**
1. Ga naar Supabase Dashboard > Storage
2. Klik op "New bucket"
3. Naam: `chat-images`
4. Public bucket: **AAN** (zodat anonieme uploads mogelijk zijn)
5. File size limit: 5MB (of hoger)
6. Allowed MIME types: `image/jpeg, image/png, image/webp`

**Stap 2: RLS Policies voor Storage**

Voeg deze policies toe in Supabase Dashboard > Storage > Policies:

**Policy 1: Allow public uploads**
- Policy Name: `Allow public uploads to chat-images`
- Policy Type: `INSERT`
- Target Roles: `anon`, `authenticated`
- Policy Definition:
  ```sql
  bucket_id = 'chat-images'
  ```

**Policy 2: Allow public reads**
- Policy Name: `Allow public reads from chat-images`
- Policy Type: `SELECT`
- Target Roles: `anon`, `authenticated`
- Policy Definition:
  ```sql
  bucket_id = 'chat-images'
  ```

**Policy 3: Allow deletes (voor cleanup)**
- Policy Name: `Allow deletes from chat-images`
- Policy Type: `DELETE`
- Target Roles: `anon`, `authenticated`
- Policy Definition:
  ```sql
  bucket_id = 'chat-images'
  ```

## Realtime Setup

De Realtime listener in `Workspace.tsx` gebruikt Supabase Realtime. Zorg dat:
1. Realtime is ingeschakeld in Supabase Dashboard > Settings > API
2. De `mobile_uploads` tabel heeft Realtime enabled (automatisch bij INSERT events)

## Testen

1. **Desktop**: Open de app en klik op "Scan met Telefoon" (QR-code verschijnt)
2. **Mobiel**: Scan de QR-code met je telefoon camera
3. **Mobiel**: Maak een foto of selecteer een bestand
4. **Mobiel**: Klik op "Verstuur naar Laptop"
5. **Desktop**: De foto zou automatisch moeten verschijnen in de chat previews

## Troubleshooting

### Foto's verschijnen niet op desktop
- Check de browser console voor errors
- Verify dat Realtime subscription status "SUBSCRIBED" is
- Check Supabase Dashboard > Realtime > Logs voor events

### Upload faalt op mobiel
- Check of de Storage bucket `chat-images` bestaat en publiek is
- Verify RLS policies voor Storage zijn correct ingesteld
- Check browser console voor specifieke error messages

### Realtime events komen niet aan
- Verify Realtime is enabled in Supabase Dashboard
- Check of de `mobile_uploads` tabel Realtime heeft enabled
- Verify de session_id matcht tussen mobiel en desktop

