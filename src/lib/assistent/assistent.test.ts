import { describe, expect, it } from "vitest";
import { maakVoorstel, rijWijzigingen, rondKeukenAf, vervangVoorstel } from "./aanpassen";
import { isDemoOmgeving, naarVervangers, RegelAdapter, TestAssistentAdapter } from "./adapter";
import { etersUit } from "./eters";
import { resterend, telOp } from "./gebruik";
import {
  ingredientRedenen,
  regelVoor,
  toetsVervangers,
  veiligeVervangers,
  VERVANGTABEL,
  type Eter,
} from "./vervangingen";
import { GEEN_ANTWOORD, GEZONDHEID_ANTWOORD, regelAntwoord } from "./vragen";
import { allergenenIn } from "@/lib/allergenen";
import { pastBijDieet } from "@/lib/veiligheid";
import type { HuishoudenLid, LidVoeding } from "@/lib/gezin-veiligheid";

const ik = (allergieen: string[] = [], dieet: Eter["dieet"] = null): Eter => ({
  id: "ik",
  naam: "Jij",
  allergieen,
  dieet,
  ikZelf: true,
  redenZichtbaar: true,
});

describe("vervangingstabel: herkenning", () => {
  it("vindt het juiste ingrediënt, ook met bijwoorden en meervoud", () => {
    expect(regelVoor("250 g ongezouten boter")?.naam).toBe("boter");
    expect(regelVoor("halfvolle melk")?.naam).toBe("melk");
    expect(regelVoor("eieren")?.naam).toBe("ei");
    expect(regelVoor("uien")?.naam).toBe("ui");
    expect(regelVoor("rundvlees (stoofvlees)")?.naam).toBe("rundvlees");
    expect(regelVoor("platte kaas")?.naam).toBe("yoghurt");
  });

  it("verwart lijkende woorden niet", () => {
    expect(regelVoor("kokosmelk")).toBeNull();
    expect(regelVoor("bloemkool")).toBeNull();
    expect(regelVoor("pindakaas")?.naam).toBe("pindakaas");
    expect(regelVoor("kippenbouillon")?.naam).toBe("vleesbouillon");
    expect(regelVoor("vissaus")?.naam).toBe("vissaus");
    expect(regelVoor("champignons")).toBeNull();
  });

  it("elke regel heeft minstens twee vervangers met reden en verhouding", () => {
    for (const r of VERVANGTABEL) {
      expect(r.vervangers.length, r.naam).toBeGreaterThanOrEqual(2);
      for (const v of r.vervangers) {
        expect(v.reden.length).toBeGreaterThan(5);
        expect(v.verhouding.length).toBeGreaterThan(2);
      }
    }
  });

  it("de tabel geeft zelf elk allergeen aan dat de herkenning vindt (geen vergeten aangifte)", () => {
    const alle = [
      "gluten",
      "melk",
      "noten",
      "soja",
      "eieren",
      "pindas",
      "sesam",
      "selder",
      "vis",
      "sulfiet",
    ];
    for (const r of VERVANGTABEL)
      for (const v of r.vervangers)
        for (const t of allergenenIn([v.naam], alle))
          expect(v.allergenen, `${v.naam} herkend als ${t.id}`).toContain(t.id);
  });
});

