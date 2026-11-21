import { describe, expect, it } from "vitest";
import {
  activiteitVanWeek,
  aanwezigTekst,
  laatsteWijziger,
  telPerPersoon,
  type Activiteit,
} from "./activiteit";
import {
  lijstRechten,
  mijnDeel,
  perWinkel,
  schoneWinkel,
  wieHaaltTekst,
  zetToewijzing,
  type Toewijzing,
} from "./verdelen";

const items = [{ id: "melk" }, { id: "brood" }, { id: "kaas" }];
const toew: Toewijzing[] = [
  { item_id: "brood", toegewezen_aan: "jan", winkel: "Bakker" },
  { item_id: "kaas", toegewezen_aan: "marie", winkel: null },
  { item_id: "melk", toegewezen_aan: null, winkel: "Colruyt" },
];
const namen = { jan: "Jan Peeters", marie: "Marie" };

describe("lijst verdelen", () => {
  it("Mijn deel: alleen wat aan mij is toegewezen", () => {
    expect(mijnDeel(items, toew, "jan").map((i) => i.id)).toEqual(["brood"]);
    expect(mijnDeel(items, toew, "marie").map((i) => i.id)).toEqual(["kaas"]);
    expect(mijnDeel(items, toew, null)).toEqual([]);
  });
  it("wie haalt wat", () => {
    expect(wieHaaltTekst(toew[0], namen, "marie")).toBe("Jan haalt dit · Bakker");
    expect(wieHaaltTekst(toew[1], namen, "marie")).toBe("Jij haalt dit");
    expect(wieHaaltTekst(toew[2], namen, "marie")).toBe("Colruyt");
    expect(wieHaaltTekst(undefined, namen, "marie")).toBeNull();
    expect(
      wieHaaltTekst({ item_id: "x", toegewezen_aan: "onbekend", winkel: null }, namen, "marie"),
    ).toBe("Iemand anders haalt dit");
  });
  it("per winkel, zonder winkel achteraan", () => {
    expect(perWinkel(items, toew).map((g) => [g.winkel, g.items.map((i) => i.id)])).toEqual([
      ["Bakker", ["brood"]],
      ["Colruyt", ["melk"]],
      ["Overal", ["kaas"]],
    ]);
  });
  it("toewijzing zetten, wijzigen en leegmaken", () => {
    const een = zetToewijzing([], { item_id: "melk", toegewezen_aan: "jan", winkel: "  Aldi " });
    expect(een).toEqual([{ item_id: "melk", toegewezen_aan: "jan", winkel: "Aldi" }]);
    expect(zetToewijzing(een, { item_id: "melk", toegewezen_aan: null, winkel: "" })).toEqual([]);
    expect(schoneWinkel("x".repeat(50))).toHaveLength(30);
  });
});

describe("rollen", () => {
  const lid = (shopping_edit: boolean, shopping_view = true, status = "actief") => ({
    status,
    shopping_edit,
    shopping_view,
  });
  it("eigen lijst: alles; andermans eigen lijst: niets", () => {
    expect(lijstRechten({ gezinslijst: false, eigenaarVanLijst: true }).verwijderen).toBe(true);
    expect(lijstRechten({ gezinslijst: false, eigenaarVanLijst: false }).afvinken).toBe(false);
  });
  it("gezinslijst: lid met bewerken mag alles", () => {
    expect(lijstRechten({ gezinslijst: true, eigenaarVanLijst: false, lid: lid(true) })).toEqual({
      afvinken: true,
      bewerken: true,
      verwijderen: true,
      verdelen: true,
    });
  });
  it("kijker en kind: afvinken wel, verwijderen en verdelen niet", () => {
    const kijker = lijstRechten({ gezinslijst: true, eigenaarVanLijst: false, lid: lid(false) });
    expect(kijker).toEqual({
      afvinken: true,
      bewerken: false,
      verwijderen: false,
      verdelen: false,
    });
    const kind = lijstRechten({
      gezinslijst: true,
      eigenaarVanLijst: false,
      lid: lid(true),
      huishoudRol: "kind",
    });
    expect(kind.afvinken).toBe(true);
    expect(kind.verwijderen).toBe(false);
    expect(kind.verdelen).toBe(false);
  });
  it("uitgenodigd (nog niet actief) of geen rechten: niets", () => {
    expect(
      lijstRechten({
        gezinslijst: true,
        eigenaarVanLijst: false,
        lid: lid(true, true, "uitgenodigd"),
      }).afvinken,
    ).toBe(false);
    expect(
      lijstRechten({ gezinslijst: true, eigenaarVanLijst: false, lid: lid(false, false) }).afvinken,
    ).toBe(false);
  });
});

describe("activiteit en aanwezigheid", () => {
  const a = (
    id: string,
    actor: string,
    datum: string,
    op: string,
    ref: string | null = null,
  ): Activiteit => ({
    id,
    group_id: "g",
    actor_id: actor,
    soort: "menu",
    tekst: id,
    datum,
    ref_id: ref,
    created_at: op,
  });
  const log = [
    a("1", "jan", "2026-11-18", "2026-11-17T10:00:00Z", "p1"),
    a("2", "marie", "2026-11-18", "2026-11-17T11:00:00Z", "p1"),
    a("3", "jan", "2026-11-25", "2026-11-17T12:00:00Z"),
  ];
  it("alleen deze week, nieuwste eerst", () => {
    expect(activiteitVanWeek(log, "2026-11-16", "2026-11-22").map((x) => x.id)).toEqual(["2", "1"]);
  });
  it("laatste wijziger, zonder jezelf", () => {
    expect(laatsteWijziger(log, "p1")).toBe("marie");
    expect(laatsteWijziger(log, "p1", "marie")).toBe("jan");
    expect(laatsteWijziger(log, "p9")).toBeNull();
  });
  it("telling per persoon", () => {
    expect(telPerPersoon(log, { jan: "Jan", marie: "Marie" })).toBe("Jan 2 · Marie 1");
  });
  it("aanwezigheid: jezelf telt niet, bewerken gaat voor kijken", () => {
    expect(
      aanwezigTekst([{ user_id: "marie", naam: "Marie", bezig: true }], "marie", "de lijst"),
    ).toBeNull();
    expect(
      aanwezigTekst(
        [
          { user_id: "jan", naam: "Jan Peeters", bezig: false },
          { user_id: "jan", naam: "Jan Peeters", bezig: true },
        ],
        "marie",
        "de lijst",
      ),
    ).toBe("Jan is de lijst aan het bewerken");
    expect(
      aanwezigTekst(
        [
          { user_id: "jan", naam: "Jan", bezig: false },
          { user_id: "lotte", naam: "Lotte", bezig: false },
        ],
        "marie",
        "het weekmenu",
      ),
    ).toBe("Jan en Lotte kijken ook naar het weekmenu");
  });
});
