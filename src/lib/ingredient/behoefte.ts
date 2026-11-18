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
import {
  waaromNodig,
  type PlanMaaltijd,
  type ReceptIngredient,
  type ReceptKort,
  type VoorraadRij,
} from "@/lib/kringloop";
import { rekenOm } from "./eenheden";
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

/**
 * Per Foodlo-regel op de lijst: hoeveel de geplande gerechten nodig hebben en hoeveel er
 * geregistreerd in huis is (omgerekend naar de eenheid van "nodig"). Eigen regels (zonder
 * recept) en regels zonder gepland gerecht krijgen niets: daar valt niets uit te rekenen.
 */
export function lijstBehoefte(opts: {
  items: readonly {
    id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    checked: boolean;
    recipe_id?: string | null;
  }[];
  plan: PlanMaaltijd[];
  recepten: ReceptKort[];
  ingredienten: ReceptIngredient[];
  voorraad: VoorraadRij[];
  vanaf: string;
}): Map<string, DrieGetallen> {
  const uit = new Map<string, DrieGetallen>();
  for (const item of opts.items) {
    if (item.checked) continue;
    const unit = item.unit ?? "";
    const pak = item.quantity == null ? null : voorgesteldeVerpakking(item.name, item.quantity, unit);
    if (!item.recipe_id) {
      if (pak) uit.set(item.id, { nodig: null, inHuis: null, teKopen: null, verpakking: pak });
      continue;
    }
    const w = waaromNodig({
      naam: item.name,
      regelId: item.id,
      plan: opts.plan,
      recepten: opts.recepten,
      ingredienten: opts.ingredienten,
      voorraad: opts.voorraad,
      lijst: [],
      vanaf: opts.vanaf,
    });
    const nodigUnit = w.nodig?.unit ?? unit;
    let inHuis: number | null = 0;
    for (const v of w.inHuis) {
      const om = v.quantity == null ? null : rekenOm(v.quantity, v.unit, nodigUnit, item.name);
      inHuis = om == null || inHuis == null ? null : inHuis + om;
    }
    uit.set(item.id, {
      nodig: w.nodig ? maat(w.nodig.quantity, nodigUnit) : null,
      inHuis: inHuis ? maat(Math.round(inHuis * 100) / 100, nodigUnit) : null,
      teKopen: maat(item.quantity, unit),
      verpakking: pak,
    });
  }
  return uit;
}
