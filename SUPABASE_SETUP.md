# Supabase Setup Instructies

Deze applicatie gebruikt Supabase voor het opslaan van chats (geheugen) en foto-uploads.

## Stappen om Supabase aan te sluiten:

### 1. Supabase Project aanmaken
1. Ga naar [supabase.com](https://supabase.com) en maak een account aan (gratis)
2. Maak een nieuw project aan
3. Noteer je project URL en API keys

### 2. Environment Variables instellen
Maak een `.env.local` bestand in de root van het project met:

```env
NEXT_PUBLIC_SUPABASE_URL=je-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=je-anon-key
SUPABASE_SERVICE_ROLE_KEY=je-service-role-key (optioneel, voor server-side operaties)
```

Je vindt deze keys in je Supabase Dashboard onder Project Settings > API.

### 3. Database Schema aanmaken
1. Ga naar je Supabase Dashboard > SQL Editor
2. Open het bestand `supabase-schema.sql` in dit project
3. Kopieer de SQL en voer deze uit in de SQL Editor

Dit maakt de volgende tabellen aan:
- `chats` - Voor het opslaan van chat sessies
- `messages` - Voor het opslaan van individuele berichten
- `photo_uploads` - Voor metadata van geüploade foto's
- `user_profiles` - Voor gebruikersprofielen (optioneel)

### 4. Storage Bucket aanmaken
1. Ga naar je Supabase Dashboard > Storage
2. Klik op "New bucket"
3. Maak een bucket met de naam: `photos`
4. Stel in:
   - Public: `true` (of `false` als je signed URLs wilt gebruiken)
   - File size limit: `10MB` (of naar wens)
   - Allowed MIME types: `image/*`

### 5. Row Level Security (RLS)
Het schema bevat basis RLS policies. Voor productie gebruik moet je deze aanpassen naar je authenticatie systeem.

Momenteel zijn alle policies ingesteld op "allow all" - dit is alleen geschikt voor development.

### 6. Dependencies installeren
Run in de terminal:
```bash
npm install
```

Dit installeert `@supabase/supabase-js` (al toegevoegd aan package.json).

### 7. Test de integratie
1. Start de development server: `npm run dev`
2. Maak een profiel aan in de app
3. Start een chat - deze zou automatisch opgeslagen moeten worden in Supabase
4. Upload een foto - deze zou in de Storage bucket moeten verschijnen

## Troubleshooting

- **"Supabase environment variables are not set"**: Controleer of je `.env.local` bestand bestaat en de juiste keys bevat
- **Upload errors**: Controleer of de `photos` bucket bestaat en de juiste permissies heeft
- **Database errors**: Controleer of je het SQL schema correct hebt uitgevoerd

## Toekomstige verbeteringen

- Proper authentication systeem toevoegen (Supabase Auth)
- RLS policies verfijnen voor security
- User profiles synchroniseren met Supabase
- Chat history UI toevoegen om oude chats te bekijken

