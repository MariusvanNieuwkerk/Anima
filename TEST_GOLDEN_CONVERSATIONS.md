## Golden Conversations — Scaffolded Guide Acceptance Tests (V10.1)

Doel: deze scripts kun je 1-op-1 copy/pasten in `/student/desk` om te checken of Anima zich gedraagt als **Scaffolded Guide**.

### Hoe scoren (simpel)
- **PASS** als Anima voldoet aan “Must” en geen “Must-not” doet.
- **FAIL** als Anima een “Must-not” doet of de kern-must mist.

---

## 1) ACK-only stopt (NL)
**User**
1. `ok`

**Must**
- Anima geeft **geen nieuwe uitleg**.
- Als Anima’s vorige bericht **geen vraag** had (antwoord is “klaar”): Anima sluit af met **1 korte zin zonder vraagteken** (deterministische variant).
- Als Anima’s vorige bericht **wel een vraag** had: Anima vraagt ultrakort om het antwoord (1 korte zin).

**Must-not**
- Geen nieuw onderwerp starten.
- Geen lange uitleg of extra weetjes.

---

## 2) Kennisvraag → direct antwoord + 1 check (NL)
**User**
1. `Wanneer was de Franse Revolutie?`

**Must**
- Direct antwoord (bijv. 1789–1799).
- Daarna óf:
  - **stop zonder wedervraag** (kort afsluiten), óf
  - 1 korte optionele verdiepingszin (zonder druk), óf
  - 1 korte vervolgvraag (mag, maar niet verplicht).

**Must-not**
- Geen “ik ga je niet het antwoord geven”.
- Geen multi-step huiswerk-scaffold (dit is geen som).

---

## 3) Yes op checkvraag → ga door (NL)
**Setup**: start met test 2 of laat Anima eindigen op een ja/nee vraag.

**User**
1. `ja`

**Must**
- Anima gaat door met de volgende micro-stap/verdere uitleg.
- Geen ACK-only afsluiter (“Wil je een voorbeeld of nieuwe vraag?”) **als** het duidelijk een antwoord is op Anima’s ja/nee-check.

---

## 4) No op checkvraag → korte uitleg + mini-check (NL)
**User**
1. `Wanneer was de Franse Revolutie?`
2. (Anima vraagt iets als “Weet je wat er in 1789 gebeurde?”)
3. `nee`

**Must**
- Anima geeft **1–3 zinnen** uitleg (bv. Bastille/Begin revolutie).
- Anima geeft **1 concrete mini-actie** om door te gaan (Compute/Fill-blank/Choose).

**Must-not**
- Niet opnieuw alleen de jaartallen herhalen zonder de gevraagde context.

---

## 5) Huiswerk/som → geen eindantwoord in eerste beurt (NL)
**User**
1. `Los op: 17 + 28`

**Must**
- Anima legt **methode** kort uit (splitsen/optellen).
- Anima zet 1 micro-opdracht (bv. “Wat is 17 + 20?”).

**Must-not**
- Geen directe einduitkomst in beurt 1.

---

## 5a) Optellen (canon: splits → tientallen → eenheden → samen) (NL)
**User**
1. `Los op: 47 + 28`

**Must**
- Anima start met de canon: **splitsen** of direct de **tientallen-som** (één concrete stap).
- Anima gebruikt daarna consequent de volgende stappen (tientallen → eenheden → samenvoegen), steeds **één** invulstap per beurt.
- Na het correcte eindantwoord: Anima bevestigt kort (bv. “Juist.”) en **stopt** (geen extra check-tekst).

**Must-not**
- Geen “schrijf je berekening” / “wat is je volgende stap”.

---

## 5a-2) Optellen (stop na eind-invulvraag) (NL)
**Setup**: Anima vraagt expliciet om het eindantwoord als invulvraag (bv. `Vul in: 47 + 28 = __`).

**User**
1. `75`

