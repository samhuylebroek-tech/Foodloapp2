# Vrienden: uitnodigingen opkuisen en zelf kiezen wat je deelt

## Wat er nu misgaat

- Bij "Mensen die ik uitnodigde" staan nog drie oude **linkuitnodigingen** (Sofie, Tim Campine, Maxim Pellegrin) die niemand ooit opende. Die blijven daar eeuwig staan, ook als die persoon intussen gewoon in de app zit. Je kan ze ook niet intrekken.
- Zoek je iemand op en klik je **Uitnodigen**, dan vertrekt de uitnodiging meteen met standaardrechten. Je krijgt nergens de vraag wát je met die persoon wil delen.
- Een uitnodiging die jij krijgt kan je enkel aannemen of weigeren. Je kan bij het aannemen niet kiezen wat jij op jouw beurt met die persoon deelt.

## Wat we bouwen

**1. Oude linkuitnodigingen opkuisen**
- Bij elke openstaande linkuitnodiging komt een knop **Intrekken** (verwijdert ze).
- Staat er al een echte verbinding of uitnodiging met diezelfde persoon (op naam), dan verdwijnt de losse linkuitnodiging uit de lijst: hij zit al in de app. Concreet: Maxim staat straks niet meer dubbel.

**2. Zelf kiezen wat je deelt bij het uitnodigen**
- Klik je bij een zoekresultaat op **Uitnodigen**, dan opent eerst een klein venster: "Wat wil je delen met {naam}?" met de bekende schakelaars — Recepten, Weekmenu, Boodschappen, elk met "bekijken" of "ook bewerken".
- Pas na **Uitnodiging versturen** vertrekt ze, met precies die rechten.

**3. Uitnodigingen die jij krijgt, met eigen keuze**
- De sectie **Uitnodigingen voor jou** komt duidelijk bovenaan de vriendenpagina te staan, met een teller in de titel, zodat je ziet dat er iets voor je klaarstaat.
- Klik je op **Aannemen**, dan volgt hetzelfde keuzevenster: "Wat deel jij met {naam}?" — of je kiest "Nu niets delen", dan zie jij wel hun recepten en zij nog niets van jou.
- Wat je koos kan je later altijd nog aanpassen bij die vriend.

## Technisch

- `src/routes/vrienden.tsx`: één herbruikbaar `RechtenVenster` (dialog met de bestaande `Rechten`-switches) voor drie gevallen: uitnodigen vanuit zoekresultaat, aannemen van een uitnodiging, en de bestaande nieuwe-linkuitnodiging.
- `nodigUit`-mutatie krijgt de gekozen rechten mee in plaats van de globale `rechten`-state.
- Aannemen: eerst `accept_share` (bestaand RPC), daarna — als de gebruiker iets terug wil delen — een eigen rij in `shares` met `owner_id = ik`, `member_id = hen`, `status = 'accepted'` en de gekozen rechten; mislukt dat, dan een vriendelijke melding zonder de acceptatie te breken.
- Openstaande linkuitnodigingen (`member_id is null`, status `open`): knop "Intrekken" → `delete from shares where id`. Filter in `mijn`: verberg open uitnodigingen waarvan `invited_name` (genormaliseerd) overeenkomt met de naam van een bestaande vriend, gezinslid of lopende directe uitnodiging.
- Geen databasewijziging nodig; bestaande RLS op `shares` (eigenaar beheert eigen rijen) volstaat. Even nagaan bij de implementatie of het invoegen met status `accepted` door de policy geraakt; zo niet, dan `pending` + duidelijke tekst.
