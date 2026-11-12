# Foodloapp Intelligence: architectuur (VOORSTEL)

Stand 2026-11-11. **Alleen voorgesteld. Niets gebouwd, geen externe dienst geactiveerd.** Uitgangspunt: uitlegbare regels op bestaande code, AI alleen waar het aantoonbaar helpt.

## 1. Wat er al bestaat en herbruikbaar is (in de repo)
| Bouwsteen | Bestand | Wat het doet | Hergebruik |
|---|---|---|---|
| Dag en uur | `lib/vandaag.ts` (`hoofdStap`, `huidigeMaaltijd`, etenstijden), `lib/tijd.ts` | Bepaalt wat nu telt per uur, ook "morgen" na de avondgrens | Context Engine |
| Seizoen | `lib/themas.ts` (`seizoen(maand)`) | Seizoensthema met trefwoorden (winter: soep, stoof, witloof …) | Context Engine |
| Weer | `lib/weer.ts` (`haalWeer`, `sfeerVoorWeer`) | Open-Meteo (huidige temperatuur en weercode), locatie afgerond op ±1 km (BUG-108), weer koppelen aan categorieën. **Wordt nu nergens aangeroepen.** | Context Engine (na beslissing over dienst en licentie) |
| Weekvoorkeuren | `lib/voorkeuren.tsx` (weekmenu: vlees/vis/vega per week, maximale tijd, vermijden, per dag) | Account-instelling | Preference Engine (let op BUG-119) |
| Kennismaking | `lib/kennismaking.ts` | Ervaring, kooktijd, dieet, allergieën, gezin, planwijze; gezondheidsgegevens alleen op het toestel | Preference Engine |
| Allergenen | `lib/allergenen.ts` | 14 EU-allergenen in ingrediënten herkennen, "mogelijk" | Meal Intelligence (filter en waarschuwing) |
| Weekvoorstel | `lib/weekmenu-voorstel.ts` (`kiesUitEigen`, `soortVan`, `minutenVan`, `vermijdWoorden`), `ai.functions.ts` (`weekmenuIdeeen`) | Regelgebaseerd kiezen uit eigen recepten; AI-ideeën van buiten | Meal Intelligence |
| Voorraad → recepten | `lib/voorraad-match.ts` (`watKanIkKoken`) | Recepten met wat je in huis hebt | Meal Intelligence |
| Kringloop | `lib/kringloop.ts` (`berekenAanvulling`, `verbruik`, `voorraadNaKoop`, `waaromNodig`) | Weekmenu ↔ lijst ↔ voorraad, met uitleg "waarom staat dit op mijn lijst" | Boodschappen- en voorraadintelligentie |
| Dieet en soort | `lib/dieet.ts` | Vlees, vis of vegetarisch herkennen | Preference Engine |
| Meldingen | `lib/meldingen*.ts`, `webpush.server.ts`, `routes/api/public/meldingen.run.ts` (cron) | Dagelijks menu, week, maaltijd, boodschappen, koken; voorkeuren per soort | Proactive Suggestions (kanaal) |
| Gebruiksgegevens | `meal_plan` (verleden), `recipe_ratings`, `favorites`, `shopping_history`, `pantry_items`, `usage_events` (o.a. `kookmodus.gestart`, `kringloop.vanavond`, `recept.bekeken`) | Wat je plande, kookte, waardeerde en kocht | Cooking History Engine |
| Uitleg | Help Center, `waaromNodig` | Redenen in gewone taal | Uitlegbaarheid |

**Ontbreekt:**
- houdbaarheid in de voorraad (`pantry_items` heeft geen datum "tegen");
- signalen "overgeslagen" en "niet nu";
- feedback op voorstellen;
- feestdagenkalender;
- seizoenslijst per product;
- weersverwachting voor de komende dagen (nu alleen het huidige weer);
- budget.

