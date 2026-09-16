# Mail bij nieuwe gebruikers + periodekeuze in het controlecentrum

## 1. Mail naar sam@5all.com bij elk nieuw profiel

Elke keer dat iemand een profiel aanmaakt, krijg jij een kort mailtje op sam@5all.com met:
naam, @naam, e-mailadres, taal, aanmeldmoment en een directe link naar het profiel in het
controlecentrum.

Voorwaarde: er is nog geen afzenderdomein ingesteld voor dit project. Zonder eigen
afzenderdomein kan de app geen mail versturen. Je hebt foodloapp.com, dus na goedkeuring
open ik eerst het instelscherm om dat domein als afzender te koppelen (paar DNS-regels bij
je domeinbeheerder). Zodra dat geverifieerd is, vertrekken de mails automatisch.

Extra instelbaar in het controlecentrum (Instellingen): aan/uit zetten en het
ontvangstadres wijzigen, zodat je later niet vastzit aan één adres.

## 2. Dag / Week / Maand / Jaar werkt maar half

Nagekeken in het dashboard: de knoppen reageren wel, maar ze veranderen alleen het onderste
blok "Gebruikersactiviteit". Het bovenste blok blijft altijd "Vandaag", en "Recente
activiteit" en "Kosten" blijven ook vast staan — daardoor lijkt het alsof er niets gebeurt.
De evolutiegrafiek onderaan blijft bovendien leeg.

Wat er verandert:

- De periodekeuze stuurt de hele pagina aan. Het bovenste blok heet niet langer vast
  "Vandaag" maar volgt je keuze (Vandaag / Deze week / Deze maand / Dit jaar), net als de
  lijst met recente activiteit en het kostenblok.
- De titels boven elk blok tonen duidelijk welke periode je bekijkt.
- De evolutiegrafiek toont weer balkjes, ook wanneer een dag nul is, met leesbare labels
  onder de as.
- Dezelfde correctie op Analytics en AI & import, zodat de keuze daar ook de hele pagina
  stuurt.

## Technische details

- Nieuwe server-functie die na het aanmaken van een profiel één mail verstuurt via de
  bestaande verzendlaag (`src/lib/mail.server.ts`), uitgebreid met de Lovable-mailsjablonen
  (`sendTemplateEmail`) in plaats van de Resend-tak. Sjabloon `nieuwe-gebruiker` in
  `src/lib/email-templates/`. Idempotentiesleutel op basis van het gebruikers-id, dus nooit
  dubbele mails.
- Trigger: aanroep vanuit het bestaande registratie-/profielaanmaakpad (na succesvolle
  profielinsert), niet via een tweede systeem of extra tabel.
- Ontvanger en aan/uit als rij in de bestaande instellingentabel van het controlecentrum,
  met auditlogregel bij wijziging.
- `src/routes/beheer.index.tsx`: `periode` doorgeven aan `adminActiviteit`,
  `adminGebeurtenissen` en `adminKosten`; deze functies in
  `src/lib/monitoring.functions.ts` een periodeparameter geven die op de bestaande
  `bereikNaarDagen`-logica mapt (dag→vandaag, week→7, maand→30, jaar→365).
- Grafiekbalken in `beheer.index.tsx` en `beheer.analytics.tsx` een minimumhoogte en
  as-labels geven zodat lege periodes niet als een leeg vlak renderen.
