# Weekmenu duidelijker navigeren en voorstellen betrouwbaar vernieuwen

## Doel
Het weekmenu wordt sneller te bedienen over meerdere weken, voorstellen werken zichtbaar en gevarieerd, verstreken dagen tellen niet meer mee en de instellingen krijgen een duidelijke indeling.

## Aanpassingen

### 1. Makkelijk tussen weken bewegen
- Maak de huidige weekperiode duidelijker en volledig aanklikbaar.
- Voeg herkenbare knoppen **Vorige week**, **Deze week** en **Volgende week** toe; op kleine schermen blijven de pijlen compact met duidelijke labels voor toegankelijkheid.
- Toon een korte, tikbare reeks met de huidige en eerstvolgende weken, zodat vooruitplannen één tik kost.
- Open bij tikken op de periode ook een kalender waarmee je meteen een datum verder in de toekomst kiest; het weekmenu springt naar de week van die datum.
- Laat alle acties, zoals **Gerecht inplannen**, steeds werken voor de week die op dat moment zichtbaar is. Vervang daarom “deze week” door tekst die bij de gekozen week past.

### 2. Kortere en mooiere voorstelactie
- Vervang de lange knoptekst **Laat Foodlo een weekmenu voorstellen** door **Maak een weekmenu** met het herkenbare ster-icoon.
- Gebruik in het venster een korte titel zoals **Voorstel van Foodlo**.
- Houd de uitleg kort en laat de keuzes zelf spreken.

### 3. Verstreken dagen uitsluiten
- In de huidige week zijn alleen vandaag en toekomstige dagen beschikbaar voor een nieuw voorstel.
- Voorbije dagen worden niet vooraf aangevinkt en kunnen niet opnieuw geselecteerd of ingevuld worden.
- In toekomstige weken blijven alle ingestelde weekdagen beschikbaar.
- Bestaande gerechten uit het verleden blijven bewaard; alleen nieuwe voorstellen en nieuwe planning sluiten verstreken datums uit.
- Als een week geen beschikbare dagen meer heeft, toont Foodlo een duidelijke actie om naar de volgende week te gaan.

### 4. “Opnieuw” echt laten werken
- Geef **Opnieuw voorstellen** tijdens het laden een spinner en blokkeer herhaald tikken totdat het nieuwe voorstel klaar is.
- Onthoud de huidige suggesties en sluit die bij een nieuwe ronde uit zolang er passende alternatieven zijn.
- Bij **ander gerecht** op één dag doorloopt Foodlo eerst alle passende alternatieven voordat een eerder getoond gerecht terugkomt; zo wisselt vrijdag niet steeds tussen dezelfde twee gerechten.
- Houd rekening met de gekozen kooktijd, maaltijdsoort, vermijdlijst, reeds ingeplande gerechten en de andere suggesties in dezelfde week.
- Voor nieuwe externe ideeën worden de vorige titels mee uitgesloten. Als er echt geen ander passend gerecht is, wordt dat duidelijk gemeld in plaats van schijnbaar niets te doen.
- Gewijzigde keuzes per dag leveren direct een nieuw passend voorstel voor die dag op.

### 5. Instellingen in duidelijke uitklapbare categorieën
- Deel de weekmenu-instellingen op in rustige onderdelen waarvan er telkens één open kan staan:
  1. **Voorstellen door Foodlo** — vlees/vis/vegetarisch, maximale kooktijd, te vermijden ingrediënten, eigen recepten of ook nieuwe ideeën, en vaste voorkeuren per weekdag.
  2. **Dagen en momenten** — zichtbare weekdagen, ontbijt/middag/avond en begin van de week.
  3. **Weergave** — onder elkaar of kaarten om te swipen.
- Zet alle instellingen die bepalen wat Foodlo voorstelt uitsluitend in **Voorstellen door Foodlo**.
- Gebruik duidelijke samenvattingen op gesloten onderdelen, zodat de gekozen waarden zichtbaar blijven zonder alles open te zetten.

## Technische details
- Behoud het bestaande weekmenu en de bestaande accountvoorkeuren; er komt geen tweede planningssysteem of nieuwe opslagstructuur.
- Voeg een sessiegebonden uitsluitingsgeschiedenis toe aan het voorstelvenster voor volledige voorstellen en afzonderlijke dagen.
- Pas de deterministische selectie aan met een gecontroleerde variatie tussen gelijkwaardige kandidaten, zonder dieet-, tijd- of bronkeuzes te negeren.
- Gebruik de bestaande datum- en kalenderonderdelen en voorkom dat een gekozen zondag/maandag-start verkeerde grenzen oplevert.

## Controle
- Test de huidige week, meerdere toekomstige weken en een sprong via de kalender op mobiel en desktop.
- Controleer dat verstreken dagen nooit in een voorstel of nieuwe planning terechtkomen.
- Test meerdere keren **Opnieuw voorstellen** en meerdere wissels op dezelfde vrijdag; nieuwe alternatieven moeten verschijnen en de laadstatus moet zichtbaar zijn.
- Controleer eigen recepten en externe ideeën afzonderlijk, inclusief het geval waarin geen alternatief bestaat.
- Controleer dat instellingen onder de juiste categorie staan en na heropenen bewaard blijven.
