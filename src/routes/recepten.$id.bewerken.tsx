import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { RecipeForm } from "@/components/RecipeForm";
import type { Ingredient, Recipe } from "@/lib/types";

export const Route = createFileRoute("/recepten/$id/bewerken")({
  head: () => ({
    meta: [
      { title: "Recept aanpassen – MaJeBa" },
      { name: "description", content: "Pas dit recept aan: ingrediënten, stappen, foto en tijden." },
      { property: "og:title", content: "Recept aanpassen – MaJeBa" },
      { property: "og:description", content: "Werk je recept bij in MaJeBa." },
    ],
  }),
  component: BewerkenPage,
});

function BewerkenPage() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
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
      {isLoading || !data ? (
        <p className="py-10 text-center text-lg text-muted-foreground">Laden…</p>
      ) : (
        <RecipeForm recipe={data.recipe} ingredients={data.ingredients} />
      )}
    </AppShell>
  );
}
