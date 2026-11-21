import { describe, expect, it } from "vitest";
import {
  kanVerplaatsen,
  telbareRegels,
  verplaats,
  verplaatsRegel,
  wisselSleutels,
} from "./volgorde";

describe("herschikken", () => {
  it("telt alleen regels met inhoud", () => {
    expect(telbareRegels("a\n\n  \nb\n3. \nc")).toEqual(["a", "b", "c"]);
  });

  it("zet een regel hoger en lager, en laat de grenzen met rust", () => {
    const t = "500 g bloem\n2 eieren\nsnufje zout";
    expect(verplaatsRegel(t, 1, -1)).toBe("2 eieren\n500 g bloem\nsnufje zout");
    expect(verplaatsRegel(t, 1, 1)).toBe("500 g bloem\nsnufje zout\n2 eieren");
    expect(verplaatsRegel(t, 0, -1)).toBe(t);
    expect(verplaatsRegel(t, 2, 1)).toBe(t);
  });

  it("houdt de tekst van elke regel letterlijk, ook nummers", () => {
    expect(verplaatsRegel("1. Snij\n\n2. Kook", 0, 1)).toBe("2. Kook\n1. Snij");
  });

  it("kanVerplaatsen kent de randen", () => {
    expect(kanVerplaatsen(3, 0, -1)).toBe(false);
    expect(kanVerplaatsen(3, 0, 1)).toBe(true);
    expect(kanVerplaatsen(3, 2, 1)).toBe(false);
    expect(kanVerplaatsen(1, 0, 1)).toBe(false);
  });

  it("verplaats wijzigt de invoer niet", () => {
    const l = ["a", "b"];
    expect(verplaats(l, 0, 1)).toEqual(["b", "a"]);
    expect(l).toEqual(["a", "b"]);
  });

  it("koppelingen per stap wisselen mee", () => {
    expect(wisselSleutels({ "0": ["ui"], "1": ["bloem"], "2": ["zout"] }, 0, 1)).toEqual({
      "0": ["bloem"],
      "1": ["ui"],
      "2": ["zout"],
    });
    expect(wisselSleutels({ "1": ["bloem"] }, 1, 2)).toEqual({ "2": ["bloem"] });
    expect(wisselSleutels({}, 0, 1)).toEqual({});
  });
});
