# Persona-testverslag: A-tot-Z productacceptatie

Stand 2026-11-11, branch `v2/dev`.

## 0. Eerlijk vooraf
- **Gesimuleerd, geen echte gebruikers.** Zes persona's zijn nagespeeld met echte klikken en typen in Chromium (Playwright), tegen de lokale nep-Supabase met fictieve gegevens. **Geen echt toestel, geen echte schermlezer, geen echte databank.**
- **Wat de nep-Supabase níét kan:**
  - **RLS:** elke sessie leest alles, dus rechten tussen gebruikers en gezinnen zijn niet testbaar.
  - **Realtime.**
  - **AI:** import en foto inlezen.
  - **Opslag:** eigen foto's.
  - **E-mail en push.**
- **Snelheid is niet beoordeeld:** de dev-server compileert pagina's bij het eerste bezoek, en dat zegt niets over productie.
- **Instrument:** `tests/e2e/audit-persona-az.spec.ts`, uitgevoerd met `AUDIT=1 npx playwright test tests/e2e/audit-persona-az.spec.ts --project=mobiel-390`. Resultaat: 9 tests, exitcode 0, 70 vastgelegde stappen.
  - Een "mislukte" stap is een bevinding, geen testfout.
  - Elke mislukte stap is daarna met de schermafdruk nagekeken. Waar het aan mijn testscript lag, staat dat erbij.
  - De schermafdrukken staan lokaal in `docs/foodloapp-v2/audit/persona-az/` (niet in git).

**Legende:**
- ✅ uitgevoerd en geslaagd;
- ⚠️ werkt, maar met een UX-probleem;
- ❌ ontbreekt of faalt;
- 🧪 gesimuleerd of niet eenduidig;
- 🔒 niet uitvoerbaar in de lokale demo (extern of staging).

## 1. Score per persona (1–10, kritisch)
| Persona | Gemak | Visueel | Navigatie | Toegankelijkheid | Volledigheid | Vertrouwen | **Totaal** | Zou terugkomen? |
|---|---|---|---|---|---|---|---|---|
| A. Jongvolwassene 18–25 | 7 | 7 | 7 | 8 | 3 | 7 | **5,5** | Twijfel: geen sociale laag, geen creators, Ontdek is klein |
| B. 70 jaar | 7 | 7 | 7 | 7 | 7 | 7 | **7** | Ja, voor plannen en lijst, als iemand het de eerste keer toont |
| C. Food creator | 6 | 7 | 6 | 8 | 1 | 6 | **2,5** | Nee: niets om een publiek op te bouwen |
| D. Druk gezin | 6 | 7 | 6 | 7 | 4 | 5 | **5** | Mogelijk; niet aantoonbaar zonder realtime en RLS op staging |
| E. Beginner, budget | 7 | 7 | 7 | 8 | 5 | 7 | **6** | Ja voor de lijst; mist budget en "wat kan ik koken" voor beginners |
| F. Hobbykok | 7 | 8 | 6 | 8 | 6 | 7 | **6,5** | Ja; mist eigen collecties, en bewerken zit verstopt |

Snelheid en responsiviteit: **niet gescoord** (dev-server in emulatie). Toegankelijkheid gemeten met axe: 0 ernstige meldingen in elke gemeten stap, geen zijscroll.

