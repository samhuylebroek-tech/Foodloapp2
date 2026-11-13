# Productroadmap V2: vijf fases (VOORSTEL)

> Samengevat in [`docs/foodlo/DEVELOPMENT_ROADMAP.md`](../foodlo/DEVELOPMENT_ROADMAP.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Stand 2026-11-11. **Voorstel ter goedkeuring. Niets uitgevoerd.**
- Beslissingen met nummer: zie [BESLISSINGEN-EIGENAAR.md](BESLISSINGEN-EIGENAAR.md).
- Kosten en risico's: zie [RISICO-EN-KOSTENANALYSE.md](RISICO-EN-KOSTENANALYSE.md).
- Architectuur: zie [FOODLOAPP-INTELLIGENCE-ARCHITECTUUR.md](FOODLOAPP-INTELLIGENCE-ARCHITECTUUR.md).
- Mobiel: zie [MOBIELE-STRATEGIE-IOS-ANDROID.md](MOBIELE-STRATEGIE-IOS-ANDROID.md).

Gates blijven gelden: G1 migraties, G2 RLS, G3 push of merge, G4 deployment, G5 betalingen, G6 geheimen, G7 verwijderen.

## 0. Vertrekpunt (gecontroleerd)
`v2/dev` op `9cd6e5e`, schoon. Laatste volledige regressie (`73e1e9d`), alles exitcode 0:
- unittests 560/560;
- Playwright 377 geslaagd, 0 mislukt;
- RLS 19/19.

Niets gepusht, uitgerold of gemigreerd; 2FA uit; origineel op `chore/secure-env-files` onaangeroerd.

## 1. Bestaande modules: stand en wat nodig is
| Module | Bestaat (V1/V2) | V2 verbeterd | Ontbreekt | Opnieuw testen | Uitbreiding |
|---|---|---|---|---|---|
| Recepten en beheer | Toevoegen (link, foto, typen, zoeken), detail, porties, kookstand, versies, delen | Kookstand, tikfout-zoeken, allergiewaarschuwing, kop en kaarten | Eigen collecties (tabel), houdbaarheid | Echte toestellen, camera | Collecties, redenen bij voorstellen |
| Weekmenu | Plannen, verplaatsen, Laat Foodlo kiezen (regels + AI-ideeën) | Dag/week, restjes, lijstkoppeling | Voorstellen met redenen, feedback | Realtime gezin | Intelligence I-1 en I-2 |
| Boodschappen | Lijst, afdelingen, winkelmodus, offline wachtrij, klantenkaarten | Slim aanvullen, eerlijke foutmeldingen, ongedaan maken | Volgorde per huishouden (BUG-087) | Twee toestellen tegelijk | "Wat je vergeet" met context |
| Voorraad | Voorraadkast, "Wat kan ik koken?" | Bijgewerkt door winkelen en koken | Houdbaarheid (0007) | Echte toestellen | Tegen verspilling (usecase 6, 25) |
| Profiel en instellingen | Taal, thema, momenten, etenstijden, export, verwijderen | Kennismaking, Help Center-links | Voorkeuren alleen voor jezelf (0004) | Na 0004 | Slimme voorstellen aan/uit |
| Gezin | Uitnodigen, rechten, gezinslijst, gezinsmenu | Overdracht bij verwijderen, privacycontrole | Mee-eters, allergieën per lid (0005), taken | Echte rechten op staging | Huishouden (B3) |
| Dieet en allergieën | Dieet herkennen, weekmenu "vermijd" | 14 allergenen, op het toestel, gewist bij afmelden | Per gezinslid, toestemming | Echte toestellen | 0005 |
| Onboarding en rondleiding | Welkom, rondleiding 7 stappen | Kennismaking, rondleiding 10/7 met hervatten, eerste stappen | Voortgang per account | Echte toestellen, VoiceOver | "Waarom zie ik dit?" bij personalisatie |
| Help Center, tutorials, Content Manager | Infopagina | 22 artikels (concept), assistent, tutorials, controle in elke testrun | Nalezing, tabel 0005, knop "Goedkeuren" | Na nalezing | Uitleg bij elk soort voorstel |
| Control Center en beheer | 43 beheerschermen, bewaker, auditlog, rollen | 2FA (uit), eigenaarsbescherming, Hulpinhoud | Teamleden (BUG-096), databankregels (0002) | 2FA op staging | Business-bronnen (§3 risicoanalyse) |

## 2. Vijf fases
### Fase 1: productbeslissingen, architectuur, privacy en staging
| Werkstroom | Afhankelijk van | Wie | Risico | Goedkeuring | Test |
|---|---|---|---|---|---|
| 1a Productvisie en roadmap | — | Eigenaar | Te breed | Beslissing 13 | — |
| 1b Help Center-artikels nalezen | — | Eigenaar of nalezer | Tijd | Beslissing 8 | Content-controle (bestaat) |
| 1c Privacy: 0003/0003b (aangepaste termijnen), 0004, ontwerp 0005, 0006, 0007 | — | Claude (SQL + PGlite-tests), eigenaar (akkoord) | Gegevensverlies | Beslissingen 5–7, 12, 17 | PGlite heen en terug |
| 1d 2FA | Staging | Eigenaar + Claude | Buitensluiten | Beslissing 2 | 2FA-stappenplan |
| 1e Beheerregels (0002, BUG-097) | Staging, live alleen-lezen | Eigenaar (alleen lezen) + Claude | RLS-fout | Beslissing 3 | RLS 19/19 tegen staging |
| 1f Staging inrichten | Lovable-plan | Eigenaar | Kosten | Beslissing 1 | STAGING-PLAN stap 1–9 |
| 1g Intelligence-architectuur verfijnen | 1a | Claude | Te complex | Beslissingen 14–21 | — |
| 1h Externe diensten en kosten (weer, accounts) | 1a | Eigenaar | Licentie | Beslissingen 15, 24, 25 | — |
| 1i Mobiel: app-shell-onderzoek | Staging | Claude | Technisch onzeker | Beslissing 22 | Bouw + rooktest |
| 1j Creators en BCC (alleen ontwerp) | — | Claude | — | Beslissingen 28–33 | — |
| 1k Proefvideo's | Staging | Eigenaar | — | Beslissing 9 | — |

**Acceptatie:**
- beslissingen genomen;
- staging draait met synthetische gegevens;
- RLS-tests groen tegen staging;
- 2FA geoefend.

### Fase 2: Foodloapp Intelligence (op staging)
1. **I-1:**
   - Context Engine (dag, uur, seizoen, feestdagen);
   - Meal Intelligence op eigen recepten en voorraad, met redenen;
   - "Vul aan met 3 voorstellen" in Week;
   - voorstel op de Nu-kaart.
2. **I-2:** Feedback Engine (0006), Cooking History-samenvattingen en variatie.
3. **I-3:** weer (proxy, gemeente), houdbaarheid (0007) en restjes.
4. **I-4:**
   - huishouden (0005), mee-eters en budgetvoorkeur;
   - opt-in push (native, als fase 1i klaar is).
5. **I-5:** optionele AI-ideeën binnen budget (zonder gezondheidsgegevens).

**Acceptatie:**
- elk voorstel heeft 1–2 redenen;
- een allergeen wordt nooit aanbevolen zonder rode waarschuwing;
- "Niet voor mij" werkt;
- geen automatische acties;
- unittests per factor;
- E2E op 320–430 px en 200 % tekst;
- regressie groen.

### Fase 3: mobiele validatie en gebruikerstest
- **Builds:** TestFlight en een gesloten test in Play, met native push en offline-stand.
- **Toesteltests:**
  - PRAKTIJKTEST-TOESTELLEN (uitgebreid);
  - VoiceOver en TalkBack, Dynamic Type;
  - weer en voorstellen, allergiewaarschuwing;
  - netwerk weg in de winkel, twee toestellen op één lijst.
- **Begeleide test** met 5–8 mensen (één per persona); bugs in het register.

**Acceptatie:**
- geen kritieke bugs;
- kernflow en onboarding zonder hulp afgerond door ≥ 80 % van de testers;
- regressie groen.

### Fase 4: afwerking en storevoorbereiding
- Laatste bugs.
- Definitieve builds.
- Iconen en screenshots (Playwright-opnames als basis).
- Storeteksten.
- Privacylabels en Data safety.
- Privacyverklaring en voorwaarden (juridisch).
- Beveiligings- en prestatiecontrole.
- 2FA aan in productie.
- Migraties naar productie (na back-up, G1/G2).
- Definitieve regressie.

**Acceptatie:** releasekandidaten iOS en Android + jouw schriftelijke releasegoedkeuring.

### Fase 5: lancering en groei
- Publicatie en monitoring (`app_errors`, Control Center).
- Support.
- Verdere Intelligence.
- Daarna creators (eerst zonder geld, dan B5), BCC-financiën met echte bronnen en een team (BUG-096).

## 3. Wat parallel kan
| Parallel | Waarom veilig | Wat níét samen |
|---|---|---|
| 1b artikels nalezen ‖ 1c privacy-SQL ‖ 1g architectuur | Geen gedeelde bestanden of databank | — |
| 1d 2FA voorbereiden ‖ 1f staging inrichten | 2FA-oefening start pas als staging er is | 2FA aanzetten vóór de oefening |
| 1j creatorontwerp ‖ fase 2 Intelligence | Creators raken andere tabellen | Creatortabellen en betalingen bouwen vóór de lancering |
| iPhone- ‖ Android-tests | Andere toestellen | — |
| Storemateriaal ‖ juridische teksten ‖ laatste bugs | Losse uitvoer | Indienen vóór het juridische akkoord |
| Unittests van Intelligence ‖ app-shell-onderzoek | Andere bestanden | Twee grote wijzigingen in hetzelfde bestand (AppShell, index) tegelijk |

## 4. Werkstromen A–J uit de productronde: waar ze nu zitten
| Werkstroom | Stand (PRODUCTRONDE) | In deze roadmap |
|---|---|---|
| A Security en privacy | 2FA uit; 0002/0003/0003b/0004 voorgesteld; BUG-097 niet live nagekeken; gezondheidsgegevens op het toestel | Fase 1c–1e, fase 4 (productie) |
| B Onboarding | Gebouwd en lokaal getest; voortgang op het toestel | Fase 1b, 3 (toestellen), 2 (personalisatie-uitleg) |
| C Help Center, tutorials en AI | Gebouwd; 22 artikels concept; 2 proefvideo's | Fase 1b, 1k, 2 (uitleg bij voorstellen) |
| D Dagelijkse ervaring | Kringloop gedekt door tests | Fase 2 (Intelligence), 3 |
| E Recepten en ontdekken | Collecties voorgesteld | Fase 2 of 5 (na staging) |
| F Gezinnen | Voorraad zichtbaar (beslist); 0005 voorgesteld | Fase 1c, 2 (I-4) |
| G Business Control Center | Eerlijke labels; kasstroom en dergelijke ontbreken | Fase 1j (ontwerp), 5 (financiën) |
| H Creators | Alleen voorgesteld | Fase 1j (ontwerp), 5 |
| I Performance | Vandaag 24 verzoeken; Help Center 0 | Fase 2 (proxy-cache weer), 3 (meten op toestellen) |
| J Tests | Regressie groen | Elke fase: volledige regressie + RLS |

Alle open beslissingen: BESLISSINGEN-EIGENAAR §B–§F. Niets is geschrapt.
