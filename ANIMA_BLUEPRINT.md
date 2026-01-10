🐺 ANIMA MASTER BLUEPRINT V3.4 - The "Consensus" Edition
1. De Anima Filosofie
• AI als Tutor: Anima geeft geen antwoorden, maar begeleidt via de Socratische methode.
• De "Escape Hatch": We bewaken de balans tussen uitdagen en frustreren.
• Regel: "Als de gebruiker na 2 pogingen het antwoord nog niet weet, stop met vragen stellen en geef een concreet voorbeeld."
• Instant Responsiviteit: We optimaliseren voor snelheid (Low Latency).
• Multimodaal Begrip: Anima "ziet" huiswerk via Vision voor gerichte hulp.
• Prikkelarm Design: Strikt monochroom palet ("Paper Look") om cognitieve belasting te minimaliseren.
• Fail-Safe: Stil falen bij technische errors met relevante placeholders.
2. Technische Architectuur & Data
• State Management: SPA in app/page.tsx via activeView.
• AI Core Strategy:
• Model: Google Gemini 1.5 Flash.
• Optimization: Context Caching voor veelvoorkomende topics (kostenbesparing).
• Hosting: Vercel (Production).
• Tech Debt Management:
• // @ts-nocheck is toegestaan voor de Pilot (snelheid).
• Type Debt Budget: Maximaal 5 bestanden mogen dit bevatten. Moet opgelost zijn vóór integratie van betalingen/auth.
• Vision Pipeline: Client -> Supabase Storage -> Gemini Flash -> Antwoord.
• Database: Supabase (chats tabel).
3. UI & Design System
• Container: bg-gray-50, rounded-3xl.
• Camera Input: Preview thumbnail + Visuele laad-status.
• Navigatie: Capsule switch & Sticky header.
• Progressive Delight: Subtiele micro-feedback bij succes (geen dopamine-spam, wel bevestiging).
4. Gerealiseerde Milestones
• [x] Vercel Deployment: Live & HTTPS.
• [x] Hotfix Types: Stabiele builds.
• [x] Smart Tagging: Topic & Sentiment detectie.
• [x] Live Dashboard: Real-time data.
5. Roadmap naar V3
Fase 1: Vision AI (PRIORITEIT)
• [ ] Camera Interface: Upload/Maak foto vanaf iPad.
• [ ] Supabase Storage: Bucket inrichten.
• [ ] Brain Upgrade: Gemini 1.5 Flash koppelen (API Key naar Vercel).
Fase 2: Authenticatie & Consent
• [ ] Login & Onboarding: Ouder account + Expliciete toestemming ("Ik help denken, niet spieken").
• [ ] Ouder-Tools:
• Vision Kill Switch: Ouder kan de camera tijdelijk uitzetten (focus op lezen/denken).
Fase 3: Scaling & Polish
• [ ] Tech Debt Cleanup.
• [ ] Long Term Memory.
6. Groeistrategie
• Fase 1 (Nu): Pilot (Rens).
• Fase 2 (3 mnd): Kitchen Table Beta (5-10 vrienden).
• Fase 3 (Launch): MVP met freemium model.
• Merkpositionering: Publiceer het "Why Anima doesn't give answers" manifesto. Transparantie bouwt vertrouwen.
7. Business Model & Retention
• Conversie: Doel 4% naar betaald.
• Abonnementen: Basis (Gratis), Tutor (€6,95), Family (€11,95).
• De "Emotional ROI" Mail (Retention):
• Wekelijkse mail naar ouders: "Deze week heeft Anima 3 keer geholpen met wiskunde. Rens vroeg zelf om hulp bij breuken."
• Psychologie: Bevestigt autonomie van het kind = Ouder blijft betalen.
8. Ethics, Privacy & Compliance 🛡️
• Privacy (AVG/GDPR): Data opslag in EU. Recht op vergetelheid knop. Data minimalisatie.
• Veiligheid: Strict Gemini Safety Filters & PII (Persoonsgegevens) filtering in de prompt (geen namen/adressen scannen).
• Bias Mitigatie: System Prompts voor gender-neutraliteit en anti-hallucinatie.