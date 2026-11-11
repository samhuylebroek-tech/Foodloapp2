# Foodloapp V2 — Masterplan

**Centrale bron.** Stand: 2026-11-10, branch `v2/dev` (lokaal, niet gepusht). Eigenaar van beslissingen: Sam.
Detaildocumenten (gelinkt, niet herhaald): [MOBIEL-AUDIT](MOBIEL-AUDIT-2026-11.md) · [DESIGNSYSTEEM](DESIGNSYSTEEM.md) · [MODULE-AUDIT](MODULE-AUDIT-2026-11.md) · [PRODUCT-HERONTWERP](PRODUCT-HERONTWERP.md) · [HUISHOUDEN-ONTWERP](HUISHOUDEN-ONTWERP.md) · [FUNCTIE-INVENTARIS](FUNCTIE-INVENTARIS.md) · [BUG-REGISTER](BUG-REGISTER.md) · [SECURITY-RELEASE](SECURITY-RELEASE.md) · [MOBIEL-REDESIGN-MATRIX](MOBIEL-REDESIGN-MATRIX.md) · [STAGING-VOORSTELLEN](STAGING-VOORSTELLEN.md) · [MIGRATIE-VOORSTEL-BOODSCHAPPEN](MIGRATIE-VOORSTEL-BOODSCHAPPEN.md) · [PRAKTIJKTEST-TOESTELLEN](PRAKTIJKTEST-TOESTELLEN.md) · [TOEGANKELIJKHEID-PROTOCOL](TOEGANKELIJKHEID-PROTOCOL.md) · [ZOD4-MIGRATIE](ZOD4-MIGRATIE.md)

Statuslabels in dit document:
- ✅ **bestaand en gecontroleerd**: geautomatiseerd getest.
- 🟨 **bestaand maar onvoldoende**.
- 🟧 **gedeeltelijk**.
- ⬜ **nog te bouwen**.
- ⛔ **geblokkeerd**: door een beslissing of afhankelijkheid, met poort G1–G9.

