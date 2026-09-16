# Control Center: gebruikers- en platformmonitoring

Doel: op elk moment zien wat er in de app gebeurt, wie actief is, wie afhaakt, en wat elke gebruiker werkelijk kost in euro. Alles bovenop wat er al staat — geen tweede analyticssysteem.

## Wat er al is (en hergebruikt wordt)

- `usage_events` (gebruikershandelingen), `ai_usage` en `ai_events` (AI-oproepen), `credit_transactions` + `user_credits` (credits), `feedback` (support), `admin_audit_log` (auditspoor), `groups`/`group_members` (gezinnen), `shares` (vrienden).
- Beheerschermen met de bestaande stijl: donkere schil, kaarten, KPI's met evolutie, de Dag/Week/Maand/Jaar-kiezer.
- De meetfunctie `meet()` die vanuit de app al enkele handelingen wegschrijft.

Wat ontbreekt: echte euro-kosten per AI-oproep, een dagaggregatie zodat grafieken snel blijven, een foutenlogboek per gebruiker, en veel te weinig meetpunten in de app zelf.

## Wat ik bouw

### 1. Kosten echt meetbaar
- AI-oproepen krijgen extra velden: provider, model, tokens in/uit, beeldverwerking, aangerekende credits, **geschatte kost in euro**, duur, gelukt/mislukt, groep.
- Een instelbare prijslijst per model (€ per 1M tokens in/uit, € per beeld) in het Control Center; kosten worden bij elke oproep berekend en opgeslagen.
- Credits (gebruikersvaluta), werkelijke kost in euro en betaalde omzet blijven strikt gescheiden overal in de schermen.

### 2. Meer meetpunten, gestructureerd
Uitbreiding van de bestaande gebeurtenissen met vaste namen en een klein detailveld: aanmelden, recept openen/aanmaken/importeren, favoriet, weekmenu aanpassen, boodschappenlijst openen/afvinken, kookmodus starten, klantenkaart tonen, uitnodiging sturen/aanvaarden, melding aangetikt. Ook fouten die een gebruiker ziet worden weggeschreven (type, scherm, tijdstip, technische details).

### 3. Snelheid: dagaggregaties
Een dagelijkse samenvatting per gebruiker en per dag (actief ja/nee, sessies, handelingen, AI-oproepen, credits, kost). Dashboards lezen die samenvatting; alleen "vandaag" wordt live geteld. Een kwartiertaak vult de samenvatting aan, met bewaartermijn voor ruwe gebeurtenissen (90 dagen) en onbeperkte bewaring van de dagcijfers.

### 4. Nieuwe pagina "Activiteit"
Standaard vandaag, met keuze Vandaag / Gisteren / 7 dagen / 30 dagen / eigen periode. KPI's: nieuwe gebruikers, actieve gebruikers, aanmeldingen, sessies, nieuwe recepten, imports, weekmenu's, boodschappenlijsten, AI-oproepen, credits, kosten €, kost per actieve gebruiker. Daaronder een grafiek per dag (of per uur bij vandaag) en de volledige gebeurtenissenstroom met filters op datum, functie, type, gebruiker, groep, AI en fouten.

### 5. Segmenten en "wie heeft aandacht nodig?"
Transparante regels, instelbaar in het Control Center (geen AI): nieuw, zeer actief, actief, licht actief, inactief, afhaakrisico, veel/weinig AI, hoge/lage kost, gratis/betalend. Een dashboardblok toont de gebruikers die opvallen (niets gedaan na registratie, 7+ dagen stil, veel fouten, uitschieter in AI of kosten, veel credits zonder gebruik, open supportvraag). Klikken opent meteen het profiel.

### 6. Gebruikerslijst als vergelijkingstabel
Kolommen: gebruiker, laatste aanmelding, activiteitsniveau, AI-oproepen, credits gebruikt, werkelijke kost €, recepten, weekmenu's, sessies. Sorteerbaar en filterbaar (hoogste kost, meeste/minste activiteit, meeste AI, laatste aanmelding, oudste zonder activiteit).

