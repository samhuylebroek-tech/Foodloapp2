import { describe, expect, it } from "vitest";
import type { Regel } from "@/lib/kringloop";
import { nogNodigVoorMorgen } from "./voor-morgen";

const regel = (naam: string, voor: { titel: string; dag: string }[]): Regel => ({
  sleutel: `${naam}|`,
  naam,
  quantity: 1,
  unit: "",
  nodig: 1,
  inHuisDeels: null,
  opLijstDeels: null,
  categorie: "overig" as Regel["categorie"],
  voor,
  recipe_id: null,
});

describe("Voor morgen nog nodig (winkelmodus)", () => {
  it("alleen wat voor vandaag of morgen nodig is", () => {
    const uit = nogNodigVoorMorgen(
      [
        regel("citroen", [{ titel: "Zalm", dag: "2026-11-13" }]),
        regel("room", [{ titel: "Stoofvlees", dag: "2026-11-15" }]),
      ],
      "2026-11-12",
    );
    expect(uit).toEqual({
      sleutels: ["citroen|"],
      namen: ["citroen"],
      gerechten: ["Zalm"],
      kop: "Voor morgen nog nodig",
    });
  });

  it("vandaag en morgen samen, gerechten uniek en op volgorde van de dag", () => {
    const uit = nogNodigVoorMorgen(
      [
        regel("dille", [{ titel: "Zalm", dag: "2026-11-13" }]),
        regel("ui", [
          { titel: "Soep", dag: "2026-11-12" },
          { titel: "Zalm", dag: "2026-11-13" },
          { titel: "Curry", dag: "2026-11-18" },
        ]),
      ],
      "2026-11-12",
    );
    expect(uit?.kop).toBe("Voor vandaag en morgen nog nodig");
    expect(uit?.gerechten).toEqual(["Soep", "Zalm"]);
    expect(uit?.namen).toEqual(["dille", "ui"]);
  });

  it("alleen vandaag", () => {
    expect(
      nogNodigVoorMorgen([regel("ui", [{ titel: "Soep", dag: "2026-11-12" }])], "2026-11-12")?.kop,
    ).toBe("Voor vandaag nog nodig");
  });

  it("over de maandgrens en niets nodig → null", () => {
    expect(
      nogNodigVoorMorgen([regel("ui", [{ titel: "Soep", dag: "2026-12-01" }])], "2026-11-30")?.kop,
    ).toBe("Voor morgen nog nodig");
    expect(nogNodigVoorMorgen([], "2026-11-12")).toBeNull();
    expect(
      nogNodigVoorMorgen([regel("ui", [{ titel: "Soep", dag: "2026-11-11" }])], "2026-11-12"),
    ).toBeNull();
  });
});
