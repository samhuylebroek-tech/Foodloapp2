# Vrienden & Gezin: verbinden, delen en meteen zien

## Wat er nu al goed zit

De beveiliging staat er al: de databank beslist zelf wie wat mag zien. Recepten, weekmenu en boodschappen zijn enkel zichtbaar als de eigenaar dat expliciet heeft aangezet, ook als iemand met adressen zou knoeien. Gezin (huishouden) en vrienden gebruiken al dezelfde rechtenlogica. Daar bouwen we op verder — geen tweede systeem.

## Wat er misloopt

- **Geen bericht bij een uitnodiging.** Wie uitgenodigd wordt, merkt dat enkel als die toevallig de vriendenpagina opent. En wie uitnodigt hoort niets als het aanvaard wordt.
- **De lijst ververst niet vanzelf.** Aanvaardt iemand jouw uitnodiging, dan zie je dat pas na het scherm opnieuw te openen.
- **De vriendenpagina toont te weinig.** Geen foto/initialen, geen duidelijk overzicht van wat jij deelt en wat zij delen, en het openen van een vriend toont enkel gerechten — geen weekmenu of boodschappen.
- **Dubbele uitnodigingen** kunnen ontstaan; je krijgt dan een vage foutmelding.

## Wat we bouwen

### 1. Eén heldere pagina "Vrienden & gezin"

Drie duidelijke blokken in deze volgorde:

1. **Uitnodigingen voor jou** — bovenaan, met teller. Aannemen of weigeren.
2. **Mijn mensen** — elke persoon op een kaart met gekleurde initialen, naam, en het label Gezin of Vriend. Daaronder in gewone taal: "Jij deelt: recepten, weekmenu" en "Zij delen: recepten". Plus een knop "Openen".
3. **Iemand toevoegen** — zoeken op naam/@naam/e-mail, of een uitnodigingslink/QR maken. Zichtbaar "Uitgenodigd, wacht op antwoord" bij wie al gevraagd is.

### 2. Berichten bij uitnodigen en aanvaarden

- Krijg je een uitnodiging, dan komt er een bericht in de app én een pushmelding op je telefoon (als je meldingen aan hebt staan): "Sofie wil met je delen". Tikken opent meteen de uitnodiging.
- Aanvaardt iemand jou, dan krijg jij: "Sofie heeft je uitnodiging aangenomen".
- Weigeren geeft geen melding aan de andere kant (rustiger, minder pijnlijk).
- Deze berichten kosten geen credits en gebruiken geen AI.

### 3. Alles ververst meteen

De vriendenlijst luistert live mee op de databank. Aanvaardt iemand, dan verschijnt hij bij allebei binnen de seconde, zonder opnieuw aan te melden. Ook rechten die je aanpast zijn onmiddellijk zichtbaar aan beide kanten.

### 4. Profiel van een vriend

Klik je iemand aan, dan zie je bovenaan wie het is en wat die met jou deelt, met daaronder enkel wat is toegestaan:

- **Hun gerechten** (lijst, klikbaar naar het recept, met "Gedeeld door Sofie")
- **Hun weekmenu** (de week in beeld; bewerken enkel als zij dat aanzetten, anders alleen lezen)
- **Hun boodschappenlijst** (idem)
- Wat niet gedeeld is, verschijnt niet — ook niet grijs.

Onderaan: **"Wat mag Sofie zien?"** met de schakelaars, meteen actief bij het omzetten, plus "Verbinding verbreken".

### 5. Opkuis en randgevallen

- Al verbonden of al uitgenodigd → knop toont "Al vriend" of "Uitgenodigd" in plaats van een fout.
- Dubbele uitnodiging wordt in de databank tegengehouden met een vriendelijke boodschap.
- Weigeren sluit de uitnodiging netjes af en laat ze uit beide lijsten verdwijnen.
- Verbinding verbreken haalt de toegang meteen weg aan beide kanten.
- Gezinsleden blijven via de gezinspagina beheerd; ze verschijnen wel in dezelfde lijst met het label Gezin.

## Technisch

- **Databank (één additieve migratie)**: uniek partieel index op `shares(owner_id, member_id)` waar `member_id is not null` om dubbels te blokkeren; `accept_share`/`decline_share` blijven de enige weg om een uitnodiging te beantwoorden. Geen nieuwe tabellen, geen nieuwe rechtenkolommen (favorieten blijft buiten scope).
- **Meldingen**: hergebruik van `notification_log` + `src/lib/webpush.server.ts`. Nieuwe serverfunctie `src/lib/vrienden.functions.ts` met `nodigUitVriend` en `beantwoordUitnodiging` (`requireSupabaseAuth`), die de share aanmaakt/bijwerkt via de RPC's en daarna een logregel + push stuurt naar de tegenpartij met `dedupe_key` `${uid}:uitnodiging:${shareId}` respectievelijk `:aanvaard:`. Soorten `uitnodiging` en `uitnodiging_ok` toegevoegd aan `melding-teksten.ts` (nl/en/fr/de). Deep link `/vrienden?uitnodiging=<id>`.
- **Live bijwerken**: één Supabase realtime-kanaal op `shares` (filter op eigen rijen) in de vriendenpagina → `invalidateQueries(["shares"])`; `shares` toevoegen aan de realtime-publicatie in dezelfde migratie.
- **UI**: `src/routes/vrienden.tsx` herstructureren rond de drie blokken met een herbruikbare `PersoonKaart` (initialen-avatar uit `display_name`) en de bestaande `RechtenVenster`-dialog. `src/routes/vrienden.$id.tsx` uitbreiden: `shares`/`group_members` ophalen om te bepalen welke tabbladen (gerechten, weekmenu, boodschappen) verschijnen; de data zelf komt gewoon via de bestaande RLS-queries, dus de server blijft de scheidsrechter — de frontend verbergt enkel wat toch al geweigerd wordt.
- **Testen**: Playwright met twee sessies (A nodigt uit, B ziet melding, aanvaardt, beide lijsten updaten zonder refresh), plus controle dat B een niet-gedeeld weekmenu via directe query niet kan ophalen.
