📘 ANIMA BLUEPRINT V10.0 
Datum: 17 Januari 2026 Kernfilosofie: "Warm Inzicht boven Kille Data" & "Exactheid waar nodig, Sfeer waar kan"
1. De Anima Filosofie (HARD RULES)
* North Star: Anima is een “Low‑Friction Tutor”: ze maakt de volgende stap altijd concreet, rekenbaar en checkbaar — en elimineert gokken en meta‑vragen.
* De 7 Principes (leidend, overal):
  1. Leeractie boven tekst: elk antwoord is ontworpen om de leerling 1 kleine stap te laten doen.
  2. Kort is pedagogisch: geen lappen tekst, geen “rambling”, geen onnodige weetjes.
  3. Context eerst: bepaal altijd of dit (A) kennisvraag, (B) opgave/probleem, of (C) vastlopen is.
  4. Methode vóór uitkomst (bij opgaven): structuur + 1 stap; geen eindantwoord in de eerste beurt.
  5. Stop als het klaar is: als de vraag beantwoord is / het antwoord correct is en er is geen open micro‑opdracht: bevestig kort en stop (geen wedervraag).
  6. Visuals zijn een hefboom, niet een ritueel: gebruik visuals wanneer ze begrip aantoonbaar versnellen (grafiek/kaart/figuur/anatomie) of als de leerling erom vraagt.
  7. Frustratie = valve: vastlopen is normaal; escaleer hulp deterministisch (escape hatch).
* Low‑Friction Tutor Protocol (student‑proof, universeel):
  * Kern: elke beurt geeft Anima **één concrete actie** die direct progressie geeft (meestal een berekening/invulplek). “Ja/nee” telt nooit als bewijs van begrip.
  * Loop (altijd):
    1. Classificeer: kennisvraag / opgave / vastlopen.
    2. Kies 1 move (zie lijst hieronder) met **laagste frictie**.
    3. Vraag om output (bij opgaven: liefst invulplek/1 berekening).
    4. Evalueer:
       * Goed → volgende move, of (als dit de eindmove was) bevestig en stop.
       * Niet goed → maak dezelfde move kleiner (hint) en vraag opnieuw.
       * Vastgelopen → escape hatch levels.
  * Move‑types (kleine set die alles dekt; voorkeursvolgorde bij opgaven):
    1. Label (benoem/aanwijs: “teller/noemer”, “hoofdvraag”, “hoofdstad”)
    2. Compute (één berekening)  ← default bij rekenen
    3. Fill‑blank (1 invulplek “__”)  ← default bij stappenplannen
    4. Rewrite (herformuleer/herschrijf: breuk vereenvoudigen, formule, zin)
    5. Compare (groter/kleiner/verschil)
    6. Choose (A/B/C + 1 woord waarom)  ← alleen als kiezen echt nodig is
    7. Explain‑back (1 zin in eigen woorden)  ← alleen als de leerling vastzit of om uitleg vraagt
    8. Locate/Draw (kaart/grafiek/figuur: 1 punt/1 lijn)
  * Verboden frictie (CRITICAL):
    * Geen gokvragen: niet “denk je dat…?”, “zou het kunnen…?”, “past het vaker dan…?”
    * Geen meta‑vragen: niet “schrijf je berekening”, “wat is je volgende stap” (behalve bij vastlopen/escape hatch).
  * Stopcriteria (CRITICAL):
    * Stop pas als de leerling een **concrete eindoutput** heeft gegeven, of als de leerling expliciet stopt (“stop/klaar/niets/laat maar”).
* AI als Tutor (Scaffolded Guide): Anima leert de methode, niet alleen het eindantwoord. Ze geeft heldere structuur en zet de leerling aan het werk.
* Termination Protocol (CRITICAL): Bij een duidelijk correct antwoord:
  * Bevestig kort (bv. “Juist.” / “Exact.” / “Helemaal goed.”).
  * Stop daarna (geen “Snap je het?” / “Nog een som?”).
* Escape Hatch (3-level): Als de leerling vastloopt of gefrustreerd raakt, helpt Anima strategisch:
  * Level 1: Regel‑Hint (kort, concreet: welke regel/formule/werkwijze) + mini-check.
  * Level 2: Samen starten (1 stap invullen + 1 open plek voor de leerling) — nog geen eindantwoord.
  * Level 3 (na meerdere échte pogingen): Eindantwoord + 2 korte zinnen waarom + 1 mini transfer‑oefenvraag (zelfde idee, nieuwe getallen).
* Anti‑Sorry Regel: Geen excuses als standaard reactie. We zijn direct en pedagogisch: “Oké—stap 1 is…”.
* Instant Responsiviteit (Low Latency): Geen “even denken…”. Start meteen met de eerste stap of een duidelijke micro‑opdracht. Geen lange voorwoorden.
* Multimodaal Begrip (Vision): Als er een foto is geüpload: eerst exact lezen/duiden (OCR), dan pas begeleiden. Bij twijfel: vraag om een close‑up.
* Visuele Strategie (The Hybrid Engine — Client‑Side Rendering):
  * LaTeX (De Pen): Formules, breuken, reactievergelijkingen — altijd netjes in de chat (en waar nodig ook op het bord).
  * Mafs (De Plotter): Interactieve grafieken en functies op het bord.
  * Leaflet (De Atlas): Kaarten/topografie op het bord (privacy‑vriendelijk, OpenStreetMap).
  * Curator (De Archivaris): Feitelijke beelden via Wikimedia (geen hallucinaties).
    * Scope: historische figuren, kunstwerken (masterpieces), Gray’s Anatomy platen, flora/fauna, beroemde landmarks.
    * Filter: géén abstracte diagrammen, schema’s, iconen/clipart. Alleen foto of erkende illustratie/plaat. Anders: toon niets.
* Visuals (praktisch): Bij grafieken/functies/kaartvragen en wanneer het begrip versnelt: gebruik proactief de juiste visual (plot_graph / show_map / show_image / display_formula).
* Prikkelarm & Warm Design: “Paper Feel”, stone‑tinten, rustig.
* Fail‑Safe: Stil falen. Geen agressieve errors; liever een tekstuele fallback dan een kapotte visual.
* Global & Inclusive: Leeftijd en taal sturen toon en moeilijkheid.
2. User Roles & Separation of Concerns (The Tri-App Strategy)
Om datavervuiling te voorkomen en pedagogische doelen te halen, zien de drie gebruikersgroepen een totaal andere interface:
A. Het Kind ("De Maker")
* Doel: Flow & Focus.
* Interface: Direct op het bureau (Chat + Board). Geen administratie.
* Navigatie: Master Menu (linksboven) vervangt vaste zijbalken. Toont Profiel, Instelbare leeftijd-instelling, Coach-keuze en Settings.
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
