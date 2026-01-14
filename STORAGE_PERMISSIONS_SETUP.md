# Storage Permissions Setup Guide

## Probleem
De mobile upload faalt met "Upload mislukt" omdat anonieme gebruikers (telefoons) geen rechten hebben om te uploaden naar Storage.

## Oplossing

### Stap 1: Maak de Storage Bucket aan

1. Ga naar **Supabase Dashboard** > **Storage**
2. Klik op **"New bucket"**
3. Vul in:
   - **Naam**: `chat-images`
   - **Public bucket**: **AAN** ✅ (Dit is cruciaal voor anonieme uploads!)
   - **File size limit**: `5MB` (of hoger)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp`
4. Klik op **"Create bucket"**

### Stap 2: Voeg Storage Policies toe

Ga naar **Supabase Dashboard** > **Storage** > **Policies** > **chat-images**

#### Policy 1: Allow Anonymous Uploads (INSERT)

- **Policy Name**: `Allow Anonymous Uploads`
- **Policy Type**: `INSERT`
- **Target Roles**: `anon`, `authenticated`
- **Policy Definition** (SQL):
  ```sql
  bucket_id = 'chat-images'
  ```
- Klik op **"Review"** en dan **"Save policy"**

#### Policy 2: Allow Public Reads (SELECT)

- **Policy Name**: `Allow Public Reads from chat-images`
- **Policy Type**: `SELECT`
- **Target Roles**: `anon`, `authenticated`
- **Policy Definition** (SQL):
  ```sql
  bucket_id = 'chat-images'
  ```
- Klik op **"Review"** en dan **"Save policy"**

#### Policy 3: Allow Deletes (voor cleanup)

- **Policy Name**: `Allow Deletes from chat-images`
- **Policy Type**: `DELETE`
- **Target Roles**: `anon`, `authenticated`
- **Policy Definition** (SQL):
  ```sql
  bucket_id = 'chat-images'
  ```
- Klik op **"Review"** en dan **"Save policy"**

### Stap 3: Verifieer Database Policies

Run de SQL migratie in **Supabase Dashboard** > **SQL Editor**:

```sql
-- Zie: supabase/migrations/001_mobile_uploads.sql
-- Deze migratie zorgt dat anonieme gebruikers kunnen INSERT in mobile_uploads
```

Of run via Supabase CLI:
```bash
supabase db push
```

### Stap 4: Test de Upload

1. **Desktop**: Open de app en klik op "Scan met Telefoon" (QR-code verschijnt)
2. **Mobiel**: Scan de QR-code met je telefoon camera
3. **Mobiel**: Maak een foto of selecteer een bestand
4. **Mobiel**: Klik op "Verstuur naar Laptop"
5. **Check**: Als het faalt, kijk naar de specifieke error message in de app

## Troubleshooting

### "Storage upload mislukt (403): Permission denied"
- **Oorzaak**: De Storage bucket heeft geen INSERT policy voor `anon` rol
- **Oplossing**: Voeg Policy 1 toe (zie Stap 2)

### "Storage upload mislukt (404): Bucket not found"
- **Oorzaak**: De bucket `chat-images` bestaat niet
- **Oplossing**: Maak de bucket aan (zie Stap 1)

### "Database insert mislukt (42501): new row violates row-level security policy"
- **Oorzaak**: De `mobile_uploads` tabel heeft geen INSERT policy voor `anon` rol
- **Oplossing**: Run de SQL migratie (zie Stap 3)

### "Database insert mislukt: session_id is required"
- **Oorzaak**: De `session_id` wordt niet meegegeven
- **Oplossing**: Check of de QR-code de juiste URL bevat met `?s=...` parameter

## Verificatie Checklist

- [ ] Bucket `chat-images` bestaat en is **publiek**
- [ ] Policy "Allow Anonymous Uploads" (INSERT) is toegevoegd
- [ ] Policy "Allow Public Reads" (SELECT) is toegevoegd
- [ ] Policy "Allow Deletes" (DELETE) is toegevoegd
- [ ] Database policy voor `mobile_uploads` INSERT is actief
- [ ] Test upload werkt in incognito venster (anonieme sessie)

## Belangrijke Notities

1. **Public Bucket**: De bucket MOET publiek zijn voor anonieme uploads
2. **RLS Policies**: Zowel Storage als Database moeten policies hebben voor `anon` rol
3. **Session ID**: De `session_id` is verplicht, maar de gebruiker hoeft niet ingelogd te zijn
4. **Error Messages**: De app toont nu specifieke error messages voor betere debugging