**Must**
- Anima bevestigt kort (bv. “Juist.”) en **stopt** (geen nieuwe micro-stap zoals `7+8=__`).

---

## 5a-3) Optellen (ACK op “Schrijf …” → ga door, niet stoppen) (NL)
**Setup**: Start met `Los op: 47 + 28` zodat Anima begint met `Schrijf: 47=40+7 en 28=20+8.`

**User**
1. `ok`

**Must**
- Anima **stopt niet**.
- Anima gaat door met de volgende canon-stap, bijv. `Vul in: 40 + 20 = __`.

---

## 5a-4) Optellen (ACK op invulvraag → herhaal invulvraag, geen rewind) (NL)
**Setup**: Start met `Los op: 47 + 28` en ga door tot Anima vraagt: `Vul in: 40 + 20 = __`.

**User**
1. `ok`

**Must**
- Anima herhaalt de **zelfde invulvraag** (of vraagt ultrakort om het getal), maar gaat **niet terug** naar `Schrijf: 47 = ...`.

## 5b) Correct antwoord → bevestig en stop (NL)
**Setup**: Anima vraagt expliciet om het **eindantwoord** (niet een tussenstap).

**User**
1. `37`

**Must**
- Anima bevestigt duidelijk (bv. “Juist.” / “Exact.” / “Helemaal goed.”).
- Anima **stopt** daarna (geen nieuwe wedervraag, geen “nog een som?”, geen extra uitleg-lap).

**Must-not**
- Geen nieuwe micro-opdracht na een correcte afronding.

---

## 5c) Stop-signaal van leerling → sluit af (NL)
**Setup**: na een afgeronde oplossing (Anima zegt bv. “Juist.” / “We zijn klaar.”).

**User**
1. `niets`

**Must**
- Anima sluit af met 1 korte zin (zonder nieuwe vraag, geen “volgende micro-stap”).

**Must-not**
- Geen meta-coaching (“volgende stap”, “wat is de volgende micro-stap…”).

---

## 5d) Geen papegaaivraag (breuk/deling) (NL)
**User**
1. `wat is 184/16`

**Must**
- Anima herhaalt niet dezelfde vraag als wedervraag (“wat is 184 gedeeld door 16?”).
- Anima geeft 1 concrete micro-stap (bv. `16×10 = __`), zonder eindantwoord.
- Ook als Anima “vaag” reageert (bv. “Wat is de uitkomst?”) moet dit worden herschreven naar een concrete compute/fill‑blank stap.

---

## 5e) Tussenstap correct → ga door met volgende One‑Move (NL)
**Setup**: Anima vraagt een tussenstap zoals `16×10 = __` of `17+20 = __`.

**User**
1. (antwoord met het juiste getal, bv.) `160`

**Must**
- Anima bevestigt kort, én geeft meteen de **volgende** micro‑stap (geen “Super!” als hele boodschap).
- Nog steeds geen eindantwoord als het nog een tussenstap is.

**Must-not**
- Geen gokvraag (“denk je dat…?”, “past het vaker dan…?”).
- Geen meta‑vraag (“schrijf je berekening”, “wat is je volgende stap”) zolang de leerling niet vastzit.

---

## 5f) Directe rekenvraag + correct getal → bevestig en stop (NL)
**Setup**: Anima stelt een directe rekenvraag, bijv. `Wat is 92/2?`

**User**
1. `46`

**Must**
- Anima bevestigt kort (bv. “Juist.”) en **stopt** (geen eenheden-vraag, geen “volgende stap”).

---

## 5g) Delen (low-friction flow) (NL)
**User**
1. `wat is 184/16`

**Must**
- Anima start met een concrete compute/fill‑blank stap (bv. `16×10 = __`).
- Geen gokvragen (“denk je dat…”), geen meta‑vragen (“schrijf je berekening…”).

**Must-not**
- Geen “schatten / meer of minder …” vraag.

---

