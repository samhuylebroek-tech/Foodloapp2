// Demodata voor de lokale V2-preview en schermafbeeldingen.
// Volledig verzonnen; bevat geen echte gebruikers of productiedata.

export const DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";
const LIJST = "22222222-2222-4222-8222-222222222222";

function dag(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const R = (n) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;

const RECEPTEN = [
  {
    n: 1,
    title: "Stoofvlees met frietjes",
    category: "hoofdgerecht",
    tags: ["vlees", "Belgisch"],
    description: "Het Vlaamse klassiekertje: mals rundvlees, donker bier en een snee peperkoek.",
    prep: 20,
    cook: 150,
    diff: "gemiddeld",
    servings: 4,
    ingr: [
      ["rundvlees (stoofvlees)", 1, "kg"],
      ["uien", 3, ""],
      ["donker bier", 50, "cl"],
      ["peperkoek", 2, "snee"],
      ["mosterd", 2, "el"],
      ["laurierblaadjes", 2, ""],
      ["boter", 30, "g"],
    ],
    stappen: [
      "Snij het vlees in blokjes en dep het droog.",
      "Bak het vlees in porties bruin in de boter.",
      "Stoof de uien glazig in dezelfde pot.",
      "Blus met het bier en voeg laurier toe.",
      "Besmeer de peperkoek met mosterd en leg hem bovenop.",
      "Laat 2,5 uur zachtjes stoven met het deksel op de pot.",
    ],
  },
  {
    n: 2,
    title: "Romige pompoensoep",
    category: "soep",
    tags: ["vegetarisch", "herfst"],
    description: "Fluweelzacht, licht pittig en klaar in een halfuurtje.",
    prep: 10,
    cook: 25,
    diff: "makkelijk",
    servings: 4,
    ingr: [
      ["pompoen", 1, "kg"],
      ["ui", 1, ""],
      ["groentebouillon", 1, "l"],
      ["kokosmelk", 20, "cl"],
      ["gember", 1, "tl"],
    ],
    stappen: [
      "Snij pompoen en ui in stukken.",
      "Fruit de ui en voeg pompoen en gember toe.",
      "Giet de bouillon erbij en laat 20 minuten koken.",
      "Mix fijn en roer de kokosmelk erdoor.",
    ],
  },
  {
    n: 3,
    title: "Zalm met citroen en dille",
    category: "hoofdgerecht",
    tags: ["vis", "snel"],
    description: "Uit de oven, frisse citroen en verse dille. Lekker met krieltjes.",
    prep: 10,
    cook: 15,
    diff: "makkelijk",
    servings: 2,
    ingr: [
      ["zalmfilet", 2, "stuk(s)"],
      ["citroen", 1, ""],
      ["verse dille", 1, "bos"],
      ["olijfolie", 2, "el"],
      ["krieltjes", 500, "g"],
    ],
    stappen: [
      "Verwarm de oven voor op 200 graden.",
      "Leg de zalm op een bakplaat met citroenschijfjes.",
      "Besprenkel met olijfolie en dille.",
      "Bak 12 tot 15 minuten.",
    ],
  },
  {
    n: 4,
    title: "Spaghetti bolognese",
    category: "hoofdgerecht",
    tags: ["vlees", "kinderen"],
    description: "Rijke tomatensaus die je gerust een dag op voorhand maakt.",
    prep: 15,
    cook: 45,
    diff: "makkelijk",
    servings: 4,
    ingr: [
      ["spaghetti", 400, "g"],
      ["rundergehakt", 500, "g"],
      ["passata", 70, "cl"],
      ["wortel", 2, ""],
      ["selder", 2, "stuk(s)"],
      ["look", 2, "teen(tjes)"],
    ],
    stappen: [
      "Snij wortel, selder en look fijn.",
      "Bak het gehakt rul.",
      "Voeg de groenten en passata toe en laat 40 minuten pruttelen.",
      "Kook de spaghetti beetgaar en serveer.",
    ],
  },
  {
    n: 5,
    title: "Chocolademousse",
    category: "nagerecht",
    tags: ["vegetarisch", "feest"],
    description: "Luchtig, puur en met maar vier ingrediënten.",
    prep: 20,
    cook: 0,
    diff: "gemiddeld",
    servings: 6,
    ingr: [
      ["pure chocolade", 200, "g"],
      ["eieren", 4, ""],
      ["suiker", 40, "g"],
      ["snufje zout", null, ""],
    ],
    stappen: [
      "Smelt de chocolade au bain-marie.",
      "Splits de eieren.",
      "Klop het eiwit met suiker stijf.",
      "Meng de dooiers door de chocolade en spatel het eiwit erdoor.",
      "Laat minstens 4 uur opstijven.",
    ],
  },
  {
    n: 6,
    title: "Griekse salade",
    category: "salade",
    tags: ["vegetarisch", "zomer", "snel"],
    description: "Krokant, zilt en zonnig.",
    prep: 15,
    cook: 0,
    diff: "makkelijk",
    servings: 2,
    ingr: [
      ["tomaten", 4, ""],
      ["komkommer", 1, ""],
      ["feta", 200, "g"],
      ["zwarte olijven", 100, "g"],
      ["rode ui", 1, ""],
    ],
    stappen: [
      "Snij alle groenten in grove stukken.",
      "Verbrokkel de feta erover.",
      "Werk af met olijven, oregano en olijfolie.",
    ],
  },
  {
    n: 7,
    title: "Overnight oats met frambozen",
    category: "ontbijt",
    tags: ["vegetarisch", "snel"],
    description: "'s Avonds maken, 's ochtends genieten.",
    prep: 5,
    cook: 0,
    diff: "makkelijk",
    servings: 1,
    ingr: [
      ["havermout", 50, "g"],
      ["melk", 15, "cl"],
      ["yoghurt", 2, "el"],
      ["frambozen", 80, "g"],
    ],
    stappen: [
      "Meng havermout, melk en yoghurt in een pot.",
      "Zet een nacht in de koelkast.",
      "Werk af met frambozen.",
    ],
  },
  {
    n: 8,
    title: "Witloof met hesp en kaassaus",
    category: "hoofdgerecht",
    tags: ["vlees", "Belgisch", "oven"],
    description: "Oma's ovenschotel, nog altijd onverslaanbaar.",
    prep: 20,
    cook: 30,
    diff: "gemiddeld",
    servings: 4,
    ingr: [
      ["witloof", 8, "stuk(s)"],
      ["gekookte hesp", 8, "snee"],
      ["melk", 50, "cl"],
      ["gemalen kaas", 150, "g"],
      ["boter", 40, "g"],
      ["bloem", 40, "g"],
    ],
    stappen: [
      "Kook het witloof 10 minuten en laat goed uitlekken.",
      "Maak een roux van boter en bloem en voeg de melk toe.",
      "Roer de kaas door de saus.",
      "Rol elk witloofje in een snee hesp en leg in een ovenschaal.",
      "Giet de saus erover en gratineer 20 minuten op 200 graden.",
    ],
  },
];

/** Ontdek-catalogus voor de demo (verzonnen, geen productiedata). Foto's: alleen de twee CC0-demofoto's. */
const INSPIRATIE = [
  [
    "Vlaamse stoverij met frietjes",
    "hoofdgerecht",
    30,
    150,
    ["vlees", "stoof"],
    "demo/stoofvlees.jpg",
  ],
  [
    "Romige pompoensoep met gember",
    "soep",
    15,
    25,
    ["vegetarisch", "soep"],
    "demo/pompoensoep.jpg",
  ],
  ["Stoemp met spinazie en spek", "hoofdgerecht", 15, 25, ["vlees", "stoemp"], null],
  [
    "Witloofgratin met hesp en kaas",
    "hoofdgerecht",
    20,
    40,
    ["vlees", "ovenschotel", "witloof"],
    null,
  ],
  ["Pasta met pesto en geroosterde groenten", "hoofdgerecht", 10, 20, ["vegetarisch"], null],
  ["Linzensoep met komijn", "soep", 10, 30, ["vegetarisch", "soep"], null],
  ["Zalm uit de oven met citroen", "hoofdgerecht", 10, 20, ["vis"], null],
  ["Shakshuka met feta", "hoofdgerecht", 10, 20, ["vegetarisch"], null],
  ["Konijn met pruimen", "hoofdgerecht", 30, 120, ["vlees", "stoof"], null],
  ["Appeltaart van oma", "nagerecht", 30, 60, ["vegetarisch"], null],
].map(([title, category, prep, cook, tags, foto], i) => ({
  id: `eeeeeeee-0000-4000-8000-0000000000${String(i + 10)}`,
  title,
  description: "Een idee uit de Foodlo-keuken (demo).",
  image_url: foto,
  servings: 4,
  prep_minutes: prep,
  cook_minutes: cook,
  difficulty: "makkelijk",
  category,
  tags,
  instructions: ["Zie het volledige recept."],
  created_at: `2026-10-${String(10 + i).padStart(2, "0")}T10:00:00Z`,
}));

export function demoSeed() {
  // Twee demofoto's (CC0, zie demo-fotos/LICENTIES.md); de rest toont bewust de omslag.
  const FOTO = { 1: "demo/stoofvlees.jpg", 2: "demo/pompoensoep.jpg" };
  const recipes = RECEPTEN.map((r, i) => ({
    id: R(r.n),
    user_id: DEMO_USER_ID,
    title: r.title,
    description: r.description,
    image_url: FOTO[r.n] ?? null,
    servings: r.servings,
    prep_minutes: r.prep,
    cook_minutes: r.cook,
    difficulty: r.diff,
    category: r.category,
    tags: r.tags,
    instructions: r.stappen,
    source_url: null,
    is_concept: false,
    deleted_at: null,
    created_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    updated_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
  }));
  const recipe_ingredients = RECEPTEN.flatMap((r) =>
    r.ingr.map(([name, quantity, unit], position) => ({
      id: `bbbbbbbb-000${r.n}-4000-8000-0000000000${String(position).padStart(2, "0")}`,
      recipe_id: R(r.n),
      name,
      quantity,
      unit,
      position,
    })),
  );
  const meal_plan = [
    [0, "avondeten", 1],
    [1, "avondeten", 3],
    [2, "avondeten", 4],
    [3, "middageten", 2],
    [4, "avondeten", 8],
    [-1, "avondeten", 6],
    [1, "ontbijt", 7],
  ].map(([offset, meal_type, n], i) => ({
    id: `cccccccc-0000-4000-8000-00000000000${i}`,
    user_id: DEMO_USER_ID,
    recipe_id: R(n),
    plan_date: dag(offset),
    meal_type,
    personen: 4,
    custom_title: null,
    soort: null,
    group_id: null,
  }));
  // Verzonnen gezinsleden en klantenkaarten, zodat ook die schermen gevuld te zien zijn.
  const GEZIN = "abababab-0000-4000-8000-000000000001";
  const JAN = "22222222-2222-4222-8222-222222222222";
  const LOTTE = "33333333-3333-4333-8333-333333333333";
  const rechten = {
    recipes_view: true,
    recipes_edit: false,
    planner_view: true,
    planner_edit: true,
    shopping_view: true,
    shopping_edit: true,
  };
  return {
    inspiration_recipes: INSPIRATIE,
    groups: [
      {
        id: GEZIN,
        naam: "Thuis",
        owner_id: DEMO_USER_ID,
        token: "demo-gezin-token",
        created_at: "2026-10-01T10:00:00Z",
      },
    ],
    group_members: [
      [DEMO_USER_ID, "eigenaar", "actief"],
      [JAN, "lid", "actief"],
      [LOTTE, "lid", "uitgenodigd"],
    ].map(([user_id, rol, status], i) => ({
      id: `acacacac-0000-4000-8000-00000000000${i}`,
      group_id: GEZIN,
      user_id,
      rol,
      status,
      created_at: "2026-10-01T10:00:00Z",
      ...rechten,
    })),
    extraProfielen: [
      { id: JAN, display_name: "Jan Peeters", handle: "jan", onboarding_klaar: true },
      { id: LOTTE, display_name: "Lotte Peeters", handle: "lotte", onboarding_klaar: true },
    ],
    loyalty_stores: [
      ["colruyt", "Colruyt", "#e3000f", 1],
      ["delhaize", "Delhaize", "#c8102e", 2],
      ["ah", "Albert Heijn", "#00a0e2", 3],
      ["aldi", "Aldi", "#00205b", 4],
    ].map(([slug, naam, kleur, volgorde]) => ({
      slug,
      naam,
      kleur,
      volgorde,
      actief: true,
      standaard_formaat: "EAN13",
    })),
    loyalty_cards: [
      ["colruyt", "Colruyt", "Xtra-kaart", "2600012345678", true],
      ["delhaize", "Delhaize", "SuperPlus", "2700098765432", false],
      ["ah", "Albert Heijn", "", "2610011122233", false],
    ].map(([store_slug, winkel_naam, kaartnaam, nummer, favoriet], i) => ({
      id: `adadadad-0000-4000-8000-00000000000${i}`,
      user_id: DEMO_USER_ID,
      store_slug,
      winkel_naam,
      kaartnaam,
      nummer,
      formaat: "EAN13",
      favoriet,
      gedeeld: i === 0,
    })),
    credit_costs: [
      ["recept_link", "Recept van een link inlezen", 1],
      ["recept_foto", "Recept van een foto inlezen", 2],
      ["weekmenu_ai", "Laat Foodlo je week kiezen", 3],
    ].map(([feature, label, credit_cost]) => ({ feature, label, credit_cost, enabled: true })),
    recipes,
    recipe_ingredients,
    meal_plan,
    favorites: [
      { id: "dddddddd-0000-4000-8000-000000000001", user_id: DEMO_USER_ID, recipe_id: R(1) },
      { id: "dddddddd-0000-4000-8000-000000000002", user_id: DEMO_USER_ID, recipe_id: R(5) },
    ],
    recipe_ratings: [
      {
        id: "eeeeeeee-0000-4000-8000-000000000001",
        user_id: DEMO_USER_ID,
        recipe_id: R(1),
        rating: 5,
      },
    ],
    shopping_lists: [
      {
        id: LIJST,
        user_id: DEMO_USER_ID,
        name: "Boodschappen",
        created_at: "2026-11-01T10:00:00Z",
      },
    ],
    shopping_items: [
      ["melk", 1, "l", false],
      ["brood", 1, "stuk(s)", false],
      ["rundvlees (stoofvlees)", 1000, "g", false],
      ["uien", 3, "", false],
      ["donker bier", 50, "cl", false],
      ["citroen", 1, "", false],
      ["zalmfilet", 2, "stuk(s)", true],
      ["koffie", 1, "pak", true],
    ].map(([name, quantity, unit, checked], i) => ({
      id: `ffffffff-0000-4000-8000-00000000000${i}`,
      user_id: DEMO_USER_ID,
      list_id: LIJST,
      name,
      quantity,
      unit,
      checked,
      recipe_id: null,
      note: null,
      created_at: new Date(Date.now() - i * 60000).toISOString(),
    })),
    // Kolommen zoals de echte tabel: naam / hoeveelheid / eenheid.
    pantry_items: [
      ["bloem", 1, "kg"],
      ["olijfolie", 1, "l"],
      ["eieren", 6, ""],
      ["uien", 4, ""],
      ["rundvlees", 1, "kg"],
      ["pompoen", 1, ""],
    ].map(([naam, hoeveelheid, eenheid], i) => ({
      id: `99999999-0000-4000-8000-00000000000${i}`,
      user_id: DEMO_USER_ID,
      naam,
      hoeveelheid,
      eenheid,
    })),
  };
}
