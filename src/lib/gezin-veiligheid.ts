/**
 * Veiligheid voor mee-eters (gezinsleden, ook kinderen zonder account).
 *
 * - Dezelfde regels als voor jezelf (`allergieOordeel`, `pastBijDieet` uit veiligheid.ts).
 * - Wie plant, ziet alleen **of** een gerecht veilig is voor een lid, niet **waarom**, tenzij het
 *   lid "delen met mijn gezin" aanzette, of jij het lid zelf bent of het voor hem/haar beheert.
 * - Zonder gegevens van een lid (niet leesbaar door de databankregels) geldt het oordeel van de
 *   server (`maaltijd_veilig_voor`, voorstel 0010): alleen waar/onwaar.
 *
 * Alles hier draait op het toestel en gaat nooit naar een AI.
 */
import { allergieOordeel, pastBijDieet, type Gerecht } from "@/lib/veiligheid";
import {
  teVermijdenAllergenen,
  voedingSamenvatting,
  type Voeding,
} from "@/lib/persoonlijke-voeding";
import { ALLERGENEN } from "@/lib/allergenen";
import { normaliseerTekst } from "@/lib/zoeken";

export type HuishoudenRol = "volwassene" | "kind";

export type HuishoudenLid = {
  id: string;
  group_id: string;
  naam: string;
  /** Gekoppeld account, of null (bv. een kind). */
  user_id: string | null;
  rol: HuishoudenRol;
  /** Wie de voorkeuren van dit lid beheert (ouder voor een kind; anders het lid zelf). */
  beheerder_id: string | null;
};

export type LidVoeding = Voeding & {
  lid_id: string;
  delen_met_gezin: boolean;
  toestemming_door: string;
  toestemming_soort: "zelf" | "beheerder";
  toestemming_op: string;
};

/** Mag deze kijker de reden (welke allergie, welk dieet) van dit lid zien? */
export function magRedenZien(
  lid: Pick<HuishoudenLid, "user_id" | "beheerder_id">,
  voeding: Pick<LidVoeding, "delen_met_gezin"> | null | undefined,
  kijkerId: string | null | undefined,
): boolean {
  if (!kijkerId) return false;
  if (lid.user_id === kijkerId || lid.beheerder_id === kijkerId) return true;
  return voeding?.delen_met_gezin === true;
}

/** Mag deze kijker de voorkeuren van dit lid aanpassen? Alleen het lid zelf of de beheerder. */
export function magVoorkeurenBeheren(
  lid: Pick<HuishoudenLid, "user_id" | "beheerder_id">,
  kijkerId: string | null | undefined,
): boolean {
  if (!kijkerId) return false;
  if (lid.user_id) return lid.user_id === kijkerId;
  return lid.beheerder_id === kijkerId;
}

export type EterOordeel = {
  lidId: string;
  naam: string;
  /** true = veilig, false = niet veilig, null = niet te controleren (geen ingrediënten). */
  veilig: boolean | null;
  /** Alleen ingevuld als de kijker de reden mag zien. */
  reden?: string;
};

/** Oordeel voor één lid uit zijn gegevens (als de kijker die mag lezen). */
export function oordeelVoorLid(
  g: Gerecht,
  voeding: Voeding,
): { veilig: boolean | null; reden?: string } {
  const allergenen = teVermijdenAllergenen(voeding);
  const a = allergieOordeel(g, allergenen);
  if (a.status === "allergeen") {
    return {
      veilig: false,
      reden: `bevat mogelijk ${a.treffers.map((t) => t.naam.toLowerCase()).join(", ")}`,
    };
  }
  if (!pastBijDieet(g, voeding.dieet)) {
    return { veilig: false, reden: `past niet bij ${voeding.dieet ?? "het dieet"}` };
  }
  const tekst = normaliseerTekst([g.title, ...g.ingredienten].join(" "));
  const term = voeding.uitsluitingen.find((t) => {
    const n = normaliseerTekst(t);
    return n.length >= 3 && tekst.includes(n);
  });
  if (term) return { veilig: false, reden: `liever geen ${term}` };
  if (a.status === "onbekend") return { veilig: null };
  return { veilig: true };
}

/**
 * Oordeel per mee-eter. `voeding` bevat alleen wat de kijker mag lezen; `server` is het
 * oordeel van `maaltijd_veilig_voor` voor de anderen (alleen waar/onwaar).
 */
export function oordeelVoorEters(
  g: Gerecht,
  eters: readonly HuishoudenLid[],
  voeding: ReadonlyMap<string, LidVoeding>,
  kijkerId: string | null | undefined,
  server: ReadonlyMap<string, boolean> = new Map(),
): EterOordeel[] {
  return eters.map((lid) => {
    const v = voeding.get(lid.id);
    if (v) {
      const o = oordeelVoorLid(g, v);
      const zien = magRedenZien(lid, v, kijkerId);
      return {
        lidId: lid.id,
        naam: lid.naam,
        veilig: o.veilig,
        ...(zien && o.reden ? { reden: o.reden } : {}),
      };
    }
    const s = server.get(lid.id);
    return { lidId: lid.id, naam: lid.naam, veilig: s === undefined ? true : s };
  });
}

/** "Niet veilig voor Lotte" / "Niet veilig voor Lotte en Gust". */
export function waarschuwingTekst(oordelen: readonly EterOordeel[]): string | null {
  const niet = oordelen.filter((o) => o.veilig === false).map((o) => o.naam);
  if (!niet.length) return null;
  const namen =
    niet.length === 1 ? niet[0] : `${niet.slice(0, -1).join(", ")} en ${niet[niet.length - 1]}`;
  return `Niet veilig voor ${namen}`;
}

/** Aantal personen = mee-eters + gasten, minstens 1. */
export function personenVoor(aantalEters: number, gasten: number): number {
  return Math.max(1, Math.min(50, Math.max(0, aantalEters) + Math.max(0, gasten)));
}

/** Kleine initialen voor de weekkaart ("Lotte" → "L", "Jan Peeters" → "JP"). */
export function initialen(naam: string): string {
  const delen = naam.trim().split(/\s+/).filter(Boolean);
  if (!delen.length) return "?";
  if (delen.length === 1) return delen[0]!.slice(0, 1).toUpperCase();
  return (delen[0]!.slice(0, 1) + delen[delen.length - 1]!.slice(0, 1)).toUpperCase();
}

/** Voor zichtbaarheid in de lidkaart: wat mag deze kijker over dit lid lezen? */
export function lidSamenvatting(
  lid: HuishoudenLid,
  voeding: LidVoeding | null | undefined,
  kijkerId: string | null | undefined,
): string {
  if (!voeding) return "Nog geen voorkeuren";
  if (!magRedenZien(lid, voeding, kijkerId)) return "Voorkeuren ingevuld (niet gedeeld)";
  return voedingSamenvatting(voeding) || "Geen allergieën of dieet";
}

/** Alle allergeencodes die Foodlo kent (voor validatie in tests en de nepdatabank). */
export const ALLERGEEN_CODES = ALLERGENEN.map((a) => a.id);
