📘 ANIMA BLUEPRINT V10.0 (The "Pure Math" Edition)
Datum: 17 Januari 2026 Kernfilosofie: "Warm Inzicht boven Kille Data" & "Exactheid waar nodig, Sfeer waar kan"
1. De Anima Filosofie
* AI als Tutor: Anima is een 'Scaffolded Guide'. Ze biedt eerst heldere uitleg en structuur (de methode), maar houdt het eindantwoord achter totdat het kind het zelf heeft geprobeerd.
* De "Escape Hatch" (Genuanceerd): We bewaken de balans tussen uitdagen en frustreren. De ontsnapping is strategisch (regel, analogie of voorzetje), afhankelijk van de gekozen modus.
* De "Anti-Sorry" Regel: Een tutor verontschuldigt zich niet voor kort of streng zijn; de intentie is pedagogisch.
* Instant Responsiviteit: We optimaliseren voor snelheid (Low Latency). De gebruiker mag nooit wachten op een "denkende" server zonder feedback.
* Multimodaal Begrip: Anima "ziet" huiswerk via Vision voor gerichte hulp, mits toegestaan door de ouder.
* Visuele Strategie (The Hybrid Engine): We gebruiken een meersporenbeleid dat volledig draait op Client-Side Rendering (Snel & Schaalbaar):
    * LaTeX (De Pen): Voor perfecte typografie van formules, breuken en reactievergelijkingen in de chat.
    * Maffs (De Plotter): Voor interactieve, exacte grafieken en functies op het bord.
    * Leaflet (De Atlas): Voor topografie en kaarten. Biedt de betrouwbaarheid van Google Maps, maar dan privacy-vriendelijk en volledig in eigen "Anima-stijl".
    * Curator (De Archivaris): Voor anatomie, biologie, geschiedenis en kunst. We gebruiken geverifieerde bronnen via de Wikimedia API (Rembrandt, Gray's Anatomy) voor feitelijk correcte weergaven, in plaats van hallucinaties.
    * Note: Generatieve beeldvorming (Flux) is verwijderd om snelheid, kosten en feitelijke juistheid te garanderen.
* Visual Mandate: Bij vragen over functies of meetkunde is visuele output verplicht. De AI gebruikt de plot_graph tool proactief.
* Prikkelarm & Warm Design: Geen kille tech-look, maar een tactiel "Paper Feel". Kleurenpalet verschuift van Slate (koud) naar Stone (warm).
* Fail-Safe: Stil falen bij technische errors. Geen agressieve rode foutmeldingen. "Graceful Degradation" is de norm.
* Global & Inclusive: Anima is er voor iedereen. Universele leeftijd-instelling en meertaligheid zitten in de kern.
2. User Roles & Separation of Concerns (The Tri-App Strategy)
Om datavervuiling te voorkomen en pedagogische doelen te halen, zien de drie gebruikersgroepen een totaal andere interface:
A. Het Kind ("De Maker")
* Doel: Flow & Focus.
* Interface: Direct op het bureau (Chat + Board). Geen administratie.
* Navigatie: Master Menu (linksboven) vervangt vaste zijbalken. Toont Profiel, Coach-keuze en Settings.
* Input: Smart Paperclip met "Mobile Bridge".
    * Mobiel/Tablet: Opent direct de native camera.
    * Desktop: Toont QR-code om telefoon tijdelijk als scanner te gebruiken.
* Rechten: Read/Write Chat.
B. De Ouder ("De Toeschouwer")
* Doel: Geruststelling & Emotional ROI.
* Interface: "De Nieuwsbrief" / "Glow Feed".
* Data: Proces-data i.p.v. harde cijfers.
* Visuals: Flow Meter (Worsteling vs. In de Zone) & Focus Cirkel.
* Interactie: Gespreksstarters ("Vraag Rens hoe hij de breuk oploste").
* Rechten: Read-Only. Kan niet chatten (voorkomt data-vervuiling). Wel toegang tot instellingen (Diep-Lees Modus).
C. De Leraar ("De Regisseur")
* Doel: Inzicht & Sturing.
* Interface: "Het Klembord".
* Overzicht: Insight Cards (Top 3 Knelpunten, bijv. "12 leerlingen vast op Breuken").
* Detail: Klassenlijst (Lijstweergave met status-badges, geen tegels).
* Diepte: AI Diagnose per leerling (Pedagogische samenvatting, geen chatlogs).
* Rechten: Topics pushen ("Focus morgen op breuken"). Geen inzage in privé-chats.
3. Technische Architectuur & Data
* State Management: SPA in app/page.tsx met strikte scheiding via centrale boardContent state (Manager Pattern) om conflicten tussen tools te voorkomen.
* AI Core Strategy:
    * Model: Google Gemini 2.0 Flash (Text & Vision).
    * System Prompts: 3 unieke Hard-coded System Prompts (Focus/Verkenner/Groei), aangestuurd door variabele Leeftijd.
    * Tooling: Strict defined tools (plot_graph, display_formula, show_image, show_map).
* Visual Engine (The Hybrid Engine):
    * Math Text: remark-math & rehype-katex (LaTeX rendering).
    * Math Visuals: Maffs (Interactive Graphing via React components).
    * Geography: React Leaflet integratie met custom styling.
    * General: Wikimedia API fetch logic voor afbeeldingen.
* Output Handling: "Board Wiper Logic" in frontend: Nieuwe tool call wist automatisch de vorige view (voorkomt overlap).
* Economy:
    * Rendering Cost: €0,00 (Client-side rendering & Open Source libraries).
    * API Cost: Minimal (Text-tokens & Vision only).
* Vision Pipeline: Client (Mobile/QR) -> Supabase Storage -> Gemini Vision -> Antwoord.
* Hosting: Vercel (Production).
* Database: Supabase.
4. UI & Design System (The "Digital Desk")
* Atmosfeer: Warm & Tactiel. Basis is bg-stone-50 (Warm Grijs/Zand). Containers zijn wit met border-stone-200 en zachte schaduwen.
* Desktop Layout: Gecentreerde "Container Focus" (max-w-6xl). Voelt niet 'uitgerekt'. Linksboven zwevende Menu knop.
* Mobile Layout: Full-screen focus met Capsule Switch (Chat | Board).
* The Board (Rechterkolom):
    * Visuele stijl: Dot Grid (stippenraster) achtergrond (stone-200).
    * Dynamic Views: Schakelt naadloos tussen Graph, Image, Map en Formula Card.
    * Empty State: Groot potlood-icoon + tekst "Ik wacht op je idee...".
* Navigation:
    * Kind: Hamburger menu (Slide-over drawer met Settings/Profiel) en Input Dock (vast onderaan).
    * Ouder/Leraar: Aparte dashboard layouts (Brief & Klembord).
5. Interactie-Details & Intelligentie 💡
A. De 3 Tutor Modi (Instelbaar door Kind) Het kind kiest zijn eigen "Coach Stijl" in het Master Menu:
1. ⚡️ Focus (De Trainer): Kort, zakelijk, geen emojis. Escape: De Regel-Hint.
2. 🧭 Verkenner (De Gids) - Default: Nieuwsgierig, onderzoekend. Escape: De Analogie.
3. 🌱 Groei (Het Maatje): Warm, geduldig, emojis. Escape: Scaffolding (Samen starten).
B. Global Scaling (De Smart Slider)
* Smart Age Slider: Een slider van 6 tot 18+. Ouders stellen dit eenmalig in.
* AI Impact: De leeftijd stuurt de toon en complexiteit van de System Prompt.
* Taal: Zoekbare lijst (NL, EN, ES, etc.).
C. Ouderlijke Controle: "Diep-Lees Modus"
* Functie: Schakelt de camera/upload knop uit.
* Doel: Dwingt het kind tot vertragen en typen (begrijpend lezen) i.p.v. scannen en rennen.
6. Gerealiseerde Milestones
* [x] Vercel Deployment: Live & HTTPS.
* [x] Brain Upgrade: Gemini 2.0 Flash integratie met Vision.
* [x] Camera Interface: Mobile Bridge (QR logic) volledig werkend via Supabase.
* [x] Visual Engine: Maffs (Grafieken), LaTeX (Formules) & Wikimedia (Afbeeldingen) geïmplementeerd. Flux & Image Generation verwijderd.
* [x] UI Warmth Upgrade: Stone-theme & Dot Grid.
* [x] UX Upgrade: Master Menu & Smart Age Slider Design.
7. Roadmap naar V3
Fase 1: UX & Core Experience (AFGEROND)
* [x] Chat Logic, Vision, Board & Settings.
* [x] Visual Stack Replacement (Flux -> Maffs/LaTeX).
Fase 2: Authenticatie & Rollen (NU)
* [ ] Role-Based Auth: Routing naar Bureau (Kind) of Dashboard (Ouder).
* [ ] Ouder Dashboard: Bouwen van de "Glow Feed" & Diep-Lees Modus toggle.
* [ ] Integratie Leaflet (Kaarten) in de Board Manager.
Fase 3: Scaling & Polish
* [ ] Long Term Memory (Supabase Vector Store).
* [ ] Tech Debt Cleanup.
8. Groeistrategie
* Fase 1 (Nu): Pilot (Rens).
* Fase 2 (3 mnd): Kitchen Table Beta (5-10 vrienden).
* Fase 3 (Launch): MVP met SaaS model.
* Merkpositionering: Publiceer het "Why Anima doesn't give answers" manifesto.
9. Business Model (SaaS Strategie)
We hanteren een Premium Abonnement model. Geen credits, geen micro-transacties.
A. B2C Model (Voor Ouders) The Cash Cow. Ouders betalen voor resultaat en rust.
* Single Student Plan: € 14,95 per maand.
    * Inclusief: Onbeperkt chatten, Vision, Ouder Dashboard.
* Family Pack: € 24,95 per maand.
    * Inclusief: Tot 3 kinderen + Dashboard.
* Acquisitie: 14 Dagen Gratis Proefperiode (Volledige toegang).
B. B2B Model (Voor Scholen) The Distribution Channel.
* Teacher Dashboard: GRATIS.
    * Doel: Leraren gebruiken het in de klas -> leerlingen vragen thuis om abonnement.
* School Licentie: Alleen op aanvraag (Volume deals).
Unit Economics:
* Dankzij het verwijderen van Flux en het gebruik van Client-Side Rendering (Maffs/LaTeX) zijn de marginale kosten per gebruiker drastisch verlaagd (~90% marge).
10. Ethics, Privacy & Compliance 🛡️
* Privacy (AVG/GDPR): Data opslag in EU. Recht op vergetelheid.
* Data Hygiëne: Ouders en Leraren kunnen niet chatten, zodat het profiel van het kind zuiver blijft.
* Veiligheid: Strict Gemini Safety Filters & PII filtering.
