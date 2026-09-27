import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, ChevronRight, Clock, Heart, Plus, ShoppingCart, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { RecipePhoto } from "@/components/RecipePhoto";
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


  const eerste = maaltijden[0];
  const overige = maaltijden.slice(1);
  const datum = new Date().toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <AppShell title={`${t(groet(new Date().getHours()))}${naam ? `, ${naam}` : ""}`}>
      <div className="space-y-10">
        <section aria-labelledby="vandaag-titel">
          <p className="text-label text-muted-foreground">{datum}</p>
          <h2 id="vandaag-titel" className="mt-1 text-sectietitel">{t("Vandaag op het menu")}</h2>

          <div className="mt-4">
            {isLoading ? (
              <PageSkeleton rows={2} />
            ) : eerste ? (
              <div className="space-y-3">
                {eerste.recipes ? (
                  <Link
                    to="/recepten/$id"
                    params={{ id: eerste.recipes.id }}
                    className="block overflow-hidden rounded-2xl border border-border bg-card"
                    aria-label={`${t("Bekijk recept")}: ${eerste.recipes.title}`}
                  >
                    <RecipePhoto path={eerste.recipes.image_url} alt={eerste.recipes.title} className="aspect-[16/10] w-full rounded-none" />
                    <div className="p-5">
                      <p className="text-base font-semibold capitalize text-muted-foreground">
                        {t(eerste.meal_type || "Vandaag")}
                        {eerste.group_id ? ` · ${t("met het gezin")}` : ""}
                      </p>
                      <h3 className="mt-1 text-2xl font-bold leading-tight">{t(eerste.recipes.title)}</h3>
                      {tijdLabel(eerste.recipes.prep_minutes, eerste.recipes.cook_minutes) ? (
                        <p className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
                          <Clock className="size-5" aria-hidden />
                          {tijdLabel(eerste.recipes.prep_minutes, eerste.recipes.cook_minutes)} · {eerste.recipes.servings} {t("personen")}
                        </p>
                      ) : null}
                      <span className="mt-5 flex min-h-14 items-center justify-center rounded-xl bg-primary px-5 text-lg font-semibold text-primary-foreground">
                        {t("Recept openen")}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <MaaltijdRij to="/planner" moment={eerste.meal_type} titel={eerste.custom_title ?? "Maaltijd"} t={t} />
                )}
                {overige.map((m) =>
                  m.recipes ? (
                    <Link
                      key={m.id}
                      to="/recepten/$id"
                      params={{ id: m.recipes.id }}
                      className="flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-card p-3"
                    >
                      <RecipePhoto path={m.recipes.image_url} alt="" className="size-16 shrink-0 rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base capitalize text-muted-foreground">{t(m.meal_type)}</span>
                        <span className="block truncate text-lg font-semibold">{t(m.recipes.title)}</span>
                      </span>
                      <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  ) : (
                    <MaaltijdRij key={m.id} to="/planner" moment={m.meal_type} titel={m.custom_title ?? "Maaltijd"} t={t} />
                  ),
                )}
              </div>
            ) : recipes.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="size-7" aria-hidden />}
                title={t("Je kookboek is nog leeg")}
                description={t("Bewaar eerst een recept dat je lekker vindt. Daarna kan je het op je weekmenu zetten.")}
                action={<Link to="/recepten/nieuw" className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-primary px-6 text-lg font-semibold text-primary-foreground"><Plus className="size-5" />{t("Recept toevoegen")}</Link>}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-input bg-card p-6 text-center">
                <CalendarDays className="mx-auto size-8 text-primary" aria-hidden />
                <p className="mt-3 text-xl font-bold">{t("Er staat nog niets gepland")}</p>
                <p className="mt-1 text-base text-muted-foreground">{t("Kies een gerecht voor vandaag of voor de hele week.")}</p>
                <Link to="/planner" className="mt-5 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-lg font-semibold text-primary-foreground">
                  {t("Weekmenu maken")}
                </Link>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="snel-titel">
          <h2 id="snel-titel" className="text-sectietitel">{t("Verder met")}</h2>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            <SnelRij to="/boodschappen" icon={ShoppingCart} titel={t("Boodschappen")} uitleg={openItems ? `${openItems} ${t(openItems === 1 ? "ding nog te kopen" : "dingen nog te kopen")}` : t("Je lijst is leeg")} />
            <SnelRij to="/planner" icon={CalendarDays} titel={t("Weekmenu")} uitleg={t("Bekijk of plan je week")} />
            <SnelRij to="/inspiratie" icon={Sparkles} titel={t("Ideeën om te koken")} uitleg={t("Zoek iets nieuws om te maken")} />
          </ul>
        </section>

        {recent.length > 0 ? (
          <section aria-labelledby="favorieten-titel">
            <div className="flex items-end justify-between gap-4">
              <h2 id="favorieten-titel" className="text-sectietitel">{t(favorites.length ? "Je favorieten" : "Laatst toegevoegd")}</h2>
              <Link to="/gerechten" className="flex min-h-12 items-center text-base font-semibold text-primary">{t("Alle recepten")}</Link>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {recent.map((recipe) => (
                <li key={recipe.id}>
                  <Link to="/recepten/$id" params={{ id: recipe.id }} className="group block">
                    <div className="relative overflow-hidden rounded-xl">
                      <RecipePhoto path={recipe.image_url} alt={recipe.title} className="aspect-square w-full rounded-none" />
                      {favorites.includes(recipe.id) ? <Heart className="absolute right-3 top-3 size-6 fill-card text-card drop-shadow" aria-label={t("Favoriet")} /> : null}
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">{t(recipe.title)}</h3>
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

function SnelRij({ to, icon: Icon, titel, uitleg }: { to: "/boodschappen" | "/planner" | "/inspiratie"; icon: typeof ShoppingCart; titel: string; uitleg: string }) {
  return (
    <li>
      <Link to={to} className="flex min-h-20 items-center gap-4 px-4 py-3 hover:bg-muted">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">{titel}</span>
          <span className="block truncate text-base text-muted-foreground">{uitleg}</span>
        </span>
        <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function MaaltijdRij({ to, moment, titel, t }: { to: "/planner"; moment: string; titel: string; t: (s: string) => string }) {
  return (
    <Link to={to} className="flex min-h-20 items-center gap-4 rounded-2xl border border-border bg-card p-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <CalendarDays className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base capitalize text-muted-foreground">{t(moment || "Vandaag")}</span>
        <span className="block truncate text-lg font-semibold">{t(titel)}</span>
      </span>
      <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
