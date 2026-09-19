# Recepten filteren: van mij of van vrienden

## Probleem
Op de receptenpagina staan nu alle recepten door elkaar: de jouwe én die van vrienden/familie die met je delen. Je kan niet snel alleen je eigen recepten zien.

## Oplossing
Bovenaan de receptenpagina, naast "Favorieten" en "Filters", komt een eenvoudige keuze met drie grote knoppen:

```text
[ Alles ] [ Van mij ] [ Van vrienden ]
```

- **Alles** (standaard): zoals nu, alles wat je mag zien.
- **Van mij**: enkel recepten die jij zelf hebt toegevoegd.
- **Van vrienden**: enkel recepten die vrienden of gezinsleden met je delen.
- De keuze werkt samen met zoeken en de bestaande filters (soort, tijd, dieet, score).
- Op elk receptkaartje van een vriend komt klein de naam van de eigenaar ("van Sophie"), zodat je meteen ziet van wie het is — ook in de stand "Alles".

## Technisch
- Enkel `src/routes/gerechten.tsx`: een extra staat `eigenaar` ("alles" | "mij" | "vrienden") en filter op `recipe.user_id === user.id`.
- Eigenaarsnamen ophalen via de bestaande profielen-gegevens (één extra kleine query op `profiles` van de zichtbare `user_id`s), geen nieuwe tabellen of rechten.
- Geen wijzigingen aan database of permissies; bestaande filters en verwijderen/swipe blijven ongemoeid.

## Testen
- Aanmelden, receptenpagina openen: drie knoppen zichtbaar.
- "Van mij" toont enkel eigen recepten; "Van vrienden" enkel gedeelde; telling klopt.
- Combinatie met zoekterm en filters blijft werken; gsm en desktop.
