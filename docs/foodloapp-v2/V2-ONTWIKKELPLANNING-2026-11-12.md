# Foodloapp V2: inventarisatie en ontwikkelplanning

Stand 2026-11-12. Lokaal op `v2/dev`. Niets gepusht, gemigreerd of uitgerold.
- Goedkeuring eigenaar: grotere lokale V2-ontwikkelfase (2026-11-12).
- Grenzen: geen push, deployment, migratie naar een echte databank, betaalde of externe diensten zonder aparte schriftelijke toestemming.

## 0. Gecontroleerde vertrekpositie
| | V2 | Origineel |
|---|---|---|
| Pad | `/Users/samhuylebroek/Documents/GitHub/dinner-dialogue-hub-v2` | `/Users/samhuylebroek/Documents/GitHub/dinner-dialogue-hub` |
| Branch | `v2/dev` | `chore/secure-env-files` |
| Laatste commit | `502b6a7` | `2883de1` (ongewijzigd) |
| Werkboom | schoon, geen stash | alleen het bestaande `D .env` en ` M .gitignore` |
| Ten opzichte van GitHub | 112 lokale commits, niets gepusht | — |

## 1. Stand per onderdeel
Legende: ✅ klaar (lokaal getest), 🟡 gedeeltelijk, ❌ ontbreekt, 🔒 wacht op een beslissing.

| Plek / pijler | ✅ Klaar | 🟡 Gedeeltelijk / te verbeteren | ❌ Ontbreekt | 🔒 Beslissing |
|---|---|---|---|---|
| **Vandaag** (pijler 1) | Nu-kaart, Daarna, voorstellen met redenen, Niet nu, BUG-126 | Restjes (usecase 18) niet als voorstel | "Gebruik eerst" uit de voorraad (usecase 6) | Weer (15/16) |
| **Week** (pijler 2) | Plannen, Laat Foodlo kiezen met harde regels en redenen | Geen aparte "Vul aan met 3" bij een half lege week | Variatie-uitleg in de planner zelf | — |
| **Lijst** | Lijst, winkelmodus, offline, Slim aanvullen, Voor morgen nog nodig | Volgorde per huishouden (BUG-087) | — | 0-migratie BUG-087 |
| **Keuken** (pijler 3, optioneel) | Recepten, kookstand, voorraadkast, Wat kan ik koken? | "Wat kan ik koken?" past de allergieregels **niet** toe | Houdbaarheid (0007), "in huis sinds" | 0007 (17) |
| **Ontdek** (pijler 4) | Bibliotheek, thema's, Verras mij | "Verras mij" en de detailpagina negeren allergieën | Seizoenslijst per product (usecase 16) | Creators (28) |
| **Toegankelijkheid** (pijler 5) | 320 px + 200 %, axe, grote doelen, senioren-thema | Echte toestellen ontbreken | VoiceOver/TalkBack-test | Toestellen (26) |
| **Leren en personaliseren** (pijler 6) | Kennismaking, gewoonte per weekdag, sterren en favorieten, Niet nu op het toestel | Geen centrale aan/uit-knop voor slimme voorstellen | Niet voor mij (account) | 0006 (17), 0005 (7) |

## 2. Veiligheid: gevonden tekortkomingen (prioriteit 1)
Allergieën zijn een harde regel, maar ze worden nog niet overal toegepast.

1. **Recept zonder ingrediënten** wordt nu als veilig behandeld (geen treffer = toegelaten). Dat is in strijd met de regel "ontbrekende informatie = geen garantie".
2. **Veganistisch** sluit vandaag alleen vlees en vis uit, en dus geen kaas, room, boter, eieren of honing.
3. **Keuken, "Wat kan ik koken?"** stelt recepten voor zonder allergiecontrole.
4. **Ontdek, "Verras mij"** stelt een gerecht voor zonder allergiecontrole. De detailpagina toont geen waarschuwing.
5. **Receptdetail** zonder ingrediënten toont geen melding dat Foodlo het niet kan controleren.
6. Allergenen in de **titel** (bv. "Pindasaté") worden niet meegeteld als de ingrediëntregel vaag is.

## 3. Technische afhankelijkheden
- 0006 (feedback), 0007 (houdbaarheid), 0004 en 0005 vragen een migratie, dus eerst staging (beslissing 1).
- Weer vraagt een externe dienst (beslissingen 15 en 16).
- Native push en de app-shell wachten op de mobiele validatie (beslissingen 22 en 23).
- Alles hieronder in fase A en B werkt **zonder migratie en zonder externe dienst**. De gegevens blijven op het toestel of komen uit bestaande kolommen.

## 4. Risico's en privacy
| Risico | Maatregel |
|---|---|
| Allergeen toch voorgesteld | Eén centrale veiligheidsregel, overal gebruikt, met tests per plek (fase A) |
| Ontbrekende ingrediënten | Bij gekozen allergieën nooit automatisch voorstellen; bij openen een melding "kan niet gecontroleerd worden" |
| Gezondheidsgegevens | Blijven op het toestel, geen nieuwe tabel, geen AI |
| Te veel slimheid voelt opdringerig | Eén schakelaar "Slimme voorstellen" (aan/uit); zonder modules werkt de app gewoon |
| Verouderde voorraaddatum | "Al X dagen in huis" is een feit (aanmaakdatum), geen houdbaarheidsclaim |

