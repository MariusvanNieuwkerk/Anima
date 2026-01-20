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
- Anima stelt **1 mini-checkvraag** om door te gaan.

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

## 5b) Correct antwoord → bevestig en stop (NL)
**Setup**: laat Anima eindigen met een concrete microvraag (bv. “Wat is 17 + 20?”).

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

## 6) “Ik snap het niet” → Escape Hatch level 1 (NL)
**User**
1. `Los op: 17 + 28`
2. `ik snap het niet`

**Must**
- Level 1: **regel-hint** + mini-checkvraag.
- Geen eindantwoord.

---

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
- Chat bevat korte uitleg + 1 mini-checkvraag (bv. “Welke term is b in jouw opgave?”).

---

## 12) Vision/OCR low confidence → geen gokken (NL)
**User**
1. Upload een foto met onleesbare tekst/bedragen (bewust wazig).
2. `Wat staat hier?`

**Must**
- Anima zegt dat lezen niet betrouwbaar is en vraagt om **close-up**.
- Geen verzonnen bedragen/tekst.

---

### Extra: deterministische closing-variant check (ACK-only)
Run test #1 drie keer in een nieuwe sessie met verschillende aantallen user-berichten ervoor (0/1/2 extra user turns) en check:
- de gekozen afsluitvraag roteert voorspelbaar (op basis van user message count).

