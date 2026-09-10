import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Search, Clock, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { RecipePhoto } from "@/components/RecipePhoto";
import { Input } from "@/components/ui/input";
import { CATEGORIES, DIFFICULTIES, type Recipe } from "@/lib/types";
import { useT } from "@/lib/voorkeuren";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Samen Koken – jullie recepten op één plek" },
      {
        name: "description",
        content:
          "Verzamel samen recepten, zoek op ingrediënt of naam, plan je week en maak automatisch je boodschappenlijst.",
      },
      { property: "og:title", content: "Samen Koken – jullie recepten op één plek" },
      {
        property: "og:description",
        content: "Recepten verzamelen, plannen en koken. Groot, duidelijk en voor iedereen.",
      },
    ],
  }),
  component: HomePage,
});

const TIJDEN = [
  { value: 20, label: "Tot 20 min" },
  { value: 30, label: "Tot 30 min" },
  { value: 60, label: "Tot 1 uur" },
] as const;

function HomePage() {
  const { user } = useAuth();
  const t = useT();
  const [zoek, setZoek] = useState("");
  const [categorie, setCategorie] = useState<string | null>(null);
  const [moeilijkheid, setMoeilijkheid] = useState<string | null>(null);
  const [maxTijd, setMaxTijd] = useState(0);
  const [alleenFavorieten, setAlleenFavorieten] = useState(false);

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

  const { data: ingredientMatches = [] } = useQuery({
    queryKey: ["ingredient-search", zoek],
    enabled: zoek.trim().length > 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id")
        .ilike("name", `%${zoek.trim()}%`);
      if (error) throw error;
      return data.map((r) => r.recipe_id as string);
    },
  });

  const zichtbaar = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return recipes.filter((r) => {
      if (categorie && r.category !== categorie) return false;
      if (moeilijkheid && r.difficulty !== moeilijkheid) return false;
      if (maxTijd && r.prep_minutes + r.cook_minutes > maxTijd) return false;
      if (alleenFavorieten && !favorites.includes(r.id)) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some((tag) => tag.includes(q)) ||
        ingredientMatches.includes(r.id)
      );
    });
  }, [
    recipes,
    zoek,
    categorie,
    moeilijkheid,
    maxTijd,
    alleenFavorieten,
    favorites,
    ingredientMatches,
  ]);

  const actieveFilters =
    (categorie ? 1 : 0) + (moeilijkheid ? 1 : 0) + (maxTijd ? 1 : 0) + (alleenFavorieten ? 1 : 0);

  function wisFilters() {
    setCategorie(null);
    setMoeilijkheid(null);
    setMaxTijd(0);
    setAlleenFavorieten(false);
  }

  return (
    <AppShell title={t("Gerechten")}>
      <div className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder={t("Zoek op gerecht of ingrediënt")}
            className="h-14 pl-12 text-base"
            aria-label={t("Zoeken")}
          />
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
          <FilterRij titel={t("Soort")}>
            <Chip active={!categorie} onClick={() => setCategorie(null)}>
              {t("Alles")}
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                active={categorie === c}
                onClick={() => setCategorie(categorie === c ? null : c)}
              >
                {t(c)}
              </Chip>
            ))}
          </FilterRij>

          <FilterRij titel={t("Duurtijd")}>
            <Chip active={!maxTijd} onClick={() => setMaxTijd(0)}>
              {t("Alles")}
            </Chip>
            {TIJDEN.map((tijd) => (
              <Chip
                key={tijd.value}
                active={maxTijd === tijd.value}
                onClick={() => setMaxTijd(maxTijd === tijd.value ? 0 : tijd.value)}
              >
                {t(tijd.label)}
              </Chip>
            ))}
          </FilterRij>

          <FilterRij titel={t("Moeilijkheid")}>
            <Chip active={!moeilijkheid} onClick={() => setMoeilijkheid(null)}>
              {t("Alles")}
            </Chip>
            {DIFFICULTIES.map((d) => (
              <Chip
                key={d}
                active={moeilijkheid === d}
                onClick={() => setMoeilijkheid(moeilijkheid === d ? null : d)}
              >
                {t(d)}
              </Chip>
            ))}
            <Chip active={alleenFavorieten} onClick={() => setAlleenFavorieten(!alleenFavorieten)}>
              <Heart className="size-4" aria-hidden /> {t("Favorieten")}
            </Chip>
          </FilterRij>

          {actieveFilters > 0 && (
            <button
              type="button"
              onClick={wisFilters}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-base font-semibold text-primary"
            >
              <RotateCcw className="size-4" aria-hidden /> {t("Filters wissen")}
            </button>
          )}
        </div>

        <p className="text-base text-muted-foreground">
          {zichtbaar.length} {t(zichtbaar.length === 1 ? "gerecht" : "gerechten")}
        </p>

        {isLoading ? (
          <p className="py-10 text-center text-lg text-muted-foreground">{t("Recepten laden…")}</p>
        ) : zichtbaar.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-8 text-center">
            <p className="text-lg">{t("Nog geen recepten gevonden.")}</p>
            <Link
              to="/recepten/nieuw"
              className="mt-4 inline-flex h-14 items-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
            >
              {t("Eerste recept toevoegen")}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {zichtbaar.map((r) => (
              <li key={r.id}>
                <Link
                  to="/recepten/$id"
                  params={{ id: r.id }}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 active:bg-secondary"
                >
                  <RecipePhoto path={r.image_url} alt={r.title} className="size-20 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xl">{t(r.title)}</p>
                    <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">
                      <Clock className="size-4" aria-hidden />
                      {r.prep_minutes + r.cook_minutes} min · {t(r.category)} · {t(r.difficulty)}
                    </p>
                  </div>
                  {favorites.includes(r.id) && (
                    <Heart className="size-6 fill-primary text-primary" aria-label={t("Favoriet")} />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function FilterRij({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-base font-semibold">{titel}</p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-base font-semibold",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground",
      )}
    >
      {children}
    </button>
  );
}