describe("vervangers respecteren allergie en dieet", () => {
  it("zonder allergieën: alle vervangers van melk", () => {
    const u = veiligeVervangers("melk", [ik()]);
    expect(u.geschikt.map((v) => v.naam)).toEqual([
      "Havermelk",
      "Sojamelk",
      "Rijstmelk",
      "Amandelmelk",
    ]);
    expect(u.afgevallen).toEqual([]);
  });

  it("notenallergie: amandelmelk valt af, met reden", () => {
    const u = veiligeVervangers("melk", [ik(["noten"])]);
    expect(u.geschikt.map((v) => v.naam)).not.toContain("Amandelmelk");
    expect(u.afgevallen[0]?.vervanger.naam).toBe("Amandelmelk");
    expect(u.afgevallen[0]?.redenen[0]).toBe("bevat mogelijk noten (jouw allergie)");
  });

  it("glutenallergie: havermelk valt af (haver), ook al zegt de tabel het", () => {
    const u = veiligeVervangers("melk", [ik(["gluten"])]);
    expect(u.geschikt.map((v) => v.naam)).not.toContain("Havermelk");
  });

  it("melkallergie: ghee en Griekse yoghurt vallen af", () => {
    expect(veiligeVervangers("boter", [ik(["melk"])]).geschikt.map((v) => v.naam)).not.toContain(
      "Ghee",
    );
    expect(veiligeVervangers("room", [ik(["melk"])]).geschikt.map((v) => v.naam)).not.toContain(
      "Griekse yoghurt",
    );
  });

  it("vegetarisch: geen kalkoen voor kip; veganistisch: geen honing voor suiker", () => {
    expect(
      veiligeVervangers("kip", [ik([], "vegetarisch")]).geschikt.map((v) => v.naam),
    ).not.toContain("Kalkoenfilet");
    const vegan = veiligeVervangers("suiker", [ik([], "veganistisch")]);
    expect(vegan.geschikt.map((v) => v.naam)).not.toContain("Honing");
    expect(vegan.afgevallen.find((a) => a.vervanger.naam === "Honing")?.redenen[0]).toMatch(
      /dieet/,
    );
  });

  it("pescotarisch: kipfilet als visvervanger valt af", () => {
    expect(
      veiligeVervangers("zalm", [ik([], "pescotarisch")]).geschikt.map((v) => v.naam),
    ).not.toContain("Kipfilet");
  });

  it("mee-eter die niet deelt: alleen 'niet geschikt voor Lotte', zonder allergie te noemen", () => {
    const lotte: Eter = { id: "l", naam: "Lotte", allergieen: ["noten"], redenZichtbaar: false };
    const u = veiligeVervangers("pindakaas", [ik(), lotte]);
    expect(u.geschikt.map((v) => v.naam)).toEqual(["Zonnebloempittenpasta", "Tahin"]);
    expect(u.afgevallen[0]?.redenen).toEqual(["niet geschikt voor Lotte"]);
    expect(JSON.stringify(u.afgevallen.map((a) => a.redenen))).not.toMatch(/noten/i);
  });

  it("mee-eter die deelt: reden met naam; 'liever niet' telt ook", () => {
    const gust: Eter = {
      id: "g",
      naam: "Gust",
      allergieen: [],
      dieet: "vegetarisch",
      uitsluitingen: ["tofu"],
      redenZichtbaar: true,
    };
    const u = veiligeVervangers("kip", [ik(), gust]);
    expect(u.geschikt.map((v) => v.naam)).toEqual(["Kikkererwten", "Bloemkoolroosjes"]);
    expect(u.afgevallen.flatMap((a) => a.redenen)).toEqual(
      expect.arrayContaining(["Gust eet liever geen tofu", "past niet bij Gust (vegetarisch)"]),
    );
  });

  it("eigenschap: geen enkel getoond voorstel schendt een allergie, voor elke combinatie", () => {
    const codes = [
      "gluten",
      "melk",
      "noten",
      "soja",
      "eieren",
      "pindas",
      "sesam",
      "selder",
      "sulfiet",
    ];
    for (const r of VERVANGTABEL)
      for (const a of codes) {
        const u = veiligeVervangers(r.woorden[0]!, [ik([a], "veganistisch")]);
        for (const v of u.geschikt) {
          expect(allergenenIn([v.naam], [a]), `${v.naam} bij ${a}`).toEqual([]);
          expect(v.allergenen).not.toContain(a);
          expect(pastBijDieet({ title: v.naam, ingredienten: [v.naam] }, "veganistisch")).toBe(
            true,
          );
          expect(v.dierlijk).toBeNull();
        }
      }
  });

  it("onbekend ingrediënt: eerlijk 'niet bekend', geen verzonnen vervangers", () => {
    const u = veiligeVervangers("saffraan", [ik()]);
    expect(u).toMatchObject({ bekend: false, geschikt: [], afgevallen: [] });
  });

  it("duidt aan dat het ingrediënt zelf een probleem is", () => {
    expect(ingredientRedenen("boter", [ik(["melk"])])).toEqual([
      "bevat mogelijk melk (lactose) (jouw allergie)",
    ]);
    expect(ingredientRedenen("olijfolie", [ik(["melk"])])).toEqual([]);
  });
});

