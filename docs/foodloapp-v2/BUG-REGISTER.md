# Foodloapp V2 — Bugregister

Levend register. Elke bevinding: reproduceren → prioriteren → oplossen → opnieuw testen.
Ernst: **Kritiek** (dataverlies/inbraak), **Hoog** (beveiliging/geld/kernflow), **Medium**, **Laag**.
Status: `Open` · `Opgelost` (met test) · `Gate` (wacht op goedkeuring eigenaar) · `Geaccepteerd` (bewust risico).

Laatste update: 2026-11-08 — branch `v2/dev`.

| ID | Ernst | Onderdeel | Probleem | Reproductie | Status | Fix / test |
|----|-------|-----------|----------|-------------|--------|-----------|
| BUG-001 | Hoog | Recept-import, foto ophalen | SSRF: redirects werden blind gevolgd (`redirect: "follow"`), dus elke publieke link kon doorsturen naar een intern adres (bv. cloud-metadata). | Test `weigert een omleiding naar een intern adres` faalt op oude code (geen hop-controle). | Opgelost | `src/lib/veilige-url.ts` volgt omleidingen handmatig en controleert elke stap. `veilige-url.test.ts` |
| BUG-002 | Hoog | URL-controle | Oude `veiligeUrl` liet o.a. `localhost.`, `api.localhost`, `intranet`, `127.0.0.1.nip.io`, poort 22 en `user:pass@` door. | Script tegen oude implementatie: 7/7 aanvalslinks doorgelaten. | Opgelost | Nieuwe `isInterneHost` + poort/credentials-check. 24 geblokkeerde gevallen getest. |
| BUG-003 | Medium | Foto/pagina ophalen | Geen maximale grootte vóór inlezen (`arrayBuffer()` laadt alles), geen timeout bij pagina-import. Trage/enorme respons kan worker ophouden of geheugen vullen. | Test `weigert een stroom die groter wordt` + `breekt een trage server af`. | Opgelost | `leesBeperkt` stopt bij limiet (5 MB HTML, 8 MB foto); timeouts 6–12 s. |
| BUG-004 | Hoog | Creditmotor | Na een geslaagde (betaalde) AI-taak kon een fout bij `credits_afronden` of het cachen het resultaat weggooien en terugstorten: AI-kost gemaakt, gebruiker kreeg niets en betaalde bij opnieuw proberen nog eens. | Test `als afronden faalt na een geslaagde AI-taak` faalde op oude code. | Opgelost | Boekhouding na succes is niet-fataal. `credits.server.test.ts` |
| BUG-005 | Medium | Creditmotor | Als `credits_terugstorten` zelf faalde, kreeg de gebruiker "netwerk weg" i.p.v. de echte fout, en werd de mislukking niet gemeten. | Test `als terugstorten zelf faalt` faalde: kreeg 'netwerk weg'. | Opgelost | Terugstorten in eigen try/catch, oorspronkelijke fout blijft. |
| BUG-006 | Medium | Meldingen | Mass assignment: `bewaarMeldingVoorkeuren` deed `upsert({ user_id, ...data })` met ongecontroleerde invoer; client kon `user_id` en willekeurige kolommen meesturen. RLS (`auth.uid() = user_id`) blokkeerde andermans rij al. | Schema-test `laat user_id en onbekende kolommen weg`. | Opgelost | zod-schema, onbekende velden weg, `user_id` als laatste. |
| BUG-007 | Medium | Push-meldingen | SSRF via push: elk `endpoint` werd bewaard en de server POST't er later naartoe, zonder timeout. | Test `post nooit naar een intern adres`. | Opgelost | Alleen https/niet-intern bij opslaan én verzenden; onveilige abonnementen worden uitgeschakeld; geen redirects; 10 s timeout. |
| BUG-008 | Laag | Gezin/vrienden | Invoer van uitnodigingsfuncties niet runtime-gevalideerd (alleen TypeScript-type). | — | Opgelost | zod `uuid()` voor ids, token-lengte. |
| BUG-009 | Hoog (a11y) | Donker thema | Rode verwijderknop: witte tekst op lichtrood = 3.19:1 (< 4.5:1 WCAG AA). | `kleurcontrast.test.ts` faalde. | Opgelost | Donkere tekst: 5.59:1. |
| BUG-010 | Medium (a11y) | Snelle sterrenscore | Gekozen sterren (gele vulling/rand) ≈ 2:1 op witte kaart — gekozen vs. niet gekozen slecht te zien (WCAG 1.4.11). | `kleurcontrast.test.ts` (honing op card). | Opgelost | Donkere rand op gekozen sterren. `Sterren.test.tsx` |
| BUG-011 | Hoog | Database | Schema-drift: twee migratiegeschiedenissen (`supabase/migrations` 13 bestanden, `drizzle/migrations` 40 bestanden); gegenereerde types bevatten ±62 tabellen vs. 20 `CREATE TABLE` in `supabase/migrations`. | Telling in baseline. | Gate | Vergelijken met echt schema vereist een **staging**-project + schema-dump. Geen productiemigratie. |
| BUG-012 | Medium | Kosten | AI-foto's worden als base64-data-URL (±1–2 MB) in `ai_cache.result` (jsonb) bewaard en bij elke cachetreffer via de server verstuurd. | Code-inspectie `gerechtFoto`. | Open | Plan: beeld in Storage, cache bewaart enkel het pad. Vereist storage-wijziging → staging eerst. |
| BUG-013 | Laag | Lint | 5 472 lintmeldingen baseline (5 056 enkel opmaak, 385 `any`). | `bunx eslint .` | Open | Geen massale herformattering (Lovable-conflicten). Nieuwe/gewijzigde code lint-schoon; regel per bestand verlagen. |
| BUG-014 | Laag | Dode code | `NieuweSuggesties.tsx` wordt nergens geïmporteerd, maar zou bij hergebruik per kaart automatisch een betaalde AI-foto maken en bij mislukking eindeloos een laad-skelet tonen. | grep: geen import. | Open | Niet verwijderen zonder akkoord; bij hergebruik eerst fixen. |
| BUG-015 | Laag | Rechten | `schoonRechten` gebruikt `Boolean(x)`: de tekst `"false"` wordt `true`. Huidige clients sturen echte booleans. | Code-inspectie. | Open | Naar `=== true` na test van alle deel-flows. |
| BUG-016 | Laag (a11y) | Sterren | `SterrenSnel`-knoppen zijn 44 px hoog; de eigen productstandaard (`.lovable/memory`) zegt min. 56 px. WCAG 2.5.8 (24 px) wordt wel gehaald. | `Sterren.test.tsx`. | Open | Ontwerpkeuze voor compacte kaarten; meenemen in UX-pass. |
| BUG-017 | Info | Planning | De eerdere map `foodloapp-v2-planning/` (00–15 + `phase-0-staging/`) is niet gevonden op deze Mac. | `find ~ -maxdepth 6`. | Open | Plan is opgebouwd uit de handoff-documenten + broncode. Eigenaar: map in de repo of naast de repo plaatsen als die nog bestaat. |

## Hertest-log
- 2026-11-08: na elke fix volledige suite (`bun run test`), `tsc --noEmit`, `vite build` — allemaal groen. 209 tests.
