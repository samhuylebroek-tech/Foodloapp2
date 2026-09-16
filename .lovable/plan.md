# User Intelligence in het Control Center

Een volledig doorklikbaar onderzoeksscherm: wie gebruikt Foodlo, wanneer, hoe vaak, wat deed iemand tijdens welke login, met welke kosten en fouten.

## Wat er vandaag al is (audit)

- Gebeurtenissen worden al bewaard (`usage_events`), maar met een korte vaste lijst van ~18 soorten, zonder sessie, zonder toestel, zonder app-versie, zonder resultaat (gelukt/mislukt).
- Logins zijn vandaag **geschat**: het systeem telt gaten tussen gebeurtenissen. Er bestaat geen echte sessietabel, dus "duur van een login" en "afgemeld om" zijn nu niet betrouwbaar.
- AI-gebruik, credits, fouten, dagelijkse samenvattingen, groepen en segmenten bestaan al en blijven ongewijzigd de bron.
- Er is al een gebruikersdetailpagina met tabbladen; die wordt uitgebreid, niet vervangen.

Alles hieronder bouwt verder op die bestaande tabellen. Geen tweede meetsysteem, geen dubbele data.

## Wat we bouwen

### 1. Betrouwbaar meten (basis)
- Eén centrale meetfunctie die bij elke gebeurtenis ook meestuurt: sessie, toestel, platform, browser, app-versie, onderdeel, het object waar het over gaat (recept, lijst, kaart…), of het gelukt is, en hoe lang het duurde.
- Echte sessies: bij openen van de app start een sessie; elke gebeurtenis hangt eraan vast; bij afmelden sluit ze. Sluit iemand gewoon de app, dan wordt de sessie na inactiviteit afgesloten en duidelijk gemarkeerd als "geschat einde" — nooit doen alsof we het exact weten.
- De lijst van gebeurtenissen wordt uitgebreid naar de volledige set uit je opsomming (aanmelden, recepten, koken, timers, weekmenu, boodschappen, AI, kaarten, vrienden, instellingen) en centraal beheerd.
- Fouten krijgen voortaan ook sessie, app-versie en toestel mee.
- Historische gegevens blijven gewoon zichtbaar; oudere gebeurtenissen tonen "niet beschikbaar" waar het nieuwe veld toen nog niet bestond. Nooit verzonnen waarden.

### 2. Nieuwe hoofdsectie "User Intelligence"
In de bestaande beheernavigatie, met: Overzicht, Gebruikers, Activiteit, Sessies, Gebeurtenissen, AI & kosten, Groepen, Fouten, Segmenten.

### 3. Overzicht
Periodekiezer (vandaag, gisteren, 7/30/90 dagen, eigen periode). Alle cijfers volgen de periode. Elke kaart is een knop die doorklikt naar exact die lijst: totaal/nieuw/actief/terugkerend/inactief/nooit ingelogd, ingelogd vandaag en deze week, sessies en gemiddelde duur, gebeurtenissen, recepten aangemaakt/geïmporteerd/bekeken/gekookt, boodschappenlijsten, weekmenu's, AI-acties, credits, kost in euro, fouten. Grafiekpunten werken als filter.

### 4. Eén filterbalk voor de hele sectie
Datum, gebruiker, e-mail, groep, rol, accountstatus, activiteitsstatus, laatste login, aanmelddatum, toestel, platform, browser, app-versie, onderdeel, soort gebeurtenis, recept, AI-actie/aanbieder/model, credits, kost, foutstatus, sessie, bron, importsoort. Combineerbaar, zichtbaar als chips, met wissen, opslaan als bewaarde weergave, en exporteren. Filters staan in de URL, dus een gefilterd scherm is deelbaar en de terugknop behoudt de context.

### 5. Gebruikerslijst
Krachtige tabel met kolommen voor login, laatste activiteit, sessies, actieve dagen, gebeurtenissen, recepten, AI-acties, credits, kost, fouten, groep, toestel, app-versie. Sorteerbaar en gepagineerd op de server. Elke rij opent de detailpagina. Meerdere gebruikers selecteren geeft een feitelijke vergelijking naast elkaar (geen rangschikking of oordeel).

### 6. Gebruikersdetail
Kop met alle kerngegevens en "laatst gezien" per onderdeel (login, activiteit, recepten, AI, boodschappen, weekmenu) — elk klikbaar naar het bijbehorende moment. Tabbladen: tijdlijn, sessies, recepten, AI & credits, fouten, functiegebruik, groepen, gedeelde inhoud, meldingen, support, export. Functiegebruik toont per onderdeel aantal keer, eerste en laatste gebruik, en klikt door naar exact die gebeurtenissen.

