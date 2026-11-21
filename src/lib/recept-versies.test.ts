import { describe, expect, it } from "vitest";
import {
  gelijk,
  receptVelden,
  schaalStaat,
  staatUit,
  staatVanOpname,
  verschillen,
  versieDatum,
  versieLijst,
  type VersieRij,
} from "./recept-versies";

const recept = {
  id: "r1",
  user_id: "u1",
  title: "Pannenkoeken",
  description: "Zoals oma ze maakte",
  servings: 4,
  prep_minutes: 10,
  cook_minutes: 20,
  difficulty: "makkelijk",
  category: "dessert",
  tags: ["zoet"],
  instructions: ["Meng alles", "Bak"],
  step_ingredients: null,
  created_at: "2026-11-01T10:00:00.000Z",
};
const ingr = [
  { id: "i2", name: "melk", quantity: 5, unit: "dl", position: 1 },
  { id: "i1", name: "bloem", quantity: 200, unit: "g", position: 0 },
  { id: "i3", name: "ei", quantity: 2, unit: "", position: 2 },
];
const origineel = staatUit(recept, ingr);

describe("receptversies: staat", () => {
  it("leest een momentopname en sorteert de ingrediënten op positie", () => {
    expect(origineel.ingredienten.map((i) => i.name)).toEqual(["bloem", "melk", "ei"]);
    expect(staatVanOpname({ recept, ingredienten: ingr, reden: "assistent" })).toEqual(origineel);
  });
  it("terugzetten schrijft alleen inhoud, nooit eigenaar of id", () => {
    const v = receptVelden(origineel);
    expect(Object.keys(v)).not.toContain("user_id");
    expect(Object.keys(v)).not.toContain("id");
    expect(v.title).toBe("Pannenkoeken");
  });
  it("kapotte momentopname geeft een lege maar bruikbare staat", () => {
    const s = staatVanOpname({ recept: {}, ingredienten: [] });
    expect(s).toMatchObject({ title: "", servings: 4, ingredienten: [], tags: [] });
  });
});

describe("receptversies: verschillen", () => {
  it("vervangen op dezelfde plaats, hoeveelheid, porties en labels", () => {
    const na = staatUit({ ...recept, servings: 2, tags: ["zoet", "glutenvrij"] }, [
      { id: "i1", name: "rijstmeel", quantity: 200, unit: "g", position: 0 },
      { id: "i2", name: "melk", quantity: 2.5, unit: "dl", position: 1 },
      { id: "i3", name: "ei", quantity: 2, unit: "", position: 2 },
    ]);
    expect(verschillen(origineel, na)).toEqual([
      "Porties: 4 → 2",
      "melk: 5 dl → 2,5 dl",
      "bloem → rijstmeel",
      "Labels: + glutenvrij",
    ]);
  });
  it("erbij en weg, stappen en tijd", () => {
    const na = staatUit({ ...recept, instructions: ["Meng", "Rust", "Bak"], cook_minutes: 30 }, [
      ...ingr.filter((i) => i.name !== "ei"),
      { id: "i4", name: "suiker", quantity: 1, unit: "el", position: 5 },
    ]);
    // Op dezelfde plaats: vervangen; anders "Zonder" / "Met".
    expect(verschillen(origineel, na)).toEqual([
      "ei → suiker",
      "Stappen: 2 → 3",
      "Tijd: 30 → 40 min",
    ]);
  });
  it("zelfde stand: geen verschillen; veel verschillen worden samengevat", () => {
    expect(gelijk(origineel, staatUit(recept, [...ingr].reverse()))).toBe(true);
    const anders = staatUit(
      {
        ...recept,
        title: "X",
        servings: 1,
        description: "",
        category: "hoofd",
        difficulty: "moeilijk",
        tags: [],
      },
      [],
    );
    const v = verschillen(origineel, anders);
    expect(v).toHaveLength(6);
    expect(v.at(-1)).toMatch(/^en nog \d+ wijzigingen$/);
  });
});

describe("receptversies: lijst", () => {
  const assistent: VersieRij = {
    id: "v1",
    created_at: "2026-11-10T12:00:00.000Z",
    momentopname: { recept, ingredienten: ingr, reden: "assistent" },
  };
  const na1 = staatUit({ ...recept, tags: ["zoet", "glutenvrij"] }, [
    { id: "i1", name: "rijstmeel", quantity: 200, unit: "g", position: 0 },
    ...ingr.filter((i) => i.name !== "bloem"),
  ]);
  const porties: VersieRij = {
    id: "v2",
    created_at: "2026-11-12T18:30:00.000Z",
    momentopname: {
      recept: { ...recept, tags: ["zoet", "glutenvrij"] },
      ingredienten: [
        { id: "i1", name: "rijstmeel", quantity: 200, unit: "g", position: 0 },
        ...ingr.filter((i) => i.name !== "bloem"),
      ],
      reden: "porties",
    },
  };
  const huidig = schaalStaat(na1, 2);

  it("nieuwste eerst: huidig, aangepast, origineel; met reden en wat er veranderde", () => {
    const l = versieLijst([assistent, porties], huidig);
    expect(l.map((v) => v.soort)).toEqual(["huidig", "versie", "origineel"]);
    expect(l[0]!.wijziging).toMatchObject({ reden: "porties", label: "Porties bewaard" });
    expect(l[0]!.wijziging!.wat[0]).toBe("Porties: 4 → 2");
    expect(l[1]!.wijziging).toMatchObject({ label: "Aangepast met de assistent" });
    expect(l[1]!.wijziging!.wat).toContain("bloem → rijstmeel");
    expect(l[2]!.wijziging).toBeNull();
    expect(l[2]!.sinds).toBe(recept.created_at);
    expect(l[1]!.sinds).toBe(assistent.created_at);
    expect(l[0]!.versieId).toBeNull();
    expect(l[2]!.versieId).toBe("v1");
  });
  it("met 20 bewaarde versies is de oudste niet zeker het origineel", () => {
    const veel = Array.from({ length: 20 }, (_, i) => ({
      ...assistent,
      id: `v${i}`,
      created_at: `2026-11-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
    }));
    expect(versieLijst(veel, origineel).at(-1)!.soort).toBe("oudste");
  });
  it("datum in gewone taal, 24 u", () => {
    expect(versieDatum("2026-11-18T13:05:00.000Z")).toMatch(/^18 november om \d{2}[:.]05$/);
    expect(versieDatum(null)).toBe("datum onbekend");
  });
});

describe("porties bewaren", () => {
  it("schaalt elke hoeveelheid; onbekende blijft onbekend", () => {
    const s = schaalStaat(
      staatUit(recept, [...ingr, { id: "i9", name: "zout", quantity: null, unit: null }]),
      6,
    );
    expect(s.servings).toBe(6);
    expect(s.ingredienten.map((i) => i.quantity)).toEqual([300, 7.5, 3, null]);
  });
});
