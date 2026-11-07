# app Foodlo

# Ontwikkel een complete, gebruiksvriendelijke kookapplicatie

## 1. Doel van de applicatie

Ontwikkel een moderne mobile applicatie voor iOS en Android waarmee gebruikers gezamenlijk recepten/gerechten kunnen verzamelen, organiseren, aanpassen, zoeken, plannen en gebruiken tijdens het koken.

De applicatie moet geschikt zijn voor zowel technisch zeer ervaren gebruikers van ongeveer 20 jaar als voor mensen van 60-70+ die weinig ervaring hebben met smartphones.

**Belangrijkste uitgangspunt: eenvoud boven complexiteit.**

De applicatie moet aanvoelen alsof je een digitale kookboek + receptenverzamelaar + boodschappenlijst + slimme kookassistent in één app hebt.

De applicatie moet vanaf de eerste versie professioneel, schaalbaar en production-ready worden ontworpen.

---

# 2. Kernconcept: accounts en groepen

Een gebruiker moet een account kunnen aanmaken.

Een gebruiker kan vervolgens één of meerdere "groepen" / huishoudens aanmaken.

Bijvoorbeeld:

* "Ons gezin"
* "Koken met mijn partner"
* "Studentenhuis"
* "Familie"
* "Vrienden"

Elke groep is een volledig **afgeschermde omgeving**.

### Voorbeeld

Gebruiker Jan:

* Groep "Jan & Sarah"
* Groep "Familie Peeters"

Sarah heeft toegang tot "Jan & Sarah", maar niet automatisch tot "Familie Peeters".

De data van groepen mag nooit met elkaar vermengd worden.

Alle recepten, boodschappenlijsten, notities, instellingen, geplande maaltijden enz. zijn gekoppeld aan een groep.

---

# 3. Uitnodigen en delen

Het moet extreem eenvoudig zijn om iemand aan een groep toe te voegen.

Mogelijkheden:

* uitnodigingslink
* QR-code
* uitnodigingscode
* e-mail
* eventueel telefoonnummer/contacten

Flow:

1. Gebruiker maakt groep.
2. Gebruiker kiest "Nodig iemand uit".
3. App genereert bijvoorbeeld een uitnodigingslink.
4. Andere persoon opent de link.
5. Indien nog geen account: registreren.
6. Indien al account: aanmelden.
7. Daarna automatisch toegang tot de juiste groep.

### Belangrijk

De uitnodigingsflow moet zo eenvoudig zijn dat iemand van 70 jaar dit zonder uitleg kan uitvoeren.

---

# 4. Rollen en rechten

Voorzie een eenvoudig rechtenmodel.

Minimaal:

### Owner

* groep beheren
* leden uitnodigen/verwijderen
* instellingen aanpassen
* groep verwijderen

### Admin

* leden beheren
* recepten beheren

### Member

* recepten toevoegen/bewerken
* boodschappenlijsten gebruiken
* notities toevoegen
* maaltijden plannen

Maak dit niet onnodig ingewikkeld in de UI.

---

# 5. Dashboard / Home

Na het openen van de app moet de gebruiker onmiddellijk begrijpen wat hij kan doen.

De homepagina moet bijvoorbeeld bevatten:

### Bovenaan

* huidige groep
* mogelijkheid om van groep te wisselen
* profiel/account

### Grote acties

* * Recept toevoegen
* Boodschappenlijst
* Vandaag koken
* Recepten zoeken

### Daaronder

* recent toegevoegde recepten
* favoriete recepten
* geplande gerechten
* eventueel "Wat zullen we vandaag eten?"

De belangrijkste acties moeten met grote duidelijke knoppen bereikbaar zijn.

---

# 6. Recepten

Het recept is het centrale object van de applicatie.

Een recept moet minimaal bevatten:

* naam
* foto
* meerdere foto's mogelijk
* beschrijving
* ingrediënten
* hoeveelheden
* eenheden
* aantal personen/porties
* bereidingstijd
* kooktijd
* totale tijd
* moeilijkheidsgraad
* categorie
* type gerecht
* labels/tags
* ingrediënten/types
* bereidingswijze
* persoonlijke notities
* bron
* URL
* auteur
* datum toegevoegd
* laatst aangepast
* favoriet ja/nee
* rating
* aantal keer gemaakt
* eventueel laatste keer gemaakt

---

# 7. Recept toevoegen

Een recept moet op verschillende manieren toegevoegd kunnen worden.

## Methode A – Handmatig

Gebruiker vult in:

* naam
* foto
* ingrediënten
* hoeveelheden
* bereiding
* tijd
* personen
* labels

Maak het formulier slim zodat niet alles verplicht is.

De gebruiker moet bijvoorbeeld gewoon een titel en foto kunnen toevoegen en later de rest aanvullen.

---

# 8. Recept importeren via website

Dit is een belangrijke functie.

De gebruiker moet een URL kunnen plakken.

Voorbeeld:

> https://www.example.com/recept-pasta

De applicatie probeert automatisch te herkennen:

* receptnaam
* foto
* ingrediënten
* hoeveelheden
* bereidingswijze
* bereidingstijd
* kooktijd
* porties
* categorie
* eventuele voedingsinformatie

Gebruik hiervoor waar mogelijk gestructureerde receptdata zoals Schema.org Recipe / JSON-LD.

Als automatische herkenning mislukt:

> "We konden dit recept niet volledig herkennen. Controleer de gegevens."

Toon daarna een eenvoudig bewerkformulier.

**De gebruiker moet altijd de mogelijkheid hebben om de automatisch herkende informatie aan te passen.**

---

# 9. Recept toevoegen via e-mail

Voorzie een mogelijkheid waarbij een gebruiker een recept of link naar een speciaal e-mailadres kan sturen.

Bijvoorbeeld:

recipe@...

De applicatie verwerkt de ontvangen e-mail en probeert het recept automatisch te importeren.

Idealiter:

* URL herkennen
* tekst analyseren
* ingrediënten herkennen
* hoeveelheden herkennen
* bereiding herkennen
* foto herkennen

Daarna verschijnt het recept in de juiste groep.

Voorzie ook beveiliging zodat alleen geautoriseerde gebruikers recepten kunnen mailen.

---

# 10. Recept toevoegen via foto

De gebruiker moet een foto kunnen maken van:

* een recept
* een kookboek
* een receptpagina
* een handgeschreven recept
* een gerecht

Gebruik OCR/AI om tekst uit de foto te halen.

Bijvoorbeeld:

Foto:

> Pasta carbonara
> 400 g spaghetti
> 150 g pancetta
> 4 eieren
> 100 g Parmezaan
> ...

De app probeert automatisch hiervan een gestructureerd recept te maken.

De gebruiker krijgt daarna een **controlepagina**:

> "Dit hebben we herkend"

en kan alles aanpassen voordat het definitief wordt opgeslagen.

---

# 11. Foto van een gerecht

De gebruiker moet ook gewoon een foto van een klaargemaakt gerecht kunnen nemen.

AI kan proberen te herkennen wat het gerecht is.

Bijvoorbeeld:

Foto → "Lasagne"

Vervolgens:

> "We denken dat dit lasagne is. Wil je hier een recept van maken?"

Dit mag nooit automatisch foutieve informatie als waarheid opslaan.

AI-resultaten moeten altijd controleerbaar en aanpasbaar zijn.

---

# 12. Foto van een menu

Een belangrijke extra functie:

De gebruiker maakt bijvoorbeeld een foto van een restaurantmenu.

AI/OCR analyseert de foto.

De app herkent gerechten zoals:

* Steak tartare
* Vol-au-vent
* Kabeljauw
* Lasagne
* ...

De gebruiker kan vervolgens:

> "Opslaan als gerecht"

en eventueel later zelf het recept aanvullen.

Ook moet het mogelijk zijn om een foto van een receptkaart, tijdschrift of kookboek te gebruiken.

---

# 13. AI-functionaliteit

AI moet ondersteunend zijn, niet dominant.

Gebruik AI voor:

* recepten herkennen
* OCR
* ingrediënten herkennen
* categorieën voorstellen
* labels voorstellen
* bereidingstijd voorstellen
* moeilijkheidsgraad voorstellen
* ontbrekende informatie herkennen
* recept structureren
* recept samenvatten
* alternatieve ingrediënten voorstellen
* recept aanpassen voor aantal personen
* eventueel vegetarische/vegan alternatieven voorstellen
* recept vertalen
* ingrediënten groeperen
* recepten vergelijken
* zoeken in natuurlijke taal

Voorbeeld:

> "Ik wil iets met kip, rijst en paprika dat maximaal 30 minuten duurt."

De app moet passende recepten kunnen tonen.

---

# 14. AI mag nooit de gebruiker overrulen

Alle AI-herkenning moet door de gebruiker aangepast kunnen worden.

Bijvoorbeeld:

AI zegt:

> Bereidingstijd: 25 minuten

Gebruiker kan wijzigen naar:

> 40 minuten

De gebruikersdata is altijd leidend.

---

# 15. Ingrediëntenmodel

Gebruik geen simpele tekstvelden voor ingrediënten.

Ingrediënten moeten gestructureerd opgeslagen worden.

Bijvoorbeeld:

```text
Ingrediënt:
- naam: kipfilet
- hoeveelheid: 400
- eenheid: gram
- categorie: vlees
- subcategorie: kip
```

Ondersteun onder andere:

* gram
* kilogram
* milliliter
* liter
* eetlepel
* theelepel
* stuk
* snufje
* handvol
* verpakking
* blik
* zak
* bosje
* naar smaak

Zorg dat hoeveelheden automatisch kunnen worden omgerekend.

---

# 16. Porties aanpassen

Dit is een kernfunctie.

Een recept is bijvoorbeeld voor:

> 4 personen

Gebruiker kiest:

> 2 personen

Alle ingrediënten worden automatisch aangepast.

Bijvoorbeeld:

400 g kip → 200 g kip

De gebruiker moet de automatische berekening kunnen overschrijven.

---