### 7. Tijdlijn, sessies en sessiedetail
Chronologische tijdlijn (nieuwste eerst) met tijd, actie, onderdeel, toestel, sessie en resultaat; doorzoekbaar en filterbaar. Sessielijst met start, einde (of geschat), duur, toestel, besturingssysteem, browser, app-versie, aantal gebeurtenissen, AI, credits, kost en fouten. Sessiedetail toont minuut per minuut wat er tijdens die ene login gebeurde.

### 8. Gebeurtenissen, activiteit, AI, credits, fouten, groepen
- Gebeurtenissenverkenner met detailpagina per gebeurtenis (inclusief technische gegevens achter "Details").
- Activiteitenstroom over alle gebruikers heen, met een lichte "recent"-verversing via de bestaande infrastructuur.
- AI-overzicht per gebruiker en per actie: aanbieder, model, tokens, credits, geschatte kost (duidelijk gelabeld als schatting), duur, status.
- Credittransacties met saldo voor/na en doorklik naar de AI-actie, de gebeurtenis en de sessie.
- Foutcentrum met doorklik naar gebruiker, sessie, gebeurtenis en app-versie.
- Groepsanalyse met leden, activiteit, gedeelde inhoud, AI en kosten.
- Dagoverzicht en uurverdeling, beide klikbaar als filter.

### 9. Segmenten en "vraagt aandacht"
Statussen (nieuw, actief, terugkerend, weinig actief, inactief, nooit ingelogd) op basis van instelbare drempels in het Control Center — geen verborgen regels. Daarnaast een objectieve signalenlijst: nooit ingelogd, geen activiteit na aanmelden, lang inactief, opvallend veel AI, herhaalde fouten, herhaalde mislukte imports.

### 10. Zoeken, exporteren, privacy
Globale zoekbalk over gebruikers, recepten, groepen, sessies, gebeurtenissen, AI-taken en fouten, gegroepeerd per soort. Exporteren van elke lijst gebeurt op de server. Alleen bevoegde beheerders zien deze sectie; het inkijken van gebruikersdetails wordt gelogd in het bestaande auditlogboek. Geen wachtwoorden, geen tokens, geen IP-adressen of locatie — toestelgegevens blijven beperkt tot soort, platform, browser en app-versie.

## Technische aanpak

- Nieuwe tabellen: `user_sessions` (sessie, gebruiker, start, laatste activiteit, einde + of dat geschat is, toestel/platform/browser/app-versie) en `admin_saved_views` (bewaarde filters). Bestaande `usage_events`, `app_errors`, `ai_usage`, `credit_transactions`, `daily_user_stats`, `daily_platform_stats`, `groups` blijven de bron; `usage_events` en `app_errors` krijgen extra kolommen (`session_id`, `feature`, `entity_type`, `entity_id`, `ok`, `duration_ms`, `device`, `platform`, `browser`, `app_version`) met indexen op `user_id`, `created_at`, `event`, `session_id`, `feature`. Alle nieuwe tabellen met GRANTs, RLS en beheerderspolicies.
- Eén meetservice in `src/lib/meten.ts` (uitgebreid, niet vervangen) plus sessiebeheer; alle bestaande `meet()`-aanroepen blijven werken.
- Server-side filteren, sorteren, pagineren en aggregeren in een nieuwe `src/lib/user-intelligence.functions.ts` bovenop de bestaande `monitoring.server.ts`-aggregaties en dagrollups; "vandaag" live, oudere periodes uit rollups.
- Nieuwe routes onder `/beheer/ui/*` (overzicht, gebruikers, gebruiker/$id + subtabs, sessies/$id, gebeurtenissen/$id, ai/$id, groepen/$id, fouten/$id) met filters in querystring en broodkruimels. Bestaande beheerpagina's blijven ongewijzigd bestaan.
- Desktop-first, maar volledig responsive: tabellen horizontaal scrollbaar, filters in een lade op klein scherm, detailpanelen schermvullend.

## Na de bouw

Zelf een volledige controle uitvoeren met de testbrowser: elke kaart klikbaar, elke rij opent detail, elke filter werkt en blijft bewaard, broodkruimels brengen je terug zonder context te verliezen, cijfers in overzicht en detail komen overeen. Gevonden problemen los ik meteen op.

## Let op

Sessies, toestellen en app-versies beginnen pas te lopen vanaf de ingebruikname; voor bestaande geschiedenis toont het scherm eerlijk "niet beschikbaar" in plaats van geschatte waarden.
