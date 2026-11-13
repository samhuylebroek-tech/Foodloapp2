# Functionele eisen en traceerbaarheid (stap B)

**Bron van waarheid voor:** wat elke module moet kunnen, met acceptatiecriteria.

**Bronnen:**
- de opdrachten van de eigenaar:
  - schermreview (2026-11-12);
  - productmissie;
  - complete productvisie met de aanvulling over receptinvoer;
  - masteropdracht (2026-11-13);
- de bestaande eisen in `MODULE-AUDIT-2026-11.md`, `PROACTIEVE-COOKING-USECASES.md` en `PRODUCTMISSIE-UITVOERING.md`;
- de code.

**Legenda:**

| Teken | Betekenis |
|---|---|
| ✅ | Werkt (bewijs in de matrix) |
| 🟨 | Deels, of onvoldoende getest |
| ❌ | Ontbreekt |
| ⏭ | Gepland voor een latere fase |

"Matrix" = `docs/foodloapp-v2/PRODUCTMATRIX.md`.

## Algemene acceptatiecriteria (gelden voor elke F1-eis)
- **AC-1 Telefoonbeeld (390 × 844).** Gecontroleerd in het echte telefoonbeeld, normaal én bij 150–200 % tekst:
  - geen woord dat middenin breekt;
  - geen afgekapte informatie;
  - geen overlap;
  - de pagina schuift niet zijwaarts.
- **AC-2 Duidelijke acties.** Eén hoofdactie per scherm. Pictogrammen hebben een woord, of anders een `aria-label` in de kop.
- **AC-3 Taal.** Nederlands met Belgische notatie: 24 uur, "€ 4,50", "donderdag 12 november".
- **AC-4 Toestanden.** Elke toestand is uitgewerkt: laden, leeg, fout, offline.
- **AC-5 Allergie en dieet** zijn harde voorwaarden. Onbekend wordt nooit "veilig" of "in huis".
- **AC-6 AI.** AI-resultaten worden nagekeken vóór ze bewaard worden. Er gaan geen gevoelige gegevens naar externe AI.
- **AC-7 Tests.** Er is een geautomatiseerde test die faalt als het weer stukgaat.

