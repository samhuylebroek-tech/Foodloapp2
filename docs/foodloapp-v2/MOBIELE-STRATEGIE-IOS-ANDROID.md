# Mobiele strategie: iOS en Android (VOORSTEL)

> Samengevat in [`docs/foodlo/MOBILE_ARCHITECTURE.md`](../foodlo/MOBILE_ARCHITECTURE.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Stand 2026-11-11. **Alleen voorgesteld.** Er is niets gebouwd, ingediend of aangemaakt (geen ontwikkelaarsaccount, geen build).

## 1. Huidige technische basis (gecontroleerd in de repo)
| Onderdeel | Stand |
|---|---|
| Framework | TanStack Start (React, server-side rendering) + Lovable Cloud (Supabase) |
| Native schil | **Capacitor 8** (`@capacitor/core`, `app`, `splash-screen`, `status-bar`, `keep-awake`, `android`, `ios`) |
| `capacitor.config.ts` | `appId com.foodloapp.app`. **De app laadt de live website** (`server.url = https://app.foodloapp.com`) |
| Android-project | Aanwezig in de repo (`android/`, versionCode 1, versionName 1.0) |
| iOS-project | **Ontbreekt** (geen map `ios/`). Moet op een Mac met Xcode aangemaakt worden (`npx cap add ios`) |
| Native bruggen | `lib/native.ts`: Android-terugknop, deep links, splash, scherm aan tijdens het koken |
| Pushmeldingen | **Web push** (service worker `public/sw.js` + `webpush.server.ts`). Werkt in de browser en als geïnstalleerde PWA, **niet in een Capacitor-app** (de WebView ondersteunt Web Push niet) |
| Offline | Service worker cachet bezochte pagina's (klantenkaart offline); de boodschappenlijst heeft een offline wachtrij (BUG-037) |
| PWA | `manifest.webmanifest`, iconen 192/512, scherm "Op je telefoon zetten" |
| Toegankelijkheid en schermen | 320–430 px, 200 % tekst en toetsenbord getest in simulatie; **nooit op een echt toestel** (BUG-086/117) |

## 2. Belangrijkste risico: "alleen een website" (App Store-richtlijn 4.2)
Een app die alleen een externe website laadt, wordt door Apple vaak afgewezen onder richtlijn 4.2 (minimale functionaliteit). Ook apps met enkele native functies werden afgewezen ([Apple-forum](https://developer.apple.com/forums/thread/812889), [Capgo](https://capgo.app/blog/how-to-pass-app-store-review-2026/), [MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)).

Daarbij:
- **zonder netwerk** toont de app een foutscherm in plaats van een nette offline-stand;
- elke webwijziging komt zonder review in de app (Apple let daarop).

**Voorstel (te onderzoeken op staging, vóór de eerste indiening):**
1. **App-shell meeleveren** in plaats van `server.url`. De interface zit in de app; gegevens en serverfuncties komen van de server.
   - **Technisch onzeker:** TanStack Start rendert op de server. Een pure client-build met serverfuncties via het netwerk (CORS, authenticatie in de app) moet uitgeprobeerd worden.
   - **Inschatting:** 3–5 dagen onderzoek en aanpassing.
2. **Native meerwaarde die bij het product past:**
   - native pushmeldingen (`@capacitor/push-notifications`, APNs en FCM);
   - scherm aan tijdens het koken (bestaat);
   - offline lijst en klantenkaart (bestaat deels);
   - delen naar Foodlo vanuit andere apps (recept-link) via een share-extensie;
   - camera voor de receptfoto (bestaat via het web, native is beter);
   - haptische feedback bij afvinken;
   - widget "Vanavond" (later).
3. **Nette offline-stand:** de app opent altijd; zonder netwerk zie je Vandaag, de lijst en de kaarten uit de cache.

## 3. Pushmeldingen
| Kanaal | Stand | Nodig |
|---|---|---|
| Web push (browser/PWA) | Bestaat | Blijft voor web |
| iOS native | Ontbreekt | APNs-sleutel (bij het Apple Developer-account, geen extra kost), plugin, toestemming vragen **op het juiste moment** (niet bij de eerste opening) |
| Android native | Ontbreekt | Firebase Cloud Messaging (gratis), `POST_NOTIFICATIONS`-toestemming (Android 13+) |
| Server | Cron en voorkeuren per soort bestaan | Een tweede verzendweg naar APNs en FCM; dezelfde voorkeuren en uitknoppen |

## 4. Appwinkels: vereisten (te verifiëren bij indiening)
| Onderwerp | Apple App Store | Google Play | Stand Foodloapp |
|---|---|---|---|
| Account | Apple Developer Program ± $99 / ± €99 per jaar ([Apple](https://developer.apple.com/support/fee-waiver), [voorbeeld factuur](https://opencollective.com/actual/expenses/279604)) | Eenmalige registratie (meestal $25 vermeld; **niet bevestigd** in deze ronde) | Niet aangemaakt |
| Organisatie of persoon | Organisatie vraagt een D-U-N-S-nummer | Persoonlijke accounts (na nov. 2023) moeten eerst **12 testers gedurende 14 dagen** in een gesloten test hebben; organisatieaccounts met D-U-N-S niet ([testerscommunity](https://www.testerscommunity.com/guides/how-many-testers-do-you-need-google-play), [Choicely](https://www.choicely.com/blog/google-play-12-tester-rule)) | **Beslissing eigenaar** (aanbevolen: organisatie) |
| Account verwijderen in de app | Verplicht | Verplicht (+ webpagina) | ✅ Bestaat (Instellingen) |
| Aanmelden met Apple | Verplicht als je andere sociale aanmeldingen aanbiedt | — | Apple-aanmelding staat in de inventaris (Lovable OAuth); in de native app testen |
| Privacy | Privacylabels in App Store Connect | Formulier "Data safety" | Op te stellen uit AVG-AUDIT en de export (32 secties) |
| Privacyverklaring en voorwaarden | URL verplicht | URL verplicht | `/privacy` bestaat; juridisch nalezen |
| Leeftijdsclassificatie | Vragenlijst | Vragenlijst | Op te stellen |
| Screenshots en iconen | Per schermgrootte | Telefoon + feature graphic | Te maken (Playwright-opnames kunnen helpen) |
| Doel-API Android | — | Recente Android-API verplicht (jaarlijks verhoogd) | Bij de build controleren |
| Tracking (ATT) | Alleen bij tracking over apps heen | — | Niet nodig: geen advertentietracking |

## 5. Echte toesteltests (fase 3)
- **Script:** PRAKTIJKTEST-TOESTELLEN (± 45 min per toestel), aangevuld met:
  - kennismaking, rondleiding (10/7), eerste stappen, Help Center;
  - allergiewaarschuwing;
  - voorstellen met redenen, weer;
  - native push;
  - offline opstarten;
  - Dynamic Type en de Android-lettergrootte;
  - VoiceOver en TalkBack.
- **Minimum:**
  - 1 recente iPhone + 1 oudere of kleine (SE);
  - 1 recente Android + 1 goedkope Android met weinig geheugen.
- **Distributie naar testers:** TestFlight (iOS) en de gesloten test in Play (Android, die meteen ook de 12-testersregel invult).
- **Safari-engine automatisch testen:** kan niet op deze Mac (BUG-117). Doen op Linux-CI of macOS 15+.

## 6. Volgorde
1. Staging (STAGING-PLAN-LOVABLE-CLOUD), zonder native.
2. Technisch onderzoek: app-shell versus `server.url` (fase 1–2, parallel).
3. iOS-project aanmaken (Mac + Xcode), native push, offline-stand.
4. Interne builds: TestFlight en Play intern of gesloten.
5. Echte toesteltests en een begeleide test met 5–8 mensen.
6. Storemateriaal, privacylabels, indienen.

## 7. Wat het bestaande design system moet behouden
Dezelfde 5 plekken, kleuren en lettertypen (DESIGNSYSTEEM). De native schil voegt alleen de statusbalk, splash en de veilige zones (`safe-area`) toe; die worden al gebruikt.
