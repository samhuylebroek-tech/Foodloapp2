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