> **Permanente kwaliteitsnorm (sinds 2026-11-09).** Een module is pas *klaar* als ze aan alle acht punten van [MODULE-AUDIT §0](MODULE-AUDIT-2026-11.md#0-de-kwaliteitsnorm-wanneer-is-een-module-klaar) voldoet:
> 1. taak in seconden, het belangrijkste bovenaan;
> 2. voor 70 én 20 jaar;
> 3. volledig tegenover de beste gespecialiseerde app (voor boodschappen: Bring!);
> 4. zichtbare Foodlo-meerwaarde;
> 5. betrouwbaar en ongedaan te maken;
> 6. alle toestanden ontworpen;
> 7. telefoon, tablet en desktop volwaardig;
> 8. gemeten.
>
> Werkende basisfunctionaliteit is **niet** genoeg. Liever minder functies die uitzonderlijk goed zijn dan veel middelmatige. Elke statusmelding in dit plan zegt expliciet of iets *gebouwd*, *gedeeltelijk*, *ontworpen*, *getest* of *niet getest* is, en of het van jouw akkoord afhangt.

---

## 1. Productvisie (kort)
Foodloapp is het ene systeem voor het culinaire leven van een huishouden. **Foodlo doet het rekenwerk**: wat ontbreekt, wat in huis is, wat er gekocht en gekookt is, wie meeëet. De gebruiker beslist alleen, met één primaire actie per moment en altijd **Ongedaan maken**. AI is een motor achter de schermen, geen verplichte chat.

**Kern = de kringloop:**
```
ontdekken/vastleggen → plannen → (min voorraad) → lijst → kopen → voorraad → koken → voorraad/restjes
        ▲                                                                              │
        └──────────── suggesties: voorraad · vervaldatum · voorkeuren · huishouden ◄────┘
```

## 2. Productstructuur (doel)
| Plek | Vraag | Bevat |
|---|---|---|
| **Vandaag** | Wat is de volgende stap? | Eén contextkaart met één knop: koken, ontbreekt iets, wat eten we vanavond, bijna vervallen, restjes |
| **Week** | Wat eten we? | Planner (dag op mobiel, 7-dagenraster op desktop), Slim aanvullen, voorstellen |
| **Lijst** | Wat moet ik halen? | Automatisch aangevulde lijst, afdelingen, winkelmodus, klaar → voorraad, klantenkaarten |
| **Keuken** | Wat heb ik en wat kan ik? | Recepten, collecties, voorraad (later: plekken, vervaldatum, restjes), kookstand |
| **Ontdek** | Wat is nieuw? | Ideeën, zoeken; later creators, collecties, volgen, betaalde inhoud |
| Profiel (rechtsboven) | — | Huishouden, vrienden, meldingen, credits, instellingen, hulp |

**Beslissing B1 (genomen, omkeerbaar):** de mobiele onderbalk krijgt **exact deze vijf plekken**. "Nieuw" verhuist naar een vaste knop in de kopbalk. Motivering: vijf herkenbare bestemmingen zijn eenvoudiger dan vier bestemmingen plus een actieknop in het midden. Voorraad krijgt een plek, en Ontdek wordt zichtbaar voor de creator-doelgroep. *Uitgevoerd in WP1 (§9).*

## 3. UX-principes (bindend)
1. **Eén primaire actie** per scherm of kaart. Secundaire acties zijn visueel rustig.
2. **Geen bevestigingsvragen voor omkeerbare acties.** Meteen doen, met een melding en "Ongedaan maken". Bevestigen alleen bij echt verlies: account, huishouden verlaten, lijst wissen.
3. **Foodlo rekent, de gebruiker niet:** porties, eenheden, dubbels, voorraad.
4. **Kort:** één zin per kaart. Heeft een handeling uitleg nodig, dan herontwerpen we de handeling.
5. **Raakvlakken van 44–56 px**, WCAG 2.2 AA, getest op 360–430 px. Tablet en desktop krijgen een eigen indeling (raster, twee kolommen).
6. **Lege, ladende en foutstaten** hebben altijd een volgende stap.

## 4. Functies: inventaris en status
Volledige lijst per route: [FUNCTIE-INVENTARIS](FUNCTIE-INVENTARIS.md). Hieronder per domein de eerlijke status en de beslissing.

| Domein | Functie | Status | Beslissing |
|---|---|---|---|
| **Kringloop** | Slim aanvullen (porties, eenheden, voorraad, lijst, dubbels, gelijktijdig) | ✅ | Behouden, uitbreiden |
| | Gekocht → voorraad, met ongedaan maken | ✅ | Behouden |
| | Gekookt → voorraad bijgewerkt, met ongedaan maken | ✅ | Behouden |
| | Menu gewijzigd → lijst bijgestuurd (erbij, weg, vervangen, verplaatst) | ✅ (WP4) | Automatisch, met ongedaan maken. Alleen het eigen weekmenu; het gezinsmenu volgt met het huishouden (WP9) |
| | Restjes als voorraaditem | ⛔ G1 | Vereist `pantry_items.bron_recept_id` |
| **Vandaag** | Nu-kaart: één volgende stap met één hoofdknop | ✅ (WP3) | Beslissing in `lib/vandaag.ts` (puur, getest) |
| | Eigen etenstijden ("Wanneer eet je?") | ✅ (WP5) | In de bestaande profielinstelling `weekmenu` (geen schemawijziging) |
| | "Daarna": hooguit drie signalen (ontbreekt, dagen vrij, lijst) | ✅ (WP3) | Vervangt de aanvulkaart, de snelkoppelingen en de ideeënband op Vandaag |
| | "Wat eten we vanavond?" uit voorraad | ✅ (WP2) | Eén tik: gepland + tekort op de lijst + ongedaan maken |
| | Bijna vervallen | ⛔ G1 | Vereist `vervalt_op` |
| **Week** | Plannen, verplaatsen, kopiëren, restjes/uit eten, Laat Foodlo kiezen (AI), desktopraster, mobiel vegen, tablet week\|dag | ✅ (WP6) | Opgesplitst: `routes/planner.tsx` 3 392 → ±1 600 regels, zeven onderdelen in `components/planner/` |
| | Gezinsmenu naast persoonlijk menu | 🟨 | Samenvoegen in het huishouden (⛔ G1/G2) |
| | Mee-eters, porties per maaltijd | ⛔ G1 | HUISHOUDEN-ONTWERP |
| | Agenda en beschikbare tijd | ⬜ | Fase 3 (koppeling met een kalender = externe verplichting) |
| **Lijst** | Afdelingen, winkelmodus, eerder gekocht, vaste items, delen, realtime | ✅/🟨 | Behouden |
| | Overslaan/vervangen in de winkel (hoeveelheid en gerecht blijven) | ✅ (WP5) | Vervangen product telt voor maaltijd, voorraad en aanvullen als het origineel |
| | Lijst eerst (B1), vaak gekocht in het invoerveld (B2), waarom op mijn lijst (B3), winkelvolgorde per toestel (B4) | ✅ (C1) | Zie §18. De module is **nog niet klaar** volgens de kwaliteitsnorm: catalogus met tegels, "toegevoegd door", sjablonen, merk/variant/foto en winkels ontbreken (MODULE-AUDIT §1) |
| | Eigen boodschappen beschermd (Foodlo past ze nooit aan; elk verwijderen terug te zetten) | ✅ (WP5) | Tekort komt op een eigen Foodlo-regel "voor <gerecht>" |
| | "Jan is aan het winkelen" (presence) | ⬜ | Fase 2 (geen schema) |
| **Keuken: recepten** | Link, foto, scan, tekst, zoeken (AI); concept-autosave; versies; foto's | ✅/🟨 | Behouden. Bewaren is eenmalig (dubbele ingrediënten hersteld) |
| | Collecties door de gebruiker | ⛔ G1 | Nieuwe tabel |
| | Ingrediënt vervangen, persoonlijke notitie | ⬜ | WP7 (AI + eigen logica) |
| **Keuken: voorraad** | Toevoegen, ±, wat kan ik koken | ✅ | Behouden |
| | Plekken, vervaldatum, geopend, gedeeld | ⛔ G1 | HUISHOUDEN-ONTWERP §4 |
| **Koken** | Stappen, timers, hervatten, groot, bevestiging bij verlaten, voorraad bijwerken | ✅ | Behouden |
| | Handsfree (spraak), restjes registreren | ⬜ / ⛔ G1 | Fase 2 |
| **Huishouden** | Gezin en vrienden (twee rechtensystemen) | 🟨 | Vervangen door het huishouden plus delen per ding (⛔ G1/G2) |
| **Ontdek** | Ideeën om te koken | ✅ (WP1) als eigen plek | Creators later (WP13) |
| **Creator/betalen** | Credits, pakketten (uit), aanvragen | 🟧 | Architectuur §7; ⛔ G5 |
| **Beheer** | 43 schermen, `bewaker()` op 76 serverfuncties | ✅ | Behouden |

## 5. Architectuur
### 5.1 Wat blijft
TanStack Start (SSR en serverfuncties), React 19, Supabase (auth, Postgres, RLS, storage, realtime), Cloudflare via Lovable. **Geen rewrite.** Het fundament is degelijk; de problemen zitten in productlogica en schermen.

### 5.2 Lagen (doel)
| Laag | Regel | Voorbeeld |
|---|---|---|
| Domein (puur) | Rekenlogica zonder netwerk, unit-getest | `lib/kringloop.ts` |
| Data | Supabase-aanroepen, herberekenen vóór het schrijven, herstel (undo) teruggeven | `lib/kringloop-db.ts` |
| Hooks | Gedeelde queries en invalidatie | `hooks/useAanvulling.ts` |
| UI | Gedeelde bouwstenen | `components/mobiel/Lijst.tsx`, `components/kringloop/*` |
| Server | AI, betalingen, beheer: altijd zod-validatie, rate limit, kostenregistratie | `ai.functions.ts`, `credits.server.ts` |

### 5.3 Datakwaliteit
| Situatie | Mechanisme | Status |
|---|---|---|
| Twee leden vullen tegelijk aan | Herberekenen vóór het schrijven, bijtellen in plaats van dupliceren | ✅ (getest) |
| Dubbel tikken | Guards (bewaren, plannen, aanvullen) | ✅ |
| Ongedaan maken | Elke schrijfactie geeft een herstelfunctie terug, die maar één keer loopt. Mislukt herstellen, dan volgt een melding in plaats van stilte | ✅ kringloop |
| Atomiciteit van meerstapsacties (planning + lijst, voorraad + lijst) | **Nu (gebouwd, getest):** elke schrijfstap wordt gecontroleerd; bij een fout worden de vorige stappen in omgekeerde volgorde teruggedraaid. Lukt dat terugdraaien zelf niet, dan zegt de app "Dat lukte maar half", nooit "er is niets veranderd". **Grens:** dit is géén databanktransactie. Wordt de app midden in een actie afgesloten, dan kan half werk blijven staan. **Doel:** Postgres-functie (RPC) per actie, transactioneel en idempotent | 🟧 nu · ⛔ G1 voor RPC |
| Huishouden wisselt | Kopiëren, nooit wissen; kaart "Samenvoegen?" | ontwerp |

### 5.4 AI als motor
14 AI-serverfuncties bestaan al (import via link, foto, screenshot, tekst; ingrediënten; suggesties; weekideeën; stappen; vertaling; foto's). Kosten worden geregistreerd (`ai_usage`, `model_prices`), credits worden gereserveerd, en het resultaat wordt gecachet (`ai_cache`).
Regels:
- Eerst eigen logica. Voorbeelden: Slim aanvullen, wat kan ik koken en afdelingen draaien zonder AI.
- AI alleen waar begrip nodig is: tekst, foto's, vervangingen, smaak.
- Elke AI-actie heeft een kostenplafond per gebruiker per dag (bestaat via credits). Kosten per actieve gebruiker staan in de beheerschermen.
- Open punt BUG-012: base64-foto's in `ai_cache` maken de cache duur.

### 5.5 Overige
Meldingen (web-push, cron), e-mail (Resend en Lovable), opslag (`recipe-photos`), realtime (lijst, planner, gezin), logging en monitoring (`app_errors`, usage events, beheer). Back-ups: Supabase PITR moet nog bevestigd worden (⛔ G1-voorbereiding).

## 6. Datamodel (doel, additief)
Detail in [HUISHOUDEN-ONTWERP §4](HUISHOUDEN-ONTWERP.md).

| Gebied | Toevoeging |
|---|---|
| Huishouden | `groups.soort`, `huishouden_eters`, `meal_plan.eters` |
| Voorraad | `pantry_items.group_id`, `vervalt_op`, `plek`, `geopend_op`, `bron_recept_id` |
| Recepten | `collecties`, `collectie_recepten`, `recipes.notitie` |
| Creator | `creator_profielen`, `volgers`, `aanbod` (collectie of membership), `aankopen` (bestaat), `uitbetalingen` |
| Transactioneel | RPC's `kringloop_aanvullen`, `kringloop_klaar_met_winkelen`, `kringloop_gekookt` met idempotentiesleutel |

**Regel:** alleen additief. Eerst staging, met een migratieplan, back-up en terugvalplan (poort G1).

## 7. Creatorplatform en betalingen (voorbereiden, niet activeren)
| Onderdeel | Keuze (voorstel) | Waarom |
|---|---|---|
| Betaalprovider | **Stripe Connect (Express)**. Alternatief: Mollie Connect (BE/NL-sterk, Bancontact) | Marktplaats met uitbetalingen, KYC, btw (Stripe Tax), SCA/PSD2; wij slaan nooit kaartgegevens op |
| In-app op iOS/Android | Digitale inhoud in native apps valt onder de App Store-/Play-regels. Web-checkout eerst; native IAP pas na een juridische check (DMA/EU-regels veranderen) | Externe verplichting |
| Consumentenrecht EU | Herroepingsrecht digitale inhoud (afstand bij directe levering, expliciet vragen), transparante prijs incl. btw, opzeggen in 2 klikken | Wetgeving |
| Btw | OSS-regeling voor B2C digitale diensten in de EU | Fiscaal |
| Fraude/refunds | Provider-dashboards, Radar; refundbeleid per aanbod | — |

Status: architectuur en datamodel in §6. **Niets geactiveerd. ⛔ G5** (en vooraf een juridische, fiscale en beveiligingscontrole).

## 8. Beveiliging en privacy
| Punt | Status |
|---|---|
| SSRF bij import en push, mass assignment, zod-DoS (begrensde lijsten) | ✅ opgelost op `v2/dev` |
| TanStack/seroval-kwetsbaarheden | ✅ in V2; **live V1: fix klaar op `security/tanstack-seroval` (39bd303), wacht op ⛔ G3/G4** |
| zod 3 advisory (BUG-035) | 🟨 gemitigeerd; zod 4-migratieplan klaar |
| Account verwijderen laat foto's achter (BUG-025) | 🟨 open (privacy) |
| Huishouden-RLS (nieuw) | ⛔ G2: eerst op staging testen met twee nepgebruikers |
| Uitnodigingen | Token per uitnodiging (bestaat); verloopdatum ⬜ |
| Demo | Altijd nep-Supabase, nooit productiedata ✅ |

## 9. Roadmap: snelste veilige weg
**Spoor A (nu, zonder migratie):**
- **WP1 Vijf plekken.** Onderbalk Vandaag · Week · Lijst · Keuken · Ontdek. Keuken bundelt recepten en voorraad. "Nieuw" in de kop. ✅ **Gebouwd en getest** (zie §9a).
- **WP2 "Wat eten we vanavond?"** Niets gepland → drie gerechten die je bijna helemaal in huis hebt. Eén tik plant het en zet wat ontbreekt op de lijst. ✅ **Gebouwd en getest** (zie §9a).
- **WP3** Vandaag als één contextkaart: koken over X min → ontbreekt iets → vanavond → week half leeg. ✅ **Gebouwd en getest** (zie §9b).
- **WP4** Gerecht verwijderen of vervangen in het menu → lijst automatisch bijsturen (met ongedaan maken). ✅ **Gebouwd en getest** voor het eigen weekmenu (zie §9b).
- **WP5** Winkelmodus: overslaan of vervangen ("geen verse spinazie → diepvries"). ✅ **Gebouwd en getest** (zie §9c), met eigen boodschappen beschermd, instelbare etenstijden en BUG-055.
- **WP6** Planner opsplitsen in onderdelen; tablet als eigen ervaring. ✅ **Gebouwd en getest** (zie §9c).
- **WP7** Recept: ingrediënt vervangen (eigen tabel plus AI-terugval), persoonlijke notitie (lokaal tot G1).

**Spoor B (parallel voorbereiden; uitvoeren na G1/G2):**
- **WP8** Staging opzetten (Supabase-project, seed, back-up/PITR, terugval).
- **WP9** Huishouden en mee-eters.
- **WP10** Voorraad met plekken, vervaldatum en restjes.
- **WP11** Transactionele RPC's voor de kringloop.
- **WP12** Collecties.

**Spoor C (later; ontwerp mag parallel):**
- **WP13** Creatorprofielen en volgen.
- **WP14** Betaalde collecties en memberships (⛔ G5).

**Volgorde:**
- WP1 → WP3 hangen samen; WP2 kan parallel.
- WP4 en WP5 zijn onafhankelijk.
- WP8 is de sleutel voor alles in spoor B: **hoe sneller staging er is, hoe sneller het huishouden er komt.**

## 9a. Verificatie 2026-11-09: wat écht gebouwd en gecontroleerd is
Alles hieronder is in **Chromium-emulatie** met **nepdata** getest (lokale nep-Supabase). Er zijn geen tests op echte toestellen of met een schermlezer gedaan.

**Navigatie (WP1)**
- Vijf plekken met het juiste actieve item voor elke route, op 390 px en desktop. Lijst is ook actief op `/aanvullen`. Keuken is ook actief op `/recepten/*` en `/voorraad`.
- Een terugknop staat alleen op onderliggende schermen.
- "Nieuw" staat in de kop, op alle breedtes.
- Test: `navigatie.spec.ts`.

**Rondleiding**
- De rondleiding heeft 7 stappen: de vijf plekken, Nieuw en Meer.
- Elke stap wijst iets zichtbaar aan, en de uitleg bedekt het aangewezen onderdeel nooit. Zit het onderdeel onderaan, dan staat de kaart bovenaan.
- Axe meldt niets ernstigs.
- **Gevonden en hersteld:** op een trage start bestond het aangewezen onderdeel nog niet. Er werd dan niets omkaderd. Nu meet de rondleiding opnieuw tot het onderdeel verschijnt, hooguit ~5 s.

**Keuken als één geheel**
- Recepten en Voorraad zijn één wissel bovenaan. Het voorraadtal staat zichtbaar.
- Elke receptkaart toont "Alles in huis" of "N ontbreekt".
- Een recept toont "X van Y in huis" en een markering per ingrediënt.
- Vanuit Voorraad ga je met één tik naar recepten die je nu kan maken.
- Test: `navigatie.spec.ts`, onderdeel Keuken.

**"Wat eten we vanavond?" (WP2)**
- Is er niets gepland, dan toont de app maximaal drie voorstellen met wat je in huis hebt.
- Eén tik plant het gerecht op vanavond en zet alleen het tekort op de lijst, met "Ongedaan maken".
- Staat het gerecht al gepland, dan meldt de app dat en verandert er niets.
- **Gevonden en hersteld (390 px):** de knop "Vanavond" duwde de receptnaam weg tot "Ch…". Nu staat de knop onder de naam.
- **Gevonden en hersteld:** in meldingen braken lange woorden middenin ("Chocoladem-ousse"). Nu gaat "Ongedaan maken" naar een eigen regel.

**Betrouwbaarheid.** De fouten in deze tests zijn nagebootst met de nep-Supabase.

| Situatie | Resultaat |
|---|---|
| Kook vanavond, het opslaan van de lijst mislukt | Planning teruggedraaid, lijst onveranderd, melding "Er is niets veranderd" |
| Kook vanavond, lijst én terugdraaien mislukken | De planning blijft staan, en de app zegt **"Dat lukte maar half"**, niet "niets veranderd" |
| Kook vanavond, dubbel tikken | Eén planning |
| Aanvullen, de tweede schrijfstap mislukt | Bijgetelde regels teruggezet |
| Klaar met winkelen, opruimen mislukt | Voorraad teruggezet, lijst blijft |
| Klaar met winkelen, dubbel tikken | Eén keer verwerkt |
| Twee vensters vullen tegelijk aan | Geen dubbele regels |
| Ongedaan maken (winkelen, aanvullen, koken, vanavond) | Herstelt alles. Werkt maar één keer. Mislukt het, dan volgt een melding (vroeger: stil) |
| Koken, voorraad bijwerken mislukt | Er volgt nu een melding (vroeger: stil) |

**Grens (eerlijk):** dit is compensatie in de app, **geen databanktransactie**. Gaat de verbinding weg of wordt de app gesloten tussen twee stappen, dan kan half werk blijven staan. De gebruiker krijgt dan wel de juiste melding, zolang de app nog open is. Echte alles-of-niets vraagt RPC's (WP11, ⛔ G1).

**Regressie (volledige run, echte exitcodes):** `tsc` **EXIT 0** · Vitest **EXIT 0**: 418/418 in 19 bestanden · Playwright **EXIT 0**: 191 geslaagd, 0 mislukt, 66 overgeslagen, over alle projecten (telefoon, desktop, 360, 390, tablet).
- De overgeslagen tests zijn bewust: schermafdruk-specs draaien alleen met `SCHERMEN=1`, en persona-tests gelden alleen voor telefoon óf voor desktop.
- Een eerdere volledige run gaf **EXIT 1**. De rondleidingstest faalde op 390 px door een trage start. Het herstel staat hierboven; daarna haalde `navigatie.spec.ts` 18/18 bij 3× herhalen.
- Gerichte runs: `kringloop.spec.ts` 22/22 (390 + desktop), schermafdrukken 4/4.

**Schermafdrukken:** `docs/foodloapp-v2/schermen/v2.html` op 390 px en 1280 px (Vandaag gepland, Vandaag leeg met voorstellen, na "Vanavond", Nieuw-menu, de vijf plekken, de 7 rondleidingsstappen). De PNG's blijven lokaal (`*.png` staat in .gitignore).

## 9b. Verificatie WP4 en WP3 (2026-11-09)
Alles in **Chromium-emulatie** met **nepdata**. Er zijn geen tests op echte toestellen of met een schermlezer gedaan.

**WP4: weekmenu gewijzigd → lijst bijgestuurd**
- Rekenregel: `lijstBijsturen` in `lib/kringloop.ts` (puur), 15 unit-tests:
  - erbij, weg, vervangen en verplaatsen;
  - porties, eenheden en dubbels;
  - eigen regels;
  - meerdere dagen en idempotentie;
  - telbare dingen.
- Databank: `wijzigMenu` met `planErbij`, `planWeg`, `planVervang` en `planVerplaats`.
  - Menu en lijst vormen samen één actie. Mislukt de lijst, dan wordt de menuwijziging teruggedraaid.
  - Daarna volgt een nacontrole: dubbels, bijvoorbeeld uit een tweede venster, worden meteen samengevoegd.
- Weekmenu (eigen planning):
  - de vragen "Ook op je boodschappenlijst?" en "Ook van je lijst halen?" zijn weg. Er volgt één melding, bijvoorbeeld "Pasta uit je weekmenu · lijst: 1 minder, 1 eraf", met **Ongedaan maken**;
  - nieuw: **Ander gerecht** (vervangen), waarbij het huidige gerecht niet in de keuze staat;
  - dezelfde weg geldt voor de receptpagina ("Plan dit"), voor een nieuw recept koppelen aan een maaltijd, voor het weekvoorstel en voor "Kook dit vanavond";
  - de handmatige knop "Op boodschappenlijst" in het maaltijdmenu blijft.
- Regels:
  - eigen regels (`recipe_id` leeg) worden nooit verlaagd of gewist;
  - per product blijft er één Foodlo-regel over (g/kg, ml/cl/dl/l/el/tl, stuks);
  - alleen weghalen zet nooit iets bij;
  - alleen maaltijden in de komende 7 dagen sturen bij wat erbij komt, zoals bij Slim aanvullen ("Volgende week opnieuw" laat de lijst dus gelijk).
- **Gevonden en hersteld tijdens het bouwen:**
  - "gehakt" kreeg een lege productsleutel (het is ook een bijwoord) en werd op de lijst nooit herkend. Slim aanvullen kon het daardoor dubbel zetten;
  - geschaalde porties gaven "1,14 uien". Telbare dingen worden nu naar boven afgerond, gewicht en volume blijven exact;
  - Slim aanvullen meldde regels voor later geplande gerechten (buiten 7 dagen) ten onrechte als "niet meer nodig";
  - BUG-030 op een nieuw pad: een venster dat vanuit het maaltijdmenu opent, verloor de focus aan het sluitende menu.
- E2e `weekmenu-lijst.spec.ts` (390 px + desktop):
  - weg (met ongedaan maken);
  - vervangen (met ongedaan maken);
  - buiten 7 dagen;
  - fout bij verwijderen van lijstregels: menu en lijst onveranderd;
  - fout bij toevoegen: niets half;
  - **twee vensters tegelijk**: één regel per product, juiste totalen.
  - Drie keer herhaald samen met `kringloop.spec`: 102/102.
- Grenzen: zie §14 (eigen regel die niet verkleint, geen transactie). Het gezinsweekmenu houdt de oude vragen tot het huishouden (WP9).
- **Voorstel, wacht op jou (G7):** "Alles van deze week op de lijst" in het weekmenu doet nu hetzelfde als Slim aanvullen plus WP4, maar via de oude weg (zonder herberekening). Mijn voorstel is samenvoegen met Slim aanvullen. Ik heb niets weggehaald.

**WP3: Vandaag als één helder startscherm**
- Bovenaan staat één **Nu-kaart** met precies één situatie, één hoofdknop en hooguit één tweede actie. De beslissing staat in `lib/vandaag.ts` (puur, 16 unit-tests). De volgorde:
  1. je was aan het koken → **Ga verder met koken** (stap X van Y);
  2. voor vandaag ontbreekt iets → **Zet op mijn lijst** (alleen wat vandaag nodig is);
  3. alles staat op je lijst maar is niet gekocht → **Naar mijn lijst**;
  4. alles in huis → **Start koken**, met "Begin om 16:30" als het nog vroeg is;
  5. gepland zonder recept → naar het weekmenu;
  6. vanaf 21 u → **Morgen** (wat ontbreekt, of "Plan morgen");
  7. niets gepland → "Wat eten we vandaag?" met drie voorstellen uit de voorraad;
  8. nog geen recepten → eerste recept.
- Daaronder komt **Daarna**, met hooguit drie signalen en nooit iets dat de Nu-kaart al zegt:
  - "N dingen ontbreken voor je komende maaltijden" met de knop **Zet op mijn lijst**;
  - "N dagen nog vrij";
  - "N dingen op je boodschappenlijst".
- Op Vandaag weggehaald:
  - de grote aanvulkaart: die zit nu in de Nu-kaart en in Daarna, en blijft op Lijst staan;
  - de snelkoppelingen "Boodschappen" en "Wat kan ik koken?": die staan al in de onderbalk (Lijst, Keuken);
  - de band "Zin in iets nieuws?": die is al te vinden via Ontdek.
  - Er is geen functie verdwenen; alleen dubbele ingangen zijn weg.
- Laden: één leesronde (`lib/vandaag-db.ts`). De stand ververst na elke menu-, lijst- of voorraadwijziging.
- **Gevonden en hersteld:** op 390 px brak "20 dingen ontbreken" in smalle stukjes naast de knop. De knop staat nu onder de tekst.
- E2e `vandaag.spec.ts` met vaste klok:
  - 14 u: aanvullen, hooguit twee acties, Daarna herhaalt niets, axe;
  - 22 u: morgen;
  - hervatten.
- `kringloop.spec`: de volledige lus begint nu op de Nu-kaart (aanvullen → winkelen → Daarna).
- Schermafdrukken: `docs/foodloapp-v2/schermen/v2.html`, nrs. 30–33 (WP3) en 20–24 (WP4), op 390 px en desktop.

**Regressie na WP4 en WP3 (echte exitcodes):** 

| Run | tsc | Vitest | Playwright (alle projecten) |
|---|---|---|---|
| Na WP4 (vóór de herstellingen hieronder) | EXIT 0 | EXIT 0 (432/432) | **EXIT 1**: 199 geslaagd, 4 mislukt (kernflow: 1,14 uien, zie boven), 68 overgeslagen |
| Na WP3, eerste volledige run | EXIT 0 | EXIT 0 (449/449) | **EXIT 1**: 208 geslaagd, **1 mislukt**, 74 overgeslagen |
| Na WP3, tweede volledige run (gecommitte stand) | **EXIT 0** | **EXIT 0** (449/449, 21 bestanden) | **EXIT 0**: 209 geslaagd, 0 mislukt, 74 overgeslagen |

- De ene fout in de eerste WP3-run zat in "netwerkfout bij bewaren" (tablet-768). Het automatische receptconcept verscheen niet binnen 20 s, aan het einde van een run van 11 minuten.
- Apart vijf keer per project herhaald: 20/20 geslaagd. Het is dus een **sporadische timingfout** in een bestaande test, en ze is **niet opgelost**.
- Ze staat als risico in §14 en als open punt in het bugregister.
- De overgeslagen tests zijn bewust overgeslagen: schermafdruk-specs draaien alleen met `SCHERMEN=1`, en persona-tests gelden alleen voor telefoon óf desktop.

## 9c. Verificatie WP5 en WP6 (2026-11-09)

### Wat er gebouwd is
**WP5, de winkelmodus.**
- Elk product heeft een knop **Niet gevonden**, met twee keuzes:
  - **Overslaan**: het product blijft op je lijst, maar telt deze winkelbeurt niet meer mee. Dat blijft zo na herladen, per toestel. Met **Toch gevonden** zet je het terug.
  - **Vervangen**: hoeveelheid en eenheid staan al ingevuld. Het gekoppelde gerecht en de notitie blijven, en het product gaat meteen in je kar. Er is **Ongedaan maken**, en een foutmelding als bewaren mislukt.
- Een vervanging heet bijvoorbeeld "Diepvriesspinazie (i.p.v. spinazie)". Ze telt voor de maaltijd, voor Slim aanvullen, na het winkelen voor de voorraad, en bij het koken voor het verbruik, als het oorspronkelijke product. Een eigen kolom is niet nodig (B9).
- Snelle voorstellen ("Diepvries spinazie", "Tomaten uit blik") verschijnen alleen voor producten waar dat klopt. Geen AI, dus geen kosten.

**Eigen boodschappen beschermd (B7).**
- Foodlo past regels die je zelf toevoegde nooit meer aan, ook niet door bij te tellen. Wat een gerecht extra nodig heeft, komt op een eigen regel "voor <gerecht>".
- Elk verwijderen is exact terug te zetten, ook meerdere tegelijk. Voorheen verloor de regel daarbij zijn koppeling aan het gerecht (BUG-058).
- "Ongedaan maken" van een toevoeging wist geen regels meer die een ander toestel intussen toevoegde (BUG-059).
- "Wat ik in huis heb afvinken" herkent echte producten: voorraad "ui" vinkte vroeger ook "suiker" af (BUG-057). Dat afvinken is nu ook ongedaan te maken.

**Instelbare eetmomenten.**
- Instellingen → **Wanneer eet je?** Een tijd per actief moment; "alles in één blok" volgt het avondeten.
- Vandaag rekent "Begin om" met jouw tijd, en kijkt pas twee uur na je avondeten (op zijn vroegst om 21 u) naar morgen.
- Opgeslagen in de bestaande profielinstelling `weekmenu`, zonder schemawijziging.

**BUG-055 opgelost (geen testprobleem maar een appfout).**
- De concept-autosave wachtte niet op de aanmelding.
- Hij probeerde ook nooit opnieuw na een fout of na een overlap.
- Bewezen met een nieuwe test, die faalt op de oude code en slaagt op de nieuwe.

**BUG-056.**
- In de winkelmodus en bij "Eerder gekocht" en "Vaak gekocht" kon de rij met afdelingen niet scrollen.
- Op 390 px was de derde afdeling daardoor onbereikbaar. Die fout bestond al in V1.

**Kostenrem** (zie §16):
- vertalen met cache en limieten (BUG-061);
- een maandbudget voor alle AI;
- een schatting als de prijs van een model ontbreekt.

**WP6: het weekmenu opgesplitst.**
- `routes/planner.tsx` ging van 3 392 naar ±1 600 regels.
- Zeven onderdelen staan nu in `components/planner/`: gedeelde helpers, recept kiezen, lijstvraag, instellingen, weekvoorstel, verplaatsen/koppelen en tabletweek.
- De code is alleen verplaatst, zonder logicawijziging. Alle bestaande weekmenu- en kernflowtests slagen.

**WP6: tablet als eigen ervaring (768–1023 px, B8).**
- Een zijbalk met de vijf plekken, in plaats van een onderbalk.
- **Weekmenu:** links de week met wat er gepland staat, rechts de gekozen dag.
- **Vandaag:** de Nu-kaart met de foto ernaast; "Daarna" en "Ook vandaag" naast elkaar.
- **Recept en voorraad:** tweekoloms kop.
- **Lijst:** één brede kolom. Twee kolommen kapten op 768 px de productnamen af; dat bleek uit de review.
- De vaste balken staan op tablet niet meer boven een onderbalk die er niet is.
- De rondleiding wijst ook de zijbalk aan.
- Liggende tablets (1024 px en breder) krijgen de desktopweergave.

### Testresultaten (echte exitcodes)
| Run | Wat | Resultaat | Exitcode |
|---|---|---|---|
| BUG-055 op de **oude** code | nieuwe test | 1 mislukt (zoals verwacht) | **1** |
| BUG-055 op de nieuwe code | 3 tests × 3 viewports × 3 herhalingen | 36/36 | 0 |
| WP5 winkelmodus, eerste poging | 10 tests, desktop + 390 | 6 mislukt: de testlocators waren dubbelzinnig, en op 390 px was een afdeling onbereikbaar (**echte fout**, BUG-056) | **1** |
| WP5 winkelmodus, na de herstellingen | ×2 herhaald | 24/24 | 0 |
| Geraakte specs na "eigen regels nooit aanpassen" | kernflow, kringloop, weekmenu-lijst, vandaag, voorraad | 82 geslaagd, 5 mislukt: 4 verwachtten nog het bijtellen bij een eigen regel (tests aangepast aan B7), 1 werd verstoord doordat ik tijdens de run een bronbestand bewerkte | **1** |
| Dezelfde specs plus WP5, opnieuw | desktop + 390 | 99/99 | 0 |
| Tablet en navigatie (768) | eerste poging | 7 geslaagd, 1 mislukt: de rondleiding vond de zijbalk niet (**echte fout**, hersteld) | **1** |
| Navigatie op 390, 768 en 1280 | | 9/9 | 0 |
| Tablet-spec na de review | | 5/5 | 0 |
| Lint-ratchet na elke commit | | 2× eerst 1 (opmaak in een nieuw bestand), na prettier 0 | 0 |
| **Volledige regressie** op commit `80dcfe4` | `tsc` | 0 fouten | **0** |
| | `vitest` | 465/465, 23 bestanden | **0** |
| | `vite build` | geslaagd | **0** |
| | Playwright, alle projecten (319 tests) | 242 geslaagd, 0 mislukt, 77 bewust overgeslagen (schermafdruk-specs zonder `SCHERMEN=1`, persona-tests per toestel) | **0** |

Alles draait in **Chromium-emulatie** met nepdata: telefoon 360/390/412, tablet 768 met aanraking, desktop 1280. Ik heb **niet** getest op een echte iPhone, Android-toestel of iPad, en **niet** met VoiceOver of TalkBack.

## 10. Acceptatiecriteria (per WP, kort)
| WP | Criterium |
|---|---|
| WP1 | Elke bestaande route blijft bereikbaar. De actieve tab klopt voor alle 30 gebruikersroutes. De onderbalk heeft vijf labels zonder afkapping op 360 px. Axe zonder ernstige meldingen. Persona-taken zijn nog even kort of korter |
| WP2 | Niets gepland voor vanavond → maximaal drie voorstellen, gesorteerd op het minste dat ontbreekt. Eén tik zet het gerecht vandaag op het avondeten en wat ontbreekt op de lijst (geen dubbels). Ongedaan maken herstelt beide |
| WP3 | De Nu-kaart toont precies één situatie, met één hoofdknop en hooguit één tweede actie. "Daarna" herhaalt niets uit de Nu-kaart. De inhoud hangt van het uur af en wordt getest met een vaste klok. Axe zonder ernstige meldingen |
| WP4 | Erbij, weg, vervangen en verplaatsen sturen de lijst bij. Eigen regels worden nooit verlaagd of gewist. Eén regel per product. Fouten → niets half. Twee vensters tegelijk → geen dubbels. Ongedaan maken → menu én lijst terug |
| WP5 | Overslaan houdt het product op de lijst (ook na herladen). Vervangen bewaart hoeveelheid, eenheid en gerecht, telt na het winkelen voor de maaltijd ("alles in huis") en is ongedaan te maken. Opslaan mislukt → melding, lijst onveranderd, opnieuw lukt. Eigen regels: nooit door Foodlo aangepast; verwijderen altijd exact terug te zetten. Elke afdeling bereikbaar op 390 px |
| WP6 | Planner opgesplitst zonder gedragswijziging (alle bestaande E2E groen). Tablet 768: zijbalk, geen onderbalk, geen horizontaal scrollen; weekmenu week\|dag; Vandaag en recept tweekoloms; lijst leesbaar zonder afkapping; rondleiding wijst de zijbalk aan |
| Kringloop | K1–K7 ([PRODUCT-HERONTWERP §7](PRODUCT-HERONTWERP.md)) ✅ |
| Huishouden | H1–H6 ([HUISHOUDEN-ONTWERP §6](HUISHOUDEN-ONTWERP.md)) |

## 11. Teststrategie
| # | Categorie | Nu | Doel |
|---|---|---|---|
| 1 | Unit/component | 465 (Vitest), incl. kringloop, vervangen, kostenrem en maandbudget | Elke domeinfunctie |
| 2 | Integratie/API | Serverfuncties tegen de nep-Supabase | + RPC's op staging |
| 3 | E2E | 18 specs (Playwright), kringloop van begin tot einde, navigatie (telefoon, tablet, desktop), winkelmodus, tablet, betrouwbaarheid met storingen | Per WP een volledige stroom |
| 4 | Toegankelijkheid | axe op alle schermen (390 px) | + handmatig VoiceOver/TalkBack (**niet gedaan**) |
| 5 | Mobiel/responsief | 6 breedtes, 19 schermen, tablet en desktop | + echte toestellen (**niet gedaan**) |
| 6 | Beveiliging/autorisatie | Unit (SSRF, rechten) | RLS-tests met twee gebruikers op staging |
| 7 | Data-integriteit/migratie | Gelijktijdigheid en ongedaan maken in de kringloop | Telling vóór en na de migratie op staging |
| 8 | Fout/laden/herstel | Storingssimulatie (`/__storing`) | Per nieuw scherm |
| 9 | Performance/belasting | — | k6 of vergelijkbaar op staging |
| 10 | Kosten/AI | Credits, ai_usage, maandbudget en kostenrem (unit, nep-Supabase) | Kosten per actieve gebruiker in beheer (§16) |

Alles hierboven draait in **Chromium-emulatie**. Er zijn **geen** tests op een echte iPhone of Android of met een schermlezer uitgevoerd.

## 12. Open bugs (uittreksel, zie register)
| ID | Prioriteit | Onderwerp |
|---|---|---|
| BUG-025 | Medium (privacy) | Foto's blijven staan na account verwijderen |
| BUG-061 | Hoog (kosten, **live**) | Vertalen zonder limiet: opgelost op `v2/dev`, live pas na release (G3/G4) |
| BUG-012 | Medium (kosten) | Base64-foto's in de AI-cache |
| BUG-035 | Medium | zod 3 advisory (gemitigeerd) |
| BUG-011 | Medium | Twee migratiemappen; `inspiration_*` ontbreekt in de migraties |
| BUG-037/038/026/016/014/013 | Laag | Zie register |
| BUG-086 | Medium | Geen test op echte toestellen of met een schermlezer (wacht op toestemming voor netwerktoegang) |
| BUG-087 | Laag | Afdelingsvolgorde per toestel, niet gedeeld (G1) |

Er staan geen kritieke of hoge bugs open op `v2/dev`. Live V1 heeft er nog twee (TanStack/seroval, BUG-061) zolang de beveiligingsrelease niet is uitgerold.

## 13. Beslissingen
| ID | Beslissing | Status |
|---|---|---|
| B1 | Vijf plekken in de onderbalk, "Nieuw" in de kop | Genomen en gebouwd (omkeerbaar) |
| B2 | Omkeerbare acties zonder bevestiging, met ongedaan maken | Genomen |
| B3 | Huishouden vervangt gezin en vriendenrechten; vrienden delen per ding | Ontwerp, wacht op G1/G2 |
| B4 | Geen rewrite; bestaande stack blijft | Genomen |
| B5 | Betaalprovider Stripe Connect (voorstel) | **Wacht op jou** |
| B6 | Staging-Supabase-project aanmaken | **Wacht op jou** (G1, kosten) |
| B7 | Eigen lijstregels past Foodlo nooit aan; wat een gerecht extra nodig heeft, komt op een eigen regel "voor <gerecht>". Zo kan dezelfde productnaam twee keer op de lijst staan: jouw regel en die van Foodlo | Genomen (WP5; jouw eis "niet onbedoeld aanpassen" gaat voor "één regel per product") |
| B8 | Tablet 768–1023: zijbalk, week\|dag, lijst in één brede kolom | Genomen (WP6) |
| B9 | Vervangen product wordt gemarkeerd in de naam ("X (i.p.v. Y)") in plaats van in een nieuwe kolom | Genomen (geen schemawijziging); kolom later mogelijk (G1) |

## 14. Risico's
| Risico | Impact | Mitigatie |
|---|---|---|
| Geen staging → huishouden en voorraadvelden blijven geblokkeerd | Hoog | B6 zo snel mogelijk |
| Lovable-conflicten bij grote bestanden | Middel | Gerichte wijzigingen, lint-ratchet, geen massale herformattering |
| Meerstapsacties zonder transactie (kringloop client-side) | Middel | Herstelfunctie nu; RPC's na G1 |
| ~~WP4: eigen regel waarbij Foodlo bijtelde, wordt bij weghalen niet verkleind~~ | — | **Opgelost in WP5 (B7):** Foodlo telt niet meer bij eigen regels bij |
| B7: hetzelfde product kan twee keer op de lijst staan (jouw regel en "… voor <gerecht>") | Laag (duidelijk gelabeld, nooit dubbel door Foodlo zelf) | Later visueel groeperen in één rij met twee bronnen (geen schema nodig) |
| WP4: twee leden die exact tegelijk wijzigen → laatste schrijver wint per regel; de nacontrole voegt dubbels samen, maar zonder transactie is een zeldzame afwijking mogelijk | Laag | RPC per menuwijziging (WP11, ⛔ G1) |
| ~~Sporadische timeout van de concept-autosave~~ | — | **Opgelost (BUG-055):** het was een appfout. Eén van de twee oorzaken (aanmelding laadt na het typen) is aannemelijk maar niet afzonderlijk nagebootst |
| ~~WP3: vaste etenstijden~~ | — | **Opgelost in WP5:** instelbaar per moment |
| WP5: "overgeslagen" geldt per toestel en per sessie (sessionStorage), niet voor een gezinslid op een ander toestel | Laag | Presence/gedeelde winkelbeurt in fase 2 |
| WP5: de vervangmarker zit in de naam. Haalt iemand "(i.p.v. …)" weg bij het aanpassen, dan vervalt de koppeling met het oorspronkelijke product | Laag | Kolom `vervangt` (⛔ G1) als dit in de praktijk gebeurt |
| WP5: het paneel "Niet gevonden" en de winkelmodus houden de toetsenbordfocus niet volledig vast (geen focus trap) | Laag (a11y) | Radix-dialog gebruiken bij de volgende ronde |
| WP6: tablet getest op 768 × 1024 (staand) in emulatie. Andere tabletmaten (820, 834, 1180 liggend) en echte iPads zijn niet getest | Middel | Testronde op een echte iPad vóór de release |
| Review: het tijdveld in Instellingen toont AM/PM in de emulatie; op een toestel volgt het de taal van het toestel | Laag | Controleren op een echt toestel |
| Kosten: maandbudget en vertaalrem werken per serverinstantie, met een stand van hooguit 5 minuten oud | Laag | Voldoende als noodrem; echte boekhouding blijft `ai_usage` |
| Live V1 draait nog met de bekende TanStack/seroval-kwetsbaarheid | Hoog | Fix klaar, wacht op G3/G4 |
| Geen echte toesteltests | Middel | Testronde op iPhone en Android vóór een release |
| AI-kosten bij groei | Middel | Eerst eigen logica, credits, maandbudget, kostenrem (§16); BUG-012 |

## 15. Wat jouw akkoord nodig heeft
1. **G1/B6:** een staging-Supabase-project (kosten, nieuw project) om het huishouden, de voorraadvelden en RPC's te kunnen bouwen.
2. **G3/G4:** de beveiligingsfix voor live V1 (branch klaar).
3. **B5/G5:** de keuze van betaalprovider (niets activeren).
4. Pushen van `v2/dev` (lokaal voor op de remote; niets gepusht).
5. **G7:** "Alles van deze week op de lijst" samenvoegen met Slim aanvullen (§9b).
6. **G9 (kosten, nieuw):** zie §16.6. Spend caps controleren, het maandbudget kiezen (€25 is een voorstel, niet actief), beslissen over het dure zoekmodel en over automatische AI-foto's.
7. **BUG-061** (vertalen zonder limiet) zit ook in live V1. De fix kan mee in de beveiligingsrelease (G3/G4).
8. **Netwerktoegang voor de demo** (`DEMO_LAN=1`) voor de praktijktest op echte toestellen. Staat klaar, maar is niet geactiveerd (PRAKTIJKTEST-TOESTELLEN §1).
9. **Migratie boodschappen V2** (sjablonen, winkels, merk/variant, foto's): voorstel klaar, niet uitgevoerd. Eerst G1/B6 (MIGRATIE-VOORSTEL-BOODSCHAPPEN §5).
10. Optioneel en gratis: de WebKit-browser voor Playwright installeren (`npx playwright install webkit`, ± 100 MB download), zodat de Safari-engine mee getest wordt.

## 16. Kostenbeheersing (bindend sinds 2026-11-09)

### 16.1 Regels
1. Bestaande tools en abonnementen eerst: Lovable (bouwen, hosting, Lovable Cloud = Supabase, AI-gateway, e-mail), GitHub, lokale nep-Supabase voor tests en demo.
2. **Geen nieuwe betaalde dienst, abonnement, API, upgrade of aankoop zonder jouw voorafgaand akkoord** (nieuwe poort **G9 — kosten**). Dat geldt ook voor het staging-project (B6) en een betaalprovider (B5).
3. Volgorde voor elke "slimme" functie: **eigen logica → cache → goedkoopste model dat de kwaliteit haalt → duurder model**. Elke AI-oproep loopt via credits (`metCredits`) of de kostenrem, en wordt gemeten.
4. Tests en demo raken nooit een betaalde dienst: AI, e-mail en betalingen zijn er uit of nagebootst (geen `LOVABLE_API_KEY` in de testserver; zie de melding "welkom-mail mislukt LOVABLE_API_KEY is not configured" in elke run).
5. Een kostenwijziging die je niet kan terugdraaien (vooruitbetaling, jaarplan, commit-tarief) is altijd jouw beslissing.

### 16.2 Vaste en variabele kosten

| Post | Soort | Waar | Hoe begrensd |
|---|---|---|---|
| Lovable-abonnement (bouwen + hosting) | **Vast** per maand | Lovable | Jij kiest het plan; niets automatisch upgraden |
| Lovable Cloud (databank, auth, opslag, functies) | Vast basisdeel + **variabel** gebruik | Lovable Cloud / Supabase | Maandtegoed van het plan; nooit zelf bijkopen; meten in Control Center |
| AI (tekst, foto's herkennen, beelden maken, vertalen, web zoeken) | **Variabel** per oproep | Lovable AI-gateway | Credits per gebruiker, daglimiet per functie, aan/uit per functie, **maandbudget (nieuw)**, cache |
| E-mail (welkom, meldingen) | Variabel per mail, meestal binnen gratis tier | Lovable e-mail / Resend als terugval | Alleen transactioneel; geen nieuwsbrieven zonder akkoord |
| Opslag foto's | Variabel (GB/maand + uitgaand verkeer) | Supabase Storage | Foto's verkleinen bij upload; BUG-012 (AI-foto's als base64 in cache) oplossen na G1 |
| Domein | Vast per jaar | Registrar (bestaand) | — |
| Betalingen | Variabel (% per transactie), **niet actief** | Voorstel Stripe (B5) | Alleen na G5; nooit zelf kaartgegevens opslaan |
| Ontwikkeling (Lovable-credits voor bouwen in de editor) | Variabel | Lovable | Werk in Claude Code lokaal op `v2/dev` kost geen Lovable-credits; pas bij synchroniseren/bouwen in Lovable |

### 16.3 Kosten per AI-actie (schatting)

Prijzen zijn **niet geverifieerd op een eigen factuur**. Ze komen uit openbare prijsoverzichten van derden (november 2026) en kunnen via de Lovable-gateway anders zijn. Controleer ze in het Control Center (`model_prices`) of op je Lovable-factuur, en vul `model_prices` aan. Zonder prijs rekent Foodlo nu met een **voorzichtig hoge schatting**, niet met 0 (zie 16.5).

Aanname Gemini 3.8 Flash ≈ $0,75 per miljoen invoertokens en $3,75 per miljoen uitvoertokens.

| Actie (feature) | Model in code | Tokens (schatting) | Kost per actie | Credits voor de gebruiker |
|---|---|---|---|---|
| Recept uit link (`import_url`) | Gemini 3.8 Flash | 3 000 in / 800 uit | ± €0,005 | 1 |
| Recept uit tekst (`import_tekst`) | Gemini 3.8 Flash | 2 000 / 800 | ± €0,004 | 1 |
| Recept of gerecht uit foto (`import_foto`, `gerecht_foto`) | Gemini 3.8 Flash | 2 500 / 800 | ± €0,005–0,01 | 3 |
| Ingrediënten op foto (`ingredienten_foto`) | Gemini 3.8 Flash | 2 000 / 300 | ± €0,003 | 2 |
| Nieuw voor jou (`suggesties`) | Gemini 3.8 Flash | 1 500 / 1 000 | ± €0,005 | 1 |
| Gerecht zoeken, recept uitschrijven, weekmenu-ideeën (`suggesties`, `import_tekst`) | **GPT-6 Astra** (low reasoning) | 1 000 / 1 500 | **onbekend, waarschijnlijk het duurst** | 1 |
| Web zoeken naar recepten (`web_zoeken`) | geen AI-model zelf; resultaten 24 u in cache | — | ± €0 (alleen serververkeer) | 0 |
| Sfeerfoto maken (`foto_maken`) | **GPT-image 2.5** (low, 1024²) | 1 beeld | ± €0,01–0,05 | 2 |
| Vertalen (UI en recepten) | Gemini 3.8 Flash | 1 500 / 1 500 per bundel | ± €0,007 per bundel; dankzij de cache meestal €0 | 0 |

Bevindingen bij het nalopen (2026-11-09):
- **Vertalen** was een open serverfunctie: geen aanmelding, geen limiet, geen meting, geen cache. Wie de functie herhaaldelijk aanroept, laat de AI-rekening oplopen. **Opgelost in code:** een gedeelde cache (dezelfde interfacetekst één keer betalen), max. 40 oproepen per bezoeker per 10 minuten en max. 1 500 per uur per serverinstantie. Daarboven blijft de tekst Nederlands, zonder fout en zonder kosten. Elke oproep wordt gemeten in `ai_events`. De rij `vertalen` in `credit_costs` (daglimiet 200) werd nooit toegepast.
- **Gerecht zoeken, recepten uitschrijven en weekmenu-ideeën** gebruiken het duurste model (GPT-6 Astra) voor 1 credit, evenveel als een Flash-actie. Voorstel: Gemini Flash testen op kwaliteit. Lukt dat niet, dan 2 credits vragen. Beide vragen jouw akkoord: een modelwissel vraagt echte, betaalde testoproepen (G9), en een andere creditprijs verandert wat gebruikers betalen.
- **Sfeerfoto** draait in de code op GPT-image, terwijl `credit_costs` "gemini-3.1-flash-lite-image" vermeldt. Daardoor klopt de kostenberekening niet. Voorstel: het model gelijk trekken of de prijsrij aanvullen. Een modelwissel vraagt een kwaliteitstest met echte oproepen (G9).
- Elk opgeslagen recept zonder foto vraagt automatisch een AI-foto aan (`zorgVoorReceptFoto`, één keer per titel gecachet). Dat is de grootste variabele AI-post per actieve gebruiker. Een instelling "foto's automatisch maken: aan/uit" is goedkoop te bouwen. Voorstel voor WP7.

### 16.4 Raming per fase (schatting, euro per maand)

Aannames voor een **actieve gebruiker per maand**: 4 recepten bewaard (2 uit een link, 2 zelf getypt), 4 automatische foto's, 2× suggesties, af en toe vertalen (gecachet) en geen web zoeken. De AI-kost per actieve gebruiker is dan ±€0,04–0,22 per maand: ±€0,02 tekst plus €0,04–0,20 foto's. **Foto's zijn de grootste onzekerheid.**

| Fase | Gebruikers (actief/maand) | Vast | Variabel (Cloud + AI + mail + opslag) | Totaal (bandbreedte) | Per actieve gebruiker |
|---|---|---|---|---|---|
| **Testfase** (nu: lokaal, demo, enkele testers) | 0–50 | Lovable-plan dat je al hebt (±€25) | AI < €5; Cloud binnen het tegoed van het plan; mail €0 | **±€25–30** | n.v.t. |
| **Eerste lancering** | 500–2 000 | Lovable-plan ±€25–50 | Cloud ±€0–75 boven het tegoed; AI ±€20–440; mail €0–20; opslag < €5 | **±€50–590** | ±€0,10–0,30 |
| **Groei** | 10 000 | Lovable-plan ±€50+ | Cloud ±€100–400; AI ±€400–2 200; mail ±€20–90; opslag/verkeer ±€10–50 | **±€600–2 800** | ±€0,06–0,28 |

Hoe die bandbreedte kleiner wordt:
- **Foto's.** Automatische AI-foto's uit: dat scheelt tot 90 % van de AI-kost. Of goedkopere beelden: BUG-012 plus het juiste model.
- **Credits verkopen.** Bij groei zou de verkoop van credits (`credit_packs`, nu uit) de variabele AI-kost moeten dekken. Starter: 100 credits voor €2,99, dat is €0,03 per credit. Een AI-actie kost ±€0,005–0,05 en vraagt 1–3 credits. Met de huidige prijzen is AI per credit dus kostendekkend. Uitzondering: web zoeken (0 credits) en het automatische deel.
- **Gemeten in plaats van geraamd.** Zodra er echt gebruik is, vervangt het Control Center (`ai_usage.kost_eur`, `beheer/kosten`) deze raming door werkelijke cijfers. Daarvoor moet `model_prices` gevuld zijn.

### 16.5 Budgetlimieten, quota en waarschuwingen

| Laag | Wat | Status |
|---|---|---|
| Per gebruiker | 50 gratis credits bij registratie; credits per AI-actie; daglimiet per functie (`credit_costs.max_per_dag`) | ✅ bestond |
| Per functie | Aan/uit-schakelaar (`credit_costs.enabled`) en creditsysteem aan/uit (`credits_actief`) | ✅ bestond |
| Cache | Zelfde invoer = 0 credits en geen nieuwe oproep (`ai_cache`) | ✅ bestond |
| **Maandbudget alle AI** | `ai_budget_maand_eur` in `platform_settings`. Als niets is ingesteld, gebruikt de code **€25**. Dat is een **ontwerpvoorstel**, geen bevestigde uitgave en geen actief budget: het geldt pas na een merge en deploy, met jouw akkoord. Waarschuwing vanaf **80 %** en blokkade op **100 %** worden gelogd in `ai_events` (`budget:waarschuwing`, `budget:op`). Op 100 % pauzeren alleen de slimme functies, met een duidelijke melding; de rest van de app blijft werken. | ✅ **nieuw (code, getest met nep-Supabase)** |
| Kost zonder prijslijst | Ontbreekt een model in `model_prices`, dan rekent Foodlo met een hoge schatting (€1 per miljoen tokens in, €5 uit, €0,05 per beeld, minimum €0,002), niet met 0 | ✅ nieuw |
| **Vertalen** | Gedeelde cache plus limiet per bezoeker en per uur (zie 16.3) | ✅ nieuw |
| Hosting/databank | Spend cap van het Lovable-plan en Lovable Cloud: **nakijken in je Lovable-instellingen** (Plans & credit usage). Ik kan dat niet zien. | ⚠ jij |
| Melding naar jou | Budgetgebeurtenissen staan in `ai_events` en zijn zichtbaar in het Control Center. Een e-mail of push bij 80 % is nog niet gebouwd. | ⬜ voorstel |

Wat het maandbudget **niet** dekt:
- Het werkt per serverinstantie, met een stand van hooguit 5 minuten oud. Onder zware gelijktijdige last kan het budget een paar oproepen overschrijden.
- Het telt alleen oproepen via `metCredits`. Vertalen heeft een eigen rem.
- Bij het nalopen van de code (2026-11-09) liep elke AI-oproep in `ai.functions.ts` via `metCredits`; vertalen was de enige uitzondering en heeft nu een eigen rem. Regel voor elke nieuwe functie: via `metCredits`.

### 16.6 Wat dit vraagt van jou (G9)
1. Je Lovable-plan en de spend caps controleren (Plans & credit usage). Zo weet je wat vast is en waar je automatisch geblokkeerd wordt.
2. Het maandbudget kiezen: `ai_budget_maand_eur`. €25 is alleen een ontwerpvoorstel en standaardwaarde in de code. Het is niet actief en er is niets uitgegeven. Pas na een merge en deploy van V2 zou AI bij dat bedrag per maand pauzeren, tot jij het aanpast.
3. Beslissen over het dure zoekmodel (Astra → Flash, of meer credits) en over automatische foto's (aan/uit). Dat zijn de twee grootste onzekerheden.
4. Staging (B6) en een betaalprovider (B5) kosten geld en wachten op jou.

## 17. Product- en UX-review na WP6 (2026-11-09)

Hoe beoordeeld: 36 schermafdrukken van 12 hoofdschermen op telefoon (390), tablet (768) en desktop (1280), in Chromium-emulatie met demodata (`tests/e2e/schermen-review.spec.ts`, `SCHERMEN=1`). De bestanden staan lokaal in `docs/foodloapp-v2/schermen/review/` en zitten niet in git. Ik heb ze zelf bekeken. Er is geen gebruikersonderzoek gedaan en niets op echte toestellen getest.

### Oordeel per scherm (1 = zwak, 5 = premium)
| Scherm | Telefoon | Tablet | Desktop | Wat goed is | Wat nog niet goed is |
|---|---|---|---|---|---|
| **Vandaag** | 4 | 4 | 5 | Eén kaart met één beslissing; grote foto; het uur en de toestand sturen wat je ziet | Op de telefoon komt de foto pas ná de knoppen: de eerste indruk is een donker tekstvlak |
| **Week** | 4 | 4 | 4 | Dagstrook met streepjes per maaltijd; tablet week\|dag; desktop 7 kolommen met foto's | Telefoon: titel, planningkeuze, weekkaart en schakelaar staan boven de eerste maaltijd (± 60 % van het scherm). Desktop: lege dagen tonen drie "Toevoegen"-vakken boven elkaar |
| **Lijst** | **2** | 3 | 3 | Winkelmodus is sterk: grote doelen, afdelingen, niet gevonden/vervangen | **Op de telefoon staat geen enkele boodschap boven de vouw**: aanvulkaart, "Ik ga boodschappen doen", tabs, drie tegels en een vast invoerveld gaan eerst. Het vaste invoerveld valt over de tegels. Op desktop is het een smalle kolom met lege zijkanten |
| **Winkelmodus** | 5 | 4 | 4 | Leesbaar met één hand, scherm blijft aan, "niet gevonden" duidelijk | Tablet/desktop: veel lege ruimte bij weinig producten |
| **Keuken (recepten)** | 3 | 3 | 3 | Collecties als foto-tegels; zoeken bovenaan | Collecties zonder foto tonen een generiek icoon op een kleurverloop (vis op blauw): dat oogt als een sjabloon, niet als premium |
| **Recept** | 4 | 4 | 4 | Grote foto, duidelijke hoofdknop "Start koken", porties ± | Drie even grote knoppen onder elkaar (koken, inplannen, lijst) concurreren; de omschrijving in een serif-cursief wijkt af van de rest |
| **Voorraad** | 3 | 3 | 3 | Snel toevoegen met chips; "wat kan ik koken" | Het invoerveld heeft geen zichtbaar label of placeholder (het voorbeeld staat eronder) |
| **Ontdek** | 2 | 2 | 2 | Zoekveld en filters | In de demo "Geen recepten gevonden": de catalogus komt van buiten en is in tests geblokkeerd. Een gebruiker zonder netwerk of catalogus krijgt een leeg scherm als eerste indruk |
| **Meer / Instellingen** | 4 | 4 | 4 | Profielkaart, duidelijke groepen, eetmomenten | Standaard instellingslijsten (prima, niet onderscheidend). Het tijdveld toont AM/PM in de emulatie |

### Ziet het eruit als een volledig nieuw, premium Foodloapp-product?
**Gedeeltelijk.**

De kern (Vandaag, Week, winkelmodus en recept) voelt als één nieuw product:
- één visuele taal: donkere "inkt"-kaarten, Fraunces-koppen en een honingaccent;
- grote foto's en ruime aanraakdoelen;
- één duidelijke volgende stap.

Op tablet is het nu een eigen ervaring, geen uitgerekte telefoon.

**Over de hele linie nog niet premium:**
1. **Lijst op de telefoon.** Het scherm dat je het vaakst gebruikt, toont eerst bedieningselementen in plaats van je boodschappen. Dit is de **grootste UX-schuld** en hoort voor een release opgelost te zijn.
2. **Lege en generieke toestanden.** Lege collecties (icoon op kleurverloop), Ontdek zonder catalogus en lege dagen in het desktopraster zien eruit als een sjabloon.
3. **Ongelijke breedtes op desktop.** Vandaag en Week gebruiken de volle breedte, Lijst en Recept een smalle middenkolom. Elk scherm heeft een eigen ritme.
4. **Knoppenhiërarchie.** Op Recept en Lijst staan meerdere even zware knoppen naast elkaar.

### Voorgestelde volgende ronde (geen databank nodig)
- **WP7a, Lijst eerst:**
  - de lijst bovenaan;
  - aanvullen als één compacte regel in plaats van een grote kaart;
  - "Ik ga boodschappen doen" als knop in de kop;
  - tabs en tegels naar het menu "…";
  - op desktop lijst en aanvullen naast elkaar.
- **WP7b, lege toestanden:**
  - collecties zonder foto tonen een collage van recepten of een getekende illustratie;
  - Ontdek valt terug op eigen recepten en seizoensideeën zonder netwerk;
  - lege desktopdagen krijgen één vak "Plan iets".
- **WP7c, ritme:** dezelfde maximale breedte en kopstructuur per schermtype. Op Recept wordt "Start koken" de enige vulde knop.
- Daarna de geplande WP7: ingrediënt vervangen en persoonlijke notitie.

## 18. Gefaseerde uitvoering na de module-audit (2026-11-09)
Bron: [MODULE-AUDIT-2026-11](MODULE-AUDIT-2026-11.md) (audit per module, kwaliteitsnorm, referentie-apps met bronnen).

| Fase | Inhoud | DB? | Status |
|---|---|---|---|
| **C1** | Boodschappen B1–B4 | nee | ✅ **gebouwd en getest** (zie hieronder) |
| C2 | B5 "toegevoegd door" (gezinslijst), B6 productcatalogus met tegels, boodschappen.tsx opsplitsen | nee | ⬜ volgende |
| D1 | Ontdek: lege toestand, terugval op eigen recepten en seizoen; collecties zonder foto | nee | ⬜ |
| D2 | Weekmenu: telefoon compacter, voorstellen met de voorraad, lege desktopdagen | nee | ⬜ |
| D3 | Recept: één hoofdknop, eenheden omrekenen, ingrediënt vervangen (eigen tabel) | nee | ⬜ |
| D4 | Voorraad: label, categorieën, dubbels samenvoegen | nee | ⬜ |
| E | Staging → huishouden, voorraadvelden, transacties, collecties, B7/B8; creatorontwerp | **ja** | ⛔ G1/G2/G5/G9 |

### C1: wat er gebouwd is
- **B1, lijst eerst.**
  - De lijst staat direct onder één statusregel ("6 te kopen · 2 in je kar") met **Ik ga winkelen**.
  - Uit de kop weg: de tabs "Mijn lijst / Uit gerechten", drie tegels en de grote aanvulkaart.
  - Ná de lijst staan "Toevoegen uit…" (je weekmenu, eerder gekocht, winkelideeën), een compacte aanvulregel, vaak gekocht en klantenkaarten. Dezelfde ingangen staan ook in het menu "…".
  - Desktop: de lijst links in twee kolommen; rechts toevoegen, aanvullen en "Toevoegen uit…". De pagina heeft nu dezelfde breedte als Vandaag en Week.
  - Telefoon (390): de eerste boodschap staat op ±45 % van de schermhoogte. Voorheen stond ze onder de vouw.
- **B2.** Raak je het lege invoerveld aan, dan verschijnt "vaak gekocht" als tikdoelen. Eén tik zet het product op de lijst. Tijdens het typen blijven de bestaande suggesties werken.
- **B3.** Tik op "voor <gerecht>" onder een product en je ziet "Waarom staat dit op je lijst?":
  - elk gepland gerecht van vandaag tot over 6 dagen, met dag en geschaalde hoeveelheid;
  - het totaal;
  - wat er al in huis is;
  - andere regels op je lijst ("zelf toegevoegd" of "door Foodlo"), met de zin "Wat je zelf toevoegde, past Foodlo nooit aan".

  Dit paneel leest alleen en schrijft niets. Vervangen producten tellen mee.
- **B4.** In "…" → **Volgorde van je winkel** zet je afdelingen hoger of lager met knoppen, zonder slepen. De lijst én de winkelmodus volgen die volgorde. Voorlopig geldt ze **per toestel**: per account of per winkel vraagt een databankveld (G1).
- **Fout gevonden en opgelost.** De groep "Heb je waarschijnlijk al" gebruikte nog een deeltekstvergelijking: voorraad "ui" zette "suiker" in die groep. Dat is nu echte productherkenning (BUG-062).

### C1: tests
| Run | Resultaat | Exitcode |
|---|---|---|
| Unittests (nieuw: `waaromNodig`, winkelvolgorde) | 470/470 | 0 |
| `lijst.spec` op 390, 768 en 1280, eerste poging | 6 geslaagd, 6 mislukt: twee dubbelzinnige locators in de test, geen appfout | **1** |
| `lijst.spec` na de testcorrectie | 12/12 | 0 |
| Schermafdrukken op 390, 768 en 1280 (`schermen-review`) | 3/3; daarna nog twee lay-outcorrecties (statusregel, lege ruimte op desktop) | 0 |
| Lint-ratchet | | 0 |
| Volledige regressie op `96db023` (gestart 21:15) | tsc 0, vitest 470/470, build 0. Playwright: 246 geslaagd, **8 mislukt**, 77 overgeslagen. Daarvan 6 tijdsafhankelijke tests zonder vaste klok (BUG-065), 1 echte UI-fout: een "Klaar!"-flits in de winkelmodus (BUG-064), 1 sporadische rondleidingstest (BUG-063, open) | **1** |
| Winkelmodus-spec na de herstelling, 3 breedtes ×2 | 42/42 | 0 |
| Navigatie op 390, 768 en 1280 na de testaanpassing | geslaagd | 0 |
| **Volledige regressie op `ef7c8e5`** (gedraaid na 21 u, dus de klokfix is echt getest) | tsc 0 · vitest 470/470 · build 0 · Playwright **257 geslaagd, 0 mislukt**, 77 bewust overgeslagen | **0** |

### C1: wat nog ontbreekt in de boodschappenmodule (eerlijk)
- Productcatalogus met tegels (B6), "toegevoegd door" (B5), sjablonen (B7, ⛔), merk/variant/foto/prijs/winkels (B8, ⛔).
- Winkelvolgorde per winkel en per account (⛔ G1).
- Realtime samenwerken is **niet getest**: niet nagebootst in de nep-Supabase.
- Niet getest op een echt toestel of met een schermlezer.
- BUG-063 (rondleidingstest, sporadisch op 390 px) is **niet** sluitend verklaard; de test wacht nu tot het kader stilstaat.

## 19. Mobiel-eerst (vanaf 2026-11-10, bindend)
**Mobile-first is de primaire ontwerp- en ontwikkelstrategie** voor alle modules. Telefoon (320–430 px) eerst; tablet en desktop krijgen daarna een eigen indeling. Regels: [DESIGNSYSTEEM](DESIGNSYSTEEM.md). Audit en meetresultaten: [MOBIEL-AUDIT](MOBIEL-AUDIT-2026-11.md).

| Fase | Inhoud | Status |
|---|---|---|
| 1. Mobiele UX-audit | Meetinstrument (17 schermen × 9 breedtes + 130 % tekst, lange inhoud), schermafdrukken, inventaris (MOBIEL-AUDIT §1–§6) | ✅ gebouwd en gedraaid (deels opnieuw te meten, zie onder) |
| 2. Design- en componentsysteem | DESIGNSYSTEEM.md; globaal: afbreken in plaats van overlopen, knoppen die meegroeien, compacte kop, rasters pas vanaf 1280 px | ✅ ronde 1 gebouwd · 🟨 afstandsschaal en beweging nog te doen |
| 3. Hoofdschermen | Vandaag · Week (kleverige weekband) · Lijst · Keuken (collecties met fotocollage) · Ontdek (thema's, ontworpen terugval, plek voor de creator) | ✅ gebouwd, getest en gecontroleerd op schermafdrukken |
| 4. Overige schermen | Recept (één hoofdknop), kookmodus (grote tekst), voorraad (per afdeling), gezin, vrienden, instellingen, klantenkaarten; profiel en beheer (§20) | ✅ gebouwd en getest; beheer: toegankelijk en bruikbaar op de telefoon, maar nog tabellen in plaats van kaarten (🟧) |
| 5. Boodschappen verder | Catalogus met tegels, favorieten en vaak gekocht, "toegevoegd door", meervouden in de afdelingsindeling | ✅ gebouwd en getest. Volgens de kwaliteitsnorm nog niet "klaar": sjablonen, winkels en merk/variant/foto vragen G1 |
| 6. Volledige visuele en functionele controle | Audit op 9 breedtes en 130 %, met vensters en een fouttoestand: **0 overlopen, 0 horizontaal scrollen, 0 weggeknipt**; volledige regressie | ✅ (zie MOBIEL-AUDIT §8) |

**Gemeten effect van ronde 1** (MOBIEL-AUDIT §2): horizontaal scrollen op 320 px van 9 naar 0, en op 320 px bij 130 % tekst van 16 naar 0. Tekst over het kader op 320 px bij 130 % van 54 naar 7. Weggeknipte tekst op 1024 px van 6 naar 0.

Alle 11 varianten zijn gemeten op `47748ec`. Vijf liepen eerst vast door de systeembelasting (load tot 70) en zijn opnieuw gemeten (exitcode 0).

**Volledige regressie op `47748ec`:** tsc 0 · vitest 470/470 · build 0 · Playwright 257 geslaagd, 0 mislukt, 88 overgeslagen (77 bekend + 11 auditvarianten die alleen met `AUDIT=1` draaien) → **exitcode 0**. Onderweg faalde `mobiel-breedtes` op 412 px (BUG-071, door mij ingevoerd), daarna hersteld: 22/22.

**Web tegenover native:** zie DESIGNSYSTEEM §7. Native overgangen, haptiek, widgets, betrouwbare achtergrondsynchronisatie en rijke meldingen vragen een native app. Alles in deze fase is web/PWA.

**Niet getest:** echte iPhone of Android, iOS Safari met toetsenbord en adresbalk, schermlezers, systeemlettergrootte op een toestel (alleen gesimuleerd met 130 % rootgrootte).

**Regressies fasen 3–5 (echte exitcodes):**
- `1caf2f1` (na fase 3): alle vier exitcode 0.
- `f9cc1e5`: Playwright exitcode **1**, 3 mislukt:
  - een toegankelijkheidsfout door mijzelf: het voorleeslabel van "Op mijn lijst" week af van de zichtbare tekst (WCAG 2.5.3), opgelost;
  - 2 catalogustests: de devserver herstartte onder systeembelasting; bij herhaling geslaagd.
- **`54dd7e7` (eindstand): tsc 0 · vitest 477/477 · build 0 · Playwright 268 geslaagd, 0 mislukt, 88 overgeslagen → exitcode 0.**

## 20. Afronding V2 (2026-11-10)
Labels in deze paragraaf:
- **opgelost en getest**: een geautomatiseerde test faalt bij een terugval;
- **opgelost, gedeeltelijk getest**: gemeten met de audit, of slechts een deel zit in een harde test;
- **niet getest**: gebouwd of beschreven, maar niet gecontroleerd.

Alle tests draaien in Chromium-emulatie, niet op een echt toestel.

| Onderdeel | Wat | Status |
|---|---|---|
| Profielschermen (12) | Audit op 320–1280 px en bij 130 %. Privacylink 44 px, knoppen op Installeren stapelen | Opgelost, gedeeltelijk getest: audit, en axe in `mobiel-breedtes` en `a11y-volledig` |
| Beheer (29 schermen) | Toegankelijke namen, contrast, tabellen in een eigen scrollkader, ≥ 44 px op aanraakschermen, geen zijscroll | Opgelost en getest: `a11y-volledig` (axe 0, zijscroll 0 op 320/390). 44 px: gedeeltelijk (audit) |
| Beheer als premium mobiele ervaring | Drie navigatieniveaus en brede tabellen op de telefoon | **Niet opgelost.** Bruikbaar en toegankelijk, maar geen kaartweergave per rij. Dat vraagt ontwerpwerk per scherm |
| Toegankelijkheid hele app | axe op 19 gebruikersschermen, 29 beheerschermen, vensters en onderbladen | Opgelost en getest (automatisch). **Schermlezer: niet getest** (protocol klaar) |
| Samenhang Vandaag–Week–Lijst–Keuken–Ontdek | Reis voorraad → plan → lijst → winkel → koken → voorraad | Getest: `reis-modules` op 390, 412, 768 en 1280 px. Gezin en twee toestellen: niet in deze reis |
| Praktijktest echte toestellen | Plan, testscript, LAN-demo achter `DEMO_LAN=1` | **Niet getest.** Wacht op toestemming voor netwerktoegang |
| Migratie sjablonen, winkels, merken, varianten, foto's | Voorstel met SQL heen/terug, RLS, impact, kosten | **Niet uitgevoerd** (G1/B6 en jouw akkoord) |

**Volledige regressie** (verse clone, `CI=true`, echte exitcodes):

| Commit | install | tsc | vitest | lint-ratchet | build | Playwright |
|---|---|---|---|---|---|---|
| `215f434` | 0 | 0 | 0 (477/477) | 0 | 0 | **1**. Er draaide **geen enkele E2E-test**: het hulpbestand werd als testbestand gezien (BUG-088) |
| `17967f3` | 0 | 0 | 0 (477/477) | **1** | 0 | **1**: 274 geslaagd, 1 mislukt. Een tijdelijk testbestand was per ongeluk mee gecommit |
| **`a30c702`** | **0** | **0** | **0 (477/477)** | **0** | **0** | **0**: 273 geslaagd, 1 flaky, 0 mislukt, 98 overgeslagen |

**Flaky:** `mobiel-breedtes: /instellingen` (390 px), "Execution context was destroyed": een navigatie tijdens de meting. Bij de herhaling geslaagd. Niet verder onderzocht; risico laag (testtechnisch), maar het blijft op de lijst.

**Overgeslagen (98), allemaal bewust:**
- 21 auditvarianten die alleen met `AUDIT=1` draaien (11 `audit-mobiel`, 10 `audit-profiel-beheer`);
- 67 schermafdruk-specs (`schermen*`), die alleen met `SCHERMEN=1` draaien;
- 10 `personas` op een schermbreedte waarvoor ze niet bedoeld zijn ("alleen op telefoon" of "alleen op desktop").

**Na deze regressie** zijn alleen documenten gewijzigd, geen code.

## 21. A-tot-Z productaudit en Business Control Center (2026-11-11)
**Documenten:**
- `PERSONA-TESTVERSLAG-2026-11.md` (zes persona's, scores per persona en per module);
- `CREATOR-GAP-ANALYSE.md`;
- `BUSINESS-CONTROL-CENTER-AUDIT.md` (functiematrix, financiële matrix, rollen, betaalarchitectuur voor België en de EU, fasering);
- bugregister BUG-090 t/m 104;
- module-audit §13;
- designsysteem §5.3.

**Eerlijk:**
- Persona's zijn **gesimuleerd** (Chromium, nep-Supabase met fictieve gegevens).
- Niet testbaar in de lokale demo: RLS, realtime, AI, opslag, e-mail en push, en betalingen (die bestaan niet).
- De LAN-demo is **niet** geactiveerd.

**Belangrijkste conclusies**
1. **De kern werkt en hangt samen:** plannen, lijst, winkelen, koken en voorraad. Visueel verzorgd en toegankelijk volgens axe.
2. **Creators, sociale functies, abonnementen en een financieel controlecentrum bestaan niet.** Het "Finance"-scherm is een kostenscherm.
3. **Het beheer is goed voor een gratis app met één eigenaar.**
   - Vier rechtenlekken zijn lokaal gedicht (BUG-090/091/092/094), plus één fout in financiële totalen (BUG-093).
   - Twee latente beveiligingsproblemen vragen een akkoord: 2FA op de server (BUG-095) en RLS met `is_admin` (BUG-097).
4. **Klaar voor een kleine, begeleide gebruikerstest** van de kern, op staging, na de praktijktest op toestellen. **Niet** voor creators of betalende gebruikers.

**Lokaal uitgevoerde verbeteringen**

| Wat | Status |
|---|---|
| `finance.view`-recht voor schermen, serverfuncties, menu en financiële CSV-soorten | Opgelost en getest (`beheer-rechten.spec.ts` faalt op de oude code; `admin-rechten.test.ts`) |
| Meldingenbeheer via `bewaker()` + auditlog | Opgelost en getest |
| CSV-injectie | Opgelost en getest (`csv-veilig.test.ts`) |
| Finance pagineert voorbij 1 000 rijen | Opgelost, gedeeltelijk getest (unit; andere beheerqueries nog open) |
| "Betalingen actief" vergrendeld zonder betaalprovider | Opgelost en getest |

**Toestemming nodig** (bovenop §15):
- fase 1-migratie (rollen, RLS, `claim_first_admin` intrekken, 2FA op de server, met een noodprocedure);
- keuze van betaalmodel en betaalprovider (B5) met juridisch advies (btw-rol van het platform, DAC7, herroepingsknop);
- elke betaalde dienst;
- push.

**Volledige regressie** (verse clone van `70781e5`, `CI=true`, echte exitcodes):

| install | tsc | vitest | lint-ratchet (t.o.v. `f5bc8dd`) | build | Playwright |
|---|---|---|---|---|---|
| 0 | 0 | 0 (487/487) | 0 | 0 | **0**: 286 geslaagd, 0 flaky, 0 mislukt, 107 overgeslagen |

- **Overgeslagen (107), allemaal bewust:**
  - 30 auditvarianten die alleen met `AUDIT=1` draaien: 11 `audit-mobiel`, 10 `audit-profiel-beheer`, 9 `audit-persona-az`;
  - 67 schermafdruk-specs (`schermen*`);
  - 10 `personas` op een niet-bedoelde breedte.
- **De flaky `/instellingen`-test van §20** kwam deze keer niet terug. Niet onderzocht, dus het risico blijft staan.
- **Eerdere tussenstap:** de eerste commit (`1d9d742`) faalde op de lint-ratchet (exit 1: prettier-opmaak in drie gewijzigde bestanden). Hersteld in `70781e5`, zonder gedragswijziging.
- **Persona-audit apart:** `AUDIT=1 … audit-persona-az.spec.ts --project=mobiel-390` gaf exitcode 0 (9 tests, 70 stappen; bevindingen in het verslag).
- **Niet gedekt:**
  - echte toestellen, schermlezer en WebKit;
  - RLS en realtime (staging);
  - of productie de foutmelding "Je rol heeft dit recht niet." ongewijzigd doorgeeft (de dev-server doet dat wel).

## 22. Security- en AVG-verificatie, fase 1 (2026-11-11)
**Documenten:**
- SECURITY-AUDIT §7;
- AVG-AUDIT §7–§10;
- MIGRATIE-VOORSTEL-ROLLEN-RLS.md (inclusief rollenmatrix);
- 2FA-HERSTELPLAN.md;
- bugregister BUG-025/026/095/097/103/105–112.

**Gedaan zonder databankwijziging of productieverbinding:**
- **Lokale PostgreSQL (PGlite) uit alle 64 migraties.**
  - BUG-105 (recepten) en BUG-106 (foto's) zijn **lokaal bewezen**.
  - Voorstel 0002 dicht ze, en heen + terug geeft een volledig identieke stand.
  - Productie zelf is **niet** gecontroleerd; daarvoor bestaat een alleen-lezen query in SECURITY-AUDIT §6.
- **Tweede verdedigingslaag in de app** voor recepten (9 queries + detailpagina), volledige AVG-export, zelf gehoste lettertypen en afgeronde locatie.
- **Nieuwe tests:**
  - databank: `tests/rls/*`, 11 varianten;
  - E2E: directe API, accountverwijdering, export, zichtbaarheid en privacy;
  - unit: export, eigenaars, locatie.
- **Bewust nog open, en vastgelegd als `test.fail`:** 2FA (BUG-095) en de foto-opruiming (BUG-025).

**Volledige regressie** (verse clone van `d2bbcb0`, `CI=true`):

| install | tsc | vitest | lint-ratchet (t.o.v. `77ca00d`) | build | Playwright | RLS (`tests/rls/alles.mjs`) |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 (496/496) | 0 | 0 | **0**: 306 geslaagd (waarvan 4 bewust "verwacht falend"), 0 flaky, 0 mislukt, 107 overgeslagen | **0**: 11/11 zoals verwacht |

- **Overgeslagen (107), allemaal bewust:** 30 auditvarianten (`AUDIT=1`), 67 schermafdruk-specs (`SCHERMEN=1`), 10 persona's op een niet-bedoelde breedte.
- **Tussenstap:** commit `aa00982` faalde op de lint-ratchet (opmaak in `recepten.$id.tsx`). Hersteld in `ed7b453`, zonder gedragswijziging.

**Toestemming nodig:** zie §15 en het rapport bij deze fase. Kort:
- alleen-lezen controle van productie;
- staging;
- migraties 0002 en 0003;
- het 2FA-herstelplan en daarna de afdwinging;
- beslissingen over BUG-110, BUG-112, de foto-opruiming, wat er wel of niet in de export komt, en de bewaartermijnen.

## 23. Master-missie: veiligheid, AVG, kern-UX, Control Center (2026-11-11)
**Live gecontroleerd door de eigenaar** (alleen-lezen, Lovable Cloud): recepten- en fotorechten in orde, bucket Private, dus BUG-105 en BUG-106 bestaan live niet. Live en repo zijn twee verschillende omgevingen (BUG-011). Zie SECURITY-AUDIT §8.

| Onderdeel | Status |
|---|---|
| Voorstel 0002 gesplitst in `0002a` (basislijn, alleen nieuwe omgevingen) en `0002` (beheer, feedback, `is_admin`, `claim_first_admin`) | Lokaal getest (14/14), niet uitgevoerd |
| BUG-095 2FA op de server | Gebouwd, staat **uit**; goedkeuring van het herstelplan nodig |
| BUG-110 gezin overdragen; BUG-025 foto's veilig wissen | Lokaal getest (unit + E2E, falen op oude code); niet live |
| BUG-098, 099, 100, 101, 102 | Lokaal getest |
| BUG-093 paginering: budgetrem, aggregatie, CSV | Lokaal getest; ±25 dashboardqueries open |
| Collecties, gezinsvoorkeuren en allergieën, creators, budget | Alleen voorgesteld (ARCHITECTUUR-VOORSTELLEN.md) |

**Volledige regressie** (verse clone van `493ee05`, `CI=true`):

| install | tsc | vitest | lint-ratchet (t.o.v. `a277e63`) | build | Playwright | RLS (`tests/rls/alles.mjs`) |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 (515/515) | 0 | 0 | **0**: 318 geslaagd (waarvan 2 bewust "verwacht falend": 2FA), 0 flaky, 0 mislukt, 107 overgeslagen | **0**: 14/14 zoals verwacht |

- **Overgeslagen (107), allemaal bewust:** 30 auditvarianten, 67 schermafdruk-specs, 10 persona's op een niet-bedoelde breedte.
- **Tussenstap:** commit `d745358` faalde op de lint-ratchet (opmaak). Hersteld in `40b1b09`, zonder gedragswijziging.

## 24. Release-readiness-missie (2026-11-11)
Alles lokaal, niet gepusht, niet uitgerold. Overzicht voor de eigenaar: `RELEASE-READINESS-2026-11.md`.

| Onderdeel | Status |
|---|---|
| BUG-113 tweede stap (2FA-code) bij een volgende aanmelding; BUG-114 QR zonder innerHTML, bevestiging bij verwijderen | Lokaal getest; proef met afdwingen aan geslaagd; afdwingen blijft **uit** |
| BUG-093 dashboards, meldingsontvangers, weekvoorstel voorbij 1 000 rijen; nep-PostgREST met `max-rows` 1 000 | Lokaal getest (faalt op oude code) |
| BUG-037 eerlijke fouten op de lijst en in de offline wachtrij; BUG-104 bevestiging na verwijderen; BUG-038 afgerond | Lokaal getest (falen op oude code) |
| BUG-115 200 % tekst; BUG-116 focus terug na sluiten; spec `mobiel-kwaliteit` | Simulatie (Chromium) |
| BUG-117 WebKit op macOS 14 niet te draaien; BUG-118 dubbele verzoeken op Vandaag | Open |

**Volledige regressie** (verse clone van `cab1506`, `CI=true`):

| install | tsc | vitest | lint-ratchet (t.o.v. `be5cc69`) | build | Playwright | RLS |
|---|---|---|---|---|---|---|
| 0 | 0 | 0 (527/527) | 0 | 0 | **0**: 339 geslaagd (waarvan 2 bewust "verwacht falend": 2FA), 0 flaky, 0 mislukt, 107 overgeslagen | **0**: 14/14 |

- **Tussenstap:** de eerste ratchet-run na de functionele commits faalde (exit 1, alleen opmaak). Hersteld in 2 opmaakcommits, alleen op de gewijzigde regels.
