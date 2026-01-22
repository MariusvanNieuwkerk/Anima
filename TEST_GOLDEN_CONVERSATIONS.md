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

## 5-2) Aftrekken (canon: rewrite → tientallen → eenheden → stop) (NL)
**User**
1. `Los op: 82 - 47`

**Must**
- Anima start **duidelijk** met het splitsen van 47 (bv. `Splits: 47 = 40 + 7`) of een equivalente rewrite, en vraagt daarna `82−40=__`.
- Na correct antwoord vraagt Anima `__−7=__`.
- Na correct eindantwoord: bevestig kort en stop.

**Must-not**
- Niet starten met `Vul in: 82 − 47 = __`.

---

## 5-2b) Aftrekken (unicode minus) (NL)
**User**
1. `Los op: 82 − 47`

**Must**
- Anima volgt dezelfde canon (splits/rewrite → `82−40=__` → `__−7=__`) en start niet met `82−47=__`.

**Must-not**
- Niet starten met `Vul in: 82 − 47 = __` (ook niet met andere streepjes zoals `–` of `—`).

---

## 5-3) Aftrekken (ACK op invulvraag → herhaal invulvraag, geen rewind) (NL)
**Setup**: Ga door tot Anima vraagt: `Vul in: 82 − 40 = __`.

**User**
1. `ok`

**Must**
- Anima herhaalt `82 − 40 = __` (of vraagt ultrakort om het getal).
- Anima gaat niet terug naar de rewrite-stap.

---

## 5-2c) Aftrekken (zelfde som opnieuw → restart canon, niet doorspringen) (NL)
**Setup**: Maak de som af tot Anima bevestigt met `Juist.`.

**User**
1. `Los op: 82 - 47`

**Must**
- Anima start opnieuw met de canon-beginstap (splits/rewrite) en vraagt weer `82−40=__` (niet `42−7=__`).

**Must-not**
- Niet meteen doorspringen naar de laatste stap op basis van vorige context.

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
**Setup**: Start met `Los op: 47 + 28` zodat Anima begint met een **invulvraag** (bv. `Vul in: 40 + 20 = __` — eventueel met een korte splits-regel ervoor).

**User**
1. `ok`

**Must**
- Anima **stopt niet**.
- Anima herhaalt de **huidige invulvraag** (bv. `Vul in: 40 + 20 = __`) en vraagt niet om meta-stappen.

---

## 5a-4) Optellen (ACK op latere invulvraag → herhaal invulvraag, geen doorspringen) (NL)
**Setup**: Start met `Los op: 47 + 28` en ga door tot Anima vraagt: `Vul in: 7 + 8 = __` (of equivalent voor de eenheden).

**User**
1. `ok`

**Must**
- Anima herhaalt de **zelfde invulvraag** (of vraagt ultrakort om het getal), maar gaat **niet terug** naar `Schrijf: 47 = ...`.

**Must-not**
- Niet doorspringen naar de volgende stap (bv. meteen `Vul in: 60 + 15 = __`) zonder dat de leerling eerst `7 + 8` invult.

---

## 5a-5) Vermenigvuldigen (stuck → kleinere stap, geen rewind) (NL)
**Setup**: Start met `Los op: 23 × 14` en ga door tot Anima vraagt: `Vul in: 23×4 = __`.

**User**
1. `weet ik niet`

**Must**
- Anima maakt de stap kleiner (bv. `Splits: 23 = 20 + 3. Vul in: 20×4 = __`) i.p.v. terug te gaan naar `23×10`.
- Als de leerling daarna `80` invult, gaat Anima door (bv. `3×4 = __` of `80+12=__`) en **niet** terug naar `23×10`.

**Must-not**
- Niet rewinden naar de start van de vermenigvuldiging.

---

## 5a-6) Vermenigvuldigen (eindantwoord → bevestig en stop, geen reset) (NL)
**Setup**: Start met `Los op: 23 × 14` en ga door tot Anima vraagt: `Vul in: 230 + 92 = __`.