describe("AI- en testantwoorden gaan door dezelfde toets", () => {
  it("de testadapter is deterministisch en Cashewroom valt af bij notenallergie", async () => {
    const a = await new TestAssistentAdapter().vraag({ soort: "vervang", ingredient: "room" });
    const b = await new TestAssistentAdapter().vraag({ soort: "vervang", ingredient: "room" });
    expect(a).toEqual(b);
    expect(a.bron).toBe("test");
    const t = toetsVervangers(naarVervangers(a.vervangers ?? []), [ik(["noten"])]);
    expect(t.geschikt.map((v) => v.naam)).toEqual(["Kokosroom", "Zijdetofu"]);
    expect(t.afgevallen[0]?.vervanger.naam).toBe("Cashewroom");
  });

  it("AI-voorstel met vlees valt af voor een vegetariër, ook zonder label", () => {
    const t = toetsVervangers(
      naarVervangers([
        { naam: "Kalkoenreepjes", reden: "mager" },
        { naam: "Tempeh", reden: "stevig" },
      ]),
      [ik(["soja"], "vegetarisch")],
    );
    expect(t.geschikt).toEqual([]);
    expect(t.afgevallen).toHaveLength(2);
  });

  it("naarVervangers begrenst en schoont op", () => {
    const lijst = naarVervangers(
      Array.from({ length: 10 }, (_, i) => ({ naam: ` Product ${i} `, reden: "x".repeat(300) })),
    );
    expect(lijst).toHaveLength(6);
    expect(lijst[0]!.naam).toBe("Product 0");
    expect(lijst[0]!.reden.length).toBe(140);
  });

  it("regeladapter: vaste kookvraag", async () => {
    const r = await new RegelAdapter().vraag({ soort: "vraag", vraag: "hoe lang eieren koken" });
    expect(r.antwoord).toMatch(/10 minuten/);
  });

  it("demo-omgeving herkend; productie niet", () => {
    expect(isDemoOmgeving({ VITE_SUPABASE_PROJECT_ID: "demo" })).toBe(true);
    expect(isDemoOmgeving({ SUPABASE_URL: "http://127.0.0.1:54439" })).toBe(true);
    expect(
      isDemoOmgeving({ SUPABASE_URL: "https://abc.supabase.co", VITE_SUPABASE_PROJECT_ID: "abc" }),
    ).toBe(false);
  });
});

describe("korte kookvragen zonder AI", () => {
  it.each([
    ["Hoe lang moet ik eieren koken?", /6 minuten/],
    ["Mijn saus is te dun", /maïzena/],
    ["hetelucht of boven en onder?", /20 °C lager/],
    ["Hoeveel pasta per persoon?", /100 g/],
    ["veel te zout!", /citroensap/],
    ["Wanneer is kip gaar?", /74 °C/],
  ])("%s", (vraag, verwacht) => {
    expect(regelAntwoord(vraag)).toMatch(verwacht);
  });

  it("gezondheid: vaste, voorzichtige zin", () => {
    expect(regelAntwoord("Is dit veilig met mijn notenallergie?")).toBe(GEZONDHEID_ANTWOORD);
  });

  it("onbekend: null (scherm toont GEEN_ANTWOORD)", () => {
    expect(regelAntwoord("Wat is de hoofdstad van Peru?")).toBeNull();
    expect(GEEN_ANTWOORD).toMatch(/vast antwoord/);
  });
});

const recept = {
  title: "Lasagne",
  servings: 4,
  tags: ["vlees"],
  instructions: [
    "Bak het gehakt bruin.",
    "Maak de bechamel met boter, bloem en melk.",
    "Bak 30 min.",
  ],
};
const ingredienten = [
  { id: "a", name: "gehakt", quantity: 500, unit: "g" },
  { id: "b", name: "boter", quantity: 50, unit: "g" },
  { id: "c", name: "bloem", quantity: 50, unit: "g" },
  { id: "d", name: "melk", quantity: 0.5, unit: "l" },
  { id: "e", name: "lasagnebladen", quantity: 12, unit: "" },
  { id: "f", name: "zout", quantity: null, unit: "" },
];

