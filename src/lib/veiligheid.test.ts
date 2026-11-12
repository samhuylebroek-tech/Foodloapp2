import { describe, expect, it } from "vitest";
import { allergieOordeel, ideeTitelToegelaten, magVoorstellen, pastBijDieet } from "./veiligheid";
import { toegelaten } from "./intelligentie/voorstel";

const pasta = {
  title: "Pasta pesto",
  ingredienten: ["spaghetti", "basilicum", "pijnboompitten", "parmezaan"],
};
const soep = { title: "Pompoensoep", ingredienten: ["pompoen", "ui", "groentebouillon"] };
const leeg = { title: "Oma's schotel", ingredienten: [] };
const sate = { title: "Kip met pindasaus", ingredienten: ["kip", "saus"] };
const kaasomelet = { title: "Omelet", ingredienten: ["ei", "kaas"] };
const linzen = { title: "Linzencurry", ingredienten: ["rode linzen", "kokosmelk", "ui"] };

describe("allergieOordeel", () => {
  it("zonder allergieën: niets te controleren", () => {
    expect(allergieOordeel(pasta, []).status).toBe("geen-allergieen");
  });
  it("vindt allergenen in de ingrediënten", () => {
    const o = allergieOordeel(pasta, ["gluten", "melk"]);
    expect(o.status).toBe("allergeen");
    if (o.status === "allergeen")
      expect(o.treffers.map((t) => t.id).sort()).toEqual(["gluten", "melk"]);
  });
  it("vindt een allergeen in de titel als de ingrediëntregel vaag is", () => {
    const o = allergieOordeel(sate, ["pindas"]);
    expect(o.status).toBe("allergeen");
    if (o.status === "allergeen")
      expect(o.treffers[0]!.ingredienten).toEqual(["Kip met pindasaus"]);
  });
  it("toont de titel niet als een ingrediënt al de aanwijzing is", () => {
    const o = allergieOordeel(
      { title: "Spaghetti bolognese", ingredienten: ["spaghetti", "gehakt"] },
      ["gluten"],
    );
    if (o.status !== "allergeen") throw new Error("verwacht allergeen");
    expect(o.treffers[0]!.ingredienten).toEqual(["spaghetti"]);
  });
  it("geen ingrediënten = onbekend, nooit 'veilig'", () => {
    expect(allergieOordeel(leeg, ["noten"]).status).toBe("onbekend");
    expect(allergieOordeel({ title: "X", ingredienten: ["  ", ""] }, ["noten"]).status).toBe(
      "onbekend",
    );
  });
  it("veilig als er ingrediënten zijn en niets gevonden wordt", () => {
    expect(allergieOordeel(soep, ["gluten", "noten"]).status).toBe("ok");
  });
});

describe("pastBijDieet", () => {
  it("alles en weinig vlees sluiten niets uit", () => {
    expect(pastBijDieet(sate, "alles")).toBe(true);
    expect(pastBijDieet(sate, "weinig-vlees")).toBe(true);
    expect(pastBijDieet(sate, undefined)).toBe(true);
  });
  it("vegetarisch: geen vlees, geen vis, geen gelatine", () => {
    expect(pastBijDieet(sate, "vegetarisch")).toBe(false);
    expect(pastBijDieet({ title: "Zalm", ingredienten: ["zalm"] }, "vegetarisch")).toBe(false);
    expect(
      pastBijDieet({ title: "Pudding", ingredienten: ["melk", "gelatine"] }, "vegetarisch"),
    ).toBe(false);
    expect(pastBijDieet(kaasomelet, "vegetarisch")).toBe(true);
  });
  it("pescotarisch: vis mag, vlees niet", () => {
    expect(pastBijDieet({ title: "Zalm", ingredienten: ["zalm"] }, "pescotarisch")).toBe(true);
    expect(pastBijDieet(sate, "pescotarisch")).toBe(false);
  });
  it("veganistisch: ook geen melk, kaas, ei of honing", () => {
    expect(pastBijDieet(kaasomelet, "veganistisch")).toBe(false);
    expect(pastBijDieet(pasta, "veganistisch")).toBe(false);
    expect(
      pastBijDieet({ title: "Granola", ingredienten: ["havermout", "honing"] }, "veganistisch"),
    ).toBe(false);
    expect(pastBijDieet(linzen, "veganistisch")).toBe(true);
    expect(pastBijDieet(soep, "veganistisch")).toBe(true);
  });
});