## 1. Consument
| ID | Eis (bron) | Stand | Fase | Gat / volgende stap |
|---|---|---|---|---|
| FR-V-01 | Persoonlijke begroeting | ✅ | F1 | — |
| FR-V-02 | Wat kan ik vandaag koken, met reden | ✅ | F1 | — |
| FR-V-03 | Wanneer beginnen, hoeveel tijd | ✅ (tijdregel ronde 1) | F1 | — |
| FR-V-04 | Wat staat later deze week gepland | ✅ ("Daarna", weekstrook) | F1 | — |
| FR-V-05 | Seizoen, feestdagen | ✅ | F1 | — |
| FR-V-06 | Weer waar relevant | ⏭ (logica klaar, geen bron) | F2 | #15/#16 |
| FR-V-07 | Beschikbare tijd en budget | 🟨 tijd (kennismaking); budget ⏭ | F1/F2 | #21 |
| FR-V-08 | Familiecontext | 🟨 gezinsgrootte bewaard, niet gebruikt | F1 (standaard personen), F2 (mee-eters) | ronde 3 |
| FR-V-09 | Voorraad en restjes als ze bekend zijn | ✅ | F1 | — |
| FR-V-10 | Alternatief als je geen zin hebt | 🟨 | F1 | "Iets anders vanavond" op de kaart |
| FR-W-01 | Week, dagen, maaltijdmomenten | ✅ | F1 | — |
| FR-W-02 | Toevoegen, wijzigen, vervangen zonder de rest te storen | ✅ | F1 | — |
| FR-W-03 | Automatische suggesties voor open dagen | ✅ (vul aan, Laat Foodlo kiezen) | F1 | — |
| FR-W-04 | Portiegroottes | ✅ per maaltijd; 🟨 standaard 4 | F1 | gezinsgrootte als standaard |
| FR-W-05 | Boodschappen uit de planning | ✅ | F1 | — |
| FR-W-06 | Gezinsplanning | ✅ basis; ⏭ uitgebreid | F1/F2 | kringloop voor het gezinsplan (F2) |
| FR-W-07 | Plan delen | 🟨 via rechten | F2 | — |
| FR-W-08 | Eén duidelijke hoofdactie | ✅ (ronde 1) | F1 | — |
| FR-O-01 | Ontdekken, categorieën, zoeken, filters | ✅ | F1 | — |
| FR-O-02 | Persoonlijke aanbevelingen in Ontdek | 🟨 | F2 | — |
| FR-O-03 | Seizoensrecepten | ✅ (thema's) | F1 | — |
| FR-O-04 | Populair en nieuw | ❌ | F2 | gebruiksgegevens per recept |
| FR-O-05 | Creatorrecepten | ⏭ | F2 | B |
| FR-O-06 | Geen lege fotovakken, geen misleidende foto's | ✅ ontworpen omslag; echte foto's: beslissing | F1 | beeldbeleid (open) |
| FR-R-01 | Ingrediënten, hoeveelheden, porties, tijd, moeilijkheid, stappen | ✅ | F1 | — |
| FR-R-02 | Voedingsinformatie waar betrouwbaar | 🟨 lokaal benaderd | F1 | label "benadering" behouden |
| FR-R-03 | Bewaren, delen, bewerken, inplannen, op de lijst, koken | ✅ | F1 | — |
| FR-R-04 | Herkomst en creator | 🟨 "Foodlo-keuken" | F2 | — |
| FR-K-01 | Stappen, grote tekst, voortgang, terug en verder, ingrediënten, timers | ✅ | F1 | — |
| FR-K-02 | Start altijd bovenaan | ✅ (BUG-132) | F1 | — |
| FR-B-01 | Automatisch uit de planning, handmatig, wijzigen, verwijderen, categorieën, afvinken, dubbels samengeteld, eigen producten | ✅ | F1 | — |
| FR-B-02 | Rustig, geen onnodige pictogrammen, invoerbalk die niets verbergt, bruikbaar bij grote tekst | 🟨 | F1 | ronde 2 (BUG-137/138) |
| FR-S-01 | Winkelmodus met één hand, producten meteen zichtbaar | ✅ (BUG-133) | F1 | echte toesteltest |
| FR-KE-01 | "Wat kan ik koken?", voorraad met 3 standen, restjes, gebruik eerst | ✅ | F1 | — |
| FR-KE-02 | Houdbaarheid | ⏭ (0007) | F2 | — |
| FR-KE-03 | Restjes op het account | ⏭ | F2 | ontwerp R1–R5 |
| FR-I-01 | Profiel, taal, meldingen, privacy, account | ✅ | F1 | — |
| FR-I-02 | Gegroepeerd: Weergave, Maaltijden, Account en privacy | ❌ | F1 | ronde 2 |
| FR-I-03 | **Persoonlijke allergieën, intoleranties, dieet en uitsluitingen op het account, maximaal beschermd** | ❌ (alleen op het toestel) | **F1** | voorstel 0004b (goedkeuring) + app |
| FR-I-04 | Abonnementen | ⏭ | F3 | — |
| FR-I-05 | Gezinsinstellingen | ✅ (Gezin) | F1 | — |

## 2. Recepten toevoegen en beheren
Detail per methode: matrix A2.

| ID | Eis | Stand | Fase | Gat |
|---|---|---|---|---|
| FR-RI-01 | Alle 14 bestaande invoermethoden behouden | ✅ | F1 | — |
| FR-RI-02 | Elke methode apart getest: starten → invoer → nakijken → bewaren → terugvinden → bewerken → gebruiken | 🟨 alleen methode 1 volledig | F1 | ronde 2: link, tekst, foto, delen naar de app (met een nep-AI) |
| FR-RI-03 | Tonen wat herkend is en wat nog nagekeken moet worden; niets verzinnen | ✅ bij import ("vul zelf nog … aan") | F1 | — |
| FR-RI-04 | Nakijken vóór bewaren, overal | 🟨 | F1 | BUG-144, BUG-145 (ronde 2) |
| FR-RI-05 | Editor: ingrediënten en stappen beheren, herschikken, foto's, concept, validatie | ✅ | F1 | voorbeeldweergave vóór bewaren: ❌ (F1, ronde 3) |
| FR-RI-06 | Stapsgewijze invoer waar dat helpt | 🟨 | F1 | ronde 3 |
| FR-RI-07 | Dupliceren | ❌ (eigen recept) | F1 | ronde 3 |
| FR-RI-08 | Verwijderen met bevestiging en ongedaan maken | 🟨 (twee manieren) | F1 | BUG-146 (ronde 2) |
| FR-RI-09 | Concept, publiceren waar toegestaan | ✅ concept; ⏭ publiceren | F1/F2 | — |
| FR-RI-10 | Collecties | 🟨 automatisch; ⏭ eigen | F2 | — |
| FR-RI-11 | Creator: bibliotheek, publicatiestatus, voorbeeld, statistieken, commerciële labels | ⏭ | F2/F3 | — |
| FR-RI-12 | Document- of PDF-import | ❌ | F2 | — |

## 3. Assistent, gezin, creators, commercieel
| ID | Eis | Stand | Fase | Gat |
|---|---|---|---|---|
| FR-AI-01 | Hulp in Vandaag, Week, Ontdek, Recepten, Keuken, Lijst, Gezin | ✅ behalve Gezin (⏭) | F1/F2 | — |
| FR-AI-02 | Laten zien waarom, negeren, wijzigen of uitzetten | ✅ (schakelaar per toestel) | F1 | schakelaar naar het account (F2) |
| FR-AI-03 | **Nooit allergieën of gezondheid naar externe AI**; expliciete privacylaag | ❌ voor het vrije veld (BUG-142) | **F1** | ronde 2 |
| FR-AI-04 | Uitbreidbaar naar agents en andere modellen | 🟨 één gateway, `metCredits` | F2 | `AI_ARCHITECTURE` §4 |
| FR-AI-05 | Geen gevoelige wijziging door AI zonder controle | 🟨 | F1 | BUG-145 |
| FR-G-01 | Gezinnen, leden, rollen, gedeelde planning en lijst | ✅ | F1 | — |
| FR-G-02 | Allergieën, intoleranties, voorkeuren **per lid**; nooit onveilig door een ander lid | ⏭ | **F2** | 0005 (alleen ontwerp) |
| FR-G-03 | Gevoelige gegevens niet onnodig delen | 🟨 (BUG-119, BUG-112) | F1 | 0004 op staging |
| FR-C-01 … 08 | Creatorprofiel, content, volgen, ontdekken, beheer, statistieken, samenwerking, verdienmodellen | ⏭ | F2/F3 | `COMMERCIAL_ROADMAP` |
| FR-BCC-01 … 10 | Bedrijfsprofielen, producten, dashboards, partners, campagnes, gesponsorde inhoud, rapportage, rollen, integraties, AI | ⏭ (team-BCC ✅) | F3 | `COMMERCIAL_ROADMAP` |
| FR-P-01 | Betalingen alleen met een poort op de server, nooit alleen in de interface | ❌ (BUG-143) | F1 (poort) / F3 (betalen) | ronde 2 |

## 4. Ontbrekend voor F1 (stap C, samenvatting)
1. **Profiel:** persoonlijke allergieën, voorkeuren en uitsluitingen op het account (FR-I-03).
2. **AI-privacylaag** (FR-AI-03, BUG-142).
3. **Nakijkstappen** bij kopiëren en "Vul aan", één manier van verwijderen (BUG-144/145/146).
4. **Testen van receptinvoer:** echte tests per invoermethode (FR-RI-02).
5. **Schermen:**
   - Instellingen opdelen;
   - Lijst rustiger;
   - "Iets anders vanavond";
   - standaard aantal personen;
   - dupliceren;
   - voorbeeldweergave in de editor.
6. **Platform:** iOS-project, offline-scherm, native push, storemateriaal.
7. **Betalingen:** poort op de server (BUG-143).
8. **Externe voorwaarden:** staging, accounts, jurist, echte toesteltest, help-artikels nalezen. Zie `RELEASE_PLAN.md`.
