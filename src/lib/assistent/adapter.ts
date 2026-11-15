/**
 * Kookassistent — adapters. Drie bronnen, altijd dezelfde vorm:
 *
 * - `regels`: de vaste tabel en vaste antwoorden (op het toestel, gratis, werkt altijd);
 * - `test`: TestAssistentAdapter, deterministische antwoorden voor demo en tests. In de app staat
 *   er "Testmodus" bij: dit is geen echte AI;
 * - `ai`: de echte AI via de bestaande AI-infrastructuur (server, `voorAI()`, credits). Alleen als
 *   er een sleutel is; anders valt alles terug op de regels.
 *
 * Wat van de AI of de testadapter komt, gaat op het toestel nog eens door `toetsVervangers`:
 * een voorgestelde vervanger met een allergeen of buiten het dieet wordt nooit getoond.
 */
import { allergenenVan, type Vervanger } from "./vervangingen";
import { GEEN_ANTWOORD, regelAntwoord } from "./vragen";

export type AssistentBron = "regels" | "test" | "ai";

export type HulpVraag =
  | { soort: "vervang"; ingredient: string; recept?: string }
  | { soort: "vraag"; vraag: string; recept?: string };

export type HulpAntwoord = {
  bron: AssistentBron;
  vervangers?: { naam: string; reden: string }[];
  antwoord?: string;
  /** Waarom er (nog) geen AI-antwoord is, in gewone taal. */
  melding?: string;
};

export interface AssistentAdapter {
  readonly bron: AssistentBron;
  vraag(v: HulpVraag): Promise<HulpAntwoord>;
}

/** Vaste antwoorden: altijd beschikbaar. Vervangers komen rechtstreeks uit de tabel (elders). */
export class RegelAdapter implements AssistentAdapter {
  readonly bron = "regels" as const;
  async vraag(v: HulpVraag): Promise<HulpAntwoord> {
    if (v.soort === "vraag")
      return { bron: "regels", antwoord: regelAntwoord(v.vraag) ?? GEEN_ANTWOORD };
    return { bron: "regels", vervangers: [] };
  }
}

/**
 * Deterministisch: zelfde vraag, zelfde antwoord. Bevat bewust één vervanger met noten
 * ("Cashewroom"), zodat in demo en tests te zien is dat de veiligheidsfilter die tegenhoudt.
 */
export class TestAssistentAdapter implements AssistentAdapter {
  readonly bron = "test" as const;
  async vraag(v: HulpVraag): Promise<HulpAntwoord> {
    if (v.soort === "vraag") {
      const vast = regelAntwoord(v.vraag);
      return {
        bron: "test",
        antwoord: vast
          ? `${vast} (testantwoord)`
          : "Testantwoord: in de testmodus geeft Foodlo een vast voorbeeld. Met de echte slimme hulp krijg je hier een kort antwoord op je vraag.",
      };
    }
    return {
      bron: "test",
      vervangers: [
        { naam: "Cashewroom", reden: "Romig en plantaardig (testantwoord)" },
        { naam: "Kokosroom", reden: "Romig, lichte kokossmaak (testantwoord)" },
        { naam: "Zijdetofu", reden: "Glad en eiwitrijk (testantwoord)" },
      ],
    };
  }
}

/** Is dit de demo of een test (nep-databank)? Alleen dan antwoordt de testadapter. */
export function isDemoOmgeving(env: Record<string, string | undefined>): boolean {
  const project = env["VITE_SUPABASE_PROJECT_ID"] ?? "";
  const url = env["SUPABASE_URL"] ?? env["VITE_SUPABASE_URL"] ?? "";
  return (
    ["demo", "e2e-nep"].includes(project) || /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)
  );
}

/** Antwoord van AI of test omzetten naar vervangers die door de veiligheidstoets kunnen. */
export function naarVervangers(lijst: readonly { naam: string; reden: string }[]): Vervanger[] {
  return lijst
    .map((x) => ({ naam: x.naam.trim().slice(0, 60), reden: x.reden.trim().slice(0, 140) }))
    .filter((x) => x.naam.length >= 2)
    .slice(0, 6)
    .map((x) => ({
      naam: x.naam,
      reden: x.reden,
      verhouding: "kijk de hoeveelheid zelf na",
      // De herkenning beslist; de AI kan zelf niets "veilig" verklaren.
      allergenen: allergenenVan(x.naam) as Vervanger["allergenen"],
      dierlijk: null,
    }));
}

/** Labels voor in het paneel. */
export const BRON_LABEL: Record<AssistentBron, string> = {
  regels: "Vaste Foodlo-tips (zonder AI)",
  test: "Testmodus: vaste voorbeeldantwoorden, geen echte AI",
  ai: "Slimme hulp (AI), nagekeken op allergieën en dieet",
};