# 17. Slimme afronding

Niet alles moet mathematisch exact worden weergegeven.

Bijvoorbeeld:

1,33 ui

is voor een gebruiker minder handig dan:

> 1 à 1,5 ui

Gebruik slimme menselijke afrondingen.

De gebruiker moet eventueel kunnen kiezen tussen:

* exact
* praktisch afgerond

---

# 18. Labels en categorieën

Gebruikers moeten recepten kunnen voorzien van labels.

Bijvoorbeeld:

* snel
* gezond
* feest
* kinderen
* weekend
* goedkoop
* makkelijk
* BBQ
* kerst
* verjaardag

Daarnaast moeten automatische categorieën bestaan.

Bijvoorbeeld:

### Hoofdcategorie

* vlees
* vis
* vegetarisch
* vegan
* pasta
* rijst
* soep
* salade
* dessert
* ontbijt
* lunch
* snack

### Vlees

* kip
* rund
* varken
* lam
* kalkoen
* gehakt

### Vis

* zalm
* tonijn
* kabeljauw
* scampi
* ...

Deze taxonomie moet uitbreidbaar zijn.

---

# 19. Filteren en zoeken

Zoeken moet extreem goed werken.

De gebruiker moet bijvoorbeeld kunnen zoeken op:

* naam
* ingrediënt
* categorie
* type vlees
* type vis
* vegetarisch
* vegan
* bereidingstijd
* totale tijd
* aantal personen
* moeilijkheid
* labels
* favorieten
* recent toegevoegd
* vaak gemaakt

Voorbeeld:

> "Toon alle recepten met kip die minder dan 30 minuten duren."

Of:

> "Wat kan ik maken met courgette?"

Of:

> "Toon vegetarische gerechten voor 4 personen."

---

# 20. Natuurlijke zoekfunctie

Naast klassieke filters moet natuurlijke taal ondersteund worden.

Voorbeelden:

> "Iets snel met kip"

> "Een vegetarisch gerecht voor vrijdag"

> "Wat kan ik maken met tomaat en mozzarella?"

> "Toon mijn favoriete pasta's"

> "Iets dat kinderen meestal lekker vinden"

AI vertaalt de zoekopdracht naar filters/receptmatching.

---

# 21. Receptdetailpagina

Bij het openen van een recept moet de gebruiker onmiddellijk de belangrijkste informatie zien.

Bovenaan:

* grote foto
* naam
* rating
* bereidingstijd
* aantal personen
* moeilijkheid
* favoriet

Daarna:

### Ingrediënten

Met aantallen die automatisch veranderen wanneer de gebruiker het aantal personen wijzigt.

### Bereiding

Stap voor stap.

Maak eventueel een "Kookmodus".

---

# 22. Kookmodus

Een aparte modus waarin de gebruiker tijdens het koken niet voortdurend kleine tekst moet lezen.

Bijvoorbeeld:

> Stap 1 van 7

> Snijd de ui fijn.

[Vorige] [Volgende]

De tekst moet groot zijn.

Optioneel:

* scherm actief houden
* timer instellen
* gesproken instructies
* volgende stap automatisch voorbereiden

Dit is bijzonder belangrijk voor gebruiksgemak tijdens het koken.

---

# 23. Timers

In recepten moet de gebruiker eenvoudig timers kunnen starten.

Bijvoorbeeld:

> Bak 20 minuten.

Knop:

> Start timer

Ondersteun meerdere timers tegelijk.

Bijvoorbeeld:

* pasta: 8 min
* oven: 25 min
* saus: 15 min

---

# 24. Persoonlijke notities

Elke gebruiker moet persoonlijke of groepsnotities kunnen toevoegen.

Bijvoorbeeld:

> "Volgende keer minder zout."

> "Sarah vindt dit lekkerder met extra kaas."

Maak onderscheid tussen:

* algemene receptnotitie
* persoonlijke notitie
* groepsnotitie

---

# 25. Rating

Na het maken van een gerecht kan de gebruiker bijvoorbeeld:

⭐⭐⭐⭐⭐

geven.

Optioneel:

> "Zeker opnieuw maken"

> "Niet opnieuw maken"

> "Aanpassen"

Bewaar de geschiedenis.

---

# 26. Boodschappenlijst

Een recept moet rechtstreeks aan een boodschappenlijst toegevoegd kunnen worden.

Bijvoorbeeld:

[Voeg ingrediënten toe aan boodschappenlijst]

De gebruiker kiest:

> 4 personen

De ingrediënten worden automatisch aangepast.

---

# 27. Slimme boodschappenlijst

De boodschappenlijst moet ingrediënten kunnen combineren.

Als recept A:

* 2 uien

Recept B:

* 3 uien

Dan wordt:

> Uien — 5 stuks

Niet:

> 2 uien
> 3 uien

Maak de lijst slim.

---

# 28. Categoriseer boodschappen

Groepeer boodschappen automatisch.

Bijvoorbeeld:

### Groenten

* tomaten
* uien
* paprika

### Vlees

* kipfilet
* gehakt

### Zuivel

* melk
* kaas

