import { describe, expect, it } from "vitest";
import {
  bewaarVoortgang,
  duurLabel,
  leesVoortgang,
  toonTijd,
  VOORTGANG_GELDIG_MS,
  vindTimers,
  wisVoortgang,
} from "./kookstand";

describe("vindTimers", () => {
  it.each([
    ["Laat 2 uur zachtjes stoven.", [{ seconden: 7200, label: "2 uur" }]],
    ["Laat 2,5 uur stoven met het deksel op de pot.", [{ seconden: 9000, label: "2,5 uur" }]],
    ["Bak 12 tot 15 minuten.", [{ seconden: 720, label: "12 tot 15 minuten" }]],
    ["Kook 8-10 min.", [{ seconden: 480, label: "8-10 min" }]],
    ["Laat een half uur rusten.", [{ seconden: 1800, label: "een half uur" }]],
    ["Laat anderhalf uur rijzen.", [{ seconden: 5400, label: "anderhalf uur" }]],
    [
      "Kook 1 minuut en daarna 30 seconden.",
      [
        { seconden: 60, label: "1 minuut" },
        { seconden: 30, label: "30 seconden" },
      ],
    ],
  ])("%s", (stap, verwacht) => {
    expect(vindTimers(stap)).toEqual(verwacht);
  });

  it.each([
    "Verwarm de oven voor op 200 graden.",
    "Voeg 2 uien toe.",
    "Snij 4 tomaten in stukken.",
    "Laat minstens 4 uurtjes",
    "Wacht 5 sec.", // onder 10 s: geen timer
  ])("geen (zinloze) timer in: %s", (stap) => {
    expect(vindTimers(stap)).toEqual([]);
  });

  it("geen dubbele timers voor dezelfde duur", () => {
    expect(vindTimers("Bak 10 min. Draai om en bak nog 10 min.")).toHaveLength(1);
  });
});

describe("toonTijd / duurLabel", () => {
  it.each([
    [0, "0:00"],
    [45, "0:45"],
    [750, "12:30"],
    [3725, "1:02:05"],
    [-3, "0:00"],
    [59.2, "1:00"],
  ])("toonTijd(%s) = %s", (s, v) => expect(toonTijd(s)).toBe(v));

  it.each([
    [7200, "2 uur"],
    [5400, "1 uur 30 min"],
    [900, "15 min"],
    [90, "1 min 30 sec"],
    [45, "45 sec"],
  ])("duurLabel(%s) = %s", (s, v) => expect(duurLabel(s)).toBe(v));
});

describe("voortgang bewaren", () => {
  function geheugen() {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  }

  it("bewaart en leest de stap", () => {
    const o = geheugen();
    bewaarVoortgang("r1", 3, 1000, o);
    expect(leesVoortgang("r1", 6, 2000, o)).toBe(3);
  });
  it("vervalt na 12 uur", () => {
    const o = geheugen();
    bewaarVoortgang("r1", 3, 0, o);
    expect(leesVoortgang("r1", 6, VOORTGANG_GELDIG_MS + 1, o)).toBeNull();
  });
  it("negeert een stap die niet (meer) bestaat", () => {
    const o = geheugen();
    bewaarVoortgang("r1", 9, 0, o);
    expect(leesVoortgang("r1", 6, 1, o)).toBeNull();
  });
  it("negeert kapotte data en geblokkeerde opslag", () => {
    const o = geheugen();
    o.setItem("foodlo:kookstand:r1", "{kapot");
    expect(leesVoortgang("r1", 6, 1, o)).toBeNull();
    const kapot = {
      getItem: () => {
        throw new Error("geblokkeerd");
      },
      setItem: () => {
        throw new Error("vol");
      },
      removeItem: () => {
        throw new Error("x");
      },
    };
    expect(() => bewaarVoortgang("r1", 1, 0, kapot)).not.toThrow();
    expect(leesVoortgang("r1", 6, 1, kapot)).toBeNull();
    expect(() => wisVoortgang("r1", kapot)).not.toThrow();
  });
  it("wissen werkt per recept", () => {
    const o = geheugen();
    bewaarVoortgang("r1", 1, 0, o);
    bewaarVoortgang("r2", 2, 0, o);
    wisVoortgang("r1", o);
    expect(leesVoortgang("r1", 6, 1, o)).toBeNull();
    expect(leesVoortgang("r2", 6, 1, o)).toBe(2);
  });
});