## 2. Componenten
```
            ┌───────────────┐   ┌────────────────┐   ┌──────────────────────┐
 toestel →  │ Context Engine │   │ Preference Eng. │   │ Cooking History Eng. │
            └──────┬────────┘   └──────┬─────────┘   └──────────┬───────────┘
                   └─────────────┬─────┴────────────────────────┘
                                 ▼
                       ┌───────────────────┐   kandidaten: eigen recepten,
                       │  Meal Intelligence │ ← inspiratie, voorraad, weekmenu
                       │ (score + redenen)  │
                       └─────────┬─────────┘
                                 ▼
                   ┌───────────────────────────┐
                   │   Proactive Suggestions    │ → Vandaag-kaart, Week, Lijst,
                   │ (wanneer, waar, hoe vaak)  │   (opt-in) pushmelding
                   └─────────┬─────────────────┘
                             ▼
                   ┌───────────────────┐
                   │  Feedback Engine   │ ← 👍 / "niet nu" / "nooit" + reden
                   └───────────────────┘
```

### 2.1 Context Engine (wat is er nu aan de hand?)
- **Invoer:**
  - datum, weekdag, uur en etenstijden;
  - seizoen en feestdag (statische kalender BE/NL);
  - weer nu en de komende 3 dagen;
  - optioneel de agenda van het gezin (later, opt-in).
- **Uitvoer:** een klein contextobject, bv. `{ weekdag: "wo", druk: true, temp: 4, regen: true, seizoen: "winter", feest: null }`.
- **"Druk" komt nooit uit een stereotype.** De standaard is neutraal. Het patroon komt uit de eigen gewoontes (hoeveel tijd je op die weekdag kookte) of uit wat je zelf instelde (per dag in de weekmenu-instelling).

### 2.2 Preference Engine (wat wil deze persoon?)
- **Invoer:**
  - weekmenu-instelling (vlees/vis/vega, maximale tijd, vermijden, per dag);
  - kennismaking (op het toestel);
  - allergieën (op het toestel);
  - huishouden en mee-eters (later, voorstel 0005);
  - budget (nieuw, optioneel: € / €€ / €€€).
- **Harde regels** (nooit overschreden): allergeen = nooit aanbevelen zonder rode waarschuwing; "vermijd" = uitsluiten.
- **Zachte regels:** voorkeuren en tijd als gewichten.

### 2.3 Cooking History Engine (wat deed deze persoon?)
- **Bronnen:** gekookt (kookstand "klaar" + score), gepland, favoriet, bewaard, sterren, gekocht, "niet nu" en "nooit".
- **Afgeleiden:**
  - lievelingsgerechten;
  - variatiebehoefte (niet 3× hetzelfde in 2 weken);
  - gewone kooktijd per weekdag;
  - vaak gebruikte ingrediënten.
- **Bewaren:** samenvattingen in plaats van ruwe rijen waar dat kan. Bewaartermijnen volgens 0003/0003b; meal_plan 12 maanden is voldoende voor gewoontes per seizoen. Zie BESLISSINGEN.

### 2.4 Meal Intelligence (score met redenen)
Elke kandidaat krijgt een score als som van gewogen factoren, en elke factor levert een **reden** in gewone taal:

| Factor | Voorbeeldreden | Gewicht (start) |
|---|---|---|
| Voorraad gebruikt (bijna op of lang in huis) | "Gebruikt je spinazie (5 dagen in huis)" | hoog |
| Past bij tijd vandaag | "Klaar in 25 min" | hoog op drukke dagen |
| Weer | "Warm eten voor een koude avond (4 °C)" | middel |
| Seizoen | "Witloof is nu in het seizoen" | laag-middel |
| Persoonlijke voorkeur | "Je eet graag vis op vrijdag" | middel |
| Variatie | "Al 2 weken geen pasta gehad" / straf bij herhaling | middel |
| Score en favoriet | "Je gaf dit 5 sterren" | middel |
| Ontbrekend aantal producten | "Je mist alleen citroen" | middel |
| Allergeen | **uitsluiten of rode waarschuwing**, nooit stil | hard |