**User**
1. `322`

**Must**
- Anima bevestigt kort (bv. `Juist.`) en **stopt**.

**Must-not**
- Niet terugvallen naar `23×14 = 23×(10+4). Vul in: 23×10 = __` of andere herstart/repeat.

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
- Anima start met een concrete compute/fill‑blank stap (bv. `16×10 = __`). (Mag vooraf 1 korte “waarom”-zin hebben bij junior.)
- Geen gokvragen (“denk je dat…”), geen meta‑vragen (“schrijf je berekening…”).

**Must-not**
- Geen “schatten / meer of minder …” vraag.

---

## 5h) Delen (geen herhaling na reststap) (NL)
**Setup**: Start met `wat is 184/16` en ga door tot Anima de reststap vraagt (bv. `Vul in: 184 − 160 = __`).

**User**
1. `24`

**Must**
- Anima **herhaalt die aftrek-vraag niet**.
- Anima gaat door met de volgende micro‑stap, bijv. `16×1 = __`.
- (Junior) Mag vooraf 1 korte coach-zin hebben (bv. “Past er nog 1 groepje bij?”).

---

## 5i) Delen (canon: quotiënt + check) (NL)
**Setup**: Start met `wat is 184/16` en ga door tot de rest kleiner is dan 16.

**Must**
- Anima vraagt expliciet om de **quotiënt-som** (bijv. `10 + 1 = __ (quotiënt)`).
- Daarna stopt Anima met een korte bevestiging + **check** (bijv. `Quotiënt: 11, rest: 8. Check: 16×11 + 8 = 184.`) **zonder vraagteken**.
- (Junior) Mag ook 1 extra stap doen zodat het kind het eindantwoord invult (bv. `184 ÷ 16 = __ (rest 8)`), en daarna kort bevestigen.

---

## 5j) Breuk vereenvoudigen (canon: deel teller/noemer → herhaal tot klaar) (NL)
**User**
1. `Vereenvoudig 12/18`

**Must**
- Anima vraagt één invulstap, bv. `Vul in: 12 ÷ 2 = __` (niet meteen het eindantwoord).
- Daarna: `Vul in: 18 ÷ 2 = __`.
- Daarna vervolgt Anima deterministisch (bv. nieuwe breuk `6/9` en dan delen door `3`) tot de breuk niet verder kan.
- Als de breuk klaar is: Anima bevestigt kort en **stopt**.

---

## 5j-2) Breuk vereenvoudigen (ACK op invulvraag → herhaal dezelfde stap, geen rewind) (NL)
**Setup**: Start met `Vereenvoudig 12/18` en ga door tot Anima vraagt: `Vul in: 12 ÷ 2 = __` (of een equivalente delingsstap).

**User**
1. `ok`

**Must**
- Anima **stopt niet**.
- Anima herhaalt de **zelfde invulvraag** (geen rewind, geen doorspringen).

---

## 5j-3) Breuk vereenvoudigen (al vereenvoudigd → bevestig en stop) (NL)
**User**
1. `Vereenvoudig 3/8`

**Must**
- Anima zegt dat dit al vereenvoudigd is (bv. `Deze breuk is al vereenvoudigd: 3/8. Juist.`) en **stopt**.

---

## 5k) Percentages (canon: p% van basis → 1 stap tegelijk → stop) (NL)
**User**
1. `wat is 20% van 150`

**Must**
- Anima start met een concrete compute/fill‑blank stap (bv. `Vul in: 150 ÷ 10 = __ (dat is 10%)` of `Vul in: 150 ÷ 5 = __ (dat is 20%)`). (Junior: mag vooraf 1 korte “waarom”-zin.)
- Daarna vraagt Anima de volgende micro‑stap (bv. `Vul in: 15 × 2 = __ (dat is 20%)`) en **stopt** na het correcte eindgetal.

