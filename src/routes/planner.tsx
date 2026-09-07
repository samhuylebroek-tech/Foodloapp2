import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/lib/types";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Weekplanning – Samen Koken" },
      {
        name: "description",
        content: "Plan per dag wat je eet en zet alle ingrediënten in één keer op je lijst.",
      },
      { property: "og:title", content: "Weekplanning – Samen Koken" },
      { property: "og:description", content: "Zie in één oogopslag wat er deze week op tafel komt." },
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

function dagen() {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

function labelVoor(datum: string) {
  const d = new Date(`${datum}T12:00:00`);
  return d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
}

function PlannerPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const week = dagen();

  const { data: plan = [] } = useQuery({
    queryKey: ["meal-plan", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plan")
        .select("id, plan_date, meal_type, recipe_id, recipes(*)")
        .gte("plan_date", week[0])
        .lte("plan_date", week[6])
        .order("plan_date");
      if (error) throw error;
      return data as unknown as PlanRow[];
    },
  });

  async function verwijder(id: string) {
    await supabase.from("meal_plan").delete().eq("id", id);
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

  return (
    <AppShell title="Weekplanning">
      <div className="space-y-4">
        <Button onClick={alleBoodschappen} className="h-16 w-full text-lg">
          <ShoppingCart className="size-5" /> Hele week op de lijst zetten
        </Button>

        {week.map((dag) => {
          const items = plan.filter((p) => p.plan_date === dag);
          return (
            <section key={dag} className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-lg capitalize">{labelVoor(dag)}</h2>
              {items.length === 0 ? (
                <p className="mt-2 text-base text-muted-foreground">Nog niets gepland.</p>
              ) : (
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
                        aria-label="Uit planning halen"
                        className="size-12"
                      >
                        <Trash2 className="size-5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