- **Uitleg:** de 1 à 2 sterkste redenen worden getoond, nooit meer dan 2 regels.
- **Testbaar:** zuivere functies met unittests per factor, zoals de huidige `kringloop`- en `vandaag`-logica.
- **AI:** optioneel voor (a) nieuwe ideeën van buiten de eigen recepten (bestaat: `weekmenuIdeeen`), (b) recepten "aanvullen". Nooit met allergie- of dieetgegevens zonder aparte goedkeuring.

### 2.5 Proactive Suggestions (wanneer en waar)
- **Waar:**
  - de Nu-kaart op Vandaag (bestaat; nieuwe stap "voorstel");
  - "Daarna" (bestaat, maximaal 3 signalen);
  - Week ("Vul aan met 3 voorstellen");
  - Lijst ("Wat je vergeet": bestaat als winkelidee).
- **Push** (opt-in, bestaat als kanaal): maximaal 1 per dag, op een gekozen uur, met een uitleg en een uitknop in elke melding.
- **Nooit:** iets automatisch toevoegen of wijzigen. Elke actie heeft "Ongedaan maken".

### 2.6 Feedback Engine
- **Bij elk voorstel:** "Ja, plan dit", "Niet nu", "Niet voor mij" met een optionele reden ("te lang", "lust ik niet", "te duur").
- **Opslag:** nieuwe tabel `aanbeveling_feedback` (user_id, recept_id of onderwerpcode, signaal, redencode, datum). Geen vrije tekst. RLS alleen eigen rijen, ook niet voor het gezin. "Niet nu" en "Gekozen" 12 maanden; "Niet voor mij" tot je het terugzet. Voorstel **0006** geschreven en lokaal getest (`tests/rls/intelligentie-voorstellen.mjs`), **niet uitgevoerd**. Houdbaarheid: voorstel **0007** (kolom `houdbaar_tot`), idem.
- **Effect:** "Niet voor mij" sluit uit tot je het terugzet; "Niet nu" verlaagt de score 7 dagen.

## 3. Waar draait wat (privacy en kosten)
| Onderdeel | Plaats | Waarom |
|---|---|---|
| Context (dag, uur, seizoen) | Toestel | Geen gegevens nodig |
| Weer | **Server-proxy** met cache per gemeente of postcode (±5 km), niet per gebruiker | Het IP-adres van de gebruiker gaat niet naar de weerdienst, één licentie, minder oproepen |
| Voorkeuren zonder gezondheid | Account (na voorstel 0004: alleen voor jezelf leesbaar) | Werkt op elk toestel |
| Allergieën en dieet | Toestel (nu); later 0005 met toestemming per lid | Gezondheidsgegevens (AVG art. 9) |
| Scoren en redenen | **Toestel** (allergenen tellen mee zonder het toestel te verlaten); de server levert kandidaten | Gezondheidsgegevens blijven lokaal |
| Proactieve push | Server (cron), **zonder allergiegegevens**; het toestel controleert bij openen | Server kent geen allergieën |
| Generatieve AI | Server (Lovable AI-gateway), alleen receptinhoud en context zonder persoon | Budgetrem bestaat |

## 4. Gegevensstroom (voorbeeld "Vanavond")
1. Het toestel opent Vandaag. De Context Engine leest dag en uur lokaal, en het weer uit de servercache voor de gemeente.
2. De server levert kandidaten: eigen recepten, voorraad en recent gekookt. Dat zijn bestaande queries.
3. Het toestel scoort, filtert allergenen lokaal en kiest 1 voorstel met 2 redenen.
4. De gebruiker tikt "Plan voor vanavond" (bestaande actie, met ongedaan maken) of "Niet nu" (Feedback Engine).

