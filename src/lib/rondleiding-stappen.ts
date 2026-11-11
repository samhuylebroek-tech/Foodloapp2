/** Stappen van de rondleiding (alle hoofdmodules). */
export type Stap = { route: string; doel?: string; titel: string; tekst: string; kort?: boolean };

const nav = (r: string) => `[data-tour="nav-${r}"],[data-tour="tab-${r}"],[data-tour="zij-${r}"]`;

// V2: alle hoofdmodules. Kort: één zin per stap. `kort: true` = ook in de korte versie
// voor ervaren gebruikers (kennismaking "Ik kook graag en veel").
export const STAPPEN: Stap[] = [
  {
    route: "/",
    doel: nav("/"),
    titel: "Vandaag",
    tekst: "Wat je vandaag eet en wat er nog moet gebeuren. Altijd één duidelijke knop.",
    kort: true,
  },
  {
    route: "/planner",
    doel: nav("/planner"),
    titel: "Week",
    tekst: "Plan wat je deze week eet. Foodlo rekent uit wat je nodig hebt.",
    kort: true,
  },
  {
    route: "/boodschappen",
    doel: nav("/boodschappen"),
    titel: "Lijst",
    tekst: "Eén tik zet wat ontbreekt op je lijst. Wat je al hebt, laat Foodlo weg.",
    kort: true,
  },
  {
    route: "/gerechten",
    doel: nav("/gerechten"),
    titel: "Keuken",
    tekst: "Je recepten en je voorraad. Gekocht en gekookt wordt vanzelf bijgewerkt.",
    kort: true,
  },
  {
    route: "/gerechten",
    doel: 'input[placeholder="Zoek een recept…"]',
    titel: "Recepten",
    tekst:
      "Zoek op naam of ingrediënt, ook met een tikfout. Open een recept om te koken of te plannen.",
  },
  {
    route: "/voorraad",
    doel: 'input[aria-label="Nieuw product"]',
    titel: "Voorraad",
    tekst:
      "Typ wat je in huis hebt. Foodlo koopt het dan niet dubbel en toont wat je ermee kan koken.",
  },
  {
    route: "/inspiratie",
    doel: nav("/inspiratie"),
    titel: "Ontdek",
    tekst: "Nieuwe ideeën om te koken. Eén tik bewaart een recept bij de jouwe.",
    kort: true,
  },
  {
    route: "/gezin",
    doel: "#inhoud h1",
    titel: "Gezin",
    tekst: "Plan en kook samen: een gedeelde lijst, een gezinsweekmenu, en jij kiest wat je deelt.",
  },
  {
    route: "/",
    doel: '[data-tour="nieuw"]',
    titel: "Iets toevoegen",
    tekst: "Een recept, een maaltijd, een boodschap of iets in je voorraad: altijd via deze knop.",
    kort: true,
  },
  {
    route: "/",
    doel: '[data-tour="meer"]',
    titel: "Profiel en hulp",
    tekst:
      "Je profiel, instellingen, klantenkaarten en het Help Center. Hier start je deze rondleiding opnieuw.",
    kort: true,
  },
];

export function stappenVoor(kort: boolean): Stap[] {
  return kort ? STAPPEN.filter((s) => s.kort) : STAPPEN;
}