describe("recept aanpassen: altijd een voorstel met verschillen", () => {
  it("personen: schaalt en rondt netjes af, zout zonder hoeveelheid blijft", () => {
    const v = maakVoorstel(recept, ingredienten, { soort: "personen", personen: 3 }, [ik()]);
    expect(v.personen).toBe(3);
    expect(v.ingredienten.map((i) => i.quantity)).toEqual([375, 38, 38, 0.4, 9, null]);
    expect(v.wijzigingen.filter((w) => w.soort === "hoeveelheid")).toHaveLength(5);
    expect(v.titelKopie).toBe("Lasagne (voor 3)");
  });

  it("rondKeukenAf", () => {
    expect(rondKeukenAf(133.33)).toBe(135);
    expect(rondKeukenAf(37.4)).toBe(37);
    expect(rondKeukenAf(2.3)).toBe(2.5);
    expect(rondKeukenAf(0.3)).toBe(0.25);
    expect(rondKeukenAf(0.375, "l")).toBe(0.4);
    expect(rondKeukenAf(0.01)).toBe(0.25);
  });

  it("vegetarisch: gehakt → linzen, label vlees weg, stap noemt nog gehakt", () => {
    const v = maakVoorstel(recept, ingredienten, { soort: "vegetarisch" }, [ik()]);
    expect(v.ingredienten[0]!.name).toBe("linzen");
    expect(v.tags).toEqual(["vegetarisch"]);
    expect(v.waarschuwingen.join(" ")).toMatch(/Stap 1 noemt nog “gehakt”/);
    expect(v.titelKopie).toBe("Lasagne (vegetarisch)");
  });

  it("zonder melk met notenallergie: rijstmelk (niet amandel), boter → olijfolie", () => {
    const v = maakVoorstel(recept, ingredienten, { soort: "zonder", allergeen: "melk" }, [
      ik(["noten", "gluten"]),
    ]);
    const namen = v.ingredienten.map((i) => i.name);
    expect(namen).toContain("olijfolie");
    expect(namen).toContain("sojamelk");
    expect(namen).not.toContain("havermelk");
    expect(namen).not.toContain("amandelmelk");
    expect(allergenenIn(namen, ["melk"])).toEqual([]);
  });

  it("zonder gluten: bloem vervangen, lasagnebladen hebben geen vervanger → weg met uitleg", () => {
    const v = maakVoorstel(
      { ...recept, title: "Pasta met room" },
      [
        { id: "x", name: "spaghetti", quantity: 400, unit: "g" },
        { id: "y", name: "lasagnebladen", quantity: 1, unit: "" },
      ],
      { soort: "zonder", allergeen: "gluten" },
      [ik()],
    );
    expect(v.wijzigingen[0]).toMatchObject({ soort: "vervangen", naar: "400 g rijstnoedels" });
    expect(v.wijzigingen[1]).toMatchObject({ soort: "weg" });
    expect(v.waarschuwingen.join(" ")).toMatch(/titel/);
  });

  it("rijWijzigingen: bijwerken op id, weggelaten rijen verwijderen", () => {
    const v = maakVoorstel(
      recept,
      [{ id: "x", name: "lasagnebladen", quantity: 1, unit: "" }, ...ingredienten],
      { soort: "zonder", allergeen: "gluten" },
      [ik()],
    );
    const r = rijWijzigingen(
      [{ id: "x", name: "lasagnebladen", quantity: 1, unit: "" }, ...ingredienten],
      v,
    );
    // Lasagnebladen (gluten) hebben geen vervanger: ook weg.
    expect(r.verwijderen).toEqual(["x", "e"]);
    expect(r.bijwerken).toEqual([{ id: "c", name: "maïzena", quantity: 50, unit: "g" }]);
  });

  it("één vervanger: alleen die rij verandert", () => {
    const v = vervangVoorstel(recept, ingredienten, 1, {
      naam: "Olijfolie",
      reden: "bakken",
      verhouding: "¾",
    });
    expect(v.ingredienten[1]!.name).toBe("olijfolie");
    expect(rijWijzigingen(ingredienten, v).bijwerken).toEqual([
      { id: "b", name: "olijfolie", quantity: 50, unit: "g" },
    ]);
  });
});

describe("mee-eters en daglimiet", () => {
  const lid = (n: string, user_id: string | null, beheerder_id: string | null): HuishoudenLid => ({
    id: n,
    group_id: "g",
    naam: n,
    user_id,
    rol: "volwassene",
    beheerder_id,
  });
  const voed = (lid_id: string, allergieen: string[], delen: boolean): LidVoeding => ({
    lid_id,
    allergieen,
    intoleranties: [],
    dieet: null,
    uitsluitingen: [],
    delen_met_gezin: delen,
    toestemming_door: "x",
    toestemming_soort: "beheerder",
    toestemming_op: "2026-01-01",
  });

  it("etersUit: ik + leesbare leden; reden alleen zichtbaar als gedeeld of beheerd", () => {
    const e = etersUit(
      { allergieen: ["gluten"] },
      [
        lid("Marie", "m", "m"),
        lid("Lotte", null, "jan"),
        lid("Gust", null, "m"),
        lid("Zonder", null, "jan"),
      ],
      new Map([
        ["Marie", voed("Marie", ["sesam"], false)],
        ["Lotte", voed("Lotte", ["noten"], false)],
        ["Gust", voed("Gust", [], false)],
      ]),
      "m",
    );
    expect(e.map((x) => x.naam)).toEqual(["Jij", "Lotte", "Gust"]);
    expect(e[0]!.allergieen).toEqual(["gluten", "sesam"]);
    expect(e[1]!.redenZichtbaar).toBe(false);
    expect(e[2]!.redenZichtbaar).toBe(true);
  });

  it("daglimiet telt per dag en loopt nooit onder nul", () => {
    let s = telOp(null, "2026-11-15");
    expect(resterend(s, "2026-11-15", 3)).toBe(2);
    s = telOp(telOp(telOp(s, "2026-11-15"), "2026-11-15"), "2026-11-15");
    expect(resterend(s, "2026-11-15", 3)).toBe(0);
    expect(resterend(s, "2026-11-16", 3)).toBe(3);
  });
});