## 5. Beveiliging
- Nieuwe tabellen (0006 feedback, 0007 voorraad houdbaarheid, weercache) altijd met RLS-tests in PGlite vóór staging, volgens het patroon van `tests/rls`.
- Weerproxy: alleen gemeente of afgeronde coördinaten, rate limit, geen sleutel in de app.
- Push: geen gezondheidsinformatie in de meldingstekst ("Een snel idee voor vanavond", niet "zonder noten").
- AI: geen persoonsgegevens of gezondheidsgegevens in prompts; logging zonder inhoud.

## 6. Fasering (zie PRODUCTROADMAP-V2, fase 2)
1. **I-1:** Context Engine (dag, uur, seizoen) + Meal Intelligence op eigen recepten en voorraad + redenen. Geen externe dienst.
2. **I-2:** Feedback Engine (0006) + Cooking History-samenvattingen.
3. **I-3:** Weer via proxy (na de beslissing over de dienst) + houdbaarheid in de voorraad (0007).
4. **I-4:** Opt-in push met voorstellen + het huishouden (0005).
5. **I-5:** Optionele AI-ideeën binnen budget.

### Stand 2026-11-11 (lokaal gebouwd op `v2/dev`, niet gepusht of uitgerold)
| Onderdeel | Stand | Waar |
|---|---|---|
| Context Engine: dag, uur, seizoen, feestdagen BE/NL (10 dagen vooraf, Pasen berekend) | ✅ gebouwd + unittests | `src/lib/intelligentie/context.ts` |
| Cooking History: laatst gepland, komende 7 dagen, gewone kooktijd per weekdag (pas vanaf 3 keer; nooit een stereotype) | ✅ gebouwd + unittests | `src/lib/intelligentie/geschiedenis.ts` |
| Meal Intelligence: score + max. 2 redenen; harde regels allergeen, "liever niet", dieet, "Niet nu" | ✅ gebouwd + unittests per factor | `src/lib/intelligentie/voorstel.ts` |
| Voorstel op de Nu-kaart ("Met wat je in huis hebt", anders "Ideeën voor vanavond") met "Niet nu" en "Waarom zie ik dit?" | ✅ gebouwd + E2E (telefoon, 360, desktop, 320 px + 200 %) | `VanavondVoorstellen.tsx`, `tests/e2e/intelligentie.spec.ts` |
| "Niet nu" 7 dagen | ✅ op het toestel; naar het account pas met 0006 | `src/lib/intelligentie/niet-nu.ts` |
| Help-artikel "Waarom stelt Foodlo dit voor?" | ✅ concept (nalezing nodig, beslissing 8) | `src/lib/hulp/artikels.ts` |
| Weerfactor | ⚙️ in de score voorzien en getest, **geen databron** (beslissing 15/16) | — |
| Week: "Laat Foodlo kiezen" met dezelfde harde regels (allergeen, dieet, "liever niet") en 1 à 2 redenen per voorstel; wacht tot de ingrediënten geladen zijn; nieuw AI-idee met allergieën → "zelf nakijken" | ✅ gebouwd + E2E (allergie gluten, dieet vegetarisch, redenen, axe) | `WeekmenuVoorstel.tsx`, `tests/e2e/week-voorstel.spec.ts` |
| Week: kaart "Vul aan met voorstellen" (≥ 2 lege dagen; per dag eigen context en voorkeur; Plan per dag of alles, Niet nu, ongedaan maken; niet tegelijk met Laat Foodlo kiezen; alleen eigen weekmenu) | ✅ gebouwd + unit + E2E (allergie, 320 px + 200 %, uit-schakelaar) | `VulAan.tsx`, `vul-aan.ts`, `tests/e2e/week-vul-aan.spec.ts` |
| Winkelmodus "Voor morgen nog nodig" (usecase 9): wat je voor vandaag of morgen nog moet kopen en niet (of niet genoeg) op je lijst staat; "Zet erbij" met ongedaan maken, telt bij bestaande regels op | ✅ gebouwd + unittests + E2E (telefoon, desktop, 320 px + 200 %, axe) | `src/lib/intelligentie/voor-morgen.ts`, `Winkelmodus.tsx`, `tests/e2e/winkel-voor-morgen.spec.ts` |
| Eén veiligheidsregel (allergie incl. titel, "niet gecontroleerd" zonder ingrediënten, dieet incl. veganistisch) in alle voorstellen, Ontdek, Keuken en bij vervangen | ✅ gebouwd + unit + E2E (BUG-127/128) | `src/lib/veiligheid.ts`, `tests/e2e/veiligheid.spec.ts` |
| "Slimme voorstellen" aan/uit (op het toestel) | ✅ gebouwd + E2E | `src/lib/intelligentie/slim.ts`, Instellingen |
| Gebruik eerst (usecase 6): "al X dagen in huis" + reden op Vandaag + volgorde "Wat kan ik koken?" | ✅ gebouwd + unit + E2E (geen migratie; geen houdbaarheidsclaim) | `src/lib/intelligentie/gebruik-eerst.ts`, `tests/e2e/gebruik-eerst.spec.ts` |
| Seizoenslijst per product (België, volle grond, ongeveer): reden "… is nu in het seizoen" en Ontdek-thema "Nu in het seizoen" | ✅ gebouwd + unit + E2E | `src/lib/intelligentie/seizoen-producten.ts`, `src/lib/themas.ts` |
| Restjes (usecase 18): "Blijft er iets over?" na het koken, "Eet vanavond restjes" op Vandaag (zonder lijst), "Restjes" met "Is op" in Keuken; hooguit 3 dagen voorgesteld; op het toestel | ✅ gebouwd + unit + E2E | `restjes.ts`, `RestjeVraag/RestjesVoorstel/RestjesLijst.tsx`, `tests/e2e/restjes.spec.ts` |
| Restjes in Week ("Vul aan" kiest eerst restjes voor de eerste lege dag) | ❌ nog niet | volgende stap |
| "Niet voor mij", feedback op het account | ❌ wacht op 0006 (staging) | I-2 |

