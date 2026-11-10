# Praktijktest op echte iPhone- en Android-toestellen

Stand 2026-11-10. **Nog niet uitgevoerd.** Alle tests tot nu toe draaiden in Chromium-emulatie (Playwright) op een Mac. Dat zegt niets over Safari op iOS, echte vingers, het toetsenbord, de notch, VoiceOver of TalkBack. Dit plan maakt de eerste echte test mogelijk zonder productie of echte gegevens.

## 1. Opzet (vraagt toestemming)
De demo draait met **nepgegevens** (nep-Supabase, verzonnen gezin "Marie"). Standaard is hij alleen bereikbaar op de Mac zelf (`127.0.0.1`).

| Manier | Wat werkt | Wat niet | Toestemming |
|---|---|---|---|
| **A. Thuisnetwerk via HTTP** (`DEMO_LAN=1 bun run demo`) | Indeling, tikken, scrollen, toetsenbord, onderbladen, winkelmodus, VoiceOver/TalkBack, tekstgrootte | Installeren als app (PWA), camera/barcodescanner, pushmeldingen en Wake Lock. Die vereisen HTTPS ("secure context") | **Ja: netwerktoegang activeren.** Nog niet gedaan |
| B. Thuisnetwerk via HTTPS (zelfondertekend certificaat, bv. `mkcert`) | Alles van A plus camera, PWA en Wake Lock | iOS vraagt het certificaatprofiel handmatig te vertrouwen | Ja: netwerk plus een lokaal certificaat installeren op de toestellen |
| C. Tunnel (Cloudflare Tunnel, ngrok, …) | Alles, ook buitenshuis | Demo staat op het internet, via een externe dienst | Ja; niet aanbevolen |
| D. Preview-deployment | Alles | Is een deployment | Ja; valt onder "geen deployment zonder toestemming" |

**Advies:** begin met **A** voor de grote ronde, en doe **B** daarna alleen voor camera en installeren.

### Manier A (pas na jouw akkoord)
1. Mac en telefoons op **hetzelfde vertrouwde wifi-netwerk** (thuis, niet publiek of op het werk).
2. Stop een draaiende demo. Start dan `DEMO_LAN=1 npx --yes bun@1.4.3 run demo`.
   - Het script kiest zelf het privé-adres van de Mac (bv. `192.168.1.23`) en toont de URL.
   - Bij een publiek adres of geen adres stopt het.
3. macOS vraagt mogelijk of "node" binnenkomende verbindingen mag aanvaarden: kies **Sta toe**, alleen voor de duur van de test.
4. Open op de telefoon `http://<adres>:4319`. Meld aan met `demo@foodlo.be` / `demo1234`.
5. **Achteraf:**
   - stop met Ctrl+C;
   - draai eventueel de firewall-toestemming terug in Systeeminstellingen → Netwerk → Firewall.

**Risico's van A:**
- Iedereen op hetzelfde netwerk kan de demo openen, inclusief de testknoppen van de nep-Supabase (`/__reset`).
- Er staan alleen verzonnen gegevens in. Er is geen verbinding met productie en geen echte sleutel: de service-sleutel is een nepwaarde.
- Verkeer is onversleuteld (HTTP).

## 2. Toestellen (minimum)
| Toestel | Waarom |
|---|---|
| iPhone SE (2e/3e gen, 375 px) of iPhone 12/13 mini | Kleinste gangbare iPhone |
| iPhone 14/15 (390–393 px), Safari | Meest gebruikte breedte; Dynamic Island en veilige zones |
| Android middenklasse (Samsung A-reeks, 360–412 px), Chrome | Meest gebruikte Android; ander toetsenbord en terugknop |
| Optioneel: iPad (768+ px), Android met grote tekst | Tablet-indeling, schaal 130–200 % |

## 3. Testscript (± 45 minuten per toestel)
Noteer per stap ✅ / ⚠️ / ❌, met een schermafdruk bij elke ⚠️ of ❌.

**Basis**
1. Aanmelden, rondleiding, Vandaag. Is de tekst leesbaar zonder in te zoomen? Valt er niets onder de notch of de onderbalk?
2. Draai het toestel (staand ↔ liggend). Blijft de indeling heel?
3. Systeemtekst op de grootste stand (iOS: Toegankelijkheid → Grotere tekst; Android: Lettergrootte). Breekt er iets af of loopt er iets over?

**Gebruikersreis** (zelfde stappen als `tests/e2e/reis-modules.spec.ts`)

4. Voorraad (Keuken → Voorraad): "100 g parmezaan" toevoegen. Doet het toetsenbord de knop niet verdwijnen?
5. Vandaag: "Kook … vanavond". Komt er een melding met "Ongedaan maken", en is die tikbaar?
6. Week: het gerecht staat op vandaag.
   - Kleeft de weekband bij het scrollen?
   - Werkt vegen tussen de dagen?
7. Lijst: product toevoegen via het invoerveld en via "Producten kiezen" (tegels). Vegen, afvinken, ongedaan maken.
8. "Ik ga winkelen":
   - Blijft het scherm aan? (Wake Lock: niet verwacht bij HTTP.)
   - Is alles met één hand bereikbaar?
   - Werkt "niet gevonden → vervangen"?
   - Werkt "Klaar met winkelen"?
9. Vandaag → "Start koken":
   - stap voor stap door de kookmodus, met een timer;
   - scherm vergrendelen en ontgrendelen: loopt de timer verder?
   - "Klaar met koken", dan "Voorraad bijgewerkt".
10. Ontdek: scrollen door de rijen. Haakt het horizontaal vegen niet in het verticaal scrollen?

**Randgevallen**

11. Vliegtuigmodus tijdens het afvinken in de winkel, daarna weer online. Is er niets verloren (offline wachtrij)?
12. Terug-gebaar (iOS: van links vegen; Android: terugknop) in een onderblad en in de kookmodus. Sluit het het blad, zonder de app te verlaten?
13. Profiel en beheer: Meer → Instellingen, Gezin, Meldingen. Beheer alleen als eigenaar: in de demo is dat niet mogelijk zonder de testaanmelding. Beheer is in Chromium getest.

## 4. Wat er al automatisch getest is (en wat dat níét dekt)
- **Gedekt in Chromium:**
  - breedtes 320–1280;
  - tekst op 130 %;
  - tikdoelen;
  - horizontaal scrollen;
  - axe (WCAG 2.2 A/AA, ernstig en kritiek);
  - de reis door alle modules.
- **Niet gedekt:**
  - Safari/WebKit (er draait geen WebKit-project; dat is mogelijk via `npx playwright install webkit`, gratis, maar nog niet gedaan);
  - echte aanraking en traagheid;
  - het systeemtoetsenbord dat het scherm verkleint;
  - echte schermlezers;
  - batterij en Wake Lock;
  - PWA-installatie;
  - camera.

## 5. Verslag
Leg de resultaten vast in `docs/foodloapp-v2/PRAKTIJKTEST-<datum>.md`:
- een tabel per toestel met de stappen 1–13;
- elke ❌ als BUG in `BUG-REGISTER.md`, met toestel, OS-versie, browser en schermafdruk.