## 5h) Delen (geen herhaling na reststap) (NL)
**Setup**: Start met `wat is 184/16` en ga door tot Anima vraagt “Hoeveel blijft er over als je 160 van 184 aftrekt?”

**User**
1. `24`

**Must**
- Anima **herhaalt die aftrek-vraag niet**.
- Anima gaat door met de volgende micro‑stap, bijv. `16×1 = __`.

---

## 5i) Delen (canon: quotiënt + check) (NL)
**Setup**: Start met `wat is 184/16` en ga door tot de rest kleiner is dan 16.

**Must**
- Anima vraagt expliciet om de **quotiënt-som** (bijv. `10 + 1 = __ (quotiënt)`).
- Daarna stopt Anima met een korte bevestiging + **check** (bijv. `16×11 + 8 = 184.`) **zonder vraagteken**.

## 6) “Ik snap het niet” → Escape Hatch level 1 (NL)
**User**
1. `Los op: 17 + 28`
2. `ik snap het niet`

**Must**
- Level 1: **regel-hint** + **1 concrete mini-actie** (Compute/Fill-blank).
- Geen eindantwoord.

---

## 6a) “Ik snap het niet” (canon) → escaleer 1→2→3 (NL)
**Setup**: Gebruik een simpele som zodat level 3 verifieerbaar is.

**User**
1. `Los op: 17 + 28`
2. `ik snap het niet`
3. `ik snap het niet`
4. `ik snap het niet`

**Must**
- Bij de eerste “ik snap het niet”: **regel-hint + 1 mini-actie** (level 1).
- Bij de tweede: **samen starten** met 1 stap en 1 blank (level 2).
- Bij de derde (na meerdere pogingen): **eindantwoord + 2 korte waarom-zinnen + 1 mini transfer-vraag** (level 3).

## 7) Vastlopen met 1 echte poging → Escape Hatch level 2 (NL)
**User**
1. `Los op: 17 + 28`
2. (Anima geeft methode + microvraag)
3. `17 + 20 = 37`  *(dit telt als poging: werk getoond)*
4. `ik snap het niet`

**Must**
- Level 2: Anima werkt **exact 1 stap** uit met **1 blanco** (bv. `37 + __ = __`) en laat leerling invullen.
- Geen eindantwoord.

---

## 8) ≥3 echte pogingen + stuck → Escape Hatch level 3 (NL)
**User**
1. `Los op: 17 + 28`
2. `17 + 20 = 37`
3. `37 + 8 = 45`
4. `ik denk het antwoord is 45 omdat 20+8=28`
5. `ik snap het niet`

**Must**
- Level 3 toegestaan: **eindantwoord** + **2 korte “waarom” zinnen** + **1 mini transfer-oefenvraag** (zelfde idee, nieuwe getallen).

**Must-not**
- Geen lange uitleg-lappen; kort houden.

---

## 9) ACK na een open microvraag (NL) → vraag om antwoord, niet “afkappen”
**Setup**: laat Anima eindigen met een concrete microvraag (bv. “Wat is 17 + 20?”).

**User**
1. `ok`

**Must**
- Anima vraagt ultrakort om het concrete antwoord op de microvraag (“Wat is jouw antwoord…?”).

**Must-not**
- Niet een nieuw topic starten.

---

## 10) Graph mandate (NL)
**User**
1. `Teken de grafiek van y = x^2`

**Must**
- `action` is `plot_graph` en `graph.expressions` bevat `x^2` (of equivalent).
- Chat bevat korte uitleg + 1 micro-opdracht (bv. “Wat is y als x=2?”).

---

## 11) Formula mandate (NL)
**User**
1. `Wat is de ABC-formule?`

**Must**
- `action` is `display_formula` en `formula.latex` is een $$...$$ blok.
- Chat bevat korte uitleg + 1 concrete mini-actie (bijv. “Vul in: in \(ax^2+bx+c\) is \(b = __\).”).

