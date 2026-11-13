# Module-audit Foodloapp V2 (2026-11-09)

> Samengevat in [`docs/foodlo/FUNCTIONAL_REQUIREMENTS.md`](../foodlo/FUNCTIONAL_REQUIREMENTS.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Doel: per module eerlijk vaststellen hoe ver Foodloapp staat tegenover goede gespecialiseerde apps, en wat we eerst moeten bouwen. Dit document stuurt de volgende werkpakketten (masterplan §18). Het herhaalt niet wat al gebouwd is, maar beoordeelt het.

**Hoe:**
- code gelezen in `v2/dev` (stand na commit `8633c52`);
- de 36 reviewschermen bekeken (390, 768 en 1280 px);
- referentie-apps onderzocht.

**Beperking:** de bronnen over referentie-apps zijn vooral leverancierspagina's, app-store-teksten en vergelijkingssites van leveranciers. Ik heb die apps zelf niet op een toestel gebruikt. Hun functies staan hieronder als *gerapporteerd*, niet als *geverifieerd*. Bronnen staan onderaan.

Statuswoorden: **gebouwd** · **gedeeltelijk** · **ontworpen** · **ontbreekt** · **⛔ G1** (vraagt een databankwijziging, dus staging en jouw akkoord).

---

## 0. De kwaliteitsnorm: wanneer is een module "klaar"?
Een module is pas klaar als ze aan **alle** acht punten voldoet. Werkende basisfunctionaliteit is niet genoeg.

1. **Taak in seconden.** De drie meest gebruikte taken van de module lukken in de minste tikken, en het belangrijkste staat bovenaan zonder te scrollen (390 px).
2. **Voor 70 én 20.** Tekst ≥ 17 px, doelen ≥ 44 px, alles met tekst, geen verborgen gebaren als enige weg. Toch modern, snel en mooi.
3. **Volledig tegenover de referentie.** De kernfuncties van de beste gespecialiseerde app zijn er, of er is een bewuste en gedocumenteerde keuze om ze weg te laten.
4. **Foodlo-meerwaarde.** De module gebruikt minstens één verband met de rest (recept, weekmenu, voorraad, lijst, koken, huishouden) dat een losse app niet heeft, en legt uit *waarom* iets gebeurt.
5. **Betrouwbaar.** Elke wijziging is ongedaan te maken. Fouten tonen een duidelijke melding en er blijft niets half staan. Dubbel tikken, twee vensters, trage of verbroken verbinding: getest.
6. **Alle toestanden ontworpen:** leeg, laden, fout, offline, veel data, lange namen.
7. **Drie volwaardige indelingen:** telefoon, tablet (geen uitgerekte telefoon) en desktop. Gecontroleerd met schermafdrukken.
8. **Gemeten.** E2E voor de hoofdstromen, axe zonder ernstige meldingen, kosten per AI-actie gekend.

Elke module krijgt hieronder een score per punt (✅ voldoet · 🟨 deels · ❌ niet).

---

## 1. Boodschappen (referentie: Bring!, AnyList, Listonic, OurGroceries)

### Wat de referenties goed doen (gerapporteerd)
- **Bring!:**
  - toevoegen via een catalogus van **tegels met pictogrammen**, met "recent gebruikt" bovenaan;
  - **specificaties** per product (bijvoorbeeld "lactosevrij", "2 l");
  - meerdere lijsten, gedeeld en gesynchroniseerd, met melding aan huisgenoten;
  - indeling per afdeling, gesorteerd volgens de winkel;
  - tegel- of lijstweergave en donkere modus;
  - recepten en folderaanbiedingen naar de lijst.
- **AnyList:** **winkelvolgorde per winkel**: categorieën in de volgorde van jouw supermarkt, per winkel anders. Ook receptimport.
- **Listonic:** **foto's** bij producten, prijzen en totaal, eigen categorieën, suggesties tijdens het typen.
- **OurGroceries:** eenvoud; sorteren per gang of categorie.
- **Waarom dat werkt:** de lijst is het eerste dat je ziet; toevoegen gaat in 1–2 tikken via herkenning en geheugen; afvinken vraagt één grote tik; met meerdere mensen zie je wie wat deed.

### Wat Foodlo vandaag heeft (geverifieerd in de code)
| Onderdeel | Status |
|---|---|
| Toevoegen door te typen ("6 eieren" → hoeveelheid + eenheid herkend), suggesties tijdens het typen uit "eerder gekocht" | gebouwd |
| Vaak gekocht (alleen echte losse aankopen), vaste boodschappen (ster) | gebouwd |
| Automatische afdelingen, zelf een afdeling kiezen per product (lokaal onthouden) | gebouwd |
| Meerdere lijsten, hernoemen, verwijderen, verplaatsen naar een andere lijst | gebouwd |
| Gezinslijst (`group_id`) met realtime; delen via link of als tekst | gebouwd (realtime **niet getest**: niet nagebootst) |
| Afvinken, "in je kar", alles in een afdeling afvinken, vegen, meerdere kiezen | gebouwd |
| Ongedaan maken: knop voor de laatste 20 acties plus een melding per actie | gebouwd |
| Winkelmodus: afdeling per afdeling, scherm blijft aan, niet gevonden → overslaan of vervangen (WP5) | gebouwd |
| Klaar met winkelen → voorraad, ongedaan te maken | gebouwd |
| Waarom op de lijst: "voor <gerecht>" (één gerecht) | gedeeltelijk: welke dagen, hoeveel in huis en meerdere gerechten worden niet getoond |
| Uit gerechten: per gepland gerecht op de lijst zetten | gebouwd |
| Slim aanvullen (ontbrekend min voorraad en lijst) | gebouwd |
| Offline wachtrij voor afvinken | gedeeltelijk (alleen afvinken) |
| Klantenkaarten, winkelideeën | gebouwd |
| Wie heeft iets toegevoegd of afgevinkt | ontbreekt (de kolom `user_id` bestaat, maar wordt niet getoond; "afgevinkt door" ⛔ G1) |
| Winkelvolgorde zelf instellen, meerdere winkels | ontbreekt (afdelingsvolgorde vast) |
| Merk, variant, foto per product, vervangvoorkeur | ontbreekt (notitie bestaat; aparte velden ⛔ G1) |
| Productcatalogus met tegels (zonder te typen) | ontbreekt |
| Sjablonen en terugkerende boodschappen | gedeeltelijk (vaste boodschappen; geen sjabloon "BBQ") |
| Aankoopgeschiedenis ("Eerder gekocht" per beurt) | gebouwd |
| Prijzen en budget | ontbreekt (later; ⛔ G1) |

### Grootste UX-problemen (reviewschermen)
1. **P0: de lijst staat niet bovenaan.** Op 390 px staat er geen enkele boodschap boven de vouw. Ervoor komen: de titel, de voortgang, een grote aanvulkaart, "Ik ga boodschappen doen", tabs, drie tegels en een vast invoerveld dat over die tegels valt.
2. **P0: "Mijn lijst / Uit gerechten" als tabs** suggereert twee lijsten. "Uit gerechten" is eigenlijk een manier om iets toe te voegen.
3. **P1: "Waarom staat dit hier?"** is maar half beantwoord. Je ziet één gerecht, maar niet hoeveel elk gerecht nodig heeft of wat er al in huis is.
4. **P1: op desktop** is de lijst een smalle kolom, terwijl de aanvul- en snelkoppelingskaarten de ruimte innemen.
5. **P2:** de afdelingsvolgorde is niet aan te passen aan je eigen winkel.

### Score tegenover de kwaliteitsnorm
| 1 Taak | 2 Toegankelijk | 3 Volledig | 4 Meerwaarde | 5 Betrouwbaar | 6 Toestanden | 7 Indelingen | 8 Gemeten |
|---|---|---|---|---|---|---|---|
| ❌ | ✅ | 🟨 | ✅ | ✅ | 🟨 | 🟨 | ✅ |

**Conclusie:** functioneel breder dan veel losse lijstapps. Dankzij de kringloop is de meerwaarde echt. Maar de dagelijkse taak (de lijst zien) is slecht, en de basisgemakken van Bring!/AnyList ontbreken: catalogus, winkelvolgorde en "wie".

### Prioriteiten (B = boodschappen-werkpakket)
| # | Wat | Waarom | DB? |
|---|---|---|---|
| **B1** | **Lijst eerst**: lijst bovenaan, één compacte statusregel en de winkelknop in de kop. "Uit gerechten", eerder gekocht en winkelideeën gaan naar één menu "Toevoegen uit…". Aanvullen wordt één compacte regel ná de lijst. Desktop: lijst links, toevoegen en aanvullen rechts | P0 dagelijkse taak | nee |
| **B2** | **Snel toevoegen zoals Bring!**: in het lege, gefocuste invoerveld meteen "recent en vaak gekocht" als grote tikdoelen; tijdens het typen suggesties | Toevoegen in 1–2 tikken | nee |
| **B3** | **"Waarom op mijn lijst?"** per Foodlo-regel: welke geplande gerechten (dag, hoeveelheid), wat er al in huis is, wat al op de lijst staat | Foodlo-meerwaarde zichtbaar maken | nee (leest bestaande data) |
| **B4** | **Winkelvolgorde**: de afdelingen zelf sorteren, ook in de winkelmodus | Bring!/AnyList-standaard | nee (eerst per toestel; per winkel en per account ⛔ G1) |
| B5 | "Toegevoegd door" op de gezinslijst | Samenwerken | gedeeltelijk (`user_id` bestaat; namen tonen) |
| B6 | Productcatalogus met tegels en pictogrammen per afdeling | Toevoegen zonder typen (ook voor 70) | nee (statische catalogus) |
| B7 | Sjablonen ("Ontbijt", "BBQ") en terugkerend | Herbruikbaar | ⛔ G1 |
| B8 | Merk, variant, foto, vervangvoorkeur, prijs/budget, meerdere winkels, afgevinkt door | Volledig | ⛔ G1 |

---

## 2. Recepten en receptimport (referentie: Paprika, Mela, Crouton, Samsung Food)
- **Referenties (gerapporteerd):**
  - Paprika: alles-in-één met recepten, planner, lijst en voorraad, plus schaalbare porties;
  - Mela en Crouton: rustige, mooie receptweergave, import uit websites en sociale media, een kookweergave;
  - Samsung Food: gratis, delen, cross-device.
- **Foodlo, gebouwd:**
  - import via link, tekst, foto en screenshot (AI) en zoeken op naam;
  - concept-autosave (BUG-055 opgelost);
  - versies, porties, extra foto's, delen, inplannen, naar de lijst;
  - favorieten, sterren en filters.
- **Gaten:**
  - P1: collecties door de gebruiker (⛔ G1). Nu bestaan alleen automatische collecties, en lege tonen een generiek icoon.
  - P1: eenheden omrekenen op de receptpagina (metrisch ↔ lepels).
  - P2: persoonlijke notitie bij een recept (lokaal kan; in de databank ⛔ G1).
  - P2: import uit een document of pdf.
- **UX:**
  - op de receptpagina staan drie even zware knoppen;
  - de filters staan nog in de oude stijl.
- **Score:** 1 🟨 · 2 ✅ · 3 🟨 · 4 ✅ · 5 ✅ · 6 🟨 · 7 🟨 · 8 🟨

## 3. Weekplanning (referentie: Mealime, Paprika-planner, AnyList-planner)
- **Foodlo, gebouwd:**
  - plannen, verplaatsen, kopiëren en vervangen, met de lijst die automatisch meevolgt (WP4);
  - Laat Foodlo kiezen (eigen recepten eerst, AI als terugval);
  - tablet week|dag en het desktopraster.
- **Gaten:**
  - P1: op de telefoon staat de eerste maaltijd pas op ±60 % van het scherm;
  - P1: voorstellen houden nog geen rekening met de **voorraad**; WP2 doet dat wel, maar alleen voor vanavond;
  - P1: lege dagen op desktop tonen drie lege vakken;
  - mee-eters en porties per persoon: ⛔ G1.
- **Score:** 1 🟨 · 2 ✅ · 3 🟨 · 4 ✅ · 5 ✅ · 6 🟨 · 7 ✅ · 8 ✅

## 4. Voorraad (referentie: expiry trackers zoals "Your Food – No Waste", FridgeBuddy, Paprika-pantry)
- **Referenties (gerapporteerd):** vervaldata met herinneringen, plekken (koelkast, diepvries, kast), kassabon of barcode scannen, delen.
- **Foodlo, gebouwd:**
  - toevoegen, ± en snelle chips;
  - "wat kan ik koken";
  - automatisch bijgewerkt na winkelen en koken;
  - vervangen producten tellen mee (WP5).
- **Gaten:**
  - P1: het invoerveld heeft geen zichtbaar label;
  - P1: geen indeling per categorie;
  - plekken, vervaldatum, geopend en restjes: ⛔ G1;
  - P2: dubbele producten samenvoegen ("ui" en "uien").
- **Score:** 1 🟨 · 2 🟨 · 3 ❌ · 4 ✅ · 5 ✅ · 6 🟨 · 7 🟨 · 8 🟨

## 5. Kookmodus (referentie: Mela/Crouton-kookweergave, Paprika)
- **Foodlo, gebouwd:**
  - grote stappen, voortgang, staptimers, hervatten;
  - het scherm blijft aan, met pijltjestoetsen;
  - na het koken wordt de voorraad bijgewerkt en is dat ongedaan te maken.
- **Gaten:**
  - P1: per stap alleen de ingrediënten van díe stap tonen (deels: `StapIngredienten` bestaat; nalopen);
  - P2: restjes registreren (⛔ G1);
  - P2: spraak of handsfree.
- **Score:** 1 ✅ · 2 ✅ · 3 🟨 · 4 ✅ · 5 ✅ · 6 🟨 · 7 🟨 · 8 ✅

## 6. Ontdekking en inspiratie
- **Foodlo:**
  - zoeken, filters en ideeën uit een externe catalogus;
  - één tik naar de eigen recepten;
  - Vandaag stelt voor met wat er in huis is.
- **Gaten:**
  - **P0: zonder catalogus of netwerk is Ontdek leeg** ("Geen recepten gevonden" als eerste indruk);
  - P1: seizoensthema's;
  - P1: "met wat je in huis hebt" ook hier;
  - P2: creators (WP13).
- **Score:** 1 🟨 · 2 ✅ · 3 ❌ · 4 🟨 · 5 🟨 · 6 ❌ · 7 🟨 · 8 ❌

## 7. AI-assistent
- **Principe** (§16, bindend): eerst eigen logica, dan cache, dan het goedkoopste model.
- **Gebouwd:** import, herkenning op foto, suggesties, weekvoorstel, vertalen, met credits, cache, maandbudget en kostenrem.
- **Gaten:**
  - P1: ingrediënt vervangen in een recept. Eerst een eigen tabel met gangbare alternatieven, AI alleen als terugval.
  - P1: het dure zoekmodel (G9).
  - Bewust **geen** chatvenster.
- **Score:** 1 ✅ · 2 ✅ · 3 🟨 · 4 ✅ · 5 ✅ · 6 🟨 · 7 ✅ · 8 ✅

## 8. Huishouden en samenwerking
- **Nu:** twee systemen naast elkaar: gezin (`group_members`) en vrienden (`shares`).
- **Ontwerp klaar** (HUISHOUDEN-ONTWERP): één huishouden, leden zonder account en delen per ding.
- **Bouwen:** ⛔ G1/G2, dus staging nodig.
- **Score:** 1 🟨 · 2 🟨 · 3 🟨 · 4 🟨 · 5 🟨 · 6 🟨 · 7 🟨 · 8 ❌ (realtime en rechten niet getest)

## 9. Creators en abonnementen
- **Status:** architectuur ontworpen (masterplan §7); credits en pakketten bestaan, maar staan uit.
- **Nog niets gebouwd voor eindgebruikers**; betalen ⛔ G5.
- **Volgende stap** zonder akkoord: alleen ontwerpen (profielpagina, collectie, toegangsregels). Geen betaling.
- **Herzien 2026-11-11 (A-Z-audit):** getest als persona C. Bestaat: recept invoeren en delen. Bestaat niet: bio, publiek profiel, publiceren, volgen, eigen collecties, statistieken, betaalde content. Score voor creators: 1/10. Volledige gap-analyse en volgorde: `CREATOR-GAP-ANALYSE.md`. Beheer en financieel: `BUSINESS-CONTROL-CENTER-AUDIT.md`.

## 10. Profiel, instellingen en ondersteuning
- **Gebouwd:** thema, taal, eetmomenten (WP5), export, account verwijderen en meldingen.
- **Gaten:**
  - P1: voorkeuren en dieet staan verspreid (onboarding, weekmenu-instellingen);
  - P2: het tijdveld volgt de taal van het toestel;
  - account verwijderen: foto's blijven staan (BUG-025, ⛔).

---

## 11. Overkoepelend

### UX
1. Ongelijke paginabreedtes: Vandaag en Week zijn breed, Lijst en Recept smal. **Een vaste regel per schermtype** volgt in B1 en WP7c.
2. Te veel even zware knoppen op Lijst en Recept. Eén vulde hoofdknop per scherm.
3. Lege toestanden: Ontdek, collecties en lege desktopdagen.
4. Focus trap in de winkelmodus en het paneel "Niet gevonden" (a11y, laag).

### Architectuur
1. Geen echte transacties: kringloopacties gebruiken compenserend herstel. ⛔ G1 (RPC's; WP11).
2. Grote Lovable-bestanden: boodschappen.tsx telt ±1 900 regels en RecipeForm.tsx ±1 950. Opsplitsen zoals de planner (WP6).
3. Realtime en rechten zijn niet getest; daarvoor is staging nodig.
4. AI-foto's als base64 in `ai_cache` (BUG-012, ⛔ G1/G8).

### Kosten (zie §16)
1. Het dure zoekmodel (Astra) voor 1 credit.
2. Automatische AI-foto per recept: de grootste variabele post.
3. BUG-061 (vertalen) zit nog in live V1.
4. Zonder `model_prices` was de gemeten kost 0. Nu vangt een voorzichtige schatting dat op.

---

## 12. Uitvoeringsvolgorde (gefaseerd)
| Fase | Werkpakketten | DB? | Waarom deze volgorde |
|---|---|---|---|
| **C1 (nu)** | **B1 Lijst eerst, B2 snel toevoegen, B3 waarom op mijn lijst, B4 winkelvolgorde (per toestel)** | nee | De boodschappenmodule wordt dagelijks gebruikt; de grootste UX-schuld |
| C2 | B5 "toegevoegd door", B6 productcatalogus met tegels; opsplitsen boodschappen.tsx | nee | Bring!-gemak; onderhoudbaarheid |
| D1 | Ontdek: lege toestand en terugval op eigen recepten en seizoen; collecties zonder foto (collage) | nee | Eerste indruk |
| D2 | Weekmenu telefoon compacter; voorstellen met de voorraad; lege desktopdagen | nee | Planning |
| D3 | Recept: één hoofdknop, eenheden omrekenen, ingrediënt vervangen (eigen tabel) | nee | Recepten |
| D4 | Voorraad: label, categorieën, samenvoegen van dubbels | nee | Voorraad |
| E | Staging (B6/G1) → huishouden, voorraadvelden, transacties, collecties, B7/B8; creatorontwerp | **ja** | Wacht op jouw akkoord |

## 13. A-tot-Z productaudit per persona (2026-11-11)
Volledig verslag: `PERSONA-TESTVERSLAG-2026-11.md` (zes gesimuleerde persona's, echte klikken in Chromium tegen de nep-Supabase; geen echte gebruikers of toestellen).

**Scores (1–10):**
- per persona: A jong 5,5 · B 70 jaar 7 · C creator 2,5 · D gezin 5 (onzeker: realtime en RLS niet testbaar) · E beginner 6 · F hobbykok 6,5;
- per module: Lijst/winkelmodus 8 · Vandaag 7,5 · Kookmodus 7,5 · Week 7 · Keuken 7 · Voorraad 6,5 · Profiel 6,5 · Control Center 6 · Onboarding 5,5 · Ontdek 5 · Gezin 5 · Financieel 3 · Creator 1.

**Waarom een echte gebruiker zou afhaken (kritisch):**
1. **Jongeren en creators:** niets sociaals, geen creators, geen eigen collecties. Ontdek is een kleine, samengestelde bibliotheek.
2. **Gezin:** geen taken ("wie kookt, wie winkelt") en geen voorkeuren per gezinslid. Samenwerking niet aantoonbaar zonder staging.
3. **70 jaar:** zoeken vergeeft geen tikfout (BUG-100). Op 200 % tekst duwt de foto op Vandaag de actie onder de vouw.
4. **Beginner:** de onboarding vraagt geen kookniveau of budget. Geen prijsinformatie. Lege Ontdek zegt "komt hier".
5. **Hobbykok:** bewerken zit verstopt in "…" (BUG-102); geen eigen mappen.

**Wat volledig werkt** (in Chromium, nep-Supabase): de reis voorraad → Vandaag → Week → Lijst (alleen het tekort) → winkelmodus → koken → voorraad bijgewerkt; porties herschalen; ongedaan maken; lege staten; lange titels; dubbel tikken zonder dubbele items; een verwijderd recept verdwijnt ook uit het weekmenu.

## Bronnen (referentie-apps; grotendeels leveranciers en app-stores)
- [Bring! features](https://getbring.com/en/features), [Bring! organized](https://www.getbring.com/en/features/organized), [Bring! personalized](https://getbring.com/en/features/personalized), [Bring! App Store](https://apps.apple.com/nl/app/bring-boodschappenlijst/id580669177)
- [Listonic: best grocery list apps 2026](https://listonic.com/best-grocery-list-apps), [Listonic vs AnyList](https://listonic.com/compare-apps/listonic-vs-anylist), [Listonic vs OurGroceries](https://listonic.com/compare-apps/listonic-vs-our-groceries)
- [Best recipe app 2026 (overzicht)](https://grate-six.vercel.app/blog/best-recipe-app), [Paprika (App Store)](https://apps.apple.com/app/id1303222868), [Recipe and meal planning apps](https://softwaremany.pages.dev/blog/2026-01-16-recipe-meal-planning-apps/)
- [Your Food – No Waste Inventory](https://apps.apple.com/app/id6473174562), [Pantry – Don't let them expire](https://apps.apple.com/us/app/-/id1556421447)
