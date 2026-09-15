# Kaart scannen laten werken op elke telefoon

## Wat er nu misgaat

De scanner gebruikt alleen de ingebouwde codelezer van de browser. iPhones (Safari) en veel oudere Android-browsers hebben die niet, dus krijg je meteen "Je telefoon kan hier geen code scannen". Op die toestellen werkt scannen dus nooit, ook al is de camera prima.

## Wat we bouwen

1. **Scannen werkt op elke telefoon**
   Als de ingebouwde codelezer ontbreekt, valt de app terug op een eigen codelezer die meedraait in de app zelf. Het camerabeeld blijft identiek; de gebruiker merkt geen verschil.

2. **Foto uploaden als extra manier**
   In het scanscherm en bij "Kaart toevoegen" komt een knop **Foto van je kaart kiezen**. Je kiest een foto uit je fotorol (of maakt er één met de camera) en de app leest de streepjescode of QR-code uit die foto. Lukt dat niet, dan een vriendelijke melding: probeer dichterbij en recht van boven, of typ het nummer zelf in.

3. **Melding alleen nog als het echt niet lukt**
   De harde boodschap "je telefoon kan hier geen code scannen" verdwijnt. Blijft het scannen mislukken, dan krijg je twee duidelijke knoppen: **Foto kiezen** en **Zelf invullen**.

Scannen en foto's lezen gebeurt volledig op de telefoon zelf: geen credits, geen internet nodig.

## Technisch

- `@zxing/browser` + `@zxing/library` toevoegen (lokaal, geen API).
- `src/components/KaartScanner.tsx`: `BarcodeDetector` blijft het eerste pad; ontbreekt die, dan `BrowserMultiFormatReader.decodeFromVideoDevice` op hetzelfde `<video>`-element. Netjes opruimen bij sluiten (stream + reader stoppen).
- Nieuwe hulpfunctie (bijv. `src/lib/kaart-scan.ts`): een afbeelding decoderen via `BrowserMultiFormatReader.decodeFromImageUrl`, met een `<input type="file" accept="image/*">` als bron. Resultaat gaat door de bestaande `formaatVanScan` + `raadWinkel`.
- `src/routes/kaarten.index.tsx`: knop "Foto kiezen" naast "Kaart scannen" en "Zelf invullen"; zelfde `gevonden(waarde, formaat)`-pad, inclusief bestaande `logScan` (methode `"foto"`).
- Geen wijziging aan database, RLS of het creditsysteem.
