/**
 * P4 — Een bevestigd voorstel uitvoeren ("Doe maar").
 *
 * - Menu: alle stappen samen via `planSamen` + `wijzigMenu` (de enige weg om menu en lijst te
 *   wijzigen): de lijst gaat mee, mislukt iets dan wordt alles teruggedraaid.
 * - Wie meeëet: eerst bewaard; mislukt het menu daarna, dan wordt dat ook teruggezet.
 * - "Zet de ingrediënten op de lijst" (geen menuwijziging): de lijst krijgt wat je niet in huis
 *   hebt, met dezelfde samenvoegregel als het recept (`voegToeAanLijst`), en kan terug.
 * - Eén "Ongedaan maken" voor het geheel; werkt maar één keer.
 */
import { supabase } from "@/integrations/supabase/client";
import { voegToeAanLijst, zorgVoorLijst } from "@/lib/boodschappen";
import {
  HalfGelukt,
  planErbij,
  planPersonen,
  planSamen,
  planVerplaats,
  planVervang,
  planWeg,
  wijzigMenu,
  type Herstel,
  type LijstEffect,
  type PlanUitvoering,
} from "@/lib/kringloop-db";
import { canoniekeNaam } from "@/lib/product-herkenning";
import { normaliseerTekst } from "@/lib/zoeken";
import type { Stap, Voorstel } from "./acties";

export type Uitvoering = { herstel: Herstel; effect: LijstEffect; lijstErbij: number };

type Regel = { name: string; quantity: number | null; unit: string };

export type UitvoerHulp = {
  userId: string;
  /** Wie eet mee bewaren (account of toestel); null = terug naar standaard. */
  bewaarEters: (planId: string, lidIds: readonly string[] | null) => Promise<void>;
  /** Hoeveelheden en porties van een recept (voor "op de lijst"). */
  receptVan: (recipeId: string) => { regels: readonly Regel[]; servings: number | null } | null;
};

function actieVoor(s: Stap, userId: string): (() => Promise<PlanUitvoering>) | null {
  switch (s.soort) {
    case "vervang":
      return planVervang(s.planId, s.recipeId);
    case "verplaats":
      return planVerplaats(s.planId, s.datum, s.moment);
    case "weg":
      return planWeg(s.planId);
    case "erbij":
      return planErbij({
        userId,
        recipeId: s.recipeId,
        datum: s.datum,
        moment: s.moment,
        personen: s.personen,
      });
    case "eters":
      return planPersonen(s.planId, s.personen);
    case "lijst":
      return null;
  }
}

async function draaiTerug(stappen: Herstel[]) {
  let mislukt = false;
  for (const s of [...stappen].reverse()) {
    try {
      await s();
    } catch {
      mislukt = true;
    }
  }
  if (mislukt) throw new HalfGelukt();
}

/** De ingrediënten van één recept op de lijst, met herstel (nieuwe regels weg, oude terug). */
async function zetOpLijst(
  hulp: UitvoerHulp,
  s: Extract<Stap, { soort: "lijst" }>,
  alleen: readonly string[],
): Promise<{ herstel: Herstel; aantal: number }> {
  const recept = hulp.receptVan(s.recipeId);
  if (!recept) throw new Error("Recept niet gevonden");
  const factor = recept.servings && recept.servings > 0 ? s.personen / recept.servings : 1;
  const sleutel = (n: string) => canoniekeNaam(n) || normaliseerTekst(n);
  const gewenst = new Set(alleen.map(sleutel));
  const items = recept.regels
    .filter((r) => gewenst.has(sleutel(r.name)))
    .map((r) => ({
      name: r.name,
      quantity: r.quantity === null ? null : Math.round(r.quantity * factor * 100) / 100,
      unit: r.unit,
      recipe_id: s.recipeId,
    }));
  if (!items.length) return { herstel: async () => undefined, aantal: 0 };
  const listId = await zorgVoorLijst(hulp.userId);
  const lees = async () => {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("id, quantity, unit, checked")
      .eq("list_id", listId);
    if (error) throw error;
    return (data ?? []) as {
      id: string;
      quantity: number | null;
      unit: string | null;
      checked: boolean | null;
    }[];
  };
  const voor = await lees();
  await voegToeAanLijst(hulp.userId, listId, items);
  const na = await lees();
  const oud = new Map(voor.map((r) => [r.id, r]));
  const nieuw = na.filter((r) => !oud.has(r.id)).map((r) => r.id);
  const gewijzigd = na.filter((r) => {
    const o = oud.get(r.id);
    return o && (o.quantity !== r.quantity || o.unit !== r.unit || o.checked !== r.checked);
  });
  return {
    aantal: nieuw.length + gewijzigd.length,
    herstel: async () => {
      if (nieuw.length) {
        const { error } = await supabase.from("shopping_items").delete().in("id", nieuw);
        if (error) throw error;
      }
      for (const r of gewijzigd) {
        const o = oud.get(r.id)!;
        const { error } = await supabase
          .from("shopping_items")
          .update({ quantity: o.quantity, unit: o.unit ?? "", checked: !!o.checked })
          .eq("id", r.id);
        if (error) throw error;
      }
    },
  };
}

/**
 * Voert het voorstel uit. Gooit bij een fout (alles is dan teruggedraaid, of `HalfGelukt` als
 * terugdraaien niet helemaal lukte).
 */
export async function voerVoorstelUit(v: Voorstel, hulp: UitvoerHulp): Promise<Uitvoering> {
  const gedaan: Herstel[] = [];
  let effect: LijstEffect = { erbij: 0, minder: 0, weg: 0 };
  let lijstErbij = 0;
  try {
    for (const s of v.stappen) {
      if (s.soort !== "eters") continue;
      await hulp.bewaarEters(s.planId, s.lidIds);
      gedaan.push(() => hulp.bewaarEters(s.planId, s.vorige));
    }
    const acties = v.stappen
      .map((s) => actieVoor(s, hulp.userId))
      .filter((a): a is () => Promise<PlanUitvoering> => !!a);
    if (acties.length) {
      const r = await wijzigMenu(hulp.userId, planSamen(acties));
      effect = r.effect;
      gedaan.push(r.herstel);
    }
    for (const s of v.stappen) {
      if (s.soort !== "lijst") continue;
      const l = await zetOpLijst(hulp, s, v.lijst.erbij);
      lijstErbij += l.aantal;
      gedaan.push(l.herstel);
    }
  } catch (fout) {
    await draaiTerug(gedaan);
    throw fout;
  }
  let klaar = false;
  return {
    effect,
    lijstErbij,
    herstel: async () => {
      if (klaar) return;
      klaar = true;
      await draaiTerug(gedaan);
    },
  };
}
