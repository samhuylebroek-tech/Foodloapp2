# Foodloapp V2 — Masterplan

**Centrale bron.** Stand: 2026-11-09, branch `v2/dev` (lokaal, niet gepusht). Eigenaar van beslissingen: Sam.
Detaildocumenten (gelinkt, niet herhaald): [PRODUCT-HERONTWERP](PRODUCT-HERONTWERP.md) · [HUISHOUDEN-ONTWERP](HUISHOUDEN-ONTWERP.md) · [FUNCTIE-INVENTARIS](FUNCTIE-INVENTARIS.md) · [BUG-REGISTER](BUG-REGISTER.md) · [SECURITY-RELEASE](SECURITY-RELEASE.md) · [MOBIEL-REDESIGN-MATRIX](MOBIEL-REDESIGN-MATRIX.md) · [STAGING-VOORSTELLEN](STAGING-VOORSTELLEN.md) · [ZOD4-MIGRATIE](ZOD4-MIGRATIE.md)

Statuslabels in dit document:
- ✅ **bestaand en gecontroleerd**: geautomatiseerd getest.
- 🟨 **bestaand maar onvoldoende**.
- 🟧 **gedeeltelijk**.
- ⬜ **nog te bouwen**.
- ⛔ **geblokkeerd**: door een beslissing of afhankelijkheid, met poort G1–G8.

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
| | Gerecht niet meer gepland → van de lijst | ✅ | Behouden. Automatisch bij verwijderen uit het menu ⬜ |
| | Restjes als voorraaditem | ⛔ G1 | Vereist `pantry_items.bron_recept_id` |
| **Vandaag** | Hoofdgerecht + Start koken, week, favorieten | ✅ | Herontwerpen naar één contextkaart |
| | "N dingen ontbreken" | ✅ | Behouden |
| | "Wat eten we vanavond?" uit voorraad | ✅ (WP2) | Eén tik: gepland + tekort op de lijst + ongedaan maken |
| | Bijna vervallen | ⛔ G1 | Vereist `vervalt_op` |
| **Week** | Plannen, verplaatsen, kopiëren, restjes/uit eten, Laat Foodlo kiezen (AI), desktopraster, mobiel vegen | ✅/🟨 | 2 969 regels → opsplitsen (WP6) |
| | Gezinsmenu naast persoonlijk menu | 🟨 | Samenvoegen in het huishouden (⛔ G1/G2) |
| | Mee-eters, porties per maaltijd | ⛔ G1 | HUISHOUDEN-ONTWERP |
| | Agenda en beschikbare tijd | ⬜ | Fase 3 (koppeling met een kalender = externe verplichting) |
| **Lijst** | Afdelingen, winkelmodus, eerder gekocht, vaste items, delen, realtime | ✅/🟨 | Behouden |
| | Overslaan/vervangen in de winkel | ⬜ | WP5 |
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
- **WP3** Vandaag als één contextkaart: koken over X min → ontbreekt iets → vanavond → week half leeg.
- **WP4** Gerecht verwijderen of vervangen in het menu → lijst automatisch bijsturen (met ongedaan maken).
- **WP5** Winkelmodus: overslaan of vervangen ("geen verse spinazie → diepvries").
- **WP6** Planner opsplitsen (2 969 regels) in onderdelen. Tablet krijgt een tweekolommenweergave.
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

## 10. Acceptatiecriteria (per WP, kort)
| WP | Criterium |
|---|---|
| WP1 | Elke bestaande route blijft bereikbaar. De actieve tab klopt voor alle 30 gebruikersroutes. De onderbalk heeft vijf labels zonder afkapping op 360 px. Axe zonder ernstige meldingen. Persona-taken zijn nog even kort of korter |
| WP2 | Niets gepland voor vanavond → maximaal drie voorstellen, gesorteerd op het minste dat ontbreekt. Eén tik zet het gerecht vandaag op het avondeten en wat ontbreekt op de lijst (geen dubbels). Ongedaan maken herstelt beide |
| Kringloop | K1–K7 ([PRODUCT-HERONTWERP §7](PRODUCT-HERONTWERP.md)) ✅ |
| Huishouden | H1–H6 ([HUISHOUDEN-ONTWERP §6](HUISHOUDEN-ONTWERP.md)) |

