import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  aftrekPlan,
  aftrekSamenvatting,
  maatTekst,
  stelAftrekVoor,
  type VoorraadProduct,
} from "./voorraad-aftrek";
import {
  gekooktePlannen,
  laatstGekookt,
  leesLokaal,
  maakKookmoment,
  notitiesVoor,
  schoonNotitie,
  schoonPorties,
  schrijfLokaal,
  voegToe,
} from "./kookmomenten";
import {
  bewaarRestje,
  bewaarRichtwaarde,
  bijnaOpRestjes,
  restjes,
  restjesOpDag,
  voorTeStellenRestjes,
} from "@/lib/intelligentie/restjes";
import {
  herstelNietVoorMij,
  nietTonenLijst,
  nietVoorMijLijst,
  zetNietNu,
  zetNietVoorMij,
} from "@/lib/intelligentie/niet-nu";
import { voorstelDatOpmaakt } from "@/lib/intelligentie/gebruik-eerst";
import { hoofdStap, type MaaltijdVandaag, type VandaagInvoer } from "@/lib/vandaag";

const opslag = new Map<string, string>();
beforeEach(() => {
  opslag.clear();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (s: string) => opslag.get(s) ?? null,
      setItem: (s: string, v: string) => void opslag.set(s, v),
    },
    dispatchEvent: () => true,
  };
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

const voorraad: VoorraadProduct[] = [
  { id: "v1", naam: "rundvlees", hoeveelheid: 1, eenheid: "kg" },
  { id: "v2", naam: "ui", hoeveelheid: 5, eenheid: "" },
  { id: "v3", naam: "tomatenpuree", hoeveelheid: 1, eenheid: "blik" },
  { id: "v4", naam: "melk", hoeveelheid: 1, eenheid: "l" },
  { id: "v5", naam: "kaas", hoeveelheid: null, eenheid: "" },
  { id: "v6", naam: "wortel", hoeveelheid: 500, eenheid: "g" },
];

describe("voorstel voorraad-aftrek (P3)", () => {
  it("rekent per portie om naar de eenheid van de voorraad", () => {
    const r = stelAftrekVoor(
      [
        { name: "rundvlees", quantity: 800, unit: "g" },
        { name: "ui", quantity: 2, unit: "" },
        { name: "melk", quantity: 2, unit: "dl" },
      ],
      voorraad,
      0.5,
    );
    expect(r.map((x) => [x.naam, x.gebruikt, x.status, x.aan])).toEqual([
      ["rundvlees", 0.4, "zeker", true],
      ["ui", 1, "zeker", true],
      ["melk", 0.1, "zeker", true],
    ]);
  });

  it("onbekende of niet-omrekenbare eenheid: vraag, niet gokken (standaard uit)", () => {
    const r = stelAftrekVoor(
      [
        { name: "tomatenpuree", quantity: 70, unit: "g" },
        { name: "kaas", quantity: 100, unit: "g" },
        { name: "wortel", quantity: null, unit: null },
        { name: "melk", quantity: 200, unit: "g" },
      ],
      voorraad,
    );
    for (const x of r) {
      expect(x.status).toBe("vraag");
      expect(x.gebruikt).toBeNull();
      expect(x.aan).toBe(false);
      expect(x.waarom).toBeTruthy();
    }
    expect(r.find((x) => x.naam === "tomatenpuree")!.waarom).toContain("blik");
    expect(r.find((x) => x.naam === "kaas")!.waarom).toMatch(/geen hoeveelheid/);
    expect(r.find((x) => x.naam === "wortel")!.waarom).toMatch(/zegt niet hoeveel/);
  });

  it("stuks naar gram alleen met een gekend stukgewicht", () => {
    const r = stelAftrekVoor([{ name: "wortel", quantity: 2, unit: "" }], voorraad);
    expect(r[0]).toMatchObject({ naam: "wortel", gebruikt: 200, status: "zeker" });
  });

  it("twee ingrediënten op hetzelfde product tellen op; basisproducten en onbekende niet", () => {
    const r = stelAftrekVoor(
      [
        { name: "ui", quantity: 1, unit: "" },
        { name: "ui", quantity: 2, unit: "" },
        { name: "zout", quantity: 1, unit: "tl" },
        { name: "saffraan", quantity: 1, unit: "g" },
      ],
      voorraad,
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ naam: "ui", gebruikt: 3, ingredienten: ["ui", "ui"] });
  });

  it("aftrekPlan: alleen aangevinkt, opnieuw gerekend vanaf de voorraad van nu", () => {
    const regels = stelAftrekVoor(
      [
        { name: "rundvlees", quantity: 800, unit: "g" },
        { name: "ui", quantity: 2, unit: "" },
        { name: "melk", quantity: 2, unit: "dl" },
        { name: "tomatenpuree", quantity: 70, unit: "g" },
      ],
      voorraad,
    );
    const plan = aftrekPlan(
      regels,
      {
        v2: { aan: false, gebruikt: 2 },
        v3: { aan: true, gebruikt: null, op: true },
        v4: { aan: true, gebruikt: null },
      },
      // Intussen at iemand anders 300 g rundvlees op: 0,7 kg − 0,8 kg → op.
      [{ ...voorraad[0]!, hoeveelheid: 0.7 }, voorraad[1]!, voorraad[2]!, voorraad[3]!],
    );
    expect(plan.op.map((o) => o.naam)).toEqual(["rundvlees", "tomatenpuree"]);
    expect(plan.bijwerken).toEqual([]);
    expect(plan.overgeslagen).toEqual(["melk"]);
    expect(aftrekSamenvatting(plan)).toEqual(["rundvlees op", "tomatenpuree op"]);
  });

  it("aangepaste hoeveelheid wordt gebruikt; wat intussen weg is, slaat over", () => {
    const regels = stelAftrekVoor([{ name: "rundvlees", quantity: 800, unit: "g" }], voorraad);
    const plan = aftrekPlan(regels, { v1: { aan: true, gebruikt: 0.25 } }, [voorraad[0]!]);
    expect(plan.bijwerken).toEqual([{ id: "v1", naam: "rundvlees", hoeveelheid: 0.75, oud: 1 }]);
    expect(
      aftrekPlan(regels, { v1: { aan: true, gebruikt: 0.25 } }, [voorraad[1]!]).bijwerken,
    ).toEqual([]);
  });

  it("maatTekst in Belgische notatie", () => {
    expect(maatTekst(0.4, "kg")).toBe("0,4 kg");
    expect(maatTekst(3, "")).toBe("3");
    expect(maatTekst(null, "g")).toBe("onbekend");
  });
});

