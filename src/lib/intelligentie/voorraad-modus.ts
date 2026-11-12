/**
 * Voorraadbeheer is optioneel (productbeslissing 2026-11-12). Drie situaties:
 * 1. Geen voorraad: voorstellen uit recepten, voorkeuren, geschiedenis, dag, seizoen, dieet.
 * 2. Wel boodschappen, geen voorraad bijgehouden: "Klaar met winkelen" zet aankopen in de
 *    voorraad, maar Foodlo veronderstelt níét dat ze er nog zijn. Alleen een recente aankoop
 *    (hooguit 3 dagen) mag als reden "Je kocht onlangs …", nooit als "in huis".
 * 3. Voorraad bijgehouden: alles telt, ook "Gebruik eerst".
 *
 * "Bijhouden" is een keuze op dit toestel. Ze gaat vanzelf aan zodra je zelf iets in je voorraad
 * zet of aanpast (je houdt ze dan bij), en je kan ze altijd uitzetten. Onbekend = niet bijgehouden.
 */
import { useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { gebruikEerst, type OudInHuis, type VoorraadDatum } from "./gebruik-eerst";

const sleutel = (userId: string) => `foodlo:voorraad-bijhouden:${userId}`;
const GEWIJZIGD = "foodlo:voorraad-modus";
const DAG = 86400000;
/** Zo lang telt een aankoop als "onlangs gekocht" wanneer je je voorraad niet bijhoudt. */
export const ONLANGS_DAGEN = 3;

export type Modus = "bijhouden" | "niet" | "onbekend";

export function voorraadModus(userId: string | null | undefined): Modus {
  if (!userId) return "onbekend";
  try {
    const w = window.localStorage.getItem(sleutel(userId));
    return w === "aan" ? "bijhouden" : w === "uit" ? "niet" : "onbekend";
  } catch {
    return "onbekend";
  }
}

export function zetVoorraadBijhouden(userId: string, aan: boolean) {
  try {
    window.localStorage.setItem(sleutel(userId), aan ? "aan" : "uit");
  } catch {
    // Opslag geblokkeerd: dan geldt de keuze tot je de pagina sluit.
  }
  try {
    window.dispatchEvent(new Event(GEWIJZIGD));
  } catch {
    // Geen browser (tests).
  }
}

/** Je zette of paste zelf iets in je voorraad: dan hou je ze bij (tenzij je dat uitzette). */
export function merkVoorraadGebruik(userId: string) {
  if (voorraadModus(userId) === "onbekend") zetVoorraadBijhouden(userId, true);
}

function abonneer(melding: () => void) {
  window.addEventListener(GEWIJZIGD, melding);
  window.addEventListener("storage", melding);
  return () => {
    window.removeEventListener(GEWIJZIGD, melding);
    window.removeEventListener("storage", melding);
  };
}

/** [bijhouden?, zet] voor de aangemelde gebruiker. */
export function useVoorraadBijhouden(): [boolean, (aan: boolean) => void] {
  const { user } = useAuth();
  const id = user?.id ?? null;
  const modus = useSyncExternalStore(
    abonneer,
    () => voorraadModus(id),
    () => "onbekend" as Modus,
  );
  return [modus === "bijhouden", (aan: boolean) => id && zetVoorraadBijhouden(id, aan)];
}

export type BruikbareVoorraad = {
  /** Telt als "in huis" (alleen als je je voorraad bijhoudt). */
  inHuis: string[];
  /** Recent gekocht, maar niet verondersteld aanwezig (situatie 2). */
  onlangsGekocht: string[];
  /** "Gebruik eerst" (alleen als je je voorraad bijhoudt). */
  oudInHuis: OudInHuis[];
};

export function bruikbareVoorraad(
  items: readonly VoorraadDatum[],
  bijgehouden: boolean,
  nu = Date.now(),
): BruikbareVoorraad {
  if (bijgehouden)
    return {
      inHuis: items.map((v) => v.naam),
      onlangsGekocht: [],
      oudInHuis: gebruikEerst(items, nu),
    };
  const onlangs = items
    .filter((v) => {
      const t = Date.parse(v.updated_at ?? v.created_at ?? "");
      return Number.isFinite(t) && nu - t >= 0 && nu - t <= ONLANGS_DAGEN * DAG;
    })
    .map((v) => v.naam);
  return { inHuis: [], onlangsGekocht: onlangs, oudInHuis: [] };
}
