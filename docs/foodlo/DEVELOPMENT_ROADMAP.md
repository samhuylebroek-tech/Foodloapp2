# Ontwikkelingsroadmap
Dit document is de bron van waarheid voor werkstromen, volgorde, afhankelijkheden en rondes.

Het put uit de volgende documenten:
- `PRODUCTROADMAP-V2.md`;
- `V2-ONTWIKKELPLANNING-2026-11-12.md`;
- `PRODUCTMISSIE-UITVOERING.md`;
- `LANCERINGSPLAN-V2.md`.

De planning is een richting (± 6 weken tot een gesloten test), geen gegarandeerde datum.

## 1. Werkstromen
| Werkstroom | Inhoud | Bestanden (om conflicten te vermijden) |
|---|---|---|
| W-UX | Designsysteem, navigatie, grote tekst, schermkwaliteit | `src/components/ui`, `styles.css`, schermen per ronde |
| W-CON | Consumentenmodules | `src/routes/*` (consument), `src/components/*` |
| W-REC | Receptinvoer en -beheer | `RecipeForm.tsx`, `recepten.*`, `ai.functions.ts` (import), `import.server.ts` |
| W-AI | Assistent, privacylaag | `src/lib/intelligentie/*`, `src/lib/ai/*` (nieuw) |
| W-PRIV | Persoonlijke voeding, privacy, rechten | `kennismaking.ts`, `instellingen.tsx`, migratievoorstellen |
| W-MOB | iOS, Android, push, offline | `android/`, `ios/` (nieuw), `capacitor.config.ts`, `native.ts` |
| W-QA | Tests, toesteltest, CI | `tests/*`, `playwright.config.ts`, `.github/workflows` |
| W-REL | Staging, accounts, stores, juridisch | `docs/foodlo/RELEASE_PLAN.md` |
| Later | W-HUIS (F2), W-CRE (F2), W-COM (F3) | eigen mappen (`TECHNICAL_ARCHITECTURE` §2) |

## 2. Rondes
| Ronde | Inhoud | Stand |
|---|---|---|
| 1 | Top 10 uit de schermreview, cloudinstallatie | ✅ PR #1 (draft) |
| A–D | Inventaris, matrix, centrale documentatie | ✅ deze PR |
| **2** (goedgekeurd, aparte featurebranch) | Twaalf punten:<br>1. Lijst rustiger (BUG-137/138);<br>2. Instellingen opdelen;<br>3. Eén manier van verwijderen met ongedaan maken (BUG-146);<br>4. Nakijken bij "Zet in mijn gerechten" (BUG-144);<br>5. Nakijken bij "Vul aan" (BUG-145);<br>6. Tests voor link, tekst, foto en delen naar de app;<br>7. Privacylaag (BUG-142);<br>8. Betaalpoort op de server (BUG-143);<br>9. 0004 en 0005 onderzoeken (gedaan in `DATABASE_ARCHITECTURE` §3–5);<br>10. Staging voorbereiden;<br>11. Accounts voorbereiden;<br>12. Vergelijking website of app (gedaan in `MOBILE_ARCHITECTURE` §3).<br>Daarbij: tijdzone in de tests (BUG-139/140), push-controle voor featurebranches (T9). | volgende |
| 3 | Persoonlijke voeding op het account (0004b, na akkoord), "Iets anders vanavond", standaard aantal personen = gezinsgrootte, dupliceren, voorbeeld in de editor, invoer in stappen | na ronde 2 |
| 4 | iOS-project, offline-scherm, native push, iconen, opstartscherm, proef met de app-shell | na #22 |
| 5 | Staging: baseline, 0002, 0004, 0004b, de volledige suite tegen staging | na #1 |
| 6 | Echte toesteltest, bugfixes, help-artikels, storemateriaal, TestFlight en gesloten Play-test | na M5 en M6 |

## 3. Afhankelijkheden
```
#1 staging ──► baseline schema (#4) ──► 0002/0004/0004b op staging ──► ronde 5 ──► gesloten test
#24/#25 accounts (doorlooptijd!) ──────────────────────────────────────────────────┘
#22 app-shell ──► ronde 4 (iOS, offline, push) ──► toesteltest (#26) ──► stores
#27 jurist ──► privacyverklaring, voorwaarden, storeteksten ──────────────────────┘
akkoord 0004b ──► ronde 3 (persoonlijke voeding) ──► F1 compleet
```

## 4. F2 en F3 (volgorde, geen datum)
- **F2:**
  1. Collecties.
  2. 0005 (leden, allergieën per lid, mee-eters) en één huishoudmodel (#30).
  3. Gezinskringloop.
  4. Restjes op het account.
  5. "Niet voor mij" (0006).
  6. Houdbaarheid (0007).
  7. Weer (#15/#16).
  8. Budget (#21).
  9. Creators (C1–C8), met moderatie eerst.
  10. Documentimport.
  11. Vertalingen nalezen.
- **F3:**
  1. Partner-BCC.
  2. Gesponsorde inhoud.
  3. Premium.
  4. Betalingen en abonnementen.
  5. Creatorverdienmodellen.
  6. Affiliate (na de jurist).