describe("kookmomenten (P3)", () => {
  it("notitie en porties worden opgekuist", () => {
    expect(schoonNotitie("   ")).toBeNull();
    expect(schoonNotitie("x".repeat(600))).toHaveLength(500);
    expect(schoonPorties(0)).toBe(1);
    expect(schoonPorties(80)).toBe(50);
    expect(schoonPorties(null)).toBeNull();
  });

  it("één moment per geplande maaltijd; vervangen geeft het vorige terug", () => {
    const a = maakKookmoment(
      { recipeId: "r1", planId: "p1", notitie: "lekker" },
      new Date(2026, 10, 1),
    );
    const b = maakKookmoment({ recipeId: "r1", planId: "p1", porties: 2 }, new Date(2026, 10, 2));
    const c = maakKookmoment(
      { recipeId: "r1", planId: null, notitie: "minder zout" },
      new Date(2026, 10, 3),
    );
    const eerst = voegToe([], a).lijst;
    const tweede = voegToe(eerst, b);
    expect(tweede.vervangen).toBe(a);
    const lijst = voegToe(tweede.lijst, c).lijst;
    expect(lijst).toHaveLength(2);
    expect([...gekooktePlannen(lijst)]).toEqual(["p1"]);
    expect(notitiesVoor(lijst, "r1").map((m) => m.notitie)).toEqual(["minder zout"]);
    expect(laatstGekookt(lijst, "r1")).toBe(c.gekookt_op);
  });

  it("toestel-terugval bewaart en leest", () => {
    const m = maakKookmoment({ recipeId: "r1", planId: "p1" });
    schrijfLokaal("u", [m]);
    expect(leesLokaal("u")).toEqual([m]);
    expect(leesLokaal("ander")).toEqual([]);
  });
});

