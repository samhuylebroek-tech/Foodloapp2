# Foodloapp: volledige productmatrix

**Stand en bron.** Stand 2026-11-13 (bijgewerkt met beslissing D-2026-11-13-1, optie B). Samengevat in `docs/foodlo/COMPLETE_PRODUCT_INVENTORY.md`. Gecontroleerd in de code van branch `claude/sleepy-euler-eghoc3` (= `v2/dev` + productronde 1) en in alle planningsdocumenten van `docs/foodloapp-v2/`.

**Doel.** Dit document is de blijvende productchecklist: **niets verdwijnt stilzwijgend**. Een module die niet in de eerste lancering zit, blijft hier staan met een fase.

## Statussen en fasen
| Status | Betekenis |
|---|---|
| **Behouden** | Bestaat, werkt, blijft zoals hij is |
| **Verbeteren** | Bestaat, maar de ervaring of de afwerking moet beter |
| **Uitbreiden** | Bestaat, er komt functionaliteit bij |
| **Te ontwikkelen** | Bestaat niet en hoort in fase 1 of 2 |
| **Latere fase** | Hoort in de visie, gepland voor fase 2 of 3 |
| **Geblokkeerd** | Kan niet verder zonder beslissing of goedkeuring (reden erbij) |

| Fase | Inhoud |
|---|---|
| **F1** | Eerste volwaardige consumentenlancering |
| **F2** | Verdieping: gezin, creators, intelligentie |
| **F3** | Commercieel platform |

**Gates (goedkeuring eigenaar):**
- **G1:** migratie op productie;
- **G2:** RLS en rechten;
- **G3:** push of merge naar `main` of een Lovable-branch;
- **G4:** deploy;
- **G5:** betalingen;
- **G6:** geheimen;
- **G7:** iets verwijderen;
- **G8:** gegevenscorrectie.

Beslissingen "#n" verwijzen naar `BESLISSINGEN-EIGENAAR.md`.

---

## A. Consumentenmodules

