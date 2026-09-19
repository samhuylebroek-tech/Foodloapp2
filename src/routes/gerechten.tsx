import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Search, Clock, RotateCcw, Plus, Trash2, X, SlidersHorizontal, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { RecipePhoto } from "@/components/RecipePhoto";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, DIFFICULTIES, type Recipe } from "@/lib/types";
import { DIETEN, bepaalDieet } from "@/lib/dieet";
import { Sterren } from "@/components/Sterren";
import { useT } from "@/lib/voorkeuren";
import { cn } from "@/lib/utils";
import { tijdLabel } from "@/lib/tijd";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { NieuweSuggesties } from "@/components/NieuweSuggesties";
import { zoekScore, zoekWoorden } from "@/lib/zoeken";

export const Route = createFileRoute("/gerechten")({
  head: () => ({
    meta: [
      { title: "Alle gerechten – Foodlo" },
      {
        name: "description",
        content:
          "Verzamel samen recepten, zoek op ingrediënt of naam, plan je week en maak automatisch je boodschappenlijst.",
      },
      { property: "og:title", content: "Alle gerechten – Foodlo" },
      {
        property: "og:description",
        content: "Recepten verzamelen, plannen en koken. Groot, duidelijk en voor iedereen.",
      },
    ],
  }),
  component: GerechtenPage,
});

const TIJDEN = [
  { value: 20, label: "Tot 20 min" },
  { value: 30, label: "Tot 30 min" },
  { value: 60, label: "Tot 1 uur" },
] as const;

