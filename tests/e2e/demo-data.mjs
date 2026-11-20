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

/** Maandag van de week `wekenTerug` weken geleden (YYYY-MM-DD), voor de budgetgeschiedenis. */
function maandagTerug(wekenTerug) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * wekenTerug);
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
  // Fase 2: een recept dat Marie van een video haalde (alleen de link, geen video in de app).
  // De tijdcodes vooraan de stappen worden klikbaar ("Bekijk op 0:45").
  {
    n: 9,
    title: "Chocomousse in 5 minuten",
    category: "nagerecht",
    tags: ["vegetarisch", "zoet"],
    description: "Video van @chefanna op YouTube.",
    prep: 5,
    cook: 0,
    diff: "makkelijk",
    servings: 4,
    bron: "https://www.youtube.com/watch?v=demoChoco01",
    ingr: [
      ["pure chocolade", 200, "g"],
      ["eieren", 4, ""],
      ["suiker", 2, "el"],
      ["snuf zout", null, ""],
    ],
    stappen: [
      "0:20 Smelt de chocolade au bain-marie.",
      "0:45 Splits de eieren en klop het eiwit stijf met een snuf zout.",
      "1:30 Meng de dooiers en de suiker door de chocolade.",
      "2:10 Spatel het eiwit er luchtig onder en zet 2 uur koud.",
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

// Ingrediënten bij een deel van de ideeën: zo zijn in Ontdek zowel "mogelijk allergeen" als
// "niet gecontroleerd" (geen ingrediënten) te zien en te testen.
const IDEE = (i) => `eeeeeeee-0000-4000-8000-0000000000${String(i + 10)}`;
const INSPIRATIE_INGREDIENTEN = [
  [1, ["pompoen", "ui", "gember", "room", "groentebouillon"]],
  [4, ["pasta", "pesto", "courgette", "paprika", "parmezaan"]],
  [5, ["rode linzen", "ui", "komijn", "wortel", "groentebouillon"]],
  [7, ["eieren", "tomaten", "paprika", "feta", "komijn"]],
].flatMap(([i, namen]) =>
  namen.map((name, position) => ({
    id: `efefefef-00${String(i).padStart(2, "0")}-4000-8000-0000000000${String(position).padStart(2, "0")}`,
    inspiration_id: IDEE(i),
    name,
    quantity: null,
    unit: "",
    position,
  })),
);

// ---------- Module B: makers, verzamelingen en community (verzonnen) ----------
// Andere gebruikers dan het gezin: hun recepten staan dus NIET in Marie's Keuken, alleen via de
// openbare makerpagina (recipe_publicaties: openbaar + gepubliceerd + goedgekeurd).
export const MAKER_USERS = {
  lotte: "9a9a9a9a-0000-4000-8000-000000000001",
  ahmed: "9a9a9a9a-0000-4000-8000-000000000002",
  gust: "9a9a9a9a-0000-4000-8000-000000000003",
};
export const MAKER_IDS = {
  lotte: "c7c7c7c7-0000-4000-8000-000000000001",
  ahmed: "c7c7c7c7-0000-4000-8000-000000000002",
  gust: "c7c7c7c7-0000-4000-8000-000000000003",
};
const MR = (n) => `a7a7a7a7-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
export const MAKER_RECEPT = {
  wortelsoep: MR(1),
  stoemp: MR(2),
  tajine: MR(3),
  linzen: MR(4),
  pompoen: MR(5),
  harira: MR(6),
};

const MAKER_RECEPTEN = [
  [
    1,
    "lotte",
    "Wortelsoep met sinaasappel",
    "soep",
    ["vegetarisch", "soep", "snel"],
    10,
    25,
    null,
    ["wortelen", "ui", "sinaasappel", "groentebouillon", "gember"],
    [
      "Snij wortelen en ui grof.",
      "Stoof ze 5 minuten in wat olie.",
      "Voeg bouillon en gember toe en kook 20 minuten.",
      "Mix fijn en pers de sinaasappel erboven uit.",
    ],
    null,
  ],
  [
    2,
    "lotte",
    "Stoemp met prei en spekjes",
    "hoofdgerecht",
    ["vlees", "Belgisch", "stoemp"],
    15,
    25,
    null,
    ["aardappelen", "prei", "spekblokjes", "boter", "nootmuskaat"],
    [
      "Kook de aardappelen gaar.",
      "Stoof de prei in boter.",
      "Bak de spekjes krokant.",
      "Stamp alles samen en kruid met nootmuskaat.",
    ],
    "https://www.youtube.com/watch?v=demo-stoemp",
  ],
  [
    3,
    "ahmed",
    "Kip-tajine met abrikozen",
    "hoofdgerecht",
    ["vlees", "stoof"],
    20,
    60,
    null,
    ["kippendijen", "gedroogde abrikozen", "ui", "kaneel", "komijn", "amandelen"],
    [
      "Bak de kip rondom bruin.",
      "Fruit de ui met kaneel en komijn.",
      "Voeg kip, abrikozen en een glas water toe.",
      "Laat een uur zacht stoven en werk af met amandelen.",
    ],
    "https://www.tiktok.com/@chefahmed/video/1234567890",
  ],
  [
    4,
    "ahmed",
    "Linzensalade met munt",
    "salade",
    ["vegetarisch", "snel"],
    10,
    20,
    null,
    ["groene linzen", "rode ui", "verse munt", "citroen", "olijfolie"],
    ["Kook de linzen beetgaar.", "Snij ui en munt fijn.", "Meng met citroensap en olijfolie."],
    null,
  ],
  [
    5,
    "gust",
    "Geroosterde pompoen met feta",
    "hoofdgerecht",
    ["vegetarisch", "herfst", "oven"],
    10,
    35,
    "demo/pompoensoep.jpg",
    ["pompoen", "feta", "honing", "tijm", "olijfolie"],
    [
      "Snij de pompoen in partjes.",
      "Rooster 30 minuten op 200 graden met olie en tijm.",
      "Verbrokkel de feta erover en besprenkel met honing.",
    ],
    null,
  ],
  // Fase 4: exclusief voor abonnees van Chef Ahmed (testmodus).
  [
    6,
    "ahmed",
    "Harira van mijn moeder",
    "soep",
    ["soep", "Marokkaans"],
    20,
    45,
    null,
    ["kikkererwten", "rode linzen", "tomaten", "selder", "koriander", "citroen"],
    [
      "Fruit ui en selder in olijfolie.",
      "Voeg tomaten, linzen en kikkererwten toe met water.",
      "Laat 40 minuten zacht koken.",
      "Werk af met koriander en een scheut citroen.",
    ],
    null,
  ],
];

export function makerSeed(DEMO_USER_ID, JAN) {
  const creators = [
    [
      "lotte",
      "lotte-kookt",
      "Lotte kookt",
      "Seizoensgroenten, soepen en Belgische klassiekers, altijd haalbaar op een weekavond.",
      ["Soepen", "Belgisch", "Seizoen"],
      false,
    ],
    [
      "ahmed",
      "chef-ahmed",
      "Chef Ahmed",
      "Marokkaanse familierecepten met een Brusselse twist. Rustig koken, veel smaak.",
      ["Marokkaans", "Stoofpotten", "Kruiden"],
      true,
    ],
    [
      "gust",
      "groenten-met-gust",
      "Groenten met Gust",
      "Volledig vegetarisch uit de moestuin.",
      ["Vegetarisch", "Oven"],
      false,
    ],
  ].map(([k, handle, naam, bio, specialisaties, geverifieerd], i) => ({
    id: MAKER_IDS[k],
    user_id: MAKER_USERS[k],
    handle,
    naam,
    bio,
    specialisaties,
    omslag_url: null,
    avatar_url: null,
    geverifieerd,
    created_at: `2026-10-0${i + 1}T10:00:00Z`,
  }));
  const recipes = MAKER_RECEPTEN.map(
    ([n, k, title, category, tags, prep, cook, foto, , stappen]) => ({
      id: MR(n),
      user_id: MAKER_USERS[k],
      title,
      description: `Een recept van ${creators.find((c) => c.user_id === MAKER_USERS[k]).naam} (demo).`,
      image_url: foto,
      servings: 4,
      prep_minutes: prep,
      cook_minutes: cook,
      difficulty: "makkelijk",
      category,
      tags,
      instructions: stappen,
      source_url: null,
      is_concept: false,
      deleted_at: null,
      created_at: `2026-10-${String(10 + n).padStart(2, "0")}T10:00:00Z`,
      updated_at: `2026-10-${String(10 + n).padStart(2, "0")}T10:00:00Z`,
    }),
  );
  const recipe_ingredients = MAKER_RECEPTEN.flatMap(([n, , , , , , , , ingr]) =>
    ingr.map((name, position) => ({
      id: `b7b7b7b7-00${String(n).padStart(2, "0")}-4000-8000-0000000000${String(position).padStart(2, "0")}`,
      recipe_id: MR(n),
      name,
      quantity: null,
      unit: "",
      position,
    })),
  );
  const recipe_publicaties = MAKER_RECEPTEN.map(([n, k, , , , , , , , , video], i) => ({
    id: `d7d7d7d7-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
    recipe_id: MR(n),
    creator_id: MAKER_IDS[k],
    zichtbaarheid: "openbaar",
    status: "gepubliceerd",
    gepubliceerd_op: `2026-10-${String(20 + i).padStart(2, "0")}T10:00:00Z`,
    video_url: video,
    moderatie: "goedgekeurd",
    exclusief: n === 6,
  }));
  // Fase 4 (voorstel 0021, testmodus): Chef Ahmed biedt een abonnement aan; Jan is abonnee.
  const maker_plannen = [
    {
      id: "c8c8c8c8-0000-4000-8000-000000000002",
      creator_id: MAKER_IDS.ahmed,
      prijs_cent: 399,
      voordelen: [
        "Elke maand twee familierecepten die nergens anders staan",
        "Mijn ramadan-avonden als collectie",
      ],
      actief: true,
      modus: "test",
      updated_at: "2026-11-01T10:00:00Z",
    },
  ];
  const maker_abonnementen = [
    {
      id: "c9c9c9c9-0000-4000-8000-000000000001",
      fan_id: JAN,
      creator_id: MAKER_IDS.ahmed,
      status: "actief",
      modus: "test",
      prijs_cent: 399,
      start_op: "2026-11-03T18:00:00Z",
      periode_einde: "2099-12-03T18:00:00Z",
      opgezegd_op: null,
    },
  ];
  const maker_betalingen = [
    {
      id: "cacacaca-0000-4000-8000-000000000001",
      abonnement_id: "c9c9c9c9-0000-4000-8000-000000000001",
      fan_id: JAN,
      creator_id: MAKER_IDS.ahmed,
      soort: "betaling",
      bedrag_cent: 399,
      btw_cent: 69,
      platform_cent: 41,
      maker_cent: 233,
      provider: "test",
      provider_ref: "test_demo_1",
      test: true,
      created_at: "2026-11-03T18:00:00Z",
    },
  ];
  return {
    maker_plannen,
    maker_abonnementen,
    maker_betalingen,
    creators,
    recipes,
    recipe_ingredients,
    recipe_publicaties,
    // Marie volgt Lotte; volgen is privé (alleen eigen rijen leesbaar).
    follows: [
      {
        id: "f7f7f7f7-0000-4000-8000-000000000001",
        follower_id: DEMO_USER_ID,
        creator_id: MAKER_IDS.lotte,
      },
      { id: "f7f7f7f7-0000-4000-8000-000000000002", follower_id: JAN, creator_id: MAKER_IDS.ahmed },
      {
        id: "f7f7f7f7-0000-4000-8000-000000000003",
        follower_id: MAKER_USERS.lotte,
        creator_id: MAKER_IDS.ahmed,
      },
    ],
    collections: [
      {
        id: "e7e7e7e7-0000-4000-8000-000000000001",
        user_id: DEMO_USER_ID,
        naam: "Zondag",
        beschrijving: "Rustig koken in het weekend.",
        openbaar: false,
        created_at: "2026-11-01T10:00:00Z",
      },
      {
        id: "e7e7e7e7-0000-4000-8000-000000000002",
        user_id: MAKER_USERS.lotte,
        naam: "Snelle soepen",
        beschrijving: null,
        openbaar: true,
        created_at: "2026-10-25T10:00:00Z",
      },
      {
        id: "e7e7e7e7-0000-4000-8000-000000000003",
        user_id: MAKER_USERS.ahmed,
        naam: "Ramadan-avonden",
        beschrijving: "Voor abonnees (testmodus).",
        openbaar: true,
        exclusief: true,
        created_at: "2026-11-02T10:00:00Z",
      },
    ],
    collection_recipes: [
      {
        id: "e8e8e8e8-0000-4000-8000-000000000001",
        collection_id: "e7e7e7e7-0000-4000-8000-000000000001",
        recipe_id: R(1),
        positie: 0,
      },
      {
        id: "e8e8e8e8-0000-4000-8000-000000000002",
        collection_id: "e7e7e7e7-0000-4000-8000-000000000001",
        recipe_id: MR(1),
        positie: 1,
      },
      {
        id: "e8e8e8e8-0000-4000-8000-000000000003",
        collection_id: "e7e7e7e7-0000-4000-8000-000000000002",
        recipe_id: MR(1),
        positie: 0,
      },
      {
        id: "e8e8e8e8-0000-4000-8000-000000000004",
        collection_id: "e7e7e7e7-0000-4000-8000-000000000003",
        recipe_id: MR(6),
        positie: 0,
      },
      {
        id: "e8e8e8e8-0000-4000-8000-000000000005",
        collection_id: "e7e7e7e7-0000-4000-8000-000000000003",
        recipe_id: MR(3),
        positie: 1,
      },
    ],
    community_bijdragen: [
      {
        id: "e9e9e9e9-0000-4000-8000-000000000001",
        recipe_id: MR(3),
        user_id: JAN,
        weergavenaam: "Jan",
        soort: "gemaakt",
        tekst: "Met wat extra kaneel; de kinderen vroegen om meer.",
        sterren: 5,
        foto_url: null,
        verborgen: false,
        created_at: "2026-11-05T18:30:00Z",
      },
      {
        id: "e9e9e9e9-0000-4000-8000-000000000002",
        recipe_id: MR(3),
        user_id: MAKER_USERS.lotte,
        weergavenaam: "Lotte",
        soort: "gemaakt",
        tekst: "Lekker, maar ik liet het een halfuur langer stoven.",
        sterren: 4,
        foto_url: null,
        verborgen: false,
        created_at: "2026-11-08T19:00:00Z",
      },
      // Fase 4: een gewone reactie (vraag), zonder sterren.
      {
        id: "e9e9e9e9-0000-4000-8000-000000000003",
        recipe_id: MR(3),
        user_id: MAKER_USERS.gust,
        weergavenaam: "Gust",
        soort: "reactie",
        tekst: "Kan dit ook met kikkererwten in plaats van kip?",
        sterren: null,
        foto_url: null,
        verborgen: false,
        created_at: "2026-11-10T12:00:00Z",
      },
    ],
    content_meldingen: [],
    profielen: [
      {
        id: MAKER_USERS.lotte,
        display_name: "Lotte Vermeulen",
        handle: "lotte-kookt",
        onboarding_klaar: true,
      },
      {
        id: MAKER_USERS.ahmed,
        display_name: "Ahmed El Idrissi",
        handle: "chef-ahmed",
        onboarding_klaar: true,
      },
      {
        id: MAKER_USERS.gust,
        display_name: "Gust De Smet",
        handle: "groenten-met-gust",
        onboarding_klaar: true,
      },
    ],
  };
}