| Module | Functie | Status | Fase | Wat de gebruiker merkt / wat ontbreekt | Bewijs |
|---|---|---|---|---|---|
| **Vandaag** | Begroeting, datum, wat nu telt (één kaart, 8 stappen) | Behouden | F1 | Werkt, met en zonder voorraad | `vandaag.ts`, `vandaag.spec.ts` |
| | Tijdregel: begin om, duur, aan tafel | Uitgebreid (ronde 1) | F1 | Nu ook als er nog iets ontbreekt; eerlijk als het te laat is | `tijdsplan`, PR #1 |
| | Voorstellen met reden, "Waarom zie ik dit?", "Niet nu" | Behouden | F1 | "Niet nu" staat per toestel | `voorstel.ts`, `niet-nu.ts` |
| | Seizoen en feestdagen (BE/NL) | Behouden | F1 | — | `intelligentie/context.ts` |
| | "Waarom nu" op de receptpagina (zelfde motor als Vandaag) | Gebouwd (ronde 3) | F1 | Alleen eigen recepten, op het toestel, uit als slimme voorstellen uit staan | `waarom-nu.spec.ts` |
| | Weer | Gebouwd (marathon) met testgegevens | F2 | Signaal op Vandaag + zachte bijsturing, aan/uit in Instellingen; `WeerAdapter` + TestWeerAdapter (vaste demodata, gelabeld). Getest met weer-bron.test + weer-signaal.spec. Echte bron: na licentie en serverproxy | #15, #16 |
| | Budget | Gebouwd (marathon), schatting | F2 | Weekbudget (per toestel), kost per recept en per week met vaste richtprijzen (altijd "schatting"), waarschuwing in Week. Getest met budget.test + budget.spec. Echte prijzen: na prijsbron/partner (`PrijsBron`) | #21 |
| | Gezinscontext (mee-eters) | Gebouwd (marathon) bij handmatig inplannen | F2 | Waarschuwing per mee-eter in de receptkiezer; nog niet in de AI-/weekvoorstellen | 0010, #7 |
| | "Niet voor mij" (blijvend) | Te ontwikkelen | F2 | Tabel 0006 | #17 |
| | Alternatief als je geen zin hebt | Gebouwd (ronde 3) | F1 | "Iets anders vanavond?" onder de Vandaag-kaart: voorstellen met reden, vervangt de maaltijd met "Ongedaan maken" | `vandaag.spec.ts` |
| **Week** | Plannen per dag en moment, verplaatsen, dupliceren, vervangen (lijst past mee aan), ongedaan maken | Behouden | F1 | — | `planner.tsx`, `weekmenu-lijst.spec.ts` |
| | Hoofdacties en hiërarchie | Verbeterd (ronde 1) | F1 | Twee planknoppen, één hoofdknop "Slim aanvullen" | PR #1 |
| | "Laat Foodlo kiezen", "Vul aan" voor lege dagen, restjes plannen | Behouden | F1 | — | `week-voorstel.spec.ts`, `week-vul-aan.spec.ts` |
| | Personen per maaltijd | Verbeterd (ronde 3) | F1 | Standaard = gezinsgrootte uit de kennismaking (1/2/4/5), anders 4 | `standaardPersonen` (unit) |
| | Gezinsplanning | Uitbreiden | F2 | Weergave "gezin" bestaat; de lijst past zich alleen aan bij je eigen plan | `kringloop-db.ts` |
| | Plan delen | Uitbreiden | F2 | Alleen via de rechten van vrienden of gezin | — |
| **Ontdek** | Catalogus, filters, thema's, "Verras mij", allergielabels | Behouden | F1 | — | `inspiratie.index.tsx` |
| | Beeld bij recepten zonder foto | Verbeterd (ronde 1) | F1 | Ontworpen omslag in plaats van een grijs bord | PR #1 |
| | Echte foto's van startrecepten | Geblokkeerd | F1 | Beslissing beeldbeleid (§J) | — |
| | Persoonlijke aanbevelingen in Ontdek | Uitbreiden | F2 | Nu vooral in Vandaag en Week | — |
| | Populair / nieuw | Te ontwikkelen | F2 | Vraagt gebruiksgegevens per recept | — |
| | Creatorrecepten | Gebouwd (marathon), getest met makers.spec + community.spec (telefoon/desktop) en tests/rls/makers-community.mjs; actief in productie na migratie 0008 | F2 | Rij "Makers om te volgen" op Ontdek, `/makers` | #28 |
| **Recepten** | Zoeken (verdraagt tikfouten), filters, automatische collecties, concepten | Behouden | F1 | — | `gerechten.tsx` |
| | Eigen collecties | Gebouwd (marathon), getest met makers.spec + community.spec (telefoon/desktop) en tests/rls/makers-community.mjs; actief in productie na migratie 0008 | F2 | "Bewaar in…", rij "Mijn verzamelingen", `/verzamelingen/$id` | G1/G2 |
| | Notities bij een recept | Te ontwikkelen | F2 | Bestaat niet | MODULE-AUDIT §2 |
| **Receptdetail** | Ingrediënten, porties, tijd, moeilijkheid, stappen met ingrediënten, voedingswaarden (lokaal), versies, foto's | Behouden | F1 | — | `recepten.$id.tsx` |
| | Acties met woorden (Favoriet, Delen, Aanpassen, Meer) | Verbeterd (ronde 1) | F1 | — | PR #1 |
| | Inplannen, op de lijst, kookstand | Behouden | F1 | — | — |
| | Herkomst / creator | Gebouwd (marathon), getest met makers.spec + community.spec (telefoon/desktop) en tests/rls/makers-community.mjs; actief in productie na migratie 0008 | F2 | "Van <maker>" op openbare makerrecepten (Ontdek-catalogus blijft "Foodlo-keuken") | — |
| **Kookstand** | Stappen, voortgang, timers, hervatten, scherm aan, score, restje, voorraad aftrekken | Behouden | F1 | — | `kookstand.spec.ts` |
| | Altijd bovenaan beginnen | Opgelost (ronde 1) | F1 | — | BUG-132 |
| | Spraak, handsfree | Latere fase | F2 | — | MODULE-AUDIT P2 |
| **Boodschappen** | Lijsten, afdelingen, samentellen, eigen producten, eerder gekocht, winkelideeën, delen met link, offline wachtrij, Slim aanvullen, "Waarom op mijn lijst?" | Behouden | F1 | — | `lijst.spec.ts` |
| | Rust en eenvoud | Verbeteren | F1 | Ronde 1 en 2: "Alles" in plaats van het dubbele vinkje, geen leeg vlak (BUG-138), korte voorbeeldtekst (BUG-137). Open: blokken "Toevoegen uit…" en "Klantenkaarten" samenvoegen | — |
| | Winkelvolgorde per huishouden | Geblokkeerd | F2 | Nu per toestel | BUG-087, G1 |
| **Winkelmodus** | Eén hand, grote rijen, "Niet gevonden", vervangen, "Voor morgen nog nodig", klaar → voorraad | Behouden | F1 | — | `winkelmodus.spec.ts` |
| | Product altijd eerst in beeld | Opgelost (ronde 1) | F1 | — | BUG-133 |
| **Keuken** | "Wat kan ik koken?", ontbrekende op de lijst | Behouden | F1 | — | `voorraad.spec.ts` |
| | Voorraad met drie standen (geen, alleen lijst, volledig) | Behouden | F1 | Onbekende voorraad telt nooit als in huis | `voorraad-modus.ts`, `voorraad-optioneel.spec.ts` |
| | Gebruik eerst, "X dagen in huis" | Behouden | F1 | Datumgrens rond middernacht (BUG-140) | `gebruik-eerst.ts` |
| | Restjes | Uitbreiden | F2 | Nu alleen op het toestel; naar het account (ontwerp R1–R5) | LANCERINGSPLAN B2 |
| | Houdbaarheid, plekken, weggegooid | Geblokkeerd | F2 | Voorstel 0007 | #17, G1 |
| | Dubbels in de voorraad samenvoegen ("ui"/"uien") | Te ontwikkelen | F2 | — | MODULE-AUDIT P2 |
| **Klantenkaarten** | Scannen, tonen, delen met het gezin | Behouden | F1 | Camera alleen op een echt toestel te testen | `kaarten.*` |
| **Vrienden en delen** | Uitnodigen, rechten per onderdeel, gedeelde recepten bekijken | Behouden | F1 | Twee rechtensystemen naast elkaar | #30 |
| **Meldingen** | Web push: menu, koken, boodschappen, weekmenu | Behouden | F1 | — | `meldingen.tsx` |
| | Native push (APNs/FCM), voorstel in de melding | Te ontwikkelen | F1/F2 | Helpt bij Apple 4.2 | #18, #23 |
| **Hulp en onboarding** | Help Center, tutorials, rondleiding, kennismaking, eerste stappen | Behouden | F1 | Artikels nog niet nagelezen: productie toont ze niet | #8 |
| **Credits** | Saldo, bewegingen, extra vragen | Behouden | F1 | Kopen staat uit | G5 |
| **Instellingen** | Profiel, kleuren, taal, etenstijden, momenten, voorraad, slimme voorstellen, export, verwijderen | Behouden | F1 | — | `instellingen.tsx` |
| | 24-uurstijden, Nederlandse namen | Opgelost (ronde 1) | F1 | — | BUG-135 |
| | Opdelen in onderdelen | Verbeterd (ronde 2) | F1 | Drie delen (Weergave, Maaltijden, Account en privacy) met een sprongmenu; echte subpagina's zijn een optie voor later | — |
| | Persoonlijke allergieën, intoleranties, dieet en uitsluitingen op het account | Gebouwd (marathon), getest met gezin-leden.spec (telefoon/desktop) en tests/rls/huishouden-voeding.mjs; actief in productie na migratie 0009 | **F1** | `/mijn-voeding` met toestemmingsvraag en datum; zonder toestemming of zonder 0009 op het toestel. Nog open: AVG-export neemt de tabel nog niet mee | voorstel 0009 (vroeger 0004b), FR-I-03 |

