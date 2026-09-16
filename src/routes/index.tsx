import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, ChevronRight, Clock, Heart, Plus, Sparkles, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { RecipePhoto } from "@/components/RecipePhoto";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/lib/types";
import { useT } from "@/lib/voorkeuren";
import { tijdLabel } from "@/lib/tijd";
import {
  ontdekSuggesties,
  importRecipeFromText,
  gerechtFoto,
  type InternetSuggestie,
} from "@/lib/ai.functions";

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

  const { data: dagmenu } = useQuery({
    queryKey: ["home-dagmenu", user?.id, vandaag()],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("meal_plan")
        .select("id, custom_title, meal_type, recipe_id, recipes(*)")
        .eq("plan_date", vandaag())
        .order("meal_type")
        .limit(1)
        .maybeSingle();
      return data as { id: string; custom_title: string | null; meal_type: string; recipe_id: string | null; recipes: Recipe | null } | null;
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
  const gepland = dagmenu?.recipes;

  return (
    <AppShell title="Foodlo">
      <div className="space-y-9">
        <header>
          <p className="text-base font-medium text-muted-foreground">{t(groet(new Date().getHours()))}{naam ? `, ${naam}` : ""}</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">{t("Wat eten we vandaag?")}</h2>
        </header>

        {isLoading ? (
          <PageSkeleton rows={2} />
        ) : dagmenu ? (
          <section className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
            {gepland ? <RecipePhoto path={gepland.image_url} alt={gepland.title} className="aspect-[16/9] w-full rounded-none" /> : null}
            <div className="p-5 sm:p-6">
              <p className="text-sm font-semibold capitalize text-primary">{t(dagmenu.meal_type || "Vandaag")}</p>
              <h3 className="mt-1 text-2xl">{t(gepland?.title ?? dagmenu.custom_title ?? "Maaltijd")}</h3>
              {gepland ? (
                <>
                  <p className="mt-2 flex items-center gap-2 text-base text-muted-foreground">
                    {tijdLabel(gepland.prep_minutes, gepland.cook_minutes) ? <Clock className="size-5" aria-hidden /> : null}
                    {[tijdLabel(gepland.prep_minutes, gepland.cook_minutes), `${gepland.servings} ${t("personen")}`].filter(Boolean).join(" · ")}
                  </p>
                  <Link to="/recepten/$id" params={{ id: gepland.id }} className="mt-5 flex min-h-14 items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground transition-transform active:scale-[0.98]">
                    {t("Bekijk recept")}
                  </Link>
                </>
              ) : null}
            </div>
          </section>
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
              <span className="min-w-0 flex-1 font-semibold">{dagmenu ? t("Je menu staat klaar") : t("Plan je week")}</span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
            <Link to="/boodschappen" className="flex min-h-16 items-center gap-3 py-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground"><ShoppingCart className="size-5" /></span>
              <span className="min-w-0 flex-1 font-semibold">{openItems ? `${openItems} ${t(openItems === 1 ? "boodschap" : "boodschappen")}` : t("Je lijst is leeg")}</span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </div>
        </section>

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

        <section aria-labelledby="ideeen-titel" data-tour="ideeen">
          <h2 id="ideeen-titel" className="text-xl">{t("Zin in iets nieuws?")}</h2>
          {!ontdekAan ? (
            <div className="mt-3 rounded-2xl bg-card p-5 ring-1 ring-border/60">
              <p className="text-base text-muted-foreground">{t("Laat een paar verse ideeën zoeken op maat van wat jij lekker vindt.")}</p>
              <Button onClick={() => setOntdekAan(true)} className="mt-4 w-full sm:w-auto"><Sparkles />{t("Zoek nieuwe ideeën")}</Button>
            </div>
          ) : ideeenBezig ? (
            <p className="mt-3 text-base text-muted-foreground">{t("Even zoeken naar nieuwe ideeën…")}</p>
          ) : ideeen.length === 0 ? (
            <p className="mt-3 text-base text-muted-foreground">{t("Geen nieuwe suggesties gevonden. Probeer straks opnieuw.")}</p>
          ) : (
            <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
              {ideeen.map((s) => (
                <IdeeKaart key={s.title} s={s} t={t} bezig={bezig} onBewaar={() => void bewaarSuggestie(s)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function IdeeKaart({
  s,
  t,
  bezig,
  onBewaar,
}: {
  s: InternetSuggestie;
  t: (x: string) => string;
  bezig: string | null;
  onBewaar: () => void;
}) {
  const { data: foto } = useQuery({
    queryKey: ["gerecht-foto", s.title],
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    retry: false,
    queryFn: () => gerechtFoto({ data: { titel: s.title } }),
  });

  return (
    <li className="w-60 shrink-0 snap-start">
      <div className="flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/60">
        <div>
          {foto ? (
            <img src={foto} alt={s.title} className="h-32 w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-32 w-full animate-pulse bg-muted" aria-hidden />
          )}
          <div className="p-4">
            <p className="text-lg font-semibold leading-tight">{t(s.title)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {s.keuken ? `${t(s.keuken)} · ` : ""}
              {s.minuten} min
            </p>
            <p className="mt-2 line-clamp-3 text-base">{t(s.waarom)}</p>
          </div>
        </div>
        <div className="px-4 pb-4">
          <Button onClick={onBewaar} disabled={bezig !== null} className="w-full">
            <Plus />
            {bezig === s.title ? t("Bezig…") : t("Bewaar bij mijn recepten")}
          </Button>
        </div>
      </div>
    </li>
  );
}
