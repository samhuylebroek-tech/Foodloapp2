# Proactieve kookassistent: gebruikssituaties (VOORSTEL)

> Samengevat in [`docs/foodlo/FUNCTIONAL_REQUIREMENTS.md`](../foodlo/FUNCTIONAL_REQUIREMENTS.md) (bron van waarheid sinds 2026-11-13). Dit document blijft als bron en geschiedenis.

Stand 2026-11-11. **Alleen voorgesteld.**
- **Gegevens:**
  - ✅ = bestaat vandaag;
  - 🆕 = nieuw nodig (met voorstelnummer);
  - 🔒 = gezondheidsgegevens, alleen op het toestel.
- **Plaats:** waar het voorstel verschijnt. Het is altijd een voorstel met één knop en "Ongedaan maken", nooit een automatische actie.
- **Engines:** zie FOODLOAPP-INTELLIGENCE-ARCHITECTUUR.

| # | Situatie | Waarde voor de gebruiker | Gegevens | Werking en plaats | Fase |
|---|---|---|---|---|---|
| 1 | Koude, regenachtige dinsdag, 16 u, nog niets gepland | Snel een warm idee zonder zoeken | ✅ dag en uur, ✅ eigen recepten, 🆕 weer (proxy) | Nu-kaart: "Warm eten voor een koude avond: Romige pompoensoep (35 min). Je hebt pompoen in huis." → Plan voor vanavond | I-3 |
| 2 | Zonnig weekend voorspeld, donderdagavond | Op tijd boodschappen voor een barbecue | 🆕 weersverwachting 3 dagen, ✅ weekmenu | Week: "Zaterdag 24 °C en zon. Barbecue plannen?" → 3 voorstellen | I-3 |
| 3 | Hittegolf | Frisse maaltijden zonder oven | 🆕 weer, ✅ recepten (categorie salade) | Daarna: "Te warm om te koken? 3 frisse gerechten zonder oven" | I-3 |
| 4 | Woensdag, iemand kookt op woensdag altijd snel (uit de geschiedenis) | Realistische voorstellen op drukke dagen | ✅ meal_plan-verleden, ✅ kookstand-gebeurtenissen | Weekvoorstel geeft woensdag max. 25 min. Reden: "Op woensdag kook je meestal snel" | I-2 |
| 5 | Vrijdagavond, geen stereotype; de gebruiker kookt vaak uitgebreider in het weekend | Ruimte voor iets nieuws | ✅ geschiedenis, ✅ favorieten | Nu-kaart vrijdag: "Tijd voor iets nieuws? Je bewaarde Konijn met pruimen vorige maand" | I-2 |
| 6 | Spinazie al 5 dagen in de voorraad | Minder verspilling | 🆕 0007 houdbaarheid of datum "in huis sinds" (bestaat als `created_at`) | Daarna: "Gebruik je spinazie: 2 recepten" | I-3 |
| 7 | Weekmenu half leeg op zondag | Vlot de week plannen | ✅ weekmenu, ✅ voorkeuren (vlees/vis/vega) | Week: "Vul aan met 3 voorstellen" (bestaat deels: Laat Foodlo kiezen) met redenen per voorstel | I-1 |
| 8 | Na het plannen ontbreken 6 producten | Eén tik naar de juiste lijst | ✅ kringloop (Slim aanvullen) | Bestaat: "Zet op mijn lijst". Uitbreiding: groeperen per winkel of afdeling | bestaat |
| 9 | In de winkel, citroen vergeten bij de vis van morgen | Niets vergeten | ✅ lijst, ✅ weekmenu, ✅ winkelidee | Winkelmodus: "Voor morgen nog nodig: citroen" | I-1 |
| 10 | Allergie voor noten bij de gebruiker | Veiligheid zonder uitsluiting | 🔒 allergieën (toestel), ✅ allergenen | Voorstellen sluiten noten uit; bij een eigen recept met noten een rode waarschuwing. De server weet niets | I-1 |
| 11 | Kind in het gezin lust geen vis | Minder discussie aan tafel | 🆕 0005 mee-eters met voorkeur (toestemming) | Weekvoorstel: vis alleen als iedereen mee-eet die vis eet, of met een alternatief. Reden: "Lien eet geen vis" (alleen binnen het huishouden en met toestemming) | I-4 |
| 12 | Iemand eet vanavond niet mee | Juiste hoeveelheden | ✅ porties, 🆕 "wie eet mee" per maaltijd (0005) | Nu-kaart: "Vanavond 3 personen?" → hoeveelheden en lijst aangepast | I-4 |
| 13 | Gerecht 3× in 2 weken gepland | Variatie | ✅ meal_plan | Weekvoorstel: straf voor herhaling. Reden: "Iets anders dan je pasta van dinsdag" | I-1 |
| 14 | Recept met 5 sterren al 2 maanden niet gemaakt | Lievelingsgerechten terug | ✅ recipe_ratings, ✅ meal_plan | Daarna: "Lang niet gemaakt: Stoofvlees (5 sterren)" | I-2 |
| 15 | Gebruiker tikt 3× "Niet voor mij" op curry | Voorstellen leren | 🆕 0006 feedback | Curry's minder vaak; Instellingen toont "Je zei nee tegen: curry" met terugzetten | I-2 |
| 16 | Witloof en pompoen in het seizoen (november) | Lekkerder en goedkoper | ✅ seizoen (themas.ts), 🆕 seizoenslijst per product (statisch, BE) | Ontdek: thema "Nu in het seizoen"; reden bij een voorstel | I-1 |
| 17 | Sinterklaas, Kerstmis, Pasen | Traditionele gerechten op tijd | 🆕 feestdagenkalender BE/NL (statisch) | Ontdek en Week, 10 dagen vooraf: "Kerstmenu plannen?" | I-1 |
| 18 | Restjes van gisteren (gekookt voor 6, met 3 gegeten) | Restjes gebruiken | ✅ porties, 🆕 "restje bewaard" (knop na het koken) | Volgende dag op de Nu-kaart: "Je hebt nog restjes Bolognese" | I-3 |
| 19 | Beginner opent de app op dag 2 | Niet verloren lopen | ✅ eerste stappen, ✅ Wegwijs-kaart | Bestaat; uitbreiding: "Probeer een recept van 15 min" uit voorstellen | bestaat + I-1 |
| 20 | Budget krap einde maand | Goedkoper koken | 🆕 budgetvoorkeur (€/€€/€€€ per recept, zelf ingevuld), geen prijs-API | Weekvoorstel met voorkeur € en voorraad. Geen verzonnen prijzen | I-4 |
| 21 | Morgen een laat werkschema (agenda) | Een plan dat past | 🆕 eigen notitie "morgen laat" (geen agendakoppeling) | Nu-kaart om 21 u: "Morgen laat thuis? Iets van 15 min of een restje?" | I-2 |
| 22 | Gebruiker stopte de kookstand halverwege | Verder koken | ✅ kookstand-voortgang | Bestaat: "Ga verder met koken" | bestaat |
| 23 | Elke vrijdag 18 u een melding (opt-in) | Op tijd beslissen | ✅ meldingen (cron, `daily_menu`), 🆕 voorstel in de tekst | Push: "Een idee voor vanavond: Shakshuka (30 min)". Geen gezondheidsinfo, uitknop in de melding | I-4 |
| 24 | Nieuwe gebruiker koos "ervaren" en "Foodlo stelt voor" | Snel personaliseren | ✅ kennismaking (toestel) | Eerste voorstellen meteen afgestemd; uitleg "Waarom zie ik dit?" verwijst naar de kennismaking | I-1 |
| 25 | Product steeds opnieuw gekocht en weggegooid | Bewuster kopen | ✅ shopping_history, 🆕 "weggegooid"-knop in de voorraad | Lijst: "Je koopt vaak 1 l melk en gooit de helft weg. ½ l?" | I-3 |

**Elk voorstel:**
- toont maximaal 2 redenen;
- heeft "Niet nu" en "Niet voor mij";
- kan in Instellingen uit ("Slimme voorstellen": aan of uit, per soort).

De Help Center-artikels krijgen per soort voorstel uitleg "Waarom stelt Foodlo dit voor?", gecontroleerd door de Content Manager.