### Droge voeding

* pasta
* rijst

### Diepvries

* ...

De gebruiker moet de categorieën kunnen aanpassen.

---

# 29. Boodschappen afvinken

De gebruiker moet items eenvoudig kunnen afvinken.

Grote touch targets.

Bijvoorbeeld:

☐ Melk
☐ 500 g kip
☐ 2 paprika's

Na afvinken:

✓ Melk

Eventueel automatisch naar onderaan verplaatsen.

---

# 30. Meerdere boodschappenlijsten

Ondersteun meerdere lijsten.

Bijvoorbeeld:

* Weekboodschappen
* BBQ
* Kerst
* Vakantie

---

# 31. Voorraad / pantry

Voeg een optionele voorraadfunctie toe.

De gebruiker kan aangeven wat hij thuis heeft.

Bijvoorbeeld:

* rijst
* pasta
* olijfolie
* zout
* peper
* tomaten in blik

De app kan dan tonen:

> "Je hebt 6 van de 8 ingrediënten voor dit recept."

Dit kan ook gebruikt worden voor slimme receptsuggesties.

---

# 32. Supermarktintegraties

Het boodschappenlijstje moet in een ideaal scenario kunnen worden doorgestuurd naar een supermarkt.

Denk aan:

* Carrefour
* Delhaize
* Albert Heijn
* Colruyt
* Aldi
* Lidl
* andere relevante winkels per land

Maar bouw dit **modulair**.

Niet elke supermarkt heeft noodzakelijk een publieke API.

Ontwerp daarom een abstraction layer:

```text
ShoppingProvider
    ├── Carrefour
    ├── Delhaize
    ├── AlbertHeijn
    ├── Colruyt
    ├── Aldi
    └── Lidl
```

Als een supermarkt geen technische integratie aanbiedt, moet een fallback bestaan waarbij de boodschappenlijst bijvoorbeeld gekopieerd/geëxporteerd kan worden.

---

# 33. Productmatching

Een belangrijk technisch probleem:

De gebruiker heeft:

> "melk"

De supermarkt heeft:

> "Halfvolle melk 1L"

Ontwikkel een productmatchinglaag.

De applicatie probeert ingrediënten te koppelen aan beschikbare supermarktproducten.

De gebruiker moet de match kunnen bevestigen/wijzigen.

---

# 34. Weekplanning / maaltijdplanner

Voeg een maaltijdplanner toe.

Bijvoorbeeld:

### Maandag

🍝 Spaghetti Bolognese

### Dinsdag

🐟 Zalm met groenten

### Woensdag

🥗 Salade

De gebruiker kan een gerecht naar een dag slepen.

Ondersteun:

* ontbijt
* lunch
* avondeten

Optioneel snacks.

---

# 35. Boodschappenlijst vanuit weekplanning

Wanneer een gebruiker gerechten plant voor de komende week:

> "Voeg alle ingrediënten toe aan boodschappenlijst"

De applicatie combineert automatisch alle ingrediënten.

---

# 36. Slimme suggesties

Op basis van:

* favoriete recepten
* vorige recepten
* beschikbare ingrediënten
* seizoen
* geplande maaltijden
* kooktijd
* dieetvoorkeuren

kan de app suggesties doen.

Bijvoorbeeld:

> "Wat wil je vandaag koken?"

* Snel
* Gezond
* Met kip
* Met wat je thuis hebt
* Verrassing

---

# 37. Favorieten

Gebruikers moeten recepten kunnen opslaan als favoriet.

Maak daarnaast eventueel automatisch:

> Meest gemaakte recepten

> Recent gekookt

> Nog nooit geprobeerd

---

# 38. Receptgeschiedenis

Bewaar wanneer een recept gemaakt werd.

Bijvoorbeeld:

> Laatst gemaakt: 3 september 2026

> 8 keer gemaakt

Hiermee kunnen later inzichten worden gemaakt.

---

# 39. Delen buiten de groep

Een gebruiker moet een recept eventueel kunnen delen met iemand buiten de groep.

Bijvoorbeeld:

* link
* afbeelding
* tekst
* PDF

Maar:

**delen betekent niet automatisch toegang tot de groep.**

Een gedeeld recept kan dus bijvoorbeeld als read-only publieke/share versie worden verstuurd.

---

# 40. Privacy en beveiliging

Dit is zeer belangrijk.

Elke database-entiteit moet aan een groep gekoppeld zijn.

Gebruik bijvoorbeeld:

```text
User
Group
GroupMember
Recipe
Ingredient
ShoppingList
ShoppingListItem
MealPlan
Note
```

Data-access moet altijd gecontroleerd worden op:

```text
user -> group membership -> resource
```

Een gebruiker mag nooit data van een andere groep kunnen ophalen, ook niet wanneer iemand handmatig een ID probeert te wijzigen.

Gebruik server-side authorization.

Nooit alleen vertrouwen op frontend-beveiliging.

---

# 41. Accountbeveiliging

Ondersteun:

* e-mail + wachtwoord
* wachtwoord vergeten
* e-mailverificatie
* eventueel Apple Login
* eventueel Google Login
* veilige sessies
* logout van alle apparaten

Overweeg ook passkeys indien technisch haalbaar.

---

# 42. Toegankelijkheid

Dit is een absolute prioriteit.

De applicatie moet geschikt zijn voor 20- én 70-jarigen.

Gebruik:

* grote knoppen
* voldoende contrast
* duidelijke iconen + tekst
* geen belangrijke functies uitsluitend via iconen
* grote lettergrootte
* eenvoudige taal
* weinig stappen
* duidelijke bevestigingen
* undo waar mogelijk
* grote checkboxen
* voldoende ruimte tussen elementen
* ondersteuning voor Dynamic Type / systeemlettergrootte
* VoiceOver
* TalkBack
* toegankelijkheidslabels

Vermijd:

* kleine tekst
* ingewikkelde menu's
* verborgen swipe-acties
* overvolle schermen
* jargon

---

# 43. Onboarding

De eerste ervaring moet extreem eenvoudig zijn.

Bijvoorbeeld:

### Stap 1

"Welkom bij [naam]"

### Stap 2

"Maak je account"

### Stap 3

"Maak een groep"

### Stap 4

"Wil je iemand uitnodigen?"

### Stap 5

"Voeg je eerste recept toe"

Geef eventueel voorbeeldrecepten zodat een nieuwe gebruiker niet in een lege app terechtkomt.

---

# 44. Lege toestanden

Ontwerp alle empty states.

Bijvoorbeeld:

Geen recepten:

> "Je hebt nog geen recepten. Voeg je eerste recept toe."

Geen boodschappen:

> "Je boodschappenlijst is leeg."

Geen maaltijdplanning:

> "Plan je eerste gerecht."

Nooit gewoon een leeg scherm tonen.

---

# 45. Offline functionaliteit

De app moet zoveel mogelijk blijven werken zonder internet.

Minimaal:

* reeds opgeslagen recepten bekijken
* boodschappenlijst bekijken
* boodschappen afvinken
* kookmodus gebruiken
* notities aanpassen

Wanneer internet opnieuw beschikbaar is:

> synchroniseer wijzigingen

Gebruik een robuust synchronisatiemodel.

---

# 46. Synchronisatie tussen groepsleden

Wanneer twee mensen dezelfde groep gebruiken:

Persoon A voegt recept toe.

Persoon B ziet dit automatisch.

Persoon B past een boodschappenlijst aan.

Persoon A ziet dit automatisch.

Voorzie realtime of near-realtime synchronisatie waar zinvol.

Denk ook na over conflicten.

Bijvoorbeeld:

A en B wijzigen hetzelfde recept tegelijk.

Gebruik een begrijpelijke conflictstrategie.

---

# 47. Meldingen

Optionele push notifications:

* iemand heeft je toegevoegd aan een groep
* nieuw recept toegevoegd
* boodschappenlijst aangepast
* maaltijd gepland
* herinnering om boodschappen te doen
* herinnering voor maaltijd
* timer

De gebruiker moet meldingen volledig kunnen uitschakelen.

---

# 48. Meertaligheid

Ontwerp de applicatie vanaf het begin internationaliseerbaar.

Start bijvoorbeeld met:

* Nederlands
* Frans
* Engels

Architectuur moet eenvoudig uitbreidbaar zijn.

---

# 49. Eenheden en regio's

Ondersteun verschillende meeteenheden.

Bijvoorbeeld:

* gram
* kilogram
* ml
* liter
* oz
* lb
* cup
* tbsp
* tsp

De app moet regionale voorkeuren kunnen gebruiken.

---

# 50. Dieet en allergieën

Voorzie een optioneel profielgedeelte waarin gebruikers voorkeuren kunnen instellen.

Bijvoorbeeld:

* vegetarisch
* vegan
* lactosevrij
* glutenvrij
* notenvrij

Ook allergieën.

**Belangrijk:** allergie-informatie mag nooit als 100% betrouwbaar worden beschouwd wanneer deze automatisch door AI wordt geïnterpreteerd.

Toon duidelijke waarschuwingen.

---

# 51. Receptversies

Wanneer een gebruiker een recept aanpast, moet eventueel een geschiedenis worden bijgehouden.

Bijvoorbeeld:

> Origineel recept

> Aangepast op 12/08

> Aangepast op 03/09

De gebruiker moet eventueel een vorige versie kunnen herstellen.

---

# 52. Import en export

Voorzie:

* recepten exporteren
* boodschappenlijst exporteren
* eventueel PDF
* eventueel JSON/CSV voor data-portabiliteit

Gebruikers mogen nooit "gevangen" zitten in de applicatie.

---

# 53. Back-up

Alle data moet veilig opgeslagen worden.

Voorzie:

* automatische back-up
* herstel
* veilige cloudopslag

---

# 54. Analytics

Gebruik privacyvriendelijke analytics om productgebruik te begrijpen.

Bijvoorbeeld:

* welke functies worden gebruikt
* waar gebruikers afhaken
* hoeveel recepten worden toegevoegd
* hoeveel recepten worden gekookt

