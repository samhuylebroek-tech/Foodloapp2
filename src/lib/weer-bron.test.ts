import { describe, expect, it } from "vitest";
import { bepaalContext } from "@/lib/intelligentie/context";
import { beveelAan } from "@/lib/intelligentie/voorstel";
import { kiesWeerAdapter, TestWeerAdapter, testWeerVoor, weerSignaal } from "./weer-bron";

describe("weer als zacht signaal (testadapter)", () => {
  it("testweer is vast per maand en altijd gelabeld als test", () => {
    const nov = testWeerVoor(new Date("2026-11-15T12:00:00"));
    expect(nov).toEqual({ temp: 7, regen: true, plaats: "Gent", test: true });
    expect(testWeerVoor(new Date("2026-07-01T12:00:00")).temp).toBe(27);
    expect(testWeerVoor(new Date("2026-11-15T12:00:00"), "warm").temp).toBe(28);
  });

  it("de testadapter geeft hetzelfde als de pure functie, zonder netwerk", async () => {
    const a = new TestWeerAdapter(() => "koud");
    expect(a.modus).toBe("test");
    expect(await a.haal(new Date("2026-05-01"))).toEqual({
      temp: 2,
      regen: false,
      plaats: "Gent",
      test: true,
    });
  });

  it("signaal alleen als het weer iets zegt", () => {
    expect(weerSignaal({ temp: 28, regen: false })?.titel).toBe("Warm vandaag: iets fris?");
    expect(weerSignaal({ temp: 7, regen: true })?.titel).toBe("Koud en nat: iets warms?");
    expect(weerSignaal({ temp: 3, regen: false })?.titel).toBe("Koud vandaag: iets warms?");
    expect(weerSignaal({ temp: 14, regen: true })?.soort).toBe("nat");
    expect(weerSignaal({ temp: 16, regen: false })).toBeNull();
    expect(weerSignaal(null)).toBeNull();
  });

  it("alleen in de demo een (test)bron; in productie geen", () => {
    expect(kiesWeerAdapter("demo")?.modus).toBe("test");
    expect(kiesWeerAdapter("e2e-nep")?.modus).toBe("test");
    expect(kiesWeerAdapter("abcdefghij")).toBeNull();
  });

  it("het weer stuurt de voorstellen zacht bij; zonder weer niets", () => {
    const kandidaten = [
      {
        id: "soep",
        title: "Pompoensoep",
        minuten: 30,
        category: "soep",
        tags: [],
        ingredienten: ["pompoen"],
      },
      {
        id: "salade",
        title: "Griekse salade",
        minuten: 15,
        category: "salade",
        tags: [],
        ingredienten: ["tomaat"],
      },
    ];
    const basis = {
      kandidaten,
      voorraad: [],
      geschiedenis: { laatst: {}, komend: new Set<string>(), minutenPerWeekdag: {} },
      voorkeur: { maxMinuten: 0, soort: null, vermijd: "" },
      max: 5,
    } as unknown as Parameters<typeof beveelAan>[0];
    const nu = new Date("2026-11-15T17:00:00");
    const warm = beveelAan({ ...basis, context: bepaalContext(nu, { temp: 28, regen: false }) });
    const koud = beveelAan({ ...basis, context: bepaalContext(nu, { temp: 3, regen: false }) });
    const geen = beveelAan({ ...basis, context: bepaalContext(nu, null) });
    const reden = (l: typeof warm, id: string) =>
      l
        .find((a) => a.id === id)
        ?.redenen.map((r) => r.tekst)
        .join(" ") ?? "";
    expect(reden(warm, "salade")).toMatch(/Fris voor een warme dag/);
    expect(reden(koud, "soep")).toMatch(/Warm eten voor een koude dag/);
    expect(reden(geen, "soep")).not.toMatch(/°C/);
    const nat = beveelAan({ ...basis, context: bepaalContext(nu, { temp: 14, regen: true }) });
    // Zacht: een paar punten erbij, geen harde regel (de reden kan wegvallen achter sterkere).
    const score = (l: typeof warm, id: string) => l.find((a) => a.id === id)?.score ?? 0;
    expect(score(nat, "soep")).toBe(score(geen, "soep") + 3);
  });
});
