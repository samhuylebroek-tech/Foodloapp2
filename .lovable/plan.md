# Boodschappen: "Door de winkel", "Vaak gekocht", afgevinkt onderaan en terugknop

## 1. "Door de winkel" – ideeën per afdeling
Naast het tekstveld komt een knop **"Door de winkel"** (icoon van een winkelkarretje). Tik je erop, dan opent een scherm dat van onder omhoog schuift en voelt als een wandeling door de supermarkt:
- Bovenaan een rij grote afdelingstegels die je opzij veegt, met icoon en kleur: Groenten & fruit, Brood & bakkerij, Zuivel & eieren, Vlees & vis, Kaas & beleg, Voorraadkast, Diepvries, Dranken, Snoep & koek, Huishouden, Verzorging, Baby & dier.
- Tik je op een afdeling, dan zie je die producten als grote tikbare "stickers" (bv. bananen, tomaten, ui, sla…).
- Eén tik = meteen op je lijst, met een kleine vinkanimatie en de knop "Ongedaan maken". Staat iets al op je lijst, dan zie je een vinkje en het product wordt niet dubbel toegevoegd.
- Producten die je vaak koopt, staan per afdeling vooraan, gemarkeerd met een klein sterretje.
- Onderaan staat een vaste teller: **"3 toegevoegd – Klaar"**.
- Zoeken binnen dit scherm ("Zoek in de winkel") kan ook.
- Werkt ook offline; er wordt geen AI gebruikt en het kost geen credits.

## 2. "Vaak gekocht"
- Er komt een rustig blok **"Vaak gekocht"** boven je lijst met producten die je echt vaak kocht (minstens 2 verschillende winkelbeurten). Ingrediënten die rechtstreeks uit een recept of het weekmenu kwamen, tellen niet mee.
- Je ziet die producten als tikbare chips (bv. "+ melk", "+ wc-papier"). Wat al op je lijst staat, verbergen we. Met "Alles tonen" zie je de volledige lijst.
- Heb je nog geen geschiedenis, dan zie je dit blok niet. Er wordt niets verzonnen.
- De bestaande "Misschien heb je dit weer nodig" komt in dit blok terecht, zodat je niet twee gelijkaardige blokken ziet.

## 3. Afgevinkte zaken altijd onderaan
- Zodra je iets afvinkt, gaat het naar een apart blok **"In je kar (5)"** helemaal onderaan de lijst. Het meest recent afgevinkte staat bovenaan in dat blok.
- Dat blok kun je open- en dichtklappen. Tik je er iets aan, dan gaat het terug naar de lijst. Je vindt er ook de bestaande knop om alles op te ruimen.
- Dit geldt ook in de winkelmodus en in gedeelde lijsten.

## 4. Terugknop voor de laatste actie
- Bovenaan de lijst komt een vaste **pijl terug** (ronde knop met de tekst "Terug"). Die maakt je laatste actie ongedaan: afvinken, toevoegen (ook via "Door de winkel"), verwijderen, bewerken of "alles afvinken".
- Je kunt meerdere stappen na elkaar terugdraaien, tot 20 acties in deze sessie. Is er niets om terug te zetten, dan is de knop grijs.
- Na elke terugstap zie je een korte melding, bv. "Melk staat weer op je lijst".

## Behoud
Lijsten, categorieën, optellen, voorraad, winkelmodus, delen, koppelingen met recepten en weekmenu, eerder gekocht, vaste boodschappen en offline werken blijven zoals ze zijn. Er komen geen nieuwe tabellen bij en de gegevens blijven dezelfde.

## Technisch
- Nieuw `src/lib/winkel-afdelingen.ts`: statische afdelingen met iconen (lucide) en voorbeeldproducten (NL, Belgische benamingen zoals ajuin, look en choco). De indeling sluit aan op `categorie.ts`. Dubbels herkennen we met `zelfdeProduct`.
- Nieuwe component `WinkelIdeeen.tsx` (Sheet side="bottom", afdelingen horizontaal scrollbaar, chips van minstens 56px, animatie via CSS/tailwind, semantische tokens).
- `vaakGekocht` krijgt een filter op `recipe_id == null` (shopping_history bevat recipe_id; de select wordt uitgebreid).
- `boodschappen.tsx`: bij de weergave worden `open` en `klaar` gesplitst, klaar gesorteerd op het tijdstip van afvinken (lokale tijdstempel per sessie, met created_at als terugval). Een undo-stack (useRef, max 20) krijgt per actie een omkeerfunctie. De bestaande toast-acties gebruiken dezelfde stack.
- Meten via de bestaande `meet()`: `boodschappen.winkel_idee`, `boodschappen.vaak_gekocht`, `boodschappen.terug`.
- Controle: typecheck, build, Playwright op 390×844 en 1280×1800. Niet publiceren zonder aparte toestemming.