---

## 12) Vision/OCR low confidence → geen gokken (NL)
**User**
1. Upload een foto met onleesbare tekst/bedragen (bewust wazig).
2. `Wat staat hier?`

**Must**
- Anima zegt dat lezen niet betrouwbaar is en vraagt om **close-up**.
- Geen verzonnen bedragen/tekst.

---

## 13) Procent → decimaal (canon) (NL)
**User**
1. `25%`

**Must**
- Anima noemt expliciet `25/100` (of schrijft `25% = 25/100`).
- Anima vraagt daarna 1 concrete invulstap: `25% = __` (verwacht `0,25`).
- Bij correct: korte bevestiging + check (`0,25×100=25%`) zonder vraagteken.

---

## 14) Negatieve getallen (canon) (NL)
**User**
1. `-3 + 7`

**Must**
- Anima vraagt 1 invulstap: `-3 + 7 = __`.
- Bij correct: bevestig kort en stop.

---

## 15) Haakjes/volgorde (canon flow) (NL)
**User**
1. `3*(8+4)-5`

**Must**
- Stap 1: `(8+4)=__`
- Stap 2: `3×__=__`
- Stap 3: `__-5=__`
- Bij correct eindantwoord: korte bevestiging, stop.

---

## 16) Eenheden (cm → m) (canon) (NL)
**User**
1. `250 cm naar meter`

**Must**
- Anima vraagt 1 invulstap: `250 ÷ 100 = __ (meter)`.

---

## 17) Eenheden (€ → cent) (canon) (NL)
**User**
1. `€2,50 naar cent`

**Must**
- Anima vraagt 1 invulstap: `2,5 × 100 = __ (cent)` (of equivalent).

---

## 18) Eenheden (kg → g) (canon) (NL)
**User**
1. `1,2 kg naar gram`

**Must**
- Anima vraagt 1 invulstap: `1,2 × 1000 = __ (gram)`.

---

## 19) Eenheden (L → ml) (canon) (NL)
**User**
1. `0,75 liter naar ml`

**Must**
- Anima vraagt 1 invulstap: `0,75 × 1000 = __ (ml)`.

---

## 20) Eenheden (km → m) (canon) (NL)
**User**
1. `3,4 km naar meter`

**Must**
- Anima vraagt 1 invulstap: `3,4 × 1000 = __ (meter)`.

---

## 21) Grammatica (NL): persoonsvorm vinden (canon) (NL)
**User**
1. `Wat is de persoonsvorm in: "Morgen loopt Tim naar school."`

**Must**
- Anima vraagt 1 invulstap: **Persoonsvorm = __** en toont de zin.
- Geen meta (“schrijf je analyse”), geen lange uitleg.

---

## 22) Grammatica (NL): onderwerp vinden (canon) (NL)
**User**
1. `Onderwerp in: "De hond blaft."`

**Must**
- Anima vraagt 1 invulstap: **Onderwerp = __** en toont de zin.

---

## 23) Grammar (EN): question type (canon) (EN)
**Setup**: set language to English.

**User**
1. `What kind of question is: "Are you coming?"`

**Must**
- Anima gives a single **Choose** step (A/B/C) for question type + shows the sentence.

---

## 24) Grammar (multi-language smoke) (FR/DE/ES/IT/PT/DA/SV/NO/FI)
**Setup**: set language to one of: French/German/Spanish/Italian/Portuguese/Danish/Swedish/Norwegian/Finnish.

**User**
1. `Find the subject in: "John eats."`

**Must**
- Anima returns a single fill/choose step (no long explanation), in the selected language.

### Extra: deterministische closing-variant check (ACK-only)
Run test #1 drie keer in een nieuwe sessie met verschillende aantallen user-berichten ervoor (0/1/2 extra user turns) en check:
- de gekozen afsluitvraag roteert voorspelbaar (op basis van user message count).

