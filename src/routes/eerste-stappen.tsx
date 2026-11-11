import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Circle } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  OEFENINGEN,
  eersteStappenVerborgen,
  gedaan,
  kookstandGestart,
  verbergEersteStappen,
  type Tellingen,
} from "@/lib/eerste-stappen";

export const Route = createFileRoute("/eerste-stappen")({
  head: () => ({ meta: [{ title: "Eerste stappen — Foodlo" }] }),
  component: EersteStappen,
});

/** Alleen tellen (head-verzoeken): geen inhoud ophalen. */
async function tel(userId: string): Promise<Tellingen> {
  const n = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [recepten, plannen, lijst, afgevinkt, voorraad] = await Promise.all([
    n(
      supabase
        .from("recipes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null),
    ),
    n(
      supabase.from("meal_plan").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ),
    n(
      supabase
        .from("shopping_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ),
    n(
      supabase
        .from("shopping_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("checked", true),
    ).then(async (k) =>
      k > 0
        ? k
        : n(
            supabase
              .from("shopping_history")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId),
          ),
    ),
    n(
      supabase
        .from("pantry_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ),
  ]);
  return { recepten, plannen, lijst, afgevinkt, voorraad };
}

function EersteStappen() {
  const { user } = useAuth();
  const [verborgen, setVerborgen] = useState(eersteStappenVerborgen);
  const { data, isLoading } = useQuery({
    queryKey: ["eerste-stappen", user?.id],
    enabled: !!user,
    queryFn: () => tel(user!.id),
  });
  const stand = data ? gedaan(data, kookstandGestart()) : null;
  const klaar = stand ? OEFENINGEN.filter((o) => stand[o.id]).length : 0;

  return (
    <AppShell title="Eerste stappen" ondertitel="Zes korte oefeningen in de echte app">
      <div className="space-y-6">
        <p className="text-base text-muted-foreground">
          Je doet elke oefening zelf, met je eigen recepten en lijst. Wat je gedaan hebt, wordt
          vanzelf afgevinkt. Niets is verplicht.
        </p>
        <div aria-live="polite">
          {isLoading || !stand ? (
            <p className="text-base">Even kijken wat je al gedaan hebt…</p>
          ) : (
            <>
              <p className="text-lg font-semibold">
                {klaar} van {OEFENINGEN.length} gedaan
              </p>
              <div
                className="mt-2 h-3 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Voortgang eerste stappen"
                aria-valuemin={0}
                aria-valuemax={OEFENINGEN.length}
                aria-valuenow={klaar}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(klaar / OEFENINGEN.length) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>

        <ol className="space-y-3">
          {OEFENINGEN.map((o) => {
            const ok = stand?.[o.id] ?? false;
            return (
              <li
                key={o.id}
                data-oefening={o.id}
                data-gedaan={ok}
                className="paneel flex gap-3 p-4"
              >
                {ok ? (
                  <Check
                    className="mt-0.5 size-7 shrink-0 rounded-full bg-primary p-1 text-primary-foreground"
                    aria-hidden
                  />
                ) : (
                  <Circle className="mt-0.5 size-7 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <h2 className="text-base font-bold">
                    {o.titel}
                    <span className="sr-only">{ok ? " (gedaan)" : " (nog te doen)"}</span>
                  </h2>
                  <p className="text-base text-muted-foreground">{o.uitleg}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {!ok ? (
                      <Link
                        to={o.route as "/"}
                        className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        {o.knop}
                      </Link>
                    ) : null}
                    <Link
                      to="/hulp/$slug"
                      params={{ slug: o.hulp }}
                      className="inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4"
                    >
                      Hoe werkt het?
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          onClick={() => {
            verbergEersteStappen(!verborgen);
            setVerborgen(!verborgen);
          }}
          className="min-h-11 text-base font-semibold underline underline-offset-4"
        >
          {verborgen ? "Toon de eerste stappen weer op Vandaag" : "Niet meer tonen op Vandaag"}
        </button>
      </div>
    </AppShell>
  );
}
