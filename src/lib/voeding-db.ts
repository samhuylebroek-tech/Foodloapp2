/**
 * Opslag van persoonlijke voeding (voorstel 0009) en huishoudensleden, lid-voeding en mee-eters
 * (voorstel 0010). Deze tabellen bestaan in productie pas na de migratie: tot dan geeft
 * `isOntbrekendeTabel` de "binnenkort"-staat en blijft je eigen voeding op het toestel.
 *
 * Nooit iets hiervan naar een AI-dienst: deze module heeft geen AI-aanroepen en de waarden
 * komen nooit in een AI-tekst (die gaat altijd door `voorAI()`).
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { db, isOntbrekendeTabel } from "@/lib/module-beschikbaar";
import { zetAccountVoeding } from "@/lib/kennismaking";
import {
  normaliseerVoeding,
  teVermijdenAllergenen,
  type Voeding,
} from "@/lib/persoonlijke-voeding";
import type { HuishoudenLid, HuishoudenRol, LidVoeding } from "@/lib/gezin-veiligheid";
import { useAuth } from "@/hooks/useAuth";

export type AccountVoeding = Voeding & {
  toestemming_op: string;
  bijgewerkt_op?: string | undefined;
};

type Staat<T> = { beschikbaar: boolean; data: T };

// ---------- Persoonlijke voeding (eigen account) ----------

export async function haalPersoonlijkeVoeding(
  userId: string,
): Promise<Staat<AccountVoeding | null>> {
  const { data, error } = await db
    .from("persoonlijke_voeding")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isOntbrekendeTabel(error)) return { beschikbaar: false, data: null };
    throw error;
  }
  if (!data) return { beschikbaar: true, data: null };
  return {
    beschikbaar: true,
    data: {
      ...normaliseerVoeding(data as Partial<Voeding>),
      toestemming_op: String(data.toestemming_op),
      bijgewerkt_op: data.bijgewerkt_op ? String(data.bijgewerkt_op) : undefined,
    },
  };
}

export async function bewaarPersoonlijkeVoeding(userId: string, v: Voeding, toestemmingOp: string) {
  const schoon = normaliseerVoeding(v);
  const { error } = await db.from("persoonlijke_voeding").upsert(
    {
      user_id: userId,
      ...schoon,
      toestemming_op: toestemmingOp,
      bijgewerkt_op: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

/** Toestemming intrekken = de rij wissen (AVG art. 7.3). */
export async function wisPersoonlijkeVoeding(userId: string) {
  const { error } = await db.from("persoonlijke_voeding").delete().eq("user_id", userId);
  if (error) throw error;
}

/** Laadt je accountvoeding en geeft ze door aan de veiligheidsregels (in het geheugen). */
export function usePersoonlijkeVoeding() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["persoonlijke-voeding", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: () => haalPersoonlijkeVoeding(user!.id),
  });
  const v = q.data?.data ?? null;
  useEffect(() => {
    if (!user) return;
    zetAccountVoeding(
      user.id,
      v ? { allergieen: teVermijdenAllergenen(v), ...(v.dieet ? { dieet: v.dieet } : {}) } : null,
    );
  }, [user, v]);
  return q;
}

/** Onzichtbaar: zet bij het openen van de app je accountvoeding klaar voor de veiligheid. */
export function AccountVoedingLader() {
  usePersoonlijkeVoeding();
  return null;
}

// ---------- Huishouden (gezinsleden, ook zonder account) ----------

export type Huishouden = {
  leden: HuishoudenLid[];
  /** Alleen de rijen die de databankregels jou laten lezen. */
  voeding: Map<string, LidVoeding>;
};

export async function haalHuishouden(groupId: string): Promise<Staat<Huishouden>> {
  const leeg = { leden: [], voeding: new Map() };
  const { data: leden, error } = await db
    .from("huishouden_leden")
    .select("id, group_id, naam, user_id, rol, beheerder_id, created_at")
    .eq("group_id", groupId)
    .order("created_at");
  if (error) {
    if (isOntbrekendeTabel(error)) return { beschikbaar: false, data: leeg };
    throw error;
  }
  const lijst = (leden ?? []) as HuishoudenLid[];
  if (!lijst.length) return { beschikbaar: true, data: { leden: [], voeding: new Map() } };
  const { data: rijen, error: fout } = await db
    .from("lid_voeding")
    .select("*")
    .in(
      "lid_id",
      lijst.map((l) => l.id),
    );
  if (fout && !isOntbrekendeTabel(fout)) throw fout;
  const voeding = new Map<string, LidVoeding>();
  for (const r of (rijen ?? []) as Record<string, unknown>[]) {
    voeding.set(String(r["lid_id"]), {
      ...normaliseerVoeding(r as Partial<Voeding>),
      lid_id: String(r["lid_id"]),
      delen_met_gezin: r["delen_met_gezin"] === true,
      toestemming_door: String(r["toestemming_door"] ?? ""),
      toestemming_soort: r["toestemming_soort"] === "zelf" ? "zelf" : "beheerder",
      toestemming_op: String(r["toestemming_op"] ?? ""),
    });
  }
  return { beschikbaar: true, data: { leden: lijst, voeding } };
}