### 7. Gebruikersdetailpagina met tabbladen
Overzicht, Activiteit, Recepten, Weekmenu, Boodschappen, Connecties, AI & credits, Meldingen, Support, Beveiliging. Bovenaan: laatste aanmelding, accountleeftijd, activiteitsniveau, totale kost €, credits, AI-oproepen, recepten, weekmenu's, connecties, plus een activiteitsgrafiek. Het tabblad Activiteit is een volledige tijdlijn met per regel tijdstip, wat er gebeurde en waar van toepassing kost en credits.

### 8. Groepen
Nieuw overzicht per gezin: aantal leden, actieve leden, laatste activiteit, gedeelde recepten/weekmenu's/lijsten, AI-gebruik, credits en totale kost.

### 9. Dashboard herwerkt
Bovenaan "Vandaag" met de belangrijkste cijfers, daaronder recente activiteit (live bijgewerkt), kosten, gebruikersactiviteit en het aandachtsblok. Huidige stijl blijft.

### 10. Export
CSV-export van gebruikers, activiteit, AI-gebruik, credits, kosten en groepen — via de bestaande exportknoppen in dezelfde stijl.

### 11. Communicatie (basis)
Nieuwe sectie "Communicatie": ontvangers kiezen (één gebruiker, een gezin, een segment of iedereen), onderwerp, bericht, voorbeeld, versturen, verzendstatus en auditspoor. Een verzendlaag met verwisselbare aanbieder; zolang er geen e-mailaanbieder gekoppeld is, worden berichten als bericht in de app afgeleverd en staat de mailweg klaar. Vanuit een profiel kan je direct "Contacteer gebruiker" en verzonden berichten verschijnen in de tijdlijn.

### 12. Privacy en beveiliging
Alles admin-only en server-side afgeschermd via de bestaande rollen; elke inzage en actie gaat in het auditlogboek. Geen wachtwoorden, tokens of gevoelige aanmeldgegevens. Alleen noodzakelijke gegevens, duidelijke bewaartermijnen, en bij verwijdering van een account worden gebeurtenissen losgekoppeld van de persoon.

## Technisch

- Migraties (additief): kolommen op `ai_usage` (provider, tokens_in, tokens_out, beelden, kost_eur, group_id, latency, error_code); nieuwe tabellen `app_errors`, `daily_user_stats`, `daily_platform_stats`, `model_prices`, `admin_messages`; instellingen voor segmentdrempels in `platform_settings`; indexen op (user_id, created_at) voor `usage_events`, `ai_usage`, `app_errors`; GRANTs + RLS (alleen eigen inserts, admin-lees via beveiligde functies).
- Server-side: nieuw `src/lib/monitoring.functions.ts` (activiteit, segmenten, aandacht, kosten, groepen, tijdlijn, export) en `src/lib/mail.server.ts` (aanbieder-abstractie). Bestaande `admin.functions.ts` wordt uitgebreid, niet vervangen; `adminGebruikers`/`adminGebruikerDetail` krijgen de nieuwe cijfers.
- Aggregatie via de bestaande kwartiertaak (`/api/public/...`) met dezelfde cron-sleutel.
- Meten: `src/lib/meten.ts` krijgt vaste gebeurtenisnamen plus detailveld; aanroepen toegevoegd op de bestaande schermen.
- Schermen: `beheer.activiteit.tsx`, `beheer.groepen.tsx`, `beheer.communicatie.tsx`, herwerkte `beheer.index.tsx`, `beheer.gebruikers.tsx` en een detailpagina `beheer.gebruikers.$id.tsx`, met de bestaande AdminShell-componenten.

## Buiten scope
Marketingautomatisering, A/B-tests, en het effectief koppelen van een e-mailaanbieder (architectuur wordt wel klaargezet).
