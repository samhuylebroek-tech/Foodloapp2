# Mobiele architectuur
**Bron van waarheid voor:**
- de web-app en de PWA;
- Capacitor;
- de keuze tussen "website in de app" en "app meeleveren".

**Put uit:**
- `MOBIELE-STRATEGIE-IOS-ANDROID.md`;
- `MOBIEL-AUDIT-2026-11.md`;
- `MOBIEL-REDESIGN-MATRIX.md`;
- `PRAKTIJKTEST-TOESTELLEN.md`.

## 1. Huidige stand
- **Responsieve web-app:**
   - eerst ontworpen voor de telefoon (390 px, gecontroleerd tot 320 px en 200 % tekst);
   - tablet met een zijbalk;
   - desktop met een hoofdmenu.
- **PWA:**
   - manifest met share target, waarmee je recepten naar de app kan delen;
   - service worker met een cache;
   - offline wachtrij voor de lijst;
   - installatiehulp (`/installeren`).
- **Capacitor 8:**
   - `appId com.foodloapp.app`;
   - alleen een Android-project (`android/`, min SDK 24, target 36);
   - **geen iOS-project**, wel `@capacitor/ios`;
   - native bruggen voor de terugknop, deep links en het scherm aan houden (`src/lib/native.ts`).
- **De app laadt de live website** (`server.url = https://app.foodloapp.com`). Gevolgen:
   - er is geen eigen code in de app;
   - updates zijn meteen live;
   - zonder netwerk zie je een wit scherm.

## 2. Wat native pas oplost
Zie `DESIGNSYSTEEM.md` §7: rijke meldingen, betrouwbare achtergrondsynchronisatie, widgets en timers op een vergrendeld scherm.

## 3. Vergelijking: website in de app tegenover een meegeleverde app
Dit is punt 12 van ronde 2 en beslissing #22.

| Criterium | A. Website in de app (nu) | B. App meeleveren (app-shell, Capacitor met `webDir`) | C. Volledig native (Swift/Kotlin of React Native) |
|---|---|---|---|
| Werk tot de eerste versie | bijna klaar: iOS-project, iconen, offline-scherm | + 3–5 dagen:<br>- serverfuncties vanuit de app aanroepen (CORS, absolute API-URL);<br>- auth-redirects;<br>- build per release | maanden (herbouw); in strijd met "geen onnodige herbouw" |
| Updates | meteen, zonder winkelversie | schermwijzigingen vragen een nieuwe winkelversie (of een live-updatedienst, een externe kost) | winkelversie |
| Risico bij Apple (richtlijn 4.2) | **hoger**, zeker zonder native functies | lager | laagst |
| Offline | wit scherm zonder eigen opvang | nette offline-stand, de lijst werkt | goed |
| Prestaties bij het opstarten | hangt af van het netwerk | sneller (lokaal) | snelst |
| Native push | kan (plug-in), los van A of B | kan | kan |
| Onderhoud | één codebasis | één codebasis, twee buildpaden | twee codebases |
| Beveiliging | domein-allowlist, `cleartext: false` | idem, met een API-origin-check | — |

**Advies:**
1. Start de interne en gesloten test (TestFlight en Play) met **A, aangevuld met**:
   - een offline-scherm;
   - native push (opt-in);
   - deep links;
   - het scherm aan houden.
2. Doe tegelijk een **proef met B**. Één scherm (Lijst) via de app-shell tegen staging: dan weten we de echte werklast.
3. Kies vóór de publieke indiening, op basis van de testfeedback en het risico bij Apple.

C valt af: geen productwaarde die een herbouw rechtvaardigt.

## 4. Voor de lancering nodig
| # | Wat | Wie | Gate |
|---|---|---|---|
| M1 | iOS-project (Xcode, Mac) | ik, op een Mac of in de CI | — |
| M2 | Iconen en opstartscherm voor beide platformen | ik | — |
| M3 | Offline-scherm in de app | ik | — |
| M4 | Native push (APNs/FCM) met opt-in, maximaal 1 per dag | ik | #18, #23 |
| M5 | Ontwikkelaarsaccounts Apple en Google | jij (D-U-N-S tot 30 dagen) | #24, #25 |
| M6 | Echte toesteltest: 2 iPhones en 2 Android-toestellen, VoiceOver en TalkBack, grote systeemtekst | jij en ik | #26 |
| M7 | Storemateriaal, privacylabels, Data safety | ik bereid voor, de jurist leest na | #27 |
