/**
 * Bescherming tegen geheugenuitputting (vgl. CVE-2023-54404 / GHSA-mrhx-c7xc-m3w5):
 * elke array in een serverschema heeft een maximumlengte, zodat een enorme
 * invoer meteen geweigerd wordt i.p.v. per element fouten op te stapelen.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { wieSchema } from "./admin.functions";
import { meldingVoorkeurenSchema } from "./meldingen-schema";
import { begrensdeLijst } from "./zod-hulp";

const LIB = path.resolve(import.meta.dirname);

describe("arrays in serverschema's zijn begrensd", () => {
  it("geen kale z.array(...) in serverschema's: altijd begrensdeLijst()", () => {
    // Ook met .max() valideert zod elk element van een te lange lijst.
    const kaal: string[] = [];
    for (const f of readdirSync(LIB).filter((n) => /(\.functions|-schema)\.ts$/.test(n))) {
      readFileSync(path.join(LIB, f), "utf8")
        .split("\n")
        .forEach((regel, i) => {
          if (regel.includes("z.array(")) kaal.push(`${f}:${i + 1}`);
        });
    }
    expect(kaal).toEqual([]);
  });

  it("een enorme lijst wordt meteen geweigerd, zonder per element fouten te verzamelen", () => {
    const enorm = Array.from({ length: 100_000 }, () => "geen-uuid");
    const r = wieSchema.safeParse({ wieModus: "in", wieIds: enorm });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.length).toBeLessThan(10);
  });

  it("een normale selectie blijft werken", () => {
    const r = wieSchema.parse({ wieModus: "in", wieIds: ["11111111-1111-4111-8111-111111111111"] });
    expect(r.wieIds).toHaveLength(1);
  });
  it("geldt ook voor kleine grenzen (meldingsmomenten, max 8)", () => {
    const r = meldingVoorkeurenSchema.safeParse({ daily_menu_moments: Array(100_000).fill("<x>") });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.length).toBeLessThan(10);
  });

  it("minimum, geen lijst, en geldige invoer", () => {
    const s = begrensdeLijst(z.string().uuid(), 6, 2);
    expect(s.safeParse(["11111111-1111-4111-8111-111111111111"]).success).toBe(false);
    expect(s.safeParse("geen lijst").success).toBe(false);
    expect(s.safeParse({ length: 3 }).success).toBe(false);
    expect(
      s.parse(["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"]),
    ).toHaveLength(2);
  });
});