describe("restje-aanmaak en houdbaarheid (P3)", () => {
  const MA = new Date(2026, 10, 9, 19).getTime();
  const dag = (n: number) => new Date(2026, 10, 9 + n, 12).getTime();

  it("restje met eigen naam komt terug in de voorstellen", () => {
    bewaarRestje("u", { titel: "Soep van gisteren", receptId: "r1", porties: 2 }, MA);
    expect(voorTeStellenRestjes("u", dag(1)).map((r) => r.titel)).toEqual(["Soep van gisteren"]);
  });

  it("richtwaarde is geen belofte en noemt een dag", () => {
    const r = bewaarRichtwaarde(MA);
    expect(r.tekst).toMatch(/^Meestal 2 à 3 dagen in de koelkast: richtwaarde tot donderdag/);
    expect(r.tekst).toMatch(/Twijfel je/);
    expect(bewaarRichtwaarde(MA, dag(5)).tekst).toMatch(/Langer dan 3 dagen/);
  });

  it("bijna op: 2 of 3 dagen oud, niet ingepland, oudste eerst", () => {
    bewaarRestje("u", { titel: "Oud", receptId: "a", porties: 1 }, dag(-3));
    bewaarRestje("u", { titel: "Twee dagen", receptId: "b", porties: 1 }, dag(-2));
    bewaarRestje("u", { titel: "Vers", receptId: "c", porties: 1 }, dag(0));
    const l = bijnaOpRestjes(restjes("u", dag(0)), dag(0));
    expect(l.map((r) => [r.titel, r.laatsteDag])).toEqual([
      ["Oud", true],
      ["Twee dagen", false],
    ]);
  });

  it("restjesdag: alleen restjes die op die dag nog goed zijn", () => {
    bewaarRestje("u", { titel: "Stoofvlees", receptId: "a", porties: 2 }, MA);
    const l = restjes("u", MA);
    expect(restjesOpDag(l, "2026-11-11").map((r) => r.titel)).toEqual(["Stoofvlees"]);
    expect(restjesOpDag(l, "2026-11-13")).toEqual([]);
    expect(restjesOpDag(l, "2026-11-08")).toEqual([]);
  });
});

describe("Niet voor mij (P3)", () => {
  it("blijft tot je het terugzet en telt samen met 'Niet nu'", () => {
    zetNietVoorMij("u", "r1");
    zetNietNu("u", "r2");
    expect(nietVoorMijLijst("u")).toEqual(["r1"]);
    expect(nietTonenLijst("u").sort()).toEqual(["r1", "r2"]);
    herstelNietVoorMij("u", "r1");
    expect(nietTonenLijst("u")).toEqual(["r2"]);
  });
});

describe("Gebruik eerst: voorstel dat opmaakt (P3)", () => {
  it("eerste voorstel dat een oud product gebruikt", () => {
    const v = voorstelDatOpmaakt(
      [
        { id: "a", aanwezig: ["pasta"] },
        { id: "b", aanwezig: ["rundvlees", "ui"] },
      ],
      [{ naam: "rundvlees", dagen: 5 }],
      (n, p) => n === p,
    );
    expect(v?.voorstel.id).toBe("b");
    expect(
      voorstelDatOpmaakt(
        [{ id: "a", aanwezig: ["pasta"] }],
        [{ naam: "x", dagen: 3 }],
        () => false,
      ),
    ).toBeNull();
  });
});

describe("Vandaag na 'Gekookt' (P3)", () => {
  const recept = {
    id: "r1",
    title: "Stoofvlees",
    servings: 4,
    prep_minutes: 20,
    cook_minutes: 120,
    stappen: 5,
  };
  const avond: MaaltijdVandaag = { id: "p1", meal_type: "avondeten", recept, custom_title: null };
  const basis: VandaagInvoer = {
    nu: new Date(2026, 10, 9, 17),
    vandaag: [avond],
    morgen: [],
    ontbreektVandaag: [],
    nogKopenVandaag: [],
    ontbreektMorgen: [],
    voortgang: {},
    vrijeDagen: 0,
    aanvullen: 0,
    teKopen: 0,
    heeftRecepten: true,
  };
  it("zonder gekookt: koken; met gekookt: rust", () => {
    expect(hoofdStap(basis).soort).toBe("koken");
    const s = hoofdStap({ ...basis, gekookt: ["p1"] });
    expect(s.soort).toBe("gekookt");
  });
  it("lunch gekookt, avondeten nog niet: het avondeten telt", () => {
    const lunch: MaaltijdVandaag = { ...avond, id: "p0", meal_type: "middageten" };
    const s = hoofdStap({
      ...basis,
      nu: new Date(2026, 10, 9, 11),
      vandaag: [lunch, avond],
      gekookt: ["p0"],
    });
    expect(s.soort === "koken" && s.maaltijd.id).toBe("p1");
  });
});