**Must-not**
- Niet starten met een “definitie”-canon zoals `20% = 20/100` zonder de “van 150”-context.
- Geen gokvragen / meta‑vragen.

---

## 5k-2) Percentages (ACK op invulvraag → herhaal dezelfde stap, geen rewind) (NL)
**Setup**: Start met `wat is 20% van 150` en ga door tot Anima vraagt: `Vul in: 150 ÷ 10 = __` (of equivalente eerste stap).

**User**
1. `ok`

**Must**
- Anima herhaalt de **zelfde invulvraag** (geen rewind, geen doorspringen).

---

## 5k-3) Percentages (25% shortcut → kwart) (NL)
**User**
1. `wat is 25% van 80`

**Must**
- Anima vraagt een enkele invulstap zoals `Vul in: 80 ÷ 4 = __ (dat is 25%)` en **stopt** na het correcte antwoord.

---

## 5l) Volgorde van bewerkingen (haakjes) (canon: binnenste haakjes → ×/÷ → +/− → stop) (NL)
**User**
1. `bereken (8 + 6) / 2`

**Must**
- Anima start met een concrete invulstap uit de haakjes (bv. `Vul in: 8 + 6 = __`).
- Daarna een concrete stap met ÷ (bv. `Vul in: 14 ÷ 2 = __`).
- Na correct eindgetal: korte bevestiging en **stop**.

**Must-not**
- Geen eindantwoord in de eerste beurt.
- Niet buiten de haakjes beginnen.

---

## 5l-2) Volgorde van bewerkingen (precedence: × vóór +) (NL)
**User**
1. `bereken 3 + 4 * 5`

**Must**
- Anima vraagt eerst `Vul in: 4 × 5 = __` (of equivalente ×‑stap).
- Daarna `Vul in: 3 + 20 = __`.
- Daarna korte bevestiging en **stop**.

---

## 5l-3) Volgorde van bewerkingen (ACK op invulvraag → herhaal dezelfde stap) (NL)
**Setup**: Start met test 5l en ga door tot Anima vraagt: `Vul in: 8 + 6 = __` (of equivalente eerste stap).

**User**
1. `ok`

**Must**
- Anima herhaalt de **zelfde invulvraag** (geen rewind, geen doorspringen).

---

## 5m) Negatieve getallen (canon: omschrijven → rekenen → stop) (NL)
**User**
1. `bereken 7 + -3`

**Must**
- (Junior) Anima laat omschrijven naar aftrekken, bv. `Schrijf om: 7 + −3 = 7 − __`.
- Daarna: `Vul in: 7 − 3 = __`.
- Daarna korte bevestiging en **stop**.

**Must-not**
- Niet behandelen als gewone optelsom zonder het min‑teken te snappen.

---

## 5m-2) Negatieve getallen (min min wordt plus) (NL)
**User**
1. `bereken 5 - -2`

**Must**
- (Junior) Anima laat omschrijven, bv. `Schrijf om: 5 − −2 = 5 + __`.
- Daarna: `Vul in: 5 + 2 = __`.
- Daarna korte bevestiging en **stop**.

---

## 5m-3) Negatieve getallen (ACK op invulvraag → herhaal dezelfde stap) (NL)
**Setup**: Start met test 5m-2 en ga door tot Anima vraagt: `Schrijf om: 5 − −2 = 5 + __` (of equivalente omschrijf-stap).

**User**
1. `ok`

**Must**
- Anima herhaalt de **zelfde invulvraag** (geen rewind, geen doorspringen).

---

## 5n) Unknowns / mini‑algebra (canon: draai bewerking om → x invullen → stop) (NL)
**User**
1. `x + 8 = 23`

**Must**
- Anima geeft 1 korte regel-hint (teen/junior) en vraagt daarna één invulstap om de bewerking terug te draaien, bv. `Vul in: 23 − 8 = __`.
- Daarna vraagt Anima: `Vul in: x = __`.
- Na correct antwoord: korte bevestiging en **stop**.