## 2. Score per module
| Module | Score | Onderbouwing |
|---|---|---|
| Vandaag | 7,5 | Volgende stap altijd duidelijk ("Nog nodig: boter … → Zet op mijn lijst / Start koken"). Lege staat geeft één heldere actie. Op 200 % tekst neemt de foto het halve scherm in en schuift de actie onder de vouw |
| Week | 7 | Plannen werkt en is in alle modules consistent (reis-test). Geen "wie kookt" of taken voor het gezin |
| Lijst + winkelmodus | 8 | Sterkste module: tegels, afdelingen, ongedaan maken, "toegevoegd door Marie", vasthouden bij dubbel tikken (geen dubbele items) |
| Voorraad | 6,5 | Toevoegen in vrije tekst werkt. "-5 kg rijst" wordt stil 5 kg (geen melding) |
| Keuken (recepten) | 7 | Porties herschalen werkt (4 → 1: 100 g spaghetti, "0 van 6 in huis"). Zoeken niet fouttolerant ("stofvlees" vindt niets). Bewerken alleen via "…". Collecties niet zelf te maken |
| Kookmodus | 7,5 | Werkt op tablet. Groot en rustig |
| Ontdek | 5 | Mooi (thema's met fotocollage), maar een samengestelde bibliotheek zonder bron of creator, en zonder sociale laag. Leeg voor nieuwe accounts zonder inspiratiedata |
| Gezin en vrienden | 5 | Gezin bekijken en uitnodigen ✅, gedeelde lijst ✅. Geen taken, geen voorkeuren per lid. Realtime en RLS 🔒 |
| Creator | 1 | Bestaat niet (CREATOR-GAP-ANALYSE.md) |
| Onboarding | 5,5 | Kort ("drie kleine keuzes") en over te slaan. Vraagt geen kookniveau, budget of allergie |
| Profiel, instellingen, account | 6,5 | Account verwijderen met "VERWIJDER" werkt en stuurt naar aanmelden; geen zichtbare bevestiging na het doorsturen (🧪). Foto's blijven staan (BUG-025) |
| Control Center | 6 | Toegankelijk en volledig voor het operationele beheer. Tabellen op de telefoon zijn niet comfortabel. Rollen en 2FA: zie BCC-audit |
| Financieel controlecentrum | 3 | Kostenscherm; geen omzetketen (BUSINESS-CONTROL-CENTER-AUDIT.md) |

## 3. Resultaten per persona
### A. Jongvolwassene (390 px)
| Stap | Resultaat |
|---|---|
| Vandaag, Ontdek, een thema openen | ✅ Mooi, warm, goede foto's |
| Bron of creator bij een Ontdek-gerecht | ❌ Geen naam, profiel of volgknop |
| Bewaren in eigen recepten | ✅ Opent het controleblad "Klopt alles?" (goed: niets gaat stil de kookboek in) |
| Keuken: collecties / recept delen | 🧪 Mijn script liep vast omdat het controleblad nog open stond; elders getest (C-04 delen ✅) |
| Eigen collectie maken | ❌ Niet mogelijk (collecties worden automatisch afgeleid) |
| Likes, reacties, feed | ❌ Bestaan niet |

**Waarom A misschien niet terugkomt:** de app ziet er premium uit, maar er is niets "sociaals" of nieuws om naar terug te keren. Dagelijks gebruik komt van plannen en de lijst, niet van inspiratie.

### B. 70 jaar (375 px, tekst 130 % en 200 %)
| Stap | Resultaat |
|---|---|
| Vandaag op 130 % en 200 % | ✅ Geen zijscroll. ⚠️ Op 200 % neemt de foto de helft van het scherm; de datum breekt over drie regels; de actieve tab "Vandaag" raakt de schermrand |
| Zoeken "stoofvlees" | ✅ |
| Zoeken met tikfout "stofvlees" | ❌ Niets gevonden, geen "Bedoelde je …?" |
| Recept openen, favoriet, terug met de browserknop | ✅ |
| Afvinken en ongedaan maken | ✅ Duidelijke knop "Ongedaan maken" |
| Leeg recept bewaren | ✅ Foutmelding zichtbaar |
| Netwerkfout bij toevoegen | 🧪 Niet eenduidig: de nagebootste storing raakte waarschijnlijk niet de juiste aanvraag. De code toont wel "Het lukte niet om dit toe te voegen. Probeer het opnieuw.", en offline gaat het naar een wachtrij |
| Hulp vinden (Meer → Rondleiding, Feedback) | ✅ |

### C. Food creator (1280 px)
Zie CREATOR-GAP-ANALYSE.md. ✅ recept invoeren en delen. ❌ bio, publiceren, publiek profiel, volgers, betaalde content, statistieken. 🔒 import (AI).

### D. Gezin, twee browsercontexten (Marie en Jan, 412 px)
| Stap | Resultaat |
|---|---|
| Marie: gezin bekijken (leden, status "Uitgenodigd", "Intrekken") | ✅ Helder |
| Marie: iemand uitnodigen | ✅ Formulier. 🔒 Versturen (e-mail) niet getest |
| Jan: gezinslijst, toevoegen, zien zonder herladen, gelijktijdig afvinken | 🧪 / 🔒 Niet eenduidig. Zonder RLS ziet Jan in de nep-Supabase **ook Marie's privélijst als de zijne** (schermafdruk D-03), en realtime bestaat niet. **Hier kan niets betrouwbaars over gezegd worden; dit moet op staging** |
| Taken toewijzen (wie kookt, wie winkelt) | ❌ Bestaat niet |
| Voorkeuren of allergieën per gezinslid | ❌ Bestaat niet |

### E. Beginner met budget, lege app (360 px)
| Stap | Resultaat |
|---|---|
| Eerste bezoek → /welkom "Even snel instellen" | ✅ |
| Onboarding vraagt kookniveau of budget | ❌ |
| Lege Vandaag, Week, Lijst, Keuken, Ontdek | ✅ Elke lege staat zegt wat je moet doen ("Bewaar eerst een recept …", "Typ wat je nodig hebt …"). ⚠️ Lege Ontdek: "De ideeënbibliotheek komt hier": eerlijk, maar teleurstellend voor een beginner die juist ideeën zoekt |
| Voorraad "6 eieren" | ✅ |
| Voorraad "-5 kg rijst" | ⚠️ Stil bewaard als 5 kg |
| Budget of prijs | ❌ Geen prijsinformatie, geen "goedkoop"-filter |
| Porties 4 → 1 | ✅ Hoeveelheden herschalen correct |
| Dubbel tikken op "Op mijn lijst" | ✅ Geen dubbele items |

### F. Hobbykok (768 en 1024 px)
| Stap | Resultaat |
|---|---|
| Titel van 100 tekens, 35 ingrediënten, 12 stappen | ✅ Geen afkapping of overloop; titel loopt netjes over drie regels |
| Bewerken | ⚠️ Alleen via het "…"-menu; geen zichtbare knop "Aanpassen" |
| Kookmodus op tablet | ✅ |
| Recept verwijderen dat in het weekmenu stond | ✅ Verdwijnt ook uit Week (geen dode verwijzing) |
| Import van foto of handgeschreven recept | 🔒 Knop aanwezig; AI niet in de demo |

### Account verwijderen (390 px)
✅ "Typ VERWIJDER" → doorgestuurd naar aanmelden. 🧪 De bevestiging werd niet gezien na het doorsturen. Foto's blijven in de opslag (BUG-025).

## 4. Moeilijke en negatieve scenario's
| Scenario | Resultaat |
|---|---|
| Lege app | ✅ Goede lege staten |
| Geen voorkeuren ingesteld | ✅ Onboarding overslaan werkt; de app blijft bruikbaar |
| Lange namen | ✅ (titel van 100 tekens, ingrediënten met een lange omschrijving) |
| Ontbrekende foto's | ✅ Getekende placeholder per categorie (F-02) |
| Geen internet | 🧪 Offline wachtrij bestaat in de code. Echte vliegtuigmodus: praktijktest |
| Dubbel tikken | ✅ Geen dubbele items |
| Fout tijdens opslaan | ✅ Foutmelding in de code (nagebootst: niet eenduidig, zie B) |
| Ongeldige invoer | ⚠️ Negatieve hoeveelheid stil omgezet |
| Gelijktijdig aanpassen van een gedeelde lijst | 🔒 Staging |
| Onvoldoende voorraad | ✅ "0 van 6 in huis"; alleen het tekort op de lijst (reis-modules-test) |
| Recept niet meer beschikbaar | ✅ Verdwijnt ook uit het weekmenu |
| Actie terugdraaien | ✅ Ongedaan maken bij afvinken, toevoegen en verwijderen |
| Account verwijderen | ✅ (met BUG-025) |

## 5. Is Foodloapp V2 klaar voor een echte gebruikerstest?
**Ja, voor een kleine, begeleide test van de kern** (5–8 mensen: persona's B, E, F en één gezin), met de focus op Vandaag → Week → Lijst → Koken. Voorwaarden:
1. op staging (echte RLS, realtime en AI), niet op productie;
2. eerst de praktijktest op toestellen (iPhone en Android, VoiceOver en TalkBack);
3. BUG-025 (foto's wissen) opgelost of de testers geïnformeerd.

**Nee, voor creators, betalende gebruikers of jongeren die een sociale app verwachten.** Die functies bestaan niet.