Geen nieuwe externe dienst, geen AI-oproep, geen gezondheidsgegevens buiten het toestel. Twee extra leesvragen per bezoek aan Vandaag wanneer er niets gepland is (`recipe_ratings`, `favorites`) plus het weekmenu van de laatste 180 dagen.

## 7. Wat dit níét doet
Geen automatische acties, geen medische claims, geen verkoop van gegevens, geen profilering voor reclame, geen gezondheidsgegevens naar externe AI.

## 8. Hoe de functies samenwerken (stand 2026-11-12, en wat later aansluit)
Alle voorstellen lopen door **één motor** (`src/lib/intelligentie/voorstel.ts`): eerst de harde regels (`toegelaten` → `src/lib/veiligheid.ts`), dan een score met hooguit 2 redenen. Elke plek levert alleen andere invoer aan; een nieuwe bron is dus een extra veld in `Invoer`, geen nieuwe logica per scherm.

### 8.1 Wie gebruikt wat (vandaag)
| Plek | Invoer | Bron (bestaand) |
|---|---|---|
| Vandaag, "Met wat je in huis hebt" | context van nu, voorraad + "al even in huis", kookgeschiedenis 180 dagen, sterren, favorieten, seizoensproducten, Niet nu, allergie en dieet (toestel) | `useVoorstelBronnen` (gedeeld) |
| Week, "Vul aan met voorstellen" | dezelfde bronnen, maar **per lege dag een eigen context** (weekdag, je gewone kooktijd op die dag, feestdag, seizoen) en je weekmenuvoorkeur voor die dag; niets wat deze week al gepland staat | `vulAan()` in `src/lib/intelligentie/vul-aan.ts` |
| Week, "Laat Foodlo kiezen" | weekregels (vlees/vis/vega, per dag), dezelfde harde regels en redenen | `WeekmenuVoorstel.tsx` |
| Lijst, "Voor morgen nog nodig" | weekmenu van vandaag en morgen min voorraad en lijst | `voor-morgen.ts` (Slim aanvullen) |
| Keuken, "Gebruik eerst" en "Wat kan ik koken?" | voorraad met aankoopdatum, dezelfde veiligheidsregel | `gebruik-eerst.ts` |
| Restjes (Vandaag, Keuken) | wat je na het koken bewaarde (op het toestel), hooguit 3 dagen voorgesteld | `restjes.ts` |
| Overal | "Slimme voorstellen" aan/uit (toestel) | `slim.ts` |

