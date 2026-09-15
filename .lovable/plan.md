# Slimme meldingen en herinneringen

Eén centraal meldingssysteem in Foodlo: de gebruiker kiest zelf wat hij wil ontvangen, en Foodlo stuurt alleen een melding als die echt nuttig is.

## Wat de gebruiker krijgt

**Vijf soorten meldingen**, elk apart aan of uit te zetten:

| Melding | Standaard | Instelbaar |
| --- | --- | --- |
| Menu van vandaag | Aan, 10:00 | Tijd, welke momenten van de dag |
| Weekmenu plannen | Aan, zondag 10:00 | Dag en tijd |
| Maaltijd komt eraan | Aan, 60 min vooraf | Hoeveel tijd vooraf |
| Boodschappen | Aan | Tijd |
| Tijd om te koken | Aan | Tijd vooraf |

**Nooit spam.** Er gaat niets uit als er niets te melden valt: geen weekmenu-herinnering wanneer de week al gepland is, geen menu-melding zonder gepland gerecht, geen boodschappen-melding zonder lijst. Valt er meer dan één melding op hetzelfde moment, dan worden ze samengevoegd tot één bericht. Per soort maximaal één melding per dag.

**Persoonlijk.** De tekst gebruikt echte gegevens: "Vanavond: Romige knoflookpasta 🍝" in plaats van een algemene zin. Geen credits, geen AI — alles komt uit de eigen gegevens.

**Tikken opent de juiste pagina**: menu → weekmenu, planning → weekmenu, boodschappen → boodschappenlijst, maaltijd → het recept, koken → kookstand van dat recept.

**Privacy.** Er is een schakelaar "Toon gerechtnaam op vergrendelscherm". Staat die uit, dan toont de melding alleen "Foodlo — je menu staat klaar". Toestemming wordt pas gevraagd op het moment dat de gebruiker zelf op "Meldingen instellen" tikt. Uitzetten kan altijd en wist ook het toestel uit de lijst.

## Waar het zit

- **Onboarding**: nieuwe laatste stap "Blijf op schema" met de vier voorbeelden, en de twee knoppen "Meldingen instellen" en "Later".
- **Instellingen → Meldingen**: nieuwe pagina met alle schakelaars, tijden en dagkeuze, met de tijd- en dagkiezers van de telefoon zelf. Plus een knop "Testmelding sturen".
- **Control Center → Meldingen**: aantallen per soort, hoeveel gebruikers aan staan, opt-in-percentage, afleverpercentage, mislukte verzendingen en hoe vaak er getikt wordt. Globale standaardwaarden zijn daar aan te passen.

## Talen en tijdzone

Meldingsteksten staan vast vertaald in het Nederlands, Engels, Frans en Duits (andere talen vallen terug op Engels) — vertalen kost dus niets. De tijdzone van het toestel wordt bij elk bezoek bewaard, dus bij reizen schuiven de meldingen automatisch mee.

## Technische aanpak

**Aflevering.** Web Push met eigen VAPID-sleutelpaar (privésleutel als projectsecret, publieke sleutel in de client). Werkt op Android/Chrome en op iOS 16.4+ zodra Foodlo op het beginscherm staat. Verzenden gebeurt op de server met een WebCrypto-implementatie van RFC 8291/8292 (workerd-compatibel; geen Node-only `web-push`).

**Nieuwe tabellen** (RLS + GRANTs, alles op `auth.uid()`):
- `notification_preferences` — per gebruiker: per soort aan/uit, tijd, dag, minuten vooraf, tijdzone, `lockscreen_details`, `onboarding_gezien`.
- `push_subscriptions` — endpoint (uniek), p256dh, auth, user-agent, `last_ok_at`, `fail_count`.
- `notification_log` — soort, titel/body, doel-URL, status (queued/sent/failed/clicked), foutcode, `dedupe_key` uniek per gebruiker+soort+dag.
- `notification_defaults` — globale standaardwaarden voor het Control Center.

**Planner.** `pg_cron` roept elk kwartier `/api/public/notifications/run` aan met een gedeeld geheim in de header. Per kwartier: gebruikers ophalen met een actief abonnement, per gebruiker in diens eigen tijdzone bepalen welke soorten nu vallen, de slimme regels toepassen tegen `meal_plan`, `recipes` en `shopping_items`, samenvoegen, dedupliceren via `dedupe_key` en versturen. Vier keer per uur is de kleinste cadans die 15-minutennauwkeurigheid geeft over alle tijdzones; dat betekent wel een terugkerende (kleine) databasekost, ook als er niets te sturen is.

**Service worker** (`public/sw.js`) krijgt `push`- en `notificationclick`-handlers erbij; bestaande offline-cache blijft ongewijzigd. Cachenaam bumpen zodat toestellen de nieuwe versie oppikken.

**Client.** Eén `src/lib/meldingen.ts` (toestemming vragen, abonneren/afmelden, tijdzone bewaren) plus `src/lib/meldingen.functions.ts` (server: voorkeuren lezen/schrijven, abonnement opslaan, testmelding). Geen tweede meldingssysteem: onboarding, instellingen en Control Center gebruiken allemaal deze laag.

**Opruimen.** Endpoints die 404/410 teruggeven worden meteen verwijderd; drie mislukkingen op rij zet een abonnement uit.
