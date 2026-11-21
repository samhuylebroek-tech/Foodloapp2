/**
 * Receptversies tegen de databank (tabel `recipe_versions`, bestaat al in productie).
 * - `bewaarVersie`: momentopname van de huidige stand, vóór een wijziging.
 * - `zetVersieTerug`: eerst de huidige stand bewaren, dan de gekozen versie terugschrijven;
 *   geeft één herstel ("Ongedaan maken") dat de stand van vóór het terugzetten terugzet.
 */
import { db, isOntbrekendeTabel } from "@/lib/module-beschikbaar";
import {
  receptVelden,
  staatUit,
  staatVanOpname,
  type Momentopname,
  type ReceptStaat,
  type VersieReden,
  type VersieRij,
} from "@/lib/recept-versies";

export const VERSIES_TABEL = "recipe_versions";

function moet<T extends { error: unknown }>(res: T): T {
  if (res.error)
    throw res.error instanceof Error
      ? res.error
      : new Error(String((res.error as { message?: string }).message ?? res.error));
  return res;
}

export async function leesStaat(
  receptId: string,
): Promise<{ recept: Record<string, unknown>; ingredienten: Record<string, unknown>[] } | null> {
  const [r, i] = await Promise.all([
    db.from("recipes").select("*").eq("id", receptId).maybeSingle(),
    db.from("recipe_ingredients").select("*").eq("recipe_id", receptId).order("position"),
  ]);
  moet(r);
  moet(i);
  if (!r.data) return null;
  return {
    recept: r.data as Record<string, unknown>,
    ingredienten: (i.data ?? []) as Record<string, unknown>[],
  };
}

/**
 * Bewaart de huidige stand als versie. Geeft de id terug, of null als de tabel er niet is.
 * Andere fouten gooien: dan gaat de wijziging niet door (nooit stil overschrijven).
 */
export async function bewaarVersie(
  receptId: string,
  userId: string,
  reden: VersieReden,
): Promise<string | null> {
  const nu = await leesStaat(receptId);
  if (!nu) return null;
  const momentopname: Momentopname = { ...nu, reden };
  const { data, error } = await db
    .from(VERSIES_TABEL)
    .insert({ recipe_id: receptId, gewijzigd_door: userId, momentopname })
    .select("id")
    .single();
  if (error) {
    if (isOntbrekendeTabel(error)) return null;
    throw error;
  }
  return (data as { id: string }).id;
}

export async function laadVersies(receptId: string, max = 20): Promise<VersieRij[]> {
  const { data, error } = await db
    .from(VERSIES_TABEL)
    .select("id, created_at, momentopname")
    .eq("recipe_id", receptId)
    .order("created_at", { ascending: false })
    .limit(max);
  if (error) {
    if (isOntbrekendeTabel(error)) return [];
    throw error;
  }
  return (data ?? []) as VersieRij[];
}

/** Schrijft een stand terug: receptvelden, dan de ingrediënten (met hun oude id's). */
export async function schrijfStaat(receptId: string, s: ReceptStaat): Promise<void> {
  moet(await db.from("recipes").update(receptVelden(s)).eq("id", receptId));
  moet(await db.from("recipe_ingredients").delete().eq("recipe_id", receptId));
  if (s.ingredienten.length)
    moet(
      await db.from("recipe_ingredients").insert(
        s.ingredienten.map((i, positie) => ({
          ...(i.id ? { id: i.id } : {}),
          recipe_id: receptId,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit ?? "",
          position: i.position ?? positie,
        })),
      ),
    );
}

/**
 * Zet een versie terug. Eerst wordt de huidige stand zelf een versie ("Vorige versie
 * teruggezet"), zodat ook dit terug te draaien is.
 */
export async function zetVersieTerug(opts: {
  receptId: string;
  userId: string;
  versie: VersieRij;
}): Promise<{ herstel: () => Promise<void> }> {
  const voor = await leesStaat(opts.receptId);
  if (!voor) throw new Error("Recept niet gevonden");
  const bewaard = await bewaarVersie(opts.receptId, opts.userId, "terugzetten");
  const vorige = staatUit(voor.recept, voor.ingredienten);
  try {
    await schrijfStaat(opts.receptId, staatVanOpname(opts.versie.momentopname));
  } catch (fout) {
    // Half geschreven? Dan de oude stand terug, en de extra versie weg.
    await schrijfStaat(opts.receptId, vorige).catch(() => undefined);
    if (bewaard) await db.from(VERSIES_TABEL).delete().eq("id", bewaard);
    throw fout;
  }
  let gedaan = false;
  return {
    herstel: async () => {
      if (gedaan) return;
      gedaan = true;
      await schrijfStaat(opts.receptId, vorige);
      if (bewaard) moet(await db.from(VERSIES_TABEL).delete().eq("id", bewaard));
    },
  };
}

/** Ongedaan maken van een wijziging: de versie die er net voor bewaard werd, mag weg. */
export async function verwijderVersie(id: string | null): Promise<void> {
  if (!id) return;
  await db.from(VERSIES_TABEL).delete().eq("id", id);
}
