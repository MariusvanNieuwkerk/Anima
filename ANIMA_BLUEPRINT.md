📘 ANIMA BLUEPRINT V5.4 (Revision: Hybrid Visuals)
Datum: 15 Januari 2026 Kernfilosofie: "Warm Inzicht boven Kille Data" & "Robuustheid boven Perfectie"

1. De Anima Filosofie
AI als Tutor: Anima is een 'Scaffolded Guide'. Ze biedt eerst heldere uitleg en structuur (de methode), maar houdt het eindantwoord achter totdat het kind het zelf heeft geprobeerd.

De "Escape Hatch" (Genuanceerd): We bewaken de balans tussen uitdagen en frustreren. De ontsnapping is strategisch (regel, analogie of voorzetje), afhankelijk van de gekozen modus.

De "Anti-Sorry" Regel: Een tutor verontschuldigt zich niet voor kort of streng zijn; de intentie is pedagogisch.

Instant Responsiviteit: We optimaliseren voor snelheid (Low Latency). De gebruiker mag nooit wachten op een "denkende" server zonder feedback.

Multimodaal Begrip: Anima "ziet" huiswerk via Vision voor gerichte hulp, mits toegestaan door de ouder.

Visuele Strategie (The Hybrid Visual Engine): We combineren de authenticiteit van fotografie met de flexibiliteit van Generatieve AI.

Tier 1 (Snelheid & Feit): Unsplash. Voor bestaande objecten (dieren, plaatsen) gebruiken we echte fotografie. Dit is snel en gratis.

Tier 2 (Maatwerk & Uitleg): Flux AI (via Replicate). Voor abstracte concepten, specifieke diagrammen of historische scènes genereren we on-the-fly een nieuwe afbeelding. Dit is de "Magic" laag (Premium feature).

Kwaliteits-Loop: We dwingen de AI tot fotorealistische en educatieve prompts ("educational diagram", "macro photography") om hallucinaties te beperken.

Prikkelarm & Warm Design: Geen kille tech-look, maar een tactiel "Paper Feel". Kleurenpalet verschuift van Slate (koud) naar Stone (warm).

Fail-Safe: Stil falen bij technische errors met relevante placeholders. Geen agressieve rode foutmeldingen. "Graceful Degradation" is de norm.

Global & Inclusive: Anima is er voor iedereen. Universele leeftijd-instelling en meertaligheid zitten in de kern.

2. User Roles & Separation of Concerns (The Tri-App Strategy)
Om datavervuiling te voorkomen en pedagogische doelen te halen, zien de drie gebruikersgroepen een totaal andere interface:

A. Het Kind ("De Maker")

Doel: Flow & Focus.

Interface: Direct op het bureau (Chat + Board). Geen administratie.

Navigatie: Master Menu (linksboven) vervangt vaste zijbalken. Toont Profiel, Coach-keuze en Settings.

Input: Smart Paperclip met "Mobile Bridge".

Mobiel/Tablet: Opent direct de native camera.

Desktop: Toont QR-code om telefoon tijdelijk als scanner te gebruiken.

Rechten: Read/Write Chat.

B. De Ouder ("De Toeschouwer")

Doel: Geruststelling & Emotional ROI.

Interface: "De Nieuwsbrief" / "Glow Feed".

Data: Proces-data i.p.v. harde cijfers.

Visuals: Flow Meter (Worsteling vs. In de Zone) & Focus Cirkel.

Interactie: Gespreksstarters ("Vraag Rens hoe hij de breuk oploste").

Rechten: Read-Only. Kan niet chatten (voorkomt data-vervuiling). Wel toegang tot instellingen (Diep-Lees Modus).

C. De Leraar ("De Regisseur")

Doel: Inzicht & Sturing.

Interface: "Het Klembord".

Overzicht: Insight Cards (Top 3 Knelpunten, bijv. "12 leerlingen vast op Breuken").

Detail: Klassenlijst (Lijstweergave met status-badges, geen tegels).

Diepte: AI Diagnose per leerling (Pedagogische samenvatting, geen chatlogs).

Rechten: Topics pushen ("Focus morgen op breuken"). Geen inzage in privé-chats.

3. Technische Architectuur & Data
State Management: SPA in app/page.tsx met strikte scheiding via activeView en Role-based returns.

AI Core Strategy:

Model: Google Gemini 2.0 Flash (Text & Vision).

System Prompts: 3 unieke Hard-coded System Prompts (Focus/Verkenner/Groei), aangestuurd door variabele Leeftijd.

Visual Engine (The Hybrid Engine):

