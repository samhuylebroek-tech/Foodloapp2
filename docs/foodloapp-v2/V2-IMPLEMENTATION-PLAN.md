# Foodloapp V2 — Definitief uitvoeringsplan

> Samengevat in [`docs/foodlo/TECHNICAL_ARCHITECTURE.md`](../foodlo/TECHNICAL_ARCHITECTURE.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Status: **gezaghebbend** vanaf 2026-11-08. Vervangt geen originele documenten; die blijven staan.
Bronnen: `CLAUDE.md`, `CLAUDE-CODE-HANDOFF.md`, `START-HERE-FOR-CLAUDE-CODE.md`, `roadmap.md`, `.lovable/memory`, `.lovable/plan/*`, en een audit van de broncode (zie `BASELINE-2026-11-08.md`, `BUG-REGISTER.md`).
De oudere map `foodloapp-v2-planning/` is niet gevonden (BUG-017). Als die terugkomt, wordt hij hiertegen gecontroleerd en worden verschillen hier bijgewerkt.

## 1. Wat vastligt
- Eén product voor twee mensen: een 70-jarige beginner moet het **zonder hulp** kunnen gebruiken, een 20-jarige foodcreator moet het **mooi, snel en krachtig** vinden. Diepgang groeit mee (progressive disclosure), niet twee apps.
- De huidige stack blijft (TanStack Start + Supabase + Lovable). Afhankelijkheden van Lovable worden geleidelijk achter adapters gezet. Geen herschrijving.
- Eerst responsive web, native komt later (Capacitor staat klaar).
- De kernlus: vastleggen/importeren → vinden/ordenen → plannen → boodschappen → keuzes op basis van de voorraad → koken → beoordelen.
- AI helpt en overschrijft nooit stil gegevens. Resultaten zijn controleerbaar, gecachet, gemeten en hebben een terugval zonder AI.
- Creator-abonnementen en kaartbetalingen worden **nu in de architectuur ontworpen**. Ze worden **pas geactiveerd na goedkeuring** en na een juridische, fiscale en beveiligingsreview.

## 2. Approval gates (Claude stopt hier en vraagt het)
| Gate | Waarom |
|------|--------|
| G1 Productiemigraties / schemawijzigingen | Klantdata. Eerst een staging-project met verifieerde back-up. |
| G2 RLS-/rechtenwijzigingen | Hoog risico. Vereist tests, rollback en akkoord. |
| G3 Merge naar `main`, of push naar een branch die met Lovable synchroniseert | Lovable synchroniseert de geschiedenis. |
| G4 Deployment | — |
| G5 Betalingen activeren / provider-account / live keys | Juridisch, fiscaal en PCI. |
| G6 Rotatie van secrets | Vereist bewijs en akkoord. |
| G7 Dode code of features verwijderen | Kan Lovable-werk raken. |

## 3. Fasering

### Fase 0 — Fundament en veiligheid (nu bezig; alleen code, geen productie)
| # | Taak | Status | Acceptatie | Kosten | Rollback |
|---|------|--------|-----------|--------|----------|
| 0.1 | Worktree + `v2/dev` zonder upstream, baseline | ✅ | Originele wijzigingen onaangeroerd | 0 | `git worktree remove` |
| 0.2 | Testinfrastructuur (Vitest, Testing Library, axe-core) + scripts `test`, `typecheck` | ✅ | `bun run test` groen | 0 | 1 commit terugdraaien |
| 0.3 | SSRF- en grootte-/timeoutbescherming voor alle externe fetches (BUG-001/002/003/007) | ✅ | 24 aanvalslinks geblokkeerd, echte sites en pushdiensten werken | ↓ (minder vastgelopen workers) | revert `8668ea3`, `fd89b4c` |
| 0.4 | Creditmotor: betaald resultaat nooit weggooien (BUG-004/005) | ✅ | Tests voor succes, cache, mislukking, terugstorten en afronden | ↓ (geen dubbele AI-oproepen) | revert `8668ea3` |
| 0.5 | Invoervalidatie op serverfuncties (BUG-006/008) | ✅ deels | Alle `inputValidator`s gebruiken zod; nog te doen: admin- en monitoringfuncties | 0 | revert per commit |
| 0.6 | WCAG-contrastbewaking + eerste fixes (BUG-009/010) | ✅ | 113 contrastchecks over 5 thema's | 0 | revert `5af39b6` |
| 0.7 | CI (lint op gewijzigde bestanden, typecheck, test, build) | ✅ concept | Workflow draait op `v2/**` en PR's | GitHub-minuten (klein) | bestand verwijderen |
| 0.8 | Zod-validatie voor de overige ~74 serverfuncties, te beginnen bij admin, credits en export | ⏭ volgende | Elke functie heeft een schema plus een test voor een ongeldige invoer | 0 | per functie |
| 0.9 | Pure helpers testen: `ingredienten`, `porties`, `boodschappen`, `zoeken`, `tijd`, `canoniekeUrl` | ⏭ | ≥ 90% branches op deze modules | 0 | — |
| 0.11 | Playwright E2E + nep-Supabase + CI-job | ✅ | 34 tests op telefoon en desktop; geen request naar echte hosts | 0 (CI-minuten) | map `tests/e2e` verwijderen |
| 0.12 | Aanmelden: gewone-taal-fouten, wachtwoord vergeten, toon-wachtwoord, hydratatie (BUG-021…024) | ✅ | E2E groen; axe zonder ernstige problemen | 0 | revert commit |
| 0.13 | Afhankelijkheden: lockfile-onderzoek + kritieke TanStack/seroval-fix (BUG-034) | ✅ op `v2/dev` | `bun audit` 4→1 kritiek (rest dev-only) | 0 | revert `6c298b4` |
| 0.14 | CI: lint-ratchet, merge-base, artefacten (BUG-036) | ✅ | Verse clone met CI=true volledig groen | CI-minuten | revert `d5c6899` |
| 0.15 | Ingelogde E2E-kernflow (aanmelden → recept → weekmenu → boodschappen) op 360/390/768/1280 px + fixes BUG-028…033 | ✅ | 86 E2E-tests groen | 0 | revert per commit |
| 0.10 | Staging-Supabase + schemadump → drift tussen de twee migratiemappen in kaart (BUG-011) | 🔒 G1 | Diff tussen live schema, `supabase/` en `drizzle/` gedocumenteerd | Supabase free/€25 | n.v.t. (alleen lezen) |

### Fase 1 — Kernlus: moeiteloos voor de beginner, snel voor de creator
Elk item: kleine PR's, eerst testen, toegankelijkheid en alle toestanden (laden, leeg, fout, offline).
1. **Receptbouwer opsplitsen** (`RecipeForm`, `planner.tsx` 2 956 regels) in testbare stukken, zonder gedragsverandering. Daarna pas UX-wijzigingen.
2. **Eén laad-, fout- en leegpatroon** (component + richtlijn), toegepast op import, planner, boodschappen en voorraad.
3. **Importreview**: AI-extractie altijd als controleerbaar voorstel, met zichtbare herkomst ("van de pagina" of "door AI ingevuld") en undo.
4. **Kookmodus**: grote stappen, scherm blijft aan (bestaat al), stemvriendelijke stap-voor-stap en een timer per stap.
5. **Boodschappen ↔ voorraad**: pantry-loop goedkoop valideren (tellers, geen zware engine), zoals beslist.
6. **Toegankelijkheidspass per scherm**: focusvolgorde, labels, foutmeldingen in gewone taal, doelen ≥ 44 px (de eigen standaard is 56 px voor hoofdknoppen), WCAG 2.2 *Focus Not Obscured*, *Dragging Movements* (alternatief voor swipe-verwijderen in `gerechten.tsx`), *Accessible Authentication*.

### Fase 2 — Creator-fundament (zonder geld)
- Domeinmodel (alleen ontwerp plus migraties in staging): `creator_profiles`, `follows`, `content_visibility` (public / followers / subscribers), `subscription_products`, `entitlements`, `subscriptions` (states: `trialing`, `active`, `past_due`, `canceled`, `refunded`, `chargeback`), `payouts`, `ledger_entries` (dubbele boekhouding: bruto, platformfee, creatordeel, btw, refund).
- **Toegangscontrole via één functie `heeftToegang(user, content)`**, server-side en in RLS. Getest met een matrix: eigenaar, volger, abonnee, verlopen abonnee, refund, geblokkeerd.
- Publieke creatorpagina en een volgfunctie (gratis). Meten: conversie van bezoek naar volger.

### Fase 3 — Betalingen (alleen na G5)
- `PaymentProvider`-adapter: `createCheckout`, `createCustomerPortal`, `verifyWebhook`, `refund`, `createConnectedAccount`, `payoutStatus`. Geen providercode buiten de adapter.
- Gehoste checkout, dus geen kaartdata bij ons. Webhooks met handtekeningverificatie, idempotentiesleutels en een auditlog.
- Providerkeuze na vergelijking voor België/EU: marketplace-uitbetalingen, KYC, terugkerende betalingen, btw/OSS, fees, Bancontact. Kandidaten: Stripe Connect, Mollie (Connect/Split), Adyen for Platforms, Paddle als merchant of record (vereenvoudigt btw, maar is minder geschikt voor uitbetalingen aan creators).
- Juridisch: consumentenrecht (herroeping bij digitale inhoud), algemene voorwaarden voor creators, privacy, moderatie.

### Fase 4 — Schaal en kosten
- Kostenmodel per actieve gebruiker, creator, AI-actie, mediabestand, e-mail en betaling (de `ai_usage`- en `model_prices`-tabellen bestaan al: uitbreiden, niet vervangen).
- AI-foto's naar Storage in plaats van base64 in `ai_cache` (BUG-012).
- Quota en budgetalarmen per feature. Paginering en indexen op recepten, planner en zoeken. Zware taken asynchroon.

## 4. Teststandaard (≥ 10 verschillende passes per belangrijke wijziging)
| # | Categorie | Hoe (tooling) |
|---|-----------|---------------|
| 1 | Unit | Vitest |
| 2 | Component/interactie | Testing Library + user-event |
| 3 | Integratie/API-contract | serverfuncties met nep-Supabase; later staging |
| 4 | End-to-end kernflow | Playwright tegen lokale dev-server + nep-Supabase (`tests/e2e`); externe requests geblokkeerd |
| 5 | Toegankelijkheid | axe-core in tests + contrastbewaking + handmatige VoiceOver/TalkBack-ronde |
| 6 | Responsive/aanraakdoelen | Playwright-viewports 360/390/768/1280 + checks op klassen |
| 7 | Beveiliging/autorisatie | SSRF-, mass-assignment- en rechtenmatrixtests; RLS-tests in staging |
| 8 | Data-integriteit | creditboekhouding, idempotentie, rollback in staging |
| 9 | Fout/leeg/offline/herstel | gesimuleerde netwerkfouten, time-outs, lege lijsten |
| 10 | Prestaties/kosten | bundelgrootte, aantal AI-oproepen per flow, cachetreffers |
| 11 | Regressie | volledige suite + build bij elke commit (CI) |

### Toegepast op de wijzigingen van 2026-11-08
| Wijziging | Uitgevoerde passes |
|-----------|--------------------|
| SSRF/fetch-bescherming | 1 unit (24 blokkades, 4 toegelaten); 3 integratie (nep-fetch, redirect-hops); 7 beveiliging (aanvalslijst, bewezen tegen oude code); 9 timeout en te groot; 10 vroegtijdig stoppen bij te grote stroom; 8 UTF-8-correctheid; 11 regressie (volledige suite + typecheck + build). Nog niet gedaan: 4 E2E en 6 responsive (niet van toepassing, server-only). |
| Creditmotor | 1 unit; 3 integratie (nep-RPC); 8 data-integriteit (afronden, terugstorten, cache); 9 foutpaden (4 scenario's); 10 kosten (cachetreffer = 0 credits, AI niet aangeroepen); 7 misbruik (geen cache bij mislukking); 11 regressie. |
| Validatie van meldingen en uitnodigingen | 1 unit; 7 mass assignment en SSRF; 3 echte client-payloads blijven geldig (16 velden); echte endpoint-formaten van FCM, Mozilla, Apple en WNS; 9 ongeldige invoer (11 gevallen); 11 regressie + typecheck. |
| Contrast en sterren | 5 a11y (113 contrastchecks, axe op 2 componenten); 2 component; toetsenbordbediening; aria-pressed; 6 grootte van aanraakdoelen; 11 regressie + build. Nog te doen: handmatige controle met een schermlezer op een echt toestel. |

## 5. Werkwijze per taak
1. Kleine branch-commit op `v2/dev` (lokaal). 2. Eerst een test die de bug of eis vastlegt. 3. Fix. 4. Volledige suite, typecheck en build. 5. Bugregister bijwerken. 6. Geen push of merge zonder G3.

## 6. Residuele risico's (eerlijk)
- E2E dekt nu alleen aanmelden, wachtwoordherstel en de bewaking van beschermde pagina's. Ingelogde flows (recept, planner, boodschappen) volgen met een nep-sessie.
- Het SSRF-filter werkt op hostnaam en kan geen DNS-resolutie doen in Workers. Een publieke domeinnaam die naar een privé-IP wijst, wordt dus niet herkend. Cloudflare Workers blokkeren privé-netwerken grotendeels zelf; dat is een restrisico.
- Schema-drift (BUG-011) is niet opgelost tot er een staging-omgeving is.
- Lint-baseline (5 472 meldingen) blijft bestaan om conflicten met Lovable te vermijden.

## 7. Stand na het V2-ontwerp (2026-11-08)
**Designsysteem (geïmplementeerd in code, `src/styles.css` + gedeelde componenten):**
- Typografie: Fraunces (titels: `text-paginatitel`, `text-sectietitel`, `text-heldentitel`, `text-kaarttitel`) + Figtree (tekst, getallen). Basis 18 px.
- Kleur: salie/emerald-primair, warme accenten `terracotta` en `honing`, contrast bewaakt in 5 thema's (128 checks).
- Vorm en diepte: radius 0,875 rem, schaduwen `shadow-zacht` / `shadow-kaart` / `shadow-zwevend`.
- Omslagen: `RecipePhoto` + `src/lib/omslag.ts` (kleurverloop en icoon per soort gerecht).
- Patronen: kaarten zonder harde randen, chips voor kenmerken, scrollstroken (`.scroll-rij`, altijd `relative`), toegankelijke dialogen, meldingen van 18 px.

**Schermen vernieuwd:** shell en navigatie, Start, Recepten, Receptdetail, Kookstand (timers en herstel), Weekmenu (omslagen); Boodschappen via tokens.

## 8. Volgende vijf taken
| # | Taak | Waarom | Gate |
|---|------|--------|------|
| 1 | **Beveiligingsrelease live** (`SECURITY-RELEASE.md`) | Kritieke XSS en deserialisatie in de live app | **G3/G4: eigenaar** |
| 2 | **Tweede beveiligingsrelease** voorbereiden: SSRF, begrensde lijsten, invoervalidatie (op een aparte branch vanaf `main`) | Ook live relevant (BUG-001/002/003/007/049) | G3/G4 |
| 3 | **Zod 4-migratie** stap 1–2 (`ZOD4-MIGRATIE.md`) | Laatste runtime-advisory | — |
| 4 | **Boodschappen en weekmenu verdiepen**: weekoverzicht als raster op desktop, planner opsplitsen (2 950 regels), BUG-037/038 | Consistentie en onderhoudbaarheid | — |
| 5 | **Staging opzetten** (schema-drift BUG-011, foto's naar Storage BUG-012, AVG-verwijdering BUG-025) | Voorwaarde voor database- en creatorwerk | **G1: eigenaar maakt staging-project** |