Geen onnodige persoonlijke gegevens verzamelen.

---

# 55. Technische architectuur

Ontwerp de applicatie als een echte schaalbare productieapp.

Denk minimaal na over:

### Frontend

Cross-platform mobile development, bijvoorbeeld:

* Flutter
* React Native

Kies één technologie en motiveer waarom.

### Backend

Bijvoorbeeld:

* Node.js / TypeScript
* NestJS
* PostgreSQL
* Redis indien nodig

Of een andere geschikte moderne stack.

### Authentication

Veilige authentication provider of eigen auth-laag.

### Storage

Object storage voor:

* foto's
* receptafbeeldingen
* documenten

### AI

Maak AI-functionaliteit modulair zodat de AI-provider later vervangen kan worden.

---

# 56. Database

Ontwerp een degelijk relationeel datamodel.

Minimaal:

```text
User
Group
GroupMember
Invitation
Recipe
RecipeIngredient
Ingredient
IngredientCategory
RecipeTag
Tag
RecipeStep
RecipeNote
RecipeRating
RecipeHistory
ShoppingList
ShoppingListItem
MealPlan
MealPlanItem
PantryItem
Notification
AIImport
```

Denk ook na over:

* soft deletes
* timestamps
* audit logs
* ownership
* indexes
* foreign keys
* cascading behavior
* data isolation

---

# 57. API

Ontwerp een duidelijke API.

Bijvoorbeeld:

```text
POST   /auth/register
POST   /auth/login

GET    /groups
POST   /groups
GET    /groups/:id
POST   /groups/:id/invitations

GET    /groups/:id/recipes
POST   /groups/:id/recipes
GET    /recipes/:id
PUT    /recipes/:id
DELETE /recipes/:id

POST   /recipes/import/url
POST   /recipes/import/image
POST   /recipes/import/email

GET    /shopping-lists
POST   /shopping-lists

POST   /shopping-lists/:id/items
PUT    /shopping-lists/:id/items/:itemId

GET    /meal-plans
POST   /meal-plans
```

Maak dit RESTful of kies GraphQL indien daar een duidelijke reden voor is.

---

# 58. Security

Denk minimaal aan:

* authentication
* authorization
* input validation
* rate limiting
* encryption
* secure file uploads
* malware scanning
* signed URLs
* SQL injection protection
* XSS
* CSRF waar relevant
* API abuse prevention
* brute-force protection
* secure password hashing
* secret management

---

# 59. AI import pipeline

Ontwerp de import als een pipeline:

```text
Input
 ↓
Detect source type
 ↓
Extract content
 ↓
OCR / parser
 ↓
AI structuring
 ↓
Ingredient normalization
 ↓
Category detection
 ↓
Time extraction
 ↓
Validation
 ↓
User confirmation
 ↓
Recipe saved
```

De gebruiker moet kunnen zien wat AI heeft herkend en wat onzeker is.

---

# 60. Ingrediënten normaliseren

Dit is technisch belangrijk.

"2 tomaten"

"tomaat – 2 stuks"

"2 rijpe tomaten"

moeten zoveel mogelijk naar hetzelfde gestandaardiseerde ingrediënt kunnen worden gebracht:

```text
ingredient = tomato
quantity = 2
unit = piece
```

Dit is noodzakelijk om goede boodschappenlijsten en supermarktmatching te maken.

---

# 61. UX-principe

Elke actie moet zo weinig mogelijk stappen vereisen.

Bijvoorbeeld:

### Slecht

Recept toevoegen:

Menu → Recepten → Bewerken → Nieuw → Type → Bron → Import → ...

### Goed

Grote knop:

> * Recept toevoegen

Daarna:

> 📷 Foto
> 🔗 Link
> ✍️ Zelf typen
> 📧 Via e-mail

---

# 62. Belangrijkste navigatie

Houd de navigatie beperkt.

Bijvoorbeeld:

### Home

Vandaag, recente recepten en snelle acties.

### Recepten

Alle recepten + zoeken/filteren.

### Boodschappen

Alle boodschappenlijsten.

### Planning

Weekplanning.

### Meer

Instellingen, groep, account, import/export.

---

# 63. Design

Ontwerp een rustige, warme en moderne kookapp.

Geen overdreven complexe UI.

De interface moet:

* visueel aantrekkelijk zijn
* veel met foto's werken
* maar niet afhankelijk zijn van foto's
* duidelijke typografie gebruiken
* grote interactieve elementen hebben
* intuïtief zijn

De app moet premium aanvoelen zonder ingewikkeld te worden.

---

# 64. Responsive design

Hoewel dit een mobiele applicatie is, moet de architectuur later ook tabletgebruik ondersteunen.

Een iPad/tablet-versie moet mogelijk zijn zonder de volledige applicatie opnieuw te bouwen.

---

# 65. Error handling

Elke fout moet begrijpelijk worden uitgelegd.

Niet:

> Error 500

Wel:

> "We konden het recept momenteel niet ophalen. Controleer je internetverbinding en probeer opnieuw."