### 8.2 Wat later aansluit, zonder de motor te herschrijven
| Bron | Hoe het aansluit | Wat al klaarstaat | Nodig (beslissing) |
|---|---|---|---|
| **Weersverwachting** (I-3) | `Context.weer` per dag. Vandaag: weer van nu; Week: `vulAan({ weerVoor: datum → verwachting })`. De factor (warm eten bij kou, fris bij hitte, minder oven) zit al in de score en is getest. | Weerfactor + parameter `weerVoor` + unittest | Weerdienst en licentie (15), gemeente in plaats van GPS (16), server-proxy |
| **Dag en tijdstip** | `bepaalContext(datum, uur)`: weekdag, uur, feestdag (10 dagen vooraf), seizoen. Week rekent per dag om 17 u; Vandaag met de echte tijd en je etenstijden. | Gebouwd | — |
| **Kookgeschiedenis** | `vatSamen()`: laatst gekookt (variatie, "lang niet gemaakt"), komende 7 dagen (geen herhaling), gewone kooktijd per weekdag (pas vanaf 3 keer). Later: kookstand-gebeurtenissen en restjes als signaal ("kookt vaak voor 6 en eet met 3"). | Gebouwd voor weekmenu; kookstand nog niet | 0003/0003b (bewaartermijnen) voor wat bewaard mag blijven |
| **Gezinsvoorkeuren** (I-4) | Mee-eters per maaltijd met hun allergieën en voorkeuren worden **extra harde regels** in `toegelaten` (de unie van alle allergieën van wie mee-eet), en "wie eet mee" bepaalt de porties en dus restjes. Reden alleen binnen het huishouden ("Lien eet geen vis"). | Veiligheidsregel is al één functie; uitbreiden = de allergielijst samenvoegen | 0004, daarna 0005 met toestemming per lid (7); staging (1) |
| **Feedback** (I-2) | "Niet nu" (toestel, 7 dagen) → met 0006 op het account; "Niet voor mij" verlaagt een onderwerp (bv. curry) blijvend. | Niet nu gebouwd; tabel 0006 geschreven en getest | 0006 op staging (17) |
| **Restjes op het account** | Nu op het toestel. Gedeeld met het huishouden vraagt een eigen tabel of een kolom `soort = 'restje'` in de voorraad, zodat restjes nooit als "ingrediënt in huis" tellen. | Logica en tests op het toestel | Migratievoorstel (nog te schrijven), staging |
| **Houdbaarheid** | `gebruikEerst()` gebruikt nu de aankoopdatum; met 0007 (`houdbaar_tot`) komt de echte datum vóór de schatting. | Functie en tests | 0007 op staging (17) |

### 8.3 Vaste afspraken voor elke nieuwe bron
1. Eerst de harde regels: allergie, dieet, "liever niet", Niet nu. Mee-eters voegen alleen regels toe en halen er nooit weg.
2. Hooguit 2 redenen, in gewone taal, en "Waarom zie ik dit?" in het Help Center.
3. Nooit een automatische actie: elk voorstel vraagt één tik en heeft "Ongedaan maken".
4. Uit te zetten met "Slimme voorstellen". Zonder de bron werkt alles zoals voordien.
5. Gezondheidsgegevens blijven op het toestel (of later, na 0005, alleen binnen het huishouden met toestemming) en gaan nooit naar een externe dienst of de AI.
