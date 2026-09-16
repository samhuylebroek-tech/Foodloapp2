# Foodlo afwerken: audit en plan

Ik heb de app eerst nagekeken. Het grootste deel van je lijst staat er al en werkt: accounts en aanmelden, recepten met foto's, import van websites en sociale media, AI met credits, voedingswaarden, weekmenu, boodschappenlijst, klantenkaarten, vrienden en gezin met rechten per onderdeel, meldingen, kookstand, onboarding en het controlecentrum. Dat blijft ongewijzigd — ik bouw niets opnieuw.

Hieronder staat alleen wat er echt nog ontbreekt of beter kan.

## 1. Twee adressen netjes scheiden (app en website)

- De app-adressen komen op één centrale plek te staan en zijn instelbaar, zodat app.foodlo.be en www.foodlo.be later gewoon ingevuld worden zonder de code te veranderen.
- In "Meer" komen links naar de website: Over Foodlo, Contact, Privacy, Voorwaarden — die openen de marketingwebsite.
- Deellinks, uitnodigingen en e-mails gebruiken voortaan altijd het app-adres, nooit dat van de website.

## 2. Beginscherm-installatie waterdicht

- Extra app-icoon in 192 px toevoegen naast het bestaande van 512 px (sommige Android-toestellen vragen daarnaar).
- Het icoon opent altijd de app zelf, nooit de website.
- De uitleg "Zet Foodlo op je beginscherm" bestaat al op een aparte pagina; ik toon ze voortaan ook één keer zachtjes onderaan in de app voor wie de app nog niet geïnstalleerd heeft, met aparte uitleg voor iPhone en Android, en met "Later" die ze wegzet.

## 3. Offline verbeteren

- De offline-opslag laat nu ook oude versies van pagina's zien. Ik zorg dat de app altijd eerst een verse versie probeert, oude opslag automatisch opruimt, en enkel terugvalt op wat bewaard is als er echt geen internet is.
- Recepten die je al bekeek, je klantenkaarten en je boodschappenlijst blijven offline zichtbaar.

## 4. Voorraadkast (nieuw)

- Nieuw onderdeel waarin je bijhoudt wat je thuis hebt.
- Bij de boodschappenlijst kan je wat je al in huis hebt in één tik afvinken, en bij een recept zie je wat je nog moet kopen.

## 5. Kleine afwerking

- Bij een recept een eenvoudige geschiedenis: je ziet wanneer het laatst is aangepast en kan de vorige versie terugzetten.
- Zelf een recept exporteren en al je gegevens downloaden (privacy-verzoek van jezelf).
- Een laatste controle op grote knoppen, contrast en toetsenbordgebruik op de schermen die ik aanraak.

## Wat ik bewust niet doe

- Geen tweede systeem naast wat er al is: geen tweede gebruikerslijst, geen tweede meldingensysteem, geen tweede deelsysteem.
- Geen e-mailimport van recepten: dat vraagt een apart ontvangstadres per gebruiker en is een eigen project. Zeg het als je dit toch wil, dan plan ik het apart.
- Geen koppelingen met Carrefour, Delhaize en co: die winkels bieden daar vandaag geen open koppeling voor. De structuur ligt al klaar zodat ze later ingeplugd kunnen worden.
- Geen native app in de stores: de opbouw is er al klaar voor (alle logica zit in de server, niet in de browser).

## Technisch

- `VITE_FOODLO_APP_URL` en `VITE_FOODLO_MARKETING_URL` in `.env`, uitgelezen via `src/lib/app-url.ts`; alle bestaande gebruikers van `appOrigin()` blijven werken.
- `public/sw.js`: van cache-first naar network-first met versienaam per release en opruiming van oude caches; `/_serverFn` en `/api` blijven altijd live.
- `public/app-icon-192.png` toevoegen en registreren in `manifest.webmanifest`.
- Nieuwe tabel `pantry_items` (user_id, naam, hoeveelheid, eenheid, bijgewerkt) met RLS per gebruiker en grants; gedeeld binnen een gezin via de bestaande `has_share`-logica.
- Nieuwe tabel `recipe_versions` (recipe_id, momentopname jsonb, gewijzigd_door, tijdstip) met RLS via de bestaande receptrechten.
- Export via een serverfunctie die de bestaande tabellen uitleest; geen nieuwe opslag.
