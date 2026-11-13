# Implementatiestatus (gemeten)
Dit document is de enige plek voor meetresultaten.

Elke regel heeft een datum, een commando en een branch. Oudere cijfers in andere documenten zijn historisch, bijvoorbeeld "unit 648" of "RLS 11/14/18" (tegenstrijdigheid T5).

## 1. Laatste meting
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

De 5 gefaalde E2E-tests van 2026-11-12 falen ook op `v2/dev`. Het gaat om BUG-140 (datum rond middernacht) en BUG-141 (2FA-test).

## 2. Stand per domein
Detail: `COMPLETE_PRODUCT_INVENTORY.md` en de PRODUCTMATRIX.

| Domein | Klaar | Getest | Opmerking |
|---|---|---|---|
| Consument F1 | grotendeels | unit + E2E (nep-databank) | Open: Lijst, Instellingen, persoonlijke voeding op het account |
| Receptinvoer | 14/14 methoden werken | volledig getest: methode 1; de rest alleen de UI | Ronde 2 |
| Assistent | regels ✅, AI ✅ | regels ✅, AI-ketens beperkt | Privacylaag in ronde 2 |
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