Generative AI (Premium): Flux Schnell via Replicate API. Geoptimaliseerd voor snelheid (<1s) en kosten (€0,0028/img). Prompts worden strikt gestuurd (safety filters uit, educational filters aan).

Stock Photography (Base): Unsplash API met Power Keyword Engineering.

Logging: Robuuste error-handling. Als Replicate faalt (billing/downtime), valt het systeem stilzwijgend terug op Unsplash of een tekst-placeholder.

Vision Pipeline: Client (Mobile/QR) -> Supabase Storage -> Gemini Vision -> Antwoord.

Hosting: Vercel (Production).

Database: Supabase (tabellen: chats, mobile_uploads & visual_misses). Strikte scheiding tussen gebruikers-ID's.

4. UI & Design System (The "Digital Desk")
Atmosfeer: Warm & Tactiel. Basis is bg-stone-50 (Warm Grijs/Zand). Containers zijn wit met border-stone-200 en zachte schaduwen.

Desktop Layout: Gecentreerde "Container Focus" (max-w-6xl). Voelt niet 'uitgerekt'. Linksboven zwevende Menu knop.

Mobile Layout: Full-screen focus met Capsule Switch (Chat | Board).

The Board:

Visuele stijl: Dot Grid (stippenraster) achtergrond (stone-200).

Empty State: Groot potlood-icoon + tekst "Ik wacht op je idee...".

Navigation:

Kind: Hamburger menu (Slide-over drawer met Settings/Profiel) en Input Dock (vast onderaan).

Ouder/Leraar: Aparte dashboard layouts (Brief & Klembord).

5. Interactie-Details & Intelligentie 💡
A. De 3 Tutor Modi (Instelbaar door Kind) Het kind kiest zijn eigen "Coach Stijl" in het Master Menu:

⚡️ Focus (De Trainer): Kort, zakelijk, geen emojis. Escape: De Regel-Hint.

🧭 Verkenner (De Gids) - Default: Nieuwsgierig, onderzoekend. Escape: De Analogie.

🌱 Groei (Het Maatje): Warm, geduldig, emojis. Escape: Scaffolding (Samen starten).

B. Global Scaling (De Smart Slider)

Smart Age Slider: Een slider van 6 tot 18+. Ouders stellen dit eenmalig in.

AI Impact: De leeftijd stuurt de toon en complexiteit van de System Prompt.

Taal: Zoekbare lijst (NL, EN, ES, etc.).

C. Ouderlijke Controle: "Diep-Lees Modus"

Functie: Schakelt de camera/upload knop uit.

Doel: Dwingt het kind tot vertragen en typen (begrijpend lezen) i.p.v. scannen en rennen.

6. Gerealiseerde Milestones
[x] Vercel Deployment: Live & HTTPS.

[x] Brain Upgrade: Gemini 2.0 Flash integratie met Vision.

[x] Camera Interface: Mobile Bridge (QR logic) volledig werkend via Supabase.

[x] Visual Engine: Hybrid System. Unsplash (Base) & Replicate/Flux Schnell (Generative AI) geïmplementeerd.

[x] UI Warmth Upgrade: Stone-theme & Dot Grid.

[x] UX Upgrade: Master Menu & Smart Age Slider Design.

7. Roadmap naar V3
Fase 1: UX & Core Experience (AFGEROND)

[x] Chat Logic, Vision, Board & Settings.

Fase 2: Authenticatie & Rollen (NU)

[ ] Role-Based Auth: Routing naar Bureau (Kind) of Dashboard (Ouder).

[ ] Ouder Dashboard: Bouwen van de "Glow Feed" & Diep-Lees Modus toggle.

Fase 3: Scaling & Polish

[ ] Long Term Memory (Supabase Vector Store).

[ ] Tech Debt Cleanup.

8. Groeistrategie
Fase 1 (Nu): Pilot (Rens).

Fase 2 (3 mnd): Kitchen Table Beta (5-10 vrienden).

Fase 3 (Launch): MVP met freemium model.

Merkpositionering: Publiceer het "Why Anima doesn't give answers" manifesto.

9. Business Model & Retention
Conversie: Doel 4% naar betaald.

Abonnementen: Basis (Gratis), Tutor (€6,95), Family (€11,95).

De "Emotional ROI" Mail: Wekelijkse mail naar ouders over autonomie en voortgang (geen cijfers, maar inzet).

10. Ethics, Privacy & Compliance 🛡️
Privacy (AVG/GDPR): Data opslag in EU. Recht op vergetelheid.

Data Hygiëne: Ouders en Leraren kunnen niet chatten, zodat het profiel van het kind zuiver blijft.

Veiligheid: Strict Gemini Safety Filters & PII filtering.