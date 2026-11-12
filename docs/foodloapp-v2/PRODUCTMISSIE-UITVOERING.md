# Productmissie V2: uitvoeringsplan

Stand 2026-11-12. Branch `claude/sleepy-euler-eghoc3` (vanaf `v2/dev`), oplevering via een pull request naar `v2/dev`.
Uitgangspunten:
- de opdracht van de eigenaar "Fundamentele product- en lanceringsmissie";
- de visuele schermreview van 2026-11-12 (top 10);
- `DESIGNSYSTEEM.md`;
- `LANCERINGSPLAN-V2.md`.

**Verhouding:** product 40 %, UX en beeld 30 %, stabiliteit 20 %, testen en lancering 10 %. Geen backend- of databankwerk zonder aantoonbare productreden.

## 1. Werkstromen
Ik werk ze één voor één af in kleine, toetsbare stappen. Ze raken telkens andere bestanden, zodat er geen conflicten ontstaan.

| # | Werkstroom | Bestanden (hoofdzakelijk) | Top-10 |
|---|---|---|---|
| W0 | Cloud reproduceerbaar (klaar) | `scripts/cloud-start.sh`, `tests/e2e/opwarmen.ts` | — |
| W1 | Grote tekst en mobiele afwerking | Week, Winkelmodus, Kookstand, Keuken, Instellingen | 1 |
| W2 | Kookstand en Recept | `kookstand`, `recepten.$id` | 5, 10 |
| W3 | Lijst en Winkelmodus | `boodschappen.tsx`, `winkel/*` | 3, 6 |
| W4 | Week als weekassistent | `planner.tsx` | 4 |
| W5 | Vandaag als persoonlijk startpunt | `routes/index.tsx`, `components/vandaag/*` | 8 |
| W6 | Ontdek en receptbeelden | `inspiratie*`, omslagcomponent | 2 |
| W7 | Benamingen, taal en Instellingen | AppShell, `instellingen.tsx` | 7, 9 |
| W8 | Lanceringsvoorbereiding | dit document, `LANCERINGSPLAN-V2.md` | — |