**Must-not**
- Geen eindantwoord in de eerste beurt.
- Geen meta‑vragen (“wat is je volgende stap?”).

---

## 5n-2) Unknowns / mini‑algebra (aftrekken terugdraaien) (NL)
**User**
1. `__ − 7 = 15`

**Must**
- Anima vraagt eerst `Vul in: 15 + 7 = __`.
- Daarna `Vul in: x = __` (of `__ = __`).
- Daarna korte bevestiging en **stop**.

---

## 5n-3) Unknowns / mini‑algebra (ACK/stuck → herhaal dezelfde stap) (NL)
**Setup**: Start met test 5n en ga door tot Anima vraagt: `Vul in: 23 − 8 = __`.

**User**
1. `weet ik niet`

**Must**
- Anima geeft 1 korte regel-hint en herhaalt **dezelfde invulvraag** (`23 − 8 = __`).

---

## 5o) Kommagetallen optellen (canon: komma onder komma → 1 invulstap → stop) (NL)
**User**
1. `2,5 + 1,2`

**Must**
- (Junior) Anima zegt kort dat je **komma onder komma** zet, en vraagt dan 1 invulstap: `Vul in: 2,5 + 1,2 = __`.
- Na correct antwoord: korte bevestiging en **stop**.

**Must-not**
- Niet terugvallen naar de LLM met een lang verhaal.

---

## 5o-2) Kommagetallen (ACK/stuck → herhaal dezelfde stap) (NL)
**Setup**: Start met test 5o en ga door tot Anima vraagt: `Vul in: 2,5 + 1,2 = __`.

**User**
1. `ik weet het niet`

**Must**
- Anima geeft 1 korte tip (bv. “komma onder komma”) en herhaalt **dezelfde invulvraag**.

---

## 5o-3) Kommagetallen vermenigvuldigen (NL)
**User**
1. `1,2 × 0,5`

**Must**
- (Junior) Stap 1: Anima zegt kort “reken zonder komma” en vraagt: `Vul in: 12 × 5 = __`.
- (Junior) Stap 2: Anima vraagt “zet de komma terug”, bv. `Vul in: 60 ÷ 100 = __` (of equivalent).
- Na correct antwoord: korte bevestiging en **stop**.

---

## 5o-4) Kommagetallen delen (NL)
**User**
1. `0,75 ÷ 0,25`

**Must**
- (Junior) Anima maakt de komma weg en vraagt één invulstap met hele getallen, bv. `Vul in: 75 ÷ 25 = __` (of equivalent).
- Na correct antwoord: korte bevestiging en **stop**.

---

## 5o-5) Kommagetallen met geld (NL)
**User**
1. `€2,50 ÷ 4`

**Must**
- Anima vraagt 1 invulstap met unit-suffix, bv. `Vul in: 2,5 ÷ 4 = __ (euro)` (of equivalent).
- Na correct antwoord: korte bevestiging en **stop**.

---

## 5o-6) Kommagetallen met metingen (NL)
**User**
1. `2,5 m + 1,2 m`

**Must**
- Anima vraagt 1 invulstap met unit-suffix, bv. `Vul in: 2,5 + 1,2 = __ (meter)` (of equivalent).
- Na correct antwoord: korte bevestiging en **stop**.

---

## 5p) Omzetten: breuk → procent (canon: deel → ×100) (NL)
**User**
1. `Zet 3/4 om naar procent`

**Must**
- Stap 1: `Vul in: 3 ÷ 4 = __`
- Stap 2: `Vul in: 0,75 × 100 = __ %` (of equivalente schrijfwijze)
- Daarna korte bevestiging en **stop**.

---

## 5p-2) Omzetten: procent → kommagetal (NL)
**User**
1. `Zet 25% om naar decimaal`