Voorzie altijd:

* retry
* duidelijke foutmelding
* geen dataverlies

---

# 66. AI-fouten

AI kan fouten maken.

Daarom:

**AI mag nooit stilzwijgend data wijzigen.**

Bij import:

> "AI heeft 12 ingrediënten gevonden. Controleer ze voordat je het recept opslaat."

Markeer eventueel:

🟢 Zeker
🟠 Mogelijk
🔴 Onzeker

---

# 67. Zoekmachine

Voorzie een echte zoekindex indien de dataset groot wordt.

Zoeken moet bijvoorbeeld ook:

> "kip"

vinden in:

* receptnaam
* ingrediënten
* beschrijving
* tags
* notities

---

# 68. Performance

De app moet snel aanvoelen.

Doel:

* snelle app startup
* lazy loading
* image compression
* thumbnails
* caching
* pagination
* lokale cache
* background synchronization

---

# 69. Schaalbaarheid

Ontwerp alsof de applicatie uiteindelijk:

* 100 gebruikers
* 10.000 gebruikers
* 100.000 gebruikers
* 1.000.000+ gebruikers

kan ondersteunen.

Maak externe integrations en AI-services vervangbaar.

---

# 70. Monetization-ready

Hoewel monetization niet noodzakelijk in versie 1 moet zitten, moet de architectuur dit mogelijk maken.

Denk aan:

### Gratis

* basis recepten
* groepen
* boodschappenlijst

### Premium

* AI-import
* geavanceerde planning
* AI-receptsuggesties
* supermarktintegraties
* onbeperkte groepen
* uitgebreide geschiedenis

Maar forceer geen paywall in de eerste UX.

---

# 71. GDPR / privacy

Omdat dit een Europese applicatie is, moet GDPR vanaf het begin meegenomen worden.

Voorzie:

* privacybeleid
* toestemming waar vereist
* account verwijderen
* data exporteren
* gegevens verwijderen
* minimale dataverzameling
* duidelijke verwerking van AI-data
* duidelijke regels rond foto's en uploads

---

# 72. Teststrategie

Ontwikkel niet alleen de happy path.

Test minimaal:

### Authentication

* registratie
* login
* logout
* wachtwoord reset

### Groups

* groep maken
* uitnodigen
* accepteren
* verwijderen
* permissions

### Recipes

* handmatig toevoegen
* URL import
* foto import
* OCR
* AI
* bewerken
* verwijderen
* zoeken

### Shopping

* recept toevoegen
* porties aanpassen
* ingrediënten combineren
* afvinken

### Synchronisatie

* meerdere gebruikers
* offline
* conflict resolution

### Security

* gebruiker A kan nooit groep B lezen
* API authorization
* file access

---

# 73. Test met echte gebruikers

De applicatie moet getest worden met minstens twee doelgroepen:

### Jongere gebruikers

20-35 jaar

### Oudere gebruikers

60-80 jaar

Observeer zonder uitleg:

> "Voeg dit recept toe."

> "Maak een boodschappenlijst voor dit recept."

> "Nodig je partner uit."

> "Zoek een recept met kip."

Als gebruikers niet onmiddellijk begrijpen hoe dit werkt, moet de UX worden aangepast.

---

# 74. Belangrijkste productprincipe

De applicatie mag nooit proberen om alle functionaliteit tegelijk aan de gebruiker te tonen.

**Progressive disclosure.**

Beginnende gebruiker:

> Recepten
> Boodschappen
> Planning

Gevorderde gebruiker:

> AI
> filters
> voorraad
> statistieken
> integraties
> instellingen

---

# 75. MVP versus toekomstige functionaliteit

Maak vóór het ontwikkelen een duidelijke roadmap.

## MVP

De eerste versie moet minimaal bevatten:

1. Registratie/login
2. Groepen
3. Uitnodigen
4. Recepten
5. Foto's
6. URL-import
7. OCR
8. Ingrediënten
9. Porties aanpassen
10. Labels
11. Zoeken
12. Filters
13. Notities
14. Favorieten
15. Boodschappenlijst
16. Ingrediënten combineren
17. Kookmodus
18. Timers
19. Synchronisatie
20. Basis privacy/security

## V2

Daarna:

* AI-receptanalyse
* maaltijdplanning
* voorraad
* slimme suggesties
* natuurlijke taal zoeken
* supermarktintegraties
* productmatching
* uitgebreide geschiedenis

## V3

Later:

* persoonlijke AI-kookassistent
* voedingsanalyse
* automatische weekmenu's
* prijsvergelijking
* aanbiedingen
* slimme boodschappenoptimalisatie
* wearable/smart-home integraties
* voice control

---

# 76. UX-prioriteiten

Rangschik alle functies volgens:

### P0 – essentieel

Moet perfect werken.

### P1 – belangrijk

Moet in eerste productversie zitten.

### P2 – nuttig

Kan later.

### P3 – nice-to-have

Alleen ontwikkelen wanneer het product daar klaar voor is.

**Bouw geen enorme hoeveelheid features als de kernervaring nog niet perfect is.**

---