function GerechtenPage() {
  const { user } = useAuth();
  const t = useT();
  const qc = useQueryClient();
  const [zoek, setZoek] = useState("");
  const [categorie, setCategorie] = useState<string | null>(null);
  const [moeilijkheid, setMoeilijkheid] = useState<string | null>(null);
  const [dieet, setDieet] = useState<string | null>(null);
  const [maxTijd, setMaxTijd] = useState(0);
  const [alleenFavorieten, setAlleenFavorieten] = useState(false);
  const [eigenaar, setEigenaar] = useState<"alles" | "mij" | "vrienden">("alles");
  const [minSterren, setMinSterren] = useState(0);
  const [teVerwijderen, setTeVerwijderen] = useState<Recipe | null>(null);
  const [bezig, setBezig] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ideeenOpen, setIdeeenOpen] = useState(false);

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
      return data.map((f) => f.recipe_id as string);
    },
  });

  const { data: scores = {} } = useQuery({
    queryKey: ["ratings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("recipe_ratings").select("recipe_id, stars");
      if (error) throw error;
      return Object.fromEntries(data.map((r) => [r.recipe_id, r.stars])) as Record<string, number>;
    },
  });

  const { data: alleIngredienten = [] } = useQuery({
    queryKey: ["alle-ingredienten"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recipe_ingredients").select("recipe_id, name");
      if (error) throw error;
      return data as { recipe_id: string; name: string }[];
    },
  });

  const vreemdeIds = useMemo(
    () => [...new Set(recipes.filter((r) => r.user_id !== user?.id).map((r) => r.user_id))],
    [recipes, user?.id],
  );

  const { data: eigenaren = {} } = useQuery({
    queryKey: ["recept-eigenaren", vreemdeIds.join(",")],
    enabled: vreemdeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", vreemdeIds);
      if (error) throw error;
      return Object.fromEntries(data.map((p) => [p.id, p.display_name])) as Record<string, string>;
    },
  });

  const dieetPerRecept = useMemo(() => {
    const namen = new Map<string, string[]>();
    for (const rij of alleIngredienten) {
      const lijst = namen.get(rij.recipe_id) ?? [];
      lijst.push(rij.name);
      namen.set(rij.recipe_id, lijst);
    }
    const map = new Map<string, string>();
    for (const r of recipes) {
      map.set(r.id, bepaalDieet(r.title, r.tags, namen.get(r.id) ?? []));
    }
    return map;
  }, [recipes, alleIngredienten]);

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

  const ingredientenPerRecept = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rij of alleIngredienten) {
      const lijst = map.get(rij.recipe_id) ?? [];
      lijst.push(rij.name);
      map.set(rij.recipe_id, lijst);
    }
    return map;
  }, [alleIngredienten]);

  const zichtbaar = useMemo(() => {
    const woorden = zoekWoorden(zoek);
    const gefilterd = recipes.filter((r) => {
      if (eigenaar === "mij" && r.user_id !== user?.id) return false;
      if (eigenaar === "vrienden" && r.user_id === user?.id) return false;
      if (categorie && r.category !== categorie) return false;
      if (moeilijkheid && r.difficulty !== moeilijkheid) return false;
      if (dieet && dieetPerRecept.get(r.id) !== dieet) return false;
      if (maxTijd && r.prep_minutes + r.cook_minutes > maxTijd) return false;
      if (alleenFavorieten && !favorites.includes(r.id)) return false;
      if (minSterren && (scores[r.id] ?? 0) < minSterren) return false;
      return true;
    });
    if (!woorden.length) return gefilterd;

    return gefilterd
      .map((r) => ({
        r,
        score:
          zoekScore(
            {
              titel: r.title,
              beschrijving: r.description,
              labels: r.tags,
              soort: r.category,
              ingredienten: ingredientenPerRecept.get(r.id) ?? [],
            },
            woorden,
          ) || (ingredientMatches.includes(r.id) ? 1 : 0),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r);
  }, [
    recipes,
    zoek,
    eigenaar,
    user?.id,
    categorie,
    moeilijkheid,
    dieet,
    dieetPerRecept,
    maxTijd,
    alleenFavorieten,
    minSterren,
    scores,
    favorites,
    ingredientMatches,
    ingredientenPerRecept,
  ]);

  const actieveFilters =
    (categorie ? 1 : 0) +
    (moeilijkheid ? 1 : 0) +
    (dieet ? 1 : 0) +
    (maxTijd ? 1 : 0) +
    (minSterren ? 1 : 0) +
    (alleenFavorieten ? 1 : 0);

  function wisFilters() {
    setCategorie(null);
    setMoeilijkheid(null);
    setDieet(null);
    setMaxTijd(0);
    setMinSterren(0);
    setAlleenFavorieten(false);
  }

  async function verwijder(r: Recipe) {
    setBezig(true);
    const { error } = await supabase
      .from("recipes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", r.id);
    setBezig(false);
    if (error) {
      toast.error(t("Verwijderen lukte niet"));
      return;
    }
    toast.success(t("Gerecht verwijderd"));
    setTeVerwijderen(null);
    qc.invalidateQueries({ queryKey: ["recipes"] });
    qc.invalidateQueries({ queryKey: ["alle-ingredienten"] });
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
  }

  return (
    <AppShell
      title={t("Recepten")}
      action={
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="secondary"
            aria-label={t("Zoek nieuwe ideeën")}
            onClick={() => setIdeeenOpen(true)}
          >
            <Sparkles />
          </Button>
          <Button asChild size="icon" aria-label={t("Recept toevoegen")}>
            <Link to="/recepten/nieuw"><Plus /></Link>
          </Button>
        </div>
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
            placeholder={t("Zoek een recept…")}
            className="h-14 rounded-xl border-0 bg-card pl-12 text-base shadow-sm ring-1 ring-border/60"
            aria-label={t("Zoeken")}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <div className="flex shrink-0 rounded-full bg-secondary p-1" role="group" aria-label={t("Van wie")}>
            {(
              [
                ["alles", "Alles"],
                ["mij", "Van mij"],
                ["vrienden", "Van vrienden"],
              ] as const
            ).map(([waarde, label]) => (
              <button
                key={waarde}
                type="button"
                onClick={() => setEigenaar(waarde)}
                aria-pressed={eigenaar === waarde}
                className={cn(
                  "min-h-10 rounded-full px-4 text-sm font-semibold transition-colors",
                  eigenaar === waarde
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <Button
            variant={alleenFavorieten ? "default" : "secondary"}
            onClick={() => setAlleenFavorieten(!alleenFavorieten)}
            aria-pressed={alleenFavorieten}
          >
            <Heart className={cn(alleenFavorieten && "fill-current")} /> {t("Favorieten")}
          </Button>
          <Button variant={filtersOpen ? "default" : "outline"} onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}>
            <SlidersHorizontal /> {t("Filters")}{actieveFilters ? ` (${actieveFilters})` : ""}
          </Button>
        </div>

        {filtersOpen ? <div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border/60">
          <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
            <FilterSelect
              label={t("Soort")}
              value={categorie ?? "alles"}
              onChange={(v) => setCategorie(v === "alles" ? null : v)}
              options={[
                { value: "alles", label: t("Alles") },
                ...CATEGORIES.map((c) => ({ value: c, label: t(c) })),
              ]}
            />

            <FilterSelect
              label={t("Duurtijd")}
              value={String(maxTijd)}
              onChange={(v) => setMaxTijd(Number(v))}
              options={[
                { value: "0", label: t("Alles") },
                ...TIJDEN.map((tijd) => ({ value: String(tijd.value), label: t(tijd.label) })),
              ]}
            />

            <FilterSelect
              label={t("Moeilijkheid")}
              value={moeilijkheid ?? "alles"}
              onChange={(v) => setMoeilijkheid(v === "alles" ? null : v)}
              options={[
                { value: "alles", label: t("Alles") },
                ...DIFFICULTIES.map((d) => ({ value: d, label: t(d) })),
              ]}
            />

            <FilterSelect
              label={t("Vlees, vis of veggie")}
              value={dieet ?? "alles"}
              onChange={(v) => setDieet(v === "alles" ? null : v)}
              options={[
                { value: "alles", label: t("Alles") },
                ...DIETEN.map((d) => ({ value: d, label: t(d) })),
              ]}
            />

            <FilterSelect
              label={t("Score")}
              value={String(minSterren)}
              onChange={(v) => setMinSterren(Number(v))}
              options={[
                { value: "0", label: t("Alles") },
                { value: "5", label: "★★★★★" },
                { value: "4", label: `★★★★ ${t("en meer")}` },
                { value: "3", label: `★★★ ${t("en meer")}` },
                { value: "2", label: `★★ ${t("en meer")}` },
                { value: "1", label: `★ ${t("en meer")}` },
              ]}
            />

            {actieveFilters > 0 && (
              <Button variant="ghost" onClick={wisFilters} className="text-primary">
                <RotateCcw className="size-4" aria-hidden /> {t("Wissen")}
              </Button>
            )}
          </div>
        </div> : null}

        <p className="text-sm text-muted-foreground">
          {zichtbaar.length} {t(zichtbaar.length === 1 ? "gerecht" : "gerechten")}
        </p>

        {isLoading ? (
          <PageSkeleton rows={3} />
        ) : zichtbaar.length === 0 ? (
          <EmptyState icon={<Search className="size-7" />} title={t("Geen recepten gevonden")} description={t("Probeer een andere zoekterm of maak je filters leeg.")} action={<Button onClick={wisFilters}>{t("Filters wissen")}</Button>} />
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {zichtbaar.map((r) => (
              <li key={r.id}>
                <SwipeRij onVerwijder={() => setTeVerwijderen(r)}>
                  <Link
                    to="/recepten/$id"
                    params={{ id: r.id }}
                    className="group block overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/50 transition-shadow hover:shadow-md"
                  >
                    <RecipePhoto
                      path={r.image_url}
                      alt={r.title}
                      className="aspect-square w-full rounded-none transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="p-3">
                      <p className="flex items-start gap-2 font-display text-base font-semibold leading-snug">
                        <span className="min-w-0 flex-1">{t(r.title)}</span>
                        {favorites.includes(r.id) && (
                          <Heart
                            className="mt-0.5 size-5 shrink-0 fill-primary text-primary"
                            aria-label={t("Favoriet")}
                          />
                        )}
                      </p>
                      {r.user_id !== user?.id && eigenaren[r.user_id] ? (
                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                          {t("van")} {eigenaren[r.user_id]}
                        </p>
                      ) : null}
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        {tijdLabel(r.prep_minutes, r.cook_minutes) ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-4" aria-hidden />
                            {tijdLabel(r.prep_minutes, r.cook_minutes)}
                          </span>
                        ) : null}
                        <span>{r.servings} {t("personen")}</span>
                      </p>
                    </div>
                  </Link>
                </SwipeRij>
              </li>
            ))}
          </ul>
        )}
      </div>

      {ideeenOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center" role="dialog" aria-modal="true" aria-label={t("Zoek nieuwe ideeën")}>
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-background shadow-xl sm:rounded-3xl">
            <div className="flex items-center justify-between gap-3 px-5 pt-5">
              <h2 className="font-display text-xl">{t("Zoek nieuwe ideeën")}</h2>
              <Button
                variant="ghost"
                onClick={() => setIdeeenOpen(false)}
                aria-label={t("Sluiten")}
                className="size-12"
              >
                <X className="size-6" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              <NieuweSuggesties recipes={recipes} favorites={favorites} />
            </div>
          </div>
        </div>
      )}

      {teVerwijderen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-xl">{t("Zeker verwijderen?")}</h2>
              <Button
                variant="ghost"
                onClick={() => setTeVerwijderen(null)}
                aria-label={t("Sluiten")}
                className="size-12"
              >
                <X className="size-6" />
              </Button>
            </div>
            <p className="mt-2 text-base text-muted-foreground">
              {t("Je verwijdert")} “{t(teVerwijderen.title)}”. {t("Het staat ook niet meer in je weekmenu.")}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                disabled={bezig}
                onClick={() => setTeVerwijderen(null)}
                className="h-14 flex-1 text-base"
              >
                {t("Annuleren")}
              </Button>
              <Button
                variant="destructive"
                disabled={bezig}
                onClick={() => verwijder(teVerwijderen)}
                className="h-14 flex-1 text-base"
              >
                <Trash2 className="size-5" /> {t("Verwijderen")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SwipeRij({
  children,
  onVerwijder,
}: {
  children: React.ReactNode;
  onVerwijder: () => void;
}) {
  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  const OPEN = -88;

  function onStart(e: React.TouchEvent) {
    startX.current = e.touches[0]!.clientX;
  }

  function onMove(e: React.TouchEvent) {
    if (startX.current === null) return;
    const delta = e.touches[0]!.clientX - startX.current;
    setDx(Math.max(OPEN, Math.min(0, delta + (dx === OPEN ? OPEN : 0))));
  }

  function onEnd() {
    if (dx < OPEN / 2) setDx(OPEN);
    else setDx(0);
    startX.current = null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => {
          onVerwijder();
          setDx(0);
        }}
        aria-label="Verwijder dit gerecht"
        className="absolute inset-y-0 right-0 flex w-22 flex-col items-center justify-center gap-1 rounded-r-2xl bg-destructive text-sm font-semibold text-destructive-foreground"
      >
        <Trash2 className="size-6" aria-hidden />
      </button>
      <div
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        style={{ transform: `translateX(${dx}px)` }}
        className="relative transition-transform duration-150"
      >
        {children}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-0 sm:min-w-[8rem] sm:flex-1">
      <label
        className="mb-0.5 block truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        htmlFor={`filter-${label}`}
      >
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={`filter-${label}`}
          className="h-10 w-full rounded-lg border-border bg-card px-3 text-sm"
          aria-label={label}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-border bg-card text-sm">
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className="min-h-11 cursor-pointer text-base focus:bg-secondary"
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