**Must**
- Anima vraagt 1 invulstap: `Vul in: 25 ÷ 100 = __`
- Daarna korte bevestiging en **stop**.

---

## 5p-3) Omzetten: kommagetal → breuk (NL)
**User**
1. `Zet 0,75 om naar breuk`

**Must**
- Stap 1: `Vul in: 0,75 = __/100`
- Stap 2: `Vul in: antwoord = __` (bv. `3/4`) en stop bij correct (ook als leerling `75/100` invult mag dat als “zelfde waarde”).

---

## 5q) Afronden op tientallen (Extended) (NL)
**User**
1. `Rond 347 af op tientallen`

**Must**
- Stap 1: Anima vraagt het **kijkcijfer** (bij afronden op tientallen is dat de eenheden): `Kijkcijfer bij afronden op 10: __`
- Stap 2: Anima vraagt het **afgeronde antwoord**: `Vul in: 347 afgerond op 10 = __`
- Daarna korte bevestiging en **stop**.

---

## 5q-2) Afronden op 1 decimaal (Extended) (NL)
**User**
1. `Rond 3,141 af op 1 decimaal`

**Must**
- Stap 1: `Kijkcijfer bij afronden op 1 decimaal(en): __` (kijkcijfer is 4)
- Stap 2: `Vul in: 3,141 afgerond op 1 decimaal(en) = __` (3,1)
- Daarna korte bevestiging en **stop**.

---

## 5q-3) Afronden (ACK/stuck → herhaal stap) (NL)
**Setup**: Start met test 5q en ga door tot Anima vraagt om het kijkcijfer.

**User**
1. `ik weet het niet`

**Must**
- Anima geeft 1 korte hint (“kijkcijfer is het cijfer erachter”) en herhaalt dezelfde invulvraag.

---

## 5r) Verhouding (Extended) (NL)
**User**
1. `Verhouding 2:3, als 2 delen = 8, hoeveel is 3 delen?`

**Must**
- Stap 1: `Vul in: 8 ÷ 2 = __ (1 deel)`
- Stap 2: `Vul in: 3 × __ = __` (waarde van 3 delen)
- Daarna korte bevestiging en **stop**.

---

## 5r-2) Schaal (Extended) (NL)
**User**
1. `Schaal 1:50, 3 cm is hoeveel cm echt?`

**Must**
- Anima vraagt 1 invulstap: `Vul in: 3 × 50 = __ (cm)` (of equivalent).
- Daarna korte bevestiging en **stop**.

---

## 5r-3) Verhouding (ACK/stuck → herhaal stap) (NL)
**Setup**: Start met test 5r en ga door tot Anima vraagt: `Vul in: 8 ÷ 2 = __`.

**User**
1. `ik weet het niet`

**Must**
- Anima geeft 1 korte hint (bv. “1 deel = totaal ÷ aantal delen”) en herhaalt dezelfde invulvraag.

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

## 14b) Routing check: aftrekken ≠ negatieve getallen (NL)
**User**
1. `Los op: 82 - 47`

**Must**
- Anima gebruikt de **aftrekken-canon** (rewrite → `82−40=__` → `__−7=__`).

**Must-not**
- Niet behandelen als “negatieve getallen” met `82 - 47 = __`.

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

## 20a) Breuken optellen (canon: kgv → tellers → optellen → vereenvoudigen → eindbreuk) (NL)
**User**
1. `1/4 + 1/8`

**Must**
- Stap 1: `kleinste noemer die bij 4 en 8 past = __` *(junior)* of `kleinste gemene veelvoud van 4 en 8 = __` *(teen)*
- Stap 2: `1×2=__` (naar noemer 8)
- Stap 3: `1×1=__` (blijft 8)
- Stap 4: `__ + __ = __` (teller optellen)
- Daarna vraagt Anima om het antwoord als breuk: `antwoord = __` (bv. `3/8`) en stopt bij correct.

---

## 20b) Breuken aftrekken + vereenvoudigen (NL)
**User**
1. `3/6 - 1/6`

