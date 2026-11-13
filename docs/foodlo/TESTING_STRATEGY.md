# Teststrategie
Dit document is de bron van waarheid voor de testlagen, de regels en de tests op echte toestellen.

Het put uit:
- `TOEGANKELIJKHEID-PROTOCOL.md`
- `PRAKTIJKTEST-TOESTELLEN.md`
- `PERSONA-TESTVERSLAG-2026-11.md`
- `CLAUDE.md` (regel van 10 controles)

## 1. Lagen
| Laag | Gereedschap | Commando | Wat |
|---|---|---|---|
| Typen | TypeScript | `npm run typecheck` | Contracten |
| Unit | Vitest + Testing Library | `npm test` | Pure logica: veiligheid, intelligentie, Vandaag, ingrediënten, credits, privacylaag (ronde 2) |
| Databankregels | PGlite | `PGLITE_DIR=<map> node tests/rls/alles.mjs` | RLS en migratievoorstellen, heen en terug |
| E2E | Playwright tegen een nep-Supabase | `npx playwright test --project=<telefoon\|desktop\|mobiel-360\|mobiel-390\|tablet-768>` | Gebruikersreizen, a11y (axe), aanraakdoelen, 320 px en 200 % |
| Visueel | Rondgang | `npm run schermen` | 9 schermen × 2 weergaven, voor en na |
| Telefoonbeeld | Playwright (390 × 844) | gerichte specs | Echt zichtbaar beeld, vaste balken, scrollen. Niet alleen schermafdrukken van de hele pagina |
| Lint | ESLint-ratchet | `node scripts/lint-ratchet.mjs origin/v2/dev` | Geen nieuwe meldingen |
| Echte toestellen | Mens + script | `PRAKTIJKTEST-TOESTELLEN.md` | iOS/Android, VoiceOver/TalkBack, grote systeemtekst, camera, push |

## 2. Regels
1. Elke opgeloste bug krijgt een test die **op de oude code faalt**. Dat schrijven we zo in het bugregister.
2. Elke betekenisvolle wijziging krijgt **10 verschillende controles**, verspreid over de lagen hierboven. Tien keer dezelfde run telt niet.
3. **Tijd:**
   - E2E draait met `TZ=Europe/Brussels` (BUG-139/140);
   - tijdgevoelige tests gebruiken `zetKlok`.
4. **Geen echte diensten in tests.** AI en web worden in de nep-Supabase of in de test zelf onderschept. Zo testen we de **echte importketen** (parsen, nakijken, bewaren) met een vaste AI-uitkomst.
5. **Privacy:** de E2E-test onderschept elke AI-aanvraag en controleert dat er geen allergeen- of dieetterm in staat (BUG-142).
6. Een rode test wordt **nooit** overgeslagen of uitgezet om groen te krijgen.

## 3. Receptinvoer (FR-RI-02)
Per invoermethode moeten deze stappen getest zijn:
1. starten;
2. invoer;
3. nakijken;
4. bewaren;
5. terugvinden;
6. bewerken;
7. gebruiken in Week of Lijst.

Ronde 2 dekt methoden 2 (link), 4 (tekst), 5 (foto) en 9 (delen naar de app). Daarna volgen 3, 6, 7, 8, 10, 11 en 14.

## 4. Echte toestellen (vóór de gesloten test)
- Toestellen: 2 iPhones (klein en groot, iOS 17+) en 2 Android-toestellen (middenklasse, Android 12+).
- Instellingen: grote systeemtekst, donkere modus, VoiceOver en TalkBack.
- Omstandigheden: traag netwerk en offline.
- Te testen:
  - camera (foto van een recept, klantenkaart);
  - push;
  - deel-intent;
  - scherm aan in de kookstand.
