/**
 * Functieregister: welke functies Foodlo echt heeft, op welk scherm, en aan welke knoppen of
 * kopjes je ze herkent. Bron van waarheid voor het Help Center, de onboarding en de
 * Content Manager (ONBOARDING-HELPCENTER-ONTWERP §4).
 *
 * Elke `label` moet letterlijk in de broncode voorkomen en elke `bestand` moet bestaan.
 * `src/lib/hulp/controle.test.ts` controleert dat bij elke testrun: verdwijnt of hernoemt
 * iemand een knop, dan faalt de test en wordt de uitleg als verouderd gemeld.
 */
export type ModuleId =
  "vandaag" | "week" | "lijst" | "keuken" | "ontdek" | "voorraad" | "koken" | "gezin" | "account";

export type Functie = {
  sleutel: string;
  titel: string;
  module: ModuleId;
  /** Pad in de app, zoals de gebruiker het opent. */
  route: string;
  /** Routebestand(en) onder src/routes of src/components die deze functie bevatten. */
  bestanden: string[];
  /** Zichtbare tekst of toegankelijke naam, letterlijk zoals in de code. */
  labels: string[];
};

export const MODULES: { id: ModuleId; titel: string; route: string; uitleg: string }[] = [
  {
    id: "vandaag",
    titel: "Vandaag",
    route: "/",
    uitleg: "Wat je vandaag eet en wat er nog moet gebeuren",
  },
  { id: "week", titel: "Weekmenu", route: "/planner", uitleg: "Plannen wat je deze week eet" },
  {
    id: "lijst",
    titel: "Boodschappen en winkel",
    route: "/boodschappen",
    uitleg: "Je lijst, winkelen en klantenkaarten",
  },
  {
    id: "keuken",
    titel: "Recepten",
    route: "/gerechten",
    uitleg: "Je recepten bewaren, zoeken en ordenen",
  },
  { id: "voorraad", titel: "Voorraad", route: "/voorraad", uitleg: "Wat je al in huis hebt" },
  {
    id: "koken",
    titel: "Koken",
    route: "/gerechten",
    uitleg: "Stap voor stap koken met de kookstand",
  },
  { id: "ontdek", titel: "Ontdek", route: "/inspiratie", uitleg: "Nieuwe ideeën om te koken" },
  {
    id: "gezin",
    titel: "Gezin en delen",
    route: "/gezin",
    uitleg: "Samen plannen, koken en boodschappen doen",
  },
  {
    id: "account",
    titel: "Account en privacy",
    route: "/instellingen",
    uitleg: "Instellingen, gegevens en veiligheid",
  },
];

