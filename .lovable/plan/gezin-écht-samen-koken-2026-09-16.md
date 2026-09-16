# Gezin: écht samen koken

## Doel
Een gezin wordt één samenwerkende keuken: één gezamenlijk weekmenu, één gezamenlijke boodschappenlijst, elkaars recepten zien, en uitnodigingen met melding zoals bij vrienden. Bestaande persoonlijke weekmenu's, lijsten en deel-instellingen blijven onaangeroerd. Geen tweede deelsysteem: alles bouwt voort op `groups`/`group_members`.

## Wat de gebruiker merkt

**Mijn gezin (/gezin)**
- Naast link/QR kan je nu ook een bestaande gebruiker uitnodigen: zoeken op naam of @naam (hergebruik `zoek_gebruiker`).
- Uitgenodigde personen staan zichtbaar als "Uitgenodigd, wacht op antwoord" tot ze aannemen of weigeren.
- De uitgenodigde krijgt een melding in de app én een pushmelding ("Sam heeft je uitgenodigd voor gezin 'Ons gezin'") die opent op de uitnodiging met Aannemen / Weigeren. Bij aannemen krijgt de uitnodiger "Sofie is in je gezin gekomen". Weigeren geeft geen bericht. Geen credits, geen AI.
- Leden krijgen gekleurde initialen-avatars (hergebruik Avatar-component).

**Weekmenu (/planner)**
- Bovenaan een grote schakelknop: "Mijn weekmenu" / "Weekmenu gezin" (alleen zichtbaar als je in een gezin zit).
- Het gezinsweekmenu is één gedeelde planning: iedereen in het gezin ziet en vult dezelfde week aan. Duidelijke kop "Weekmenu van Ons gezin" zodat je weet waar je kijkt.
- "Zet op boodschappenlijst" vanuit het gezinsweekmenu zet het op de gezinslijst.

**Boodschappen (/boodschappen)**
- Elk gezin krijgt automatisch één lijst "Gezinslijst" (ook voor bestaande gezinnen). Die staat bij ieder gezinslid in de lijstenkiezer met een Gezin-badge.
- Alle leden voegen toe en vinken af op dezelfde lijst, in realtime mee-ververst.

**Vrienden & gezin (/vrienden)**
- Gezinsuitnodigingen verschijnen ook in het blok "Uitnodigingen voor jou" met Aannemen/Weigeren.

## Technisch (één additieve migratie + app-wijzigingen)

**Migratie `0023_gezin_gedeeld.sql`** (alles additief, geen dataverlies):
- `meal_plan.group_id uuid REFERENCES public.groups(id)` (nullable). RLS: leden van de groep mogen select/insert/update/delete waar `group_id` gezet is en `in_groep(auth.uid(), group_id)`; `user_id` blijft de maker. Persoonlijke rijen (`group_id IS NULL`) blijven onder de bestaande policies.
- `shopping_lists.group_id uuid REFERENCES public.groups(id)` (nullable). RLS via `in_groep`. `shopping_items`: extra policies die toelaten wat de lijst toelaat (leden van de groep van de lijst mogen items lezen/toevoegen/aanpassen/afvinken).
- `group_members.status text NOT NULL DEFAULT 'actief'` (`'actief'` | `'uitgenodigd'`). `in_groep()` en `samen_in_groep()` tellen enkel `status='actief'`. `join_group` (link/QR) blijft direct `'actief'` zetten.
- Trigger op `groups` insert: maak meteen lijst "Gezinslijst" met `group_id`; backfill voor bestaande groepen (INSERT ... SELECT, onderdeel van dezelfde migratie).
- Nieuwe RPC `accepteer_gezin(_group uuid)` (security definer): zet eigen rij van `'uitgenodigd'` naar `'actief'`; weigeren = eigen uitgenodigde rij verwijderen (bestaande delete-policy dekt dit).
- `group_members` + `meal_plan` + `shopping_items` toevoegen aan de realtime-publicatie zodat uitnodigingen en het gezinsmenu meteen overal verschijnen.
- Grants op aangepaste tabellen blijven conform bestaande rollen.

**Serverfuncties (`src/lib/gezin.functions.ts`, requireSupabaseAuth):**
- `nodigUitGezin({ gebruikerId })`: alleen actieve leden mogen uitnodigen; blokkeer dubbele/ bestaande leden met vriendelijke melding; voeg pending rij toe; schrijf `notification_log` (admin-client, zoals bij vrienden) + push naar de uitgenodigde met dedupe-sleutel `gezin:<group>:<uid>`.
- `beantwoordGezinsUitnodiging({ groupId, antwoord })`: aannemen via RPC + push naar de uitnodiger; weigeren verwijdert de rij.
- Meldteksten: nieuwe soorten `gezinsuitnodiging` en `gezin_ok` in `melding-teksten.ts` (nl/en/fr/de), deep link naar `/vrienden?uitnodiging=...` resp. `/gezin`.

**UI:**
- `gezin.tsx`: zoekveld + resultatenlijst (Avatar + naam), knop "Uitnodigen", blok "Wacht op antwoord", avatars bij leden.
- `planner.tsx`: gezin-toggle; query's schakelen tussen `user_id` (eigen) en `group_id` (gezin); toon bij gezinsmenu wie wat toegevoegd heeft (kleine initiaal-chip).
- `boodschappen.tsx`: gezinslijst mee ophalen (met badge), items muteren via bestaande helpers; `voegToeAanLijst`/`zorgVoorLijst` licht uitbreiden voor `group_id`.
- `vrienden.tsx`: gezinsuitnodigingen in het uitnodigingenblok.

## Buiten scope (bewust)
- Meerdere gezinslijsten of meerdere gezinnen per gebruiker (nu: één gezin, één gezamenlijke lijst — past bij huidige data).
- Persoonlijke deel-schakelaars op de gezinspagina blijven exact zoals ze zijn.
- Favorieten delen blijft buiten scope.

## Testen
- Typecheck + build.
- Playwright met twee sessies: A maakt gezin en nodigt B op naam uit → B ziet melding in app, aanvaardt → beide zien elkaar; A plant een gerecht in het gezinsweekmenu → B ziet het zonder verversen; B vinkt iets af op de gezinslijst → A ziet het; B kan geen persoonlijk weekmenu van A opvragen via directe query (RLS-check).
