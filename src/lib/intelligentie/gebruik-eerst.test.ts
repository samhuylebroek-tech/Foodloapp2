import { describe, expect, it } from "vitest";
import { dagenTekst, gebruikEerst } from "./gebruik-eerst";
import { beoordeel, type Invoer } from "./voorstel";
import { bepaalContext } from "./context";
import { vatSamen } from "./geschiedenis";

const NU = Date.parse("2026-11-12T12:00:00Z");
const geleden = (dagen: number) => new Date(NU - dagen * 86400000).toISOString();

describe("gebruikEerst", () => {
  it("toont verse producten na hun drempel, de oudste eerst", () => {
    const uit = gebruikEerst(
      [
        { naam: "spinazie", updated_at: geleden(6) },
        { naam: "kipfilet", updated_at: geleden(3) },
        { naam: "tomaten", updated_at: geleden(2) },
      ],
      NU,
    );
    expect(uit).toEqual([
      { naam: "kipfilet", dagen: 3 },
      { naam: "spinazie", dagen: 6 },
    ]);
  });
  it("lang houdbare verse producten pas na twee weken; basis en kast nooit", () => {
    const uit = gebruikEerst(
      [
        { naam: "uien", updated_at: geleden(10) },
        { naam: "pompoen", updated_at: geleden(15) },
        { naam: "olijfolie", updated_at: geleden(40) },
        { naam: "rijst", updated_at: geleden(40) },
        { naam: "zout", updated_at: geleden(40) },
      ],
      NU,
    );
    expect(uit).toEqual([{ naam: "pompoen", dagen: 15 }]);
  });
  it("zonder datum of na 60 dagen: niets (geen verzonnen leeftijd)", () => {
    expect(
      gebruikEerst([{ naam: "spinazie" }, { naam: "melk", updated_at: geleden(90) }], NU),
    ).toEqual([]);
  });
  it("valt terug op created_at en beperkt het aantal", () => {
    const veel = ["spinazie", "sla", "champignons", "courgette"].map((naam) => ({
      naam,
      created_at: geleden(5),
    }));
    expect(gebruikEerst(veel, NU)).toHaveLength(3);
  });
  it("tekst", () => {
    expect(dagenTekst(1)).toBe("al 1 dag in huis");
    expect(dagenTekst(6)).toBe("al 6 dagen in huis");
  });
});

describe("voorstel gebruikt eerst wat al even in huis is", () => {
  const kandidaat = (id: string, ingredienten: string[]) => ({
    id,
    title: id,
    minuten: 30,
    category: "hoofdgerecht",
    tags: [],
    ingredienten,
  });
  const basis: Invoer = {
    kandidaten: [],
    context: bepaalContext(new Date(NU)),
    voorraad: ["spinazie", "pasta"],
    geschiedenis: vatSamen([], {}, "2026-11-12"),
    voorkeur: { maxMinuten: 0, soort: null, vermijd: "" },
  };
  it("hogere score en de reden noemt het product en de dagen", () => {
    const quiche = kandidaat("Quiche", ["spinazie", "eieren", "room"]);
    const zonder = beoordeel(quiche, basis);
    const met = beoordeel(quiche, { ...basis, oudInHuis: [{ naam: "spinazie", dagen: 6 }] });
    expect(met.score).toBeGreaterThan(zonder.score);
    expect(met.redenen[0]!.tekst).toBe("Gebruikt je spinazie (al 6 dagen in huis)");
  });
  it("geen invloed als het gerecht het product niet gebruikt", () => {
    const pasta = kandidaat("Pasta", ["pasta", "tomaten"]);
    const zonder = beoordeel(pasta, basis);
    const met = beoordeel(pasta, { ...basis, oudInHuis: [{ naam: "spinazie", dagen: 6 }] });
    expect(met.score).toBe(zonder.score);
  });
});
