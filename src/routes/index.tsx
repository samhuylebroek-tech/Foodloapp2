import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChefHat,
  ChevronRight,
  Clock,
  Heart,
  Plus,
  Refrigerator,
  ShoppingCart,
  Sparkles,
  Users,
} from "lucide-react";
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
      {
        name: "description",
        content: "Zie wat er vandaag op het menu staat en ga meteen aan de slag.",
      },
      { property: "og:title", content: "Foodlo – wat eten we vandaag?" },
      {
        property: "og:description",
        content: "Je recepten, weekmenu en boodschappen rustig bij elkaar.",
      },
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

function isoDag(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function vandaag() {
  return isoDag(new Date());
}

/** Maandag t/m zondag van de huidige week (lokale tijd). */
function dezeWeek(): string[] {
  const nu = new Date();
  nu.setHours(12, 0, 0, 0);
  const maandag = new Date(nu);
  maandag.setDate(nu.getDate() - ((nu.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(maandag);
    d.setDate(maandag.getDate() + i);
    return isoDag(d);
  });
}

type WeekRij = {
  id: string;
  plan_date: string;
  meal_type: string;
  custom_title: string | null;
  recipes: Pick<Recipe, "id" | "title" | "image_url" | "category" | "tags"> | null;
};

function StartPage() {
  const { user } = useAuth();
  const t = useT();

  const { data: profiel } = useQuery({
    queryKey: ["home-profiel", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user?.id ?? "")
        .maybeSingle();
      return data;
    },
  });

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
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
      return (data ?? []) as {
        id: string;
        custom_title: string | null;
        meal_type: string;
        recipe_id: string | null;
        group_id: string | null;
        recipes: Recipe | null;
      }[];
    },
  });
  const { data: openItems = 0 } = useQuery({
    queryKey: ["home-shopping", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Tel dezelfde lijst die Boodschappen standaard opent, zodat de aantallen overeenkomen.
      const { data: eerste } = await supabase
        .from("shopping_lists")
        .select("id")
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (!eerste) return 0;
      const { count } = await supabase
        .from("shopping_items")
        .select("id", { count: "exact", head: true })
        .eq("checked", false)
        .eq("list_id", eerste.id);
      return count ?? 0;
    },
  });
  const week = useMemo(() => dezeWeek(), []);
  const { data: weekmenu = [] } = useQuery({
    queryKey: ["home-week", user?.id, week[0]],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("meal_plan")
        .select(
          "id, plan_date, meal_type, custom_title, recipes(id, title, image_url, category, tags)",
        )
        .gte("plan_date", week[0]!)
        .lte("plan_date", week[6]!)
        .order("plan_date");
      return (data ?? []) as unknown as WeekRij[];
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
  const datumHoofdletter = datum.charAt(0).toUpperCase() + datum.slice(1);
  const vandaagIso = vandaag();
  const weekPerDag = week.map((d) => ({ datum: d, rijen: weekmenu.filter((m) => m.plan_date === d) }));
  const geplandDezeWeek = weekPerDag.filter((d) => d.rijen.length).length;
  const groetTekst = `${t(groet(new Date().getHours()))}${naam ? `, ${naam}` : ""}`;
  const [uitgelicht, ...rest] = recent;

  // Redactionele band: datum, groet en wat er vandaag op tafel komt.
  const kop = (
    <section
      aria-labelledby="vandaag-groet"
      className="relative mb-10 overflow-hidden rounded-[2rem] bg-inkt text-inkt-foreground shadow-kaart"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="flex flex-col p-6 sm:p-8 lg:p-10">
          <p className="flex items-center gap-2 text-base font-medium text-inkt-zacht">
            <CalendarDays className="size-5" aria-hidden />
            {datumHoofdletter}
          </p>
          <h1 id="vandaag-groet" className="mt-2 text-paginatitel text-inkt-foreground">
            {groetTekst}
          </h1>

          <div className="mt-8 lg:mt-auto lg:pt-10">
            {isLoading ? (
              <p className="text-lg text-inkt-zacht">{t("Even kijken wat er op het menu staat…")}</p>
            ) : eerste?.recipes ? (
              <>
                <p className="text-base font-semibold uppercase tracking-[0.12em] text-[var(--honing)]">
                  {t(eerste.meal_type ? `${eerste.meal_type} vandaag` : "Vandaag op tafel")}
                  {eerste.group_id ? ` · ${t("met het gezin")}` : ""}
                </p>
                <h2 className="mt-2 text-heldentitel text-inkt-foreground">{t(eerste.recipes.title)}</h2>
                <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-base text-inkt-zacht">
                  {tijdLabel(eerste.recipes.prep_minutes, eerste.recipes.cook_minutes) ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-5" aria-hidden />
                      {tijdLabel(eerste.recipes.prep_minutes, eerste.recipes.cook_minutes)}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-5" aria-hidden />
                    {eerste.recipes.servings} {t(eerste.recipes.servings === 1 ? "persoon" : "personen")}
                  </span>
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/recepten/$id"
                    params={{ id: eerste.recipes.id }}
                    search={{ koken: true }}
                    className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-inkt-foreground px-6 text-lg font-semibold text-inkt hover:bg-inkt-foreground/90"
                  >
                    <ChefHat className="size-6" aria-hidden />
                    {t("Start koken")}
                  </Link>
                  <Link
                    to="/recepten/$id"
                    params={{ id: eerste.recipes.id }}
                    className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-inkt-foreground/40 px-6 text-lg font-semibold text-inkt-foreground hover:bg-white/10"
                  >
                    {t("Bekijk recept")}
                  </Link>
                </div>
              </>
            ) : eerste ? (
              <>
                <p className="text-base font-semibold uppercase tracking-[0.12em] text-[var(--honing)]">
                  {t(eerste.meal_type || "Vandaag")}
                </p>
                <h2 className="mt-2 text-heldentitel text-inkt-foreground">{t(eerste.custom_title ?? "Maaltijd")}</h2>
                <Link
                  to="/planner"
                  className="mt-6 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-inkt-foreground px-6 text-lg font-semibold text-inkt"
                >
                  {t("Naar het weekmenu")}
                  <ArrowRight className="size-5" aria-hidden />
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-heldentitel text-inkt-foreground">{t("Wat eten we vandaag?")}</h2>
                <p className="mt-3 max-w-md text-lg text-inkt-zacht">
                  {recipes.length
                    ? t("Er staat nog niets gepland. Kies een gerecht uit je recepten.")
                    : t("Bewaar eerst een recept dat je lekker vindt. Daarna kan je het inplannen.")}
                </p>
                <Link
                  to={recipes.length ? "/planner" : "/recepten/nieuw"}
                  className="mt-6 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-inkt-foreground px-6 text-lg font-semibold text-inkt"
                >
                  <Plus className="size-5" aria-hidden />
                  {recipes.length ? t("Gerecht kiezen") : t("Recept toevoegen")}
                </Link>
              </>
            )}
          </div>
        </div>

        {eerste?.recipes ? (
          <Link
            to="/recepten/$id"
            params={{ id: eerste.recipes.id }}
            tabIndex={-1}
            aria-hidden
            className="relative block min-h-56 overflow-hidden lg:min-h-full"
          >
            <RecipePhoto
              path={eerste.recipes.image_url}
              alt=""
              recept={eerste.recipes}
              className="absolute inset-0 size-full"
              icoonClassName="size-28 max-h-28 max-w-28"
            />
          </Link>
        ) : (
          <div className="omslag omslag-groen hidden min-h-56 lg:block" aria-hidden />
        )}
      </div>
    </section>
  );

  return (
    <AppShell breed title={groetTekst} kop={kop}>
      <div className="space-y-12">
        {overige.length ? (
          <section aria-labelledby="ook-vandaag">
            <h2 id="ook-vandaag" className="text-sectietitel">{t("Ook vandaag")}</h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {overige.map((m) => (
                <li key={m.id}>
                  {m.recipes ? (
                    <Link
                      to="/recepten/$id"
                      params={{ id: m.recipes.id }}
                      className="flex min-h-20 items-center gap-4 rounded-2xl bg-card p-3 shadow-zacht hover:shadow-kaart"
                    >
                      <RecipePhoto path={m.recipes.image_url} alt="" recept={m.recipes} className="size-16 shrink-0 rounded-xl" icoonClassName="size-8" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base capitalize text-muted-foreground">{t(m.meal_type)}</span>
                        <span className="block truncate text-lg font-semibold">{t(m.recipes.title)}</span>
                      </span>
                      <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  ) : (
                    <MaaltijdRij to="/planner" moment={m.meal_type} titel={m.custom_title ?? "Maaltijd"} t={t} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="week-titel">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="week-titel" className="text-sectietitel">{t("Deze week")}</h2>
              <p className="mt-1 text-base text-muted-foreground">
                {geplandDezeWeek
                  ? `${geplandDezeWeek} ${t(geplandDezeWeek === 1 ? "dag gepland" : "dagen gepland")}`
                  : t("Nog niets gepland deze week.")}
              </p>
            </div>
            <Link to="/planner" className="flex min-h-12 shrink-0 items-center gap-1 text-base font-semibold text-primary">
              {t("Weekmenu")}
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          </div>
          {/* `relative`: verborgen schermlezertekst (sr-only) blijft binnen de scrollstrook. */}
          <ul className="scroll-rij relative -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-3 pt-1 lg:mx-0 lg:grid lg:grid-cols-7 lg:overflow-visible lg:px-0">
            {weekPerDag.map(({ datum: d, rijen }) => {
              const dag = new Date(`${d}T12:00:00`);
              const isVandaag = d === vandaagIso;
              const eersteRij = rijen.find((r) => r.recipes) ?? rijen[0];
              const titel = eersteRij?.recipes?.title ?? eersteRij?.custom_title ?? null;
              const kort = dag.toLocaleDateString("nl-BE", { weekday: "short" }).replace(".", "");
              return (
                <li key={d} className="w-[8.75rem] shrink-0 lg:w-auto">
                  <Link
                    to="/planner"
                    className={[
                      "flex h-full min-h-40 flex-col overflow-hidden rounded-2xl transition-shadow hover:shadow-kaart",
                      isVandaag ? "bg-inkt text-inkt-foreground shadow-kaart" : "bg-card shadow-zacht",
                    ].join(" ")}
                  >
                    <span className="flex items-baseline justify-between px-3 pt-2.5">
                      <span className={isVandaag ? "text-base font-semibold uppercase tracking-wide text-inkt-zacht" : "text-base font-semibold uppercase tracking-wide text-muted-foreground"}>
                        {isVandaag ? t("Vandaag") : kort}
                      </span>
                      <span className="text-xl font-bold">{dag.getDate()}</span>
                    </span>
                    {eersteRij?.recipes ? (
                      <RecipePhoto path={eersteRij.recipes.image_url} alt="" recept={eersteRij.recipes} className="mx-2 mt-2 aspect-[4/3] rounded-xl" icoonClassName="size-10" />
                    ) : (
                      <span className={isVandaag ? "mx-2 mt-2 flex aspect-[4/3] items-center justify-center rounded-xl border-2 border-dashed border-inkt-foreground/30" : "mx-2 mt-2 flex aspect-[4/3] items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground"}>
                        <Plus className="size-6" aria-hidden />
                      </span>
                    )}
                    <span className="line-clamp-2 px-3 pb-3 pt-2 text-base font-semibold leading-snug">
                      {titel ? t(titel) : <span className={isVandaag ? "font-medium text-inkt-zacht" : "font-medium text-muted-foreground"}>{t("Nog vrij")}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="slim-titel" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <h2 id="slim-titel" className="sr-only">{t("Snel verder")}</h2>
          <Link
            to="/boodschappen"
            className="group flex min-h-28 items-center gap-4 rounded-3xl bg-terracotta-zacht p-5 hover:shadow-kaart"
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-card text-terracotta shadow-zacht">
              <ShoppingCart className="size-7" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl font-semibold">{t("Boodschappen")}</span>
              <span className="block text-base text-foreground/80">
                {openItems ? `${openItems} ${t(openItems === 1 ? "ding nog te kopen" : "dingen nog te kopen")}` : t("Je lijst is leeg")}
              </span>
            </span>
            <ArrowRight className="size-6 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
          <Link
            to="/voorraad"
            className="group flex min-h-28 items-center gap-4 rounded-3xl bg-secondary p-5 hover:shadow-kaart"
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-zacht">
              <Refrigerator className="size-7" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-2xl font-semibold">{t("Wat kan ik koken?")}</span>
              <span className="block text-base text-foreground/80">{t("Met wat je al in huis hebt")}</span>
            </span>
            <ArrowRight className="size-6 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        </section>

        {uitgelicht ? (
          <section aria-labelledby="favorieten-titel">
            <div className="flex items-end justify-between gap-4">
              <h2 id="favorieten-titel" className="text-sectietitel">{t(favorites.length ? "Je favorieten" : "Laatst toegevoegd")}</h2>
              <Link to="/gerechten" className="flex min-h-12 shrink-0 items-center gap-1 text-base font-semibold text-primary">
                {t("Alle recepten")}
                <ChevronRight className="size-5" aria-hidden />
              </Link>
            </div>
            {/* Magazine-indeling: één groot uitgelicht recept, de rest kleiner. */}
            <ul className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[uitgelicht, ...rest].map((recipe, i) => (
                <li key={recipe.id} className={i === 0 ? "col-span-2 lg:row-span-2" : ""}>
                  <Link to="/recepten/$id" params={{ id: recipe.id }} className="group block">
                    <div className="relative overflow-hidden rounded-2xl shadow-zacht">
                      <RecipePhoto
                        path={recipe.image_url}
                        alt={recipe.title}
                        recept={recipe}
                        className={i === 0 ? "aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-[1.03] lg:aspect-[5/4]" : "aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.03]"}
                      />
                      {favorites.includes(recipe.id) ? (
                        <span className="absolute right-2.5 top-2.5 flex size-9 items-center justify-center rounded-full bg-card/95 shadow-zacht">
                          <Heart className="size-5 fill-terracotta text-terracotta" aria-label={t("Favoriet")} />
                        </span>
                      ) : null}
                    </div>
                    <h3 className={i === 0 ? "mt-3 text-heldentitel" : "mt-2.5 line-clamp-2 text-kaarttitel"}>{t(recipe.title)}</h3>
                    {tijdLabel(recipe.prep_minutes, recipe.cook_minutes) ? (
                      <p className="mt-1 flex items-center gap-1.5 text-base text-muted-foreground">
                        <Clock className="size-4" aria-hidden />
                        {tijdLabel(recipe.prep_minutes, recipe.cook_minutes)}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : recipes.length === 0 && !isLoading ? (
          <EmptyState
            icon={<BookOpen className="size-7" aria-hidden />}
            title={t("Je kookboek is nog leeg")}
            description={t("Bewaar eerst een recept dat je lekker vindt. Daarna kan je het op je weekmenu zetten.")}
            action={<Link to="/recepten/nieuw" className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-primary px-6 text-lg font-semibold text-primary-foreground"><Plus className="size-5" />{t("Recept toevoegen")}</Link>}
          />
        ) : null}

        <section aria-labelledby="ideeen-titel" className="flex flex-col items-start gap-4 rounded-3xl bg-[var(--honing-zacht)] p-6 sm:flex-row sm:items-center">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-card text-[var(--honing-foreground)] shadow-zacht">
            <Sparkles className="size-7" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="ideeen-titel" className="font-display text-2xl font-semibold">{t("Zin in iets nieuws?")}</h2>
            <p className="text-base text-[var(--honing-foreground)]">{t("Bekijk ideeën om te koken en bewaar wat je lekker lijkt.")}</p>
          </div>
          <Link to="/inspiratie" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-card px-5 text-base font-semibold shadow-zacht">
            {t("Ideeën bekijken")}
            <ArrowRight className="size-5" aria-hidden />
          </Link>
        </section>
      </div>
    </AppShell>
  );
}

function MaaltijdRij({ to, moment, titel, t }: { to: "/planner"; moment: string; titel: string; t: (s: string) => string }) {
  return (
    <Link to={to} className="flex min-h-20 items-center gap-4 rounded-2xl bg-card p-4 shadow-zacht">
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