## 2. Volgorde en waarom
1. **W1, W2 en W3:** fouten die een gebruiker vandaag hindert (informatie valt weg, het product is onzichtbaar in de winkel, de kookstand opent halverwege). Klein, veilig en meteen zichtbaar.
2. **W7:** taal en namen. Dit is goedkoop en maakt de navigatie voorspelbaar.
3. **W4 en W5:** de assistent-ervaring. Bestaande gegevens (geplande maaltijden, kooktijden, maaltijdtijden uit Instellingen) en bestaande voorstellen (`src/lib/intelligentie`); geen nieuwe AI.
4. **W6:** beeld. Eerst een ontworpen terugvalomslag per soort gerecht (geen willekeurige foto's), daarna een beeldbeleid voor de startrecepten (beslissing eigenaar).

## 3. Acceptatiecriteria (voor elk scherm)
- Op 390 × 844 in de normale weergave en in Extra duidelijk (150 % tekst):
  - geen woord dat middenin breekt;
  - geen afgekapte informatie, behalve wat `DESIGNSYSTEEM.md` §4 bewust toelaat;
  - geen overlap in de echte telefoonviewport.
- Eén duidelijke hoofdactie per scherm. Pictogrammen zonder woord alleen in de kop en altijd met `aria-label`.
- Taal:
  - Nederlands met Belgische notatie: 24-uursklok, "18:30", "€ 4,50", "donderdag 12 november";
  - geen Engelse resten in de interface.
- Bestaande E2E-tests blijven groen. Voor elk opgelost probleem komt er een gerichte test die op de oude code faalt.
- Allergie-, dieet- en privacyregels blijven ongewijzigd (`src/lib/veiligheid.ts`, `veiligheid.spec.ts`).
- Onbekende voorraad wordt nooit als "in huis" getoond.

## 4. Controle per wijziging
- **Statisch:** typecheck, unit-tests en `lint-ratchet`.
- **Tests:** gerichte Playwright-test en de bestaande specs van het scherm, op `mobiel-390` en `telefoon` (en `desktop` waar het scherm daar bestaat).
- **Visueel:** de galerij (`npm run schermen`) vóór en na, plus opnames van alleen de zichtbare viewport.
- **Mobiele kwaliteit:** `mobiel-kwaliteit` en `a11y-volledig` voor toegankelijkheid en mobiele kwaliteit.

## 5. Lanceringsvoorwaarden
De volledige lijst met eigenaars en afhankelijkheden staat in `LANCERINGSPLAN-V2.md` §2. Hier de indeling die de eigenaar vroeg.

### 5.1 Blokkeert de lancering
- **Staging-omgeving** zonder echte gegevens; schema live en repo vergeleken (A1, A2, BUG-011).
- **V2 online** op een aparte branch, CI groen, en op staging getest (A3, A4).
- **Winkelversie:** keuze voor het app-omhulsel (A5), een iOS-project, iconen en een opstartscherm (A6).
- **Ontwikkelaarsaccounts** Apple en Google (A7; D-U-N-S kan 30 dagen duren).
- **Test op echte telefoons:** 2 iPhones en 2 Android-toestellen, met VoiceOver/TalkBack en grote systeemtekst (A8).
- **Juridisch:** privacyverklaring, voorwaarden en privacylabels juridisch nagelezen (A10).
- **Beveiliging:** 2FA voor het Control Center aan (A9).

### 5.2 Moet voor de lancering opgelost zijn
- De top 10 uit de schermreview: zie §6 voor de stand.
- **Teksten:** definitieve Nederlandse teksten en help-artikels nagelezen (A11).
- **Beelden:** een beeldbeleid voor de startrecepten: echte foto's met rechten, of de ontworpen omslag.
- **Foutafhandeling en traag netwerk:** offline-scherm in het app-omhulsel (B1/§3).
- **Prestaties:** eerste lading op een middenklasse-Android gemeten (nu alleen in emulatie).
- **Accountstromen:** aanmelden, wachtwoord herstellen en account verwijderen op staging met echte e-mail (BUG-022, BUG-025).

### 5.3 Mag na de eerste lancering
- **Huishouden:** voorkeuren en allergieën per lid.
- **Budget:** budgetvoorkeur.
- **Buiten:** weer (B5).
- **Creators en betalingen.**
- **Meer talen.**
- **Tablet:** een eigen indeling voorbij de huidige.

## 6. Stand van de top 10 (ronde 1, 2026-11-12)
| # | Punt | Stand | Wat er veranderde | Bewijs |
|---|---|---|---|---|
| 1 | Woordbreking en afkapping bij grote tekst | Grotendeels opgelost | **Week:** de datum krijgt de volle breedte en de maaltijdkaart stapelt bij grote tekst. **Kookstand:** de kop is gesplitst. **Winkelmodus:** de afdeling staat over de volle breedte. **Keuken:** namen niet meer afgekapt. **Instellingen:** het naamveld slaat om. Open: voorbeeldtekst in invoervelden (BUG-137). | Rondgang voor/na, BUG-134 |
| 2 | Receptbeelden | Opgelost met ontworpen omslag | Zonder foto: kleurverloop van de soort, beginletter in Fraunces en pictogram van de soort. Geldt voor Ontdek, recept, idee-detail en favorieten. De fotoknoppen onder de omslag zijn rustiger. Echte foto's vragen een beslissing van de eigenaar (§7). | `RecipePhoto.test.ts`, rondgang |
| 3 | Winkelmodus: melding duwt product weg | Opgelost | De melding staat ná de producten en is compacter. | `winkel-voor-morgen.spec.ts` (faalde op oude code) |
| 4 | Week: concurrerende acties | Opgelost | Plannen gebeurt met twee rustige knoppen. Er is één gevulde hoofdknop "Slim aanvullen" met uitleg. Zelf dagen kiezen is een tekstlink. | E2E week-*, help-controle |
| 5 | Kookstand opent halverwege | Opgelost | Altijd bovenaan, ook bij elke stap. | `kookstand.spec.ts` (faalde op oude code) |
| 6 | Lijst te druk | Deels | Het dubbele vinkje is vervangen door het woord "Alles". "Wis afgevinkte" is niet meer rood. Open: blokken samenvoegen en het lege vlak (BUG-138). | E2E lijst |
| 7 | Eén naam per plek | Opgelost | De titel is telkens de volledige naam van de menuplek: Lijst toont "Boodschappen" en Week toont "Weekmenu". Keuken toont "Recepten" en "Voorraad", met dezelfde namen als de schakelaar (eerst "Voorraadkast"). "Boodschappenlijst" bleek bij grote tekst over drie regels te breken. | E2E navigatie, onboarding-hulp |
| 8 | Vandaag persoonlijker | Eerste stap | Een tijdregel: "Begin om 15:40 · 2 uur 50 min · aan tafel om 18:30", en eerlijk als het al te laat is. Ook als er nog iets ontbreekt. | `vandaag.test.ts` (5), `vandaag.spec.ts` |
| 9 | Instellingen lang en Engelse resten | Deels | Tijden staan in 24 uur, de themanaam is Nederlands. Open: de pagina opdelen. | `tijdkeuzes.test.ts` |
| 10 | Icoonknoppen zonder woord | Opgelost op Recept en Lijst | Favoriet, Delen, Aanpassen en Meer hebben nu een woord. Op Lijst staat "Alles" in plaats van het dubbele vinkje. De sterren blijven op één rij. | `Sterren.test.tsx`, E2E personas |

## 7. Beslissingen voor de eigenaar
1. **Foto's van de startrecepten:** gebruiken we de ontworpen omslag (gratis, nu klaar), laten we foto's maken, of kopen we beeldrechten? Zelf gegenereerde AI-foto's kunnen technisch al, maar ze kosten credits en moeten als illustratie herkenbaar zijn.
2. **Instellingen opdelen** in onderdelen (Weergave, Maaltijden, Account en privacy): akkoord om dat in ronde 2 te doen?
