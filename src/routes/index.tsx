import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, ChevronRight, Clock, Heart, Plus, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { RecipePhoto } from "@/components/RecipePhoto";
import { NieuweSuggesties } from "@/components/NieuweSuggesties";
import type { Recipe } from "@/lib/types";
import { useT } from "@/lib/voorkeuren";
import { tijdLabel } from "@/lib/tijd";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Foodlo – wat eten we vandaag?" },
      { name: "description", content: "Zie wat er vandaag op het menu staat en ga meteen aan de slag." },
      { property: "og:title", content: "Foodlo – wat eten we vandaag?" },
      { property: "og:description", content: "Je recepten, weekmenu en boodschappen rustig bij elkaar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StartPage,
});

function groet(uur: number) {
  if (uur < 11) return "Goeiemorgen";
  if (uur < 18) return "Goeiemiddag";
  return "Goeieavond";
}

function vandaag() {
  const nu = new Date();
  return `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-${String(nu.getDate()).padStart(2, "0")}`;
}

function StartPage() {
  const { user } = useAuth();
  const t = useT();

  const { data: profiel } = useQuery({
    queryKey: ["home-profiel", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name").eq("id", user?.id ?? "").maybeSingle();
      return data;
    },
  });

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recipes").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recipe[];
    },
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("recipe_id");
      if (error) throw error;
      return data.map((item) => item.recipe_id as string);
    },
  });

  const { data: dagmenu = [] } = useQuery({
    queryKey: ["home-dagmenu", user?.id, vandaag()],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("meal_plan")
        .select("id, custom_title, meal_type, recipe_id, group_id, recipes(*)")
        .eq("plan_date", vandaag())
        .order("meal_type");
      return (data ?? []) as { id: string; custom_title: string | null; meal_type: string; recipe_id: string | null; group_id: string | null; recipes: Recipe | null }[];
    },
  });

  const { data: openItems = 0 } = useQuery({
    queryKey: ["home-shopping", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase.from("shopping_items").select("id", { count: "exact", head: true }).eq("checked", false);
      return count ?? 0;
    },
  });

  const recent = useMemo(() => {
    const favoriet = recipes.filter((recipe) => favorites.includes(recipe.id));
    return (favoriet.length ? favoriet : recipes).slice(0, 4);
  }, [favorites, recipes]);
  const naam = profiel?.display_name?.split(" ")[0];
  // Hetzelfde gerecht kan zowel persoonlijk als via het gezin gepland staan:
  // toon het maar één keer, met voorrang voor de persoonlijke rij.
  const maaltijden = useMemo(() => {
    const perSleutel = new Map<string, (typeof dagmenu)[number]>();
    for (const maaltijd of dagmenu) {
      const sleutel = `${maaltijd.meal_type}|${maaltijd.recipe_id ?? maaltijd.custom_title ?? maaltijd.id}`;
      const bestaand = perSleutel.get(sleutel);
      if (!bestaand || (bestaand.group_id && !maaltijd.group_id)) perSleutel.set(sleutel, maaltijd);
    }
    return [...perSleutel.values()].sort((a, b) => (b.recipes ? 1 : 0) - (a.recipes ? 1 : 0));
  }, [dagmenu]);


  return (
    <AppShell title="Foodlo">
      <div className="space-y-9">
        <header>
          <p className="text-base font-medium text-muted-foreground">{t(groet(new Date().getHours()))}{naam ? `, ${naam}` : ""}</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">{t("Wat eten we vandaag?")}</h2>
        </header>

        {isLoading ? (
          <PageSkeleton rows={2} />
        ) : maaltijden.length > 0 ? (
          <div className="space-y-4">
            {maaltijden.map((maaltijd) =>
              maaltijd.recipes ? (
                <Link
                  key={maaltijd.id}
                  to="/recepten/$id"
                  params={{ id: maaltijd.recipes.id }}
                  className="block overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60 transition-transform active:scale-[0.99]"
                  aria-label={`${t("Bekijk recept")}: ${maaltijd.recipes.title}`}
                >
                  <RecipePhoto path={maaltijd.recipes.image_url} alt={maaltijd.recipes.title} className="aspect-[16/9] w-full rounded-none" />
                  <div className="p-5 sm:p-6">
                    <p className="text-sm font-semibold capitalize text-primary">
                      {t(maaltijd.meal_type || "Vandaag")}
                      {maaltijd.group_id ? <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{t("Gezin")}</span> : null}
                    </p>
                    <h3 className="mt-1 text-2xl">{t(maaltijd.recipes.title)}</h3>
                    <p className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
                      {tijdLabel(maaltijd.recipes.prep_minutes, maaltijd.recipes.cook_minutes) ? <Clock className="size-5" aria-hidden /> : null}
                      {[tijdLabel(maaltijd.recipes.prep_minutes, maaltijd.recipes.cook_minutes), `${maaltijd.recipes.servings} ${t("personen")}`].filter(Boolean).join(" · ")}
                    </p>
                    <span className="mt-5 flex min-h-14 items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground">
                      {t("Bekijk recept")}
                    </span>
                  </div>
                </Link>
              ) : (
                <Link
                  key={maaltijd.id}
                  to="/planner"
                  className="block overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60"
                  aria-label={t("Bekijk je planning")}
                >
                  <div className="p-5 sm:p-6">
                    <p className="text-sm font-semibold capitalize text-primary">
                      {t(maaltijd.meal_type || "Vandaag")}
                      {maaltijd.group_id ? <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">{t("Gezin")}</span> : null}
                    </p>
                    <h3 className="mt-1 text-2xl">{t(maaltijd.custom_title ?? "Maaltijd")}</h3>
                    <span className="mt-5 flex min-h-14 items-center justify-center rounded-xl bg-secondary px-5 text-base font-semibold text-secondary-foreground">
                      {t("Bekijk je planning")}
                    </span>
                  </div>
                </Link>
              ),
            )}
          </div>
        ) : recipes.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-7" aria-hidden />}
            title={t("Je kookboek is nog leeg")}
            description={t("Bewaar een recept dat je lekker vindt.")}
            action={<Link to="/recepten/nieuw" className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground"><Plus className="size-5" />{t("Recept toevoegen")}</Link>}
          />
        ) : (
          <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground">
            <div className="p-6">
              <p className="text-sm font-semibold text-primary-foreground/75">{t("Nog niets gepland")}</p>
              <h3 className="mt-1 text-2xl">{t("Plan iets lekkers voor vandaag")}</h3>
              <Link to="/planner" className="mt-5 flex min-h-14 items-center justify-center rounded-xl bg-card px-5 font-semibold text-foreground">
                <CalendarDays className="size-5" /> {t("Plan je maaltijd")}
              </Link>
            </div>
          </section>
        )}

        <section aria-labelledby="vandaag-status">
          <h2 id="vandaag-status" className="text-xl">{t("Vandaag")}</h2>
          <div className="mt-3 divide-y divide-border rounded-2xl bg-card px-4 ring-1 ring-border/60">
            <Link to="/planner" className="flex min-h-16 items-center gap-3 py-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><CalendarDays className="size-5" /></span>
              <span className="min-w-0 flex-1 font-semibold">{maaltijden.length ? t("Je menu staat klaar") : t("Plan je week")}</span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
            <Link to="/boodschappen" className="flex min-h-16 items-center gap-3 py-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"><ShoppingCart className="size-5" /></span>
              <span className="min-w-0 flex-1 font-semibold">{openItems ? `${openItems} ${t(openItems === 1 ? "boodschap" : "boodschappen")}` : t("Je lijst is leeg")}</span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </div>
        </section>

        <NieuweSuggesties recipes={recipes} favorites={favorites} />

        {recent.length > 0 ? (
          <section aria-labelledby="favorieten-titel">
            <div className="flex items-center justify-between gap-4">
              <h2 id="favorieten-titel" className="text-xl">{t(favorites.length ? "Favorieten" : "Recent")}</h2>
              <Link to="/gerechten" className="font-semibold text-primary">{t("Alles bekijken")}</Link>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {recent.map((recipe) => (
                <li key={recipe.id}>
                  <Link to="/recepten/$id" params={{ id: recipe.id }} className="group block">
                    <div className="relative overflow-hidden rounded-xl">
                      <RecipePhoto path={recipe.image_url} alt={recipe.title} className="aspect-square w-full rounded-none transition-transform duration-300 group-hover:scale-[1.02]" />
                      {favorites.includes(recipe.id) ? <Heart className="absolute right-3 top-3 size-6 fill-card text-card drop-shadow" aria-label={t("Favoriet")} /> : null}
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">{t(recipe.title)}</h3>
                    {tijdLabel(recipe.prep_minutes, recipe.cook_minutes) ? <p className="mt-1 text-sm text-muted-foreground">{tijdLabel(recipe.prep_minutes, recipe.cook_minutes)}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
