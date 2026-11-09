/**
 * WP6 — weekmenu op tablet (768–1023 px): links de week met wat er gepland staat, rechts de
 * gekozen dag. Geen telefoonweergave die uitgerekt wordt, en geen 7-koloms desktopraster dat
 * op een staande tablet te smal is.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Maaltijd = {
  plan_date: string;
  custom_title: string | null;
  recipes: { title: string } | null;
};

export function TabletWeek({
  week,
  gekozen,
  vandaag,
  plan,
  zichtbaar,
  onKies,
  children,
}: {
  week: string[];
  gekozen: string;
  vandaag: string;
  plan: Maaltijd[];
  zichtbaar: string[];
  onKies: (dag: string) => void;
  /** De gekozen dag, zoals de planner hem toont. */
  children: ReactNode;
}) {
  return (
    <section
      aria-label="Week en dag"
      className="grid grid-cols-[15rem_minmax(0,1fr)] items-start gap-6"
    >
      <nav aria-label="Dagen van de week" className="sticky top-24 space-y-2">
        {week.map((dag) => {
          const d = new Date(`${dag}T12:00:00`);
          const actief = dag === gekozen;
          const items = plan.filter((p) => p.plan_date === dag);
          const zacht = actief ? "text-inkt-zacht" : "text-muted-foreground";
          return (
            <button
              key={dag}
              type="button"
              aria-current={actief ? "date" : undefined}
              onClick={() => onKies(dag)}
              className={cn(
                "block min-h-16 w-full rounded-2xl px-4 py-2.5 text-left transition-colors",
                actief
                  ? "bg-inkt text-inkt-foreground shadow-zacht"
                  : dag === vandaag
                    ? "bg-honing-zacht ring-2 ring-honing"
                    : "bg-card hover:bg-muted",
                !zichtbaar.includes(dag) && !actief && "opacity-50",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-semibold capitalize">
                  {d.toLocaleDateString("nl-BE", { weekday: "long" })}
                  {dag === vandaag ? <span className="sr-only">, vandaag</span> : null}
                </span>
                <span className={cn("text-base tabular-nums", zacht)}>
                  {d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" })}
                </span>
              </span>
              <span className={cn("block truncate text-base", zacht)}>
                {items.length
                  ? items.map((i) => i.recipes?.title ?? i.custom_title ?? "Maaltijd").join(" · ")
                  : "Nog vrij"}
              </span>
            </button>
          );
        })}
      </nav>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
