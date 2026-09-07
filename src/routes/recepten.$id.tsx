import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChefHat,
  Clock,
  Heart,
  Minus,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  X,
  CalendarPlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { RecipePhoto } from "@/components/RecipePhoto";
import { Button } from "@/components/ui/button";
import { MEAL_TYPES, type Ingredient, type Recipe } from "@/lib/types";

export const Route = createFileRoute("/recepten/$id")({
  head: () => ({
    meta: [
      { title: "Recept – Samen Koken" },
      {
        name: "description",
        content:
          "Bekijk het recept met ingrediënten voor jouw aantal personen, en kook stap voor stap mee.",
      },
      { property: "og:title", content: "Recept – Samen Koken" },
      { property: "og:description", content: "Ingrediënten, stappen en kookstand in één scherm." },
    ],
  }),
  component: ReceptPage,
});

function ReceptPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [personen, setPersonen] = useState<number | null>(null);
  const [kookstand, setKookstand] = useState(false);
  const [stap, setStap] = useState(0);
  const [planOpen, setPlanOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["recipe", id],
    queryFn: async () => {
      const [recipeRes, ingRes] = await Promise.all([
        supabase.from("recipes").select("*").eq("id", id).single(),
        supabase
          .from("recipe_ingredients")
          .select("*")
          .eq("recipe_id", id)
          .order("position", { ascending: true }),
      ]);
      if (recipeRes.error) throw recipeRes.error;
      if (ingRes.error) throw ingRes.error;
      return { recipe: recipeRes.data as Recipe, ingredients: ingRes.data as Ingredient[] };
    },
  });

  const { data: isFavorite = false } = useQuery({
    queryKey: ["favorite", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("recipe_id").eq("recipe_id", id);
      return (data?.length ?? 0) > 0;
    },
  });

  if (isLoading || !data) {
    return (
      <AppShell title="Recept">
        <p className="py-10 text-center text-lg text-muted-foreground">Laden…</p>
      </AppShell>
    );
  }

  const { recipe, ingredients } = data;
  const aantal = personen ?? recipe.servings;
  const factor = recipe.servings > 0 ? aantal / recipe.servings : 1;
  const isOwner = user?.id === recipe.user_id;

  async function toggleFavorite() {
    if (!user) return;
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("recipe_id", id).eq("user_id", user.id);
    } else {
      await supabase.from("favorites").insert({ recipe_id: id, user_id: user.id });
    }
    qc.invalidateQueries({ queryKey: ["favorite", id] });
    qc.invalidateQueries({ queryKey: ["favorites"] });
  }

  async function naarBoodschappen() {
    if (!user) return;
    const rows = ingredients.map((i) => ({
      user_id: user.id,
      name: i.name,
      quantity: i.quantity === null ? null : Math.round(i.quantity * factor * 100) / 100,
      unit: i.unit,
      recipe_id: recipe.id,
    }));
    if (!rows.length) return;
    const { error } = await supabase.from("shopping_items").insert(rows);
    if (error) toast.error("Toevoegen lukte niet");
    else toast.success("Ingrediënten op je boodschappenlijst gezet");
  }

  async function planOp(datum: string, moment: string) {
    if (!user) return;
    const { error } = await supabase
      .from("meal_plan")
      .insert({ user_id: user.id, recipe_id: recipe.id, plan_date: datum, meal_type: moment });
    if (error) toast.error("Inplannen lukte niet");
    else {
      toast.success("In je planning gezet");
      setPlanOpen(false);
    }
  }

  async function verwijder() {
    if (!confirm("Dit recept definitief verwijderen?")) return;
    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
    if (error) toast.error("Verwijderen lukte niet");
    else {
      toast.success("Recept verwijderd");
      navigate({ to: "/" });
    }
  }

  if (kookstand) {
    const stappen = recipe.instructions;
    return (
      <div className="min-h-screen bg-background p-5">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-muted-foreground">
              Stap {stap + 1} van {stappen.length}
            </p>
            <Button variant="ghost" onClick={() => setKookstand(false)} className="h-14">
              <X className="size-6" /> Sluiten
            </Button>
          </div>
          <h2 className="mt-6 font-display text-3xl">{recipe.title}</h2>
          <p className="mt-6 text-2xl leading-relaxed">{stappen[stap]}</p>
          <div className="mt-10 flex gap-3">
            <Button
              variant="secondary"
              disabled={stap === 0}
              onClick={() => setStap(stap - 1)}
              className="h-20 flex-1 text-lg"
            >
              Vorige
            </Button>
            <Button
              disabled={stap >= stappen.length - 1}
              onClick={() => setStap(stap + 1)}
              className="h-20 flex-1 text-lg"
            >
              Volgende
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title={recipe.title}
      action={
        <Button variant="ghost" onClick={toggleFavorite} className="h-12" aria-label="Favoriet">
          <Heart className={isFavorite ? "size-6 fill-primary text-primary" : "size-6"} />
        </Button>
      }
    >
      <div className="space-y-6">
        <RecipePhoto path={recipe.image_url} alt={recipe.title} className="h-56 w-full rounded-3xl" />

        {recipe.description && <p className="text-lg leading-relaxed">{recipe.description}</p>}

        <div className="flex flex-wrap gap-3 text-base text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Clock className="size-5" aria-hidden /> {recipe.prep_minutes + recipe.cook_minutes} min
          </span>
          <span className="inline-flex items-center gap-2">
            <ChefHat className="size-5" aria-hidden /> {recipe.difficulty}
          </span>
          <span>{recipe.category}</span>
        </div>

        <section className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Ingrediënten</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setPersonen(Math.max(1, aantal - 1))}
                aria-label="Minder personen"
                className="size-14"
              >
                <Minus className="size-5" />
              </Button>
              <span className="w-24 text-center text-lg font-semibold">
                {aantal} pers.
              </span>
              <Button
                variant="secondary"
                onClick={() => setPersonen(aantal + 1)}
                aria-label="Meer personen"
                className="size-14"
              >
                <Plus className="size-5" />
              </Button>
            </div>
          </div>

          <ul className="mt-4 space-y-2 text-lg">
            {ingredients.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 border-b border-border py-2">
                <span>{i.name}</span>
                <span className="shrink-0 font-semibold">
                  {i.quantity === null
                    ? ""
                    : `${Math.round(i.quantity * factor * 100) / 100} ${i.unit}`.trim()}
                </span>
              </li>
            ))}
            {ingredients.length === 0 && (
              <li className="py-2 text-muted-foreground">Nog geen ingrediënten.</li>
            )}
          </ul>

          <Button onClick={naarBoodschappen} className="mt-4 h-16 w-full text-lg">
            <ShoppingCart className="size-5" /> Naar boodschappenlijst
          </Button>
        </section>

        <section>
          <h2 className="text-xl">Bereiding</h2>
          <ol className="mt-3 space-y-3">
            {recipe.instructions.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                <span className="font-display text-xl text-primary">{i + 1}</span>
                <p className="text-lg leading-relaxed">{s}</p>
              </li>
            ))}
          </ol>
          {recipe.instructions.length > 0 && (
            <Button
              onClick={() => {
                setStap(0);
                setKookstand(true);
              }}
              className="mt-4 h-16 w-full text-lg"
            >
              Start kookstand
            </Button>
          )}
        </section>

        <section className="space-y-3">
          <Button
            variant="secondary"
            onClick={() => setPlanOpen(!planOpen)}
            className="h-16 w-full text-lg"
          >
            <CalendarPlus className="size-5" /> Inplannen
          </Button>

          {planOpen && <PlanKiezer onKies={planOp} />}

          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noreferrer"
              className="block py-2 text-base text-primary underline underline-offset-4"
            >
              Bekijk de originele website
            </a>
          )}

          {isOwner && (
            <div className="flex gap-3">
              <Link
                to="/recepten/$id/bewerken"
                params={{ id: recipe.id }}
                className="inline-flex h-16 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card text-lg font-semibold"
              >
                <Pencil className="size-5" /> Aanpassen
              </Link>
              <Button
                variant="ghost"
                onClick={verwijder}
                className="h-16 flex-1 text-lg text-destructive"
              >
                <Trash2 className="size-5" /> Verwijderen
              </Button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function PlanKiezer({ onKies }: { onKies: (datum: string, moment: string) => void }) {
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [moment, setMoment] = useState<string>("avondeten");
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <input
        type="date"
        value={datum}
        onChange={(e) => setDatum(e.target.value)}
        aria-label="Datum"
        className="h-14 w-full rounded-xl border border-input bg-background px-3 text-base"
      />
      <select
        value={moment}
        onChange={(e) => setMoment(e.target.value)}
        aria-label="Maaltijd"
        className="h-14 w-full rounded-xl border border-input bg-background px-3 text-base"
      >
        {MEAL_TYPES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <Button onClick={() => onKies(datum, moment)} className="h-16 w-full text-lg">
        Zet in planning
      </Button>
    </div>
  );
}
