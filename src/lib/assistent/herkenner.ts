/**
 * P4 — Wie herkent de opdracht? Eerst altijd de vaste regels (opdrachten.ts, gratis, op het
 * toestel). Alleen wat de regels niet herkennen, mag naar een terugval:
 *
 * - `test`: TestHerkenner, vaste voorbeelden voor demo en tests ("Testmodus, geen echte AI");
 * - `ai`: een echte AI-dienst. Er is er nu geen aangesloten: zonder sleutel bestaat deze bron
 *   niet en werkt alles op regels.
 *
 * Een terugval herkent alleen. Hij voert nooit iets uit: zijn uitkomst wordt een gewone opdracht
 * die door hetzelfde voorstel, dezelfde veiligheid en dezelfde bevestiging gaat. Wat naar een AI
 * zou gaan, gaat eerst door `bereidVoorAI` (geen allergieën, dieet of namen). Elke slimme vraag
 * telt mee voor de daglimiet (gebruik.ts).
 */
import { voorAI } from "@/lib/ai/privacy";
import { normaliseerTekst } from "@/lib/zoeken";
import { herkenOpdracht, VOORBEELDEN, type Herkenning, type HerkenContext } from "./opdrachten";

export type HerkenBron = "regels" | "test" | "ai";

export interface OpdrachtHerkenner {
  readonly bron: Exclude<HerkenBron, "regels">;
  /** Krijgt alleen de opgeschoonde zin (bereidVoorAI), nooit gezondheids- of gezinsgegevens. */
  herken(opgeschoond: string, ctx: Pick<HerkenContext, "vandaag">): Promise<Herkenning>;
}

/**
 * Wat een AI te zien zou krijgen: alleen neutrale delen van de zin (voorAI laat allergie, dieet
 * en gezondheid weg) en geen namen van gezinsleden.
 */
export function bereidVoorAI(zin: string, namen: readonly string[]): string {
  let tekst = voorAI(zin).tekst;
  for (const naam of namen) {
    const n = naam.trim();
    if (n.length < 2) continue;
    tekst = tekst.replace(
      new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
      "iemand",
    );
  }
  return tekst.slice(0, 200);
}

/** Vaste voorbeelden voor de demo: zo is te zien hoe een terugval werkt, zonder echte AI. */
export class TestHerkenner implements OpdrachtHerkenner {
  readonly bron = "test" as const;
  async herken(opgeschoond: string, ctx: Pick<HerkenContext, "vandaag">): Promise<Herkenning> {
    const t = normaliseerTekst(opgeschoond);
    if (/\bverras\b|\biets lekkers\b|\bwat eten we\b/.test(t))
      return { ok: true, opdracht: { soort: "vervang", datum: ctx.vandaag } };
    return { ok: false, reden: "Ook de testmodus herkent dit niet.", voorbeelden: VOORBEELDEN };
  }
}

export type HerkenUitkomst = { herkenning: Herkenning; bron: HerkenBron; teldMee: boolean };

/**
 * Regels eerst; daarna (als er een terugval is en de daglimiet het toelaat) de terugval.
 * Een uitkomst van de terugval met een naam die niet in het gezin zit, telt niet.
 */
export async function herken(
  zin: string,
  ctx: HerkenContext,
  opties: { terugval?: OpdrachtHerkenner | null | undefined; resterend: number },
): Promise<HerkenUitkomst> {
  const regels = herkenOpdracht(zin, ctx);
  if (regels.ok || !opties.terugval) return { herkenning: regels, bron: "regels", teldMee: false };
  if (opties.resterend <= 0)
    return {
      herkenning: {
        ok: false,
        reden: `${regels.reden} De slimme hulp is voor vandaag op; de vaste vragen werken wel.`,
        voorbeelden: regels.voorbeelden,
      },
      bron: "regels",
      teldMee: false,
    };
  try {
    const h = await opties.terugval.herken(bereidVoorAI(zin, ctx.namen ?? []), ctx);
    if (h.ok && h.opdracht.soort === "eter" && !(ctx.namen ?? []).includes(h.opdracht.naam))
      return { herkenning: regels, bron: "regels", teldMee: true };
    return {
      herkenning: h.ok ? h : regels,
      bron: h.ok ? opties.terugval.bron : "regels",
      teldMee: true,
    };
  } catch {
    return { herkenning: regels, bron: "regels", teldMee: false };
  }
}
