# Mobiele audit Foodloapp V2 (2026-11-10)

> Samengevat in [`docs/foodlo/MOBILE_ARCHITECTURE.md`](../foodlo/MOBILE_ARCHITECTURE.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

**Opdracht:** de app beoordelen alsof we een premium mobiele food-app moeten afleveren, en daarna meteen herwerken.

**Methode:**
- `tests/e2e/audit-mobiel.spec.ts` (`AUDIT=1`): 17 schermen op 320, 360, 375, 390, 412, 430, 768, 1024 en 1280 px, plus 390 en 320 px met tekst op 130 %.
- Bovenop de demodata een **lange-inhoud-dataset**: recepttitel van 92 tekens, productnaam van 37 tekens zonder spatie, notitie van 90 tekens, lange voorraadnaam.
- Per scherm meet de audit automatisch: horizontaal scrollen, tekst over een kader, weggeknipte tekst, bewust afgekapte tekst, tekst buiten het scherm, knoptekst over meer dan 2 regels en aanraakdoelen. Daarnaast heb ik de schermafdrukken zelf bekeken (`docs/foodloapp-v2/audit/<label>/`, lokaal, niet in git).

**Beperking:** alles draait in Chromium-emulatie. Het is geen test op een echte iPhone of Android-telefoon: iOS Safari heeft eigen gedrag rond veilige zones, het toetsenbord en de adresbalk. De machine was tijdens een deel van de metingen zwaar belast door macOS-systeemprocessen (load tot 43), waardoor enkele auditruns liepen vast. Die heb ik opnieuw gedraaid; niets is als geslaagd geteld dat niet gedraaid is.

---

## 1. Belangrijkste problemen met het mobiele ontwerp
| # | Probleem | Waar | Ernst |
|---|---|---|---|
| M1 | Dubbele kop: bovenbalk plus een grote paginatitel plus een eigen actierij. De taak begint pas halverwege het scherm | Week, Lijst, alle subschermen | Hoog |
| M2 | Op 320 px past de kop niet ("Terug" + "Nieuw" + "Meer" = 348 px), waardoor **9 schermen horizontaal scrollen** | Alle subschermen | Hoog |
| M3 | Vandaag: op de telefoon komt de foto pas ná de knoppen; het eerste beeld is een donker tekstvlak | Vandaag | Middel |
| M4 | Week op de telefoon: titel, planningkeuze, "Opties"-rij, weekkaart, schakelaar en dagstrook staan boven de eerste maaltijd (±60 % van het scherm) | Week | Hoog |
| M5 | Lijst: grote panelen boven de lijst | Lijst | Hoog, **opgelost in C1** |
| M6 | Rasters met 6–7 kolommen op 1024 px (weekraster, collecties, weekstrook) kappen dagnamen en titels af | Week, Keuken, Vandaag | Middel |
| M7 | Ontdek is leeg zonder catalogus; lege collecties tonen een generiek pictogram | Ontdek, Keuken | Middel (fase 3) |
| M8 | Recept: drie even zware knoppen; de bereiding staat ver onder de kop | Recept | Middel (fase 4) |

## 2. Tekst- en lay-outfouten (nulmeting → na ronde 1)
Aantallen over alle 17 schermen. "Afgekapt (ellips)" is vaak bewust en wordt apart beoordeeld.

| Soort | 320 voor | 320 na | 390 voor | 390 na | 768 voor | 768 na | 1024 voor | 1024 na | 320@130 % voor | 320@130 % na |
|---|---|---|---|---|---|---|---|---|---|---|
| Horizontaal scrollen | 9 | **0** | 0 | 0 | 0 | 0 | 0 | 0 | 16 | **0** |
| Tekst loopt over zijn kader | 21 | **2** | 0 | 0 | 2 | **0** | 5 | **0** | 54 | **7** |
| Weggeknipt zonder ellips | 0 | 0 | 0 | 0 | 0 | 0 | 6 | **0** | 0 | 0 |

Concreet gevonden en hersteld in ronde 1:
- **Kop 348 px breed op 320 px**, op alle subschermen. Onder 400 px tonen "Nieuw" en "Meer" alleen hun pictogram, met een volwaardige `aria-label` en een doel van 48 px.
- **Knoppen** met `white-space: nowrap`: de tekst liep eruit ("Wis afgevinkte boodschappen", "Link kopiëren"). Knoppen breken nu naar twee regels en groeien mee (`min-h`).
- **Lange woorden** liepen uit hun kader ("ongezoutenroomboterbereiding", "Afwasmiddelnavulverpakkingextragroot", recepttitels in het weekraster). Nu geldt globaal `overflow-wrap: break-word`, en titels breken af met een koppelteken.
- **Vandaag:** "Daarna" en "Ook vandaag" liepen rechts uit beeld. Het raster miste `minmax(0,1fr)`; die fout had ik in WP6 zelf gemaakt.
- **Slim aanvullen:** de productnaam kreeg op 320 px maar ±105 px en brak per lettergreep af ("rundergehak-t"). Op de telefoon staat de hoeveelheid nu onder de naam.
- **Weekraster op 1024 px:** "donderdag" paste niet en titels werden zonder ellips weggeknipt. Het raster komt nu pas vanaf 1280 px; tot dan geldt week|dag.
- **Collecties** (6 kolommen) en **weekstrook** (7 kolommen) op 1024 px: zoveel kolommen pas vanaf 1280 px.
- **Pictogramknoppen werden platgedrukt** ("Alles in … afvinken" was 23 px breed). Ze krimpen nu nooit.
- **Instellingen op 320 px:** de namen van de eetmomenten werden door het tijdveld tot 60 px platgedrukt. De rij breekt nu om.
- **Aanvulregel onder de lijst:** de tekst werd op 320 px tot 13 px samengeperst. Ze breekt nu om.
- **Titels:** `text-wrap: balance` dwong samen met woordafbreking onnodige afbrekingen af ("Goeiemid-dag"). Dat is nu `text-wrap: pretty`.

Alle "na"-cijfers zijn gemeten op commit `47748ec`, de eindstand van ronde 1. Vijf varianten liepen eerst vast door de systeembelasting (load tot 70) en zijn daarna opnieuw gemeten (5/5, exitcode 0). Daarnaast verdween in alle varianten de valse melding "doel < 24 px" voor de verborgen link "Naar de inhoud": het instrument is verfijnd, de app is daar niet veranderd.

Nog open na ronde 1: zie §6.

## 3. Navigatie en interactie
- **Vijf plekken (Vandaag · Week · Lijst · Keuken · Ontdek):** behouden. Ze dekken de kringloop, zijn op elke breedte zichtbaar met tekst, en de navigatietest bevestigt per route één actieve plek. Overwogen alternatief: "Keuken" opsplitsen in Recepten en Voorraad. Dat maakt zes plekken en kleinere labels, dus niet gedaan.
- **Waar ben ik?** Op de telefoon verdween de paginatitel bij het scrollen. Nu verschijnt hij compact in de bovenbalk zodra de grote titel uit beeld is, zoals een "large title" in native apps.
- **Hoe start ik iets nieuws?** Via "Nieuw" (+) in de kop, op elk scherm.
- **Hoe keer ik terug?** Via "Terug" links in de kop op subschermen, met tekst. Op iOS werkt de terugveeg van Safari zelf; een native overgangsanimatie is pas mogelijk in een native app.
- **Acties per scherm:** in ronde 1 verhuisde "Opties" in Week naar de titelregel, zodat er een rij wegvalt. Op Lijst staat "Ik ga winkelen" in de statusregel (C1).
- **Bediening met één hand:** de onderbalk, de invoer van de lijst (onderaan) en de knoppen in de winkel- en kookmodus zitten binnen duimbereik. "Nieuw" en "Meer" staan bovenaan, en zijn dus moeilijk bereikbaar op grote telefoons (zie §6).

## 4. Componenten die structureel verbeterd zijn of moeten worden
| Component | Status |
|---|---|
| Knop (`ui/button`) | ✅ Breekt om en groeit mee; pictogramknop krimpt nooit |
| Kop (AppShell) | ✅ Compact onder 400 px; titel in de bovenbalk na het scrollen |
| Typografie (paginatitel, sectietitel) | ✅ Vloeiend en met afbreking; `text-wrap: pretty` |
| Rasters met veel kolommen | ✅ Pas vanaf 1280 px |
| Lijstrij (boodschappen, aanvullen) | 🟨 Aanvullen hersteld. De lijstrij gebruikt bewust een ellips voor lange namen; de volledige naam staat in "aanpassen" en in de winkelmodus |
| Onderblad (sheet) | 🟨 Werkt; bij een open toetsenbord in iOS Safari **niet getest** |
| Lege toestanden | ⬜ Ontdek en collecties (fase 3) |
| Kaarten met vaste hoogte | ⬜ Nalopen per scherm (fase 4) |

## 5. Huidige stand tegenover de gewenste premium ervaring
| Aspect | Nu | Premium-doel |
|---|---|---|
| Eerste schermvulling | Lijst ✅; Vandaag 🟨 (foto bovenaan in ronde 1); Week 🟨 | De taak is meteen zichtbaar en tikbaar |
| Kop | Compact met scrolltitel ✅ | Plus een native overgang (pas in een native app) |
| Typografie | Consequent, groeit mee ✅ | Plus een vaste afstandsschaal per component (fase 2) |
| Beweging | Beperkt (overgangen op knoppen en voortgang) | Subtiele overgangen tussen schermen en onderbladen; respecteer `prefers-reduced-motion` |
| Lege en laadtoestanden | Wisselend | Overal skeletten en lege toestanden met een vervolgstap |
| Grote tekst (130 %) | Zie §2 | Geen overlopen, geen horizontaal scrollen |

## 6. Prioriteiten
1. **Gedaan in ronde 1:** M2, M3, M6, de knoppen, de typografie, de lange woorden, Aanvullen, Instellingen en Vandaag (§2).
2. **Volgende (fase 3):**
   - Week op de telefoon: de weekkaart met de dagstrook als één compacte, kleverige band (M4).
   - Ontdek: een lege toestand met eigen recepten en seizoen (M7).
   - Keuken: collecties zonder generiek pictogram.
3. **Fase 4:**
   - Recept: één hoofdknop, ingrediënten en stappen dichter bij de kop (M8).
   - Kookmodus: nalopen op 320 px en bij 130 % tekst.
   - Voorraad: categorieën.
   - Instellingen en Gezin: rijen met lange labels.
4. **Open bevindingen uit de meting, nog te herstellen:**
   - "Van vrienden" (filterchip) en "Bekijk hun gerechten" (Gezin) lopen op 320 px over hun kader.
   - Op 320 px staat "Tonen" (Kaarten) buiten beeld.
   - De keuzekaarten op "Nieuw recept" krijgen op 768 px 3–4 regels in een smalle kolom.
   - Compacte sterren op receptkaarten zijn 24 px breed. Dat voldoet aan WCAG 2.5.8 (min. 24 px), maar niet aan onze streefwaarde van 44 px. Dat is een bewuste uitzondering, omdat de volwaardige beoordeling op de receptpagina staat.
5. **BUG-063** (rondleidingtest): nog niet sluitend verklaard.

## 7. Fase 3 (2026-11-10)
- **Resterende meetpunten** opgelost:
  - "Van vrienden" heet nu "Vrienden" en mag omlopen;
  - "Bekijk hun gerechten" loopt om in plaats van over de rand;
  - de klantenkaart toont "Tonen" weer in beeld;
  - "Nieuw recept" heeft één kolom onder 400 px;
  - de kookmodus toont geen uitgeschakelde "Vorige" meer bij de voorbereiding;
  - de afdeling heet "Al in huis?".
- **BUG-063:** de oorzaak is aangetoond en opgelost (zie het bugregister).
- **Week (telefoon):** weekkeuze en dagenstrook vormen één compacte band die blijft kleven. Dat werkt nu de algemene fout BUG-072 (`overflow-x: hidden`) is opgelost. Ook bij het scrollen door de maaltijden wissel je met één tik van dag.
- **Ontdek:** thema's (seizoen, 30 minuten, vegetarisch, weekend) als fotokaarten. Zonder catalogus toont het scherm een ontworpen terugval (je eigen keuken plus twee acties), geen leeg sjabloon.
- **Collecties:** fotocollage of typografische omslag (CollectieOmslag), niet langer een pictogram op een kleurverloop.
- **Gecontroleerd op schermafdruk:** Week op 320 en 390 px (met en zonder scrollen), Ontdek en Keuken op 390 en 768 px.
- **Nog niet gecontroleerd:** de volledige audit (11 varianten) na fase 3. Die volgt na fase 4, samen met de uitbreiding van het meetinstrument met onderbladen, formulieren en meldingen.

## 8. Fasen 4 en 5 en de eindmeting (2026-11-10)
**Het meetinstrument** is uitgebreid met onderbladen (de catalogus en "Meer"), de winkelmodus, het formulier "Zelf typen" en een fouttoestand (recepten laden mislukt).

**Eindmeting** op commit `f9cc1e5`, met alle schermen en die toestanden:

| Variant | Horizontaal scrollen | Tekst loopt over kader | Weggeknipt zonder ellips |
|---|---|---|---|
| 320, 360, 375, 390, 412, 430, 768, 1024, 1280 px | **0** | **0** | **0** |
| 390 px bij 130 % tekst | **0** | **0** | **0** |
| 320 px bij 130 % tekst | **0** | **0** | **0** |

Ter vergelijking, de nulmeting: op 320 px 9 schermen met horizontaal scrollen en 21 overlopen; op 320 px bij 130 % 16 en 54.

**Wat de meting nog aangeeft, met beoordeling:**
- **Knoptekst over meer dan 2 regels** (1–7 per variant): rijen met een omschrijving of een lange productnaam (Aanvullen, "Toevoegen uit…", Instellingen) en "Op mijn lijst" bij 130 %. Bewust: die tekst loopt om in plaats van te worden afgekapt.
- **Afgekapt met ellips** (12–37 per variant): productnamen in lijstrijen en notities, met de volledige tekst één tik verder (DESIGNSYSTEEM §4). De compacte titel in de bovenbalk valt daar ook onder.
- **Doel < 24 px** (5, alleen op 320 px): de compacte sterren op receptkaarten (24 × 50 px; bij 130 % 23 × 57 px). Bewuste uitzondering: de volwaardige beoordeling staat op de receptpagina.
- **Doel < 44 px** (52–69): vooral kleine links en kleine knoppen in rijen met een groter tikvlak. Dit is onze streefwaarde, geen harde norm (WCAG 2.2 AA vraagt 24 px). Nog op te volgen in een volgende ronde.

**Fase 4, gebouwd:**
- **Receptpagina:** één hoofdknop; de andere twee acties staan rustig naast elkaar.
- **Kookmodus:** geen melding die de titel bedekt; leesbaar op 320 px bij 130 %.
- **Voorraad:** ingedeeld per afdeling, met een zichtbare voorbeeldtekst.
- **Gezin, vrienden, instellingen en klantenkaarten:** rijen lopen netjes om.
- **Onderbalk:** labels krijgen een bovengrens van 15 px, zoals iOS.

**Fase 5, gebouwd:**
- productcatalogus met tegels;
- "toegevoegd door";
- favorieten en vaak gekocht in de catalogus;
- afdelingsindeling die meervouden herkent.

**Schermafdrukken die ik zelf bekeek in deze ronde:**
- Week op 320 en 390 px, met en zonder scrollen;
- Ontdek en Keuken op 390 en 768 px;
- recept op 390 px;
- kookmodus en gezin op 320 px bij 130 %;
- de catalogus op 390 px;
- de winkelmodus op 320 px bij 130 %.

Alle andere bestanden staan in `docs/foodloapp-v2/audit/f5/`; die zijn automatisch gemeten, niet allemaal met het oog nagekeken.

**Niet getest:**
- echte iPhone of Android, iOS Safari met toetsenbord en adresbalk;
- schermlezers;
- de lettergrootte van het besturingssysteem (alleen gesimuleerd met 130 % rootgrootte);
- meertalige teksten, want de vertaalfunctie vraagt een betaalde AI-sleutel die in tests bewust ontbreekt;
- liggende stand op een telefoon.

---

## 9. Afronding: profiel, beheer, toegankelijkheid en samenhang (2026-11-10)
**Meetinstrument.**
- `tests/e2e/audit-profiel-beheer.spec.ts` (`AUDIT=1`): 12 profielschermen en 29 beheerschermen op 320, 390, 768 en 1280 px, plus 390 px bij 130 % tekst.
- Zelfde metingen als §8, plus axe op 390 px.
- Beheer draait als **verzonnen eigenaar** in de nep-Supabase (`/__token?sub=`). Er wordt nooit een echte account of productie gebruikt.

**Voor en na** (som over alle schermen per variant; "doel < 44" gemeten met aanraakscherm):

| Variant | Horizontaal scrollen | Tekst buiten scherm | Doel < 24 px | Doel < 44 px | axe ernstig/kritiek |
|---|---|---|---|---|---|
| Beheer 320 px | 6 → **0** | 18 → **0** | 36 → **0** | 449 → **2** | — |
| Beheer 390 px | 2 → **0** | 6 → **0** | 36 → **0** | 451 → **2** | 50 → **0** |
| Beheer 390 px bij 130 % | 5 → **0** | 12 → **0** | 32 → **0** | 418 → **0** | — |
| Beheer 768 px | 0 → 0 | 0 → 0 | 37 → **0** | 453 → **2** | — |
| Profiel 320 px | 1 → **0** | 1 → **0** | 0 → 0 | 9 → 8 | — |
| Profiel 390 px | 0 → 0 | 0 → 0 | 0 → 0 | 9 → 8 | 0 → 0 |

Bron: `docs/foodloapp-v2/audit/pb/` (voor) en `pb5/` (na, op de code van `17967f3`; lokaal, niet in git). Op alle varianten is tekst over het kader, weggeknipte tekst en knoptekst over meer dan 2 regels **0**.

**Wat er overblijft, met beoordeling:**
- **Profiel, 8 doelen < 44 px.** Allemaal schakelaars: zichtbaar 56 × 32 px, raakvlak 72 × 48 px. In orde, zie DESIGNSYSTEEM §5.2.
- **Beheer, 0 doelen < 24 px.** De sorteerknoppen in de tabelkoppen zijn minstens 44 px breed.
- **Beheer, 2 doelen < 44 px:** de links "Details" (Finance) en "bekijk" (UI-gebeurtenissen), elk in een tabelrij. Ze voldoen aan 2.5.8 (≥ 24 px).
- **Afgekapt met ellips:** de user agent in "Aanmeldingen" en de namen in compacte rijen. Bewust; de volledige tekst staat in de detailweergave.

**Nieuwe harde poorten in de regressie:**
- `a11y-volledig.spec.ts`:
  - beheer zonder horizontaal scrollen op 320 en 390 px;
  - axe 0 op 390 px;
  - axe 0 in de catalogus, het lijstmenu, de winkelmodus, het formulier "Zelf typen", privacy en installeren.
- `reis-modules.spec.ts`, de gebruikersreis door alle vijf de modules op 390, 412, 768 en 1280 px. De stappen:
  1. voorraad aanvullen;
  2. Vandaag stelt een gerecht voor dat kan met wat in huis is;
  3. dat gerecht plannen;
  4. Week toont het;
  5. Lijst bevat **alleen het tekort**;
  6. winkelmodus, dan "Klaar met winkelen";
  7. voorraad;
  8. Vandaag springt naar "koken";
  9. koken, waarna de voorraad verbruikt is;
  10. Keuken en Ontdek.

  Bij elke stap wordt gecontroleerd dat Vandaag de juiste volgende stap toont (`kiezen → winkelen → koken`) en dat geen scherm opzij scrolt.

**Samenhang tussen de modules: bevindingen.**
- Bevestigd door de reis:
  - het plan staat meteen in Vandaag, in Week en in de weekband van Vandaag;
  - de lijst houdt rekening met de voorraad;
  - de Nu-kaart volgt de toestand van lijst en voorraad;
  - koken werkt de voorraad bij.
- **Niet gevonden: inconsistenties.** Er waren geen tegenstrijdige aantallen of toestanden in deze reis.
- **Kanttekening.** De reis gebruikt één gerecht en één persoon. Gezinsrechten, twee toestellen tegelijk en realtime zijn niet in deze reis getest. Dubbel tikken en twee vensters zitten in `kringloop.spec` en `weekmenu-lijst.spec`.
- **Testtechnische vondst** (geen fout in de app): de toegankelijke naam van de navigatielinks is "Week (Weekmenu)", korte tekst plus de lange tekst voor schermlezers. Dat is bedoeld.

**Schermafdrukken die ik zelf bekeek:**
- Beveiliging op 320 px, voor en na. Vóór de fix: kaart 479 px breed, tabel liep uit beeld, subtabbladen braken over 3 regels. Erna: de tabel scrolt in de kaart.
- UI-overzicht op 390 px, voor en na. Daar vond ik zelf nog twee punten, opgelost in `17967f3`:
  - het kruimelpad stond scheef (de link van 44 px had de tekst bovenaan);
  - tabelkoppen kleefden tegen elkaar ("BEHEERDERIP").

Wat ik ook zag en **niet** heb opgelost: beheer heeft op de telefoon drie navigatieniveaus boven elkaar (secties, subtabs, en in User Intelligence nog een derde rij) en brede tabellen. Het is bruikbaar en toegankelijk, maar niet het premium niveau van de gebruikersmodules. De overige schermafdrukken zijn automatisch gemeten, niet allemaal met het oog nagekeken.

**Niet getest:**
- echte toestellen en schermlezers. Er zijn plannen voor: `PRAKTIJKTEST-TOESTELLEN.md` en `TOEGANKELIJKHEID-PROTOCOL.md`. Netwerktoegang voor de demo vraagt jouw toestemming;
- WebKit/Safari-engine;
- beheer met echte gegevensvolumes (de nep-Supabase heeft een handvol rijen).
