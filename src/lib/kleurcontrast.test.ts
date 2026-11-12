import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrast, leesTokens, parseOklch, type Rgb } from "./kleurcontrast";

const css = readFileSync(path.resolve(import.meta.dirname, "../styles.css"), "utf8");

describe("kleurcontrast-hulpfuncties", () => {
  it("wit op zwart is 21:1", () => {
    expect(contrast([1, 1, 1], [0, 0, 0])).toBeCloseTo(21, 1);
  });
  it("oklch(1 0 0) is wit en oklch(0 0 0) is zwart", () => {
    expect(contrast(parseOklch("oklch(1 0 0)")!, parseOklch("oklch(0 0 0)")!)).toBeCloseTo(21, 0);
  });
  it("leest tokens uit :root", () => {
    expect(leesTokens(css, ":root")["background"]).toMatch(/^oklch/);
  });
});

/** Tekst moet minstens 4.5:1 halen (WCAG 1.4.3 AA). */
const TEKST_PAREN: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "card"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  // Zoals echt gebruikt: datumchip (index.tsx) en "vandaag" (planner.tsx).
  ["honing-foreground", "honing-zacht"],
  ["honing-foreground", "background"],
  ["primary", "background"], // primaire kleur als linktekst
  ["primary", "card"],
  ["destructive", "background"], // foutmeldingen in rode tekst
  ["destructive", "card"],
  ["terracotta-foreground", "terracotta"], // V2-accent
  ["inkt-foreground", "inkt"], // V2 redactionele band en actieve navigatie
  ["inkt-zacht", "inkt"], // ondertitels in de inktband
  ["honing", "inkt"], // label "avondeten vandaag" in de inktband
  ["op-honing", "honing"], // tekst op een honingknop (BUG-130: was in donker 1,4:1)
];

/** Focusring moet minstens 3:1 halen tegen de achtergrond (WCAG 1.4.11 / 2.4.13). */
const UI_PAREN: [string, string][] = [
  ["ring", "background"],
  ["ring", "card"],
  ["honing-foreground", "card"], // rand van gekozen sterren (SterrenSnel)
  ["terracotta", "terracotta-zacht"], // icoon in snelkoppeling (V2)
  ["terracotta", "card"], // favorietenhartje op witte badge (V2)
];

// De extra thema's (instellingen) leggen hun tokens over het lichte basisthema.
for (const thema of [":root", ".dark", ".thema-warm", ".thema-fris", ".thema-contrast"] as const) {
  describe(`WCAG 2.2 AA contrast — thema ${thema}`, () => {
    const tokens = { ...leesTokens(css, ":root"), ...leesTokens(css, thema) };
    const kleur = (naam: string): Rgb => {
      const rgb = parseOklch(tokens[naam] ?? "");
      if (!rgb) throw new Error(`token --${naam} ontbreekt of is geen oklch`);
      return rgb;
    };

    it.each(TEKST_PAREN)("tekst --%s op --%s ≥ 4.5:1", (voor, achter) => {
      expect(contrast(kleur(voor), kleur(achter))).toBeGreaterThanOrEqual(4.5);
    });

    it.each(UI_PAREN)("UI --%s op --%s ≥ 3:1", (voor, achter) => {
      expect(contrast(kleur(voor), kleur(achter))).toBeGreaterThanOrEqual(3);
    });
  });
}
