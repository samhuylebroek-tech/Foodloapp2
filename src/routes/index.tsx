import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Clock,
  Globe2,
  Heart,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Timer,
  CalendarDays,
  ChevronRight,
  Compass,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { RecipePhoto } from "@/components/RecipePhoto";
import type { Recipe } from "@/lib/types";
import { haalWeer, sfeerVoorWeer, type Weer } from "@/lib/weer";
import { gezienIds } from "@/lib/gezien";
import { useT } from "@/lib/voorkeuren";
import { ontdekSuggesties, importRecipeFromText, type InternetSuggestie } from "@/lib/ai.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Samen Koken – wat eten we vandaag?" },
      {
        name: "description",
        content:
          "Elke dag verse kookinspiratie: suggesties op maat van het weer, je nieuwste recepten en het gerecht van de dag.",
      },
      { property: "og:title", content: "Samen Koken – wat eten we vandaag?" },
      {
        property: "og:description",
        content: "Kookinspiratie op maat van het weer, met je eigen recepten in de kijker.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StartPage,
});

function groet(uur: number) {
  if (uur < 6) return "Nog wakker?";
  if (uur < 11) return "Goeiemorgen";
  if (uur < 14) return "Smakelijk middagje";
  if (uur < 18) return "Goeiemiddag";
  if (uur < 22) return "Goeieavond";
  return "Late trek?";
}

function dagIndex(lengte: number) {
  if (lengte === 0) return 0;
  const d = new Date();
  const getal = d.getFullYear() * 400 + (d.getMonth() + 1) * 31 + d.getDate();
  return getal % lengte;
}

