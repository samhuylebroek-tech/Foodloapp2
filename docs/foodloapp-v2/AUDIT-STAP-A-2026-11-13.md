# Stap A: read-only inventarisatie van Foodlo (2026-11-13)

**Opdracht:** masteropdracht "FOODLO volledige productvisie, architectuur en roadmap", stap A.

**Context:**
- Branch `claude/sleepy-euler-eghoc3` (= `v2/dev` + productronde 1).
- PR [samhuylebroek-tech/Foodloapp2#1](https://github.com/samhuylebroek-tech/Foodloapp2/pull/1).

**Wat ik deed:**
- Alleen gelezen, gemeten en getest; geen code of databank gewijzigd.
- Aangevuld met drie inventarissen uit de code (consument en receptinvoer; creators, gezin, BCC, betalingen, AI; privacy, beheer, mobiel).
- Die staan samengevat in `PRODUCTMATRIX.md` (A–I), die verder de **volledige inventaris** blijft.

---

## 1. In het kort, voor de eigenaar
- **Wat werkt:** de consumentenapp werkt van begin tot eind:
  - Vandaag, Week, Ontdek, Recepten (14 manieren om toe te voegen), Kookstand, Lijst, Winkelmodus, Keuken;
  - Gezin en Vrienden, Instellingen, Hulp;
  - het Control Center met ± 45 schermen.
  - Dat geldt telkens met nepgegevens getest, niet op een echte telefoon en niet op een staging-databank.
- **Wat niet bestaat:** creators, betalingen, partners en premium bestaan nog niet in code. Ze staan in de plannen en blijven daar.
- **Wat blokkeert:** de grootste blokkades voor een echte lancering zijn niet technisch, maar beslissingen en omgevingen:
  - staging;
  - ontwikkelaarsaccounts;
  - iOS-project;
  - app-shell of website;
  - jurist;
  - echte toesteltest.
- **Twee privacy- en beveiligingspunten** zijn door jou goedgekeurd voor ronde 2: BUG-142 (vrij veld naar de AI) en BUG-143 (betaalpoort op de server).
- **De documentatie** is uitgebreid maar versnipperd: 49 documenten, waarvan 8 met elk een eigen roadmap of plan. Daardoor spreken ze elkaar op een paar punten tegen (§6). Voorstel voor één bron van waarheid in §7.
- **Je nieuwe opdracht** zet drie onderdelen in fase 1 die nu in fase 2 of "geblokkeerd" staan: eigen verzamelingen, allergieën per gezinslid en gedeelde gezinsplanning. Dat vraagt jouw keuze (§6, T1).

## 2. Gemeten basislijn (echte uitkomsten)

| Controle | Commando | Uitkomst |
|---|---|---|
| Typecheck | `npm run typecheck` | 0 fouten |
| Unit-tests | `npm test` | **661/661** geslaagd (49 bestanden) |
| Databankregels (PGlite) | `PGLITE_DIR=… node tests/rls/alles.mjs` | **21/21** scenario's zoals verwacht, inclusief voorstellen 0002, 0002a, 0003, 0003b, 0004, 0006 en 0007, telkens heen en terug |
| E2E (nep-databank) | `npx playwright test --project=mobiel-390 --project=telefoon` (2026-11-12) | 195 geslaagd, 5 gefaald, 86 overgeslagen |
| Lint-ratchet | `node scripts/lint-ratchet.mjs origin/v2/dev` | geen nieuwe meldingen |
| Visuele rondgang | `npm run schermen` | 2/2, 18 schermen |

Toelichting bij de E2E-run:
- De 5 tests die faalden, falen ook op de ongewijzigde `v2/dev`: BUG-140 (datum rond middernacht) en BUG-141 (2FA-test).
- Met `TZ=Europe/Brussels` slaagden de datumgevoelige lijsttests 13/13 (BUG-139).
- Er zijn 213 `test()`-regels in 46 bestanden, verdeeld over 5 projecten.

**Niet gemeten:**
- echte telefoons;
- Safari/WebKit;
- VoiceOver/TalkBack;
- prestaties op een echt netwerk;
- de echte databank (live schema).

## 3. Technische architectuur (zoals ze nu is)

| Laag | Feit | Bewijs |
|---|---|---|
| Front-end | TanStack Start (React 19, Vite 8), Tailwind 4, Radix-componenten, eigen designsysteem (Fraunces/Figtree) | `package.json`, `DESIGNSYSTEEM.md` |
| Schermen | 85 routes, waarvan ± 45 voor beheer (`beheer.*`, `beheer.ui.*`) | `src/routes` |
| Server | 125 serverfuncties (`createServerFn`) in 14 `*.functions.ts`-bestanden; 1 publieke API-route (cron voor meldingen, geheim in constante tijd) | `src/lib/*.functions.ts`, `src/routes/api/public/meldingen.run.ts` |
| Databank | Supabase (Postgres + RLS + Storage); 52 tabellen in `types.ts` | `src/integrations/supabase/types.ts` |
| Auth | Supabase Auth (e-mail) + Lovable cloud-auth (Google, Apple, Microsoft) | `aanmelden.tsx`, `src/integrations/lovable` |
| AI | Lovable AI-gateway, via `metCredits`: credits, cache (`ai_cache`), dag- en maandlimiet; 13 AI-functies; machinevertaling (`vertaal.functions.ts`) | `ai.functions.ts`, `credits.server.ts` |
| Regelgebaseerde intelligentie | `src/lib/intelligentie/*` en `vandaag.ts`, op het toestel, zonder AI | unit + E2E |
| Externe diensten | Lovable e-mail of Resend; web push (VAPID); websearch (Brave/DDG); Open-Meteo (code aanwezig, niet aangesloten) | `mail.server.ts`, `webpush.server.ts` |
| Mobiel | Capacitor 8, `appId com.foodloapp.app`; laadt de live website (`server.url = app.foodloapp.com`); alleen `android/`, geen `ios/` (wel `@capacitor/ios` in devDependencies); PWA met share target | `capacitor.config.ts`, `public/manifest.webmanifest` |
| Kwaliteit | CI met typecheck, unit, lint-ratchet, build, E2E (5 projecten), RLS, schermen; nep-Supabase voor E2E | `.github/workflows/ci.yml`, `tests/e2e/fake-supabase.mjs` |
| Ontwikkelomgeving | Cloud installeert de exacte versies uit `bun.lock` via het publieke register (BUG-131) | `scripts/cloud-start.sh` |

**Grenzen tussen domeinen:**
- **Al gescheiden:**
  - de consumentenapp tegenover beheer (`AdminShell`, `bewaker()`, eigen rechtenmatrix);
  - de regels op het toestel tegenover de AI op de server.
- **Nog niet gescheiden:** gezin (`groups`) en vrienden (`shares`) zijn twee rechtensystemen voor hetzelfde doel (beslissing #30).
- **Bestaat nog niet:** creators, partners en betalingen.

## 4. Databank en migraties

| Feit | Gevolg |
|---|---|
| Er staan 52 tabellen in de types. De repo heeft 50 `CREATE TABLE` (13 Supabase-migraties + 50 drizzle-bestanden). `inspiration_recipes` en `inspiration_ingredients` ontbreken. | De databank is niet volledig opnieuw op te bouwen uit git (BUG-011). Het live schema is nog niet vergeleken (#4). |
| Migratievoorstellen (niet uitgevoerd, met `down`):<br>- 0001 (boodschappen v2);<br>- 0002 (rollen en RLS);<br>- 0002a (basislijn recepten en foto's);<br>- 0003 en 0003b (bewaartermijnen);<br>- 0004 (weekmenu privé);<br>- 0006 (feedback op voorstellen);<br>- 0007 (houdbaarheid). | Alle voorstellen zijn lokaal getest (21/21). Geen enkel voorstel is op een echte databank geweest: staging bestaat niet. |
| **0004 (onderzocht):**<br>- Wat het doet: haalt het leesrecht op de kolom `profiles.weekmenu` weg, voegt `eigen_weekmenu()` toe en ruimt niets op of weg.<br>- App: leest al via `eigen_weekmenu()`, met terugval bij fout 42501 (`account-voorkeuren.ts` + test).<br>- Lezers met de service-sleutel (AVG-export, beheer) blijven werken.<br>- `down` zet het recht terug.<br>- RLS-test slaagt heen en terug. | **Niet destructief, wel een autorisatiewijziging.** Risico: functies of views in het live schema die de kolom als `authenticated` lezen. Die zijn onbekend (BUG-011).<br>Voorstel: eerst live schemavergelijking (alleen lezen), dan staging, dan productie met jouw akkoord (G1/G2). |
| **0005 (onderzocht):** er bestaat **geen bestand** 0005. Het nummer heeft in de documenten drie betekenissen:<br>- voorkeuren en allergieën per gezinslid (ARCHITECTUUR §2, #7);<br>- Help Center-tabellen (ONBOARDING-HELPCENTER §6);<br>- mee-eters (INTELLIGENCE-ARCH). | Voorstel:<br>- **0005 = huishoudensleden met voorkeuren, allergieën (per lid, met toestemming) en mee-eters**;<br>- Help Center krijgt **0008**.<br>Het ontwerp schrijf ik in stap D (DATABASE_ARCHITECTURE). Het bestand komt pas na jouw akkoord op de opzet. Het gaat om gezondheidsgegevens (AVG art. 9). |
| Allergieën en dieet staan nu alleen in `localStorage` op het toestel (`kennismaking.ts`) | Privacyvriendelijk, maar: niet op een tweede toestel, niet per gezinslid, en een gezinsplan kan er geen rekening mee houden. |

## 5. Indeling in vijf categorieën (detail: `PRODUCTMATRIX.md`)

| Categorie | Voorbeelden (niet volledig) |
|---|---|
| **1. Werkt** | Vandaag (incl. tijdregel), weekplanning (plannen, vervangen, ongedaan maken), boodschappen met samentellen en offline wachtrij, winkelmodus, kookstand met timers en hervatten, voorraad met drie standen, gebruik eerst, Ontdek met allergielabels, zelf een recept typen, versies, AVG-export, account verwijderen, web push, Control Center, AI-credits |
| **2. Werkt, onvoldoende getest** | Receptinvoer via link, sociale media, tekst, foto, gerecht herkennen, zoeken, delen naar de app (alleen de UI getest); sociale login (geen test); gezinsplanning in realtime; camera bij klantenkaarten; alles op echte toestellen en in Safari |
| **3. Bekende bugs (open)** | BUG-137/138 (Lijst); BUG-139/140 (datum en tijdzone); BUG-141 (2FA-test); BUG-142 (privacy AI); BUG-143 (betaalpoort); BUG-144/145/146 (kopiëren, AI vult aan zonder nakijken, twee manieren van verwijderen); BUG-011 (schema); BUG-012, 014, 087, 096, 097, 112, 119; zie `BUG-REGISTER.md` |
| **4. Ontbreekt (hoort in F1)** | iOS-project, offline-scherm in de app, native push, eigen recept dupliceren, één manier van verwijderen, nakijkstap bij kopiëren en bij "Vul aan", Instellingen opdelen, allergieën op het account, storemateriaal |
| **5. Later (F2/F3)** | Creators (profiel, publiceren, volgen, moderatie, statistieken), eigen collecties, allergieën per gezinslid, mee-eters, weer, budget, houdbaarheid, documentimport, BCC voor partners, premium, betalingen, gesponsorde content |

## 6. Tegenstrijdigheden en open keuzes (aanzet voor stap C)
Niets is weggehaald. Per punt: wat botst, en wat ik voorstel.

| # | Tegenstrijdigheid | Voorstel |
|---|---|---|
| **T1** | Je masteropdracht zet in **fase 1**:<br>- persoonlijke receptenverzamelingen;<br>- gezinsfunctionaliteit met gedeelde planning;<br>- allergieën per gezinslid.<br>`PRODUCTMATRIX`, `BESLISSINGEN` #7 en `LANCERINGSPLAN` zetten verzamelingen en allergieën per lid in fase 2 (migraties nodig, AVG art. 9). | **Jouw keuze:**<br>(a) naar F1: dat vraagt 0004 + 0005 + collectietabellen op staging en productie vóór de lancering, ± 2 weken extra;<br>(b) F1 met allergieën op het account voor de gebruiker zelf en gedeelde planning zoals nu, per lid in F2. |
| T2 | De belofte "allergieën gaan nooit naar de AI" tegenover het vrije veld dat wel naar de AI gaat | BUG-142, goedgekeurd: privacylaag in ronde 2 |
| T3 | "Betalingen alleen server-side" tegenover de schakelaar die alleen in de UI vergrendeld is | BUG-143, goedgekeurd: servercontrole in ronde 2 |
| T4 | Migratienummers: 0004 (collecties of profiel) en 0005 (drie betekenissen) | Nieuwe nummering in DATABASE_ARCHITECTURE (§4) |
| T5 | Testaantallen verschillen per document:<br>- unit 648 ↔ nu 661;<br>- RLS 11, 14 of 18 ↔ nu 21;<br>- E2E "452" ↔ 213 tests × projecten. | Eén bron: IMPLEMENTATION_STATUS met de meetdatum; oude cijfers als historisch markeren |
| T6 | `AVG-AUDIT.md` §9–10 zegt "niet gebouwd" voor BUG-025/110; code en bugregister zeggen "opgelost, lokaal getest" | AVG-AUDIT markeren als verouderd op dat punt, met een verwijzing |
| T7 | Gate G8 wordt gebruikt maar nergens gedefinieerd | In DECISIONS_LOG vastleggen: G8 = gegevenscorrectie op productie |
| T8 | Help Center: 22 of 24 artikels | Code telt 24 (`artikels.ts`) |
| T9 | `controle-voor-push.sh` eist branch `v2/dev`, terwijl je nu werkt met featurebranches en PR's | Script aanpassen: elke `v2/*`- of `claude/*`-branch toegestaan, `main` nooit |
| T10 | 8 overlappende plannen en visies:<br>- MASTERPLAN;<br>- PRODUCTVISIE;<br>- PRODUCTROADMAP;<br>- V2-IMPLEMENTATION-PLAN;<br>- V2-ONTWIKKELPLANNING;<br>- LANCERINGSPLAN;<br>- PRODUCTMISSIE-UITVOERING;<br>- PRODUCTMATRIX. | Documentstructuur in §7; oude documenten blijven als bron |
| T11 | `@capacitor/ios` is geïnstalleerd, maar er is geen iOS-project | In MOBILE_ARCHITECTURE en RELEASE_PLAN (A6) |
| T12 | "AI Growth OS" (je §8) staat nergens in de bestaande plannen | Eigen document INDUSTRY_AND_GROWTH_FUTURE.md, uitdrukkelijk **los** van de Foodlo-release |

## 7. Voorstel documentatiestructuur (bron van waarheid)
De 17 gevraagde documenten komen in **`docs/foodlo/`**, met een `README.md` als index. Elk document begint met "bron van waarheid voor …" en een lijst van de bestaande documenten waaruit het put. **Bestaande documenten blijven staan**; bovenaan krijgen ze een regel "samengevat in …".

| Nieuw document | Bron van waarheid voor | Put uit (blijft bestaan) |
|---|---|---|
| MASTER_PRODUCT_VISION | Visie, doelgroepen, principes | PRODUCTVISIE-V2, CLAUDE.md (missie), HANDOFF |
| MASTER_PRODUCT_BLUEPRINT | Modules, domeinen en hoe ze samenhangen | MASTERPLAN, PRODUCT-HERONTWERP, HERONTWERP-V2 |
| COMPLETE_PRODUCT_INVENTORY | Alles wat bestaat of gepland is, met status en fase | **PRODUCTMATRIX** (wordt dit document), FUNCTIE-INVENTARIS, `src/lib/functies.ts` |
| FUNCTIONAL_REQUIREMENTS | Eisen per module, met acceptatiecriteria | MODULE-AUDIT, PROACTIEVE-COOKING-USECASES, PRODUCTMISSIE-UITVOERING |
| TECHNICAL_ARCHITECTURE | Lagen, grenzen, integraties (§3) | ARCHITECTUUR-VOORSTELLEN, V2-IMPLEMENTATION-PLAN |
| AI_ARCHITECTURE | AI-functies, credits, privacylaag, uitbreidbaarheid | FOODLOAPP-INTELLIGENCE-ARCHITECTUUR, RISICO-EN-KOSTENANALYSE |
| PRIVACY_AND_SECURITY | AVG, RLS, geheimen, AI-gegevensstroom | SECURITY-AUDIT, SECURITY-RELEASE, AVG-AUDIT, AVG-BEWAARTERMIJNEN, 2FA-* |
| DATABASE_ARCHITECTURE | Schema, migratievolgorde (nieuwe nummering), 0004/0005 | MIGRATIE-VOORSTEL-*, `migratie-voorstel/`, HUISHOUDEN-ONTWERP, STAGING-VOORSTELLEN |
| MOBILE_ARCHITECTURE | Web, PWA, Capacitor, app-shell tegenover website | MOBIELE-STRATEGIE, MOBIEL-AUDIT, MOBIEL-REDESIGN-MATRIX |
| COMMERCIAL_ROADMAP | Creators, BCC, betalingen, premium (F2/F3) | CREATOR-GAP-ANALYSE, BUSINESS-CONTROL-CENTER-AUDIT |
| INDUSTRY_AND_GROWTH_FUTURE | AI Growth OS (los product), wat gedeeld kan worden en wat niet | nieuw |
| DEVELOPMENT_ROADMAP | Volgorde, afhankelijkheden, fasen | PRODUCTROADMAP-V2, V2-ONTWIKKELPLANNING |
| TESTING_STRATEGY | Testlagen, 10-passenregel, toestellen | TOEGANKELIJKHEID-PROTOCOL, PRAKTIJKTEST-TOESTELLEN, PERSONA-TESTVERSLAG |
| IMPLEMENTATION_STATUS | Gemeten stand, met datum (§2) | RELEASE-READINESS, BASELINE |
| DECISIONS_LOG | Genomen en open beslissingen, gates G1–G8 | BESLISSINGEN-EIGENAAR |
| KNOWN_ISSUES | Samenvatting en prioriteit van open bugs | **BUG-REGISTER** (blijft het detailregister) |
| RELEASE_PLAN | Lancering, blokkades, stores | LANCERINGSPLAN-V2, STAGING-PLAN, OVERSTAP-ONLINE-ONTWIKKELEN |

## 8. Volgende stappen
| Stap | Wat | Goedkeuring nodig? |
|---|---|---|
| B + C | Elke wens uit je drie opdrachten naast code, documenten en bugs leggen; T1–T12 uitwerken | nee (documentatie) |
| D | De 17 documenten in `docs/foodlo/`. Inhoud:<br>- de architectuur met domeingrenzen (consument, gezin, creators, commercieel; Growth OS apart);<br>- de AI-privacylaag;<br>- de opzet van 0005. | nee, behalve de opzet van 0005 (jouw akkoord vóór er een migratiebestand komt) |
| E | Roadmap met prioriteiten en afhankelijkheden | nee; T1 bepaalt fase 1 |
| F | Ronde 2 (goedgekeurd), punten 1–12. Staging, accounts en de app-shellvergelijking worden alleen voorbereid (documenten en checklists). | Migraties, deploy, accounts en uitgaven: telkens apart |
| G | Testen, documenteren, voor- en na-beelden, PR | nee |
