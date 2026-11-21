import { describe, expect, it } from "vitest";
import {
  campagneLoopt,
  deelOntdekIn,
  gesponsordLabel,
  indienFout,
  kiesGesponsordePlek,
  magGesponsordTonen,
  partnerMag,
  rapportTotalen,
  rolWijzigingFout,
  veiligeWebsite,
  type CampagneStatus,
} from "./partners";

const c = (id: string, status: CampagneStatus, start: string | null, einde: string | null) => ({
  id,
  status,
  start,
  einde,
});

describe("partnerrechten", () => {
  it("volgt de rollenmatrix", () => {
    expect(partnerMag("eigenaar", "team.beheren")).toBe(true);
    expect(partnerMag("beheerder", "team.beheren")).toBe(false);
    expect(partnerMag("beheerder", "campagnes.bewerken")).toBe(true);
    expect(partnerMag("analist", "campagnes.bewerken")).toBe(false);
    expect(partnerMag("analist", "rapportage.zien")).toBe(true);
    expect(partnerMag("finance", "abonnement.beheren")).toBe(true);
    expect(partnerMag("finance", "producten.bewerken")).toBe(false);
    expect(partnerMag(null, "rapportage.zien")).toBe(false);
  });
  it("laat altijd minstens één eigenaar over", () => {
    const leden = [
      { id: "a", rol: "eigenaar" as const },
      { id: "b", rol: "analist" as const },
    ];
    expect(rolWijzigingFout(leden, "a", "analist")).toMatch(/minstens één eigenaar/);
    expect(rolWijzigingFout(leden, "a", null)).toMatch(/minstens één eigenaar/);
    expect(rolWijzigingFout(leden, "b", "beheerder")).toBeNull();
    expect(rolWijzigingFout([...leden, { id: "c", rol: "eigenaar" }], "a", null)).toBeNull();
  });
});

describe("campagnes", () => {
  it("indienen vraagt naam, datums en minstens één item", () => {
    const basis = {
      status: "concept" as const,
      naam: "Herfst",
      start: "2026-11-01",
      einde: "2026-11-30",
    };
    expect(indienFout(basis, 1)).toBeNull();
    expect(indienFout(basis, 0)).toMatch(/Koppel eerst/);
    expect(indienFout({ ...basis, einde: "2026-10-01" }, 1)).toMatch(/vóór/);
    expect(indienFout({ ...basis, status: "ingediend" }, 1)).toMatch(/Alleen een concept/);
    expect(indienFout({ ...basis, start: null }, 1)).toMatch(/datum/);
  });
  it("loopt alleen goedgekeurd/actief binnen de datums", () => {
    expect(campagneLoopt(c("1", "actief", "2026-11-01", "2026-11-30"), "2026-11-15")).toBe(true);
    expect(campagneLoopt(c("1", "goedgekeurd", "2026-11-01", "2026-11-30"), "2026-11-30")).toBe(
      true,
    );
    expect(campagneLoopt(c("1", "ingediend", "2026-11-01", "2026-11-30"), "2026-11-15")).toBe(
      false,
    );
    expect(campagneLoopt(c("1", "concept", "2026-11-01", "2026-11-30"), "2026-11-15")).toBe(false);
    expect(campagneLoopt(c("1", "actief", "2026-11-01", "2026-11-10"), "2026-11-15")).toBe(false);
  });
});

describe("gesponsorde plek in Ontdek", () => {
  const items = [
    { id: "i1", campagne_id: "b", recipe_id: "r1" },
    { id: "i2", campagne_id: "a", recipe_id: "r2" },
    { id: "i3", campagne_id: "x", recipe_id: "r3" },
  ];
  it("kiest max één item van een lopende campagne, in vaste volgorde", () => {
    const camps = [
      c("b", "actief", "2026-11-05", "2026-11-30"),
      c("a", "goedgekeurd", "2026-11-01", "2026-11-30"),
      c("x", "ingediend", "2026-10-01", "2026-12-30"),
    ];
    expect(kiesGesponsordePlek(camps, items, "2026-11-15")?.id).toBe("i2");
    expect(kiesGesponsordePlek(camps, items, "2026-12-15")).toBeNull();
    expect(kiesGesponsordePlek([], items, "2026-11-15")).toBeNull();
  });
  it("mengt nooit een gesponsord item tussen de persoonlijke voorstellen", () => {
    const voorstellen = [{ id: "r1" }, { id: "r2" }, { id: "r9" }];
    const { voorstellen: v, gesponsord } = deelOntdekIn(voorstellen, { recipe_id: "r2" });
    expect(v.map((x) => x.id)).toEqual(["r1", "r9"]);
    expect(gesponsord?.recipe_id).toBe("r2");
    expect(deelOntdekIn(voorstellen, null).voorstellen).toHaveLength(3);
    // Eigenschap: voor elke keuze zit de gesponsorde id nooit in de voorstellen.
    for (const id of ["r1", "r2", "r9", "zz"]) {
      expect(
        deelOntdekIn(voorstellen, { recipe_id: id }).voorstellen.some((x) => x.id === id),
      ).toBe(false);
    }
  });
  it("past dezelfde allergie- en dieetregels toe", () => {
    const pompoen = {
      title: "Pompoen met feta",
      tags: ["vegetarisch"],
      ingredienten: ["pompoen", "feta", "honing"],
    };
    expect(magGesponsordTonen(pompoen, { allergieen: [] })).toBe(true);
    expect(magGesponsordTonen(pompoen, { allergieen: ["melk"] })).toBe(false);
    expect(magGesponsordTonen(pompoen, { allergieen: ["noten"] })).toBe(true);
    expect(magGesponsordTonen({ ...pompoen, ingredienten: [] }, { allergieen: ["noten"] })).toBe(
      false,
    );
    expect(magGesponsordTonen(pompoen, { allergieen: [], dieet: "veganistisch" })).toBe(false);
  });
  it("label is altijd herkenbaar commercieel", () => {
    expect(gesponsordLabel("Gesponsord", "Hoeve Groen").label).toBe("Gesponsord");
    expect(gesponsordLabel("Topkeuze van de chef!", "Hoeve Groen").label).toBe("Gesponsord");
    expect(gesponsordLabel("", "Hoeve Groen").partner).toBe("In samenwerking met Hoeve Groen");
  });
});

describe("rapportage", () => {
  it("telt alleen totalen op, met klikratio", () => {
    const r = rapportTotalen([
      { campagne_id: "a", dag: "2026-11-01", vertoningen: 1000, klikken: 25 },
      { campagne_id: "a", dag: "2026-11-02", vertoningen: 500, klikken: 5 },
      { campagne_id: "b", dag: "2026-11-02", vertoningen: 0, klikken: 0 },
      { campagne_id: "b", dag: "2026-11-03", vertoningen: -5, klikken: 2 },
    ]);
    expect(r.vertoningen).toBe(1500);
    expect(r.klikken).toBe(32);
    expect(r.perCampagne.find((p) => p.campagne_id === "a")?.klikratio).toBe(2);
    expect(r.perCampagne.find((p) => p.campagne_id === "b")?.klikratio).toBe(0);
  });
  it("website alleen https", () => {
    expect(veiligeWebsite("hoevegroen.be")).toBe("https://hoevegroen.be/");
    expect(veiligeWebsite("http://x.be")).toBeNull();
    expect(veiligeWebsite("javascript:alert(1)")).toBeNull();
    expect(veiligeWebsite("")).toBeNull();
  });
});
