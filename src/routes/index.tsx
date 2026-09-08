import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, Search, Clock, LogOut, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { RecipePhoto } from "@/components/RecipePhoto";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CATEGORIES, DIFFICULTIES, type Recipe } from "@/lib/types";
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
  { value: 0, label: "Alle tijden" },
  { value: 20, label: "Tot 20 minuten" },
  { value: 30, label: "Tot 30 minuten" },
  { value: 60, label: "Tot 1 uur" },
] as const;

const SORTERING = [
  { value: "nieuw", label: "Nieuwste eerst" },
  { value: "naam", label: "Op naam" },
  { value: "snel", label: "Snelste eerst" },
] as const;

function HomePage() {
  const { user } = useAuth();
  const [zoek, setZoek] = useState("");
  const [categorie, setCategorie] = useState<string | null>(null);
  const [moeilijkheid, setMoeilijkheid] = useState<string | null>(null);
  const [maxTijd, setMaxTijd] = useState(0);
  const [maxPersonen, setMaxPersonen] = useState<number | null>(null);
  const [alleenFavorieten, setAlleenFavorieten] = useState(false);
  const [alleenVanMij, setAlleenVanMij] = useState(false);
  const [sortering, setSortering] = useState<string>("nieuw");
  const [label, setLabel] = useState<string | null>(null);

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

  const labels = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => r.tags.forEach((t) => t && set.add(t)));
    return [...set].sort().slice(0, 20);
  }, [recipes]);

  const zichtbaar = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    const lijst = recipes.filter((r) => {
      if (categorie && r.category !== categorie) return false;
      if (moeilijkheid && r.difficulty !== moeilijkheid) return false;
      if (maxTijd && r.prep_minutes + r.cook_minutes > maxTijd) return false;
      if (maxPersonen && r.servings < maxPersonen) return false;
      if (label && !r.tags.includes(label)) return false;
      if (alleenFavorieten && !favorites.includes(r.id)) return false;
      if (alleenVanMij && r.user_id !== user?.id) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some((t) => t.includes(q)) ||
        ingredientMatches.includes(r.id)
      );
    });

    if (sortering === "naam") return [...lijst].sort((a, b) => a.title.localeCompare(b.title));
    if (sortering === "snel")
      return [...lijst].sort(
        (a, b) => a.prep_minutes + a.cook_minutes - (b.prep_minutes + b.cook_minutes),
      );
    return lijst;
  }, [
    recipes,
    zoek,
    categorie,
    moeilijkheid,
    maxTijd,
    maxPersonen,
    label,
    alleenFavorieten,
    alleenVanMij,
    sortering,
    favorites,
    ingredientMatches,
    user?.id,
  ]);

  const actieveFilters =
    (categorie ? 1 : 0) +
    (moeilijkheid ? 1 : 0) +
    (maxTijd ? 1 : 0) +
    (maxPersonen ? 1 : 0) +
    (label ? 1 : 0) +
    (alleenFavorieten ? 1 : 0) +
    (alleenVanMij ? 1 : 0);

  function wisFilters() {
    setCategorie(null);
    setMoeilijkheid(null);
    setMaxTijd(0);
    setMaxPersonen(null);
    setLabel(null);
    setAlleenFavorieten(false);
    setAlleenVanMij(false);
  }

  const filters = (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl">Filters</h2>
        {actieveFilters > 0 && (
          <button
            type="button"
            onClick={wisFilters}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-base font-semibold text-primary"
          >
            <RotateCcw className="size-4" aria-hidden /> Wissen
          </button>
        )}
      </div>

      <FilterGroep titel="Soort gerecht">
        <Chip active={categorie === null} onClick={() => setCategorie(null)}>
          Alles
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={categorie === c} onClick={() => setCategorie(c)}>
            {c}
          </Chip>
        ))}
      </FilterGroep>

      <FilterGroep titel="Hoeveel tijd heb je?">
        {TIJDEN.map((t) => (
          <Chip key={t.value} active={maxTijd === t.value} onClick={() => setMaxTijd(t.value)}>
            {t.label}
          </Chip>
        ))}
      </FilterGroep>

      <FilterGroep titel="Moeilijkheid">
        <Chip active={moeilijkheid === null} onClick={() => setMoeilijkheid(null)}>
          Alles
        </Chip>
        {DIFFICULTIES.map((d) => (
          <Chip key={d} active={moeilijkheid === d} onClick={() => setMoeilijkheid(d)}>
            {d}
          </Chip>
        ))}
      </FilterGroep>

      <FilterGroep titel="Voor hoeveel personen">
        <Chip active={maxPersonen === null} onClick={() => setMaxPersonen(null)}>
          Maakt niet uit
        </Chip>
        {[2, 4, 6].map((n) => (
          <Chip key={n} active={maxPersonen === n} onClick={() => setMaxPersonen(n)}>
            {n} of meer
          </Chip>
        ))}
      </FilterGroep>

      {labels.length > 0 && (
        <FilterGroep titel="Labels">
          <Chip active={label === null} onClick={() => setLabel(null)}>
            Alles
          </Chip>
          {labels.map((t) => (
            <Chip key={t} active={label === t} onClick={() => setLabel(t)}>
              {t}
            </Chip>
          ))}
        </FilterGroep>
      )}

      <FilterGroep titel="Van wie">
        <Chip active={alleenFavorieten} onClick={() => setAlleenFavorieten(!alleenFavorieten)}>
          <Heart className="size-4" aria-hidden /> Favorieten
        </Chip>
        <Chip active={alleenVanMij} onClick={() => setAlleenVanMij(!alleenVanMij)}>
          Alleen van mij
        </Chip>
      </FilterGroep>

      <div>
        <Label htmlFor="sorteer" className="text-base">
          Volgorde
        </Label>
        <select
          id="sorteer"
          value={sortering}
          onChange={(e) => setSortering(e.target.value)}
          className="mt-2 h-14 w-full rounded-xl border border-input bg-card px-3 text-base"
        >
          {SORTERING.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <AppShell
      title="Recepten"
      sidebar={filters}
      action={
        <Button
          variant="ghost"
          onClick={() => supabase.auth.signOut()}
          className="h-12"
          aria-label="Afmelden"
        >
          <LogOut className="size-5" />
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op gerecht of ingrediënt"
            className="h-14 pl-12 text-base"
            aria-label="Zoeken"
          />
        </div>

        <p className="text-base text-muted-foreground">
          {zichtbaar.length} recept{zichtbaar.length === 1 ? "" : "en"}
          {actieveFilters > 0 ? " (gefilterd)" : ""}
        </p>

        {isLoading ? (
          <p className="py-10 text-center text-lg text-muted-foreground">Recepten laden…</p>
        ) : zichtbaar.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-8 text-center">
            <p className="text-lg">Nog geen recepten gevonden.</p>
            <Link
              to="/recepten/nieuw"
              className="mt-4 inline-flex h-14 items-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
            >
              Eerste recept toevoegen
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
                    <p className="truncate font-display text-xl">{r.title}</p>
                    <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">
                      <Clock className="size-4" aria-hidden />
                      {r.prep_minutes + r.cook_minutes} min · {r.category} · {r.difficulty}
                    </p>
                  </div>
                  {favorites.includes(r.id) && (
                    <Heart className="size-6 fill-primary text-primary" aria-label="Favoriet" />
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

function FilterGroep({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-base font-semibold">{titel}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
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
