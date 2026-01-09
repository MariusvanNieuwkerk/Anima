# 🐺 ANIMA MASTER BLUEPRINT V2.2 - Visie & Techniek

## 1. De Anima Filosofie (De Visie)
- **AI als Tutor, niet als Antwoordenmachine:** De AI geeft nooit direct het antwoord, maar begeleidt het kind via de Socratische methode (vragen stellen en hints geven).
- **Veiligheid & Vertrouwen:** Anima is een veilige vriend met een groei-mindset. Fouten maken mag en wordt aangemoedigd.
- **Visueel & Interactief:** Het 'Bord' is de plek waar abstracte concepten visueel worden gemaakt. De chat en het bord vormen één vloeiende leerervaring.
- **Drie-eenheid:** Anima verbindt het Kind (leren), de Ouder (welzijn/groei) en de Leraar (data/inzicht) in één ecosysteem.

## 2. Interface Architectuur (The Unified Layout)
- **Sidebar (Vast op Desktop, Drawer op Mobiel):**
    - Enige logo-locatie: Bovenaan de sidebar. Klik = Home/Chat reset.
    - Navigatie: "Ouder Dashboard", "Leraren Dashboard", "Settings".
- **Universele Header (Sticky):**
    - Zichtbaar op alle pagina's. Bevat Hamburger (mobiel), Logo (mobiel) en de knop `← Terug naar de les` op dashboards.
- **Content Area:** - Achtergrond: `bg-slate-50/50`. Dashboards gecentreerd via `max-w-5xl mx-auto`.
    - Desktop Home: Exacte 50/50 split tussen Chat en Bord.

## 3. Gebruikersrollen & Privacy
- **Kind:** Toegang tot Chat/Bord. Geen toegang tot volwassen data.
- **Ouder:** Inzicht in emoties, leerdoelen en globale groei. Geen letterlijke chat-logs om de privacy van het kind te borgen.
- **Leraar:** "Leerling Monitor" met stoplicht-systeem (wie heeft nu hulp nodig?). Focus op klasbrede prestaties en knelpunten.

## 4. Technische UX & Development Regels
- **State Management:** Gebruik `activeView` en `activeTab` voor navigatie. Geen nieuwe routering (urls) introduceren.
- **Componenten-Structuur:** Voorlopig alles centraal in `app/page.tsx` voor snelle iteratie.
- **"Geen Rode Balken" Regel:** Gebruik strikte `try-catch` blokken bij API-aanroepen. Technische fouten mogen nooit de UI verstoren.
- **Scroll-gedrag:** Desktop is `h-screen overflow-hidden` met onafhankelijk scrollbare kolommen. Mobiel/Tablet is volledig scrollbaar (`min-h-screen`).
- **Taal:** De interface is 100% Nederlands.

## 5. Roadmap naar V3 (De Backend)
1. **Supabase Setup:** ✅ **VOLTOOID** - Database schema aangemaakt (`supabase/seed.sql`). Auth-schema nog in te richten voor Kind, Ouder en Leraar.
2. **Database Koppeling:** ✅ **VOLTOOID** - Levels worden opgeslagen in `profiles` tabel. Chatberichten worden real-time opgeslagen in `chats` tabel. Bord-status (excalidraw/canvas) opslaan per sessie nog te implementeren.
3. **Dashboards Activeren:** ✅ **VOLTOOID** - Ouder Dashboard toont nu real-time data uit de database (Focus-tijd, Sessies, Beheerste onderwerpen). Leraren Dashboard nog te activeren met klasdata.
4. **Beveiliging:** Toegangsslot (Pincode/Auth) op de dashboard-ingangen.