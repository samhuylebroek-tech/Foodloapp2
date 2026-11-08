import { describe, expect, it } from "vitest";
import { bepaalDieet } from "./dieet";
import { bewaardeEetstijl, eetstijlUitTags, tagsMetEetstijl } from "./recept-keuzes";

describe("bepaalDieet — herkent vlees en vis", () => {
  it.each([
    ["Stoofvlees van oma", [], ["rundvlees", "uien", "bloem"], "vlees"],
    ["Pasta", [], ["rundergehakt", "tomaten"], "vlees"],
    ["Ovenschotel", [], ["kippenfilet", "broccoli"], "vlees"],
    ["Soep", [], ["kippenbouillon", "wortel"], "vlees"], // kippenbouillon is niet vegetarisch
    ["Varkenshaas met saus", [], [], "vlees"],
    ["Zalm uit de oven", [], ["zalmfilet"], "vis"],
    ["Pasta", [], ["scampi's", "look"], "vis"],
    ["Paella", [], ["kip", "mosselen"], "vis"], // vis wint: wie geen vis eet, wil dit weten
  ])("%s → %s", (titel, tags, ingr, verwacht) => {
    expect(bepaalDieet(titel, tags, ingr)).toBe(verwacht);
  });
});

describe("bepaalDieet — geen valse treffers midden in een woord (BUG-029)", () => {
  it.each([
    ["Champignonsoep", ["champignons", "room"]], // bevat "ham"
    ["Risotto", ["champignons", "parmezaan"]],
    ["Speculaasjes", ["bloem", "boter"]],
    ["Gevulde paprika", ["rijst", "feta"]],
  ])("%s → vegetarisch", (titel, ingr) => {
    expect(bepaalDieet(titel, [], ingr)).toBe("vegetarisch");
  });
});

describe("bepaalDieet — bewaarde keuze van de gebruiker gaat voor", () => {
  it("expliciete tag 'vegetarisch' wint (bv. vegetarisch gehakt)", () => {
    expect(bepaalDieet("Lasagne", ["vegetarisch"], ["vegetarisch gehakt"])).toBe("vegetarisch");
  });
  it("tag 'vlees' wint", () => {
    expect(bepaalDieet("Groentesoep", ["vlees"], [])).toBe("vlees");
  });
  it("een tag die 'vis' alleen bevat ('visueel') telt niet", () => {
    expect(bepaalDieet("Taart", ["visueel"], ["bloem"])).toBe("vegetarisch");
  });
});

describe("eetstijl-tags", () => {
  it("bewaardeEetstijl: alleen exacte tag", () => {
    expect(bewaardeEetstijl(["vlees"])).toBe("vlees");
    expect(bewaardeEetstijl(["Vis "])).toBe("vis");
    expect(bewaardeEetstijl(["vissaus", "snel"])).toBeNull();
    expect(bewaardeEetstijl([])).toBeNull();
  });
  it("eetstijlUitTags valt terug op vegetarisch (bestaand gedrag voor weergave)", () => {
    expect(eetstijlUitTags([])).toBe("vegetarisch");
  });
  it("tagsMetEetstijl vervangt een oude eetstijl en houdt andere tags", () => {
    expect(tagsMetEetstijl(["snel", "vegetarisch"], "vlees")).toEqual(["snel", "vlees"]);
  });
});
