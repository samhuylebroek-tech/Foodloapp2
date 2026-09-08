import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, ShoppingCart, Plus, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEAL_TYPES, type Recipe } from "@/lib/types";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Weekmenu – Samen Koken" },
      {
        name: "description",
        content: "Maak je agenda: plan per dag wat je eet en zet alle ingrediënten op je lijst.",
      },
      { property: "og:title", content: "Weekmenu – Samen Koken" },
      {
        property: "og:description",
        content: "Zie in één oogopslag wat er deze week op tafel komt.",
      },
    ],
  }),
  component: PlannerPage,
});

type PlanRow = {
  id: string;
  plan_date: string;
  meal_type: string;
  recipe_id: string;
  recipes: Recipe | null;
};

function maandagVan(d: Date) {
  const kopie = new Date(d);
  const dag = (kopie.getDay() + 6) % 7;
  kopie.setDate(kopie.getDate() - dag);
  kopie.setHours(12, 0, 0, 0);
  return kopie;
}

function datumTekst(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function labelVoor(datum: string) {
  const d = new Date(`${datum}T12:00:00`);
  return d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
}

function PlannerPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => maandagVan(new Date()));
  const [kiezen, setKiezen] = useState<{ datum: string; moment: string } | null>(null);

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return datumTekst(d);
  });
  const vandaag = datumTekst(new Date());

  const { data: plan = [] } = useQuery({
    queryKey: ["meal-plan", user?.id, week[0]],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plan")
        .select("id, plan_date, meal_type, recipe_id, recipes(*)")
        .gte("plan_date", week[0]!)
        .lte("plan_date", week[6]!)
        .order("plan_date");
      if (error) throw error;
      return data as unknown as PlanRow[];
    },
  });

  async function verwijder(id: string) {
    await supabase.from("meal_plan").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
  }

  async function plan_toevoegen(recipeId: string) {
    if (!user || !kiezen) return;
    const { error } = await supabase.from("meal_plan").insert({
      user_id: user.id,
      recipe_id: recipeId,
      plan_date: kiezen.datum,
      meal_type: kiezen.moment,
    });
    if (error) {
      toast.error("Inplannen lukte niet");
      return;
    }
    setKiezen(null);
    toast.success("In je weekmenu gezet");
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
  }

  async function alleBoodschappen() {
    if (!user || plan.length === 0) return;
    const ids = plan.map((p) => p.recipe_id);
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("name, quantity, unit, recipe_id")
      .in("recipe_id", ids);
    if (error || !data?.length) {
      toast.error("Geen ingrediënten gevonden");
      return;
    }
    const rows = data.map((i) => ({
      user_id: user.id,
      name: i.name as string,
      quantity: i.quantity as number | null,
      unit: (i.unit as string) ?? "",
      recipe_id: i.recipe_id as string,
    }));
    const { error: insertError } = await supabase.from("shopping_items").insert(rows);
    if (insertError) toast.error("Toevoegen lukte niet");
    else toast.success("Alles staat op je boodschappenlijst");
  }

  function verschuif(weken: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + weken * 7);
    setWeekStart(d);
  }

  return (
    <AppShell title="Weekmenu">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => verschuif(-1)}
            aria-label="Vorige week"
            className="size-14"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <p className="flex-1 text-center text-lg font-semibold">
            {new Date(`${week[0]}T12:00:00`).toLocaleDateString("nl-BE", {
              day: "numeric",
              month: "long",
            })}{" "}
            –{" "}
            {new Date(`${week[6]}T12:00:00`).toLocaleDateString("nl-BE", {
              day: "numeric",
              month: "long",
            })}
          </p>
          <Button
            variant="secondary"
            onClick={() => verschuif(1)}
            aria-label="Volgende week"
            className="size-14"
          >
            <ChevronRight className="size-6" />
          </Button>
        </div>

        <Button onClick={alleBoodschappen} className="h-16 w-full text-lg">
          <ShoppingCart className="size-5" /> Hele week op de lijst zetten
        </Button>

        {week.map((dag) => {
          const items = plan.filter((p) => p.plan_date === dag);
          return (
            <section
              key={dag}
              className={
                dag === vandaag
                  ? "rounded-2xl border-2 border-primary bg-card p-4"
                  : "rounded-2xl border border-border bg-card p-4"
              }
            >
              <h2 className="text-lg capitalize">
                {labelVoor(dag)}
                {dag === vandaag ? " · vandaag" : ""}
              </h2>

              {items.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {items.map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <Link
                        to="/recepten/$id"
                        params={{ id: p.recipe_id }}
                        className="flex-1 text-lg underline-offset-4 hover:underline"
                      >
                        <span className="text-base text-muted-foreground">{p.meal_type}: </span>
                        {p.recipes?.title ?? "Recept"}
                      </Link>
                      <Button
                        variant="ghost"
                        onClick={() => verwijder(p.id)}
                        aria-label="Uit weekmenu halen"
                        className="size-12"
                      >
                        <Trash2 className="size-5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setKiezen({ datum: dag, moment: m })}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-secondary px-4 text-base font-semibold"
                  >
                    <Plus className="size-4" aria-hidden /> {m}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {kiezen && (
        <ReceptKiezer
          titel={`${labelVoor(kiezen.datum)} · ${kiezen.moment}`}
          onSluit={() => setKiezen(null)}
          onKies={plan_toevoegen}
        />
      )}
    </AppShell>
  );
}

function ReceptKiezer({
  titel,
  onSluit,
  onKies,
}: {
  titel: string;
  onSluit: () => void;
  onKies: (id: string) => void;
}) {
  const [zoek, setZoek] = useState("");
  const { data: recipes = [] } = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recipe[];
    },
  });

  const lijst = recipes.filter((r) => r.title.toLowerCase().includes(zoek.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-card p-4 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl capitalize">{titel}</h2>
          <Button variant="ghost" onClick={onSluit} aria-label="Sluiten" className="size-12">
            <X className="size-6" />
          </Button>
        </div>
        <Input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek een recept"
          aria-label="Zoek een recept"
          className="mt-3 h-14 text-base"
        />
        <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
          {lijst.length === 0 ? (
            <li className="py-8 text-center text-lg text-muted-foreground">
              Geen recepten gevonden.
            </li>
          ) : (
            lijst.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onKies(r.id)}
                  className="min-h-16 w-full rounded-xl border border-border px-4 py-3 text-left text-lg active:bg-secondary"
                >
                  {r.title}
                  <span className="block text-base text-muted-foreground">
                    {r.prep_minutes + r.cook_minutes} min · {r.category}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
