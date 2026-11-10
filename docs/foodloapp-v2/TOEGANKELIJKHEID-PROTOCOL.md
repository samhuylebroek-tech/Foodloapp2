# Toegankelijkheid — automatische stand en protocol voor een echte schermlezer

Stand 2026-11-10.

## 1. Eerlijk vooraf
**Er is nog niet met een echte schermlezer getest.** Ik kan VoiceOver of TalkBack niet bedienen of beluisteren. Wat hieronder "getest" heet, is automatisch getest:

- **axe-core in Chromium** (WCAG 2.2 A en AA, regels met impact "ernstig" of "kritiek");
- **eigen metingen:** tikdoelen, horizontaal scrollen, tekst die overloopt of wordt weggeknipt, tekst op 130 %;
- **Playwright-zoekopdrachten op rol en naam** (`getByRole`). Die falen als een knop of veld geen toegankelijke naam heeft, wat schermlezergedrag deels nabootst.

axe vindt naar schatting 30–50 % van de WCAG-problemen. Volgorde van voorlezen, begrijpelijkheid van labels, focus na een actie en gebaren vragen een mens met een echte schermlezer.

## 2. Automatische stand (gemeten 2026-11-10, zie MOBIEL-AUDIT §9 voor de commit)
| Onderdeel | Hoe | Resultaat |
|---|---|---|
| 19 gebruikersschermen | `mobiel-breedtes.spec.ts`: axe op 390 px, geen zijscroll op 360–430 px, doelen ≥ 24 px | Groen in de vorige regressie; zie de nieuwe regressie in het auditrapport |
| 29 beheerschermen | `a11y-volledig.spec.ts`: axe op 390 px, geen zijscroll op 320 en 390 px | 0 ernstige meldingen (vóór de fixes: 50) |
| Onderbladen en vensters (catalogus, lijstmenu, winkelmodus, receptformulier) en de schermen privacy en installeren | `a11y-volledig.spec.ts` | 0 ernstige meldingen |
| Tikdoelen ≥ 44 px (streefwaarde) | `audit-profiel-beheer` (AUDIT=1) | Beheer op aanraakschermen 390 px: ~450 → 4 doelen onder 44 px.<br>Profiel: 8, die op de meting na wel in orde zijn: de schakelaars zijn 56×32 px, maar hun raakvlak via `::before` is 72×48 px |
| Doelen ≥ 24 px (WCAG 2.5.8) | Idem | Gebruiker: 0. Beheer: 1 ("AI", een kolomkop van 22 px breed) |

## 3. Protocol voor VoiceOver (iPhone) en TalkBack (Android)
Duur: ± 30 minuten per toestel. Voorwaarde: de demo is bereikbaar op het toestel (zie PRAKTIJKTEST-TOESTELLEN.md, manier A; vraagt toestemming).

**Aanzetten**
- iOS: Instellingen → Toegankelijkheid → VoiceOver, of drie keer op de zijknop drukken als dat zo ingesteld is.
- Android: Instellingen → Toegankelijkheid → TalkBack.

**Per scherm** (Vandaag, Week, Lijst, Keuken, Ontdek, Winkelmodus, Kookmodus, Instellingen)

1. **Eerste focus:** wat wordt eerst voorgelezen? Verwacht: de link "Naar de inhoud", dan de paginatitel (h1).
2. **Rotor/koppen** (iOS: rotor op "Koppen"; Android: navigatie per kop). Is er één h1 en geven de h2's de structuur weer?
3. **Vegen door alles.** Heeft elk element een begrijpelijke naam? Let op:
   - pictogramknoppen ("Meer", "Nieuw", ✕);
   - tegels in de catalogus ("melk toevoegen", "melk: staat op je lijst, tik om weg te halen");
   - schakelaars (Meldingen);
   - de Nu-kaart.
4. **Actie en terugkoppeling.** Een product afvinken: wordt de melding "Ongedaan maken" voorgelezen (live region van sonner), en is die met een dubbeltik te bereiken?
5. **Onderbladen** (Producten kiezen, Meer opties):
   - gaat de focus erin?
   - blijft ze erin?
   - komt ze na sluiten terug op de knop die het blad opende?
6. **Formulieren** (receptformulier, voorraad toevoegen): worden labels voorgelezen, en foutmeldingen ook?
7. **Kookmodus:**
   - worden de stap en het stapnummer voorgelezen?
   - is de timer bedienbaar?
   - wordt het einde van de timer gemeld?
8. **Grote tekst samen met de schermlezer:** geen overlappende of onzichtbare elementen.

**Verslag:** per scherm ✅/⚠️/❌, met de voorgelezen tekst letterlijk genoteerd bij elke ⚠️/❌. Leg dit vast als BUG in `BUG-REGISTER.md`, met toestel en OS-versie.

## 4. Bekende beperkingen (niet automatisch op te lossen)
- **Beheer:**
  - tabellen zijn op de telefoon horizontaal scrollbaar binnen een gelabelde regio. Dat is bruikbaar, maar niet comfortabel. Een kaartweergave per rij zou beter zijn; dat is ontwerpwerk.
  - de grafiekbalken op "UI-overzicht" zijn nu alleen beeld. De cijfers staan in het dagoverzicht eronder.
- **Kolomkop "AI"** in beheer is 22 px breed op aanraakschermen. Dat voldoet aan 2.5.8 dankzij de uitzondering voor ruimte rond het doel, maar ligt onder de streefwaarde.