## 5. Planning (prioriteit, alles lokaal)
| Fase | Onderdeel | Waarom eerst | Tests |
|---|---|---|---|
| **A** | Eén veiligheidsregel voor allergie, dieet en ontbrekende informatie; toepassen in Vandaag, Week, Keuken (Wat kan ik koken?), Ontdek (Verras mij, detail, kaartjes), receptdetail | Veiligheid is absolute prioriteit | Unit per regel, E2E per plek met gluten, noten, melk, veganistisch, zonder allergie |
| **B** | Schakelaar "Slimme voorstellen" in Instellingen (op het toestel); test van een nieuwe gebruiker zonder modules | Modulair en optioneel | Unit + E2E aan/uit, lege gebruiker |
| **C** | "Al lang in huis: gebruik eerst" (usecase 6) op Vandaag en in Keuken, op basis van de bestaande aanmaakdatum | Minder verspilling, geen migratie | Unit + E2E |
| **D** | Seizoenslijst per product (België, statisch), als reden en als thema in Ontdek (usecase 16) | Lekkerder en goedkoper, geen externe dienst | Unit + Content Manager |
| **E** | Week: "Vul aan met voorstellen" bij een half lege week (usecase 7) | Sneller plannen | Unit + E2E + allergie |
| Later | Restjes (18), Niet voor mij (0006), houdbaarheid (0007), huishouden (0005), weer, push | Wacht op staging of beslissingen | — |

Na elk onderdeel komt een lokale commit, nadat typecheck, unittests, lint-ratchet, de relevante E2E-tests en de Content Manager groen zijn.

## 6. Voortgang (lokaal, niet gepusht)
| Fase | Stand | Commit |
|---|---|---|
| A Eén veiligheidsregel | ✅ gebouwd en getest (BUG-127, 128, 129 opgelost) | `cbe5bfb` |
| B Slimme voorstellen aan/uit + gebruiker zonder modules | ✅ gebouwd en getest | `6e0275c` |
| C Gebruik eerst | ✅ gebouwd en getest (zie hieronder) | `62d0282` |
| D Seizoenslijst België (reden + thema "Nu in het seizoen") | ✅ gebouwd en getest | `88c431e` |
| E Week: "Vul aan met voorstellen" | ✅ gebouwd en getest | `821ad45` |
| E2 Restjes (usecase 18): bewaren na het koken, "Eet vanavond restjes" op Vandaag, lijst in Keuken | ✅ gebouwd en getest (op het toestel) | zie log |

### Fase C: hoe "al X dagen in huis" werkt
- **Bron:** de bestaande kolom `pantry_items.updated_at`. Geen migratie.
- **Wanneer de datum verandert:**
  - Foodlo zet ze op "nu" bij bijkopen: "Klaar met winkelen" en de knop "Meer".
  - Opgebruiken ("Minder", koken) laat de datum staan.
  - Ongedaan maken zet de oude datum terug.
- **Drempels per afdeling:**

  | Afdeling | Drempel |
  |---|---|
  | Vlees en vis | 2 dagen |
  | Brood | 3 dagen |
  | Groenten en fruit | 4 dagen |
  | Zuivel | 6 dagen |
  | Lang houdbaar (uien, aardappelen, pompoen, citroen, eieren …) | 14 dagen |

  Na 60 dagen toont Foodlo niets meer (waarschijnlijk vergeten bij te werken).
- **Geen houdbaarheidsclaim:** Foodlo toont alleen "al X dagen in huis". Een echte houdbaarheidsdatum komt pas met 0007.
- **Afhankelijkheid BUG-011:**
  - Volgens de repo heeft `pantry_items` géén `updated_at`-trigger. Of dat live ook zo is, is niet nagekeken.
  - Is er toch een trigger, dan telt ook opgebruiken als nieuwe datum. Foodlo meldt dan minder, nooit een verzonnen oudere datum. Ongedaan maken kan de oude datum dan niet terugzetten.
  - De nepdatabank respecteert nu een meegegeven datum, zoals Postgres zonder trigger.

## 7. Fase F: toegankelijkheid en gebruiksgemak (2026-11-12)
**Wat getest is** (`tests/e2e/dagflow-toegankelijk.spec.ts`, Chromium met axe-core WCAG 2.2 AA):
- **Volledige dagflow als persona:**
  - Vandaag met restjes en "Gebruik eerst";
  - restjes plannen;
  - Week "Vul aan" en een dag plannen;
  - lijst en winkelmodus;
  - koken tot "Blijft er iets over?";
  - Keuken met restjes;
  - Instellingen.
- **Senior:** thema "Extra duidelijk", tekst 200 %, 390 px. De hoofdacties gaan alleen met het toetsenbord (focus + Enter).
- **Avond:** donker thema, 360 px.
- **Bij elke stap:**
  - geen ernstige axe-meldingen;
  - niet opzij scrollen;
  - precies één paginakop (h1);
  - elk tikdoel in de nieuwe kaarten ≥ 44 × 44 px en met een naam;
  - meldingen ("Ongedaan maken") in een voorleesgebied (aria-live), zodat een schermlezer ze voorleest.
- **Contrast:** de contrasttest voor alle 5 thema's kent nu ook tekst op honingknoppen.

**Gevonden en opgelost:**
- BUG-130: contrast op honingknoppen in het donkere thema.
- In fase E: "Vul aan" lag onder "Laat Foodlo kiezen".
- In fase A: BUG-129 (Ontdek op 320 px).

**Grenzen (eerlijk):**
- Dit is geen test met echte VoiceOver of TalkBack, geen echte Dynamic Type en geen Safari-engine. Dat blijft fase 3 op echte toestellen (beslissing 26, protocol in TOEGANKELIJKHEID-PROTOCOL.md).
- De toetsenbordtest dekt de hoofdacties, niet elk element.
