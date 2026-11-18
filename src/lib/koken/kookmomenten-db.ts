/**
 * Kookmomenten op je account (tabel `kookmomenten`, voorstel 0015) of, zolang die tabel niet
 * bestaat, op dit toestel. Elke schrijfactie geeft een herstel terug ("Ongedaan maken").
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { db, isOntbrekendeTabel } from "@/lib/module-beschikbaar";
import {
  KOOKMOMENTEN_GEWIJZIGD,
  leesLokaal,
  maakKookmoment,
  schrijfLokaal,
  voegToe,
  type Kookmoment,
  type NieuwKookmoment,
} from "./kookmomenten";

export const KOOKMOMENTEN_TABEL = "kookmomenten";
const KOLOMMEN = "id, recipe_id, meal_plan_id, gekookt_op, porties, notitie";

/** Alle kookmomenten van de laatste 90 dagen (account, of toestel als de tabel er niet is). */
export async function laadKookmomenten(userId: string): Promise<Kookmoment[]> {
  const sinds = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data, error } = await db
    .from(KOOKMOMENTEN_TABEL)
    .select(KOLOMMEN)
    .eq("user_id", userId)
    .gte("gekookt_op", sinds)
    .order("gekookt_op", { ascending: false })
    .limit(500);
  if (error) {
    if (isOntbrekendeTabel(error)) return leesLokaal(userId);
    throw error;
  }
  return (data ?? []) as Kookmoment[];
}

/**
 * "Gekookt" bewaren. Voor een geplande maaltijd vervangt dit een eerder moment (één per maaltijd).
 * Geeft het herstel terug dat de vorige stand terugzet.
 */
export async function bewaarKookmoment(
  userId: string,
  m: NieuwKookmoment,
): Promise<{ moment: Kookmoment; opToestel: boolean; herstel: () => Promise<void> }> {
  const nieuw = maakKookmoment(m);
  let vorige: Kookmoment | null = null;
  if (m.planId) {
    const { data, error } = await db
      .from(KOOKMOMENTEN_TABEL)
      .select(KOLOMMEN)
      .eq("user_id", userId)
      .eq("meal_plan_id", m.planId)
      .limit(1)
      .maybeSingle();
    if (error && isOntbrekendeTabel(error)) return lokaal(userId, nieuw);
    if (error) throw error;
    vorige = (data as Kookmoment | null) ?? null;
  }
  const { id: _lokaalId, ...velden } = nieuw;
  if (vorige) {
    const { error } = await db
      .from(KOOKMOMENTEN_TABEL)
      .update({ gekookt_op: velden.gekookt_op, porties: velden.porties, notitie: velden.notitie })
      .eq("id", vorige.id);
    if (error) throw error;
    const oud = vorige;
    return {
      moment: { ...nieuw, id: oud.id },
      opToestel: false,
      herstel: async () => {
        const { error: e } = await db
          .from(KOOKMOMENTEN_TABEL)
          .update({ gekookt_op: oud.gekookt_op, porties: oud.porties, notitie: oud.notitie })
          .eq("id", oud.id);
        if (e) throw e;
      },
    };
  }
  const { data, error } = await db
    .from(KOOKMOMENTEN_TABEL)
    .insert({ ...velden, user_id: userId })
    .select("id")
    .single();
  if (error && isOntbrekendeTabel(error)) return lokaal(userId, nieuw);
  if (error) throw error;
  const id = (data as { id: string }).id;
  return {
    moment: { ...nieuw, id },
    opToestel: false,
    herstel: async () => {
      const { error: e } = await db.from(KOOKMOMENTEN_TABEL).delete().eq("id", id);
      if (e) throw e;
    },
  };
}

function lokaal(userId: string, nieuw: Kookmoment) {
  const { lijst, vervangen } = voegToe(leesLokaal(userId), nieuw);
  schrijfLokaal(userId, lijst);
  return {
    moment: nieuw,
    opToestel: true,
    herstel: async () => {
      const zonder = leesLokaal(userId).filter((x) => x.id !== nieuw.id);
      schrijfLokaal(userId, vervangen ? [...zonder, vervangen] : zonder);
    },
  };
}

/** Kookmomenten van de aangemelde gebruiker, ververst na elke wijziging. */
export function useKookmomenten(): Kookmoment[] {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["kookmomenten", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: () => laadKookmomenten(user!.id),
  });
  useEffect(() => {
    const ververs = () => void qc.invalidateQueries({ queryKey: ["kookmomenten"] });
    window.addEventListener(KOOKMOMENTEN_GEWIJZIGD, ververs);
    return () => window.removeEventListener(KOOKMOMENTEN_GEWIJZIGD, ververs);
  }, [qc]);
  return data;
}