## 11. Teststrategie
| # | Categorie | Nu | Doel |
|---|---|---|---|
| 1 | Unit/component | 418 (Vitest), incl. kringloop | Elke domeinfunctie |
| 2 | Integratie/API | Serverfuncties tegen de nep-Supabase | + RPC's op staging |
| 3 | E2E | 12 specs (Playwright), kringloop van begin tot einde, navigatie, betrouwbaarheid met storingen | Per WP een volledige stroom |
| 4 | Toegankelijkheid | axe op alle schermen (390 px) | + handmatig VoiceOver/TalkBack (**niet gedaan**) |
| 5 | Mobiel/responsief | 6 breedtes, 19 schermen, tablet en desktop | + echte toestellen (**niet gedaan**) |
| 6 | Beveiliging/autorisatie | Unit (SSRF, rechten) | RLS-tests met twee gebruikers op staging |
| 7 | Data-integriteit/migratie | Gelijktijdigheid en ongedaan maken in de kringloop | Telling vóór en na de migratie op staging |
| 8 | Fout/laden/herstel | Storingssimulatie (`/__storing`) | Per nieuw scherm |
| 9 | Performance/belasting | — | k6 of vergelijkbaar op staging |
| 10 | Kosten/AI | Credits en ai_usage | Kosten per actieve gebruiker in beheer |

Alles hierboven draait in **Chromium-emulatie**. Er zijn **geen** tests op een echte iPhone of Android of met een schermlezer uitgevoerd.

## 12. Open bugs (uittreksel, zie register)
| ID | Prioriteit | Onderwerp |
|---|---|---|
| BUG-025 | Medium (privacy) | Foto's blijven staan na account verwijderen |
| BUG-012 | Medium (kosten) | Base64-foto's in de AI-cache |
| BUG-035 | Medium | zod 3 advisory (gemitigeerd) |
| BUG-011 | Medium | Twee migratiemappen; `inspiration_*` ontbreekt in de migraties |
| BUG-037/038/026/016/014/013 | Laag | Zie register |

Er staan geen kritieke of hoge bugs open op `v2/dev`.

## 13. Beslissingen
| ID | Beslissing | Status |
|---|---|---|
| B1 | Vijf plekken in de onderbalk, "Nieuw" in de kop | Genomen en gebouwd (omkeerbaar) |
| B2 | Omkeerbare acties zonder bevestiging, met ongedaan maken | Genomen |
| B3 | Huishouden vervangt gezin en vriendenrechten; vrienden delen per ding | Ontwerp, wacht op G1/G2 |
| B4 | Geen rewrite; bestaande stack blijft | Genomen |
| B5 | Betaalprovider Stripe Connect (voorstel) | **Wacht op jou** |
| B6 | Staging-Supabase-project aanmaken | **Wacht op jou** (G1, kosten) |

## 14. Risico's
| Risico | Impact | Mitigatie |
|---|---|---|
| Geen staging → huishouden en voorraadvelden blijven geblokkeerd | Hoog | B6 zo snel mogelijk |
| Lovable-conflicten bij grote bestanden | Middel | Gerichte wijzigingen, lint-ratchet, geen massale herformattering |
| Meerstapsacties zonder transactie (kringloop client-side) | Middel | Herstelfunctie nu; RPC's na G1 |
| Live V1 draait nog met de bekende TanStack/seroval-kwetsbaarheid | Hoog | Fix klaar, wacht op G3/G4 |
| Geen echte toesteltests | Middel | Testronde op iPhone en Android vóór een release |
| AI-kosten bij groei | Middel | Eerst eigen logica, credits, BUG-012 |

## 15. Wat jouw akkoord nodig heeft
1. **G1/B6:** een staging-Supabase-project (kosten, nieuw project) om het huishouden, de voorraadvelden en RPC's te kunnen bouwen.
2. **G3/G4:** de beveiligingsfix voor live V1 (branch klaar).
3. **B5/G5:** de keuze van betaalprovider (niets activeren).
4. Pushen van `v2/dev` (nu ±30 commits lokaal voor).
