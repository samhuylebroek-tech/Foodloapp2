# Productvisie V2: Foodloapp, je persoonlijke kookassistent

> Samengevat in [`docs/foodlo/MASTER_PRODUCT_VISION.md`](../foodlo/MASTER_PRODUCT_VISION.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Stand 2026-11-11. **VOORSTEL ter goedkeuring van de eigenaar.** Bouwt voort op:
- [PRODUCT-HERONTWERP.md](PRODUCT-HERONTWERP.md): vijf plekken, huishouden, volgende-actie-kaart;
- [PRODUCTRONDE-2026-11-11.md](PRODUCTRONDE-2026-11-11.md): wat al gebouwd is.

Er wordt niets vervangen dat al werkt.

## 1. In één zin
Foodloapp denkt mee over wat je eet: van "wat kan ik vanavond koken?" tot een gevulde weekplanning, een correcte boodschappenlijst en een voorraad die niet verloren gaat. Persoonlijk, uitlegbaar en altijd onder jouw controle.

## 2. Van receptenapp naar kookassistent
| V1 (receptenapp) | V2 (kookassistent) |
|---|---|
| Je zoekt en bewaart recepten | Foodloapp stelt voor wat nú past (dag, uur, weer, seizoen, voorraad, voorkeuren) en zegt waarom |
| Losse schermen: recepten, planner, lijst, voorraad | Eén kringloop: ontdekken → plannen → lijst → winkelen → voorraad → koken → leren |
| Jij moet onthouden wat je in huis hebt | Voorraad wordt bijgewerkt door winkelen en koken; wat bijna op moet, komt eerst |
| Uitleg = zelf uitzoeken | Kennismaking, rondleiding, eerste stappen en Help Center (gebouwd) |
| Gezin = gedeelde lijst | Huishouden met mee-eters, voorkeuren en allergieën per persoon (privacy eerst) |

## 3. Voor wie (persona's, zie PERSONA-TESTVERSLAG)
- **Druk gezin:** weinig tijd op weekdagen, kinderen met eigen smaak.
- **Beginnende kok:** wil eenvoudige stappen en geen verspilling.
- **Ervaren thuiskok:** wil inspiratie en variatie, en houdt de controle.
- **Senior:** grote tekst, rust, weinig knoppen.
- **Iemand met een allergie of dieet:** wil zekerheid zonder uitgesloten te worden.

## 4. Productprincipes (vast)
1. **De gebruiker beslist.** Foodloapp stelt voor en doet nooit vanzelf iets belangrijks: geen automatische bestellingen, geen menu dat vanzelf verandert, geen meldingen zonder toestemming.
2. **Uitlegbaar.** Elk voorstel heeft een korte reden ("Omdat het koud is en je pompoen in huis hebt").
3. **Eerst regels, dan AI.** Betrouwbare, testbare logica als basis. Generatieve AI alleen waar ze aantoonbaar meer waarde geeft, met een budget en zonder gezondheidsgegevens.
4. **Privacy als ontwerpkeuze.** Gezondheidsgegevens (allergieën, dieet) blijven op het toestel tot er een goedgekeurd, beveiligd alternatief is (voorstellen 0004 en 0005).
5. **Mobiel eerst.** iPhone en Android zijn de hoofdplatformen. Desktop ondersteunt.
6. **Eén samenhangende ervaring.** Elke nieuwe functie verschijnt op de bestaande plekken (Vandaag, Week, Lijst, Keuken, Ontdek), niet als losse module.
7. **Niets verzinnen.** Geen verzonnen cijfers, knoppen of functies (Content Manager-controle).
8. **Behoud wat werkt.** Bestaande functies, het design system en de V1-continuïteit blijven.

## 5. De vijf pijlers
1. **Kringloop** (bestaat, sterk): weekmenu ↔ lijst ↔ voorraad ↔ koken.
2. **Foodloapp Intelligence** (nieuw, voorstel): context, voorkeuren en geschiedenis leiden tot uitlegbare voorstellen. Zie FOODLOAPP-INTELLIGENCE-ARCHITECTUUR.
3. **Huishouden** (deels): samen plannen, mee-eters, voorkeuren per persoon.
4. **Begeleiding** (gebouwd): onboarding, Help Center, tutorials.
5. **Ontdekken en creators** (later): ideeën, en daarna creators. Betalingen pas na een aparte beslissing.

## 6. Wat Foodloapp níét wordt (eerste lancering)
- Geen boodschappen bestellen of koppelen aan winkels.
- Geen medisch of voedingsadvies. Allergiewaarschuwingen zijn hulp, geen garantie.
- Geen sociaal netwerk.
- Geen betalingen of creatorvergoedingen.
- Geen generatieve AI die vrij tekst schrijft over gezondheid.

## 7. Positionering
"De kookassistent die met je meedenkt, zonder je over te nemen." Voor België en Nederland eerst (Nederlandstalig, Belgische maten en winkels), daarna andere talen (de vertaalbasis bestaat).

## 8. Succes meten (voorstel, alleen met toestemming en zonder persoonsprofilering in rapporten)
- **Activatie:** binnen 7 dagen een recept gepland en de lijst gebruikt (eerste stappen).
- **Gewoonte:** in week 4 nog actief, en een weekmenu met minstens 3 maaltijden.
- **Waarde van voorstellen:** aandeel aanvaarde voorstellen, en "niet nu" of "nooit".
- **Minder verspilling:** voorraadproducten die gebruikt werden voor ze weg moesten (zelfgerapporteerd of via de voorraad).