describe("magVoorstellen en de harde regel van de voorstellen", () => {
  const kandidaat = (g: { title: string; ingredienten: string[] }) => ({
    id: g.title,
    title: g.title,
    minuten: 30,
    category: "hoofdgerecht",
    tags: [],
    ingredienten: g.ingredienten,
  });
  const voorkeur = { maxMinuten: 0, soort: null, vermijd: "" };

  it("zonder allergieën mag ook een recept zonder ingrediënten", () => {
    expect(magVoorstellen(leeg, {})).toBe(true);
    expect(toegelaten(kandidaat(leeg), { voorkeur, allergieen: [] })).toBe(true);
  });
  it("met allergieën nooit een recept zonder ingrediënten", () => {
    expect(magVoorstellen(leeg, { allergieen: ["selder"] })).toBe(false);
    expect(toegelaten(kandidaat(leeg), { voorkeur, allergieen: ["selder"] })).toBe(false);
  });
  it("allergeen in de titel: niet voorgesteld", () => {
    expect(toegelaten(kandidaat(sate), { voorkeur, allergieen: ["pindas"] })).toBe(false);
  });
  it("veganistisch via de weekvoorkeur: geen kaas of ei", () => {
    expect(
      toegelaten(kandidaat(kaasomelet), { voorkeur: { ...voorkeur, dieet: "veganistisch" } }),
    ).toBe(false);
    expect(
      toegelaten(kandidaat(linzen), { voorkeur: { ...voorkeur, dieet: "veganistisch" } }),
    ).toBe(true);
  });
  it("noten: walnoten uitgesloten, kokosmelk niet", () => {
    expect(
      magVoorstellen(
        { title: "Salade", ingredienten: ["sla", "walnoten"] },
        { allergieen: ["noten"] },
      ),
    ).toBe(false);
    expect(magVoorstellen(linzen, { allergieen: ["noten"] })).toBe(true);
  });
});

describe("ideeTitelToegelaten (AI-ideeën, op het toestel)", () => {
  it("valt af als de titel een gekozen allergeen noemt", () => {
    expect(ideeTitelToegelaten("Pasta met scampi", { allergieen: ["schaaldieren"] })).toBe(false);
    expect(ideeTitelToegelaten("Bloemkoolcurry", { allergieen: ["gluten"] })).toBe(true);
  });
  it("valt af als de titel buiten het dieet valt", () => {
    expect(ideeTitelToegelaten("Kip tikka masala", { dieet: "vegetarisch" })).toBe(false);
    expect(ideeTitelToegelaten("Kaasfondue", { dieet: "veganistisch" })).toBe(false);
    expect(ideeTitelToegelaten("Linzensoep", { dieet: "veganistisch" })).toBe(true);
  });
});

describe("dieet zonder ingrediënten en het label 'vlees'", () => {
  it("label 'vlees' of 'stoverij' telt als vlees", () => {
    expect(
      pastBijDieet(
        { title: "Vlaamse stoverij met frietjes", tags: ["vlees", "stoof"], ingredienten: [] },
        "vegetarisch",
      ),
    ).toBe(false);
    expect(
      pastBijDieet(
        { title: "Spaghetti met vleesvervanger", ingredienten: ["spaghetti", "vleesvervanger"] },
        "vegetarisch",
      ),
    ).toBe(true);
  });
  it("zonder ingrediënten alleen als het gerecht zelf zegt dat het past", () => {
    const taart = { title: "Appeltaart van oma", tags: ["vegetarisch"], ingredienten: [] };
    expect(pastBijDieet(taart, "vegetarisch")).toBe(true);
    expect(pastBijDieet(taart, "veganistisch")).toBe(false);
    expect(pastBijDieet({ title: "Schotel van oma", ingredienten: [] }, "vegetarisch")).toBe(false);
    expect(pastBijDieet({ title: "Vegan chili", ingredienten: [] }, "veganistisch")).toBe(true);
    expect(pastBijDieet({ title: "Schotel van oma", ingredienten: [] }, "alles")).toBe(true);
  });
  it("AI-idee: een titel zonder vlees blijft toegelaten (en wordt later nagekeken)", () => {
    expect(ideeTitelToegelaten("Ovenschotel met groenten", { dieet: "vegetarisch" })).toBe(true);
  });
});
