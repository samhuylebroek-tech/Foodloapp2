import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Voorbereiding op betalen. Zolang de instelling "betalen_actief" uit staat,
 * is alles gratis en onbeperkt. Zet die aan in het beheercentrum om de
 * gratis limiet en bijgekochte pakketten te laten meetellen.
 */
export type Limiet = {
  betalenActief: boolean;
  gratis: number;
  extra: number;
  totaal: number;
  gebruikt: number;
  over: number;
  magToevoegen: boolean;
};

function getal(v: unknown, standaard: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : standaard;
}

export async function haalLimiet(userId: string | undefined): Promise<Limiet> {
  const { data: instellingen } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", ["betalen_actief", "gratis_gerechten", "pakket_gerechten"]);

  const map = new Map((instellingen ?? []).map((r) => [r.key, r.value]));
  const betalenActief = map.get("betalen_actief") === true;
  const gratis = getal(map.get("gratis_gerechten"), 100);

  if (!betalenActief || !userId) {
    return {
      betalenActief,
      gratis,
      extra: 0,
      totaal: Number.POSITIVE_INFINITY,
      gebruikt: 0,
      over: Number.POSITIVE_INFINITY,
      magToevoegen: true,
    };
  }

  const [{ count }, { data: aankopen }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("aankopen")
      .select("extra_gerechten")
      .eq("user_id", userId)
      .eq("status", "betaald"),
  ]);

  const extra = (aankopen ?? []).reduce((s, a) => s + (a.extra_gerechten ?? 0), 0);
  const gebruikt = count ?? 0;
  const totaal = gratis + extra;

  return {
    betalenActief,
    gratis,
    extra,
    totaal,
    gebruikt,
    over: Math.max(0, totaal - gebruikt),
    magToevoegen: gebruikt < totaal,
  };
}

export function useLimiet(userId?: string) {
  return useQuery({
    queryKey: ["limiet", userId ?? null],
    queryFn: () => haalLimiet(userId),
    staleTime: 60_000,
  });
}
