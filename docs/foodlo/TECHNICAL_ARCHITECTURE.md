# Technische architectuur
**Bron van waarheid voor:** lagen, modules, integraties en technische risico's.

**Put uit:**
- `ARCHITECTUUR-VOORSTELLEN.md`;
- `V2-IMPLEMENTATION-PLAN.md`;
- `AUDIT-STAP-A-2026-11-13.md` §3.

## 1. Huidige opbouw (gecontroleerd 2026-11-13)
| Laag | Keuze | Opmerking |
|---|---|---|
| UI | React 19, TanStack Start/Router, Vite 8, Tailwind 4, Radix | Designsysteem in `DESIGNSYSTEEM.md`; schermen in `src/routes` (85), componenten in `src/components` |
| Serverlogica | TanStack-serverfuncties (`createServerFn`) | 125 functies in 14 `*.functions.ts`; nooit geheimen naar de client; beheerfuncties achter `bewaker()` |
| Domeinlogica | Pure functies in `src/lib` | Getest met Vitest. Voorbeelden: `vandaag.ts`, `intelligentie/*`, `veiligheid.ts`, `ingredienten.ts` |
| Data | Supabase Postgres + RLS + Storage | 52 tabellen; schema-afwijking (BUG-011) |
| Auth | Supabase Auth + Lovable cloud-auth (SSO) | — |
| AI | Lovable AI-gateway via `metCredits` (credits, cache, limieten) | Zie `AI_ARCHITECTURE.md` |
| Jobs | Cron-route `api/public/meldingen.run` (meldingen) | Er is geen algemene wachtrij; imports lopen synchroon |
| Mobiel | Capacitor (Android) dat de website laadt; PWA | Zie `MOBILE_ARCHITECTURE.md` |
| Observability | `meten.ts` (gebeurtenissen zonder inhoud), foutopvang, beheerschermen | — |
| Hosting | Lovable (productie); de repo is gekoppeld aan Lovable | Nooit naar `main` pushen (G3) |

## 2. Modulegrenzen (doel, zonder herbouw)
- **Bestaande code blijft waar ze staat.** Nieuwe domeinen krijgen eigen mappen, met één publieke ingang per domein:
  - `src/lib/consument/*` (bestaand, verspreid);
  - `src/lib/huishouden/*` (F2);
  - `src/lib/creator/*` (F2);
  - `src/lib/commercieel/*` (F3);
  - `src/lib/ai/*` (privacylaag en providers; zie AI-doc).
- **Routes:**
  - consument op het hoofdniveau;
  - beheer onder `/beheer`;
  - creator onder `/maker` (F2);
  - partner-BCC als **aparte app of apart routedeel** met een eigen shell en rollen (F3).
- **Rechten:** de server controleert altijd. De interface verbergt alleen. Betaal- en commerciële schakelaars hebben een servercontrole (BUG-143).
- **Gedeelde infrastructuur** (auth, meten, foutopvang, AI-gateway, e-mail, push) zit achter interfaces, zodat het Growth OS die later kan hergebruiken zonder Foodlo-code (zie `INDUSTRY_AND_GROWTH_FUTURE.md`).

## 3. Integraties
| Integratie | Stand | Abstractie |
|---|---|---|
| Supabase | actief | `src/integrations/supabase` (gegenereerd), eigen helpers |
| Lovable (auth, AI, e-mail) | actief | AI via `metCredits`; e-mail via `mail.server.ts`, met Resend als alternatief |
| Web push (VAPID) | actief | `webpush.server.ts`, veilige endpoints (BUG-007) |
| Websearch (Brave/DDG) | actief | `zoekReceptenOpWeb` |
| Open-Meteo | code aanwezig, niet aangesloten | proxy via de server vereist (#15/#16) |
| Betaalprovider | geen | adapter in F3 (`COMMERCIAL_ROADMAP` §4) |
| Native push (APNs/FCM) | geen | F1 aanbevolen (#23) |

## 4. Technische risico's en afhankelijkheden (stap C)
| # | Risico | Gevolg | Maatregel | Afhankelijk van |
|---|---|---|---|---|
| R1 | Schema live ≠ repo (BUG-011) | Migraties kunnen onverwacht falen | Schema live vergelijken (alleen lezen), baseline-migratie | #4, staging |
| R2 | Geen staging | Niets kan veilig met echte infrastructuur getest worden | Apart Lovable-project | #1 |
| R3 | App laadt de live website | Risico op afwijzing door Apple (4.2); wit scherm zonder netwerk | Vergelijking en keuze (`MOBILE_ARCHITECTURE` §3) | #22 |
| R4 | De AI-gateway is één leverancier | Geen terugval bij storing of prijswijziging | Provider-interface (AI-doc §4); regels zonder AI blijven werken | — |
| R5 | Twee rechtensystemen (shares en gezin) | Verwarring, kans op lekken | Eén huishoudmodel (F2, #30) | 0005 |
| R6 | Tijdzoneafhankelijke tests (BUG-139/140) | Valse rode tests rond middernacht | `TZ=Europe/Brussels` in de configuratie en CI; dagtelling op de lokale datum | — |
| R7 | Import synchroon, zonder wachtrij | Trage of afgebroken imports bij grote pagina's | Limieten bestaan al (BUG-003); later een wachtrij | — |
| R8 | Lovable-sync op gepubliceerde commits | Ongewilde wijziging live | Alleen featurebranches, nooit `main` (G3) | — |
| R9 | Machinevertaling in runtime | Kost en kwaliteit | Lancering in het Nederlands; vertalingen nalezen in F2 | — |
