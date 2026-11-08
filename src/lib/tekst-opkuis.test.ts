import { describe, expect, it } from "vitest";
import { netteStap } from "./tekst-opkuis";

describe("netteStap", () => {
  it.each([
    ["Laat 2,5 uur stoven", "Laat 2,5 uur stoven."],
    ["Zet de timer om 18:30", "Zet de timer om 18:30."],
    ["Voeg 0,5 l melk toe", "Voeg 0,5 l melk toe."],
    ["Meng bloem,suiker en eieren", "Meng bloem, suiker en eieren."],
    ["Nodig:bloem", "Nodig: bloem."],
    ["stap 1: snij de ui", "Snij de ui."],
    ["  roer  goed ,  proef", "Roer goed, proef."],
    ["Kook 10 min.Giet af", "Kook 10 min. Giet af."],
  ])("%s → %s", (in_, uit) => {
    expect(netteStap(in_)).toBe(uit);
  });
});
