# Lanceringsplan Foodloapp V2: van lokaal naar de App Store en Google Play

Stand 2026-11-12, `v2/dev`, lokaal. Dit plan vat de bestaande documenten samen tot één route:
- RELEASE-READINESS;
- MOBIELE-STRATEGIE-IOS-ANDROID;
- STAGING-PLAN-LOVABLE-CLOUD;
- BESLISSINGEN-EIGENAAR.

**Doel:** een kleine, sterke eerste versie. Geen maximale versie.

## 1. Waar we staan (gecontroleerd)
| Gebied | Stand | Bewijs |
|---|---|---|
| Kernflow Vandaag → Week → Lijst → Koken → Keuken | ✅ werkt, met en zonder voorraad | E2E 452 + herhaling 169/169, dagflow-persona |
| Slimme voorstellen (seizoen, dag, geschiedenis, voorraad, restjes), uitschakelbaar | ✅ lokaal | Unit 648/648 |
| Allergie- en dieetveiligheid, overal dezelfde regel | ✅ lokaal | `veiligheid.spec.ts`, restjes, Ontdek |
| Toegankelijkheid (320 px, 200 %, 5 thema's, toetsenbord, axe) | ✅ in simulatie | `dagflow-toegankelijk.spec.ts`; echte VoiceOver/TalkBack nog niet |
| Geheimen in de Git-geschiedenis | ✅ geen echte geheimen | §5 |
| V2 online | ❌ nergens | 122 lokale commits, niets gepusht |
| Staging | ❌ bestaat niet | beslissing 1 |
| Echte telefoon | ❌ nooit getest | BUG-086/117 |
| iOS-project | ❌ ontbreekt (alleen `android/`) | — |
| De app laadt de live website (`server.url`) | ⚠️ afwijzingsrisico bij Apple (richtlijn 4.2) | beslissing 22 |
| 2FA voor het Control Center | ⚠️ gebouwd, staat uit | beslissing 2 |

## 2. Wat er nodig is, in drie groepen
### A. Absoluut noodzakelijk voor de eerste live versie
| # | Wat | Wie | Hangt af van |
|---|---|---|---|
| A1 | **Staging** (apart Lovable-project, zonder echte gegevens) | Jij maakt het aan; ik richt het in | Beslissing 1 |
| A2 | Schema live ↔ repo vergelijken (BUG-011), daarna de migraties 0002, 0003/0003b, 0004, 0006 en 0007 op staging | Ik (jij keurt goed) | A1 |
| A3 | V2 naar GitHub op een **aparte branch**, CI groen (§4) | Ik, na jouw akkoord | Beslissing 11 |
| A4 | V2 op staging, en de volledige testsuite tegen staging | Ik | A1, A3 |
| A5 | **App-omhulsel voor de winkels**: kiezen tussen "live website laden" en "app meeleveren" (§3) | Jij beslist, ik bouw | Beslissing 22 |
| A6 | iOS-project aanmaken, iconen en opstartscherm voor beide platformen | Ik | A5 |
| A7 | **Ontwikkelaarsaccounts** Apple (± €99/jaar) en Google Play (eenmalig ± $25); organisatie of persoon (D-U-N-S kan 30 dagen duren, **nu starten**) | Jij | Beslissingen 24, 25 |
| A8 | Echte toesteltest: 2 iPhones + 2 Android, script PRAKTIJKTEST-TOESTELLEN | Jij + ik | A4, A6 |
| A9 | **2FA aan** voor het Control Center (eerst geoefend op staging) | Jij + ik | Beslissing 2 |
| A10 | Privacyverklaring en voorwaarden (juridisch nagelezen), privacylabels (Apple) en Data safety (Google) | Ik bereid voor, jurist leest na | Beslissing 27 |
| A11 | Help-artikels nalezen (24, alleen nagelezen artikels zijn live zichtbaar) | Jij of een vertrouwd persoon | Beslissing 8 |
| A12 | Back-upbeleid van de databank nagekeken | Jij (Lovable-plan) | Beslissing 33 |
| A13 | Beslissing over de lijstberekening bij wie de voorraad niet bijhoudt (architectuur §9.3) | Jij | — |

### B. Sterk aanbevolen voor de eerste versie
| # | Wat | Waarom |
|---|---|---|
| B1 | Native pushmeldingen (opt-in, max. 1 per dag) | Helpt ook bij richtlijn 4.2; dagelijkse gewoonte |
| B2 | Restjes en "Niet voor mij" op het account (ontwerp R1–R5) | Werkt op elk toestel en met het gezin |
| B3 | Overzicht "Wat Foodlo over mij gebruikt" in Instellingen, met wissen per onderdeel | Transparantie; helpt bij de privacylabels |
| B4 | Begeleide test met 5–8 mensen (TestFlight en een gesloten test in Play) | Echte feedback vóór de publicatie |
| B5 | Weer (gemeente, via een server-proxy) | De motor is er al klaar voor; vraagt een licentie en kosten (beslissingen 15 en 16) |

### C. Kan veilig na de lancering
- Huishouden met voorkeuren en allergieën per lid (0005);
- budgetvoorkeur;
- AI-ideeën binnen budget;
- creators en betalingen;
- Business Control Center met echte financiële bronnen;
- teamleden in het Control Center;
- meer talen.

## 3. Beslissing A5: hoe de app in de winkels komt
| | 1. Live website laden (nu) | 2. App meeleveren (app-shell) |
|---|---|---|
| Werk | Bijna klaar | ± 3–5 dagen onderzoek + bouw (serverfuncties vanuit de app aanroepen, CORS, offline-pagina) |
| Updates | Meteen, zonder nieuwe winkelversie | Elke wijziging aan de schermen vraagt een nieuwe versie |
| Apple 4.2 | Hoger risico, vooral zonder native functies | Lager risico |
| Offline | Wit scherm zonder netwerk | Nette offline-stand |

**Aanbevolen:**
1. Start met **1** voor TestFlight en de gesloten test. Dat mag daar, en het is het snelst.
2. Voeg daarin native push (B1) en een offline-scherm toe.
3. Doe parallel het onderzoek naar **2**.
4. Kies vóór de echte indiening op basis van de testfeedback.

## 4. Online ontwikkelen (voorbereid, niet uitgevoerd)
- **Repository:** al privé op GitHub (`samhuylebroek-tech/dinner-dialogue-hub`, niet publiek zichtbaar). Lovable is gekoppeld aan `main`.
- **CI** (`.github/workflows/ci.yml`, bijgewerkt):
  - typecheck, unittests, lint-ratchet en build;
  - E2E in 5 parallelle taken (per schermformaat);
  - databank- en privacytests met PGlite;
  - draait alleen op `v2/**`-branches en pull requests;
  - gebruikt geen geheimen en deployt nooit.
- **Omgevingen:**

  | Omgeving | Waar | Gegevens |
  |---|---|---|
  | Ontwikkeling | Lokaal of Claude Code in de cloud | Nepdatabank |
  | Test | GitHub Actions | Nepdatabank |
  | Staging | Apart Lovable-project | Alleen verzonnen gegevens |
  | Productie | Bestaand Lovable-project | Echte gegevens, alleen na jouw akkoord per stap |
- **Claude Code in de cloud:** werkt op een kopie van de GitHub-repository, dus pas na de push (A3). Je computer wordt dan niet meer belast.

### Overdrachtsplan (pas na jouw schriftelijke akkoord)
1. Laatste controle: geheimenscan (§5) en een volledige lokale regressie.
2. `v2/dev` pushen naar een **nieuwe** branch op GitHub (bv. `v2/dev`, die er al is maar 122 commits achterloopt). Geen force-push. `main` en de originele branches blijven onaangeroerd, zodat Lovable niets merkt.
3. CI controleren op GitHub. Eerst groen, daarna pas verder.
4. Een pull request naar `main` komt pas **na de stagingtest**, en alleen met jouw akkoord, want Lovable rolt `main` uit.

## 5. Geheimen en persoonsgegevens in de geschiedenis (gecontroleerd 2026-11-12)
Gecontroleerd: alle branches, 1 527 commits. Alleen namen van bestanden, nooit de waarden.

| Wat | Bevinding | Oordeel |
|---|---|---|
| `.env` in de geschiedenis (3 commits, al op `origin/main`) | Alleen `SUPABASE_URL`, project-ID, **publishable key** en twee app-URL's | Geen geheim: deze waarden zitten sowieso in de app. Geen servicesleutel. |
| Patronen: servicesleutels (JWT met `service_role`), `sb_secret_`, Stripe, AWS, GitHub, Slack, Google, OpenAI/Anthropic, Resend, VAPID, privésleutels, wachtwoorden | Alleen de verzonnen testsleutel `sb_secret_nep_alleen_lokaal` | Veilig |
| E-mailadressen in bestanden | Eén: jouw eigen adres in een Lovable-migratie die jou eigenaar maakt (al op GitHub) | Aanvaardbaar zolang de repository privé blijft |
| Auteurs | gpt-engineer-app[bot], Lovable, jouw account; Claude via `Co-Authored-By` | — |

## 6. Mijlpalen (realistisch, als de beslissingen deze week vallen)
| Week | Mijlpaal | Wat jij doet | Wat ik doe |
|---|---|---|---|
| 1 | Beslissingen + online | Beslissingen 1, 2, 11, 22, 24/25; staging aanmaken; D-U-N-S/accounts starten | Push (na akkoord), CI groen, staging inrichten, schema vergelijken |
| 2 | Staging compleet | Akkoord per migratie | Migraties en testsuite op staging; 2FA oefenen; iOS-project, iconen, offline-scherm |
| 3 | Eerste testers | 2 iPhones + 2 Android; testers kiezen | TestFlight en een gesloten Play-test; bugs oplossen |
| 4 | Begeleide test (5–8 mensen) | Feedback lezen | Fixes, push (B1), storemateriaal |
| 5 | Juridisch en store | Jurist; artikels nalezen | Privacylabels, Data safety, screenshots, storeteksten |
| 6 | Indienen | Schriftelijk releaseakkoord | Migraties naar productie (na back-up), 2FA aan, indienen |

**Grootste vertraging:** de ontwikkelaarsaccounts (D-U-N-S tot 30 dagen) en staging. Die hangen allebei van jou af. Als ze deze week starten, is ± 6 weken haalbaar.