export function useHuishouden(groupId: string | null | undefined) {
  return useQuery({
    queryKey: ["huishouden", groupId],
    enabled: !!groupId,
    staleTime: 60 * 1000,
    retry: 1,
    queryFn: () => haalHuishouden(groupId!),
  });
}

export async function voegLidToe(lid: {
  group_id: string;
  naam: string;
  rol: HuishoudenRol;
  user_id: string | null;
  beheerder_id: string | null;
}) {
  const { data, error } = await db.from("huishouden_leden").insert(lid).select("id").single();
  if (error) throw error;
  return String((data as { id: string }).id);
}

export async function verwijderHuishoudenLid(id: string) {
  const { error } = await db.from("huishouden_leden").delete().eq("id", id);
  if (error) throw error;
}

export async function bewaarLidVoeding(
  lidId: string,
  v: Voeding,
  opties: { door: string; soort: "zelf" | "beheerder"; delen: boolean; op: string },
) {
  const { error } = await db.from("lid_voeding").upsert(
    {
      lid_id: lidId,
      ...normaliseerVoeding(v),
      delen_met_gezin: opties.delen,
      toestemming_door: opties.door,
      toestemming_soort: opties.soort,
      toestemming_op: opties.op,
      bijgewerkt_op: new Date().toISOString(),
    },
    { onConflict: "lid_id" },
  );
  if (error) throw error;
}

export async function wisLidVoeding(lidId: string) {
  const { error } = await db.from("lid_voeding").delete().eq("lid_id", lidId);
  if (error) throw error;
}

/**
 * Serveroordeel voor leden waarvan je de gegevens niet mag lezen (voorstel 0010,
 * `maaltijd_veilig_voor`): alleen waar/onwaar per lid. Bestaat de functie niet (demo, of vóór
 * de migratie), dan geeft dit een lege map: de app toont dan geen waarschuwing voor die leden.
 */
export async function serverOordeel(
  recipeId: string | null,
  lidIds: string[],
): Promise<Map<string, boolean>> {
  if (!recipeId || !lidIds.length) return new Map();
  const { data, error } = await db.rpc("maaltijd_veilig_voor", {
    _recipe: recipeId,
    _leden: lidIds,
  });
  if (error || !Array.isArray(data)) return new Map();
  // NULL = niet te controleren (geen ingrediënten): geen waarschuwing, zoals op het toestel.
  const uit = new Map<string, boolean>();
  for (const r of data as { lid_id: string; veilig: boolean | null }[]) {
    if (typeof r.veilig === "boolean") uit.set(String(r.lid_id), r.veilig);
  }
  return uit;
}

// ---------- Mee-eters per maaltijd ----------

export async function haalEters(planIds: string[]): Promise<Map<string, string[]>> {
  const uit = new Map<string, string[]>();
  if (!planIds.length) return uit;
  const { data, error } = await db
    .from("maaltijd_eters")
    .select("meal_plan_id, lid_id")
    .in("meal_plan_id", planIds);
  if (error) {
    if (isOntbrekendeTabel(error)) return uit;
    throw error;
  }
  for (const r of (data ?? []) as { meal_plan_id: string; lid_id: string }[]) {
    uit.set(r.meal_plan_id, [...(uit.get(r.meal_plan_id) ?? []), r["lid_id"]]);
  }
  return uit;
}

/** Zet de mee-eters van een maaltijd. Ontbreekt de tabel, dan gebeurt er niets (geen fout). */
export async function bewaarEters(planId: string, lidIds: string[]) {
  const weg = await db.from("maaltijd_eters").delete().eq("meal_plan_id", planId);
  if (weg.error) {
    if (isOntbrekendeTabel(weg.error)) return;
    throw weg.error;
  }
  if (!lidIds.length) return;
  const { error } = await db
    .from("maaltijd_eters")
    .insert(lidIds.map((lid_id) => ({ meal_plan_id: planId, lid_id })));
  if (error && !isOntbrekendeTabel(error)) throw error;
}