## A2. Recepten toevoegen en beheren (verplicht volledig)

**Geen enkele bestaande invoermethode mag verdwijnen.** Getest betekent hier: start → invoer → nakijken → bewaren → terugvinden → aanpassen → gebruiken.

| # | Invoermethode | Ingang (label) | AI/credits | Nakijken vóór bewaren | Status | Testdekking | Fase |
|---|---|---|---|---|---|---|---|
| 1 | Zelf typen (formulier) | Recept toevoegen → "Zelf typen" | nee | ja, "Klopt alles?" | Behouden | volledig (`kernflow.spec.ts`) | F1 |
| 2 | Link van een website | "Link plakken" → "Inlezen" | eerst gratis (JSON-LD), dan AI | ja | Behouden; **test uitbreiden** | alleen de UI | F1 |
| 3 | Sociale media (Instagram, TikTok, YouTube, Facebook, Pinterest) | zelfde knop | AI | ja | Behouden; **test uitbreiden** | geen | F1 |
| 4 | Tekst plakken | "Recept eruit halen" | AI | ja | Behouden; **test uitbreiden** | geen | F1 |
| 5 | Foto of screenshot van een recept | "Recept fotograferen" / "Kies een foto" | AI | ja | Behouden; handschrift testen | alleen de UI | F1 |
| 6 | Foto van een gerecht (recept raden) | "Gerecht herkennen" | AI | ja, met "een gok" | Behouden | alleen de UI | F1 |
| 7 | Ingrediënten herkennen op een foto | "Herken op foto" (in het formulier) | AI | alleen in het tekstveld | Verbeteren: eigen nakijkstap | geen | F1 |
| 8 | Zoeken op naam (app, web, AI-ideeën, laten uitschrijven) | "Zoeken" | zoeken gratis, ideeën AI | ja, "Gevonden recept" | Behouden | alleen de UI | F1 |
| 9 | Delen naar de app (PWA share target) | systeem "Delen" → Foodlo | zoals 2/4 | ja | Behouden; testen | geen | F1 |
| 10 | Uit Ontdek | "Toevoegen aan mijn recepten" | nee | ja | Behouden | geen eigen test | F1 |
| 11 | Recept van een vriend of gezinslid kopiëren | Meer → "Zet in mijn gerechten" | nee | ja: overzicht vóór kopiëren, foto's gaan mee (ronde 2) | Verbeterd (BUG-144) | `recept-beheer.spec.ts` | F1 |
| 12 | Vanuit het weekmenu (zoeken, voorstellen, recept van een naam) | ReceptKiezer | AI behalve zoeken | ja, "Controleer het recept" | Behouden | regels getest | F1 |
| 13 | "Laat Foodlo kiezen" → recepten | Week | AI | voorstel | Behouden | `week-voorstel.spec.ts` | F1 |
| 14 | Nieuw recept koppelen aan een maaltijd | "Klaar en koppelen" | nee | ja | Behouden | ? | F1 |
| — | Hulpmiddelen in het formulier: AI-foto, stappen verbeteren, foto van de bron ophalen | in het formulier | AI | ja (voorstel) | Behouden | — | F1 |
| — | "Vul dit gerecht aan" op de receptpagina | receptpagina | AI | ja: voorstel met "Overnemen" of "Niet doen" (ronde 2) | Verbeterd (BUG-145) | typecheck, regressie (geen AI in de testomgeving) | F1 |
| — | Document of PDF importeren | — | — | — | Te ontwikkelen | — | F2 |
| — | Export van een andere app (bv. Paprika) | — | — | — | Latere fase | — | F2 |
| — | Creator-editor: concept, publiceren, voorbeeld | — | — | — | Latere fase (zie B) | — | F2 |

