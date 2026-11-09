import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Search, Clock, RotateCcw, Plus, Trash2, X, SlidersHorizontal } from "lucide-react";
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
import { soortLabel } from "@/lib/recept-keuzes";
import { Sterren, SterrenSnel } from "@/components/Sterren";
import { useT } from "@/lib/voorkeuren";
import { cn } from "@/lib/utils";
import { tijdLabel } from "@/lib/tijd";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .is("deleted_at", null)
        .eq("is_concept", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Recipe[];
    },
  });
  const { data: concepten = [] } = useQuery({
    queryKey: ["concepten", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, title, updated_at")
        .eq("user_id", user!.id)
        .eq("is_concept", true)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as { id: string; title: string; updated_at: string }[];
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
      const { data, error } = await supabase
        .from("recipe_ratings")
        .select("recipe_id, stars")
        .eq("user_id", user!.id);
      if (error) throw error;
      return Object.fromEntries(data.map((r) => [r.recipe_id, r.stars])) as Record<string, number>;
    },
  });

  async function bewaarScore(recipeId: string, n: number) {
    if (!user) return;
    const sleutel = ["ratings", user.id];
    const vorige = qc.getQueryData<Record<string, number>>(sleutel) ?? {};
    qc.setQueryData(sleutel, { ...vorige, [recipeId]: n });
    const { error } =
      n === 0
        ? await supabase.from("recipe_ratings").delete().eq("recipe_id", recipeId).eq("user_id", user.id)
        : await supabase
            .from("recipe_ratings")
            .upsert({ user_id: user.id, recipe_id: recipeId, stars: n }, { onConflict: "user_id,recipe_id" });
    if (error) {
      qc.setQueryData(sleutel, vorige);
      toast.error(t("Score bewaren lukte niet"));
      return;
    }
    qc.invalidateQueries({ queryKey: ["rating", recipeId] });
  }

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

  // V2: collecties als visuele ingangen (afgeleid van bestaande gegevens, geen nieuwe tabel).
  type Collectie = { id: string; titel: string; aantal: number; voorbeeld: Recipe | undefined; actief: boolean; kies: () => void };
  const collecties: Collectie[] = useMemo(() => {
    const eigen = recipes;
    const uit: Collectie[] = [];
    const fav = eigen.filter((r) => favorites.includes(r.id));
    uit.push({
      id: "favorieten",
      titel: "Favorieten",
      aantal: fav.length,
      voorbeeld: fav[0],
      actief: alleenFavorieten,
      kies: () => setAlleenFavorieten(!alleenFavorieten),
    });
    const snel = eigen.filter((r) => r.prep_minutes + r.cook_minutes <= 30);
    uit.push({
      id: "snel",
      titel: "Snel klaar",
      aantal: snel.length,
      voorbeeld: snel[0],
      actief: maxTijd === 30,
      kies: () => setMaxTijd(maxTijd === 30 ? 0 : 30),
    });
    for (const d of DIETEN) {
      const lijst = eigen.filter((r) => dieetPerRecept.get(r.id) === d);
      uit.push({
        id: `dieet-${d}`,
        titel: d.charAt(0).toUpperCase() + d.slice(1),
        aantal: lijst.length,
        voorbeeld: lijst[0],
        actief: dieet === d,
        kies: () => setDieet(dieet === d ? null : d),
      });
    }
    for (const c of CATEGORIES) {
      if (c === "hoofdgerecht") continue;
      const lijst = eigen.filter((r) => r.category === c);
      if (!lijst.length) continue;
      uit.push({
        id: `soort-${c}`,
        titel: soortLabel(c),
        aantal: lijst.length,
        voorbeeld: lijst[0],
        actief: categorie === c,
        kies: () => setCategorie(categorie === c ? null : c),
      });
    }
    return uit.filter((c) => c.aantal > 0);
  }, [recipes, favorites, alleenFavorieten, maxTijd, dieet, categorie, dieetPerRecept]);

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
      breed
      title={t("Recepten")}
      ondertitel={`${recipes.length} ${t(recipes.length === 1 ? "recept in je kookboek" : "recepten in je kookboek")}`}
    >
      <div className="space-y-4">
        <nav aria-label={t("Recepten of ideeën")} className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          <span aria-current="page" className="flex min-h-12 items-center justify-center rounded-full bg-card text-base font-semibold shadow-zacht">
            {t("Mijn recepten")}
          </span>
          <Link
            to="/inspiratie"
            className="flex min-h-12 items-center justify-center rounded-full text-base font-semibold text-muted-foreground hover:text-foreground"
          >
            {t("Ideeën om te koken")}
          </Link>
        </nav>
        {concepten.length > 0 ? (
          <section aria-label="Concepten" className="paneel p-3">
            <p className="px-1 text-base font-semibold text-muted-foreground">Nog niet klaar</p>
            <ul className="mt-2 space-y-2">
              {concepten.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/recepten/$id/bewerken"
                    params={{ id: c.id }}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-muted px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 truncate">Je was bezig met <strong>{c.title}</strong></span>
                    <span className="shrink-0 font-semibold text-primary">Verdergaan</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder={t("Zoek een recept…")}
            className="h-16 rounded-2xl border-0 bg-card pl-12 text-lg shadow-zacht ring-1 ring-border/60"
            aria-label={t("Zoeken")}
          />
        </div>

        {collecties.length ? (
          <section aria-labelledby="collecties-titel">
            <h2 id="collecties-titel" className="text-sectietitel">{t("Collecties")}</h2>
            {/* Tik op een collectie om ze te tonen; nog eens tikken zet ze uit. */}
            <ul className="scroll-rij relative -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-0">
              {collecties.map((c) => (
                <li key={c.id} className="w-36 shrink-0 lg:w-auto">
                  <button
                    type="button"
                    onClick={c.kies}
                    aria-pressed={c.actief}
                    className={cn(
                      "group relative block w-full overflow-hidden rounded-2xl text-left shadow-zacht outline-offset-2",
                      c.actief ? "ring-4 ring-primary" : "",
                    )}
                  >
                    <RecipePhoto
                      path={c.voorbeeld?.image_url ?? null}
                      alt=""
                      recept={c.voorbeeld ?? { title: c.titel }}
                      className="aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.04]"
                      icoonClassName="size-12"
                    />
                    {/* Donker verloop onderaan: witte tekst haalt voldoende contrast. */}
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" aria-hidden />
                    <span className="absolute inset-x-0 bottom-0 p-3 text-white">
                      <span className="block font-display text-xl font-semibold leading-tight">{t(c.titel)}</span>
                      <span className="block text-[0.9rem] text-white/90">
                        {c.aantal} {t(c.aantal === 1 ? "recept" : "recepten")}
                        {c.actief ? ` · ${t("gekozen")}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="space-y-2">
          <div className="grid grid-cols-3 rounded-full bg-muted p-1" role="group" aria-label={t("Van wie")}>
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
                  "min-h-12 whitespace-nowrap rounded-full px-1 text-[0.94rem] font-semibold transition-colors",
                  eigenaar === waarde
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
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
        </div>

        {filtersOpen ? <div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border/60">
          <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
            <FilterSelect
              label={t("Soort")}
              value={categorie ?? "alles"}
              onChange={(v) => setCategorie(v === "alles" ? null : v)}
              options={[
                { value: "alles", label: t("Alles") },
                ...CATEGORIES.map((c) => ({ value: c, label: t(soortLabel(c)) })),
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

        <p className="text-base text-muted-foreground">
          {zichtbaar.length} {t(zichtbaar.length === 1 ? "recept" : "recepten")}
        </p>

        {isLoading ? (
          <PageSkeleton rows={3} />
        ) : zichtbaar.length === 0 ? (
          <EmptyState icon={<Search className="size-7" />} title={t("Geen recepten gevonden")} description={t("Probeer een andere zoekterm of maak je filters leeg.")} action={<Button onClick={wisFilters}>{t("Filters wissen")}</Button>} />
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {zichtbaar.map((r) => (
              <li key={r.id} className="min-w-0">
                <SwipeRij onVerwijder={() => setTeVerwijderen(r)}>
                  <div className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-zacht transition-shadow hover:shadow-kaart">
                    <Link to="/recepten/$id" params={{ id: r.id }} className="block flex-1">
                      <div className="relative overflow-hidden">
                        <RecipePhoto
                          path={r.image_url}
                          alt={r.title}
                          recept={r}
                          className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                        {/* Favoriet als badge op het beeld: overlapt de titel nooit meer. */}
                        {favorites.includes(r.id) ? (
                          <span className="absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-card/95 shadow-zacht">
                            <Heart className="size-5 fill-terracotta text-terracotta" aria-label={t("Favoriet")} />
                          </span>
                        ) : null}
                        {/* Alleen afwijkende soorten tonen; "hoofdgerecht" is de standaard en zou ruis zijn. */}
                        {r.category && r.category !== "hoofdgerecht" ? (
                          <span className="absolute bottom-2 left-2 rounded-full bg-card/95 px-2.5 py-0.5 text-[0.9rem] font-semibold text-foreground shadow-zacht">
                            {t(soortLabel(r.category))}
                          </span>
                        ) : null}
                      </div>
                      <div className="p-3 pb-1">
                        <h2 className="line-clamp-2 text-kaarttitel">{t(r.title)}</h2>
                        {r.user_id !== user?.id && eigenaren[r.user_id] ? (
                          <p className="mt-1 text-base font-medium text-muted-foreground">
                            {t("van")} {eigenaren[r.user_id]}
                          </p>
                        ) : null}
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted-foreground">
                          {tijdLabel(r.prep_minutes, r.cook_minutes) ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-4" aria-hidden />
                              {tijdLabel(r.prep_minutes, r.cook_minutes)}
                            </span>
                          ) : null}
                          <span>
                            {r.servings} {t(r.servings === 1 ? "persoon" : "personen")}
                          </span>
                        </p>
                      </div>
                    </Link>
                    <div className="mt-auto px-1.5 pb-2">
                      <SterrenSnel waarde={scores[r.id] ?? 0} onKies={(n) => bewaarScore(r.id, n)} />
                    </div>
                  </div>
                </SwipeRij>
              </li>
            ))}
          </ul>
        )}
      </div>

      {teVerwijderen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="verwijder-titel"
            className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="verwijder-titel" className="font-display text-xl">{t("Zeker verwijderen?")}</h2>
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
        // Alleen bereikbaar als hij zichtbaar is (WCAG 2.4.11); anders via het receptmenu.
        tabIndex={dx === OPEN ? 0 : -1}
        aria-hidden={dx === OPEN ? undefined : true}
        className="absolute inset-y-0 right-0 flex w-22 flex-col items-center justify-center gap-1 rounded-r-2xl bg-destructive text-base font-semibold text-destructive-foreground"
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
        className="mb-0.5 block truncate text-base font-semibold uppercase tracking-wide text-muted-foreground"
        htmlFor={`filter-${label}`}
      >
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={`filter-${label}`} className="min-h-12 w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="min-h-12">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
