/**
 * P5 — Samenwerking tegen de databank: activiteitslog, meldingen voor gezinsleden, namen.
 *
 * Tabellen uit voorstel 0017 (niet uitgevoerd): `gezin_activiteit`, `app_meldingen`,
 * `lijst_toewijzingen`, `app_melding_instellingen`. Bestaan ze (nog) niet, dan gebeurt er
 * hier niets: het log en de meldingen zijn een extraatje en mogen een menu- of lijstwijziging
 * nooit laten mislukken. Andere fouten worden ook stil genegeerd om dezelfde reden.
 */
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/module-beschikbaar";
import { lokaleDatum } from "@/lib/tijd";
import type { ActiviteitSoort } from "@/lib/samenwerking/activiteit";
import { schoonMeldingTekst, veiligeLink, type MeldingSoort } from "@/lib/samenwerking/meldingen";

export const ACTIVITEIT_TABEL = "gezin_activiteit";
export const MELDINGEN_TABEL = "app_meldingen";
export const TOEWIJZINGEN_TABEL = "lijst_toewijzingen";
export const MELDING_INSTELLINGEN_TABEL = "app_melding_instellingen";

/** Actieve leden (met account) van een gezin. */
export async function actieveLeden(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("status", "actief");
  if (error) return [];
  return [...new Set((data ?? []).map((r) => r.user_id as string))];
}

/** Weergavenamen (profiles.display_name) voor een reeks accounts. */
export async function namenVan(ids: readonly string[]): Promise<Record<string, string>> {
  const uniek = [...new Set(ids.filter(Boolean))];
  if (!uniek.length) return {};
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", uniek);
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.display_name ?? ""]));
}

export async function logActiviteit(o: {
  groupId: string;
  actorId: string;
  soort: ActiviteitSoort;
  tekst: string;
  datum?: string | undefined;
  refId?: string | null | undefined;
}): Promise<void> {
  try {
    await db.from(ACTIVITEIT_TABEL).insert({
      group_id: o.groupId,
      actor_id: o.actorId,
      soort: o.soort,
      tekst: schoonMeldingTekst(o.tekst),
      datum: o.datum ?? lokaleDatum(),
      ref_id: o.refId ?? null,
    });
  } catch {
    // Het log is een extraatje: nooit de actie zelf laten mislukken.
  }
}

/**
 * Melding voor andere gezinsleden (of één ontvanger). Jezelf krijg je nooit. De ontvanger
 * filtert zelf op zijn instellingen (die zijn privé: de afzender leest ze niet).
 */
export async function stuurMelding(o: {
  groupId: string;
  actorId: string;
  soort: MeldingSoort;
  tekst: string;
  link?: string | null;
  /** Alleen deze ontvangers; standaard alle andere actieve leden. */
  naar?: readonly string[];
  /** Ontdubbelen: dezelfde sleutel geeft per ontvanger maar één melding. */
  sleutel?: string;
}): Promise<number> {
  try {
    const leden = o.naar ?? (await actieveLeden(o.groupId));
    const naar = [...new Set(leden)].filter((id) => id && id !== o.actorId);
    if (!naar.length) return 0;
    const tekst = schoonMeldingTekst(o.tekst);
    const link = veiligeLink(o.link ?? null);
    const { error } = await db.from(MELDINGEN_TABEL).insert(
      naar.map((user_id) => ({
        user_id,
        group_id: o.groupId,
        actor_id: o.actorId,
        soort: o.soort,
        tekst,
        link,
        sleutel: o.sleutel ? `${o.sleutel}` : null,
      })),
    );
    return error ? 0 : naar.length;
  } catch {
    return 0;
  }
}

/** Mijn eigen weergavenaam (voor "Jan zette …"). */
export async function mijnNaam(userId: string): Promise<string | null> {
  return (await namenVan([userId]))[userId] || null;
}

/** Log + melding voor een wijziging in het gezinsweekmenu (of de lijst: `soort`). */
export async function meldGezin(o: {
  groupId: string;
  actorId: string;
  /** Tekst met de naam van wie het deed. */
  tekst: (wie: string | null) => string;
  datum?: string | undefined;
  refId?: string | null | undefined;
  soort?: "menu" | "winkelen-klaar";
  link?: string;
}): Promise<void> {
  try {
    const wie = await mijnNaam(o.actorId);
    const tekst = o.tekst(wie);
    const soort = o.soort ?? "menu";
    await Promise.all([
      logActiviteit({
        groupId: o.groupId,
        actorId: o.actorId,
        soort: soort === "menu" ? "menu" : "winkelen",
        tekst,
        datum: o.datum,
        refId: o.refId,
      }),
      stuurMelding({
        groupId: o.groupId,
        actorId: o.actorId,
        soort,
        tekst,
        link: o.link ?? "/planner?weergave=gezin",
      }),
    ]);
  } catch {
    // Extraatje: nooit de actie laten mislukken.
  }
}

/** Wie veranderde deze maaltijd of dit item het laatst (niet jijzelf)? */
export async function laatsteWijziger(
  refId: string,
  zelf: string,
): Promise<{ id: string; naam: string | null } | null> {
  try {
    const { data, error } = await db
      .from(ACTIVITEIT_TABEL)
      .select("actor_id, created_at")
      .eq("ref_id", refId)
      .neq("actor_id", zelf)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error || !data?.length) return null;
    const id = data[0]!.actor_id as string;
    return { id, naam: (await namenVan([id]))[id] || null };
  } catch {
    return null;
  }
}

/** Titel van een maaltijd zoals ze nu in de databank staat. */
export async function titelVanPlan(rij: {
  recipe_id: string | null;
  custom_title: string | null;
}): Promise<string | null> {
  if (!rij.recipe_id) return rij.custom_title ?? null;
  const { data } = await supabase
    .from("recipes")
    .select("title")
    .eq("id", rij.recipe_id)
    .limit(1)
    .maybeSingle();
  return (data?.title as string | undefined) ?? rij.custom_title ?? "een ander gerecht";
}