# 77. Wat ik van jou als ontwikkelaar verwacht

Analyseer dit volledige concept kritisch voordat je begint te programmeren.

Identificeer:

* ontbrekende functionaliteiten
* technische risico's
* securityrisico's
* privacyrisico's
* UX-problemen
* AI-risico's
* schaalbaarheidsproblemen
* databaseproblemen
* synchronisatieproblemen
* supermarktintegratieproblemen
* GDPR-aandachtspunten
* problemen met receptimport
* problemen met eenheden
* problemen met ingrediënten-normalisatie

**Voeg zelf zaken toe die noodzakelijk zijn om van dit concept een professioneel product te maken.**

Doe niet zomaar letterlijk wat hierboven staat als je een betere technische oplossing ziet.

---

# 78. Verwachte output vóór het programmeren

Voordat je code schrijft, lever eerst een volledig technisch/productplan op.

Dat plan moet minimaal bevatten:

1. Productvisie
2. User personas
3. User journeys
4. Functionaliteiten
5. MVP-scope
6. V2/V3 roadmap
7. UX-architectuur
8. Schermoverzicht
9. Navigatiestructuur
10. Database ERD
11. Datamodel
12. API-architectuur
13. Authentication architectuur
14. Authorization model
15. Group isolation model
16. AI-architectuur
17. OCR-architectuur
18. Recipe import architecture
19. Ingredient normalization architecture
20. Shopping-list architecture
21. Supermarket integration architecture
22. Offline-first strategie
23. Synchronisatiestrategie
24. Security architecture
25. GDPR strategy
26. Testing strategy
27. Deployment architecture
28. Monitoring/logging
29. Kosteninschatting van externe services
30. Schaalbaarheidsstrategie

---

# 79. Schermen die minimaal ontworpen moeten worden

Ontwerp eerst wireframes voor:

1. Splash
2. Onboarding
3. Registratie
4. Login
5. Wachtwoord vergeten
6. Groep maken
7. Groep kiezen
8. Groepsleden
9. Uitnodigen
10. Home
11. Recepten overzicht
12. Recept zoeken
13. Filters
14. Recept detail
15. Recept toevoegen
16. URL import
17. Foto/OCR import
18. AI review
19. Recept bewerken
20. Kookmodus
21. Timer
22. Boodschappenlijst
23. Boodschappenlijst toevoegen
24. Maaltijdplanner
25. Voorraad
26. Favorieten
27. Geschiedenis
28. Profiel
29. Instellingen
30. Privacy
31. Account verwijderen

---

# 80. Definition of Done

Een feature is pas klaar wanneer:

* ze functioneel werkt
* de UI begrijpelijk is
* loading states bestaan
* empty states bestaan
* error states bestaan
* toegankelijkheid gecontroleerd is
* security gecontroleerd is
* data correct wordt opgeslagen
* data correct synchroniseert
* offline gedrag gedefinieerd is
* edge cases getest zijn
* unit tests aanwezig zijn waar relevant
* integration tests aanwezig zijn waar relevant
* geen andere groepsdata toegankelijk is

---

# 81. Belangrijkste einddoel

Het eindproduct moet voelen als:

**"Mijn digitale kookboek dat ik samen met mijn gezin/partner kan gebruiken."**

De gebruiker moet in enkele seconden kunnen:

> een recept opslaan → terugvinden → aanpassen → voor X personen zetten → ingrediënten op boodschappenlijst zetten → boodschappen doen → koken → achteraf noteren of het lekker was.

De volledige ervaring moet zo eenvoudig mogelijk zijn.

**Complexiteit moet intern in de software zitten, niet bij de gebruiker.**

---

# 82. Eerste opdracht aan de ontwikkelaar

Begin nog NIET onmiddellijk met het schrijven van de volledige applicatie.

Analyseer eerst bovenstaande requirements.

Geef:

1. Welke onderdelen ontbreken volgens jou?
2. Welke requirements zijn technisch moeilijk?
3. Welke keuzes moeten eerst gemaakt worden?
4. Welke technologieën raad je aan en waarom?
5. Welke onderdelen horen in MVP?
6. Welke onderdelen moeten absoluut later komen?
7. Hoe zou je database eruitzien?
8. Hoe zorg je ervoor dat groepen volledig van elkaar geïsoleerd zijn?
9. Hoe zou je AI/OCR implementeren?
10. Hoe zou je supermarktintegraties aanpakken?
11. Welke risico's zie je?
12. Welke UX-keuzes zijn belangrijk voor 70+ gebruikers?
13. Hoe maak je de app schaalbaar?
14. Welke kosten verwacht je voor hosting, AI, storage en externe diensten?
15. Welke onderdelen zou je anders ontwerpen dan hierboven beschreven?

Pas nadat deze analyse is goedgekeurd, begin je met architectuur, wireframes en vervolgens implementatie.

**Denk als een senior product manager, UX designer, software architect, mobile developer, backend developer, security engineer en QA engineer tegelijk.**

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dinner-dialogue-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/16b8a443-3640-435b-ab47-43b4beaf4216).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
