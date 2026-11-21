import { afterEach, describe, expect, it, vi } from "vitest";
import { analyseToegestaan, huidigeKeuze, leesToestel } from "./toestemmingen";
import { aiUitgezet } from "./ai-toestemming";

afterEach(() => vi.unstubAllGlobals());

describe("toestemmingen: intrekken wint altijd", () => {
  it("standaard aan, bron 'standaard'", () => {
    expect(huidigeKeuze("ai", {}, [])).toEqual({ aan: true, sinds: null, bron: "standaard" });
  });
  it("uit op dit toestel wint van aan op het account", () => {
    const k = huidigeKeuze("ai", { ai: { aan: false, sinds: "2026-11-20" } }, [
      { soort: "ai", aan: true, sinds: "2026-11-21" },
    ]);
    expect(k).toEqual({ aan: false, sinds: "2026-11-20", bron: "toestel" });
  });
  it("uit op het account wint van aan op dit toestel", () => {
    const k = huidigeKeuze("analyse", { analyse: { aan: true, sinds: "x" } }, [
      { soort: "analyse", aan: false, sinds: "2026-11-19" },
    ]);
    expect(k.aan).toBe(false);
    expect(k.bron).toBe("account");
  });
  it("account-keuze gaat voor de standaard; andere soorten storen niet", () => {
    expect(huidigeKeuze("community", {}, [{ soort: "ai", aan: false, sinds: null }]).aan).toBe(
      true,
    );
  });
});

describe("leesToestel / analyseToegestaan", () => {
  function opslag(waarde: string | null) {
    vi.stubGlobal("window", { localStorage: { getItem: () => waarde } });
  }
  it("leest alleen geldige keuzes, negeert rommel", () => {
    opslag(JSON.stringify({ ai: { aan: false, sinds: "t" }, analyse: { aan: "ja" }, zomaar: 1 }));
    expect(leesToestel("u1")).toEqual({ ai: { aan: false, sinds: "t" } });
  });
  it("analyse uit op dit toestel → niet meten", () => {
    opslag(JSON.stringify({ analyse: { aan: false, sinds: "t" } }));
    expect(analyseToegestaan("u1")).toBe(false);
  });
  it("kapotte opslag of geen gebruiker → standaard (meten mag)", () => {
    opslag("{kapot");
    expect(analyseToegestaan("u1")).toBe(true);
    expect(analyseToegestaan(null)).toBe(true);
  });
});

describe("aiUitgezet (server)", () => {
  it("kop 'uit' van het toestel of rij aan=false op het account weigert", () => {
    expect(aiUitgezet("uit", null)).toBe(true);
    expect(aiUitgezet(" UIT ", null)).toBe(true);
    expect(aiUitgezet(null, { aan: false })).toBe(true);
  });
  it("geen kop en geen rij, of rij aan → toegestaan", () => {
    expect(aiUitgezet(null, null)).toBe(false);
    expect(aiUitgezet("aan", { aan: true })).toBe(false);
    expect(aiUitgezet(undefined, {})).toBe(false);
  });
});
