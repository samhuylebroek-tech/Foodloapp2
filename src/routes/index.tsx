import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, ChevronRight, Clock, Heart, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { zichtbareEigenaren } from "@/lib/zichtbare-eigenaren";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { NuKaart } from "@/components/vandaag/NuKaart";
import { Daarna } from "@/components/vandaag/Daarna";
import { WegwijsKaart } from "@/components/vandaag/WegwijsKaart";
import { WeerSignaal } from "@/components/vandaag/WeerSignaal";
import { haalGedeeldeAanvulling, useAanvulling } from "@/hooks/useAanvulling";
import { leesVoortgang } from "@/lib/kookstand";
import { hoofdStap, signalen as signalenVan } from "@/lib/vandaag";
import { laadVandaag } from "@/lib/vandaag-db";
import { EmptyState } from "@/components/EmptyState";
import { RecipePhoto } from "@/components/RecipePhoto";
import type { Recipe } from "@/lib/types";
import { useT, useVoorkeuren } from "@/lib/voorkeuren";
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
  const { weekmenu: weekmenuVoorkeur } = useVoorkeuren();
  const etenstijden = weekmenuVoorkeur.etenstijden;

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
      // Tweede laag naast RLS (BUG-105): nooit recepten van onbekenden.
      const eigenaren = await zichtbareEigenaren();
      if (!eigenaren.length) return [];
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .in("user_id", eigenaren)
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
  // WP3: alles wat Vandaag moet weten (alleen lezen). Sleutel begint met "home-dagmenu",
  // zodat elke menu- of lijstwijziging (die dat ververst) ook deze stand ververst.
  const qc = useQueryClient();
  const { data: stand, isLoading: standLaden } = useQuery({
    queryKey: ["home-dagmenu", "stand", user?.id, vandaag()],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: () =>
      laadVandaag(user!.id, vandaag(), {
        // Zelfde cache als de aanvulkaart: gelijktijdig = één verzoek, nooit een oude stand.
        aanvulling: () => haalGedeeldeAanvulling(qc, user!.id),
      }),
  });
  const aanvulling = useAanvulling();
  const [zetBezig, setZetBezig] = useState(false);
  const stap = useMemo(() => {
    if (!stand) return null;
    const voortgang: Record<string, number | null> = {};
    for (const m of stand.vandaag)
      if (m.recept) voortgang[m.recept.id] = leesVoortgang(m.recept.id, m.recept.stappen);
    return hoofdStap({
      ...stand,
      nu: new Date(),
      voortgang,
      heeftRecepten: recipes.length > 0,
      etenstijden,
    });
  }, [stand, recipes.length, etenstijden]);
  const signalen = useMemo(
    () =>
      stand && stap
        ? signalenVan({ ...stand, nu: new Date(), voortgang: {}, heeftRecepten: true }, stap)
        : [],
    [stand, stap],
  );
  async function zetOpLijst(welke: Set<string> | "alles") {
    setZetBezig(true);
    try {
      await aanvulling.zetOpLijst(welke);
    } finally {
      setZetBezig(false);
    }
  }

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

  // De maaltijd in de Nu-kaart staat niet nog eens onder "Ook vandaag".
  const inNuKaart =
    stap && "maaltijd" in stap && stap.soort !== "morgen" ? stap.maaltijd?.id : null;
  const overige = maaltijden.filter((m) => m.id !== inNuKaart);
  const datum = new Date().toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const datumHoofdletter = datum.charAt(0).toUpperCase() + datum.slice(1);
  const vandaagIso = vandaag();
  const weekPerDag = week.map((d) => ({
    datum: d,
    rijen: weekmenu.filter((m) => m.plan_date === d),
  }));
  const geplandDezeWeek = weekPerDag.filter((d) => d.rijen.length).length;
  const groetTekst = `${t(groet(new Date().getHours()))}${naam ? `, ${naam}` : ""}`;
  const [uitgelicht, ...rest] = recent;

  // WP3: één kaart met wat nú telt en één knop (beslissing in lib/vandaag.ts).
  const kop = (
    <NuKaart
      stap={stap}
      datum={datumHoofdletter}
      groet={groetTekst}
      laden={isLoading || standLaden}
      recepten={recipes}
      bezig={zetBezig}
      onZetOpLijst={() => void zetOpLijst(new Set(stand?.sleutelsVandaag ?? []))}
    />
  );

  return (
    <AppShell breed title={groetTekst} kop={kop}>
      <div className="space-y-12">
        {/* Werkstroom F: klein, optioneel weersignaal (testgegevens tot er een weerdienst is). */}
        <WeerSignaal />
        <WegwijsKaart />
        {/* Tablet en groter: "Daarna" en "Ook vandaag" naast elkaar; alleen één? Dan volle breedte. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 md:grid-cols-2 md:gap-8 md:[&>*:only-child]:col-span-2">
          {/* Daarna: hooguit drie signalen, nooit wat de Nu-kaart al zegt. */}
          <Daarna
            signalen={signalen}
            bezig={zetBezig}
            onAanvullen={() => void zetOpLijst("alles")}
          />
          {overige.length ? (
            <section aria-labelledby="ook-vandaag">
              <h2 id="ook-vandaag" className="text-sectietitel">
                {t("Ook vandaag")}
              </h2>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1">
                {overige.map((m) => (
                  <li key={m.id}>
                    {m.recipes ? (
                      <Link
                        to="/recepten/$id"
                        params={{ id: m.recipes.id }}
                        className="flex min-h-20 items-center gap-4 rounded-2xl bg-card p-3 shadow-zacht hover:shadow-kaart"
                      >
                        <RecipePhoto
                          path={m.recipes.image_url}
                          alt=""
                          recept={m.recipes}
                          className="size-16 shrink-0 rounded-xl"
                          icoonClassName="size-8"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-base capitalize text-muted-foreground">
                            {t(m.meal_type)}
                          </span>
                          <span className="block truncate text-lg font-semibold">
                            {t(m.recipes.title)}
                          </span>
                        </span>
                        <ChevronRight
                          className="size-6 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </Link>
                    ) : (
                      <MaaltijdRij
                        to="/planner"
                        moment={m.meal_type}
                        titel={m.custom_title ?? "Maaltijd"}
                        t={t}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <section aria-labelledby="week-titel">
          {/* BUG-126: bij grote tekst op een smal scherm gaat "Weekmenu" onder de titel. */}
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <h2 id="week-titel" className="text-sectietitel">
                {t("Deze week")}
              </h2>
              <p className="mt-1 text-base text-muted-foreground">
                {geplandDezeWeek
                  ? `${geplandDezeWeek} ${t(geplandDezeWeek === 1 ? "dag gepland" : "dagen gepland")}`
                  : t("Nog niets gepland deze week.")}
              </p>
            </div>
            <Link
              to="/planner"
              className="flex min-h-12 shrink-0 items-center gap-1 text-base font-semibold text-primary"
            >
              {t("Weekmenu")}
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          </div>
          {/* `relative`: verborgen schermlezertekst (sr-only) blijft binnen de scrollstrook. */}
          <ul className="scroll-rij relative -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-3 pt-1 xl:mx-0 xl:grid xl:grid-cols-7 xl:overflow-visible xl:px-0">
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
                      isVandaag
                        ? "bg-inkt text-inkt-foreground shadow-kaart"
                        : "bg-card shadow-zacht",
                    ].join(" ")}
                  >
                    <span className="flex items-baseline justify-between px-3 pt-2.5">
                      <span
                        className={
                          isVandaag
                            ? "text-base font-semibold uppercase tracking-wide text-inkt-zacht"
                            : "text-base font-semibold uppercase tracking-wide text-muted-foreground"
                        }
                      >
                        {isVandaag ? t("Vandaag") : kort}
                      </span>
                      <span className="text-xl font-bold">{dag.getDate()}</span>
                    </span>
                    {eersteRij?.recipes ? (
                      <RecipePhoto
                        path={eersteRij.recipes.image_url}
                        alt=""
                        recept={eersteRij.recipes}
                        className="mx-2 mt-2 aspect-[4/3] rounded-xl"
                        icoonClassName="size-10"
                      />
                    ) : (
                      <span
                        className={
                          isVandaag
                            ? "mx-2 mt-2 flex aspect-[4/3] items-center justify-center rounded-xl border-2 border-dashed border-inkt-foreground/30"
                            : "mx-2 mt-2 flex aspect-[4/3] items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground"
                        }
                      >
                        <Plus className="size-6" aria-hidden />
                      </span>
                    )}
                    <span className="line-clamp-2 px-3 pb-3 pt-2 text-base font-semibold leading-snug">
                      {titel ? (
                        t(titel)
                      ) : (
                        <span
                          className={
                            isVandaag
                              ? "font-medium text-inkt-zacht"
                              : "font-medium text-muted-foreground"
                          }
                        >
                          {t("Nog vrij")}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {uitgelicht ? (
          <section aria-labelledby="favorieten-titel">
            <div className="flex flex-wrap items-end justify-between gap-x-4">
              <h2 id="favorieten-titel" className="text-sectietitel">
                {t(favorites.length ? "Je favorieten" : "Laatst toegevoegd")}
              </h2>
              <Link
                to="/gerechten"
                className="flex min-h-12 shrink-0 items-center gap-1 text-base font-semibold text-primary"
              >
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
                        opschrift
                        className={
                          i === 0
                            ? "aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-[1.03] lg:aspect-[5/4]"
                            : "aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.03]"
                        }
                      />
                      {favorites.includes(recipe.id) ? (
                        <span className="absolute right-2.5 top-2.5 flex size-9 items-center justify-center rounded-full bg-card/95 shadow-zacht">
                          <Heart
                            className="size-5 fill-terracotta text-terracotta"
                            aria-label={t("Favoriet")}
                          />
                        </span>
                      ) : null}
                    </div>
                    <h3
                      className={
                        i === 0 ? "mt-3 text-heldentitel" : "mt-2.5 line-clamp-2 text-kaarttitel"
                      }
                    >
                      {t(recipe.title)}
                    </h3>
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
            description={t(
              "Bewaar eerst een recept dat je lekker vindt. Daarna kan je het op je weekmenu zetten.",
            )}
            action={
              <Link
                to="/recepten/nieuw"
                className="inline-flex min-h-14 items-center gap-2 rounded-xl bg-primary px-6 text-lg font-semibold text-primary-foreground"
              >
                <Plus className="size-5" />
                {t("Recept toevoegen")}
              </Link>
            }
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function MaaltijdRij({
  to,
  moment,
  titel,
  t,
}: {
  to: "/planner";
  moment: string;
  titel: string;
  t: (s: string) => string;
}) {
  return (
    <Link to={to} className="flex min-h-20 items-center gap-4 rounded-2xl bg-card p-4 shadow-zacht">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <CalendarDays className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base capitalize text-muted-foreground">
          {t(moment || "Vandaag")}
        </span>
        <span className="block truncate text-lg font-semibold">{t(titel)}</span>
      </span>
      <ChevronRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
