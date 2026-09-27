import { useEffect, useState } from "react";
import { markeerGezien } from "@/lib/gezien";
import { meet } from "@/lib/meten";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChefHat,
  Clock,
  Heart,
  Loader2,
  Minus,
  Pencil,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
  CalendarPlus,
  MoreHorizontal,
  Share2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { zorgVoorLijst, voegToeAanLijst, type ShoppingList } from "@/lib/boodschappen";
import { useAuth } from "@/hooks/useAuth";
import { SterrenKiezer } from "@/components/Sterren";
import { AppShell } from "@/components/AppShell";
import { RecipePhoto } from "@/components/RecipePhoto";
import { FotoKiezer } from "@/components/FotoKiezer";
import { isAfbeelding, uploadRecipePhoto } from "@/lib/photos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importRecipeFromText } from "@/lib/ai.functions";
import { useT, useVoorkeuren } from "@/lib/voorkeuren";
import { CATEGORIES, DIFFICULTIES, type Ingredient, type Recipe } from "@/lib/types";
import { Copy } from "lucide-react";
import { tijdLabel } from "@/lib/tijd";
import { Voedingswaarden } from "@/components/Voedingswaarden";
import { StapIngredienten } from "@/components/StapIngredienten";
import { koppelStappen, toonHoeveelheid } from "@/lib/stap-ingredienten";
import { netteStap } from "@/lib/tekst-opkuis";
import { toonBelgischeMaat } from "@/lib/ingredienten";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageSkeleton } from "@/components/PageSkeleton";
import { DEMO_INGREDIENTEN, DEMO_RECEPTEN, demoBericht, isDemo } from "@/lib/demo";


export const Route = createFileRoute("/recepten/$id")({
  head: () => ({
    meta: [
      { title: "Recept – Foodlo" },
      {
        name: "description",
        content:
          "Bekijk het recept met ingrediënten voor jouw aantal personen, en kook stap voor stap mee.",
      },
      { property: "og:title", content: "Recept – Foodlo" },
      { property: "og:description", content: "Ingrediënten, stappen en kookstand in één scherm." },
    ],
  }),
  component: ReceptPage,
});

/** Vriendelijke naam van de website waar dit recept vandaan komt. */
function bronNaam(url: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (h.includes("instagram")) return "Instagram";
    if (h.includes("tiktok")) return "TikTok";
    if (h.includes("youtube") || h.includes("youtu.be")) return "YouTube";
    if (h.includes("facebook") || h.includes("fb.watch")) return "Facebook";
    if (h.includes("pinterest") || h.includes("pin.it")) return "Pinterest";
    return h;
  } catch {
    return "de bron";
  }
}


function ReceptPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const t = useT();
  const { momenten } = useVoorkeuren();
  const [personen, setPersonen] = useState<number | null>(null);
  const [kookstand, setKookstand] = useState(false);
  const [stap, setStap] = useState(0);
  const [klaarVragen, setKlaarVragen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [aanvullen, setAanvullen] = useState(false);
  const [fotoBezig, setFotoBezig] = useState(false);
  const [boodschappenOpen, setBoodschappenOpen] = useState(false);
  const [gekozenLijst, setGekozenLijst] = useState("");

  async function vervangFoto(bestand: File) {
    if (!user) { if (demo) demoBericht(); return; }
    if (!isAfbeelding(bestand)) {
      toast.error(t("Kies een foto (jpg of png)"));
      return;
    }
    setFotoBezig(true);
    try {
      const pad = await uploadRecipePhoto(bestand, user.id);
      const { error } = await supabase.from("recipes").update({ image_url: pad }).eq("id", id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["recipe", id] });
      await qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success(t("Foto bewaard"));
    } catch {
      toast.error(t("De foto kon niet worden opgeslagen. Probeer het opnieuw."));
    } finally {
      setFotoBezig(false);
    }
  }

  useEffect(() => {
    markeerGezien(id);
    void meet("recept.bekeken", undefined, { id });
  }, [id]);


  const { data, isLoading } = useQuery({
    queryKey: ["recipe", id],
    queryFn: async () => {
      const [recipeRes, ingRes] = await Promise.all([
        supabase.from("recipes").select("*").eq("id", id).single(),
        supabase
          .from("recipe_ingredients")
          .select("*")
          .eq("recipe_id", id)
          .order("position", { ascending: true }),
      ]);
      if (recipeRes.error) throw recipeRes.error;
      if (ingRes.error) throw ingRes.error;
      return { recipe: recipeRes.data as Recipe, ingredients: ingRes.data as Ingredient[] };
    },
  });

  const { data: isFavorite = false } = useQuery({
    queryKey: ["favorite", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("favorites").select("recipe_id").eq("recipe_id", id);
      return (data?.length ?? 0) > 0;
    },
  });

  const { data: mijnScore = 0 } = useQuery({
    queryKey: ["rating", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("recipe_ratings")
        .select("stars")
        .eq("recipe_id", id)
        .maybeSingle();
      return data?.stars ?? 0;
    },
  });

  const { data: boodschappenLijsten = [] } = useQuery({
    queryKey: ["shopping-lists", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      await zorgVoorLijst(user.id);
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("id, name, created_at, group_id")
        .order("created_at");
      if (error) throw error;
      return data as ShoppingList[];
    },
  });

  useEffect(() => {
    if (!gekozenLijst && boodschappenLijsten[0]) setGekozenLijst(boodschappenLijsten[0].id);
  }, [boodschappenLijsten, gekozenLijst]);

  // Op welke boodschappenlijsten staan de ingrediënten van dit recept al?
  const { data: lijstenMetRecept = [] } = useQuery({
    queryKey: ["op-lijst", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("shopping_items")
        .select("list_id")
        .eq("recipe_id", id)
        .limit(1);
      return [...new Set((data ?? []).map((rij) => rij.list_id as string))];
    },
  });
  const staatOpLijst = gekozenLijst ? lijstenMetRecept.includes(gekozenLijst) : false;
  const [vraagNogmaals, setVraagNogmaals] = useState(false);


  async function zetScore(n: number) {
    if (!user) { if (demo) demoBericht(); return; }
    const { error } = await supabase
      .from("recipe_ratings")
      .upsert({ user_id: user.id, recipe_id: id, stars: n }, { onConflict: "user_id,recipe_id" });
    if (error) {
      toast.error("Score bewaren lukte niet");
      return;
    }
    qc.invalidateQueries({ queryKey: ["rating", id] });
    qc.invalidateQueries({ queryKey: ["ratings"] });
  }

  if (isLoading || !data) {
    return (
      <AppShell title="Recept">
        <PageSkeleton rows={3} />
      </AppShell>
    );
  }

  const { recipe, ingredients } = data;
  const aantal = personen ?? recipe.servings;
  const factor = recipe.servings > 0 ? aantal / recipe.servings : 1;
  const isOwner = user?.id === recipe.user_id;
  const stapKoppeling = koppelStappen(
    recipe.instructions,
    ingredients,
    (recipe as Recipe).step_ingredients ?? null,
  );
  const stapIngredienten = (i: number) =>
    (stapKoppeling[i] ?? []).map((tr) => ({ ...ingredients[tr.idx]!, herhaling: tr.herhaling }));

  async function toggleFavorite() {
    if (!user) { if (demo) demoBericht(); return; }
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("recipe_id", id).eq("user_id", user.id);
    } else {
      await supabase.from("favorites").insert({ recipe_id: id, user_id: user.id });
    }
    qc.invalidateQueries({ queryKey: ["favorite", id] });
    qc.invalidateQueries({ queryKey: ["favorites"] });
  }

  async function naarBoodschappen(bevestigd = false) {
    if (!user) { if (demo) demoBericht(); return; }
    if (staatOpLijst && !bevestigd) {
      setVraagNogmaals(true);
      return;
    }
    const rows = ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity === null ? null : Math.round(i.quantity * factor * 100) / 100,
      unit: i.unit,
      recipe_id: recipe.id,
    }));
    if (!rows.length) return;
    try {
      const listId = gekozenLijst || (await zorgVoorLijst(user.id));
      await voegToeAanLijst(user.id, listId, rows);
      const lijstNaam = boodschappenLijsten.find((lijst) => lijst.id === listId)?.name;
      toast.success(`Ingrediënten toegevoegd${lijstNaam ? ` aan ${lijstNaam}` : ""}`, {
        action: { label: "Bekijk lijst", onClick: () => navigate({ to: "/boodschappen" }) },
      });
      qc.invalidateQueries({ queryKey: ["shopping"] });
      qc.invalidateQueries({ queryKey: ["op-lijst", recipe.id] });
      setBoodschappenOpen(false);
    } catch {
      toast.error("Toevoegen lukte niet");
    } finally {
      setVraagNogmaals(false);
    }
  }


  async function planOp(datum: string, moment: string) {
    if (!user) { if (demo) demoBericht(); return; }
    const { error } = await supabase
      .from("meal_plan")
      .insert({ user_id: user.id, recipe_id: recipe.id, plan_date: datum, meal_type: moment });
    if (error) toast.error("Inplannen lukte niet");
    else {
      toast.success("In je planning gezet");
      setPlanOpen(false);
    }
  }

  async function kopieerNaarMij() {
    if (!user) { if (demo) demoBericht(); return; }
    const { data, error } = await supabase
      .from("recipes")
      .insert({
        user_id: user.id,
        title: recipe.title,
        description: recipe.description,
        image_url: recipe.image_url,
        servings: recipe.servings,
        prep_minutes: recipe.prep_minutes,
        cook_minutes: recipe.cook_minutes,
        difficulty: recipe.difficulty,
        category: recipe.category,
        tags: recipe.tags,
        instructions: recipe.instructions,
        source_url: recipe.source_url,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(t("Kopiëren lukte niet"));
      return;
    }
    if (ingredients.length) {
      await supabase.from("recipe_ingredients").insert(
        ingredients.map((i, index) => ({
          recipe_id: data.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          position: index,
        })),
      );
    }
    toast.success(t("Toegevoegd aan jouw gerechten"));
    navigate({ to: "/recepten/$id", params: { id: data.id } });
  }

  async function verwijder() {
    if (!confirm("Dit recept definitief verwijderen?")) return;
    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
    if (error) toast.error("Verwijderen lukte niet");
    else {
      toast.success("Recept verwijderd");
      navigate({ to: "/" });
    }
  }

  async function deelRecept() {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: recipe.title, url });
    else {
      await navigator.clipboard.writeText(url);
      toast.success(t("Link gekopieerd"));
    }
  }

  async function vulAanMetAI() {
    setAanvullen(true);
    try {
      const ai = await importRecipeFromText({
        data: { text: `Maak een volledig recept voor: ${recipe.title}` },
      });
      const { error } = await supabase
        .from("recipes")
        .update({
          description: recipe.description || ai.description,
          servings: recipe.servings || ai.servings,
          prep_minutes: recipe.prep_minutes || ai.prep_minutes,
          cook_minutes: recipe.cook_minutes || ai.cook_minutes,
          instructions: recipe.instructions.length ? recipe.instructions : ai.instructions,
        })
        .eq("id", recipe.id);
      if (error) throw error;

      if (!ingredients.length && ai.ingredients.length) {
        await supabase.from("recipe_ingredients").insert(
          ai.ingredients.map((i, index) => ({
            recipe_id: recipe.id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit ?? "",
            position: index,
          })),
        );
      }
      await qc.invalidateQueries({ queryKey: ["recipe", id] });
      toast.success(t("Voorstel klaar. Lees het na en pas aan wat je anders wil."));
    } catch {
      toast.error(t("Aanvullen lukte niet"));
    } finally {
      setAanvullen(false);
    }
  }


  if (kookstand && klaarVragen) {
    return (
      <div className="flex min-h-screen items-center bg-background p-5">
        <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-card p-6 text-center">
          <h2 className="font-display text-3xl">{t("Smakelijk gegeten?")}</h2>
          <p className="mt-3 text-xl text-muted-foreground">
            {t("Hoeveel sterren geef je")} “{recipe.title}”?
          </p>
          <div className="mt-6 flex justify-center">
            <SterrenKiezer
              waarde={mijnScore}
              onKies={async (n) => {
                await zetScore(n);
                toast.success(t("Bedankt voor je score"));
                setKlaarVragen(false);
                setKookstand(false);
              }}
              label={t("Jouw score")}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setKlaarVragen(false);
              setStap(Math.max(0, recipe.instructions.length - 1));
            }}
            className="mt-6 h-16 w-full text-lg"
          >
            {t("Terug naar de stappen")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setKlaarVragen(false);
              setKookstand(false);
            }}
            className="mt-3 h-16 w-full text-lg"
          >
            {t("Later")}
          </Button>
        </div>
      </div>
    );
  }

  if (kookstand) {
    const stappen = recipe.instructions;
    const laatste = stap >= stappen.length - 1;
    return (
      <div className="min-h-screen bg-background p-5">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-muted-foreground">
              Stap {stap + 1} van {stappen.length}
            </p>
            <Button variant="ghost" onClick={() => setKookstand(false)} className="h-14">
              <X className="size-6" /> Sluiten
            </Button>
          </div>
          <h2 className="mt-6 font-display text-3xl">{recipe.title}</h2>
          <p className="mt-6 text-2xl leading-relaxed">{netteStap(t(stappen[stap] ?? ""))}</p>
          <StapIngredienten ingredienten={stapIngredienten(stap)} factor={factor} groot />
          <details className="mt-6 rounded-2xl border border-border bg-card p-4">
            <summary className="cursor-pointer text-lg font-semibold">
              {t("Alle ingrediënten bekijken")}
            </summary>
            <ul className="mt-3 space-y-2 text-lg">
              {ingredients.map((ing) => (
                <li key={ing.id} className="flex justify-between gap-3">
                  <span>{t(ing.name)}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {toonHoeveelheid(ing, factor)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <div className="mt-10 flex gap-3">
            <Button
              variant="secondary"
              disabled={stap === 0}
              onClick={() => setStap(stap - 1)}
              className="h-20 flex-1 text-lg"
            >
              Vorige
            </Button>
            <Button
              onClick={() => (laatste ? setKlaarVragen(true) : setStap(stap + 1))}
              className="h-20 flex-1 text-lg"
            >
              {laatste ? t("Klaar met koken") : "Volgende"}
            </Button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <AppShell
      title={t("Recept")}
      action={
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={toggleFavorite} aria-label={t("Favoriet")}>
            <Heart className={isFavorite ? "fill-primary text-primary" : ""} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => void deelRecept()} aria-label={t("Delen")}><Share2 /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={t("Meer")}><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52 rounded-xl p-2">
              {isOwner ? <DropdownMenuItem asChild className="min-h-12 text-base"><Link to="/recepten/$id/bewerken" params={{ id: recipe.id }}><Pencil />{t("Aanpassen")}</Link></DropdownMenuItem> : <DropdownMenuItem onSelect={() => void kopieerNaarMij()} className="min-h-12 text-base"><Copy />{t("Zet in mijn gerechten")}</DropdownMenuItem>}
              <DropdownMenuItem onSelect={() => setPlanOpen(true)} className="min-h-12 text-base"><CalendarPlus />{t("Inplannen")}</DropdownMenuItem>
              {isOwner ? <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => void verwijder()} className="min-h-12 text-base text-destructive"><Trash2 />{t("Verwijderen")}</DropdownMenuItem></> : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="space-y-5">
        <Link to="/gerechten" className="inline-flex min-h-12 items-center gap-2 font-semibold text-muted-foreground"><ArrowLeft />{t("Recepten")}</Link>
        <div className="space-y-3">
          <div className="relative">
            <RecipePhoto
              path={recipe.image_url}
              alt={recipe.title}
              className="aspect-[4/3] w-full rounded-2xl sm:aspect-[16/9]"
            />
            {fotoBezig && (
              <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-card/70">
                <Loader2 className="size-8 animate-spin" aria-hidden />
              </div>
            )}
          </div>
          {isOwner && !recipe.image_url && (
            <FotoKiezer
              bezig={fotoBezig}
              heeftFoto={!!recipe.image_url}
              onBestand={(f) => void vervangFoto(f)}
            />
          )}
        </div>

        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight">{t(recipe.title)}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-base text-muted-foreground">
            {tijdLabel(recipe.prep_minutes, recipe.cook_minutes) ? <><Clock className="size-5" />{tijdLabel(recipe.prep_minutes, recipe.cook_minutes)}<span>·</span></> : null}
            <span>{aantal} {t("personen")}</span>
          </p>
        </div>

        {recipe.instructions.length > 0 ? <Button onClick={() => { setStap(0); void meet("kookmodus.gestart", undefined, { id }); setKookstand(true); }} className="h-14 w-full"><ChefHat />{t("Start koken")}</Button> : null}

        <Button
          variant="secondary"
          onClick={() => setBoodschappenOpen(true)}
          disabled={!ingredients.length}
          className="h-16 w-full text-lg"
        >
          <ShoppingCart className="size-5" /> {t("Voeg toe aan boodschappenlijst")}
        </Button>

        {isOwner && (ingredients.length === 0 || recipe.instructions.length === 0) && (
          <div className="rounded-2xl border border-primary/40 bg-secondary p-4">
            <p className="text-base">
              {t("Dit gerecht heeft nog geen ingrediënten of stappen. Laat het ons voorstellen.")}
            </p>
            <Button
              onClick={vulAanMetAI}
              disabled={aanvullen}
              className="mt-3 h-14 w-full text-base"
            >
              {aanvullen ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Sparkles className="size-5" />
              )}
              {t("Vul dit gerecht aan")}
            </Button>
          </div>
        )}

        <Tabs defaultValue="overzicht" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
            <TabsTrigger value="overzicht">{t("Overzicht")}</TabsTrigger>
            <TabsTrigger value="ingredienten">{t("Ingrediënten")}</TabsTrigger>
            <TabsTrigger value="bereiding">{t("Bereiding")}</TabsTrigger>
            <TabsTrigger value="voeding">{t("Voeding")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overzicht" className="pt-4">
            <div className="space-y-5">
              {recipe.description ? <p className="text-lg leading-relaxed">{t(recipe.description)}</p> : null}
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-base text-muted-foreground"><span>{t(recipe.category)}</span><span>{t(recipe.difficulty)}</span></div>
              {isOwner ? <SnelAanpassen recipe={recipe} onKlaar={() => qc.invalidateQueries({ queryKey: ["recipe", recipe.id] })} /> : null}
              <SterrenKiezer waarde={mijnScore} onKies={zetScore} label={t("Jouw score")} />
              <Button variant="secondary" onClick={() => setPlanOpen(!planOpen)} className="w-full"><CalendarPlus />{t("Inplannen")}</Button>
              {planOpen ? <PlanKiezer momenten={momenten} onKies={planOp} /> : null}
              {recipe.source_url ? <a href={recipe.source_url} target="_blank" rel="noreferrer" className="block text-base text-primary underline underline-offset-4">{t("Bekijk origineel op")} {bronNaam(recipe.source_url)}</a> : null}
              {isOwner && recipe.image_url ? <FotoKiezer bezig={fotoBezig} heeftFoto onBestand={(file) => void vervangFoto(file)} /> : null}
            </div>
          </TabsContent>

          <TabsContent value="ingredienten" className="pt-4">
        <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl">Ingrediënten</h2>
            <div className="flex w-full items-center justify-between gap-2 rounded-2xl bg-secondary p-1 sm:w-auto sm:justify-end sm:bg-transparent sm:p-0">
              <Button
                variant="secondary"
                onClick={() => setPersonen(Math.max(1, aantal - 1))}
                aria-label="Minder personen"
                className="size-12 shrink-0 sm:size-14"
              >
                <Minus className="size-5" />
              </Button>
              <span className="min-w-0 flex-1 text-center text-base font-semibold sm:w-24 sm:flex-none sm:text-lg">
                {aantal} pers.
              </span>
              <Button
                variant="secondary"
                onClick={() => setPersonen(aantal + 1)}
                aria-label="Meer personen"
                className="size-12 shrink-0 sm:size-14"
              >
                <Plus className="size-5" />
              </Button>
            </div>
          </div>

          <ul className="mt-4 space-y-2 text-lg">
            {ingredients.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 border-b border-border py-2">
                <span>{t(i.name)}</span>
                <span className="shrink-0 font-semibold">
                  {i.quantity === null
                    ? ""
                    : toonBelgischeMaat(i.quantity * factor, i.unit)}
                </span>
              </li>
            ))}
            {ingredients.length === 0 && (
              <li className="py-2 text-muted-foreground">{t("Nog geen ingrediënten.")}</li>
            )}
          </ul>

          {lijstenMetRecept.length ? (
            <p className="mt-4 flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-base text-secondary-foreground">
              <Check className="size-5 text-primary" aria-hidden />
              {t("Dit recept staat al op een boodschappenlijst")}
            </p>
          ) : null}
          <Button onClick={() => setBoodschappenOpen(true)} className="mt-4 h-16 w-full text-lg">
            <ShoppingCart className="size-5" /> {t("Voeg toe aan boodschappenlijst")}
          </Button>
        </section>

          </TabsContent>

          <TabsContent value="bereiding" className="pt-4">
        <section>
          <h2 className="text-xl">{t("Bereiding")}</h2>

          <ol className="mt-3 space-y-3">
            {recipe.instructions.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                <span className="font-display text-xl text-primary">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-lg leading-relaxed">{netteStap(t(s))}</p>
                  <StapIngredienten ingredienten={stapIngredienten(i)} factor={factor} />
                </div>
              </li>
            ))}
          </ol>

          {recipe.instructions.length > 0 ? (
            <Button
              onClick={() => { setStap(0); void meet("kookmodus.gestart", undefined, { id }); setKookstand(true); }}
              className="mt-4 h-16 w-full text-lg"
            >
              <ChefHat className="size-5" /> {t("Start koken")}
            </Button>
          ) : null}
        </section>
          </TabsContent>

          <TabsContent value="voeding" className="pt-4"><Voedingswaarden ingredienten={ingredients} porties={aantal} /></TabsContent>
        </Tabs>

      </div>
      {vraagNogmaals ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl">
            <h2 className="font-display text-xl">{t("Staat al op je lijst")}</h2>
            <p className="mt-2 text-base text-muted-foreground">
              {t("Dit recept staat al op je boodschappenlijst. Wil je de ingrediënten nog eens toevoegen?")}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setVraagNogmaals(false)} className="h-14 flex-1 text-base">
                {t("Annuleren")}
              </Button>
              <Button onClick={() => void naarBoodschappen(true)} className="h-14 flex-1 text-base">
                {t("Toch toevoegen")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {boodschappenOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">Naar boodschappenlijst</h2>
                <p className="mt-1 text-base text-muted-foreground">Hoeveelheden voor {aantal} personen</p>
              </div>
              <Button variant="ghost" onClick={() => setBoodschappenOpen(false)} aria-label="Sluiten" className="size-12"><X /></Button>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary p-2">
              <Button variant="secondary" onClick={() => setPersonen(Math.max(1, aantal - 1))} aria-label="Minder personen" className="size-12"><Minus /></Button>
              <span className="text-lg font-semibold">{aantal} personen</span>
              <Button variant="secondary" onClick={() => setPersonen(aantal + 1)} aria-label="Meer personen" className="size-12"><Plus /></Button>
            </div>
            {boodschappenLijsten.length > 1 ? (
              <label className="mt-4 block text-base font-semibold">
                Kies een lijst
                <select value={gekozenLijst} onChange={(e) => setGekozenLijst(e.target.value)} className="mt-2 h-14 w-full rounded-xl border border-input bg-background px-3 text-base">
                  {boodschappenLijsten.map((lijst) => <option key={lijst.id} value={lijst.id}>{lijst.name}</option>)}
                </select>
              </label>
            ) : null}
            {staatOpLijst ? (
              <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-base">
                Dit recept staat al op {boodschappenLijsten.find((lijst) => lijst.id === gekozenLijst)?.name ?? "deze lijst"}.
              </p>
            ) : null}
            <Button onClick={() => void naarBoodschappen()} className="mt-4 h-16 w-full text-lg">
              <ShoppingCart /> {staatOpLijst ? "Nog eens toevoegen" : "Toevoegen"}
            </Button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function PlanKiezer({
  momenten,
  onKies,
}: {
  momenten: string[];
  onKies: (datum: string, moment: string) => void;
}) {
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [moment, setMoment] = useState<string>(momenten[momenten.length - 1] ?? "avondeten");
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <input
        type="date"
        value={datum}
        onChange={(e) => setDatum(e.target.value)}
        aria-label="Datum"
        className="h-14 w-full rounded-xl border border-input bg-background px-3 text-base"
      />
      <select
        value={moment}
        onChange={(e) => setMoment(e.target.value)}
        aria-label="Maaltijd"
        className="h-14 w-full rounded-xl border border-input bg-background px-3 text-base"
      >
        {momenten.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <Button onClick={() => onKies(datum, moment)} className="h-16 w-full text-lg">
        Zet in planning
      </Button>
    </div>
  );
}

/** Snel de labels van dit gerecht bijwerken zonder het hele formulier te openen. */
function SnelAanpassen({ recipe, onKlaar }: { recipe: Recipe; onKlaar: () => void }) {
  const [open, setOpen] = useState(false);
  const [nieuwLabel, setNieuwLabel] = useState("");
  const [bezig, setBezig] = useState(false);

  async function bewaar(velden: Partial<Recipe>) {
    setBezig(true);
    const { error } = await supabase.from("recipes").update(velden).eq("id", recipe.id);
    setBezig(false);
    if (error) {
      toast.error("Aanpassen lukte niet");
      return;
    }
    onKlaar();
    toast.success("Aangepast");
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="h-14 w-full justify-start text-base">
        <Pencil className="size-5" /> Snel aanpassen
      </Button>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-border/60" aria-label="Snel aanpassen">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Snel aanpassen</h3>
        <Button variant="ghost" size="icon" aria-label="Sluiten" onClick={() => setOpen(false)}>
          <X className="size-5" />
        </Button>
      </div>

      <div>
        <p className="text-base font-medium">Soort gerecht</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={recipe.category === c}
              disabled={bezig}
              onClick={() => void bewaar({ category: c })}
              className={
                recipe.category === c
                  ? "min-h-12 rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground"
                  : "min-h-12 rounded-xl border border-input bg-card px-4 text-base"
              }
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-medium">Moeilijkheid</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={recipe.difficulty === d}
              disabled={bezig}
              onClick={() => void bewaar({ difficulty: d })}
              className={
                recipe.difficulty === d
                  ? "min-h-12 rounded-xl bg-primary px-4 text-base font-medium text-primary-foreground"
                  : "min-h-12 rounded-xl border border-input bg-card px-4 text-base"
              }
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-base font-medium">Labels</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(recipe.tags ?? []).map((tag) => (
            <span key={tag} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-secondary px-3 text-base">
              {tag}
              <button
                type="button"
                aria-label={`Label ${tag} verwijderen`}
                onClick={() => void bewaar({ tags: (recipe.tags ?? []).filter((x) => x !== tag) })}
                className="text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={nieuwLabel}
            onChange={(e) => setNieuwLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !nieuwLabel.trim()) return;
              e.preventDefault();
              void bewaar({ tags: [...new Set([...(recipe.tags ?? []), nieuwLabel.trim()])] });
              setNieuwLabel("");
            }}
            placeholder="Nieuw label"
            aria-label="Nieuw label"
            className="h-14 text-base"
          />
          <Button
            className="h-14 px-5"
            disabled={!nieuwLabel.trim() || bezig}
            onClick={() => {
              void bewaar({ tags: [...new Set([...(recipe.tags ?? []), nieuwLabel.trim()])] });
              setNieuwLabel("");
            }}
          >
            <Plus className="size-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="text-base">
          Personen
          <Input
            type="number"
            min={1}
            defaultValue={recipe.servings}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0 && n !== recipe.servings) void bewaar({ servings: n });
            }}
            className="mt-1 h-14 text-base"
          />
        </label>
        <label className="text-base">
          Voorbereiden
          <Input
            type="number"
            min={0}
            defaultValue={recipe.prep_minutes}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 0 && n !== recipe.prep_minutes) void bewaar({ prep_minutes: n });
            }}
            className="mt-1 h-14 text-base"
          />
        </label>
        <label className="text-base">
          Koken
          <Input
            type="number"
            min={0}
            defaultValue={recipe.cook_minutes}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 0 && n !== recipe.cook_minutes) void bewaar({ cook_minutes: n });
            }}
            className="mt-1 h-14 text-base"
          />
        </label>
      </div>
    </section>
  );
}