function StartPage() {
  const { user } = useAuth();
  const t = useT();
  const [weer, setWeer] = useState<Weer | null>(null);
  const [weerKlaar, setWeerKlaar] = useState(false);
  const [gezien, setGezien] = useState<string[]>([]);

  useEffect(() => {
    setGezien(gezienIds());
  }, []);

  useEffect(() => {
    let actief = true;
    haalWeer().then((w) => {
      if (!actief) return;
      setWeer(w);
      setWeerKlaar(true);
    });
    return () => {
      actief = false;
    };
  }, []);

  const { data: recipes = [], isLoading } = useQuery({
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

  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("recipe_id");
      if (error) throw error;
      return data.map((f) => f.recipe_id as string);
    },
  });

  const sfeer = weer ? sfeerVoorWeer(weer) : null;

  const weerTips = useMemo(() => {
    if (!sfeer) return [];
    const scoor = (r: Recipe) => {
      const tekst = `${r.title} ${r.tags.join(" ")} ${r.description}`.toLowerCase();
      let score = 0;
      if (sfeer.categorieen.includes(r.category)) score += 2;
      for (const w of sfeer.woorden) if (tekst.includes(w)) score += 3;
      return score;
    };
    return [...recipes]
      .map((r) => ({ r, s: scoor(r) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.r);
  }, [recipes, sfeer]);

  // Gerechten die je nog niet bekeek: eerst die van vrienden, dan je eigen oudere recepten.
  const ontdek = useMemo(() => {
    const nietGezien = recipes.filter((r) => !gezien.includes(r.id) && !favorites.includes(r.id));
    const vanVrienden = nietGezien.filter((r) => r.user_id !== user?.id);
    const eigen = nietGezien.filter((r) => r.user_id === user?.id);
    return [...vanVrienden, ...eigen].slice(0, 8);
  }, [recipes, gezien, favorites, user?.id]);

  const nieuwste = recipes.slice(0, 8);
  const vandaag = recipes.length ? recipes[dagIndex(recipes.length)] : null;
  const snel = recipes.filter((r) => r.prep_minutes + r.cook_minutes <= 20).slice(0, 8);
  const favorietenLijst = recipes.filter((r) => favorites.includes(r.id)).slice(0, 8);

  const uur = new Date().getHours();

  // Nieuwe gerechten van het internet die nog niet in je kookboek staan.
  const bekend = useMemo(() => recipes.map((r) => r.title), [recipes]);
  const bekendSleutel = bekend.length;
  const [ronde, setRonde] = useState(0);
  const {
    data: internet = [],
    isLoading: internetLaadt,
    isFetching: internetVerst,
  } = useQuery({
    queryKey: ["internet-suggesties", bekendSleutel, sfeer?.titel ?? "", ronde],
    enabled: !!user && weerKlaar,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const lijst = await ontdekSuggesties({
        data: { bekend, sfeer: sfeer ? `${sfeer.titel} – ${sfeer.uitleg}` : "" },
      });
      const bestaand = new Set(bekend.map((tt) => tt.toLowerCase().trim()));
      return lijst.filter((s) => !bestaand.has(s.title.toLowerCase().trim()));
    },
  });

  const navigate = useNavigate();
  const [bezig, setBezig] = useState<string | null>(null);

  async function bewaarSuggestie(s: InternetSuggestie) {
    if (!user) return;
    setBezig(s.title);
    try {
      const ai = await importRecipeFromText({
        data: { text: `Geef een volledig recept voor: ${s.title}. ${s.keuken ? `Keuken: ${s.keuken}.` : ""} ${s.waarom}` },
      });
      const { data, error } = await supabase
        .from("recipes")
        .insert({
          user_id: user.id,
          title: ai.title || s.title,
          description: ai.description || s.waarom,
          servings: ai.servings || 4,
          prep_minutes: ai.prep_minutes || 0,
          cook_minutes: ai.cook_minutes || 0,
          category: ai.category || s.category,
          difficulty: ai.difficulty || "makkelijk",
          tags: ai.tags ?? [],
          instructions: ai.instructions ?? [],
        })
        .select("id")
        .single();
      if (error) throw error;
      if (ai.ingredients?.length) {
        await supabase.from("recipe_ingredients").insert(
          ai.ingredients.map((i, index) => ({
            recipe_id: data.id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit ?? "",
            position: index,
          })),
        );
      }
      toast.success(t("Toegevoegd aan je gerechten"));
      navigate({ to: "/recepten/$id", params: { id: data.id } });
    } catch {
      toast.error(t("Toevoegen lukte niet, probeer opnieuw"));
    } finally {
      setBezig(null);
    }
  }

  return (
    <AppShell title={t("Samen Koken")}>
      <div className="space-y-8">
        {/* Groet + weer */}
        <section className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-5">
            <p className="font-display text-3xl leading-tight">
              {t(groet(uur))}
              {user?.email ? "" : ""}!
            </p>
            <p className="mt-1 text-lg text-muted-foreground">{t("Wat eten we vandaag?")}</p>

            {weerKlaar && weer && sfeer && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-card/80 p-4">
                <span className="text-4xl" aria-hidden>
                  {sfeer.emoji}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold">
                    {t(sfeer.titel)} · {weer.temperatuur}°C
                  </p>
                  <p className="text-base text-muted-foreground">{t(sfeer.uitleg)}</p>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/recepten/nieuw"
                className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground"
              >
                <Plus className="size-5" aria-hidden /> {t("Nieuw recept")}
              </Link>
              <Link
                to="/gerechten"
                className="inline-flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-card px-5 text-base font-semibold"
              >
                <Search className="size-5" aria-hidden /> {t("Alle gerechten")}
              </Link>
              <Link
                to="/planner"
                className="inline-flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-card px-5 text-base font-semibold"
              >
                <CalendarDays className="size-5" aria-hidden /> {t("Weekmenu")}
              </Link>
            </div>
          </div>
        </section>

        {isLoading ? (
          <p className="py-10 text-center text-lg text-muted-foreground">{t("Even laden…")}</p>
        ) : recipes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-8 text-center">
            <p className="font-display text-2xl">{t("Nog niets in jullie kookboek")}</p>
            <p className="mt-2 text-lg text-muted-foreground">
              {t("Voeg een eerste gerecht toe met een link, een foto of gewoon zelf getypt.")}
            </p>
            <Link
              to="/recepten/nieuw"
              className="mt-5 inline-flex h-14 items-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
            >
              {t("Eerste recept toevoegen")}
            </Link>
          </div>
        ) : (
          <>
            {ontdek.length > 0 && (
              <Rij
                titel={t("Nog niet geproefd")}
                recepten={ontdek}
                t={t}
                icoon={<Compass className="size-5" aria-hidden />}
              />
            )}

            {/* Gerecht van de dag */}
            {vandaag && (
              <section>
                <SectieTitel icoon={<Sparkles className="size-5" aria-hidden />}>
                  {t("In de kijker vandaag")}
                </SectieTitel>
                <Link
                  to="/recepten/$id"
                  params={{ id: vandaag.id }}
                  className="block overflow-hidden rounded-3xl border border-border bg-card active:opacity-90"
                >
                  <RecipePhoto
                    path={vandaag.image_url}
                    alt={vandaag.title}
                    className="h-48 w-full rounded-none sm:h-64"
                  />
                  <div className="p-4">
                    <p className="font-display text-2xl leading-tight">{t(vandaag.title)}</p>
                    <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">
                      <Clock className="size-4" aria-hidden />
                      {vandaag.prep_minutes + vandaag.cook_minutes} min · {t(vandaag.category)} ·{" "}
                      {t(vandaag.difficulty)}
                    </p>
                    {vandaag.description && (
                      <p className="mt-2 line-clamp-2 text-base">{t(vandaag.description)}</p>
                    )}
                  </div>
                </Link>
              </section>
            )}

            {weerTips.length > 0 && sfeer && (
              <Rij
                titel={`${sfeer.emoji} ${t("Past bij het weer")}`}
                recepten={weerTips}
                t={t}
              />
            )}

            <Rij
              titel={t("Net toegevoegd")}
              recepten={nieuwste}
              t={t}
              icoon={<Plus className="size-5" aria-hidden />}
            />

            {snel.length > 0 && (
              <Rij
                titel={t("Klaar in 20 minuten")}
                recepten={snel}
                t={t}
                icoon={<Timer className="size-5" aria-hidden />}
              />
            )}

            {favorietenLijst.length > 0 && (
              <Rij
                titel={t("Jullie favorieten")}
                recepten={favorietenLijst}
                t={t}
                icoon={<Heart className="size-5" aria-hidden />}
              />
            )}

            <Link
              to="/gerechten"
              className="flex min-h-16 items-center justify-between rounded-2xl border border-border bg-card px-5 text-lg font-semibold"
            >
              {t("Bekijk alle gerechten")}
              <ChevronRight className="size-6" aria-hidden />
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}

function SectieTitel({ children, icoon }: { children: React.ReactNode; icoon?: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-display text-2xl">
      {icoon}
      {children}
    </h2>
  );
}

function Rij({
  titel,
  recepten,
  t,
  icoon,
}: {
  titel: string;
  recepten: Recipe[];
  t: (s: string) => string;
  icoon?: React.ReactNode;
}) {
  if (recepten.length === 0) return null;
  return (
    <section>
      <SectieTitel icoon={icoon}>{titel}</SectieTitel>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {recepten.map((r) => (
          <li key={r.id} className="w-44 shrink-0 snap-start sm:w-52">
            <Link
              to="/recepten/$id"
              params={{ id: r.id }}
              className="block h-full overflow-hidden rounded-2xl border border-border bg-card active:opacity-90"
            >
              <RecipePhoto path={r.image_url} alt={r.title} className="h-28 w-full rounded-none" />
              <div className="p-3">
                <p className="line-clamp-2 font-display text-lg leading-tight">{t(r.title)}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="size-4" aria-hidden />
                  {r.prep_minutes + r.cook_minutes} min
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
