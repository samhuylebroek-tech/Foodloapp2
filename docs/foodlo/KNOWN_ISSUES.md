# Bekende problemen, ontbrekende functies en risico's
**Bron van waarheid voor:** de prioriteit van alles wat nog open staat.

**Details per bug:** `docs/foodloapp-v2/BUG-REGISTER.md`. Nummers blijven altijd hetzelfde.

**Prioriteit:**

| Prio | Betekenis |
|---|---|
| P0 | Blokkeert F1 of is een veiligheidsrisico |
| P1 | Moet vóór F1 opgelost zijn |
| P2 | Kan na F1 |

## 1. Open bugs
Bijgewerkt na elke ronde. Stand bij de start van ronde 2.

| Bug | Ernst | Onderwerp | Prio | Plan |
|---|---|---|---|---|
| BUG-142 | Hoog (privacy) | Vrij veld "liever niet" gaat naar de externe AI | P0 | Ronde 2: privacylaag |
| BUG-143 | Medium (beveiliging) | Betaalpoort zit alleen in de interface | P0 | Ronde 2: servercontrole |
| BUG-095 | Hoog (latent) | 2FA voor beheer staat uit | P0 | #2, eerst op staging |
| BUG-097 | Hoog (latent) | RLS-beheer (`is_admin`, feedback) | P1 | 0002 op staging (#3) |
| BUG-061 | Hoog (kosten), ook live | Opgelost op `v2/dev`, live nog niet | P0 (live) | Release (G3/G4) |
| BUG-119 | Medium (privacy) | Weekmenuvoorkeuren leesbaar voor het gezin | P1 | 0004: controle, dan staging |
| BUG-011 | Medium | Schema van live ≠ repo | P1 | Vergelijken (N-2), baseline |
| BUG-144 | Medium | "Zet in mijn gerechten" kopieert zonder nakijken | P1 | Ronde 2 |
| BUG-145 | Medium (AI) | "Vul aan" schrijft zonder nakijken | P1 | Ronde 2 |
| BUG-146 | Medium | Twee manieren van verwijderen | P1 | Ronde 2 |
| BUG-140 | Medium | Dagtelling rond middernacht | P1 | Ronde 2 (test en dagtelling) |
| BUG-141 | Medium (test) | 2FA-test faalt | P1 | Bij het 2FA-werk |
| BUG-139 | Info (test) | Tijdzone van de testmachine | P1 | Ronde 2: `TZ=Europe/Brussels` |
| BUG-137 | Laag | Voorbeeldtekst in invoervelden afgekapt bij grote tekst | P1 | Ronde 2 |
| BUG-138 | Laag | Leeg vlak onderaan de lijst | P1 | Ronde 2 |
| BUG-134 | Medium (a11y) | Grote tekst: harde test ontbreekt voor Week, Keuken en Instellingen | P1 | Ronde 2: test |
| BUG-086 | Medium | Echte toestellen en Safari niet getest | P0 | #26 |
| BUG-117 | Info | Idem (Safari/WebKit) | P0 | #26 |
| BUG-109 | Medium | Bewaartermijnen | P1 | 0003 (#6) |
| BUG-012 | Medium | AI-foto's als base64 in de cache | P2 | Naar Storage (G1/G8) |
| BUG-087 | Laag | Winkelvolgorde per toestel | P2 | F2 (G1) |
| BUG-096 | Medium | Rollen in beheer onbruikbaar | P2 | #31 |
| BUG-035 | Medium | zod 4 | P2 | `ZOD4-MIGRATIE.md` |
| BUG-013 | Laag | Lint-baseline | P2 | Ratchet per bestand |
| BUG-014 | Laag | Dode code `NieuweSuggesties.tsx` | P2 | G7 |
| BUG-016 | Laag (a11y) | Snelle sterren 44 px in plaats van 56 px | P2 | — |
| BUG-080, 089, 108, 114 | Laag–Medium | Opgelost, nog gedeeltelijk getest | P1 | Op staging of een toestel |

## 2. Ontbrekende functionaliteit
**F1:** volgt uit FUNCTIONAL_REQUIREMENTS §4. Ik heb daar de eisen genummerd die er een hebben.

| Wat | Eis | Ronde | Wacht op |
|---|---|---|---|
| Persoonlijke allergieën, voorkeuren en uitsluitingen op het account | FR-I-03 | 3 | N-1 (opzet 0004b) |
| AI-privacylaag | FR-AI-03 | 2 | — |
| Nakijken vóór bewaren overal; één manier van verwijderen | FR-RI-04, FR-RI-08 | 2 | — |
| Echte tests per invoermethode | FR-RI-02 | 2 | — |
| Instellingen opdelen; Lijst rustiger | FR-I-02, FR-B-02 | 2 | — |
| "Iets anders vanavond" | FR-V-10 | 3 | — |
| Gezinsgrootte als standaard voor het aantal personen | FR-W-04 | 3 | — |
| Dupliceren | FR-RI-07 | 3 | — |
| Voorbeeld in de editor | FR-RI-05 | 3 | — |
| Invoer in stappen | FR-RI-06 | 3 | — |
| iOS-project, offline-scherm, native push, iconen | M1–M4 | 4 | #22, #23 |
| Storemateriaal en privacylabels | M7 | 6 | #27 |

**F2 en F3:** zie `COMPLETE_PRODUCT_INVENTORY.md` §2 en `COMMERCIAL_ROADMAP.md`. Daar is niets geschrapt.

## 3. Technische risico's
Zie `TECHNICAL_ARCHITECTURE.md` §4 (R1–R9). De belangrijkste:
- **R1:** schemaverschil tussen live en repo.
- **R2:** er is geen staging.
- **R3:** de app laadt de live website (Apple 4.2).
- **R4:** één AI-leverancier.
