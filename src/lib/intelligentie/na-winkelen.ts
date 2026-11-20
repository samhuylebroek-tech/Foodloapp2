/**
 * Fase 3: wat gebeurt er met je aankopen bij "Klaar met winkelen"?
 * - "altijd": in de voorraad, met één keer ongedaan maken (zoals voordien, standaard);
 * - "vragen": Foodlo toont wat je kocht, met vinkjes, en zet alleen het aangevinkte erin;
 * - "nooit": de lijst wordt opgeruimd, de voorraad blijft zoals ze is.
 * Een keuze op dit toestel (zoals "voorraad bijhouden").
 */
import { useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isBasis } from "@/lib/voorraad-match";

export type NaWinkelen = "altijd" | "vragen" | "nooit";
export const NA_WINKELEN_LABEL: Record<NaWinkelen, string> = {
  altijd: "Altijd in de voorraad zetten",
  vragen: "Eerst vragen, met vinkjes",
  nooit: "Niet in de voorraad zetten",
};
const sleutel = (userId: string) => `foodlo:na-winkelen:${userId}`;
const GEWIJZIGD = "foodlo:na-winkelen";

export function naWinkelen(userId: string | null | undefined): NaWinkelen {
  if (!userId) return "altijd";
  try {
    const w = window.localStorage.getItem(sleutel(userId));
    return w === "vragen" || w === "nooit" ? w : "altijd";
  } catch {
    return "altijd";
  }
}

export function zetNaWinkelen(userId: string, keuze: NaWinkelen) {
  try {
    window.localStorage.setItem(sleutel(userId), keuze);
  } catch {
    // Opslag geblokkeerd.
  }
  try {
    window.dispatchEvent(new Event(GEWIJZIGD));
  } catch {
    // Geen browser.
  }
}

function abonneer(melding: () => void) {
  window.addEventListener(GEWIJZIGD, melding);
  window.addEventListener("storage", melding);
  return () => {
    window.removeEventListener(GEWIJZIGD, melding);
    window.removeEventListener("storage", melding);
  };
}

export function useNaWinkelen(): [NaWinkelen, (k: NaWinkelen) => void] {
  const { user } = useAuth();
  const id = user?.id ?? null;
  const keuze = useSyncExternalStore(
    abonneer,
    () => naWinkelen(id),
    () => "altijd" as NaWinkelen,
  );
  return [keuze, (k: NaWinkelen) => id && zetNaWinkelen(id, k)];
}

/**
 * Wat Foodlo bij "vragen" toont: basisproducten (zout, olie …) niet, want die staan nooit in de
 * voorraad. Standaard aangevinkt.
 */
export function voorraadKeuzes<T extends { id: string; name: string }>(gekocht: readonly T[]): T[] {
  return gekocht.filter((g) => g.name.trim() && !isBasis(g.name));
}

/** Welke ids naar de voorraad gaan, volgens de keuze (undefined = alles). */
export function idsNaarVoorraad(
  keuze: NaWinkelen,
  aangevinkt?: ReadonlySet<string>,
): ReadonlySet<string> | undefined {
  if (keuze === "nooit") return new Set();
  if (keuze === "vragen") return aangevinkt ?? new Set();
  return undefined;
}
