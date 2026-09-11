import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  ShoppingCart,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  ListPlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MEAL_TYPES, type Recipe } from "@/lib/types";
import { importRecipeFromText } from "@/lib/ai.functions";
import { zorgVoorLijst, maakLijst, voegToeAanLijst, type ShoppingList } from "@/lib/boodschappen";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Weekmenu – Foodlo" },
      {
        name: "description",
        content: "Maak je agenda: plan per dag wat je eet en zet alle ingrediënten op je lijst.",
      },
      { property: "og:title", content: "Weekmenu – Foodlo" },
      {
        property: "og:description",
        content: "Zie in één oogopslag wat er deze week op tafel komt.",
      },
    ],
  }),
  component: PlannerPage,
});

type PlanRow = {
  id: string;
  plan_date: string;
  meal_type: string;
  recipe_id: string | null;
  custom_title: string | null;
  recipes: Recipe | null;
};

function maandagVan(d: Date) {
  const kopie = new Date(d);
  const dag = (kopie.getDay() + 6) % 7;
  kopie.setDate(kopie.getDate() - dag);
  kopie.setHours(12, 0, 0, 0);
  return kopie;
}

function datumTekst(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function labelVoor(datum: string) {
  const d = new Date(`${datum}T12:00:00`);
  return d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
}

function kortLabel(datum: string) {
  const d = new Date(`${datum}T12:00:00`);
  return d.toLocaleDateString("nl-BE", { weekday: "short", day: "numeric" });
}

function PlannerPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => maandagVan(new Date()));
  const [kiezen, setKiezen] = useState<{ datum: string; moment: string } | null>(null);
  const [lijstId, setLijstId] = useState<string>("");
  const [vraagLijst, setVraagLijst] = useState<{ recipeId: string; titel: string } | null>(null);

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return datumTekst(d);
  });
  const vandaag = datumTekst(new Date());

  const { data: lijsten = [] } = useQuery({
    queryKey: ["shopping-lists", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      await zorgVoorLijst(user.id);
      const { data, error } = await supabase
        .from("shopping_lists")
        .select("id, name, created_at")
        .order("created_at");
      if (error) throw error;
      return data as ShoppingList[];
    },
  });

  const { data: plan = [] } = useQuery({
    queryKey: ["meal-plan", user?.id, week[0]],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plan")
        .select("id, plan_date, meal_type, recipe_id, custom_title, recipes(*)")
        .gte("plan_date", week[0]!)
        .lte("plan_date", week[6]!)
        .order("plan_date");
      if (error) throw error;
      return data as unknown as PlanRow[];
    },
  });

  async function verwijder(id: string) {
    await supabase.from("meal_plan").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
  }

  async function plan_toevoegen(recipeId: string, datum: string, moment: string, titel: string) {
    if (!user) return;
    const { error } = await supabase.from("meal_plan").insert({
      user_id: user.id,
      recipe_id: recipeId,
      plan_date: datum,
      meal_type: moment,
    });
    if (error) {
      toast.error("Inplannen lukte niet");
      return;
    }
    setKiezen(null);
    toast.success("In je weekmenu gezet");
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
    setVraagLijst({ recipeId, titel });
  }

  async function nieuw_gerecht(naam: string, bewaren: boolean, datum: string, moment: string) {
    if (!user) return;
    let recipeId: string | null = null;

    if (bewaren) {
      toast.info("We maken alvast een recept met ingrediënten en stappen…");
      let basis: {
        title: string;
        description: string;
        servings: number;
        prep_minutes: number;
        cook_minutes: number;
        category: string;
        difficulty: string;
        tags: string[];
        instructions: string[];
        ingredienten: { name: string; quantity: number | null; unit: string }[];
      } = {
        title: naam,
        description: "",
        servings: 4,
        prep_minutes: 0,
        cook_minutes: 0,
        category: "hoofdgerecht",
        difficulty: "makkelijk",
        tags: [],
        instructions: [],
        ingredienten: [],
      };

      try {
        const ai = await importRecipeFromText({
          data: { text: `Maak een volledig recept voor: ${naam}` },
        });
        basis = {
          title: ai.title || naam,
          description: ai.description,
          servings: ai.servings || 4,
          prep_minutes: ai.prep_minutes || 0,
          cook_minutes: ai.cook_minutes || 0,
          category: ai.category || "hoofdgerecht",
          difficulty: ai.difficulty || "makkelijk",
          tags: ai.tags ?? [],
          instructions: ai.instructions ?? [],
          ingredienten: (ai.ingredients ?? []).map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit ?? "",
          })),
        };
      } catch {
        // zonder AI bewaren we het gerecht met enkel een naam
      }

      const { data, error } = await supabase
        .from("recipes")
        .insert({
          user_id: user.id,
          title: basis.title,
          description: basis.description,
          servings: basis.servings,
          prep_minutes: basis.prep_minutes,
          cook_minutes: basis.cook_minutes,
          category: basis.category,
          difficulty: basis.difficulty,
          tags: basis.tags,
          instructions: basis.instructions,
        })
        .select("id")
        .single();
      if (error) {
        toast.error("Bewaren lukte niet");
        return;
      }
      recipeId = data.id;

      if (basis.ingredienten.length) {
        await supabase.from("recipe_ingredients").insert(
          basis.ingredienten.map((i, index) => ({
            recipe_id: recipeId!,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            position: index,
          })),
        );
      }
    }

    const { error } = await supabase.from("meal_plan").insert({
      user_id: user.id,
      recipe_id: recipeId,
      custom_title: recipeId ? null : naam,
      plan_date: datum,
      meal_type: moment,
    });
    if (error) {
      toast.error("Inplannen lukte niet");
      return;
    }
    setKiezen(null);
    toast.success(bewaren ? "Ingepland en bewaard bij je recepten" : "In je weekmenu gezet");
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
    qc.invalidateQueries({ queryKey: ["recipes"] });
    qc.invalidateQueries({ queryKey: ["alle-ingredienten"] });
    if (recipeId) setVraagLijst({ recipeId, titel: naam });
  }

  async function zetOpLijst(recipeId: string, listId: string) {
    if (!user) return;
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("name, quantity, unit")
      .eq("recipe_id", recipeId);
    if (error || !data?.length) {
      toast.error("Dit gerecht heeft nog geen ingrediënten");
      return;
    }
    try {
      await voegToeAanLijst(
        user.id,
        listId,
        data.map((i) => ({
          name: i.name as string,
          quantity: i.quantity as number | null,
          unit: (i.unit as string) ?? "",
          recipe_id: recipeId,
        })),
      );
      toast.success("Op je boodschappenlijst gezet");
      qc.invalidateQueries({ queryKey: ["shopping"] });
    } catch {
      toast.error("Toevoegen lukte niet");
    }
  }

  async function alleBoodschappen() {
    if (!user || plan.length === 0) return;
    const ids = plan.map((p) => p.recipe_id).filter((x): x is string => !!x);
    if (!ids.length) {
      toast.error("Geen ingrediënten gevonden");
      return;
    }
    const listId = lijstId || lijsten[0]?.id || (await zorgVoorLijst(user.id));
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("name, quantity, unit, recipe_id")
      .in("recipe_id", ids);
    if (error || !data?.length) {
      toast.error("Geen ingrediënten gevonden");
      return;
    }
    try {
      await voegToeAanLijst(
        user.id,
        listId,
        data.map((i) => ({
          name: i.name as string,
          quantity: i.quantity as number | null,
          unit: (i.unit as string) ?? "",
          recipe_id: i.recipe_id as string,
        })),
      );
      toast.success("Alles staat op je boodschappenlijst");
      qc.invalidateQueries({ queryKey: ["shopping"] });
    } catch {
      toast.error("Toevoegen lukte niet");
    }
  }

  function verschuif(weken: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + weken * 7);
    setWeekStart(d);
  }

  return (
    <AppShell title="Weekmenu">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => verschuif(-1)}
            aria-label="Vorige week"
            className="size-14"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <p className="flex-1 text-center text-lg font-semibold">
            {new Date(`${week[0]}T12:00:00`).toLocaleDateString("nl-BE", {
              day: "numeric",
              month: "long",
            })}{" "}
            –{" "}
            {new Date(`${week[6]}T12:00:00`).toLocaleDateString("nl-BE", {
              day: "numeric",
              month: "long",
            })}
          </p>
          <Button
            variant="secondary"
            onClick={() => verschuif(1)}
            aria-label="Volgende week"
            className="size-14"
          >
            <ChevronRight className="size-6" />
          </Button>
        </div>

        <Button
          onClick={() => setKiezen({ datum: vandaag >= week[0]! && vandaag <= week[6]! ? vandaag : week[0]!, moment: "avondeten" })}
          className="h-16 w-full text-lg"
        >
          <Plus className="size-6" /> Gerecht inplannen deze week
        </Button>

        <div className="space-y-2">
          {lijsten.length > 1 && (
            <select
              value={lijstId || lijsten[0]!.id}
              onChange={(e) => setLijstId(e.target.value)}
              aria-label="Naar welk lijstje?"
              className="h-14 w-full rounded-xl border border-input bg-card px-3 text-base"
            >
              {lijsten.map((l) => (
                <option key={l.id} value={l.id}>
                  Naar lijstje: {l.name}
                </option>
              ))}
            </select>
          )}
          <Button variant="secondary" onClick={alleBoodschappen} className="h-16 w-full text-lg">
            <ShoppingCart className="size-5" /> Hele week op de lijst zetten
          </Button>
        </div>

        {week.map((dag) => {
          const items = plan.filter((p) => p.plan_date === dag);
          return (
            <section
              key={dag}
              className={
                dag === vandaag
                  ? "rounded-2xl border-2 border-primary bg-card p-4"
                  : "rounded-2xl border border-border bg-card p-4"
              }
            >
              <h2 className="text-lg capitalize">
                {labelVoor(dag)}
                {dag === vandaag ? " · vandaag" : ""}
              </h2>

              {items.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {items.map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      {p.recipe_id ? (
                        <Link
                          to="/recepten/$id"
                          params={{ id: p.recipe_id }}
                          className="flex-1 text-lg underline-offset-4 hover:underline"
                        >
                          <span className="text-base text-muted-foreground">{p.meal_type}: </span>
                          {p.recipes?.title ?? "Recept"}
                        </Link>
                      ) : (
                        <span className="flex-1 text-lg">
                          <span className="text-base text-muted-foreground">{p.meal_type}: </span>
                          {p.custom_title}
                        </span>
                      )}
                      {p.recipe_id && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setVraagLijst({
                              recipeId: p.recipe_id!,
                              titel: p.recipes?.title ?? "Recept",
                            })
                          }
                          aria-label="Op boodschappenlijst zetten"
                          className="size-12"
                        >
                          <ShoppingCart className="size-5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => verwijder(p.id)}
                        aria-label="Uit weekmenu halen"
                        className="size-12"
                      >
                        <Trash2 className="size-5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setKiezen({ datum: dag, moment: m })}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-secondary px-4 text-base font-semibold"
                  >
                    <Plus className="size-4" aria-hidden /> {m}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {kiezen && (
        <ReceptKiezer
          week={week}
          start={kiezen}
          onSluit={() => setKiezen(null)}
          onKies={plan_toevoegen}
          onNieuw={nieuw_gerecht}
        />
      )}

      {vraagLijst && user && (
        <LijstVraag
          titel={vraagLijst.titel}
          lijsten={lijsten}
          onSluit={() => setVraagLijst(null)}
          onKies={async (listId) => {
            await zetOpLijst(vraagLijst.recipeId, listId);
            setVraagLijst(null);
          }}
          onNieuw={async (naam) => {
            try {
              const id = await maakLijst(user.id, naam);
              qc.invalidateQueries({ queryKey: ["shopping-lists"] });
              await zetOpLijst(vraagLijst.recipeId, id);
            } catch {
              toast.error("Lijstje maken lukte niet");
            }
            setVraagLijst(null);
          }}
        />
      )}
    </AppShell>
  );
}

function ReceptKiezer({
  week,
  start,
  onSluit,
  onKies,
  onNieuw,
}: {
  week: string[];
  start: { datum: string; moment: string };
  onSluit: () => void;
  onKies: (id: string, datum: string, moment: string, titel: string) => void;
  onNieuw: (naam: string, bewaren: boolean, datum: string, moment: string) => void;
}) {
  const [zoek, setZoek] = useState("");
  const [bewaren, setBewaren] = useState(true);
  const [datum, setDatum] = useState(start.datum);
  const [moment, setMoment] = useState(start.moment);

  const { data: recipes = [] } = useQuery({
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

  const term = zoek.trim();
  const lijst = recipes.filter((r) => r.title.toLowerCase().includes(term.toLowerCase()));
  const bestaatAl = recipes.some((r) => r.title.toLowerCase() === term.toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-card p-4 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl">Inplannen deze week</h2>
          <Button variant="ghost" onClick={onSluit} aria-label="Sluiten" className="size-12">
            <X className="size-6" />
          </Button>
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Kies een dag">
          {week.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDatum(d)}
              aria-pressed={d === datum}
              className={
                d === datum
                  ? "min-h-12 shrink-0 rounded-xl bg-primary px-4 text-base font-semibold capitalize text-primary-foreground"
                  : "min-h-12 shrink-0 rounded-xl border border-border bg-secondary px-4 text-base font-semibold capitalize"
              }
            >
              {kortLabel(d)}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2" role="group" aria-label="Kies een moment">
          {MEAL_TYPES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMoment(m)}
              aria-pressed={m === moment}
              className={
                m === moment
                  ? "min-h-12 flex-1 rounded-xl bg-primary px-3 text-base font-semibold text-primary-foreground"
                  : "min-h-12 flex-1 rounded-xl border border-border bg-secondary px-3 text-base font-semibold"
              }
            >
              {m}
            </button>
          ))}
        </div>

        <Input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Wat eten we? Zoek of typ een naam"
          aria-label="Zoek of typ een gerecht"
          className="mt-3 h-14 text-base"
        />

        {term && !bestaatAl && (
          <div className="mt-3 rounded-2xl border border-primary/40 bg-secondary p-4">
            <p className="text-base">
              “{term}” staat nog niet in je recepten. Je kan het toch inplannen.
            </p>
            <label className="mt-3 flex min-h-12 items-center gap-3 text-base">
              <Checkbox
                checked={bewaren}
                onCheckedChange={(v) => setBewaren(v === true)}
                className="size-7"
              />
              Ook bewaren bij mijn recepten
            </label>
            <Button
              onClick={() => onNieuw(term, bewaren, datum, moment)}
              className="mt-3 h-14 w-full text-base"
            >
              <Sparkles className="size-5" /> “{term}” inplannen
            </Button>
          </div>
        )}

        <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
          {lijst.length === 0 ? (
            <li className="py-6 text-center text-lg text-muted-foreground">
              Geen recepten gevonden.
            </li>
          ) : (
            lijst.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onKies(r.id, datum, moment, r.title)}
                  className="min-h-16 w-full rounded-xl border border-border px-4 py-3 text-left text-lg active:bg-secondary"
                >
                  {r.title}
                  <span className="block text-base text-muted-foreground">
                    {r.prep_minutes + r.cook_minutes} min · {r.category}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function LijstVraag({
  titel,
  lijsten,
  onSluit,
  onKies,
  onNieuw,
}: {
  titel: string;
  lijsten: ShoppingList[];
  onSluit: () => void;
  onKies: (listId: string) => void;
  onNieuw: (naam: string) => void;
}) {
  const [nieuweNaam, setNieuweNaam] = useState("");
  const [nieuwTonen, setNieuwTonen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="w-full max-w-lg rounded-t-3xl bg-card p-4 sm:rounded-3xl">
        <h2 className="font-display text-xl">Ook op je boodschappenlijst?</h2>
        <p className="mt-1 text-base text-muted-foreground">
          De ingrediënten van “{titel}” worden bij je lijst opgeteld.
        </p>

        <div className="mt-4 space-y-2">
          {lijsten.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onKies(l.id)}
              className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border px-4 text-left text-lg active:bg-secondary"
            >
              <ShoppingCart className="size-5" aria-hidden /> {l.name}
            </button>
          ))}

          {nieuwTonen ? (
            <div className="flex gap-2">
              <Input
                value={nieuweNaam}
                onChange={(e) => setNieuweNaam(e.target.value)}
                placeholder="Naam van het lijstje"
                aria-label="Naam van het nieuwe lijstje"
                className="h-14 text-base"
              />
              <Button
                onClick={() => nieuweNaam.trim() && onNieuw(nieuweNaam.trim())}
                className="h-14 px-6 text-base"
              >
                Maken
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNieuwTonen(true)}
              className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 text-left text-lg"
            >
              <ListPlus className="size-5" aria-hidden /> Nieuw lijstje maken
            </button>
          )}
        </div>

        <Button variant="ghost" onClick={onSluit} className="mt-3 h-14 w-full text-base">
          Nee, bedankt
        </Button>
      </div>
    </div>
  );
}
