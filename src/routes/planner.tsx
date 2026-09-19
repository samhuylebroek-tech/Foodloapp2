import { useEffect, useState } from "react";
import { meet } from "@/lib/meten";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  ShoppingCart,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Loader2,
  Sparkles,
  ListPlus,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { type Recipe } from "@/lib/types";
import { importRecipeFromText } from "@/lib/ai.functions";
import { useVoorkeuren } from "@/lib/voorkeuren";
import { zorgVoorLijst, maakLijst, voegToeAanLijst, type ShoppingList } from "@/lib/boodschappen";
import { tijdLabel } from "@/lib/tijd";

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
  user_id: string;
  group_id: string | null;
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

type Basis = {
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
};

function PlannerPage() {
  useEffect(() => {
    void meet("weekmenu.bekeken");
  }, []);
  const { user } = useAuth();
  const { momenten: algemeneMomenten, weekmenu, zetWeekmenu } = useVoorkeuren();
  // Dagdelen: eigen keuze voor het weekmenu, anders je algemene momenten.
  const momenten = weekmenu.momenten.length ? weekmenu.momenten : algemeneMomenten;
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => maandagVan(new Date()));
  const [kiezen, setKiezen] = useState<{ datum: string; moment: string; vraagDag?: boolean } | null>(
    null,
  );
  const [lijstId, setLijstId] = useState<string>("");
  const [vraagLijst, setVraagLijst] = useState<{ recipeId: string; titel: string } | null>(null);
  const [weergave, setWeergave] = useState<"mij" | "gezin">("mij");
  const [instellingenOpen, setInstellingenOpen] = useState(false);

  // De week begint op maandag of (als je dat kiest) op zondag.
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i - (weekmenu.startdag === 6 ? 1 : 0));
    return datumTekst(d);
  });
  const vandaag = datumTekst(new Date());
  // Alleen de dagen die je wil zien (0 = maandag … 6 = zondag).
  const zichtbareDagen = week.filter((dag) =>
    weekmenu.dagen.includes((new Date(`${dag}T12:00:00`).getDay() + 6) % 7),
  );

  const { data: gezin } = useQuery({
    queryKey: ["planner-gezin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: lid } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id)
        .eq("status", "actief")
        .limit(1)
        .maybeSingle();
      if (!lid) return null;
      const { data: g } = await supabase
        .from("groups")
        .select("id, naam")
        .eq("id", lid.group_id)
        .maybeSingle();
      return g ? ({ id: g.id, naam: g.naam } as { id: string; naam: string }) : null;
    },
  });

  const { data: lijsten = [] } = useQuery({
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

  const gezinsLijst = lijsten.find((l) => l.group_id && l.group_id === gezin?.id);

  const { data: plan = [] } = useQuery({
    queryKey: ["meal-plan", weergave, weergave === "gezin" ? gezin?.id : user?.id, week[0]],
    enabled: !!user && (weergave === "mij" || !!gezin),
    queryFn: async () => {
      let q = supabase
        .from("meal_plan")
        .select("id, plan_date, meal_type, recipe_id, custom_title, user_id, group_id, recipes(*)")
        .gte("plan_date", week[0]!)
        .lte("plan_date", week[6]!)
        .order("plan_date");
      q = weergave === "gezin" ? q.eq("group_id", gezin!.id) : q.is("group_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as PlanRow[];
    },
  });

  // Het gezinsweekmenu ververst mee als een ander gezinslid iets aanpast.
  useEffect(() => {
    if (!user) return;
    const kanaal = supabase
      .channel("planner-meal-plan")
      .on("postgres_changes", { event: "*", schema: "public", table: "meal_plan" }, () => {
        qc.invalidateQueries({ queryKey: ["meal-plan"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(kanaal);
    };
  }, [user, qc]);

  const plannerIds = [...new Set(plan.map((p) => p.user_id))];
  const { data: plannerNamen = {} } = useQuery({
    queryKey: ["planner-namen", plannerIds.join(",")],
    enabled: weergave === "gezin" && plannerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", plannerIds);
      if (error) throw error;
      return Object.fromEntries(data.map((p) => [p.id, p.display_name])) as Record<string, string>;
    },
  });

  async function verwijder(id: string) {
    await supabase.from("meal_plan").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
  }

  async function plan_toevoegen(recipeId: string, datum: string, moment: string, titel: string) {
    if (!user) return;
    const { data, error } = await supabase
      .from("meal_plan")
      .insert({
        user_id: user.id,
        recipe_id: recipeId,
        plan_date: datum,
        meal_type: moment,
        group_id: weergave === "gezin" ? gezin!.id : null,
      })
      .select("id")
      .single();
    if (error) {
      toast.error("Inplannen lukte niet");
      return;
    }
    setKiezen(null);
    setWeekStart(maandagVan(new Date(`${datum}T12:00:00`)));
    toast.success(`${titel} staat op ${labelVoor(datum)}`, {
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          void verwijder(data.id);
        },
      },
    });
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
    setVraagLijst({ recipeId, titel });
  }

  async function nieuw_gerecht(naam: string, basis: Basis | null, datum: string, moment: string) {
    if (!user) return;
    let recipeId: string | null = null;

    if (basis) {
      const { data, error } = await supabase
        .from("recipes")
        .insert({
          user_id: user.id,
          title: basis.title || naam,
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
      group_id: weergave === "gezin" ? gezin!.id : null,
    });
    if (error) {
      toast.error("Inplannen lukte niet");
      return;
    }
    setKiezen(null);
    setWeekStart(maandagVan(new Date(`${datum}T12:00:00`)));
    toast.success(basis ? "Ingepland en bewaard bij je recepten" : "In je weekmenu gezet");
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
    const standaardLijst =
      weergave === "gezin" && gezinsLijst ? gezinsLijst.id : lijstId || lijsten[0]?.id;
    const listId = standaardLijst || (await zorgVoorLijst(user.id));
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
        {gezin && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Wiens weekmenu?">
              <button
                type="button"
                role="tab"
                aria-selected={weergave === "mij"}
                onClick={() => setWeergave("mij")}
                className={
                  weergave === "mij"
                    ? "min-h-14 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground"
                    : "min-h-14 rounded-xl border border-border bg-card px-4 text-base font-semibold"
                }
              >
                Mijn weekmenu
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={weergave === "gezin"}
                onClick={() => setWeergave("gezin")}
                className={
                  weergave === "gezin"
                    ? "min-h-14 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground"
                    : "min-h-14 rounded-xl border border-border bg-card px-4 text-base font-semibold"
                }
              >
                Weekmenu gezin
              </button>
            </div>
            {weergave === "gezin" && (
              <p className="text-center text-base text-muted-foreground">
                Weekmenu van {gezin.naam} — iedereen vult mee aan.
              </p>
            )}
          </div>
        )}

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
          <Button
            variant="ghost"
            onClick={() => setInstellingenOpen(true)}
            aria-label="Instellingen weekmenu"
            className="size-14"
          >
            <Settings className="size-6" />
          </Button>
        </div>


        <Button
          onClick={() =>
            setKiezen({
              datum: vandaag >= week[0]! && vandaag <= week[6]! ? vandaag : week[0]!,
              moment: momenten[momenten.length - 1] ?? "avondeten",
              vraagDag: true,
            })
          }
          className="h-16 w-full text-lg"
        >
          <Plus className="size-6" /> Gerecht inplannen deze week
        </Button>

        <Accordion type="single" collapsible className="rounded-2xl bg-card px-4 ring-1 ring-border/60">
          <AccordionItem value="boodschappen" className="border-0">
            <AccordionTrigger className="min-h-14 text-base no-underline hover:no-underline"><span className="flex items-center gap-2"><ShoppingCart className="size-5 text-primary" />Boodschappen voor deze week</span></AccordionTrigger>
            <AccordionContent className="space-y-2">
          {lijsten.length > 1 && (
            <select
              value={
                lijstId ||
                (weergave === "gezin" && gezinsLijst ? gezinsLijst.id : lijsten[0]!.id)
              }
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {week.map((dag) => {
          const items = plan.filter((p) => p.plan_date === dag);
          const openMomenten = momenten.filter((m) => !items.some((p) => p.meal_type === m));
          const volledig = momenten.length > 0 && openMomenten.length === 0;
          return (
            <section
              key={dag}
              className={
                volledig
                  ? "rounded-2xl border border-primary/40 bg-secondary p-4"
                  : dag === vandaag
                    ? "rounded-2xl border-2 border-primary bg-card p-4"
                    : "rounded-2xl border border-border bg-card p-4"
              }
            >
              <h2 className="text-lg capitalize">
                {labelVoor(dag)}
                {dag === vandaag ? " · vandaag" : ""}
                {volledig && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary-foreground/20 px-2 py-0.5 align-middle text-xs font-bold normal-case">
                    <Check className="size-3.5" aria-hidden /> klaar
                  </span>
                )}
              </h2>

              {items.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {items.map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      {weergave === "gezin" && p.user_id !== user?.id && (
                        <span
                          title={`Ingepland door ${plannerNamen[p.user_id] ?? "een gezinslid"}`}
                        >
                          <Avatar
                            naam={plannerNamen[p.user_id] ?? "?"}
                            sleutel={p.user_id}
                            className="size-9 text-xs"
                          />
                        </span>
                      )}
                      {p.recipe_id ? (
                        <Link
                          to="/recepten/$id"
                          params={{ id: p.recipe_id }}
                          className="flex-1 text-lg underline-offset-4 hover:underline"
                        >
                          {p.meal_type && p.meal_type !== "maaltijd" ? (
                            <span className="text-base capitalize text-muted-foreground">{p.meal_type}: </span>
                          ) : null}
                          {p.recipes?.title ?? "Recept"}
                        </Link>
                      ) : (
                        <span className="flex-1 text-lg">
                          {p.meal_type && p.meal_type !== "maaltijd" ? (
                            <span className="text-base capitalize text-muted-foreground">{p.meal_type}: </span>
                          ) : null}
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
                {openMomenten.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setKiezen({ datum: dag, moment: m })}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-secondary px-4 text-base font-semibold"
                  >
                    <Plus className="size-4" aria-hidden /> {m}
                  </button>
                ))}
                {volledig && (
                  <p className="text-base font-semibold text-primary">
                    Helemaal gepland
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {kiezen && (
        <ReceptKiezer
          week={week}
          momenten={momenten}
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

function GerechtKaart({ recept, onKies }: { recept: Recipe; onKies: () => void }) {
  const [fout, setFout] = useState(false);
  const info = [tijdLabel(recept.prep_minutes, recept.cook_minutes), recept.category]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      type="button"
      onClick={onKies}
      className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-border bg-card p-2 text-left active:bg-secondary"
    >
      {recept.image_url && !fout ? (
        <img
          src={recept.image_url}
          alt=""
          loading="lazy"
          onError={() => setFout(true)}
          className="size-16 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="grid size-16 shrink-0 place-items-center rounded-xl bg-secondary font-display text-xl text-primary"
        >
          {recept.title.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-semibold">{recept.title}</span>
        {info && <span className="block truncate text-base text-muted-foreground">{info}</span>}
      </span>
      <Plus className="size-5 shrink-0 text-primary" aria-hidden />
    </button>
  );
}

function ReceptKiezer({
  week,
  momenten,
  start,
  onSluit,
  onKies,
  onNieuw,
}: {
  week: string[];
  momenten: string[];
  start: { datum: string; moment: string; vraagDag?: boolean };
  onSluit: () => void;
  onKies: (id: string, datum: string, moment: string, titel: string) => void;
  onNieuw: (naam: string, basis: Basis | null, datum: string, moment: string) => void;
}) {
  const { user } = useAuth();
  const [zoek, setZoek] = useState("");
  const [datum, setDatum] = useState(start.datum);
  const [moment, setMoment] = useState(start.moment);
  const [dagKiezen, setDagKiezen] = useState(!!start.vraagDag);
  const [aiBezig, setAiBezig] = useState(false);
  const [voorstel, setVoorstel] = useState<Basis | null>(null);

  async function maakVoorstel(naam: string) {
    setAiBezig(true);
    try {
      const ai = await importRecipeFromText({
        data: { text: `Maak een volledig recept voor: ${naam}` },
      });
      setVoorstel({
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
      });
    } catch {
      toast.error("De AI kon geen recept maken. Probeer opnieuw of kies gewone tekst.");
    } finally {
      setAiBezig(false);
    }
  }

  const { data: recipes = [] } = useQuery({
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

  const { data: favorieten = [] } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("recipe_id");
      if (error) throw error;
      return data.map((f) => f.recipe_id as string);
    },
  });

  // Wanneer stond een gerecht voor het laatst (of eerstkomend) in de planning?
  const { data: laatst = {} } = useQuery({
    queryKey: ["planner-laatst", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plan")
        .select("recipe_id, plan_date")
        .not("recipe_id", "is", null)
        .order("plan_date", { ascending: false })
        .limit(400);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of data) {
        const id = r.recipe_id as string;
        if (!map[id]) map[id] = r.plan_date as string;
      }
      return map;
    },
  });

  const term = zoek.trim();
  const treffers = recipes.filter((r) => r.title.toLowerCase().includes(term.toLowerCase()));
  const bestaatAl = recipes.some((r) => r.title.toLowerCase() === term.toLowerCase());

  const dezeWeek = new Set(
    Object.entries(laatst)
      .filter(([, d]) => d >= week[0]! && d <= week[6]!)
      .map(([id]) => id),
  );
  const favorietenLijst = recipes.filter((r) => favorieten.includes(r.id)).slice(0, 6);
  const voorgesteld = recipes
    .filter((r) => !dezeWeek.has(r.id))
    .sort((a, b) => (laatst[a.id] ?? "").localeCompare(laatst[b.id] ?? ""))
    .slice(0, 4);
  const recent = recipes
    .filter((r) => laatst[r.id])
    .sort((a, b) => (laatst[b.id] ?? "").localeCompare(laatst[a.id] ?? ""))
    .slice(0, 4);
  const alles = [...recipes].sort((a, b) => a.title.localeCompare(b.title, "nl"));

  const groepen: { titel: string; items: Recipe[] }[] = [
    { titel: "Voorgesteld voor deze dag", items: voorgesteld },
    { titel: "Favorieten", items: favorietenLijst },
    { titel: "Recent gepland", items: recent },
    { titel: "Al je recepten", items: alles },
  ].filter((g) => g.items.length > 0);

  if (voorstel) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
        <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-card p-4 sm:rounded-3xl">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-xl">Klopt dit recept?</h2>
            <Button
              onClick={() => onNieuw(zoek.trim(), voorstel, datum, moment)}
              aria-label="Bevestigen"
              className="size-12 rounded-full"
            >
              <Check className="size-6" />
            </Button>
          </div>

          <div className="mt-3 flex-1 space-y-3 overflow-y-auto">
            <p className="text-xl font-semibold">{voorstel.title}</p>
            {voorstel.description && (
              <p className="text-base text-muted-foreground">{voorstel.description}</p>
            )}
            <p className="text-base text-muted-foreground">
              {[
                `${voorstel.servings} personen`,
                tijdLabel(voorstel.prep_minutes, voorstel.cook_minutes),
                voorstel.category,
                voorstel.difficulty,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {voorstel.ingredienten.length > 0 && (
              <div>
                <h3 className="text-base font-semibold">Ingrediënten</h3>
                <ul className="mt-1 list-inside list-disc text-base">
                  {voorstel.ingredienten.map((i, idx) => (
                    <li key={idx}>
                      {[i.quantity ?? "", i.unit, i.name].join(" ").replace(/\s+/g, " ").trim()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {voorstel.instructions.length > 0 && (
              <div>
                <h3 className="text-base font-semibold">Zo maak je het</h3>
                <ol className="mt-1 list-inside list-decimal text-base">
                  {voorstel.instructions.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <Button variant="ghost" onClick={() => setVoorstel(null)} className="h-14 flex-1 text-base">
              Terug
            </Button>
            <Button
              onClick={() => onNieuw(zoek.trim(), voorstel, datum, moment)}
              className="mt-0 h-14 flex-[2] text-base"
            >
              <Check className="size-5" /> Bevestigen
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const dagKeuze = (
    <div className="space-y-3">
      <input
        type="date"
        value={datum}
        onChange={(e) => {
          if (e.target.value) setDatum(e.target.value);
        }}
        aria-label="Kies een datum"
        className="h-14 w-full rounded-xl border border-input bg-background px-3 text-base"
      />

      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Kies een dag">
        {week.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDatum(d)}
            aria-pressed={d === datum}
            className={
              d === datum
                ? "min-h-12 rounded-xl bg-primary px-2 text-base font-semibold capitalize text-primary-foreground"
                : "min-h-12 rounded-xl border border-border bg-secondary px-2 text-base font-semibold capitalize"
            }
          >
            {kortLabel(d)}
          </button>
        ))}
      </div>

      {momenten.length > 1 && (
        <div className="flex gap-2" role="group" aria-label="Kies een moment">
          {momenten.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMoment(m)}
              aria-pressed={m === moment}
              className={
                m === moment
                  ? "min-h-12 flex-1 rounded-xl bg-primary px-3 text-base font-semibold capitalize text-primary-foreground"
                  : "min-h-12 flex-1 rounded-xl border border-border bg-secondary px-3 text-base font-semibold capitalize"
              }
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Stap 1 (enkel bij de algemene knop): eerst de dag kiezen.
  if (dagKiezen) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
        <div className="w-full max-w-lg rounded-t-3xl bg-card p-4 sm:rounded-3xl">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-xl">Wanneer eten we iets?</h2>
            <Button variant="ghost" onClick={onSluit} aria-label="Sluiten" className="size-12">
              <X className="size-6" />
            </Button>
          </div>

          <p className="mb-3 mt-1 text-base capitalize text-muted-foreground">{labelVoor(datum)}</p>

          {dagKeuze}

          <Button onClick={() => setDagKiezen(false)} className="mt-4 h-14 w-full text-base">
            Verder · kies een gerecht
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-card p-4 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl">Wat eten we?</h2>
            <button
              type="button"
              onClick={() => setDagKiezen(true)}
              className="mt-1 text-base font-semibold capitalize text-primary underline underline-offset-4"
            >
              {labelVoor(datum)}
              {moment && moment !== "maaltijd" ? ` · ${moment}` : ""} — wijzigen
            </button>
          </div>
          <Button variant="ghost" onClick={onSluit} aria-label="Sluiten" className="size-12">
            <X className="size-6" />
          </Button>
        </div>

        <Input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek een gerecht of typ een naam"
          aria-label="Zoek of typ een gerecht"
          className="mt-3 h-14 text-base"
        />

        {term && !bestaatAl && (
          <div className="mt-3 rounded-2xl border border-primary/40 bg-secondary p-4">
            <p className="text-base">
              “{term}” staat nog niet in je recepten. Je kan het toch inplannen.
            </p>
            <Button
              variant="outline"
              disabled={aiBezig}
              onClick={() => onNieuw(term, null, datum, moment)}
              className="mt-3 h-14 w-full text-base"
            >
              <Type className="size-5" /> Enkel als tekst inplannen
            </Button>
            <Button
              disabled={aiBezig}
              onClick={() => maakVoorstel(term)}
              className="mt-2 h-14 w-full text-base"
            >
              {aiBezig ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Sparkles className="size-5" />
              )}
              {aiBezig ? "AI maakt het recept…" : "Met AI invullen"}
            </Button>
          </div>
        )}

        <div className="mt-3 flex-1 space-y-5 overflow-y-auto pb-2">
          {term ? (
            treffers.length === 0 ? (
              <p className="py-6 text-center text-lg text-muted-foreground">
                Geen recepten gevonden.
              </p>
            ) : (
              <ul className="space-y-2">
                {treffers.map((r) => (
                  <li key={r.id}>
                    <GerechtKaart
                      recept={r}
                      onKies={() => onKies(r.id, datum, moment, r.title)}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : groepen.length === 0 ? (
            <p className="py-6 text-center text-lg text-muted-foreground">
              Je hebt nog geen recepten. Typ hierboven een naam om er eentje in te plannen.
            </p>
          ) : (
            groepen.map((g) => (
              <section key={g.titel}>
                <h3 className="mb-2 text-base font-semibold text-muted-foreground">{g.titel}</h3>
                <ul className="space-y-2">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      <GerechtKaart
                        recept={r}
                        onKies={() => onKies(r.id, datum, moment, r.title)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
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
