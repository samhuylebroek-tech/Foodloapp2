/**
 * Week: geschatte kost van de geplande gerechten, en een waarschuwing boven je weekbudget.
 * Altijd met "schatting" erbij: er is geen echte prijsbron.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PiggyBank, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWeekbudget } from "@/hooks/useWeekbudget";
import { budgetOordeel, euro, schatWeek, type PlanKost } from "@/lib/budget";

type Ingr = { name: string; quantity: number | null; unit: string };

export function WeekBudget({
  plan,
  week: maandag,
}: {
  plan: (PlanKost & { id: string })[];
  /** Maandag van de getoonde week (eigen menu, niet in het verleden): "Maak mijn week goedkoper". */
  week?: string | undefined;
}) {
  const [budget] = useWeekbudget();
  const ids = [...new Set(plan.map((p) => p.recipe_id).filter((x): x is string => !!x))].sort();
  const { data: perRecept } = useQuery({
    queryKey: ["budget-ingredienten", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, name, quantity, unit")
        .in("recipe_id", ids);
      if (error) throw error;
      const uit: Record<string, Ingr[]> = {};
      for (const r of data ?? []) (uit[r.recipe_id as string] ??= []).push(r as Ingr);
      return uit;
    },
  });
  if (!plan.length || (ids.length && !perRecept)) return null;
  const week = schatWeek(plan, perRecept ?? {});
  const oordeel = budget ? budgetOordeel(week.totaal, budget) : null;
  const over = oordeel?.status === "over";
  const bijna = oordeel?.status === "bijna";
  return (
    <section
      aria-label="Budget deze week"
      className={[
        "flex items-start gap-3 rounded-2xl border p-4 lg:col-span-2",
        over
          ? "border-[var(--honing)] bg-[var(--honing-zacht)] text-[var(--honing-foreground)]"
          : "border-border bg-card",
      ].join(" ")}
    >
      {over ? (
        <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
      ) : (
        <PiggyBank className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
      )}
      <div className="min-w-0 flex-1 space-y-1 text-base">
        <p className="font-semibold">
          Geschatte kost: {euro(week.totaal)}
          {budget ? ` van ${euro(budget)}` : ""}
        </p>
        {over ? (
          <p role="status">
            Je zit {euro(-oordeel.verschil)} boven je weekbudget. Een vegetarische avond of iets uit
            je voorraad scheelt.
          </p>
        ) : bijna ? (
          <p role="status">Bijna aan je weekbudget: nog {euro(oordeel.verschil)} over.</p>
        ) : budget ? (
          <p>Nog ongeveer {euro(oordeel!.verschil)} over deze week.</p>
        ) : null}
        <p className="text-[0.95rem] text-muted-foreground">
          Schatting met vaste richtprijzen, geen winkelprijzen
          {week.nietGeschat
            ? `; ${week.nietGeschat} ${week.nietGeschat === 1 ? "maaltijd" : "maaltijden"} niet geschat`
            : ""}
          .{" "}
          <Link
            to="/instellingen"
            hash="maaltijden"
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            {budget ? "Budget aanpassen" : "Stel een weekbudget in"}
          </Link>
        </p>
        {maandag && ids.length ? (
          <p>
            <Link
              to="/week-samenstellen"
              search={{ goedkoper: 1, week: maandag }}
              className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
            >
              Maak mijn week goedkoper
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
