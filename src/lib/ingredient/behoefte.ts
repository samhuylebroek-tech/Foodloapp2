/**
 * Behoefte − voorraad = te kopen, als drie getallen per lijstregel.
 *
 * - "nodig": uit de geplande porties (geschaald naar het aantal eters);
 * - "in huis": alleen wat je echt registreerde in je voorraad, of je basisvoorraad
 *   ("heb je meestal"). Onbekende voorraad is nooit "in huis";
 * - "te kopen": het verschil (stuks naar boven afgerond).
 * Plus een gangbare verpakking voor wat je moet kopen.
 */
import { toonBelgischeMaat } from "@/lib/ingredienten";
import { voorgesteldeVerpakking, type Verpakking } from "./verpakking";

export type DrieGetallen = {
  nodig: string | null;
  inHuis: string | null;
  teKopen: string | null;
  verpakking: Verpakking | null;
};

function maat(q: number | null | undefined, unit: string): string | null {
  if (q == null) return null;
  const t = toonBelgischeMaat(q, unit);
  if (!unit.trim()) return `${String(q).replace(".", ",")} ${q === 1 ? "stuk" : "stuks"}`;
  return t || null;
}

export function drieGetallen(r: {
  naam: string;
  nodig: number | null;
  quantity: number | null;
  unit: string;
  inHuisHoeveelheid?: number | null;
}): DrieGetallen {
  const teKopen = r.quantity ?? r.nodig;
  return {
    nodig: maat(r.nodig, r.unit),
    inHuis: r.inHuisHoeveelheid ? maat(r.inHuisHoeveelheid, r.unit) : null,
    teKopen: maat(teKopen, r.unit),
    verpakking: teKopen == null ? null : voorgesteldeVerpakking(r.naam, teKopen, r.unit),
  };
}

/** Eén rustige regel: "nodig 1 kg · in huis 1 stuk · te kopen 0" → enkel wat iets zegt. */
export function korteBehoefte(d: DrieGetallen): string {
  return [
    d.nodig ? `nodig ${d.nodig}` : "",
    d.inHuis ? `in huis ${d.inHuis}` : "",
    d.teKopen && d.teKopen !== d.nodig ? `te kopen ${d.teKopen}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
