# Foodlo: centrale productdocumentatie

Sinds 2026-11-13 is dit de **bron van waarheid** voor product, architectuur en planning. De oudere documenten in `docs/foodloapp-v2/` blijven bestaan als bron en als geschiedenis. Ze krijgen bovenaan een verwijzing naar het document hier dat hen samenvat.

## Afspraken over consistentie
1. **Statussen en fasen:**
   - de statussen komen uit `COMPLETE_PRODUCT_INVENTORY.md` (behouden, verbeteren, uitbreiden, te ontwikkelen, latere fase, geblokkeerd);
   - de detailinventaris per functie staat in `docs/foodloapp-v2/PRODUCTMATRIX.md`;
   - fasen: **F1** eerste consumentenlancering, **F2** gezinsuitbreiding en verdieping, **F3** commerciële uitbreiding (beslissing D-2026-11-13-1).
2. **Bugs** hebben één nummer, voor altijd: `BUG-nnn` in `docs/foodloapp-v2/BUG-REGISTER.md`. `KNOWN_ISSUES.md` verwijst er alleen naar.
3. **Beslissingen** staan in `DECISIONS_LOG.md`:
   - genomen beslissingen met datum;
   - open beslissingen met hun oude nummer (#1–#33 uit `BESLISSINGEN-EIGENAAR.md`);
   - gates G1–G8.
4. **Meetresultaten** staan alleen in `IMPLEMENTATION_STATUS.md`, met datum en commando. Andere documenten verwijzen ernaar en herhalen geen cijfers.
5. **Bij tegenspraak** geldt het document hier. De tegenspraak wordt genoteerd in `DECISIONS_LOG.md` §Tegenstrijdigheden, nooit stil weggehaald.

> Stand 2026-11-13: alle 17 documenten zijn geschreven.

## Documenten
| Document | Bron van waarheid voor |
|---|---|
| [MASTER_PRODUCT_VISION](MASTER_PRODUCT_VISION.md) | Visie, doelgroepen, principes, fasen |
| [MASTER_PRODUCT_BLUEPRINT](MASTER_PRODUCT_BLUEPRINT.md) | Domeinen, modules, gebruikersreizen, grenzen |
| [COMPLETE_PRODUCT_INVENTORY](COMPLETE_PRODUCT_INVENTORY.md) | Alles wat bestaat of gepland is, met status en fase |
| [FUNCTIONAL_REQUIREMENTS](FUNCTIONAL_REQUIREMENTS.md) | Eisen per module, met acceptatiecriteria en traceerbaarheid |
| [TECHNICAL_ARCHITECTURE](TECHNICAL_ARCHITECTURE.md) | Lagen, modules, integraties, technische risico's |
| [AI_ARCHITECTURE](AI_ARCHITECTURE.md) | AI en regels, privacylaag, uitbreidbaarheid, kosten |
| [PRIVACY_AND_SECURITY](PRIVACY_AND_SECURITY.md) | Gegevensklassen, AVG, RLS, geheimen, gegevensstromen |
| [DATABASE_ARCHITECTURE](DATABASE_ARCHITECTURE.md) | Schema, migratievolgorde, 0004, 0005 (alleen ontwerp) |
| [MOBILE_ARCHITECTURE](MOBILE_ARCHITECTURE.md) | Web, PWA, Capacitor, website-in-app tegenover meegeleverde app |
| [COMMERCIAL_ROADMAP](COMMERCIAL_ROADMAP.md) | Creators, partners, BCC, betalingen, premium |
| [INDUSTRY_AND_GROWTH_FUTURE](INDUSTRY_AND_GROWTH_FUTURE.md) | Alleen de grens met het afzonderlijke AI Growth OS (D-2026-11-13-6) |
| [DEVELOPMENT_ROADMAP](DEVELOPMENT_ROADMAP.md) | Werkstromen, volgorde, afhankelijkheden, rondes |
| [TESTING_STRATEGY](TESTING_STRATEGY.md) | Testlagen, regels, echte toestellen |
| [IMPLEMENTATION_STATUS](IMPLEMENTATION_STATUS.md) | Gemeten stand, met datum |
| [DECISIONS_LOG](DECISIONS_LOG.md) | Beslissingen, gates, tegenstrijdigheden |
| [KNOWN_ISSUES](KNOWN_ISSUES.md) | Open bugs met prioriteit (nummers uit het bugregister) |
| [RELEASE_PLAN](RELEASE_PLAN.md) | F1-lancering: voorwaarden, blokkades, stores |

**Werkwijze:** `CLAUDE.md` (veiligheidsgrenzen, visuele werkwijze) en `docs/foodloapp-v2/DESIGNSYSTEEM.md` (bindend voor schermen) blijven gelden.
