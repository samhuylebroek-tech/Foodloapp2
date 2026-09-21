import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { RecipeForm } from "@/components/RecipeForm";
import { ReceptGeschiedenis } from "@/components/ReceptGeschiedenis";
import type { Ingredient, Recipe } from "@/lib/types";

export const Route = createFileRoute("/recepten/$id_/bewerken")({
  head: () => ({
    meta: [
      { title: "Recept aanpassen – Foodlo" },
      { name: "description", content: "Pas dit recept aan: ingrediënten, stappen, foto en tijden." },
      { property: "og:title", content: "Recept aanpassen – Foodlo" },
      { property: "og:description", content: "Werk je recept bij in Foodlo." },
    ],
  }),
  component: BewerkenPage,
});

function BewerkenPage() {
  const { id } = Route.useParams();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["recipe-edit", id],
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
      return {
        recipe: recipeRes.data as Recipe,
        ingredients: ingRes.data as Ingredient[],
      };
    },
  });

  return (
    <AppShell title="Recept aanpassen">
      {isError ? (
        <div className="rounded-3xl border border-border bg-card p-6 text-center">
          <p className="text-lg font-semibold">Dit recept kon niet laden</p>
          <p className="mt-2 text-muted-foreground">Controleer je verbinding en probeer het opnieuw.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 inline-flex min-h-14 items-center justify-center rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground"
          >
            Opnieuw proberen
          </button>
        </div>
      ) : isLoading || !data ? (
        <PageSkeleton />
      ) : (
        <>
          <RecipeForm recipe={data.recipe} ingredients={data.ingredients} />
          <ReceptGeschiedenis recipeId={id} />
        </>
      )}
    </AppShell>
  );
}
