/**
 * Budgetgeschiedenis van de aangemelde gebruiker: op het account (`budget_weken`, voorstel
 * 0014) of, zolang die tabel niet bestaat, op dit toestel. Zie `budget-geschiedenis.ts`.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  bewaarToestelWeek,
  isAnders,
  leesToestelWeken,
  leesWeek,
  zetWeek,
  type BudgetWeek,
} from "@/lib/budget-geschiedenis";
import { db, useModuleBeschikbaar } from "@/lib/module-beschikbaar";

export const BUDGET_WEKEN_TABEL = "budget_weken";

export function useBudgetGeschiedenis(): {
  weken: BudgetWeek[];
  opslag: "account" | "toestel";
  laden: boolean;
  bewaar: (w: BudgetWeek) => Promise<void>;
} {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { beschikbaar, laden: modLaden } = useModuleBeschikbaar(BUDGET_WEKEN_TABEL);
  const sleutel = ["budget-weken", user?.id, beschikbaar];
  const { data, isLoading } = useQuery({
    queryKey: sleutel,
    enabled: !!user && !modLaden,
    staleTime: 60_000,
    queryFn: async (): Promise<BudgetWeek[]> => {
      if (!beschikbaar) return leesToestelWeken(user!.id);
      const { data, error } = await db
        .from(BUDGET_WEKEN_TABEL)
        .select("week, budget, geschat, niet_geschat, maaltijden")
        .eq("user_id", user!.id)
        .order("week", { ascending: false })
        .limit(12);
      if (error) return leesToestelWeken(user!.id);
      return (data ?? []).map(leesWeek).filter((x): x is BudgetWeek => !!x);
    },
  });
  const weken = data ?? [];

  async function bewaar(w: BudgetWeek) {
    if (
      !user ||
      !isAnders(
        weken.find((x) => x.week === w.week),
        w,
      )
    )
      return;
    if (beschikbaar) {
      const { error } = await db
        .from(BUDGET_WEKEN_TABEL)
        .upsert(
          { user_id: user.id, ...w, bijgewerkt_op: new Date().toISOString() },
          { onConflict: "user_id,week" },
        );
      if (error) {
        bewaarToestelWeek(user.id, w);
        return;
      }
    } else bewaarToestelWeek(user.id, w);
    qc.setQueryData(sleutel, zetWeek(weken, w));
  }

  return {
    weken,
    opslag: beschikbaar ? "account" : "toestel",
    laden: !!user && (modLaden || isLoading),
    bewaar,
  };
}
