# Implementatiestatus (gemeten)
Dit document is de enige plek voor meetresultaten.

Elke regel heeft een datum, een commando en een branch. Oudere cijfers in andere documenten zijn historisch, bijvoorbeeld "unit 648" of "RLS 11/14/18" (tegenstrijdigheid T5).

## 1. Laatste meting (na ronde 2, 2026-11-13)
Branch `claude/sleepy-euler-eghoc3`.

| Datum | Controle | Commando | Uitkomst |
|---|---|---|---|
| 2026-11-13 | Typecheck | `npm run typecheck` | 0 fouten |
| 2026-11-13 | Unit-tests | `npm test` | **683/683** (52 bestanden; 22 nieuw in ronde 2) |
| 2026-11-13 | Databankregels | `PGLITE_DIR=… node tests/rls/alles.mjs` | 21/21 zoals verwacht |
| 2026-11-13 | E2E telefoon + 390 px, volledig | `npx playwright test --project=mobiel-390 --project=telefoon` | **207 geslaagd, 0 gefaald**, 86 overgeslagen. De ene ✘ is een bewuste `test.fail` voor BUG-095. Vóór ronde 2: 195/5/86. |
| 2026-11-13 | Nieuwe E2E | `recept-beheer.spec.ts` (3), `receptinvoer.spec.ts` (4), telkens telefoon + desktop | 6/6 en 8/8 |
| 2026-11-13 | E2E na de laatste Lijst-wijziging | lijst, mobiel-kwaliteit, winkelmodus, winkel-voor-morgen, mobiel-breedtes | 51/51 |
| 2026-11-13 | Lint-ratchet | `node scripts/lint-ratchet.mjs origin/v2/dev` | geen nieuwe meldingen |
| 2026-11-13 | Lijst onderaan en invoerveld, gemeten | probe 390 px 100/150 %, 320 px 200 % | geen leeg vlak, geen overloop; voorbeeldtekst past behalve op 320 px bij 200 % |
| 2026-11-13 | Rondgang | `npm run schermen` | 2/2; voor en na in `docs/foodloapp-v2/schermen/actueel/README.md` |

## 1b. Vorige meting (na ronde 1)
Branch `claude/sleepy-euler-eghoc3`, commit `72fc4a3` en eerder.

| Datum | Controle | Commando | Uitkomst |
|---|---|---|---|
| 2026-11-13 | Typecheck | `npm run typecheck` | 0 fouten |
| 2026-11-13 | Unit-tests | `npm test` | 661/661 (49 bestanden) |
| 2026-11-13 | Databankregels | `PGLITE_DIR=… node tests/rls/alles.mjs` (PGlite 0.5.12) | 21/21 zoals verwacht |
| 2026-11-12 | E2E telefoon + 390 px | `npx playwright test --project=mobiel-390 --project=telefoon` | 195 geslaagd, 5 gefaald, 86 overgeslagen |
| 2026-11-13 | E2E lijst en weekmenu-lijst met Brusselse tijd | `TZ=Europe/Brussels npx playwright test weekmenu-lijst lijst --project=mobiel-390` | 13/13 |
| 2026-11-12 | E2E die door ronde 1 geraakt worden (kookstand, winkel, vandaag, week, voorraad, navigatie, personas …) | gerichte runs op 360, 390, telefoon en desktop | geslaagd; nieuwe tests falen op de oude code |
| 2026-11-12 | Lint-ratchet | `node scripts/lint-ratchet.mjs origin/v2/dev` | geen nieuwe meldingen |
| 2026-11-12 | Horizontale overloop, 8 hoofdschermen | probe op 320 px/200 %, 390 px/150 % en 390 px/100 % | geen overloop |
| 2026-11-12 | Rondgang | `npm run schermen` | 2/2, 18 beelden |

De 5 gefaalde E2E-tests van 2026-11-12 bleken testfouten (BUG-140, opgelost) en een bewuste `test.fail` (BUG-141 → geen bug).

## 2. Stand per domein
Detail: `COMPLETE_PRODUCT_INVENTORY.md` en de PRODUCTMATRIX.

| Domein | Klaar | Getest | Opmerking |
|---|---|---|---|
| Consument F1 | grotendeels | unit + E2E (nep-databank) | Ronde 2: Lijst, Instellingen, verwijderen, kopiëren, "Vul aan". Open: persoonlijke voeding op het account (0004b) |
| Receptinvoer | 14/14 methoden werken | Methode 1 volledig. Methoden 2, 3, 4, 5 en 9: unit en/of E2E (ronde 2). Een geslaagde AI-omzetting is niet E2E getest: er is geen AI in de testomgeving. | — |
| Assistent | regels ✅, AI ✅, privacylaag ✅ | regels ✅, privacylaag unit (5) | Geen E2E die de AI-aanvraag onderschept |
| Gezin F1 | ✅ | RLS + deels E2E | Realtime niet getest |
| Privacy en account | ✅ lokaal | ✅ lokaal | Staging ontbreekt |
| Mobiel | Android-project, PWA | geen echte toestellen | iOS ontbreekt |
| Creators, BCC-partners, betalingen | — | — | F2/F3 |
| Cloudontwikkeling | ✅ | ✅ (echte run, `bun.lock` ongewijzigd) | BUG-131 |

## 3. Niet gemeten
- echte toestellen;
- Safari/WebKit;
- VoiceOver en TalkBack;
- prestaties op een echt netwerk;
- het live schema;
- de echte Storage;
- realtime.