**Must**
- Stap 1: `kleinste noemer die bij 6 en 6 past = __` *(junior)* of `kleinste gemene veelvoud van 6 en 6 = __` *(teen)* (mag ook direct door naar tellerstap)
- `3×1=__`
- `1×1=__`
- `__ - __ = __`
- Vereenvoudigen via `grootste gemene deler van __ en 6 = __` en daarna `antwoord = __` (bv. `1/3`) en stop.

---

## 20c) Breuken (ACK/stuck → herhaal stap) (NL)
**Setup**: Start met test 20a en ga door tot Anima vraagt om de kleinste gezamenlijke noemer/LCM (de eerste stap).

**User**
1. `ik weet het niet`

**Must**
- Anima geeft 1 korte regel-hint en herhaalt **dezelfde** invulvraag.

---

## 20c-2) Breuken vermenigvuldigen (canon: teller×teller → noemer×noemer → eindbreuk) (NL)
**User**
1. `1/4 × 3/5`

**Must**
- Anima vraagt eerst 1 teller‑stap, bv. `Vul in: 1×3 = __ (teller)` (junior/teen mag een korte “waarom” zin ervoor zetten).
- Daarna vraagt Anima 1 noemer‑stap: `Vul in: 4×5 = __ (noemer)`.
- Daarna vraagt Anima om het eindantwoord als breuk: `antwoord = __` (bv. `3/20`) en stopt bij correct.

**Must-not**
- Niet meteen het eindantwoord geven in beurt 1.
- Geen decimalen als eindantwoord afdwingen (breuk is prima).

---

## 20c-3) Breuken delen (canon: keer om → teller×teller → noemer×noemer → vereenvoudigen → eindbreuk) (NL)
**User**
1. `1/2 ÷ 3/4`

**Must**
- Stap 1: Anima vraagt omkeren: `Keer om: 3/4 wordt __/__` (verwacht `4/3`).
- Stap 2: `Vul in: 1×4 = __ (teller)`.
- Stap 3: `Vul in: 2×3 = __ (noemer)`.
- Stap 4: Vereenvoudigen via `grootste deler die in 4 en 6 past = __` en daarna `4 ÷ 2 = __` en `6 ÷ 2 = __`.
- Daarna vraagt Anima: `antwoord = __` (bv. `2/3`) en stopt bij correct.

---

## 20c-4) Breuken delen (stuck/ACK → herhaal stap met korte hint) (NL)
**Setup**: Start met test 20c-3 en ga door tot Anima vraagt: `Keer om: 3/4 wordt __/__`.

**User**
1. `weet ik niet`

**Must**
- Anima geeft 1 korte hint (bv. “Tip: omkeren = teller en noemer wisselen.”) en herhaalt **dezelfde** invulvraag.

---

## 20c-5) Breuken vermenigvuldigen (zelfde som opnieuw → restart canon) (NL)
**Setup**: Maak test 20c-2 af tot Anima bevestigt met `Juist.`.

**User**
1. `1/4 × 3/5`

**Must**
- Anima start opnieuw met de eerste stap (teller‑stap), en springt niet naar het eindantwoord.

---

## 20d) Korting (percent word problem) (NL)
**User**
1. `20% korting op €80`

**Must**
- Anima vraagt eerst een %‑stap (bv. `80 ÷ 10 = __ (dat is 10%)`, daarna eventueel `__ × 2 = __ (dat is 20%)`).
- Daarna vraagt Anima: `80 − __ = __` en stopt bij correct.

---

## 20e) BTW (percent word problem) (NL)
**User**
1. `21% btw op 100`

**Must**
- Anima vraagt eerst een %‑stap (bv. `100 ÷ 100 = __ (dat is 1%)`, daarna `__ × 21 = __ (dat is 21%)`).
- Daarna vraagt Anima: `100 + __ = __` en stopt bij correct.

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