| Beheer | Status | Opmerking |
|---|---|---|
| Aanpassen (zelfde formulier), versies (10, terugzetten), foto's, concepten (automatisch bewaren) | Behouden | — |
| Verwijderen | Verbeterd (BUG-146, ronde 2) | Overal: bevestigen, zacht verwijderen, "Ongedaan maken"; op de pagina van een verwijderd recept staat "Terugzetten" |
| Eigen recept dupliceren | Gebouwd (ronde 3) | Meer → "Dupliceren": kopie met "(kopie)", ingrediënten en foto's mee (`recept-beheer.spec.ts`) |
| Publiek, privé, alleen volgers | Latere fase | Er is geen zichtbaarheidsveld (G1/G2) |
| Eigen collecties | Gebouwd (marathon); actief na migratie 0008 | G1/G2 |
| Delen (link) | Behouden | — |
| Recepteditor in stappen | Verbeteren | Bij een nieuw recept gaat de keuze van invoer voor; het formulier toont daarna alles tegelijk. Ronde 3: voorbeeldweergave vóór bewaren ("Klopt alles?" › Voorbeeld, `receptinvoer.spec.ts`) |

## B. Creators en food influencers
**Kern (bouwmarathon 2026-11-14):** C1–C8 gebouwd als eerste versie achter `useModuleBeschikbaar`; in productie "binnenkort" tot migratievoorstel 0008 is uitgevoerd. Test: `makers.spec.ts`, `community.spec.ts`, `tests/rls/makers-community.mjs` (39 scenario's).

| Onderdeel | Status | Fase | Voorwaarde |
|---|---|---|---|
| Creatorprofiel (`/makers/$handle`, bio, omslag, specialisaties, badge) | Gebouwd (marathon), getest met makers.spec + community.spec (telefoon/desktop) en tests/rls/makers-community.mjs; actief in productie na migratie 0008 | F2 | Omslag/profielfoto uploaden: nog niet (initialen) |
| Publiceren en zichtbaarheid (privé, vrienden en gezin, openbaar), concept/gepubliceerd, video-link | Gebouwd (marathon), getest met makers.spec + community.spec (telefoon/desktop) en tests/rls/makers-community.mjs; actief in productie na migratie 0008 | F2 | Volgers/abonnees, plannen en voorbeeldweergave: later |
| Volgen, ontdekken van creators | Gebouwd (marathon), getest met makers.spec + community.spec (telefoon/desktop) en tests/rls/makers-community.mjs; actief in productie na migratie 0008 | F2 | Feed "Van makers die je volgt": later |
| Collecties van creators | Gebouwd (marathon), getest met makers.spec + community.spec (telefoon/desktop) en tests/rls/makers-community.mjs; actief in productie na migratie 0008 | F2 | Openbare verzameling toont alleen openbare recepten |
| Bronvermelding → echte maker | Gebouwd (marathon), getest met makers.spec + community.spec (telefoon/desktop) en tests/rls/makers-community.mjs; actief in productie na migratie 0008 | F2 | — |
| Statistieken (volgers, gepubliceerd, bewaard, ingepland; alleen totalen) | Gebouwd (marathon), getest met makers.spec + community.spec (telefoon/desktop) en tests/rls/makers-community.mjs; actief in productie na migratie 0008 | F2 | "Bekeken" en per recept: later |
| Moderatie (meldknop, wachtrij; DSA) | Gebouwd (marathon): /beheer/moderatie (goedkeuren/afwijzen met reden, bijdrage verbergen/terugzetten, melding afsluiten, gelogd), getest met moderatie.spec (telefoon/desktop); actief in productie na migratie 0008 + 0011 | F2 | Verplicht vóór productie |
| Gesponsorde content met duidelijk label | Gebouwd (marathon): één vaste plek in Ontdek, "Gesponsord · In samenwerking met …", allergie/dieetregel, getest met partner-portaal.spec + partners.test; actief in productie na migratie 0011 | F3 | Tellen van vertoningen via gesponsord_tel() nog niet aangesloten |
| Premium collecties, creatorabonnementen, inkomstendeling, uitbetaling/KYC | Voorbereid (marathon): blok "Abonnees" in /maker (uit, testprijs + fee-verdeling, betalen.test); geen uitbetaling | F3 | G5, #29, KYC/uitbetaling via provider, juridisch advies |
| Affiliate, merksamenwerkingen | Latere fase | F3 | Nog geen ontwerp; juridisch advies |

## C. Gezin en huishouden
| Onderdeel | Status | Fase | Opmerking |
|---|---|---|---|
| Gezin maken, uitnodigen (link, QR, zoeken), verlaten, eigenaar overdragen | Behouden | F1 | `gezin.tsx`, RLS-tests |
| Rechten per lid (6 schakelaars) | Verbeteren | F2 | Ontwerp: één huishouden zonder vinkjes (#30) |
| Gedeelde planning en lijst | Uitbreiden | F2 | /gezin toont nu "Samen plannen" met Gezinsweekmenu (`/planner?weergave=gezin`) en Gezinslijst (`/boodschappen?lijst=gezin`), getest met gezin-leden.spec; kringloop en Vandaag nog alleen voor je eigen plan |
| Mee-eters per maaltijd, porties | Gebouwd (marathon), getest met gezin-leden.spec (telefoon/desktop), gezin-veiligheid.test en tests/rls/huishouden-voeding.mjs; actief in productie na migratie 0010 | F2 | "Wie eet mee?" + gasten bij inplannen, personen volgt mee-eters, initialen op de weekkaart; zonder 0010 blijft de personenteller |
| Voorkeuren en **allergieën per gezinslid** (hard, nooit onveilige suggesties) | Gebouwd (marathon), getest met gezin-leden.spec, gezin-veiligheid.test en tests/rls/huishouden-voeding.mjs; actief in productie na migratie 0010 (vraagt akkoord eigenaar, AVG art. 9) | F2 | Lidkaarten (ook kinderen zonder account), toestemming per lid, "Delen met mijn gezin"; planners zien alleen "Niet veilig voor …" (server: `maaltijd_veilig_voor`). Nog niet in de automatische weekvoorstellen |
| Gedeelde voorraad | Latere fase | F2 | BUG-112 (besloten zo te laten), 0007 |

## D. Business Control Center
| Onderdeel | Status | Fase | Opmerking |
|---|---|---|---|
| Overzicht, gebruikers (blokkeren, AVG-export, verwijderen), gezinnen, segmenten, support | Behouden | F1 | Ongeveer 45 schermen, `bewaker()` op 79 functies |
| Activiteit, User Intelligence, functies, recepten, imports | Behouden | F1 | — |
| Finance (credits, kosten, AI-gebruik) | Behouden | F1 | Omzet altijd € 0 (geen betalingen) |
| Communicatie (berichten, push, teksten, hulpinhoud) | Behouden | F1 | — |
| Systeem (status, integraties, labels, klantenkaarten, beveiliging, logboek, instellingen, team) | Behouden | F1 | — |
| 2FA voor beheer | Geblokkeerd | F1 | Gebouwd, staat uit (#2); BUG-141 |
| Rollen bruikbaar maken, rol `finance` | Geblokkeerd | F2 | BUG-096, #31 |
| RLS beheer (`is_admin`) | Geblokkeerd | F1 | BUG-097, 0002, G1/G2 |
| Betaalpoort ook op de server | Opgelost (ronde 2) | F1 | BUG-143: de server weigert betalen of credits kopen zonder provider |
| Partners, merken, producenten, retail, restaurants, campagnes, gesponsorde content, productintegraties, rapportage voor partners | Gebouwd (marathon): aparte omgeving /partner (overzicht, profiel, producten, campagnes, gesponsorde content, samenwerkingen, rapportage met alleen dagtotalen, team met rollen, abonnement) + goedkeuren in /beheer/moderatie, getest met partner-portaal.spec, partners.test en tests/rls/partners-premium.mjs; actief in productie na migratie 0011 | F3 | Aanvragen goedkeuren en teamleden uitnodigen loopt nog via het team |
| Moderatie, AVG-register, incidenten, back-ups | Moderatie gebouwd (marathon, zie B); AVG-register, incidenten, back-ups te ontwikkelen | F2 | BCC-audit §6 |

## E. Betalingen en verdienmodellen
| Onderdeel | Status | Fase | Voorwaarde |
|---|---|---|---|
| AI-credits (saldo, reserveren, terugstorten, cache, limieten) | Behouden | F1 | `credits.server.ts` |
| Creditpakketten kopen | Geblokkeerd | F3 | G5 |
| Gratis ervaring met limiet (100 gerechten) | Behouden | F1 | `limiet.ts` |
| Premium, abonnementen | Gebouwd in testmodus (marathon): /premium, /abonnement (status, opzeggen in 2 tikken, testfacturen), entitlements (heeftRecht), getest met premium.spec + betalen.test en tests/rls/partners-premium.mjs; actief in productie na migratie 0012, echt verkopen pas na G5 | F3 | B5 (#29), G5, juridisch advies |
| Betaalprovider achter een adapter (geen vaste keuze) | Gebouwd (marathon): `src/lib/betalen/` (BetaalProvider, TestBetaalProvider, webhook-verifier, statusmachine idempotent op event-id); serverweg alleen als BETAALPROVIDER_GEKOPPELD=false en modus test | F3 | Stripe Connect of Mollie te evalueren |
| Facturatie, btw/OSS, DAC7, herroeping | Latere fase | F3 | Boekhouder/jurist |
| Zakelijke abonnementen, commerciële samenwerkingen | Latere fase | F3 | — |

## F. Intelligente assistent
| Onderdeel | Status | Fase | Opmerking |
|---|---|---|---|
| Context: dag, uur, seizoen, feestdagen | Behouden | F1 | Getest (26) |
| Geschiedenis, voorraad, restjes, gebruik eerst, seizoensproducten, "niet nu", vul aan, voor morgen | Behouden | F1 | Unit + E2E |
| Uitleg "waarom" en uitschakelbaar ("Slimme voorstellen") | Behouden | F1 | Schakelaar nu per toestel → naar het account (F2) |
| Tijdregel (begin om) | Uitgebreid (ronde 1) | F1 | — |
| Weer | Gebouwd (testgegevens) | F2 | Adapter + testbron; echte bron na proxy en licentie (#15, #16) |
| Budget | Gebouwd (schatting) | F2 | Richtprijzen; echte prijzen na #21 |
| Gezin als signaal | Latere fase | F2 | 0005 |
| Generatieve AI (13 functies, credits, cache) | Behouden | F1 | #14, #19 |
| Harde veiligheidsregels allergie en dieet | Behouden | F1 | `veiligheid.ts`, 20 unit- en 9 E2E-tests |
| Privacylaag voor externe AI (vrij veld "liever niet") | Opgelost (ronde 2) | F1 | **BUG-142**: allergenen, intoleranties, dieet en gezondheid worden eruit gehaald, op het toestel én op de server |

## G. Privacy, account en beveiliging
| Onderdeel | Status | F1 nodig | Voorwaarde |
|---|---|---|---|
| Registreren en aanmelden met e-mail, wachtwoord herstellen | Behouden | ja | Redirect-URL bij release (BUG-022) |
| Sociale login (Google, Apple, Microsoft) | Verbeteren | ja (Apple verplicht) | Geen eigen test; niet getest in de native app |
| Account verwijderen, AVG-export (32 secties) | Behouden | ja | Test op staging (G1) |
| Privacyverklaring, voorwaarden, toestemming | Verbeteren | ja | Jurist (#27) |
| Bewaartermijnen (0003/0003b), privé voorkeuren (0004) | Geblokkeerd | ja | G1, #5, #6, #12 |
| RLS beheer (0002) | Geblokkeerd | ja | G1/G2, #3 |
| Beveiligingsreleases (TanStack/seroval, SSRF) | Geblokkeerd | ja (hoogste prioriteit live) | G3/G4 |
| Geheimen | Behouden | ja | — |

## H. Beheer, ondersteuning en operaties
| Onderdeel | Status | F1 nodig | Opmerking |
|---|---|---|---|
| Help Center (24 artikels, concept) | Geblokkeerd | ja | Nalezen (#8) |
| Feedback, support | Behouden | ja | RLS-zwakte S8 (#3) |
| Meten en foutopvang | Behouden | ja | — |
| E-mail (Lovable of Resend) | Behouden | ja | Verwerkers in de privacyverklaring |
| Web push | Behouden | ja | — |
| Native push | Te ontwikkelen | sterk aanbevolen | #23 |
| Talen (10, machinevertaling) | Behouden | nee (lancering in het Nederlands) | Vertalingen nalezen: F2 |
| Offline (lijst, klantenkaart) | Behouden; offline-scherm gebouwd (ronde 3): web via de service worker, app via `server.errorPath` (actief na een nieuwe app-build) | ja | `offline.spec.ts` |

## I. Mobiele platformen en lancering
| Onderdeel | Status | F1 nodig | Voorwaarde |
|---|---|---|---|
| PWA, installeren | Behouden | ja | — |
| Android-project (Capacitor) | Verbeteren | ja | — |
| iOS-project | Te ontwikkelen | ja | Mac met Xcode |
| App laadt de live website (`server.url`) | Geblokkeerd | ja | #22 (risico bij Apple 4.2) |
| Ontwikkelaarsaccounts | Geblokkeerd | ja | #24/#25 (D-U-N-S tot 30 dagen) |
| Staging | Geblokkeerd | ja | #1, G1 |
| Echte toesteltests (2 iPhones, 2 Android) | Geblokkeerd | ja | #26 |
| Storemateriaal, privacylabels, Data safety | Te ontwikkelen | ja | #27 |
| CI (typecheck, unit, lint, build, E2E, RLS, schermen) | Behouden | ja | Draait vanaf deze PR |
| Cloudontwikkeling reproduceerbaar | Opgelost (ronde 1) | — | BUG-131 |

## L. Aanvullende wensen uit de gesprekken (traceerbaarheid, 2026-11-13)
**Waarom:** controle van alle opdrachten van de eigenaar en van `CLAUDE.md` tegen deze matrix.

**Wat:** deze wensen stonden nog niet als aparte rij in de matrix. Ze zijn hier toegevoegd. Niets is geschrapt.

| Wens | Bron | Status | Fase | Opmerking |
|---|---|---|---|---|
| **Community:** interacties tussen gebruikers, zoals reacties, vragen aan de maker en gekookt-meldingen | Masteropdracht §6; complete productvisie §3 | "Ik heb dit gekookt" + meldknop: Gebouwd (marathon), getest met makers.spec + community.spec (telefoon/desktop) en tests/rls/makers-community.mjs; actief in productie na migratie 0008 | F2 | Foto en vraag aan de maker: later |
| **Creatorcontent:** video's, kooklessen en andere media | Complete productvisie §3; CLAUDE.md | Latere fase | F2/F3 | Opslag- en verwerkingskost apart ramen |
| **AI:** ingrediënten vervangen (substituties met reden) | Masteropdracht §4 | Gebouwd (marathon) | F2 | "Vraag het Foodlo" op recept en kookstand: vaste vervangingstabel getoetst aan allergie/dieet van jou en mee-eters; slimme hulp via voorAI() + credits, in demo TestAssistentAdapter. Getest met assistent.test + assistent.spec. Echte AI: LOVABLE_API_KEY + credit_costs-rij "assistent" |
| **AI:** recepten aanpassen (bv. vegetarisch maken, minder tijd) | Masteropdracht §4 | Gebouwd (marathon), regels | F2 | Personen, vegetarisch, zonder allergeen: voorbeeld met verschillen, "Bewaar als kopie" of "Pas dit recept aan" met ongedaan maken (assistent.spec). "Sneller": later |
| **AI:** vragen beantwoorden (gesprek met de assistent) | Masteropdracht §4; #10 | Gebouwd (marathon), korte vraag | F2 | Vaste antwoorden eerst, slimme hulp optioneel; 20 per dag (toestel) + 30 per dag (server). Gesprek met acties: later |
| **AI:** agents die meerdere stappen voorstellen (bv. "plan en vul mijn week aan") | Masteropdracht §4 | Latere fase | F2/F3 | Altijd met een goedkeuringsstap (AI_ARCHITECTURE §3–4) |
| Lokale producten als signaal | Productmissie §2; complete visie §7 | Gebouwd (marathon) | F2 | Filter "In het seizoen" in Ontdek (België, vaste lijst; seizoen-ontdek.spec); reden in voorstellen bestond al |
| **UX:** vlotte overgangen en micro-interacties | Productmissie §3; complete visie §8 | Verbeteren | F1 | Met respect voor `prefers-reduced-motion` |
| **UX:** lege toestanden en foutmeldingen consequent | Complete visie §8; CLAUDE.md | Behouden / Verbeteren | F1 | `EmptyState` bestaat; per scherm nalopen |
| **Editor:** voorbeeldweergave vóór bewaren, tussentijds bewaren, stappen herschikken | Aanvulling receptinvoer §3 | Verbeterd (ronde 3) | F1 | Voorbeeld gebouwd; tussentijds bewaren bestaat (concept); stappen herschikken: open |
| **Supermarkt:** bestaande integraties behouden, later modulair uitbreiden | CLAUDE.md | Behouden + interface (marathon) | F1 | Gedrag ongewijzigd. Interface `SupermarktProvider` (`src/lib/supermarkt/provider.ts`): LokaleSupermarkt over de bestaande functies + TestSupermarktProvider (testgegevens), getest met provider.test. Schermen omzetten pas met de eerste partner (BUG-087) |
| **Betalingen:** terugbetalingen, annulering, fraude en chargebacks, inkomstendeling creators, platformvergoeding | CLAUDE.md | Latere fase | F3 | In COMMERCIAL_ROADMAP §4; G5 en jurist |
| **Analytics:** creatorconversie, retentie, churn, inkomsten | CLAUDE.md | Latere fase | F3 | Alleen geaggregeerd |
| **Kosten per eenheid:** per actieve gebruiker, creator, AI-actie, opslag, e-mail en databankbewerking | CLAUDE.md | Uitbreiden | F1 (AI) / F2 (rest) | AI-kosten worden al gemeten (`ai_usage`, beheer Kosten) |
| **Vertalingen:** kernvertalingen statisch en professioneel nagelezen | CLAUDE.md | Latere fase | F2 | Nu machinevertaling; lancering in het Nederlands |
| **AI Growth OS** | Masteropdracht §8; aanvulling 2026-11-13 §6 | Apart project | — | **Niet in Foodlo bouwen of vermengen.** In Foodlo staat alleen de grens (`docs/foodlo/INDUSTRY_AND_GROWTH_FUTURE.md`) |

---

## J. Fasering en lanceringsplan (richting: ± 6 weken, geen gegarandeerde datum)

| Week | Productwerk (ik) | Wat jij beslist of regelt | Blokkeert lancering als het uitblijft |
|---|---|---|---|
| 1 | Ronde 2:<br>- Lijst rustiger;<br>- Instellingen opdelen;<br>- één manier van verwijderen;<br>- nakijkstap bij kopiëren en "Vul aan";<br>- testen van receptinvoer (link, tekst, foto, delen) | Beslissingen:<br>- beeldbeleid;<br>- BUG-142 (privacy);<br>- #1 staging;<br>- #24/#25 accounts **starten** | Accounts (doorlooptijd) |
| 2 | Vandaag:<br>- "iets anders vanavond";<br>- gezinsgrootte als standaard voor het aantal personen;<br>- allergieën en voorkeuren naar het account voorbereiden | #22 app-shell, #27 jurist | Staging |
| 3 | iOS-project, iconen, opstartscherm, offline-scherm, native push (opt-in) | #2 2FA, #26 testtoestellen | iOS-project |
| 4 | Op staging: migraties 0002–0004, 0003/0003b, volledige suite | Akkoord G1/G2 op staging | Staging en migraties |
| 5 | Echte toesteltest (script PRAKTIJKTEST), bugfixes, help-artikels | Testers, artikels nalezen | Toesteltest |
| 6 | Storemateriaal, privacylabels, TestFlight en gesloten Play-test | Akkoord G3/G4, indienen | Juridische teksten |

- **F1 (consumentenlancering):** A, A2, de F1-rijen van F, G, H en I.
- **F2:** gezin (C), creators (B, eerst moderatie), weer en budget, houdbaarheid, eigen collecties, documentimport.
- **F3:** Business Control Center voor partners (D), premium en betalingen (E), gesponsorde content, creatorverdienmodellen.

## K. Openstaande beslissingen in deze ronde
1. **Beeldbeleid startrecepten:**
   - de ontworpen omslag (nu actief);
   - zelf foto's maken;
   - beeldrechten kopen;
   - AI-illustraties, herkenbaar als illustratie.
2. **Instellingen opdelen** in Weergave, Maaltijden, en Account en privacy.
3. **BUG-142:** het vrije veld "liever niet" filteren en verbergen voor de AI (voorstel in het bugregister).
4. **BUG-143:** de betaalpoort ook op de server afdwingen (autorisatiewijziging met test).
5. De genummerde beslissingen #1–#33 in `BESLISSINGEN-EIGENAAR.md` blijven gelden. De dringendste zijn:
   - **#1** staging;
   - **#22** app-shell;
   - **#24/#25** ontwikkelaarsaccounts;
   - **#26** testtoestellen;
   - **#27** jurist.