export const FUNCTIES: Functie[] = [
  {
    sleutel: "vandaag.hoofdknop",
    titel: "Vandaag: wat nu telt",
    module: "vandaag",
    route: "/",
    bestanden: ["src/routes/index.tsx", "src/components/vandaag/NuKaart.tsx"],
    labels: ["Daarna", "Deze week", "Start koken"],
  },
  {
    sleutel: "vandaag.voorstellen",
    titel: "Voorstellen voor vanavond, met de reden erbij",
    module: "vandaag",
    route: "/",
    bestanden: [
      "src/components/kringloop/VanavondVoorstellen.tsx",
      "src/lib/intelligentie/voorstel.ts",
    ],
    labels: ["Met wat je in huis hebt", "Niet nu", "Waarom zie ik dit?"],
  },
  {
    sleutel: "koken.restjes",
    titel: "Restjes bewaren en opeten",
    module: "koken",
    route: "/voorraad",
    bestanden: [
      "src/components/kringloop/RestjeVraag.tsx",
      "src/components/kringloop/RestjesVoorstel.tsx",
      "src/components/kringloop/RestjesLijst.tsx",
      "src/components/planner/VulAan.tsx",
      "src/lib/intelligentie/restjes.ts",
    ],
    labels: [
      "Blijft er iets over?",
      "Nog restjes",
      "Eet vanavond restjes",
      "Plan restjes",
      "Restjes",
      "Is op",
    ],
  },
  {
    sleutel: "week.vul-aan",
    titel: "Vul aan met voorstellen (lege dagen in je weekmenu)",
    module: "week",
    route: "/planner",
    bestanden: ["src/components/planner/VulAan.tsx", "src/lib/intelligentie/vul-aan.ts"],
    labels: ["Vul aan met voorstellen", "Plan", "Niet nu", "Waarom zie ik dit?"],
  },
  {
    sleutel: "instellingen.voorstellen",
    titel: "Slimme voorstellen aan of uit",
    module: "account",
    route: "/instellingen",
    bestanden: ["src/routes/instellingen.tsx", "src/lib/intelligentie/slim.ts"],
    labels: ["Slimme voorstellen"],
  },
  {
    sleutel: "week.plannen",
    titel: "Een gerecht inplannen",
    module: "week",
    route: "/planner",
    bestanden: ["src/routes/planner.tsx", "src/components/planner/ReceptKiezer.tsx"],
    labels: ["Gerecht toevoegen", "Vorige week", "Volgende week"],
  },
  {
    sleutel: "week.foodlo-kiest",
    titel: "Foodlo laten kiezen",
    module: "week",
    route: "/planner",
    bestanden: ["src/routes/planner.tsx"],
    labels: ["Laat Foodlo kiezen"],
  },
  {
    sleutel: "week.naar-lijst",
    titel: "De week op je lijst zetten",
    module: "week",
    route: "/planner",
    bestanden: ["src/routes/planner.tsx"],
    labels: ["Alles van deze week op de lijst"],
  },
  {
    sleutel: "lijst.aanvullen",
    titel: "Slim aanvullen",
    module: "lijst",
    route: "/aanvullen",
    bestanden: ["src/routes/aanvullen.tsx", "src/components/kringloop/AanvulKaart.tsx"],
    labels: ["Slim aanvullen", "Zet op mijn lijst", "Haal van mijn lijst"],
  },
  {
    sleutel: "lijst.toevoegen",
    titel: "Iets op je lijst zetten",
    module: "lijst",
    route: "/boodschappen",
    bestanden: ["src/routes/boodschappen.tsx"],
    labels: ["Iets toevoegen", "Voeg toe", "Producten kiezen"],
  },
  {
    sleutel: "lijst.afvinken",
    titel: "Afvinken en ongedaan maken",
    module: "lijst",
    route: "/boodschappen",
    bestanden: ["src/routes/boodschappen.tsx"],
    labels: ["als gekocht aanvinken", "Ongedaan maken", "Wis afgevinkte boodschappen"],
  },
  {
    sleutel: "lijst.winkelmodus",
    titel: "Winkelmodus",
    module: "lijst",
    route: "/boodschappen",
    bestanden: ["src/routes/boodschappen.tsx", "src/components/winkel/Winkelmodus.tsx"],
    labels: ["Ik ga winkelen", "Klaar met winkelen", "Voor morgen nog nodig", "Zet erbij"],
  },
  {
    sleutel: "lijst.klantenkaarten",
    titel: "Klantenkaarten",
    module: "lijst",
    route: "/kaarten",
    bestanden: ["src/routes/kaarten.index.tsx", "src/components/Klantenkaarten.tsx"],
    labels: ["Klantenkaarten", "Kaart toevoegen"],
  },
  {
    sleutel: "keuken.toevoegen",
    titel: "Een recept toevoegen",
    module: "keuken",
    route: "/recepten/nieuw",
    bestanden: ["src/routes/recepten.nieuw.tsx", "src/components/RecipeForm.tsx"],
    labels: ["Hoe wil je je recept toevoegen?", "Link plakken", "Foto van recept", "Zelf typen"],
  },
  {
    sleutel: "keuken.zoeken",
    titel: "Recepten zoeken en filteren",
    module: "keuken",
    route: "/gerechten",
    bestanden: ["src/routes/gerechten.tsx"],
    labels: ["Zoek een recept…", "Filters", "Collecties"],
  },
  {
    sleutel: "keuken.favorieten",
    titel: "Favorieten en sterren",
    module: "keuken",
    route: "/gerechten",
    bestanden: ["src/routes/gerechten.tsx", "src/routes/recepten.$id.tsx"],
    labels: ["Favoriet", "Favorieten"],
  },
  {
    sleutel: "keuken.recept",
    titel: "Een recept bekijken, aanpassen en delen",
    module: "keuken",
    route: "/gerechten",
    bestanden: ["src/routes/recepten.$id.tsx"],
    labels: [
      "Inplannen",
      "Op mijn lijst",
      "Delen",
      "Aanpassen",
      "Meer personen",
      "Minder personen",
    ],
  },
  {
    sleutel: "koken.kookstand",
    titel: "Kookstand",
    module: "koken",
    route: "/gerechten",
    bestanden: ["src/routes/recepten.$id.tsx"],
    labels: ["Start koken", "Begin met koken", "Klaar met koken", "Verder koken"],
  },
  {
    sleutel: "voorraad.beheren",
    titel: "Je voorraad bijhouden",
    module: "voorraad",
    route: "/voorraad",
    bestanden: ["src/routes/voorraad.tsx"],
    labels: ["Voorraadkast", "Nieuw product", "Toevoegen"],
  },
  {
    sleutel: "voorraad.koken",
    titel: "Wat kan ik koken?",
    module: "voorraad",
    route: "/voorraad",
    bestanden: ["src/routes/voorraad.tsx"],
    labels: ["Wat kan ik koken?", "Ontbrekende op mijn lijst"],
  },
  {
    sleutel: "voorraad.gebruik-eerst",
    titel: "Gebruik eerst wat al even in huis is",
    module: "voorraad",
    route: "/voorraad",
    bestanden: ["src/routes/voorraad.tsx", "src/lib/intelligentie/gebruik-eerst.ts"],
    labels: ["Gebruik eerst", "Ik houd mijn voorraad bij"],
  },
  {
    sleutel: "ontdek.bewaren",
    titel: "Een idee bewaren",
    module: "ontdek",
    route: "/inspiratie",
    bestanden: ["src/routes/inspiratie.index.tsx", "src/routes/inspiratie.$id.tsx"],
    labels: ["Toevoegen aan mijn recepten", "Verras mij"],
  },
  {
    sleutel: "gezin.uitnodigen",
    titel: "Iemand uitnodigen in je gezin",
    module: "gezin",
    route: "/gezin",
    bestanden: ["src/routes/gezin.tsx"],
    labels: ["Iemand uitnodigen", "Uitnodiging delen", "Wacht op antwoord"],
  },
  {
    sleutel: "gezin.rechten",
    titel: "Wat je deelt met je gezin",
    module: "gezin",
    route: "/gezin",
    bestanden: ["src/routes/gezin.tsx"],
    labels: ["Wat deel ik met het gezin?", "Mijn boodschappen bekijken", "Het gezin verlaten"],
  },
  {
    sleutel: "account.instellingen",
    titel: "Instellingen en weergave",
    module: "account",
    route: "/instellingen",
    bestanden: ["src/routes/instellingen.tsx"],
    labels: ["Weergave", "Taal", "Wanneer eet je?", "Rondleiding opnieuw bekijken"],
  },
  {
    sleutel: "account.gegevens",
    titel: "Je gegevens downloaden",
    module: "account",
    route: "/instellingen",
    bestanden: ["src/routes/instellingen.tsx"],
    labels: ["Gegevens en privacy", "Mijn gegevens downloaden"],
  },
  {
    sleutel: "account.verwijderen",
    titel: "Je account verwijderen",
    module: "account",
    route: "/instellingen",
    bestanden: ["src/routes/instellingen.tsx"],
    labels: ["Account verwijderen", "Typ VERWIJDER", "Definitief verwijderen"],
  },
  {
    sleutel: "account.feedback",
    titel: "Contact en feedback",
    module: "account",
    route: "/feedback",
    bestanden: ["src/routes/feedback.tsx"],
    labels: [],
  },
];

export function functie(sleutel: string): Functie | undefined {
  return FUNCTIES.find((f) => f.sleutel === sleutel);
}

/** Bij welke module hoort een pad (voor de contextuele hulp "?")? */
export function moduleVoorPad(pad: string): ModuleId | null {
  if (pad === "/") return "vandaag";
  if (pad.startsWith("/planner")) return "week";
  if (pad.startsWith("/boodschappen") || pad.startsWith("/aanvullen") || pad.startsWith("/kaarten"))
    return "lijst";
  if (pad.startsWith("/voorraad")) return "voorraad";
  if (pad.startsWith("/gerechten") || pad.startsWith("/recepten")) return "keuken";
  if (pad.startsWith("/inspiratie")) return "ontdek";
  if (pad.startsWith("/gezin") || pad.startsWith("/vrienden") || pad.startsWith("/uitnodiging"))
    return "gezin";
  if (
    pad.startsWith("/instellingen") ||
    pad.startsWith("/meer") ||
    pad.startsWith("/meldingen") ||
    pad.startsWith("/feedback")
  )
    return "account";
  return null;
}
