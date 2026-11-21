import { describe, expect, it } from "vitest";

describe("standaardPersonen (ronde 3)", () => {
  it("volgt de gezinsgrootte uit de kennismaking, anders 4", async () => {
    const { standaardPersonen } = await import("./kennismaking");
    expect(standaardPersonen({ gezin: "1" })).toBe(1);
    expect(standaardPersonen({ gezin: "2" })).toBe(2);
    expect(standaardPersonen({ gezin: "3-4" })).toBe(4);
    expect(standaardPersonen({ gezin: "5+" })).toBe(5);
    expect(standaardPersonen({})).toBe(4);
  });
});
