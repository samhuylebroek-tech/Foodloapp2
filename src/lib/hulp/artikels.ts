/**
 * Hulpartikels voor het Foodloapp Help Center.
 *
 * Regels (gecontroleerd door controle.test.ts):
 * - Tekst tussen dubbele aanhalingstekens is een knop, kop of veld en moet letterlijk in de
 *   app voorkomen. Zo legt de uitleg nooit een knop uit die niet (meer) bestaat.
 * - Elk artikel verwijst naar functies uit het functieregister (`src/lib/functies.ts`).
 * - `bron: "ai"` + `status: "concept"`: door AI (Claude) voorbereid op basis van de code en
 *   de demo-app. Pas na nalezing door een bevoegd persoon wordt het `goedgekeurd`. In een
 *   productie-build zijn concepten verborgen (zie `zichtbareArtikels`).
 */
import type { ModuleId } from "@/lib/functies";

export type ArtikelSoort = "handleiding" | "vraag" | "probleem";
export type Niveau = "beginner" | "ervaren" | "alle";

export type Artikel = {
  slug: string;
  titel: string;
  module: ModuleId;
  soort: ArtikelSoort;
  niveau: Niveau;
  samenvatting: string;
  stappen: string[];
  tips?: string[];
  functies: string[];
  trefwoorden: string[];
  doeHetNu?: { route: string; label: string };
  status: "concept" | "goedgekeurd";
  bron: "ai" | "mens";
  nagelezen?: { door: string; op: string };
};

const AI = { status: "concept", bron: "ai" } as const;

