import { useEffect, useRef, useState } from "react";
import { markeerGezien } from "@/lib/gezien";
import { meet } from "@/lib/meten";
import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Copy, Users } from "lucide-react";
import { KookTimers } from "@/components/KookTimers";
import { bewaarVoortgang, leesVoortgang, vindTimers, wisVoortgang } from "@/lib/kookstand";
import { gebruiktUitVoorraad, type VoorraadRij } from "@/lib/kringloop";
import { soortLabel } from "@/lib/recept-keuzes";
import { tijdLabel } from "@/lib/tijd";
import { Voedingswaarden } from "@/components/Voedingswaarden";
import { StapIngredienten } from "@/components/StapIngredienten";
import { koppelStappen, toonHoeveelheid } from "@/lib/stap-ingredienten";
import { netteStap } from "@/lib/tekst-opkuis";
import { toonBelgischeMaat } from "@/lib/ingredienten";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { houdSchermAan, laatSchermWeerSlapen } from "@/lib/native";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageSkeleton } from "@/components/PageSkeleton";

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
  validateSearch: (search: Record<string, unknown>): { personen?: number; koken?: true } => {
    const n = Number(search["personen"]);
    const uit: { personen?: number; koken?: true } = {};
    if (Number.isInteger(n) && n >= 1 && n <= 50) uit.personen = n;
    // V2: "Start koken" vanaf Vandaag opent meteen de kookstand.
    if (search["koken"] === true || search["koken"] === "1" || search["koken"] === 1)
      uit.koken = true;
    return uit;
  },
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

function PersonenKiezer({ aantal, onZet }: { aantal: number; onZet: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-secondary p-1">
      <Button
        variant="secondary"
        onClick={() => onZet(Math.max(1, aantal - 1))}
        aria-label="Minder personen"
        className="size-14 shrink-0 bg-card"
      >
        <Minus className="size-5" />
      </Button>
      <span className="flex-1 text-center text-lg font-semibold">
        Koken voor {aantal} {aantal === 1 ? "persoon" : "personen"}
      </span>
      <Button
        variant="secondary"
        onClick={() => onZet(aantal + 1)}
        aria-label="Meer personen"
        className="size-14 shrink-0 bg-card"
      >
        <Plus className="size-5" />
      </Button>
    </div>
  );
}

function ReceptPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const t = useT();
  const { momenten } = useVoorkeuren();
  // Voorkeuraantal personen: gekend vanuit de weekmenu-planning, of zelf te kiezen.
  const zoek = Route.useSearch();
  const [personen, setPersonen] = useState<number | null>(zoek.personen ?? null);
  const [kookstand, setKookstand] = useState(zoek.koken === true);
  const [stap, setStap] = useState(zoek.koken === true ? -1 : 0);
  const [klaarVragen, setKlaarVragen] = useState(false);
  // V2: na per ongeluk wegklikken of herladen verder koken bij de juiste stap.
  const [bewaardeStap, setBewaardeStap] = useState<number | null>(null);
  const stapKop = useRef<HTMLParagraphElement>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [aanvullen, setAanvullen] = useState(false);
  const [fotoBezig, setFotoBezig] = useState(false);
  const [boodschappenOpen, setBoodschappenOpen] = useState(false);
  const [gekozenLijst, setGekozenLijst] = useState("");

  // Kookstand: scherm van gsm/tablet blijft aan.
  useEffect(() => {
    if (!kookstand) return;
    let actief = true;
    const vraag = async () => (actief ? houdSchermAan() : false);
    void vraag().then((ok) => {
      if (!ok && actief)
        toast.info(t("Zet de automatische schermvergrendeling tijdelijk uit tijdens het koken."));
    });
    const zichtbaar = () => {
      if (document.visibilityState === "visible") void vraag();
    };
    document.addEventListener("visibilitychange", zichtbaar);
    return () => {
      actief = false;
      document.removeEventListener("visibilitychange", zichtbaar);
      void laatSchermWeerSlapen();
    };
  }, [kookstand, t]);

  // Niet per ongeluk wegnavigeren tijdens het koken (terugknop, link, veeggebaar).
  const [stopVraag, setStopVraag] = useState(false);
  // V2-kringloop (S3): na het koken de voorraad bijwerken.
  const [opgebruikt, setOpgebruikt] = useState<VoorraadRij[] | null>(null);
  const [opgebruiktKeuze, setOpgebruiktKeuze] = useState<Set<string>>(new Set());
  useBlocker({
    shouldBlockFn: () => !window.confirm(t("Stoppen met koken? Je stap blijft bewaard.")),
    disabled: !kookstand,
    enableBeforeUnload: false,
  });

  async function vervangFoto(bestand: File) {
    if (!user) return;
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

  async function voegExtraFotoToe(bestand: File) {
    if (!user || !isAfbeelding(bestand)) return;
    setFotoBezig(true);
    try {
      const pad = await uploadRecipePhoto(bestand, user.id);
      const { error } = await supabase
        .from("recipe_photos")
        .insert({ recipe_id: id, path: pad, position: extraFotos.length });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["recipe-photos", id] });
      toast.success(t("Extra foto toegevoegd"));
    } catch {
      toast.error(t("De foto kon niet worden opgeslagen. Probeer het opnieuw."));
    } finally {
      setFotoBezig(false);
    }
  }

  async function maakHoofdfoto(pad: string) {
    const { error } = await supabase.from("recipes").update({ image_url: pad }).eq("id", id);
    if (error) {
      toast.error(t("De foto kon niet worden aangepast."));
      return;
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["recipe", id] }),
      qc.invalidateQueries({ queryKey: ["recipes"] }),
    ]);
    toast.success(t("Hoofdfoto aangepast"));
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

  const { data: extraFotos = [] } = useQuery({
    queryKey: ["recipe-photos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_photos")
        .select("id, path, position")
        .eq("recipe_id", id)
        .order("position");
      if (error) throw error;
      return data ?? [];
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

  // Bewaarde kookvoortgang ophalen (alleen in de browser).
  const kookRecept = data?.recipe;
  useEffect(() => {
    if (kookRecept && !kookstand)
      setBewaardeStap(leesVoortgang(kookRecept.id, kookRecept.instructions.length));
  }, [kookRecept, kookstand]);

  // Elke stap bewaren, en bij een nieuwe stap de focus op de staptekst zetten
  // zodat een schermlezer hem meteen voorleest.
  useEffect(() => {
    if (!kookstand || !kookRecept || stap < 0) return;
    bewaarVoortgang(kookRecept.id, stap);
    stapKop.current?.focus();
  }, [kookstand, stap, kookRecept]);

  // Pijltjestoetsen: vorige / volgende stap.
  useEffect(() => {
    if (!kookstand || klaarVragen || !kookRecept) return;
    const opToets = (e: KeyboardEvent) => {
      const doel = e.target as HTMLElement | null;
      if (doel && /^(INPUT|TEXTAREA|SELECT)$/.test(doel.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (stap < kookRecept.instructions.length - 1) setStap(stap + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (stap > -1) setStap(stap - 1);
      }
    };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, [kookstand, klaarVragen, stap, kookRecept]);

  async function zetScore(n: number) {
    if (!user) return;
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
    if (!user) return;
    if (isFavorite) {
      await supabase.from("favorites").delete().eq("recipe_id", id).eq("user_id", user.id);
    } else {
      await supabase.from("favorites").insert({ recipe_id: id, user_id: user.id });
    }
    qc.invalidateQueries({ queryKey: ["favorite", id] });
    qc.invalidateQueries({ queryKey: ["favorites"] });
  }

  async function naarBoodschappen(bevestigd = false) {
    if (!user) return;
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

  async function planOp(datum: string, moment: string, personen: number) {
    if (!user) return;
    const { error } = await supabase.from("meal_plan").insert({
      user_id: user.id,
      recipe_id: recipe.id,
      plan_date: datum,
      meal_type: moment,
      personen,
    });
    if (error) toast.error("Inplannen lukte niet");
    else {
      toast.success("In je planning gezet");
      setPlanOpen(false);
    }
  }

  async function kopieerNaarMij() {
    if (!user) return;
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

  function stopKoken() {
    setOpgebruikt(null);
    setKlaarVragen(false);
    setKookstand(false);
  }

  // Na de score: staat er iets uit dit recept in je voorraad? Dan één vraag, anders klaar.
  async function naKoken() {
    if (!user) return stopKoken();
    const { data: voorraad } = await supabase
      .from("pantry_items")
      .select("id, naam, hoeveelheid, eenheid")
      .eq("user_id", user.id);
    const gebruikt = gebruiktUitVoorraad(
      ingredients.map((i) => i.name),
      voorraad ?? [],
    );
    if (!gebruikt.length) return stopKoken();
    setOpgebruiktKeuze(new Set(gebruikt.map((g) => g.id)));
    setOpgebruikt(gebruikt);
  }

  async function haalUitVoorraad() {
    const weg = (opgebruikt ?? []).filter((v) => opgebruiktKeuze.has(v.id));
    if (weg.length) {
      const { error } = await supabase
        .from("pantry_items")
        .delete()
        .in(
          "id",
          weg.map((v) => v.id),
        );
      if (error) {
        toast.error(t("Bijwerken lukte niet"));
        return;
      }
      void meet("kringloop.opgebruikt", String(weg.length));
      toast.success(
        `${weg.length} ${t(weg.length === 1 ? "ding uit je voorraad" : "dingen uit je voorraad")}`,
        {
          action: {
            label: t("Ongedaan maken"),
            onClick: async () => {
              if (!user) return;
              await supabase.from("pantry_items").insert(
                weg.map((v) => ({
                  user_id: user.id,
                  naam: v.naam,
                  hoeveelheid: v.hoeveelheid,
                  eenheid: v.eenheid ?? "",
                })),
              );
            },
          },
        },
      );
    }
    stopKoken();
  }

  if (kookstand && klaarVragen && opgebruikt) {
    return (
      <div className="flex min-h-screen items-center bg-background p-5">
        <div className="paneel mx-auto w-full max-w-2xl p-6">
          <h2 className="text-paginatitel">{t("Wat heb je opgebruikt?")}</h2>
          <p className="mt-2 text-lg text-muted-foreground">
            {t("Dan klopt je voorraad weer. Tik om iets te laten staan.")}
          </p>
          <ul className="mt-5 divide-y divide-border/80 rounded-2xl ring-1 ring-border/70">
            {opgebruikt.map((v) => {
              const aan = opgebruiktKeuze.has(v.id);
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={aan}
                    onClick={() =>
                      setOpgebruiktKeuze((oud) => {
                        const nieuw = new Set(oud);
                        if (nieuw.has(v.id)) nieuw.delete(v.id);
                        else nieuw.add(v.id);
                        return nieuw;
                      })
                    }
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left"
                  >
                    <span
                      aria-hidden
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
                        aan ? "border-primary bg-primary text-primary-foreground" : "border-input"
                      }`}
                    >
                      {aan ? <Check className="size-5" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 text-xl">{v.naam}</span>
                    <span className="shrink-0 text-base text-muted-foreground">
                      {aan ? t("op") : t("blijft")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button onClick={() => void haalUitVoorraad()} className="mt-6 h-16 w-full text-lg">
            {t("Voorraad bijwerken")}
          </Button>
          <Button variant="ghost" onClick={stopKoken} className="mt-2 h-14 w-full text-lg">
            {t("Overslaan")}
          </Button>
        </div>
      </div>
    );
  }

  if (kookstand && klaarVragen) {
    return (
      <div className="flex min-h-screen items-center bg-background p-5">
        <div className="paneel mx-auto w-full max-w-2xl p-6 text-center">
          <h2 className="text-paginatitel">{t("Smakelijk gegeten?")}</h2>
          <p className="mt-3 text-xl text-muted-foreground">
            {t("Hoeveel sterren geef je")} “{recipe.title}”?
          </p>
          <div className="mt-6 flex justify-center">
            <SterrenKiezer
              waarde={mijnScore}
              onKies={async (n) => {
                // Eerst de voortgang wissen (lokaal, onmiddellijk), dan pas de score
                // over het netwerk bewaren: wie meteen afsluit, ziet geen oude stap meer.
                wisVoortgang(recipe.id);
                await zetScore(n);
                toast.success(t("Bedankt voor je score"));
                await naKoken();
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
              wisVoortgang(recipe.id);
              void naKoken();
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
    const voorbereiding = stap < 0;
    const laatste = stap >= stappen.length - 1;
    return (
      <div className="min-h-screen bg-background">
        {/* Vaste kop: wat kook je, waar ben je, en een bewuste uitgang. */}
        <div
          className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-4 pb-3 backdrop-blur-md"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-muted-foreground">
                {recipe.title}
              </p>
              <p className="text-xl font-bold">
                {voorbereiding ? (
                  t("Alles klaarzetten")
                ) : (
                  <>
                    Stap {stap + 1} van {stappen.length}
                  </>
                )}
              </p>
            </div>
            <Button variant="zacht" onClick={() => setStopVraag(true)} className="h-14 shrink-0">
              <X className="size-6" /> {t("Stoppen")}
            </Button>
          </div>
          {/* Voortgang: één blokje per stap, zichtbaar én voor schermlezers. */}
          <div
            role="progressbar"
            aria-label={t("Voortgang")}
            aria-valuemin={0}
            aria-valuemax={stappen.length}
            aria-valuenow={voorbereiding ? 0 : stap + 1}
            aria-valuetext={
              voorbereiding ? t("Alles klaarzetten") : `Stap ${stap + 1} van ${stappen.length}`
            }
            className="mx-auto mt-3 flex max-w-2xl gap-1"
          >
            {stappen.map((_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  !voorbereiding && i <= stap ? "bg-primary" : "bg-secondary"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-5 pb-40 pt-6">
          {voorbereiding ? (
            <>
              <h2 className="text-paginatitel">{recipe.title}</h2>
              <p className="mt-3 text-xl leading-relaxed text-muted-foreground">
                {t("Neem eerst alles wat je nodig hebt. Daarna koken we stap voor stap.")}
              </p>
              <div className="mt-5">
                <PersonenKiezer aantal={aantal} onZet={setPersonen} />
              </div>
              <ul className="paneel mt-6 divide-y divide-border/80 px-4 text-xl">
                {ingredients.map((ing) => (
                  <li
                    key={ing.id}
                    className="flex min-h-16 items-center justify-between gap-3 py-3"
                  >
                    <span>{t(ing.name)}</span>
                    <span className="shrink-0 font-bold tabular-nums text-primary">
                      {toonHoeveelheid(ing, factor)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <span
                aria-hidden
                className="flex size-16 items-center justify-center rounded-full bg-inkt text-3xl font-bold text-inkt-foreground"
              >
                {stap + 1}
              </span>
              <p
                ref={stapKop}
                tabIndex={-1}
                className="mt-5 text-[1.85rem] font-medium leading-snug outline-none sm:text-[2.1rem]"
              >
                {netteStap(t(stappen[stap] ?? ""))}
              </p>
              <StapIngredienten ingredienten={stapIngredienten(stap)} factor={factor} groot />
              {stapIngredienten(stap).length === 0 ? (
                <p className="mt-6 rounded-2xl bg-muted px-4 py-3 text-lg text-muted-foreground">
                  {t("Voor deze stap heb je niets nieuws nodig.")}
                </p>
              ) : null}
            </>
          )}
          {/* Vaste plek in de boom: lopende timers blijven bestaan bij het bladeren. */}
          <KookTimers voorstellen={voorbereiding ? [] : vindTimers(stappen[stap] ?? "")} />
          {!voorbereiding ? (
            <details className="paneel mt-8 p-4">
              <summary className="flex min-h-12 cursor-pointer items-center text-lg font-semibold">
                {t("Alle ingrediënten bekijken")}
              </summary>
              <ul className="mt-3 space-y-3 text-lg">
                {ingredients.map((ing) => (
                  <li key={ing.id} className="flex justify-between gap-3">
                    <span>{t(ing.name)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {toonHoeveelheid(ing, factor)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        {/* Grote knoppen onderaan, binnen bereik van de duim (ook met natte handen). */}
        <div
          className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 pt-3 backdrop-blur-md"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <div className="mx-auto flex max-w-2xl gap-3">
            <Button
              variant="zacht"
              disabled={voorbereiding}
              onClick={() => setStap(stap - 1)}
              className="h-20 flex-1 text-lg"
            >
              Vorige
            </Button>
            <Button
              onClick={() => (laatste && !voorbereiding ? setKlaarVragen(true) : setStap(stap + 1))}
              className="h-20 flex-[2] text-xl"
            >
              {voorbereiding ? t("Begin met koken") : laatste ? t("Klaar met koken") : "Volgende"}
            </Button>
          </div>
        </div>

        <AlertDialog open={stopVraag} onOpenChange={setStopVraag}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("Stoppen met koken?")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("Je stap blijft bewaard. Je kan later verder koken waar je was.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("Verder koken")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setStopVraag(false);
                  setKookstand(false);
                }}
              >
                {t("Stoppen")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <AppShell
      title={t(recipe.title)}
      action={
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={toggleFavorite} aria-label={t("Favoriet")}>
            <Heart className={isFavorite ? "fill-primary text-primary" : ""} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void deelRecept()}
            aria-label={t("Delen")}
          >
            <Share2 />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("Meer")}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52 rounded-xl p-2">
              {isOwner ? (
                <DropdownMenuItem asChild className="min-h-12 text-base">
                  <Link to="/recepten/$id/bewerken" params={{ id: recipe.id }}>
                    <Pencil />
                    {t("Aanpassen")}
                  </Link>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={() => void kopieerNaarMij()}
                  className="min-h-12 text-base"
                >
                  <Copy />
                  {t("Zet in mijn gerechten")}
                </DropdownMenuItem>
              )}
              {isOwner ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void verwijder()}
                    className="min-h-12 text-base text-destructive"
                  >
                    <Trash2 />
                    {t("Verwijderen")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="space-y-10">
        {/* V2: kop met foto en acties naast elkaar op desktop. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10">
          <div className="space-y-3">
            <div className="relative">
              <RecipePhoto
                path={recipe.image_url}
                alt={recipe.title}
                recept={recipe}
                className="aspect-[4/3] w-full rounded-3xl shadow-kaart sm:aspect-[16/9]"
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
            {extraFotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2" aria-label={t("Extra foto's")}>
                {extraFotos.map((foto) => (
                  <button
                    key={foto.id}
                    type="button"
                    onClick={() => isOwner && void maakHoofdfoto(foto.path)}
                    className="relative overflow-hidden rounded-xl border border-border text-left"
                  >
                    <RecipePhoto
                      path={foto.path}
                      alt={recipe.title}
                      className="aspect-square w-full"
                    />
                    {isOwner ? (
                      <span className="absolute inset-x-1 bottom-1 rounded-lg bg-card/90 px-2 py-1 text-center text-sm font-semibold">
                        Maak hoofdfoto
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            {/* Extra foto's pas als er een hoofdfoto is; anders zouden er twee identieke
              "Foto nemen"-knoppen met een verschillende werking staan (WCAG 3.2.4). */}
          </div>

          <div className="space-y-5">
            {/* De receptnaam staat als paginatitel (h1) bovenaan; hier de kenmerken. */}
            <ul className="flex flex-wrap gap-2" aria-label={t("Kenmerken")}>
              {tijdLabel(recipe.prep_minutes, recipe.cook_minutes) ? (
                <li className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card px-3.5 text-base font-medium shadow-zacht">
                  <Clock className="size-5 text-primary" aria-hidden />
                  {tijdLabel(recipe.prep_minutes, recipe.cook_minutes)}
                </li>
              ) : null}
              <li className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-card px-3.5 text-base font-medium shadow-zacht">
                <Users className="size-5 text-primary" aria-hidden />
                {aantal} {t(aantal === 1 ? "persoon" : "personen")}
              </li>
              {recipe.category ? (
                <li className="inline-flex min-h-10 items-center rounded-full bg-secondary px-3.5 text-base font-medium text-secondary-foreground">
                  {t(soortLabel(recipe.category))}
                </li>
              ) : null}
              {recipe.difficulty ? (
                <li className="inline-flex min-h-10 items-center rounded-full bg-[var(--honing-zacht)] px-3.5 text-base font-medium capitalize text-[var(--honing-foreground)]">
                  {t(recipe.difficulty)}
                </li>
              ) : null}
            </ul>

            {recipe.description ? (
              <p className="font-display text-xl leading-relaxed text-foreground/90">
                {t(recipe.description)}
              </p>
            ) : null}

            {recipe.instructions.length > 0 ? (
              <Button
                onClick={() => {
                  setStap(-1);
                  void meet("kookmodus.gestart", undefined, { id });
                  setKookstand(true);
                }}
                className="h-16 w-full text-lg"
              >
                <ChefHat className="size-6" />
                {t("Start koken")}
              </Button>
            ) : null}
            {bewaardeStap !== null ? (
              <Button
                variant="outline"
                onClick={() => {
                  setStap(bewaardeStap);
                  setKookstand(true);
                }}
                className="-mt-2 h-14 w-full text-lg"
              >
                {t("Verder koken bij stap")} {bewaardeStap + 1}
              </Button>
            ) : null}

            {/* Gestapeld op smalle schermen: lange labels lopen nooit buiten de knop. */}
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                onClick={() => setPlanOpen(true)}
                className="h-16 whitespace-normal px-3 text-lg leading-snug"
              >
                <CalendarPlus />
                {t("Inplannen")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setBoodschappenOpen(true)}
                disabled={!ingredients.length}
                className="h-16 gap-2 whitespace-normal px-3 text-lg leading-snug"
              >
                <ShoppingCart className="size-5 shrink-0" /> {t("Voeg toe aan boodschappenlijst")}
              </Button>
            </div>

            {planOpen ? (
              <PlanKiezer momenten={momenten} servings={recipe.servings} onKies={planOp} />
            ) : null}

            {isOwner && (ingredients.length === 0 || recipe.instructions.length === 0) && (
              <div className="rounded-2xl border border-primary/40 bg-secondary p-4">
                <p className="text-base">
                  {t(
                    "Dit gerecht heeft nog geen ingrediënten of stappen. Laat het ons voorstellen.",
                  )}
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
          </div>
        </div>

        {/* V2: geen tabbladen meer — ingrediënten en bereiding in één oogopslag.
            Desktop: ingrediënten blijven in beeld terwijl je de stappen leest. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:gap-12">
          <section
            aria-labelledby="ingredienten-titel"
            className="rounded-3xl bg-card p-5 shadow-zacht lg:sticky lg:top-24 lg:self-start"
          >
            <div className="flex flex-col gap-3">
              <h2 id="ingredienten-titel" className="text-sectietitel">
                {t("Ingrediënten")}
              </h2>
              <div className="flex w-full items-center justify-between gap-2 rounded-2xl bg-secondary p-1">
                <Button
                  variant="secondary"
                  onClick={() => setPersonen(Math.max(1, aantal - 1))}
                  aria-label="Minder personen"
                  className="size-12 shrink-0 bg-card"
                >
                  <Minus className="size-5" />
                </Button>
                <span className="min-w-0 flex-1 text-center text-base font-semibold sm:text-lg">
                  {aantal} {t(aantal === 1 ? "persoon" : "personen")}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => setPersonen(aantal + 1)}
                  aria-label="Meer personen"
                  className="size-12 shrink-0 bg-card"
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
                    {i.quantity === null ? "" : toonBelgischeMaat(i.quantity * factor, i.unit)}
                  </span>
                </li>
              ))}
              {ingredients.length === 0 && (
                <li className="py-2 text-muted-foreground">{t("Nog geen ingrediënten.")}</li>
              )}
            </ul>

            {aantal !== recipe.servings ? (
              <p className="mt-3 text-base text-muted-foreground">
                {t("Hoeveelheden aangepast. Het originele recept is voor")} {recipe.servings}{" "}
                {t("personen")}.
              </p>
            ) : null}
            {lijstenMetRecept.length ? (
              <p className="mt-4 flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-base text-secondary-foreground">
                <Check className="size-5 text-primary" aria-hidden />
                {t("Dit recept staat al op een boodschappenlijst")}
              </p>
            ) : null}
          </section>

          <section aria-labelledby="bereiding-titel">
            <h2 id="bereiding-titel" className="text-sectietitel">
              {t("Bereiding")}
            </h2>

            <ol className="mt-4 space-y-3">
              {recipe.instructions.map((s, i) => (
                <li key={i} className="flex gap-4 rounded-3xl bg-card p-5 shadow-zacht">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-inkt text-lg font-bold text-inkt-foreground"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="sr-only">
                    {t("Stap")} {i + 1}:
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg leading-relaxed">{netteStap(t(s))}</p>
                    <StapIngredienten ingredienten={stapIngredienten(i)} factor={factor} />
                  </div>
                </li>
              ))}
            </ol>

            {recipe.instructions.length > 0 ? (
              <Button
                onClick={() => {
                  setStap(-1);
                  void meet("kookmodus.gestart", undefined, { id });
                  setKookstand(true);
                }}
                className="mt-4 h-16 w-full text-lg"
              >
                <ChefHat className="size-5" /> {t("Start koken")}
              </Button>
            ) : null}
          </section>
        </div>

        <details className="group rounded-3xl bg-card p-5 shadow-zacht">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sectietitel">
            {t("Voedingswaarden")}
            <span className="text-base font-sans font-semibold text-primary group-open:hidden">
              {t("Tonen")}
            </span>
            <span className="hidden text-base font-sans font-semibold text-primary group-open:inline">
              {t("Verbergen")}
            </span>
          </summary>
          <div className="mt-4">
            <Voedingswaarden ingredienten={ingredients} porties={aantal} />
          </div>
        </details>

        <section
          aria-labelledby="jouw-recept-titel"
          className="space-y-5 rounded-3xl bg-muted/60 p-5"
        >
          <h2 id="jouw-recept-titel" className="text-sectietitel">
            {t("Jouw recept")}
          </h2>
          <SterrenKiezer waarde={mijnScore} onKies={zetScore} label={t("Jouw score")} />
          {recipe.source_url ? (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noreferrer"
              className="block text-base text-primary underline underline-offset-4"
            >
              {t("Bekijk origineel op")} {bronNaam(recipe.source_url)}
            </a>
          ) : null}
          {isOwner ? (
            <SnelAanpassen
              recipe={recipe}
              onKlaar={() => qc.invalidateQueries({ queryKey: ["recipe", recipe.id] })}
            />
          ) : null}
          {isOwner && recipe.image_url ? (
            <div className="space-y-2">
              <p className="text-base font-semibold">{t("Foto's")}</p>
              <FotoKiezer
                bezig={fotoBezig}
                heeftFoto
                onBestand={(file) => void vervangFoto(file)}
              />
              {/* Extra foto's: rustig onderaan, niet tussen de foto en "Start koken". */}
              <FotoKiezer
                extra
                bezig={fotoBezig}
                onBestand={(file) => void voegExtraFotoToe(file)}
              />
            </div>
          ) : null}
        </section>
      </div>
      {vraagNogmaals ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl">
            <h2 className="font-display text-xl">{t("Staat al op je lijst")}</h2>
            <p className="mt-2 text-base text-muted-foreground">
              {t(
                "Dit recept staat al op je boodschappenlijst. Wil je de ingrediënten nog eens toevoegen?",
              )}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setVraagNogmaals(false)}
                className="h-14 flex-1 text-base"
              >
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
                <p className="mt-1 text-base text-muted-foreground">
                  Hoeveelheden voor {aantal} personen
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setBoodschappenOpen(false)}
                aria-label="Sluiten"
                className="size-12"
              >
                <X />
              </Button>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary p-2">
              <Button
                variant="secondary"
                onClick={() => setPersonen(Math.max(1, aantal - 1))}
                aria-label="Minder personen"
                className="size-12"
              >
                <Minus />
              </Button>
              <span className="text-lg font-semibold">{aantal} personen</span>
              <Button
                variant="secondary"
                onClick={() => setPersonen(aantal + 1)}
                aria-label="Meer personen"
                className="size-12"
              >
                <Plus />
              </Button>
            </div>
            {boodschappenLijsten.length > 1 ? (
              <label className="mt-4 block text-base font-semibold">
                Kies een lijst
                <select
                  value={gekozenLijst}
                  onChange={(e) => setGekozenLijst(e.target.value)}
                  className="mt-2 h-14 w-full rounded-xl border border-input bg-background px-3 text-base"
                >
                  {boodschappenLijsten.map((lijst) => (
                    <option key={lijst.id} value={lijst.id}>
                      {lijst.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {staatOpLijst ? (
              <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-base">
                Dit recept staat al op{" "}
                {boodschappenLijsten.find((lijst) => lijst.id === gekozenLijst)?.name ??
                  "deze lijst"}
                .
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
  servings,
  onKies,
}: {
  momenten: string[];
  servings: number;
  onKies: (datum: string, moment: string, personen: number) => void;
}) {
  // Lokale datum (niet UTC): anders stond tussen middernacht en 1-2 u 's nachts "gisteren" klaar.
  const [datum, setDatum] = useState(() => {
    const nu = new Date();
    return `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-${String(nu.getDate()).padStart(2, "0")}`;
  });
  const [moment, setMoment] = useState<string>(momenten[momenten.length - 1] ?? "avondeten");
  const [personen, setPersonen] = useState(servings > 0 ? servings : 4);
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
      <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-2">
        <span className="text-base font-medium">Voor hoeveel personen?</span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setPersonen(Math.max(1, personen - 1))}
            aria-label="Minder personen"
            className="size-12 bg-card"
          >
            <Minus className="size-5" />
          </Button>
          <span className="min-w-10 text-center text-lg font-semibold">{personen}</span>
          <Button
            variant="secondary"
            onClick={() => setPersonen(Math.min(50, personen + 1))}
            aria-label="Meer personen"
            className="size-12 bg-card"
          >
            <Plus className="size-5" />
          </Button>
        </div>
      </div>
      <Button onClick={() => onKies(datum, moment, personen)} className="h-16 w-full text-lg">
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
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-14 w-full justify-start text-base"
      >
        <Pencil className="size-5" /> Snel aanpassen
      </Button>
    );
  }

  return (
    <section
      className="space-y-4 rounded-2xl bg-card p-4 ring-1 ring-border/60"
      aria-label="Snel aanpassen"
    >
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
            <span
              key={tag}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-secondary px-3 text-base"
            >
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
          Origineel recept voor (pers.)
          <Input
            type="number"
            min={1}
            defaultValue={recipe.servings}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0 && n !== recipe.servings)
                void bewaar({ servings: n });
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
              if (Number.isFinite(n) && n >= 0 && n !== recipe.prep_minutes)
                void bewaar({ prep_minutes: n });
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
              if (Number.isFinite(n) && n >= 0 && n !== recipe.cook_minutes)
                void bewaar({ cook_minutes: n });
            }}
            className="mt-1 h-14 text-base"
          />
        </label>
      </div>
    </section>
  );
}