// ---------- Partners (voorstel 0011) en premium (voorstel 0012): verzonnen ----------
// Marie heeft GEEN partnerrol. Els is eigenaar van "Boerderij Hoeve Groen", Tom is er analist.
// Demo-aanmelding als partner: partner@foodlo.be / demo1234 (alleen nep-Supabase).
export const PARTNER_USERS = {
  els: "5a5a5a5a-0000-4000-8000-000000000001",
  tom: "5a5a5a5a-0000-4000-8000-000000000002",
  proef: "5a5a5a5a-0000-4000-8000-000000000003",
};
export const PARTNER_IDS = {
  hoeve: "5b5b5b5b-0000-4000-8000-000000000001",
  kruiden: "5b5b5b5b-0000-4000-8000-000000000002",
};
export const CAMPAGNE_IDS = {
  herfst: "5c5c5c5c-0000-4000-8000-000000000001",
  kruiden: "5c5c5c5c-0000-4000-8000-000000000002",
};

export function partnerSeed(DEMO_USER_ID) {
  const partners = [
    {
      id: PARTNER_IDS.hoeve,
      naam: "Boerderij Hoeve Groen",
      soort: "producent",
      website: "https://hoevegroen.example/",
      logo_url: null,
      verificatie_status: "geverifieerd",
      omschrijving: "Familieboerderij met seizoensgroenten uit de Kempen (verzonnen).",
    },
    {
      id: PARTNER_IDS.kruiden,
      naam: "Merk Testkruiden",
      soort: "merk",
      website: null,
      logo_url: null,
      verificatie_status: "aangevraagd",
      omschrijving: "Verzonnen kruidenmerk voor de demo.",
    },
  ];
  const partner_leden = [
    [PARTNER_IDS.hoeve, PARTNER_USERS.els, "eigenaar"],
    [PARTNER_IDS.hoeve, PARTNER_USERS.tom, "analist"],
  ].map(([partner_id, user_id, rol], i) => ({
    id: `5d5d5d5d-0000-4000-8000-00000000000${i + 1}`,
    partner_id,
    user_id,
    rol,
  }));
  const campagnes = [
    {
      id: CAMPAGNE_IDS.herfst,
      partner_id: PARTNER_IDS.hoeve,
      naam: "Pompoen van bij ons",
      status: "actief",
      start: dag(-10),
      einde: dag(20),
      doel: "Seizoenspompoen bekender maken.",
      beoordeling_reden: null,
    },
    {
      id: CAMPAGNE_IDS.kruiden,
      partner_id: PARTNER_IDS.kruiden,
      naam: "Kruiden voor de winter",
      status: "concept",
      start: dag(5),
      einde: dag(40),
      doel: null,
      beoordeling_reden: null,
    },
  ];
  const gesponsorde_items = [
    {
      id: "5e5e5e5e-0000-4000-8000-000000000001",
      campagne_id: CAMPAGNE_IDS.herfst,
      soort: "recept",
      recipe_id: MAKER_RECEPT.pompoen,
      product_naam: null,
      label_tekst: "Gesponsord",
    },
  ];
  const partner_producten = [
    ["Butternut van Hoeve Groen", "pompoen", "5412345000013"],
    ["Bloemkool uit de Kempen", "bloemkool", null],
  ].map(([naam, ingredient_koppeling, ean], i) => ({
    id: `5f5f5f5f-0000-4000-8000-00000000000${i + 1}`,
    partner_id: PARTNER_IDS.hoeve,
    naam,
    ingredient_koppeling,
    ean,
  }));
  // Dagtotalen (verzonnen): nooit per gebruiker, alleen getoond/bekeken per dag.
  const gesponsord_statistiek = [0, 1, 2, 3, 4, 5, 6].map((n) => ({
    id: `5a6a6a6a-0000-4000-8000-00000000000${n}`,
    campagne_id: CAMPAGNE_IDS.herfst,
    dag: dag(-7 + n),
    vertoningen: [820, 910, 760, 1040, 1180, 990, 870][n],
    klikken: [21, 30, 18, 33, 41, 27, 24][n],
  }));
  const samenwerkingen = [
    {
      id: "5a7a7a7a-0000-4000-8000-000000000001",
      partner_id: PARTNER_IDS.hoeve,
      creator_id: MAKER_IDS.gust,
      status: "lopend",
      omschrijving: "Gust kookt een herfstreeks met pompoen van de hoeve.",
    },
  ];
  // Premium (0012): Marie gratis (geen rij), een demogebruiker in proefperiode.
  const abonnementen = [
    {
      id: "5a8a8a8a-0000-4000-8000-000000000001",
      user_id: PARTNER_USERS.proef,
      plan: "premium_maand",
      status: "proef",
      modus: "test",
      provider: "test",
      provider_ref: "test_sub_proef",
      periode_einde: dag(10),
      opgezegd_op: null,
      created_at: dag(-4),
    },
  ];
  const entitlements = [
    {
      id: "5a9a9a9a-0000-4000-8000-000000000001",
      user_id: PARTNER_USERS.proef,
      recht: "premium.weekmenu_extra",
      bron: "abonnement",
      geldig_tot: dag(10),
    },
  ];
  void DEMO_USER_ID;
  return {
    partners,
    partner_leden,
    partner_aanvragen: [],
    campagnes,
    gesponsorde_items,
    partner_producten,
    gesponsord_statistiek,
    samenwerkingen,
    abonnementen,
    entitlements,
    facturen: [],
    betaal_events: [],
    profielen: [
      { id: PARTNER_USERS.els, display_name: "Els Van Hoeve", onboarding_klaar: true },
      { id: PARTNER_USERS.tom, display_name: "Tom Janssens", onboarding_klaar: true },
      { id: PARTNER_USERS.proef, display_name: "Pieter Proef", onboarding_klaar: true },
    ],
  };
}

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
    source_url: r.bron ?? null,
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
  const GEZINSLIJST = "c9c9c9c9-0000-4000-8000-000000000000";
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
  const makers = makerSeed(DEMO_USER_ID, JAN);
  const { profielen: partnerProfielen, ...partnerTabellen } = partnerSeed(DEMO_USER_ID);
  // Voorstel 0010 (alleen demo): gezinsleden, ook zonder account, met voorkeuren en mee-eters.
  // Lotte (kind) wordt beheerd door Jan en deelt niet: Marie ziet alleen "niet veilig".
  // Gust (opa, zonder account) is vegetarisch en deelt dat met het gezin.
  // Jan eet liever geen gember en deelt dat: een zachte voorkeur ("liever niet"), geen verbod.
  const HL = (n) => `aeaeaeae-0000-4000-8000-00000000000${n}`;
  const huishouden_leden = [
    [1, "Marie", DEMO_USER_ID, "volwassene", DEMO_USER_ID],
    [2, "Jan", JAN, "volwassene", JAN],
    [3, "Lotte", null, "kind", JAN],
    [4, "Gust", null, "volwassene", DEMO_USER_ID],
  ].map(([n, naam, user_id, rol, beheerder_id]) => ({
    id: HL(n),
    group_id: GEZIN,
    naam,
    user_id,
    rol,
    beheerder_id,
    created_at: `2026-10-01T10:00:0${n}Z`,
  }));
  const lid_voeding = [
    {
      lid_id: HL(3),
      allergieen: ["noten"],
      intoleranties: [],
      dieet: null,
      uitsluitingen: [],
      delen_met_gezin: false,
      toestemming_door: JAN,
      toestemming_soort: "beheerder",
      toestemming_op: "2026-10-02T09:00:00Z",
    },
    {
      lid_id: HL(4),
      allergieen: [],
      intoleranties: [],
      dieet: "vegetarisch",
      uitsluitingen: ["koriander"],
      delen_met_gezin: true,
      toestemming_door: DEMO_USER_ID,
      toestemming_soort: "beheerder",
      toestemming_op: "2026-10-02T09:05:00Z",
    },
    {
      lid_id: HL(2),
      allergieen: [],
      intoleranties: [],
      dieet: null,
      uitsluitingen: ["gember"],
      delen_met_gezin: true,
      toestemming_door: JAN,
      toestemming_soort: "zelf",
      toestemming_op: "2026-10-02T09:10:00Z",
    },
  ].map((r, i) => ({ id: `afafafaf-0000-4000-8000-00000000000${i}`, ...r }));
  // De pompoensoep (middag, over 3 dagen) eet het hele gezin mee: 4 personen.
  const maaltijd_eters = [1, 2, 3, 4].map((n) => ({
    id: `a0a0a0a0-0000-4000-8000-00000000000${n}`,
    meal_plan_id: "cccccccc-0000-4000-8000-000000000003",
    lid_id: HL(n),
  }));
  return {
    maker_plannen: makers.maker_plannen,
    maker_abonnementen: makers.maker_abonnementen,
    maker_betalingen: makers.maker_betalingen,
    creators: makers.creators,
    recipe_publicaties: makers.recipe_publicaties,
    follows: makers.follows,
    collections: makers.collections,
    collection_recipes: makers.collection_recipes,
    community_bijdragen: makers.community_bijdragen,
    content_meldingen: makers.content_meldingen,
    ...partnerTabellen,
    huishouden_leden,
    lid_voeding,
    maaltijd_eters,
    // P5 (voorstel 0017, alleen demo): Jan rondde gisteren het winkelen af; Marie krijgt dat als
    // melding in de app (bel) en het staat in "Wie veranderde wat".
    app_meldingen: [
      {
        id: "a5a5a5a5-0017-4000-8000-000000000001",
        user_id: DEMO_USER_ID,
        group_id: GEZIN,
        actor_id: JAN,
        soort: "winkelen-klaar",
        tekst: "Jan is klaar met winkelen (4 dingen gekocht)",
        link: "/boodschappen",
        sleutel: null,
        gelezen_op: null,
        created_at: new Date(Date.now() - 20 * 3600000).toISOString(),
      },
    ],
    gezin_activiteit: [
      {
        id: "a6a6a6a6-0017-4000-8000-000000000001",
        group_id: GEZIN,
        actor_id: JAN,
        soort: "winkelen",
        tekst: "Jan is klaar met winkelen (4 dingen gekocht)",
        datum: dag(-1),
        ref_id: null,
        created_at: new Date(Date.now() - 20 * 3600000).toISOString(),
      },
    ],
    // Fase 3 (voorstel 0019, alleen demo): eerder deze maand afgesloten restjes, voor het kleine
    // verspillingsoverzicht in Keuken. Geen open restjes: die zouden elke test op Vandaag raken.
    restjes: [
      ["a7a7a7a7-0019-4000-8000-000000000001", "Pompoensoep", 3, "opgegeten"],
      ["a7a7a7a7-0019-4000-8000-000000000002", "Rijst van zondag", 1, "weggegooid"],
    ].map(([id, titel, porties, status]) => ({
      id,
      user_id: DEMO_USER_ID,
      group_id: GEZIN,
      titel,
      recipe_id: null,
      porties,
      gekookt_op: new Date(Date.now() - 2 * 3600000).toISOString(),
      gepland_op: null,
      status,
      afgesloten_op: new Date(Date.now() - 3600000).toISOString(),
    })),
    inspiration_recipes: INSPIRATIE,
    inspiration_ingredients: INSPIRATIE_INGREDIENTEN,
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
      ...makers.profielen,
      ...partnerProfielen,
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
    recipes: [...recipes, ...makers.recipes],
    recipe_ingredients: [...recipe_ingredients, ...makers.recipe_ingredients],
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
      // P6: de gedeelde gezinslijst van "Thuis", zodat "Wie haalt dit?" en "Mijn deel" in de
      // demo te zien zijn (bereikbaar via Gezin › Gezinslijst of de lijstkiezer).
      {
        id: GEZINSLIJST,
        user_id: DEMO_USER_ID,
        group_id: GEZIN,
        name: "Gezinslijst",
        created_at: "2026-11-05T10:00:00Z",
      },
    ],
    lijst_toewijzingen: [
      {
        id: "c9c9c9c9-0000-4000-8000-000000000001",
        item_id: "c9c9c9c9-0000-4000-8000-000000000010",
        list_id: GEZINSLIJST,
        toegewezen_aan: JAN,
        winkel: "Bakker",
      },
    ],
    shopping_items: [
      ...[
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
      ...[
        ["volkorenbrood", 1, "stuk", DEMO_USER_ID],
        ["appels", 6, "", JAN],
        ["jonge kaas", 300, "g", DEMO_USER_ID],
      ].map(([name, quantity, unit, door], i) => ({
        id: `c9c9c9c9-0000-4000-8000-00000000001${i}`,
        user_id: door,
        list_id: GEZINSLIJST,
        name,
        quantity,
        unit,
        checked: false,
        recipe_id: null,
        note: null,
        created_at: new Date(Date.now() - (i + 10) * 60000).toISOString(),
      })),
    ],
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
    // P2 (voorstel 0014): verzonnen budgetgeschiedenis van Marie, drie vorige weken.
    budget_weken: [
      [1, 104.6, 1, 6],
      [2, 131.2, 0, 7],
      [3, 97.8, 2, 5],
    ].map(([terug, geschat, niet_geschat, maaltijden]) => ({
      id: `b0d6e700-0014-4000-8000-00000000000${terug}`,
      user_id: DEMO_USER_ID,
      week: maandagTerug(terug),
      budget: 120,
      geschat,
      niet_geschat,
      maaltijden,
    })),
  };
}
