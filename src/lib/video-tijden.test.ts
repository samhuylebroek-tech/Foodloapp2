import { describe, expect, it } from "vitest";
import { tijdcodeUit } from "./video-link";
import {
  leesTijdInvoer,
  splitsStap,
  stappenMetTijden,
  tijdLabel,
  zetTijdcode,
} from "./video-tijden";

describe("leesTijdInvoer", () => {
  it("leest gewone schrijfwijzen", () => {
    expect(leesTijdInvoer("0:45")).toEqual({ label: "0:45", seconden: 45 });
    expect(leesTijdInvoer("45")).toEqual({ label: "0:45", seconden: 45 });
    expect(leesTijdInvoer("90")).toEqual({ label: "1:30", seconden: 90 });
    expect(leesTijdInvoer(" 1.30 ")).toEqual({ label: "1:30", seconden: 90 });
    expect(leesTijdInvoer("1,05")).toEqual({ label: "1:05", seconden: 65 });
    expect(leesTijdInvoer("1:02:03")).toEqual({ label: "1:02:03", seconden: 3723 });
    expect(leesTijdInvoer("12:00")).toEqual({ label: "12:00", seconden: 720 });
  });
  it("leeg = geen tijd; onzin = uitleg", () => {
    expect(leesTijdInvoer("")).toBeNull();
    expect(leesTijdInvoer("   ")).toBeNull();
    expect(leesTijdInvoer("1:75")).toHaveProperty("fout");
    expect(leesTijdInvoer("abc")).toHaveProperty("fout");
    expect(leesTijdInvoer("-3")).toHaveProperty("fout");
    expect(leesTijdInvoer("11:00:00")).toHaveProperty("fout");
  });
});

describe("tijdLabel", () => {
  it("formaat zoals op YouTube", () => {
    expect(tijdLabel(0)).toBe("0:00");
    expect(tijdLabel(65)).toBe("1:05");
    expect(tijdLabel(3723)).toBe("1:02:03");
  });
});

describe("zetTijdcode en splitsStap", () => {
  it("zet vooraan, vervangt een oude tijd en kan ze weghalen", () => {
    expect(zetTijdcode("Bak de ui.", "0:45")).toBe("0:45 Bak de ui.");
    expect(zetTijdcode("0:45 Bak de ui.", "1:10")).toBe("1:10 Bak de ui.");
    expect(zetTijdcode("[0:45] – Bak de ui.", null)).toBe("Bak de ui.");
    expect(zetTijdcode("Roer de saus (2:30)", "2:30")).toBe("2:30 Roer de saus");
  });
  it("een kloktijd in de tekst blijft staan", () => {
    expect(splitsStap("Zet om 12:30 aan tafel.")).toEqual({
      tijd: "",
      tekst: "Zet om 12:30 aan tafel.",
    });
  });
  it("de receptpagina leest de bewaarde tijd terug", () => {
    expect(tijdcodeUit(zetTijdcode("Stoof de prei.", "1:05"))).toEqual({
      seconden: 65,
      label: "1:05",
      tekst: "Stoof de prei.",
    });
  });
});

describe("stappenMetTijden", () => {
  it("werkt alle stappen bij zonder de tekst te veranderen", () => {
    expect(stappenMetTijden(["Kook.", "0:20 Stamp."], ["0:05", ""])).toEqual({
      stappen: ["0:05 Kook.", "Stamp."],
    });
  });
  it("noemt de stap met de fout", () => {
    expect(stappenMetTijden(["Kook.", "Stamp."], ["0:05", "9:99"])).toEqual({
      fout: "Stap 2: Schrijf de tijd zoals 0:45 of 1:30.",
      stap: 1,
    });
  });
});