export const ARTIKELS: Artikel[] = [
  {
    slug: "vandaag",
    titel: "Wat zie ik op Vandaag?",
    module: "vandaag",
    soort: "handleiding",
    niveau: "beginner",
    samenvatting:
      "Vandaag toont één kaart met wat nu het belangrijkst is, met één duidelijke knop. De kaart past zich aan het uur en aan je planning aan.",
    stappen: [
      "Open Foodlo. Je komt op Vandaag.",
      "Bovenaan staat wat nu telt: een gerecht kiezen, ontbrekende producten op je lijst zetten, winkelen of koken. 's Avonds kijkt Vandaag al naar morgen.",
      'Tik op de grote knop op de kaart om meteen verder te gaan, bijvoorbeeld "Zet op mijn lijst" of "Start koken".',
      'Onder "Daarna" zie je wat er later nog komt. Onder "Deze week" zie je je weekmenu in één oogopslag.',
    ],
    functies: ["vandaag.hoofdknop"],
    trefwoorden: ["start", "begin", "overzicht", "vanavond", "wat eten we"],
    doeHetNu: { route: "/", label: "Open Vandaag" },
    ...AI,
  },
  {
    slug: "restjes",
    titel: "Restjes bewaren en opeten",
    module: "koken",
    soort: "handleiding",
    niveau: "alle",
    samenvatting:
      "Blijft er na het koken iets over, dan onthoudt Foodlo dat. De komende dagen stelt het voor om de restjes op te eten, zodat er minder weggegooid wordt.",
    stappen: [
      'Na de laatste stap in de kookstand vraagt Foodlo "Blijft er iets over?". Tik op het aantal porties.',
      'Staat er de volgende dagen nog niets gepland, dan zie je op Vandaag "Nog restjes". Tik op "Eet vanavond restjes": het staat dan op vanavond, en er komt niets op je lijst.',
      'In Week, bij "Vul aan met voorstellen", komen je restjes eerst: op de eerste lege dag waarop ze nog goed zijn. Tik op "Plan restjes".',
      'In Keuken zie je onder "Restjes" wat je nog hebt, wanneer je het kookte en of het al gepland is. Tik op "Is op" als het op is.',
      "Ongedaan maken kan altijd meteen.",
    ],
    tips: [
      "Foodlo stelt restjes hooguit 3 dagen na het koken voor. Bewaar ze in de koelkast en kijk zelf of ze nog goed zijn.",
      "Je restjes staan voorlopig alleen op dit toestel, niet bij je gezin.",
      "Heb je allergieën of een dieet aangeduid, dan stelt Foodlo een restje alleen voor als het de ingrediënten kent en ze veilig zijn.",
    ],
    functies: ["koken.restjes"],
    trefwoorden: ["restjes", "overschot", "over", "verspilling", "porties", "koelkast"],
    doeHetNu: { route: "/voorraad", label: "Bekijk je restjes" },
    ...AI,
  },
  {
    slug: "voorstellen",
    titel: "Waarom stelt Foodlo dit voor?",
    module: "vandaag",
    soort: "vraag",
    niveau: "alle",
    samenvatting:
      "Staat er vandaag nog niets gepland, dan stelt Foodlo tot drie gerechten uit je eigen recepten voor. Onder elk gerecht staat waarom: bijvoorbeeld wat je al in huis hebt, hoe snel het klaar is of dat je het lang niet maakte.",
    stappen: [
      'Op Vandaag zie je onder "Met wat je in huis hebt" tot drie voorstellen. Onder de naam staan één of twee redenen.',
      "Foodlo kijkt naar je voorraad, je eigen kooktijd op deze weekdag, het seizoen, feestdagen die eraan komen, je sterren en favorieten, en wat je onlangs at.",
      'Tik op "Vanavond" om het gerecht in te plannen. Wat ontbreekt, komt op je lijst. Je kan dat meteen ongedaan maken.',
      'Tik op "Niet nu" als je het even niet wil. Je ziet het voorstel dan een week niet.',
      'In Week zie je "Vul aan met voorstellen" als er nog minstens twee dagen leeg zijn: per dag één gerecht, met de reden erbij. Tik op "Plan" voor één dag of zet ze allemaal in je weekmenu. Ongedaan maken kan meteen.',
      "Gerechten met een allergeen dat je bij de kennismaking aanduidde, en wat je bij je weekmenu onder liever niet zette, stelt Foodlo nooit voor.",
      'Liever geen voorstellen? Zet "Slimme voorstellen" uit in Instellingen. Je recepten, weekmenu en lijst blijven gewoon werken.',
    ],
    tips: [
      "Foodlo doet nooit iets vanzelf: elk voorstel vraagt jouw tik.",
      "Je allergieën en dieet blijven op dit toestel. Het voorstel wordt op je toestel berekend.",
      "Seizoen betekent: groenten en fruit die in België ongeveer in die maand van eigen bodem komen, zoals witloof en pompoen in november. Het weer kan dat een paar weken verschuiven.",
    ],
    functies: ["vandaag.voorstellen", "week.vul-aan", "instellingen.voorstellen"],
    trefwoorden: ["voorstel", "voorstellen", "waarom", "suggestie", "idee", "vanavond", "niet nu"],
    doeHetNu: { route: "/", label: "Open Vandaag" },
    ...AI,
  },
  {
    slug: "recept-toevoegen",
    titel: "Een recept toevoegen",
    module: "keuken",
    soort: "handleiding",
    niveau: "beginner",
    samenvatting:
      "Je kan een recept toevoegen via een link, een foto van een kookboek of briefje, door zelf te typen, of door te zoeken op naam.",
    stappen: [
      'Tik bovenaan op "Nieuw" en kies "Recept toevoegen".',
      'Kies hoe: "Link plakken", "Foto van recept", "Zelf typen" of "Zoeken".',
      'Bij een link: plak de link en tik op "Inlezen". Foodlo haalt de ingrediënten en stappen eruit. Lees het voorstel na en pas aan wat niet klopt.',
      'Tik op "Bewaren". Het recept staat nu bij je recepten.',
    ],
    tips: [
      "Een link of foto inlezen gebruikt AI en kan credits kosten. Zelf typen kost niets.",
      "Wat je half invult, blijft bewaard als concept tot je terugkomt.",
    ],
    functies: ["keuken.toevoegen"],
    trefwoorden: [
      "recept bewaren",
      "importeren",
      "link",
      "instagram",
      "tiktok",
      "kookboek",
      "foto",
      "toevoegen",
    ],
    doeHetNu: { route: "/recepten/nieuw", label: "Recept toevoegen" },
    ...AI,
  },
  {
    slug: "idee-bewaren",
    titel: "Een idee uit Ontdek bewaren",
    module: "ontdek",
    soort: "handleiding",
    niveau: "beginner",
    samenvatting:
      "In Ontdek vind je nieuwe ideeën. Met één knop neem je er een over in je eigen recepten.",
    stappen: [
      "Open Ontdek in het menu.",
      'Zoek, kies een thema onder "Thema\'s", of tik op "Verras mij".',
      'Open een gerecht en tik op "Toevoegen aan mijn recepten".',
      'Kijk bij "Klopt alles?" de gegevens na en bewaar.',
    ],
    functies: ["ontdek.bewaren"],
    trefwoorden: ["inspiratie", "ideeën", "nieuw recept", "bewaren", "ontdekken"],
    doeHetNu: { route: "/inspiratie", label: "Open Ontdek" },
    ...AI,
  },
  {
    slug: "week-plannen",
    titel: "Je week plannen",
    module: "week",
    soort: "handleiding",
    niveau: "beginner",
    samenvatting:
      "In het weekmenu zet je per dag en per moment een gerecht. Foodlo rekent daarna uit wat je moet kopen.",
    stappen: [
      "Open Week in het menu.",
      'Kies een dag bovenaan. Met "Vorige week" en "Volgende week" blader je.',
      'Tik op "Gerecht toevoegen" bij het moment dat je wil plannen en kies een recept.',
      'Vanuit een recept kan het ook: tik op "Inplannen".',
      'Klaar met plannen? Tik op "Slim aanvullen". Wat je al hebt, laat Foodlo weg.',
      'Liever zelf kiezen welke dagen? Tik op "Of kies zelf welke dagen op de lijst komen".',
    ],
    tips: [
      'Met "Laat Foodlo kiezen" krijg je een voorstel voor de week. Je beslist zelf wat je houdt.',
    ],
    functies: ["week.plannen", "week.naar-lijst", "week.foodlo-kiest"],
    trefwoorden: [
      "weekmenu",
      "planning",
      "plannen",
      "maaltijd",
      "avondeten",
      "inplannen",
      "kalender",
    ],
    doeHetNu: { route: "/planner", label: "Open het weekmenu" },
    ...AI,
  },
  {
    slug: "slim-aanvullen",
    titel: "Slim aanvullen: alleen kopen wat je nodig hebt",
    module: "lijst",
    soort: "handleiding",
    niveau: "alle",
    samenvatting:
      "Foodlo vergelijkt je weekmenu met je voorraad en je lijst. Wat ontbreekt, zet je met één tik op je lijst. Wat je al hebt, laat Foodlo weg.",
    stappen: [
      "Plan eerst een paar gerechten in je weekmenu.",
      'Op Vandaag of op je lijst zie je hoeveel dingen ontbreken. Tik op "Zet op mijn lijst".',
      'Wil je eerst kijken wat er precies bij komt? Open "Slim aanvullen". Per product zie je voor welk gerecht het is.',
      'Onder "In huis — toch nodig? Tik erop" staan producten die je volgens je voorraad al hebt. Tik erop als je ze toch wil kopen.',
      'Staat er iets op je lijst voor een gerecht dat niet meer gepland is? Dan kan je het weghalen met "Haal van mijn lijst".',
    ],
    tips: ['Na het toevoegen kan je alles terugdraaien met "Ongedaan maken".'],
    functies: ["lijst.aanvullen"],
    trefwoorden: [
      "boodschappen",
      "ontbreekt",
      "tekort",
      "aanvullen",
      "lijst maken",
      "wat moet ik kopen",
    ],
    doeHetNu: { route: "/aanvullen", label: "Open Slim aanvullen" },
    ...AI,
  },
  {
    slug: "lijst-gebruiken",
    titel: "Je boodschappenlijst gebruiken",
    module: "lijst",
    soort: "handleiding",
    niveau: "beginner",
    samenvatting:
      "Zet producten op je lijst, vink af wat je gekocht hebt en draai een vergissing terug.",
    stappen: [
      "Open Lijst in het menu.",
      'Typ bij "Iets toevoegen" wat je nodig hebt, bijvoorbeeld ‘6 eieren’, en tik op "Voeg toe". Of kies uit tegels met "Producten kiezen".',
      'Gekocht? Tik op het product om het af te vinken. Het gaat naar "In je kar".',
      'Vergist? Tik op "Ongedaan maken".',
      'Klaar? Met "Wis afgevinkte boodschappen" maak je de lijst weer leeg.',
    ],
    functies: ["lijst.toevoegen", "lijst.afvinken"],
    trefwoorden: ["boodschappenlijst", "afvinken", "toevoegen", "product", "gekocht", "lijst"],
    doeHetNu: { route: "/boodschappen", label: "Open je lijst" },
    ...AI,
  },
  {
    slug: "winkelmodus",
    titel: "Winkelen met de winkelmodus",
    module: "lijst",
    soort: "handleiding",
    niveau: "alle",
    samenvatting:
      "De winkelmodus toont je lijst groot en per afdeling. Na het winkelen zet Foodlo wat je kocht in je voorraad.",
    stappen: [
      'Open je lijst en tik op "Ik ga winkelen".',
      "Tik op een product om het af te vinken. Het verdwijnt meteen uit beeld.",
      'Mis je nog iets voor de gerechten van vandaag of morgen, dan zie je bovenaan "Voor morgen nog nodig" met wat er ontbreekt. Tik op "Zet erbij" om het op je lijst te zetten. Je kan dat meteen ongedaan maken.',
      'Klaar? Tik op "Klaar met winkelen". Wat je gekocht hebt, gaat naar je voorraad.',
    ],
    functies: ["lijst.winkelmodus"],
    trefwoorden: ["winkel", "supermarkt", "winkelen", "kassa", "afdelingen", "vergeten", "morgen"],
    doeHetNu: { route: "/boodschappen", label: "Naar je lijst" },
    ...AI,
  },
  {
    slug: "voorraad",
    titel: "Je voorraad bijhouden",
    module: "voorraad",
    soort: "handleiding",
    niveau: "beginner",
    samenvatting:
      "Je voorraad bijhouden is niet nodig. Doe je het wel, dan helpt het Foodlo om niet te kopen wat je al hebt, en toont het wat je ermee kan koken.",
    stappen: [
      'Houd je je voorraad niet bij, dan gaat Foodlo er niet van uit dat iets nog in huis is. Zet je zelf iets in je voorraad, dan staat "Ik houd mijn voorraad bij" aan. Je kan dat altijd uitzetten, ook in Instellingen.',
      'Open Keuken en kies Voorraad, of tik op "Nieuw" en kies "Iets in de voorraad".',
      'Typ bij "Nieuw product" wat je hebt, bijvoorbeeld ‘500 g rijst’, en tik op "Toevoegen".',
      "Met de plus- en minknoppen pas je de hoeveelheid aan.",
      'Onder "Wat kan ik koken?" zie je recepten met wat je in huis hebt. Met "Ontbrekende op mijn lijst" zet je de rest op je lijst.',
      'Bij verse producten die al even in huis zijn, staat hoeveel dagen al. Bovenaan staat dan "Gebruik eerst", en recepten die ze opmaken komen eerst. Ook op Vandaag zie je "Gebruik eerst" boven de voorstellen. Gebruikt geen enkel recept het product, dan tik je op "Zoek een idee met" om in Ontdek te zoeken.',
    ],
    tips: [
      'Na "Klaar met winkelen" en na het koken past Foodlo je voorraad zelf aan ("Voorraad bijgewerkt").',
      "Foodlo kent de houdbaarheidsdatum niet. Het telt vanaf wanneer je het product kocht of toevoegde, en kijkt naar de soort product (vis sneller dan uien). Kijk zelf of iets nog goed is.",
    ],
    functies: ["voorraad.beheren", "voorraad.koken", "voorraad.gebruik-eerst"],
    trefwoorden: ["voorraadkast", "in huis", "koelkast", "kast", "restjes", "wat kan ik koken"],
    doeHetNu: { route: "/voorraad", label: "Open je voorraad" },
    ...AI,
  },
  {
    slug: "kookstand",
    titel: "Koken met de kookstand",
    module: "koken",
    soort: "handleiding",
    niveau: "beginner",
    samenvatting:
      "De kookstand toont één stap tegelijk in grote letters, met wat je bij die stap nodig hebt. Je kan stoppen en later verder koken.",
    stappen: [
      'Open een recept en tik op "Start koken".',
      'Tik op "Begin met koken". Blader met de knoppen of met de pijltjestoetsen naar de volgende stap.',
      'Moet je even weg? Je stap blijft bewaard. Later zie je "Verder koken".',
      'Op het einde tik je op "Klaar met koken" en geef je een score. Foodlo past je voorraad aan.',
    ],
    functies: ["koken.kookstand"],
    trefwoorden: ["koken", "kookmodus", "cooking mode", "stappen", "bereiding", "timer"],
    doeHetNu: { route: "/gerechten", label: "Kies een recept" },
    ...AI,
  },
  {
    slug: "zoeken-favorieten",
    titel: "Recepten terugvinden: zoeken, filters en favorieten",
    module: "keuken",
    soort: "handleiding",
    niveau: "alle",
    samenvatting:
      "Zoek op naam of ingrediënt, ook met een tikfout. Filter op soort, tijd en moeilijkheid, of markeer je lievelingsrecepten.",
    stappen: [
      "Open Keuken.",
      'Typ in "Zoek een recept…" een naam of ingrediënt. Een kleine tikfout is geen probleem.',
      'Tik op "Filters" om te kiezen op soort, duurtijd of moeilijkheid.',
      'Onder "Collecties" vind je je recepten per groep, zoals "Favorieten".',
      'Open een recept en tik op "Favoriet" om het bij je favorieten te zetten.',
    ],
    functies: ["keuken.zoeken", "keuken.favorieten"],
    trefwoorden: ["zoeken", "vinden", "filter", "favoriet", "lievelings", "ingrediënt"],
    doeHetNu: { route: "/gerechten", label: "Open je recepten" },
    ...AI,
  },
  {
    slug: "porties-delen",
    titel: "Porties aanpassen, een recept delen of aanpassen",
    module: "keuken",
    soort: "handleiding",
    niveau: "ervaren",
    samenvatting: "Op een recept pas je het aantal personen aan, deel je het, of wijzig je het.",
    stappen: [
      "Open een recept.",
      'Met "Meer personen" en "Minder personen" rekent Foodlo de hoeveelheden om.',
      'Met "Delen" stuur je een link. Met "Aanpassen" wijzig je het recept.',
      'Met "Op mijn lijst" zet je de ingrediënten op je boodschappenlijst.',
    ],
    functies: ["keuken.recept"],
    trefwoorden: ["personen", "porties", "hoeveelheid", "delen", "aanpassen", "wijzigen"],
    ...AI,
  },
  {
    slug: "gezin-uitnodigen",
    titel: "Je gezin uitnodigen",
    module: "gezin",
    soort: "handleiding",
    niveau: "beginner",
    samenvatting:
      "Met een gezin plan je samen, deel je een gezinslijst en zie je elkaars voorraad.",
    stappen: [
      'Tik op "Meer" en kies "Vrienden en gezin".',
      'Onder "Iemand uitnodigen" zoek je op naam, Foodlo-naam of e-mailadres. Of tik op "Uitnodiging delen" en stuur de link zelf.',
      'Wie nog niet geantwoord heeft, staat onder "Wacht op antwoord". Je kan de uitnodiging daar intrekken.',
    ],
    functies: ["gezin.uitnodigen"],
    trefwoorden: [
      "gezin",
      "partner",
      "vrouw",
      "man",
      "kinderen",
      "familie",
      "samen",
      "uitnodigen",
      "delen",
      "huisgenoot",
    ],
    doeHetNu: { route: "/gezin", label: "Open je gezin" },
    ...AI,
  },
  {
    slug: "gezin-delen",
    titel: "Wat zien je gezinsleden van jou?",
    module: "gezin",
    soort: "vraag",
    niveau: "alle",
    samenvatting:
      "Jij kiest wat je deelt: je recepten, je weekmenu en je boodschappen, telkens bekijken of bewerken. Je voorraad is altijd zichtbaar voor actieve gezinsleden.",
    stappen: [
      'Open je gezin en ga naar "Wat deel ik met het gezin?".',
      'Zet aan of uit wat anderen mogen zien of bewerken, bijvoorbeeld "Mijn boodschappen bekijken".',
      "De gezinslijst is altijd van het hele gezin.",
      "Je voorraad blijft zichtbaar voor actieve gezinsleden, zodat niemand dubbel koopt. Andere privégegevens zijn niet zichtbaar.",
      'Wil je niets meer delen? Tik op "Het gezin verlaten".',
    ],
    functies: ["gezin.rechten"],
    trefwoorden: ["privacy", "zien", "delen", "rechten", "voorraad", "gezinslid"],
    ...AI,
  },
  {
    slug: "klantenkaarten",
    titel: "Klantenkaarten tonen aan de kassa",
    module: "lijst",
    soort: "handleiding",
    niveau: "alle",
    samenvatting:
      "Bewaar je klantenkaarten in Foodlo en toon ze aan de kassa, ook zonder internet.",
    stappen: [
      'Tik op "Meer" en kies "Klantenkaarten".',
      "Voeg een kaart toe en kies je winkel.",
      'Aan de kassa open je de kaart met "Tonen".',
    ],
    functies: ["lijst.klantenkaarten"],
    trefwoorden: ["klantenkaart", "kaart", "kassa", "barcode", "colruyt", "delhaize"],
    doeHetNu: { route: "/kaarten", label: "Open je kaarten" },
    ...AI,
  },
  {
    slug: "instellingen",
    titel: "Taal, kleuren en etenstijden instellen",
    module: "account",
    soort: "handleiding",
    niveau: "alle",
    samenvatting:
      "In Instellingen kies je je taal, kleuren, welke momenten je plant en wanneer je eet.",
    stappen: [
      'Tik op "Meer" en kies "Instellingen".',
      'Onder "Weergave" kies je kleuren, bijvoorbeeld "Extra duidelijk" voor meer contrast.',
      'Bij "Taal" kies je de taal van de app.',
      'Onder "Wanneer eet je?" vul je je etenstijden in. Vandaag gebruikt die om op het juiste moment te helpen.',
    ],
    functies: ["account.instellingen"],
    trefwoorden: [
      "taal",
      "kleur",
      "contrast",
      "donker",
      "etenstijd",
      "instellingen",
      "grote tekst",
    ],
    doeHetNu: { route: "/instellingen", label: "Open Instellingen" },
    ...AI,
  },
  {
    slug: "rondleiding",
    titel: "De rondleiding opnieuw bekijken",
    module: "account",
    soort: "vraag",
    niveau: "beginner",
    samenvatting:
      "De korte rondleiding kan je altijd opnieuw starten. Hij gaat verder waar je gebleven was.",
    stappen: [
      'Tik op "Meer" en kies "Rondleiding".',
      'Of ga naar Instellingen en tik op "Rondleiding opnieuw bekijken".',
    ],
    functies: ["account.instellingen"],
    trefwoorden: ["rondleiding", "uitleg", "uitleg opnieuw", "tour", "hoe werkt"],
    doeHetNu: { route: "/rondleiding", label: "Start de rondleiding" },
    ...AI,
  },
  {
    slug: "gegevens-downloaden",
    titel: "Je gegevens downloaden",
    module: "account",
    soort: "vraag",
    niveau: "alle",
    samenvatting: "Je kan op elk moment een bestand downloaden met al je gegevens in Foodlo.",
    stappen: [
      "Open Instellingen.",
      'Ga naar "Gegevens en privacy" en tik op "Mijn gegevens downloaden".',
    ],
    functies: ["account.gegevens"],
    trefwoorden: ["gegevens", "export", "download", "avg", "gdpr", "privacy", "kopie"],
    ...AI,
  },
  {
    slug: "account-verwijderen",
    titel: "Je account verwijderen",
    module: "account",
    soort: "vraag",
    niveau: "alle",
    samenvatting:
      "Je kan je account en al je gegevens definitief verwijderen. Ben je eigenaar van een gezin, dan gaat het gezin naar een ander lid.",
    stappen: [
      'Open Instellingen en tik onderaan op "Account verwijderen".',
      'Typ het woord VERWIJDER in het veld "Typ VERWIJDER" en tik op "Definitief verwijderen".',
      "Je recepten, weekmenu's, lijsten en foto's worden gewist. Een gezin waarvan jij eigenaar bent, gaat naar het langst actieve lid, met de gezinslijst.",
    ],
    tips: ["Download eerst je gegevens als je ze wil bewaren."],
    functies: ["account.verwijderen"],
    trefwoorden: ["verwijderen", "stoppen", "opzeggen", "account wissen", "gegevens wissen"],
    ...AI,
  },
  {
    slug: "niet-bewaard",
    titel: 'Ik zie "nog niet bewaard" bij mijn lijst',
    module: "lijst",
    soort: "probleem",
    niveau: "alle",
    samenvatting:
      "Je wijziging kon even niet naar de server, meestal omdat de verbinding wegviel. Foodlo probeert het vanzelf opnieuw.",
    stappen: [
      "Doe niets: Foodlo probeert het tot vijf keer opnieuw zodra je verbinding terug is.",
      'Lukt het ook dan niet, dan zie je "Kijk je lijst even na". Kijk dan of je laatste wijziging er staat en doe ze anders opnieuw.',
    ],
    functies: ["lijst.afvinken"],
    trefwoorden: [
      "offline",
      "geen internet",
      "niet bewaard",
      "fout",
      "verbinding",
      "winkel zonder bereik",
    ],
    ...AI,
  },
  {
    slug: "al-in-huis",
    titel: 'Waarom staat er een afdeling "Al in huis?" op mijn lijst?',
    module: "lijst",
    soort: "probleem",
    niveau: "alle",
    samenvatting:
      "Volgens je voorraad heb je die producten al, maar ze staan toch op je lijst. Foodlo zet ze apart, zodat je even nadenkt voor je ze koopt.",
    stappen: [
      "Kijk thuis of je het product nog hebt.",
      "Heb je het? Dan mag het van je lijst. Heb je het niet meer? Pas je voorraad aan, zodat Foodlo het de volgende keer weet.",
    ],
    functies: ["lijst.aanvullen", "voorraad.beheren"],
    trefwoorden: ["dubbel", "al in huis", "voorraad klopt niet", "waarom op mijn lijst"],
    ...AI,
  },
  {
    slug: "aanmelden-lukt-niet",
    titel: "Aanmelden lukt niet",
    module: "account",
    soort: "probleem",
    niveau: "alle",
    samenvatting:
      "Controleer je e-mailadres en wachtwoord. Wachtwoord vergeten? Dan stel je een nieuw in via e-mail.",
    stappen: [
      "Kijk of je e-mailadres juist is, zonder spatie op het einde.",
      'Tik op "Wachtwoord vergeten" en volg de link in de e-mail.',
      'Lukt het nog altijd niet? Neem contact op met support via "Feedback".',
    ],
    functies: ["account.feedback"],
    trefwoorden: ["aanmelden", "inloggen", "wachtwoord", "vergeten", "lukt niet", "login"],
    ...AI,
  },
  {
    slug: "allergieen",
    titel: "Houdt Foodlo rekening met mijn allergieën?",
    module: "keuken",
    soort: "vraag",
    niveau: "alle",
    samenvatting:
      "Je kan bij de kennismaking allergieën aanduiden. Foodlo waarschuwt dan bij een recept als een ingrediënt mogelijk een allergeen bevat. Dat is een hulp, geen garantie.",
    stappen: [
      "Je allergieën blijven alleen op dit toestel. Ze gaan niet naar je gezin of naar Foodlo, en worden gewist als je je afmeldt.",
      "Op een recept zie je een waarschuwing als een ingrediënt mogelijk een allergeen bevat.",
      'Foodlo stelt nooit vanzelf een gerecht voor met een allergeen dat je koos: niet op Vandaag, niet in je weekmenu, niet bij "Wat kan ik koken?" en niet bij "Verras mij".',
      'Staan er geen ingrediënten bij een gerecht, dan kan Foodlo het niet nakijken. Je ziet dan "Niet gecontroleerd op allergieën", en Foodlo stelt het niet vanzelf voor.',
      "Vervang je in de winkel een product, dan kijkt Foodlo ook dat opnieuw na.",
      "Lees altijd zelf het etiket van een product. Foodlo kent niet elke samenstelling.",
    ],
    tips: [
      "Ideeën van de AI zijn nog niet nagekeken. Pas als het recept met ingrediënten gemaakt is, kijkt Foodlo het na. Je allergieën gaan nooit naar de AI.",
    ],
    functies: ["keuken.recept"],
    trefwoorden: ["allergie", "allergieën", "noten", "gluten", "lactose", "dieet", "intolerantie"],
    ...AI,
  },
];

/** In een productie-build alleen goedgekeurde artikels; lokaal en in tests ook concepten. */
export function toonConcepten(): boolean {
  const env = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
  return env["DEV"] === true || env["VITE_HULP_CONCEPTEN"] === "1";
}

export function zichtbareArtikels(metConcepten = toonConcepten()): Artikel[] {
  return ARTIKELS.filter((a) => a.status === "goedgekeurd" || metConcepten);
}

export function artikel(slug: string): Artikel | undefined {
  return ARTIKELS.find((a) => a.slug === slug);
}

/** Tekst tussen dubbele aanhalingstekens = een knop, kop of veld uit de app. */
export function geciteerdeLabels(a: Artikel): string[] {
  const tekst = [a.titel, a.samenvatting, ...a.stappen, ...(a.tips ?? [])].join("\n");
  return [...tekst.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}
