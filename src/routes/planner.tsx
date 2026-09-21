import { useEffect, useRef, useState } from "react";
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
  Settings,
  CookingPot,
  RefreshCw,
  Lightbulb,
  Globe,
  CalendarDays,
  Clock3,
  Utensils,
  BookOpen,
  WandSparkles,
  MoreVertical,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { type Recipe } from "@/lib/types";
import {
  importRecipeFromText,
  importRecipeFromUrl,
  receptVanNaam,
  weekmenuIdeeen,
  zoekReceptenOpWeb,
  type WeekmenuIdee,
  type WebResultaat,
} from "@/lib/ai.functions";
import {
  useVoorkeuren,
  ALLE_MOMENTEN,
  type WeekmenuInstelling,
  type DagVoorkeur,
} from "@/lib/voorkeuren";
import { kiesUitEigen, type DagRegel, type Soortkeuze } from "@/lib/weekmenu-voorstel";
import { zorgVoorLijst, maakLijst, voegToeAanLijst, type ShoppingList } from "@/lib/boodschappen";
import { tijdLabel } from "@/lib/tijd";
import { useSignedUrl } from "@/lib/photos";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

function weekLabel(start: Date, kort = false) {
  const einde = new Date(start);
  einde.setDate(einde.getDate() + 6);
  const zelfdeMaand = start.getMonth() === einde.getMonth() && start.getFullYear() === einde.getFullYear();
  const beginTekst = zelfdeMaand
    ? String(start.getDate())
    : start.toLocaleDateString("nl-BE", { day: "numeric", month: kort ? "short" : "long" });
  const eindeTekst = einde.toLocaleDateString("nl-BE", {
    day: "numeric",
    month: kort ? "short" : "long",
  });
  return `${beginTekst} – ${eindeTekst}`;
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
  image_url?: string | null;
  source_url?: string | null;
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
  const [opruimVraag, setOpruimVraag] = useState<{ titel: string; items: { id: string; naam: string }[] } | null>(null);
  const [naVoorstel, setNaVoorstel] = useState<{ recipeId: string; titel: string }[] | null>(null);
  const [naGekozen, setNaGekozen] = useState<Set<string>>(new Set());

  const [weergave, setWeergave] = useState<"mij" | "gezin">("mij");
  const [instellingenOpen, setInstellingenOpen] = useState(false);
  const [voorstelOpen, setVoorstelOpen] = useState(false);
  const [kalenderOpen, setKalenderOpen] = useState(false);
  const [boodschappenOpen, setBoodschappenOpen] = useState(false);

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
  const voorstelDagen = zichtbareDagen.filter((dag) => dag >= vandaag);
  const huidigeWeek = maandagVan(new Date());
  const weekVerschil = Math.round((weekStart.getTime() - huidigeWeek.getTime()) / 604800000);
  const snelleWeken = [0, 1, 2, 3].map((stap) => {
    const start = new Date(huidigeWeek);
    start.setDate(start.getDate() + stap * 7);
    return start;
  });

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

  async function verwijder(id: string, recipeId?: string | null, titel?: string) {
    await supabase.from("meal_plan").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
    if (!recipeId) return;
    // Staan de ingrediënten van dit gerecht nog op een boodschappenlijst?
    const { data } = await supabase
      .from("shopping_items")
      .select("id, name, quantity, unit, checked")
      .eq("recipe_id", recipeId)
      .eq("checked", false);
    if (data?.length) {
      setOpruimVraag({
        titel: titel ?? "Dit gerecht",
        items: data.map((r) => ({
          id: r.id as string,
          naam: [r.quantity ?? "", r.unit ?? "", r.name].join(" ").replace(/\s+/g, " ").trim(),
        })),
      });
    }
  }

  async function opruimenBevestigen() {
    if (!opruimVraag) return;
    await supabase
      .from("shopping_items")
      .delete()
      .in("id", opruimVraag.items.map((i) => i.id));
    setOpruimVraag(null);
    qc.invalidateQueries({ queryKey: ["shopping"] });
    toast.success("Ingrediënten van je boodschappenlijst gehaald");
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

  /** Zet de aangevinkte dagen uit het voorstel in het weekmenu. */
  async function zetVoorstel(
    rijen: { datum: string; moment: string; recept: Recipe | null; idee: WeekmenuIdee | null }[],
  ) {
    if (!user) return;
    let gelukt = 0;
    const ingepland: { recipeId: string; titel: string }[] = [];
    for (const rij of rijen) {
      try {
        let recipeId = rij.recept?.id ?? null;
        if (!recipeId && rij.idee) {
          const basis = await receptVanNaam({ data: { titel: rij.idee.title, hint: "" } });
          const { data, error } = await supabase
            .from("recipes")
            .insert({
              user_id: user.id,
              title: basis.title || rij.idee.title,
              description: basis.description ?? "",
              servings: basis.servings ?? 4,
              prep_minutes: basis.prep_minutes ?? 0,
              cook_minutes: basis.cook_minutes ?? 0,
              category: basis.category ?? "hoofdgerecht",
              difficulty: basis.difficulty ?? "makkelijk",
              tags: basis.tags ?? [],
              instructions: basis.instructions ?? [],
            })
            .select("id")
            .single();
          if (error) throw error;
          recipeId = data.id;
          if (basis.ingredients?.length) {
            await supabase.from("recipe_ingredients").insert(
              basis.ingredients.map((i, index) => ({
                recipe_id: recipeId!,
                name: i.name,
                quantity: i.quantity,
                unit: i.unit,
                position: index,
              })),
            );
          }
        }
        if (!recipeId) continue;
        const { error } = await supabase.from("meal_plan").insert({
          user_id: user.id,
          recipe_id: recipeId,
          plan_date: rij.datum,
          meal_type: rij.moment,
          group_id: weergave === "gezin" ? gezin!.id : null,
        });
        if (error) throw error;
        gelukt += 1;
        ingepland.push({ recipeId, titel: rij.recept?.title ?? rij.idee?.title ?? "Gerecht" });
      } catch {
        toast.error(`${labelVoor(rij.datum)} inplannen lukte niet`);
      }
    }
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
    if (gelukt) toast.success(`${gelukt} ${gelukt === 1 ? "dag" : "dagen"} ingepland`);
    setVoorstelOpen(false);
    if (ingepland.length) {
      setNaVoorstel(ingepland);
      setNaGekozen(new Set(ingepland.map((r) => r.recipeId)));
    }
  }

  /** Alle aangevinkte gerechten in één keer op de boodschappenlijst zetten. */
  async function zetAllesOpLijst() {
    if (!user || !naVoorstel) return;
    const ids = naVoorstel.filter((r) => naGekozen.has(r.recipeId)).map((r) => r.recipeId);
    if (!ids.length) {
      setNaVoorstel(null);
      return;
    }
    const listId =
      (weergave === "gezin" && gezinsLijst ? gezinsLijst.id : lijstId || lijsten[0]?.id) ||
      (await zorgVoorLijst(user.id));
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("name, quantity, unit, recipe_id")
      .in("recipe_id", ids);
    if (error || !data?.length) {
      toast.error("Geen ingrediënten gevonden");
      setNaVoorstel(null);
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
    setNaVoorstel(null);
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
          image_url: basis.image_url ?? null,
          source_url: basis.source_url ?? null,
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
      <div className="space-y-5">
        <section aria-label="Week kiezen" className="space-y-3">
          <div className="flex items-center gap-2">
            {gezin ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="h-14 min-w-0 flex-1 justify-between px-4">
                    <span className="flex min-w-0 items-center gap-2">
                      {weergave === "gezin" ? <Users className="size-5 shrink-0" /> : <CalendarDays className="size-5 shrink-0" />}
                      <span className="truncate">{weergave === "gezin" ? gezin.naam : "Mijn planning"}</span>
                    </span>
                    <ChevronRight className="size-4 rotate-90" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 p-2">
                  <DropdownMenuItem onSelect={() => setWeergave("mij")} className="min-h-12 rounded-lg text-base">
                    <CalendarDays className="size-5" /> Mijn planning
                    {weergave === "mij" ? <Check className="ml-auto size-5" /> : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setWeergave("gezin")} className="min-h-12 rounded-lg text-base">
                    <Users className="size-5" /> {gezin.naam}
                    {weergave === "gezin" ? <Check className="ml-auto size-5" /> : null}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex h-14 min-w-0 flex-1 items-center gap-2 rounded-xl bg-secondary px-4 font-semibold">
                <CalendarDays className="size-5 text-primary" /> Mijn planning
              </div>
            )}
            <Button
              variant="secondary"
              onClick={() => setInstellingenOpen(true)}
              aria-label="Instellingen weekmenu"
              className="size-14 shrink-0"
            >
              <Settings className="size-5" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
          <Button
              variant="ghost"
              onClick={() => verschuif(-1)}
              aria-label="Vorige week"
              className="size-12 shrink-0"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Popover open={kalenderOpen} onOpenChange={setKalenderOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-12 min-w-0 flex-1 px-2 font-display text-lg">
                  <span className="truncate">{weekVerschil === 0 ? "Deze week" : weekLabel(new Date(`${week[0]}T12:00:00`), true)}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={weekStart}
                  onSelect={(datum) => {
                    if (!datum) return;
                    setWeekStart(maandagVan(datum));
                    setKalenderOpen(false);
                  }}
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              onClick={() => verschuif(1)}
              aria-label="Volgende week"
              className="size-12 shrink-0"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>

          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Snel een week kiezen">
            {snelleWeken.map((start, index) => {
              const actief = datumTekst(start) === datumTekst(weekStart);
              const labels = ["Nu", "Volgende", "+2", "+3"];
              return (
                <Button
                  key={datumTekst(start)}
                  variant={actief ? "default" : "outline"}
                  onClick={() => setWeekStart(start)}
                  className="h-12 shrink-0 rounded-full px-5 text-sm"
                  aria-pressed={actief}
                >
                  {labels[index]}
                </Button>
              );
            })}
            {weekVerschil < 0 || weekVerschil > 3 ? (
              <Button variant="default" className="h-12 shrink-0 rounded-full px-5 text-sm">
                {weekLabel(weekStart, true)}
              </Button>
            ) : null}
          </div>
          {weekVerschil !== 0 ? (
            <Button variant="ghost" onClick={() => setWeekStart(huidigeWeek)} className="h-11 px-2 text-sm">
              Terug naar deze week
            </Button>
          ) : null}
        </section>

        <section aria-label="Acties" className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const startDag = voorstelDagen.includes(vandaag) ? vandaag : voorstelDagen[0];
              if (!startDag) {
                toast("Kies een huidige of volgende week om een maaltijd toe te voegen.");
                return;
              }
              setKiezen({ datum: startDag, moment: momenten[momenten.length - 1] ?? "avondeten", vraagDag: true });
            }}
            className="h-16 min-w-0 flex-col gap-1 px-1 text-xs sm:flex-row sm:text-base"
          >
            <Plus className="size-5" /> Toevoegen
          </Button>
          <Button
            onClick={() => {
              if (!voorstelDagen.length) {
                toast("Er zijn in deze week geen komende dagen meer. Kies een volgende week.");
                return;
              }
              setVoorstelOpen(true);
            }}
            className="h-16 min-w-0 flex-col gap-1 px-1 text-xs sm:flex-row sm:text-base"
          >
            <Sparkles className="size-5" /> Foodlo kiest
          </Button>
          <Button
            variant="outline"
            onClick={() => setBoodschappenOpen(true)}
            className="h-16 min-w-0 flex-col gap-1 px-1 text-xs sm:flex-row sm:text-base"
          >
            <ShoppingCart className="size-5" /> Naar lijst
          </Button>
        </section>

        <div className={weekmenu.weergave === "kaarten" ? "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2" : "space-y-1"}>
        {zichtbareDagen.map((dag) => {
          const items = plan.filter((p) => p.plan_date === dag);
          const openMomenten = momenten.filter((m) => !items.some((p) => p.meal_type === m));
          const volledig = momenten.length > 0 && openMomenten.length === 0;
          const datum = new Date(`${dag}T12:00:00`);
          const kaart = weekmenu.weergave === "kaarten" ? "w-[88%] shrink-0 snap-start rounded-xl border border-border bg-card p-4 " : "grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-3 ";
          return (
            <section key={dag} className={kaart} aria-labelledby={`dag-${dag}`}>
              <div className={weekmenu.weergave === "kaarten" ? "mb-3 flex items-center gap-3" : "relative flex flex-col items-center"}>
                <div className={dag === vandaag ? "flex size-14 flex-col items-center justify-center rounded-xl bg-accent text-accent-foreground" : "flex size-14 flex-col items-center justify-center rounded-xl bg-secondary text-foreground"}>
                  <span className="text-xs font-bold uppercase">{datum.toLocaleDateString("nl-BE", { weekday: "short" }).replace(".", "")}</span>
                  <span className="font-display text-xl font-semibold leading-none">{datum.getDate()}</span>
                </div>
                {weekmenu.weergave !== "kaarten" ? <span aria-hidden className="absolute top-16 bottom-[-1.25rem] w-px border-l border-dashed border-border last:hidden" /> : null}
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex min-h-6 items-center gap-2">
                  <h2 id={`dag-${dag}`} className="font-display text-lg capitalize">{datum.toLocaleDateString("nl-BE", { weekday: "long" })}</h2>
                  {dag === vandaag ? <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">Vandaag</span> : null}
                  {volledig ? <Check className="ml-auto size-4 text-primary" aria-label="Volledig gepland" /> : null}
                </div>

                {items.length > 0 ? (
                  <ul className="space-y-2">
                  {items.map((p) => (
                    <li key={p.id} className="flex min-h-20 items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
                      {p.recipe_id ? <Link to="/recepten/$id" params={{ id: p.recipe_id }} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ReceptFoto url={p.recipes?.image_url ?? null} /><span className="min-w-0"><span className="block text-xs font-semibold capitalize text-muted-foreground">{p.meal_type}</span><span className="block text-base font-semibold leading-tight">{p.recipes?.title ?? "Recept"}</span>{p.recipes ? <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" /> {tijdLabel(p.recipes.prep_minutes, p.recipes.cook_minutes) || "Tijd niet ingevuld"}</span> : null}</span></Link> : <div className="flex min-w-0 flex-1 items-center gap-3"><ReceptFoto url={null} /><span className="min-w-0"><span className="block text-xs font-semibold capitalize text-muted-foreground">{p.meal_type}</span><span className="block text-base font-semibold leading-tight">{p.custom_title}</span></span></div>}
                      {weergave === "gezin" && p.user_id !== user?.id ? <Avatar naam={plannerNamen[p.user_id] ?? "?"} sleutel={p.user_id} className="size-8 shrink-0 text-xs" /> : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" aria-label={`Acties voor ${p.recipes?.title ?? p.custom_title ?? "maaltijd"}`} className="size-12 shrink-0"><MoreVertical className="size-5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60 p-2">
                          {p.recipe_id ? <DropdownMenuItem onSelect={() => setVraagLijst({ recipeId: p.recipe_id as string, titel: p.recipes?.title ?? "Recept" })} className="min-h-12 rounded-lg text-base"><ShoppingCart className="size-5" /> Op boodschappenlijst</DropdownMenuItem> : null}
                          <DropdownMenuItem onSelect={() => void verwijder(p.id, p.recipe_id, p.recipes?.title ?? "Dit gerecht")} className="min-h-12 rounded-lg text-base text-destructive focus:text-destructive"><Trash2 className="size-5" /> Uit planning halen</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                  </ul>
                ) : null}

                <div className="mt-2 space-y-2">
                  {dag >= vandaag ? openMomenten.map((m) => <Button key={m} variant="ghost" onClick={() => setKiezen({ datum: dag, moment: m })} className="h-14 w-full justify-start border border-dashed border-border bg-background px-3 text-sm text-muted-foreground"><Plus className="size-4" /> <span className="capitalize">{m}</span> toevoegen</Button>) : !volledig ? <p className="py-2 text-sm text-muted-foreground">Deze dag is voorbij</p> : null}
                </div>
              </div>
            </section>
          );
        })}
        </div>
      </div>

      <Sheet open={boodschappenOpen} onOpenChange={setBoodschappenOpen}>
        <SheetContent side="bottom" className="space-y-5">
          <SheetHeader>
            <SheetTitle>Boodschappen voor deze week</SheetTitle>
            <SheetDescription>Zet de ingrediënten van alle geplande recepten in één keer op een lijst.</SheetDescription>
          </SheetHeader>
          {lijsten.length > 1 ? <select value={lijstId || (weergave === "gezin" && gezinsLijst ? gezinsLijst.id : lijsten[0]?.id ?? "")} onChange={(e) => setLijstId(e.target.value)} aria-label="Naar welk lijstje?" className="h-14 w-full rounded-xl border border-input bg-card px-3 text-base">{lijsten.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select> : null}
          <Button onClick={() => { void alleBoodschappen(); setBoodschappenOpen(false); }} disabled={!plan.length} className="h-14 w-full text-base"><ShoppingCart className="size-5" /> Hele week op de lijst</Button>
          <Button variant="outline" asChild className="h-14 w-full text-base"><Link to="/boodschappen">Open boodschappen</Link></Button>
        </SheetContent>
      </Sheet>

      {instellingenOpen && (
        <WeekmenuInstellingen
          instelling={weekmenu}
          algemeneMomenten={algemeneMomenten}
          onZet={zetWeekmenu}
          onSluit={() => setInstellingenOpen(false)}
        />
      )}

      {voorstelOpen && (
        <WeekmenuVoorstel
          week={voorstelDagen}
          momenten={momenten}
          instelling={weekmenu}
          zetInstelling={zetWeekmenu}
          bezet={new Set(plan.map((p) => `${p.plan_date}|${p.meal_type}`))}
          alGepland={
            new Set(plan.map((p) => p.recipe_id).filter((id): id is string => !!id))
          }
          onSluit={() => setVoorstelOpen(false)}
          onZet={zetVoorstel}
        />
      )}

      {kiezen && (
        <ReceptKiezer
          week={voorstelDagen}
          momenten={momenten}
          instelling={weekmenu}
          start={kiezen}
          onSluit={() => setKiezen(null)}
          onKies={plan_toevoegen}
          onNieuw={nieuw_gerecht}
        />
      )}

      {opruimVraag && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl">
            <h2 className="font-display text-xl">Ook de ingrediënten weghalen?</h2>
            <p className="mt-2 text-base text-muted-foreground">
              {opruimVraag.titel} staat niet meer in je weekmenu. Deze boodschappen staan er nog wel op:
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-base">
              {opruimVraag.items.map((i) => (
                <li key={i.id} className="rounded-lg bg-secondary px-3 py-2">{i.naam}</li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setOpruimVraag(null)} className="h-14 flex-1 text-base">
                Laat staan
              </Button>
              <Button onClick={() => void opruimenBevestigen()} className="h-14 flex-1 text-base">
                <Trash2 className="size-5" /> Weghalen
              </Button>
            </div>
          </div>
        </div>
      )}

      {naVoorstel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-card p-5 sm:rounded-3xl">
            <h2 className="font-display text-xl">Alles op je boodschappenlijst?</h2>
            <p className="mt-2 text-base text-muted-foreground">
              Kies voor welke gerechten we de ingrediënten toevoegen.
            </p>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {naVoorstel.map((r) => (
                <li key={r.recipeId}>
                  <button
                    type="button"
                    onClick={() =>
                      setNaGekozen((oud) => {
                        const set = new Set(oud);
                        if (set.has(r.recipeId)) set.delete(r.recipeId);
                        else set.add(r.recipeId);
                        return set;
                      })
                    }
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-secondary px-3 text-left text-base"
                  >
                    <span
                      className={
                        naGekozen.has(r.recipeId)
                          ? "flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
                          : "flex size-7 items-center justify-center rounded-md border-2 border-border"
                      }
                    >
                      {naGekozen.has(r.recipeId) ? <Check className="size-5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">{r.titel}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setNaVoorstel(null)} className="h-14 flex-1 text-base">
                Niet nu
              </Button>
              <Button onClick={() => void zetAllesOpLijst()} className="h-14 flex-1 text-base">
                <ShoppingCart className="size-5" /> Toevoegen
              </Button>
            </div>
          </div>
        </div>
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
  instelling,
  start,
  onSluit,
  onKies,
  onNieuw,
}: {
  week: string[];
  momenten: string[];
  instelling: WeekmenuInstelling;
  start: { datum: string; moment: string; vraagDag?: boolean };
  onSluit: () => void;
  onKies: (id: string, datum: string, moment: string, titel: string) => void;
  onNieuw: (naam: string, basis: Basis | null, datum: string, moment: string) => void;
}) {
  const { user } = useAuth();
  const { taal } = useVoorkeuren();
  const [zoek, setZoek] = useState("");
  const [datum, setDatum] = useState(start.datum);
  const [moment, setMoment] = useState(start.moment);
  const [dagKiezen, setDagKiezen] = useState(!!start.vraagDag);
  const [aiBezig, setAiBezig] = useState(false);
  const [voorstel, setVoorstel] = useState<Basis | null>(null);
  const [voorstelNaam, setVoorstelNaam] = useState("");
  const [ideeen, setIdeeen] = useState<WeekmenuIdee[] | null>(null);
  const [ideeenBezig, setIdeeenBezig] = useState(false);
  const [webOpen, setWebOpen] = useState(false);
  const [webTerm, setWebTerm] = useState("");
  const [webBezig, setWebBezig] = useState(false);
  const [webResultaten, setWebResultaten] = useState<WebResultaat[] | null>(null);

  /** Zet een AI- of webrecept klaar in het bevestigscherm. */
  function toonVoorstel(
    naam: string,
    r: {
      title: string;
      description?: string | null;
      servings?: number;
      prep_minutes?: number;
      cook_minutes?: number;
      category?: string;
      difficulty?: string;
      tags?: string[];
      instructions?: string[];
      image_url?: string | null;
      source_url?: string | null;
      ingredients?: { name: string; quantity: number | null; unit: string }[];
    },
  ) {
    setVoorstelNaam(r.title || naam);
    setVoorstel({
      title: r.title || naam,
      description: r.description ?? "",
      servings: r.servings ?? 4,
      prep_minutes: r.prep_minutes ?? 0,
      cook_minutes: r.cook_minutes ?? 0,
      category: r.category ?? "hoofdgerecht",
      difficulty: r.difficulty ?? "makkelijk",
      tags: r.tags ?? [],
      instructions: r.instructions ?? [],
      image_url: r.image_url ?? null,
      source_url: r.source_url ?? null,
      ingredienten: (r.ingredients ?? []).map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit ?? "",
      })),
    });
  }

  /** Drie passende AI-ideeën voor deze dag, met je weekvoorkeuren. */
  async function laadIdeeen() {
    setIdeeenBezig(true);
    try {
      const dagIdx = (new Date(`${datum}T12:00:00`).getDay() + 6) % 7;
      const dagVoorkeur = instelling.perDag[String(dagIdx)];
      const wensen = [
        instelling.vlees ? `vlees: ${instelling.vlees}` : "",
        instelling.vis ? `vis: ${instelling.vis}` : "",
        instelling.vega ? `vega: ${instelling.vega}` : "",
        dagVoorkeur?.soort ? `deze dag liefst ${dagVoorkeur.soort}` : "",
      ]
        .filter(Boolean)
        .join(", ");
      const res = await weekmenuIdeeen({
        data: {
          aantal: 3,
          wensen,
          vermijd: instelling.vermijd,
          maxMinuten: dagVoorkeur?.maxMinuten ?? instelling.maxMinuten,
          bekend: recipes.map((r) => r.title).slice(0, 60),
        },
      });
      setIdeeen(res);
      if (!res.length) toast.error("De AI vond nu geen ideeën. Probeer later opnieuw.");
    } catch {
      toast.error("Ideeën ophalen lukte niet");
    } finally {
      setIdeeenBezig(false);
    }
  }

  /** Maakt van een gekozen idee meteen een volledig recept om te bevestigen. */
  async function maakReceptVanIdee(titel: string) {
    setAiBezig(true);
    try {
      const r = await receptVanNaam({
        data: { titel, hint: instelling.vermijd ? `Vermijd: ${instelling.vermijd}` : "" },
      });
      toonVoorstel(titel, r);
    } catch {
      toast.error("De AI kon geen recept maken. Probeer opnieuw.");
    } finally {
      setAiBezig(false);
    }
  }

  /** Zoekt echte receptpagina's op het web (gratis). */
  async function zoekWeb(zoekterm: string) {
    const opgekuist = zoekterm.trim();
    if (opgekuist.length < 3) return;
    setWebBezig(true);
    try {
      const taalkeuze = (["nl", "en", "fr", "de"].includes(taal) ? taal : "nl") as
        | "nl"
        | "en"
        | "fr"
        | "de";
      const res = await zoekReceptenOpWeb({ data: { term: opgekuist, taal: taalkeuze } });
      setWebResultaten(res);
      if (!res.length) toast.error("Geen receptpagina's gevonden. Probeer een andere naam.");
    } catch {
      toast.error("Zoeken op het web lukte niet");
    } finally {
      setWebBezig(false);
    }
  }

  /** Leest het gekozen webrecept in en toont het ter bevestiging. */
  async function kiesWeb(r: WebResultaat) {
    setWebBezig(true);
    try {
      const imp = await importRecipeFromUrl({ data: { url: r.url } });
      if (!imp.title || imp.fout) {
        toast.error(imp.fout || "Op die pagina staat geen leesbaar recept");
        return;
      }
      toonVoorstel(imp.title, imp);
    } catch {
      toast.error("Recept inlezen lukte niet");
    } finally {
      setWebBezig(false);
    }
  }

  async function maakVoorstel(naam: string) {
    setAiBezig(true);
    setVoorstelNaam(naam);
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
              onClick={() => onNieuw(voorstelNaam || voorstel.title, voorstel, datum, moment)}
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
              onClick={() => onNieuw(voorstelNaam || voorstel.title, voorstel, datum, moment)}
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
            <h2 className="font-display text-xl">Wanneer wil je iets plannen?</h2>
            <Button variant="ghost" onClick={onSluit} aria-label="Sluiten" className="size-12">
              <X className="size-6" />
            </Button>
          </div>

          <p className="mb-3 mt-1 text-base capitalize text-muted-foreground">{labelVoor(datum)}</p>

          {dagKeuze}

          <Button onClick={() => setDagKiezen(false)} className="mt-4 h-14 w-full text-base">
            Kies een maaltijd
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

        {!term && (
          <div className="mt-3 rounded-2xl border border-border bg-secondary/60 p-3">
            <p className="text-base font-semibold">Geen inspiratie?</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={ideeenBezig || aiBezig}
                onClick={() => void laadIdeeen()}
                className="h-14 text-base"
              >
                {ideeenBezig ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Lightbulb className="size-5" />
                )}
                {ideeenBezig ? "AI denkt…" : "AI-ideeën"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setWebOpen((v) => !v)}
                aria-expanded={webOpen}
                className="h-14 text-base"
              >
                <Globe className="size-5" /> Van het web
              </Button>
            </div>

            {webOpen && (
              <div className="mt-2 flex gap-2">
                <Input
                  value={webTerm}
                  onChange={(e) => setWebTerm(e.target.value)}
                  placeholder="Naam van een gerecht"
                  aria-label="Zoek een gerecht op het web"
                  className="h-14 text-base"
                />
                <Button
                  disabled={webBezig || webTerm.trim().length < 3}
                  onClick={() => void zoekWeb(webTerm)}
                  className="h-14 shrink-0 text-base"
                >
                  {webBezig ? <Loader2 className="size-5 animate-spin" /> : "Zoek"}
                </Button>
              </div>
            )}

            {ideeen && ideeen.length > 0 && (
              <ul className="mt-2 space-y-2">
                {ideeen.map((idee) => (
                  <li key={idee.title}>
                    <button
                      type="button"
                      disabled={aiBezig}
                      onClick={() => void maakReceptVanIdee(idee.title)}
                      className="w-full rounded-xl border border-border bg-card p-3 text-left disabled:opacity-60"
                    >
                      <span className="block text-base font-semibold">{idee.title}</span>
                      <span className="block text-sm text-muted-foreground">
                        {[idee.waarom, `±${idee.minuten} min`].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {aiBezig && (
              <p className="mt-2 text-sm text-muted-foreground">
                AI maakt het recept klaar…
              </p>
            )}
          </div>
        )}

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
            <Button
              variant="outline"
              disabled={webBezig}
              onClick={() => void zoekWeb(term)}
              className="mt-2 h-14 w-full text-base"
            >
              {webBezig ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Globe className="size-5" />
              )}
              {webBezig ? "Aan het zoeken…" : "Zoek echte recepten op het web"}
            </Button>
          </div>
        )}

        <div className="mt-3 flex-1 space-y-5 overflow-y-auto pb-2">
          {webResultaten && webResultaten.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-muted-foreground">
                  Recepten van het web
                </h3>
                <button
                  type="button"
                  onClick={() => setWebResultaten(null)}
                  className="min-h-11 text-sm text-muted-foreground underline underline-offset-4"
                >
                  Verberg
                </button>
              </div>
              <ul className="space-y-2">
                {webResultaten.map((r) => (
                  <li key={r.url}>
                    <button
                      type="button"
                      disabled={webBezig}
                      onClick={() => void kiesWeb(r)}
                      className="w-full rounded-xl border border-border bg-secondary p-3 text-left disabled:opacity-60"
                    >
                      <span className="block text-base font-semibold">{r.titel}</span>
                      <span className="block text-sm text-muted-foreground">
                        {[r.site, r.minuten ? `±${r.minuten} min` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {webBezig && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Het recept wordt ingelezen…
                </p>
              )}
            </section>
          )}
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

const DAG_NAMEN = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

/** Het tandwiel: hier stel je in hoe jouw weekmenu eruitziet. */
function WeekmenuInstellingen({
  instelling,
  algemeneMomenten,
  onZet,
  onSluit,
}: {
  instelling: WeekmenuInstelling;
  algemeneMomenten: string[];
  onZet: (deel: Partial<WeekmenuInstelling>) => void;
  onSluit: () => void;
}) {
  const momenten = instelling.momenten.length ? instelling.momenten : algemeneMomenten;

  function wisselDag(n: number) {
    const aan = instelling.dagen.includes(n);
    onZet({ dagen: aan ? instelling.dagen.filter((d) => d !== n) : [...instelling.dagen, n].sort() });
  }

  function wisselMoment(m: string) {
    const aan = momenten.includes(m);
    const nieuw = aan ? momenten.filter((x) => x !== m) : [...momenten, m];
    onZet({ momenten: nieuw.length ? nieuw : [m] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl">Instellingen weekmenu</h2>
          <Button variant="ghost" onClick={onSluit} aria-label="Sluiten" className="size-12">
            <X className="size-5" />
          </Button>
        </div>

        <Accordion type="single" collapsible defaultValue="foodlo" className="mt-4">
          <AccordionItem value="foodlo">
            <AccordionTrigger className="min-h-16 text-left text-lg">Voorstellen door Foodlo</AccordionTrigger>
            <AccordionContent className="pb-5">
            <p className="text-base text-muted-foreground">Hoeveel keer per week?</p>
            <div className="mt-2 space-y-2">
              {([
                { id: "vlees", label: "Vlees" },
                { id: "vis", label: "Vis" },
                { id: "vega", label: "Vegetarisch" },
              ] as const).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold">{o.label}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      aria-label={`${o.label} minder`}
                      onClick={() => onZet({ [o.id]: Math.max(0, instelling[o.id] - 1) })}
                      className="size-12 text-lg"
                    >
                      –
                    </Button>
                    <span className="w-8 text-center text-lg font-semibold">{instelling[o.id]}</span>
                    <Button
                      variant="secondary"
                      aria-label={`${o.label} meer`}
                      onClick={() => onZet({ [o.id]: Math.min(7, instelling[o.id] + 1) })}
                      className="size-12 text-lg"
                    >
                      +
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-base text-muted-foreground">Hoelang mag koken duren?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { id: 20, label: "Max 20 min" },
                { id: 45, label: "Max 45 min" },
                { id: 90, label: "Rustig koken" },
                { id: 0, label: "Maakt niet uit" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={instelling.maxMinuten === t.id}
                  onClick={() => onZet({ maxMinuten: t.id })}
                  className={
                    instelling.maxMinuten === t.id
                      ? "min-h-12 rounded-xl bg-primary px-3 text-base font-semibold text-primary-foreground"
                      : "min-h-12 rounded-xl border border-border px-3 text-base font-semibold"
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            <label className="mt-4 block text-base text-muted-foreground" htmlFor="vermijd">
              Wat eet je liever niet?
            </label>
            <Input
              id="vermijd"
              value={instelling.vermijd}
              onChange={(e) => onZet({ vermijd: e.target.value })}
              placeholder="bv. paddenstoelen, bloemkool"
              className="mt-1 h-14 text-base"
            />
            <p className="mt-4 text-base text-muted-foreground">Waaruit mag Foodlo kiezen?</p>
            <div className="mt-2 grid gap-2">
              {([
                { id: "eigen", label: "Alleen mijn recepten" },
                { id: "ook-extern", label: "Ook nieuwe ideeën" },
              ] as const).map((optie) => (
                <Button
                  key={optie.id}
                  type="button"
                  variant={instelling.bron === optie.id ? "default" : "secondary"}
                  onClick={() => onZet({ bron: optie.id })}
                  className="h-14 justify-start text-base"
                >
                  {optie.label}
                </Button>
              ))}
            </div>
            {Object.keys(instelling.perDag).length ? (
              <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-base text-muted-foreground">
                Je vaste voorkeuren per weekdag worden hier automatisch meegeteld. Je kunt ze bij elk voorstel aanpassen.
              </p>
            ) : null}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="weergave">
            <AccordionTrigger className="min-h-16 text-left text-lg">Weergave</AccordionTrigger>
            <AccordionContent className="pb-5">
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([
                { id: "lijst", label: "Onder elkaar" },
                { id: "kaarten", label: "Naast elkaar (swipen)" },
              ] as const).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={instelling.weergave === o.id}
                  onClick={() => onZet({ weergave: o.id })}
                  className={
                    instelling.weergave === o.id
                      ? "min-h-14 rounded-xl bg-primary px-3 text-base font-semibold text-primary-foreground"
                      : "min-h-14 rounded-xl border border-border px-3 text-base font-semibold"
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dagen">
            <AccordionTrigger className="min-h-16 text-left text-lg">Dagen en momenten</AccordionTrigger>
            <AccordionContent className="space-y-5 pb-5">
          <div>
            <h3 className="text-base font-semibold">De week begint op</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([
                { id: 0, label: "Maandag" },
                { id: 6, label: "Zondag" },
              ] as const).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={instelling.startdag === o.id}
                  onClick={() => onZet({ startdag: o.id })}
                  className={
                    instelling.startdag === o.id
                      ? "min-h-14 rounded-xl bg-primary px-3 text-base font-semibold text-primary-foreground"
                      : "min-h-14 rounded-xl border border-border px-3 text-base font-semibold"
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold">Welke dagen toon je?</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAG_NAMEN.map((naam, n) => (
                <button
                  key={naam}
                  type="button"
                  aria-pressed={instelling.dagen.includes(n)}
                  onClick={() => wisselDag(n)}
                  className={
                    instelling.dagen.includes(n)
                      ? "min-h-12 rounded-xl bg-primary px-4 text-base font-semibold capitalize text-primary-foreground"
                      : "min-h-12 rounded-xl border border-border px-4 text-base font-semibold capitalize"
                  }
                >
                  {naam.slice(0, 2)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold">Welke dagdelen plan je?</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALLE_MOMENTEN.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={momenten.includes(m)}
                  onClick={() => wisselMoment(m)}
                  className={
                    momenten.includes(m)
                      ? "min-h-12 rounded-xl bg-primary px-4 text-base font-semibold capitalize text-primary-foreground"
                      : "min-h-12 rounded-xl border border-border px-4 text-base font-semibold capitalize"
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button onClick={onSluit} className="mt-6 h-14 w-full text-base">
          Klaar
        </Button>
      </div>
    </div>
  );
}

/** Kleine foto bij een ingepland gerecht. */
function ReceptFoto({ url }: { url: string | null }) {
  const [mislukt, setMislukt] = useState(false);
  const echteUrl = useSignedUrl(url);
  useEffect(() => setMislukt(false), [echteUrl]);
  if (echteUrl && !mislukt) {
    return (
      <img
        src={echteUrl}
        alt=""
        loading="lazy"
        onError={() => setMislukt(true)}
        className="size-14 shrink-0 rounded-full object-cover ring-1 ring-border"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary ring-1 ring-border"
    >
      <CookingPot className="size-6 text-primary" />
    </span>
  );
}

function VoorstelFoto({ url }: { url: string | null }) {
  const [mislukt, setMislukt] = useState(false);
  const echteUrl = useSignedUrl(url);
  useEffect(() => setMislukt(false), [echteUrl]);
  if (echteUrl && !mislukt) {
    return (
      <img
        src={echteUrl}
        alt=""
        onError={() => setMislukt(true)}
        className="aspect-[16/9] w-full object-cover"
      />
    );
  }
  return (
    <div className="grid aspect-[16/7] place-items-center bg-secondary">
      <CookingPot className="size-12 text-primary" />
    </div>
  );
}

const TIJD_KEUZES = [
  { id: 20, label: "Snel (max 20 min)" },
  { id: 45, label: "Gewoon (max 45 min)" },
  { id: 90, label: "Rustig koken" },
  { id: 0, label: "Maakt niet uit" },
];

const SOORT_KEUZES: { id: Soortkeuze; label: string }[] = [
  { id: null, label: "Foodlo kiest" },
  { id: "vlees", label: "Vlees" },
  { id: "vis", label: "Vis" },
  { id: "vega", label: "Vegetarisch" },
];

type Rij = {
  datum: string;
  moment: string;
  recept: Recipe | null;
  idee: WeekmenuIdee | null;
  bezet: boolean;
  aan: boolean;
};

function weekdagVan(datum: string) {
  return String((new Date(`${datum}T12:00:00`).getDay() + 6) % 7);
}

/** Foodlo stelt een weekmenu voor; jij vinkt aan wat je houdt. */
function WeekmenuVoorstel({
  week,
  momenten,
  instelling,
  zetInstelling,
  bezet,
  alGepland,
  onSluit,
  onZet,
}: {
  week: string[];
  momenten: string[];
  instelling: WeekmenuInstelling;
  zetInstelling: (deel: Partial<WeekmenuInstelling>) => void;
  bezet: Set<string>;
  /** Gerechten die deze week al ingepland staan; die stellen we niet opnieuw voor. */
  alGepland: Set<string>;
  onSluit: () => void;
  onZet: (rijen: Rij[]) => Promise<void>;
}) {
  const [stap, setStap] = useState<"vragen" | "voorstel">("vragen");
  const [dagen, setDagen] = useState<string[]>(week);
  const [gekozenMomenten, setGekozenMomenten] = useState<string[]>([
    momenten[momenten.length - 1] ?? "avondeten",
  ]);
  const [bron, setBron] = useState<"eigen" | "ook-extern">(instelling.bron);
  const [regels, setRegels] = useState<Record<string, DagVoorkeur>>({});
  const [rijen, setRijen] = useState<Rij[]>([]);
  const [bezigMet, setBezigMet] = useState("");
  const [actieveStap, setActieveStap] = useState(0);
  const [keuzeOpen, setKeuzeOpen] = useState(false);
  const [eigenZoek, setEigenZoek] = useState("");
  const getoondeRecepten = useRef<Record<string, string[]>>({});
  const getoondeIdeeen = useRef<string[]>([]);

  const { data: alleRecepten = [] } = useQuery({
    queryKey: ["voorstel-recepten"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as Recipe[];
    },
  });

  // Wat al in deze week staat, stellen we niet nog eens voor.
  const recepten = alleRecepten.filter((r) => !alGepland.has(r.id));

  const { data: ingredienten = {} } = useQuery({
    queryKey: ["voorstel-ingredienten"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, name")
        .limit(5000);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const i of data) {
        const id = i.recipe_id as string;
        (map[id] ??= []).push(i.name as string);
      }
      return map;
    },
  });

  const { data: recent = {} } = useQuery({
    queryKey: ["voorstel-recent"],
    queryFn: async () => {
      const grens = new Date();
      grens.setDate(grens.getDate() - 30);
      const { data, error } = await supabase
        .from("meal_plan")
        .select("recipe_id, plan_date")
        .gte("plan_date", datumTekst(grens));
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of data) if (r.recipe_id) map[r.recipe_id as string] = r.plan_date as string;
      return map;
    },
  });

  function regelVoor(datum: string): DagRegel {
    const eigen = regels[datum] ?? instelling.perDag[weekdagVan(datum)] ?? {};
    return {
      datum,
      moment: gekozenMomenten[0] ?? "avondeten",
      maxMinuten: eigen.maxMinuten ?? instelling.maxMinuten ?? 0,
      soort: eigen.soort ?? null,
      over: eigen.over ?? false,
    };
  }

  function alleRegels(): DagRegel[] {
    return dagen.flatMap((d) =>
      gekozenMomenten.map((m) => ({ ...regelVoor(d), moment: m })),
    );
  }

  async function maakVoorstel() {
    setBezigMet("Foodlo stelt je week samen…");
    try {
      const lijst = alleRegels();
      const keuzes = kiesUitEigen({
        recepten,
        ingredienten,
        regels: lijst,
        doelen: { vlees: instelling.vlees, vis: instelling.vis, vega: instelling.vega },
        vermijd: instelling.vermijd,
        recentPerRecept: recent,
        uitgesloten: getoondeRecepten.current,
      });
      const eersteKeuzes = new Map(keuzes.map((keuze) => [`${keuze.datum}|${keuze.moment}`, keuze]));
      for (const regel of lijst) {
        const sleutel = `${regel.datum}|${regel.moment}`;
        const keuze = eersteKeuzes.get(sleutel);
        if (keuze?.recept || !(getoondeRecepten.current[sleutel]?.length)) continue;
        const [herstart] = kiesUitEigen({
          recepten,
          ingredienten,
          regels: [regel],
          doelen: { vlees: 0, vis: 0, vega: 0 },
          vermijd: instelling.vermijd,
          recentPerRecept: recent,
        });
        if (herstart) eersteKeuzes.set(sleutel, herstart);
        getoondeRecepten.current[sleutel] = [];
      }
      const afgerondeKeuzes = lijst.map(
        (regel) => eersteKeuzes.get(`${regel.datum}|${regel.moment}`) ?? {
          datum: regel.datum,
          moment: regel.moment,
          recept: null,
        },
      );
      for (const keuze of afgerondeKeuzes) {
        if (!keuze.recept) continue;
        const sleutel = `${keuze.datum}|${keuze.moment}`;
        getoondeRecepten.current[sleutel] = [
          ...(getoondeRecepten.current[sleutel] ?? []),
          keuze.recept.id,
        ];
      }
      let nieuw: Rij[] = afgerondeKeuzes.map((k) => {
        const staatAl = bezet.has(`${k.datum}|${k.moment}`);
        const regel = lijst.find((r) => r.datum === k.datum && r.moment === k.moment);
        return {
          datum: k.datum,
          moment: k.moment,
          recept: k.recept,
          idee: null,
          bezet: staatAl,
          aan: false,
        };
      });

      const gaten = nieuw.filter((r) => !r.recept && !r.bezet && !regelVoor(r.datum).over);
      if (bron === "ook-extern" && gaten.length) {
        setBezigMet("Foodlo zoekt nieuwe ideeën…");
        const ideeen = await weekmenuIdeeen({
          data: {
            aantal: gaten.length,
            wensen: `${instelling.vlees}x vlees, ${instelling.vis}x vis, ${instelling.vega}x vegetarisch`,
            vermijd: instelling.vermijd,
            maxMinuten: instelling.maxMinuten,
            bekend: [...recepten.slice(0, 60).map((r) => r.title), ...getoondeIdeeen.current],
          },
        });
        let i = 0;
        nieuw = nieuw.map((r) => {
          if (r.recept || r.bezet || regelVoor(r.datum).over) return r;
          const idee = ideeen[i++] ?? null;
          return idee ? { ...r, idee, aan: false } : r;
        });
        getoondeIdeeen.current = [
          ...getoondeIdeeen.current,
          ...ideeen.map((idee) => idee.title),
        ];
      }
      const nogTePlannen = nieuw.filter((rij) => !rij.bezet && !regelVoor(rij.datum).over);
      if (!nogTePlannen.length) {
        toast("De gekozen dagen zijn al ingepland of overgeslagen");
        return;
      }
      setRijen(nogTePlannen);
      setActieveStap(0);
      setKeuzeOpen(false);
      setStap("voorstel");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voorstel maken lukte niet");
    } finally {
      setBezigMet("");
    }
  }

  function wissel(datum: string, moment: string) {
    const gebruikt = rijen
      .filter((r) => !(r.datum === datum && r.moment === moment))
      .map((r) => r.recept?.id)
      .filter((x): x is string => !!x);
    const huidig = rijen.find((r) => r.datum === datum && r.moment === moment)?.recept?.id;
    const sleutel = `${datum}|${moment}`;
    if (huidig) {
      getoondeRecepten.current[sleutel] = [
        ...(getoondeRecepten.current[sleutel] ?? []),
        huidig,
      ];
    }
    const over = recepten.filter((r) => r.id !== huidig && !gebruikt.includes(r.id));
    const [keuze] = kiesUitEigen({
      recepten: over,
      ingredienten,
      regels: [{ ...regelVoor(datum), moment }],
      doelen: { vlees: 0, vis: 0, vega: 0 },
      vermijd: instelling.vermijd,
      recentPerRecept: recent,
      uitgesloten: getoondeRecepten.current,
    });
    if (!keuze?.recept) {
      getoondeRecepten.current[sleutel] = [];
      const [herstart] = kiesUitEigen({
        recepten: over,
        ingredienten,
        regels: [{ ...regelVoor(datum), moment }],
        doelen: { vlees: 0, vis: 0, vega: 0 },
        vermijd: instelling.vermijd,
        recentPerRecept: recent,
      });
      if (!herstart?.recept) {
        toast("Geen ander passend gerecht gevonden");
        return;
      }
      setRijen((v) =>
        v.map((r) =>
          r.datum === datum && r.moment === moment
            ? { ...r, recept: herstart.recept, idee: null, aan: true }
            : r,
        ),
      );
      return;
    }
    setRijen((v) =>
      v.map((r) =>
        r.datum === datum && r.moment === moment
          ? { ...r, recept: keuze.recept, idee: null, aan: true }
          : r,
      ),
    );
  }

  function zetRegel(datum: string, deel: DagVoorkeur, ookRest = false) {
    setRegels((v) => {
      const nieuw = { ...v, [datum]: { ...(v[datum] ?? {}), ...deel } };
      if (ookRest) {
        const vanaf = dagen.indexOf(datum);
        dagen.slice(vanaf + 1).forEach((d) => {
          nieuw[d] = { ...(nieuw[d] ?? {}), ...deel };
        });
      }
      return nieuw;
    });
    // Onthouden voor deze weekdag, zodat het de volgende keer al goed staat.
    const dag = weekdagVan(datum);
    zetInstelling({
      perDag: { ...instelling.perDag, [dag]: { ...(instelling.perDag[dag] ?? {}), ...deel } },
    });
  }


  function kiesEigenGerecht(rij: Rij, recept: Recipe) {
    setRijen((huidig) =>
      huidig.map((item) =>
        item.datum === rij.datum && item.moment === rij.moment
          ? { ...item, recept, idee: null, aan: false }
          : item,
      ),
    );
    setKeuzeOpen(false);
    setEigenZoek("");
  }

  async function kiesNieuwIdee(rij: Rij) {
    setBezigMet("Foodlo zoekt een nieuw idee…");
    try {
      const regel = regelVoor(rij.datum);
      const ideeen = await weekmenuIdeeen({
        data: {
          aantal: 1,
          wensen: regel.soort ? `Voor deze dag: ${regel.soort}` : "Gevarieerd gerecht",
          vermijd: instelling.vermijd,
          maxMinuten: regel.maxMinuten,
          bekend: [
            ...recepten.slice(0, 60).map((recept) => recept.title),
            ...getoondeIdeeen.current,
            ...(rij.idee ? [rij.idee.title] : []),
          ],
        },
      });
      const idee = ideeen[0];
      if (!idee) {
        toast("Geen ander passend idee gevonden");
        return;
      }
      getoondeIdeeen.current = [...getoondeIdeeen.current, idee.title];
      setRijen((huidig) =>
        huidig.map((item) =>
          item.datum === rij.datum && item.moment === rij.moment
            ? { ...item, recept: null, idee, aan: false }
            : item,
        ),
      );
      setKeuzeOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Een nieuw idee zoeken lukte niet");
    } finally {
      setBezigMet("");
    }
  }

  const aantalAan = rijen.filter((r) => r.aan).length;
  const actieveRij = rijen[actieveStap];
  const actieveRegel = actieveRij ? regelVoor(actieveRij.datum) : null;
  const actieveNaam = actieveRij?.recept?.title ?? actieveRij?.idee?.title ?? null;
  const eigenResultaten = recepten
    .filter((recept) => recept.title.toLowerCase().includes(eigenZoek.trim().toLowerCase()))
    .slice(0, 5);

  function gaVerder(aan: boolean) {
    if (!actieveRij) return;
    setRijen((huidig) =>
      huidig.map((item, index) => (index === actieveStap ? { ...item, aan } : item)),
    );
    setKeuzeOpen(false);
    if (actieveStap < rijen.length - 1) setActieveStap((index) => index + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl">Foodlo kiest met jou</h2>
          <Button variant="ghost" onClick={onSluit} aria-label="Sluiten" className="size-12">
            <X className="size-5" />
          </Button>
        </div>

        {stap === "vragen" ? (
          <div className="mt-4 space-y-6">
            <div>
              <h3 className="text-base font-semibold">Voor welke dagen?</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {week.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={dagen.includes(d)}
                    onClick={() =>
                      setDagen((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d].sort()))
                    }
                    className={
                      dagen.includes(d)
                        ? "min-h-12 rounded-xl bg-primary px-3 text-base font-semibold capitalize text-primary-foreground"
                        : "min-h-12 rounded-xl border border-border px-3 text-base font-semibold capitalize"
                    }
                  >
                    {kortLabel(d)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold">Welke momenten?</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {momenten.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={gekozenMomenten.includes(m)}
                    onClick={() =>
                      setGekozenMomenten((v) =>
                        v.includes(m) ? v.filter((x) => x !== m) || [m] : [...v, m],
                      )
                    }
                    className={
                      gekozenMomenten.includes(m)
                        ? "min-h-12 rounded-xl bg-primary px-4 text-base font-semibold capitalize text-primary-foreground"
                        : "min-h-12 rounded-xl border border-border px-4 text-base font-semibold capitalize"
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold">Waaruit mag Foodlo kiezen?</h3>
              <div className="mt-2 space-y-2">
                {([
                  { id: "eigen", label: "Alleen mijn eigen recepten", extra: "gratis" },
                  { id: "ook-extern", label: "Ook nieuwe ideeën", extra: "kost credits" },
                ] as const).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={bron === o.id}
                    onClick={() => {
                      setBron(o.id);
                      zetInstelling({ bron: o.id });
                    }}
                    className={
                      bron === o.id
                        ? "flex min-h-14 w-full items-center justify-between rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground"
                        : "flex min-h-14 w-full items-center justify-between rounded-xl border border-border px-4 text-base font-semibold"
                    }
                  >
                  <span>{o.id === "eigen" ? "Uit mijn recepten" : "Ook nieuwe ideeën"}</span>
                    <span className="text-sm font-normal opacity-80">{o.extra}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={maakVoorstel}
              disabled={!dagen.length || !gekozenMomenten.length || !!bezigMet}
              className="h-16 w-full text-lg"
            >
              {bezigMet ? (
                <>
                  <Loader2 className="size-5 animate-spin" /> {bezigMet}
                </>
              ) : (
                <>
                  <Sparkles className="size-5" /> Laat Foodlo kiezen
                </>
              )}
            </Button>
          </div>
        ) : actieveRij && actieveRegel ? (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-muted-foreground">Dag {actieveStap + 1} van {rijen.length}</p>
              <div className="flex items-center gap-1.5" aria-label="Voortgang">
                {rijen.map((rij, index) => (
                  <span key={`${rij.datum}|${rij.moment}`} className={index === actieveStap ? "h-2 w-8 rounded-full bg-primary" : rij.aan ? "size-2 rounded-full bg-primary/50" : "size-2 rounded-full bg-border"} />
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-3xl capitalize">{new Date(`${actieveRij.datum}T12:00:00`).toLocaleDateString("nl-BE", { weekday: "long" })}</h3>
                <p className="mt-1 capitalize text-muted-foreground">{labelVoor(actieveRij.datum)} · {actieveRij.moment}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="icon" className="size-12" aria-label="Vorige dag" disabled={actieveStap === 0} onClick={() => { setActieveStap((index) => index - 1); setKeuzeOpen(false); }}>
                  <ChevronLeft className="size-5" />
                </Button>
                <Button variant="secondary" size="icon" className="size-12" aria-label="Volgende dag" disabled={actieveStap === rijen.length - 1} onClick={() => { setActieveStap((index) => index + 1); setKeuzeOpen(false); }}>
                  <ChevronRight className="size-5" />
                </Button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
              <VoorstelFoto url={actieveRij.recept?.image_url ?? null} />
              <div className="p-5">
                <p className="text-sm font-semibold uppercase text-primary">{actieveRij.idee ? "Nieuw idee" : "Voorstel van Foodlo"}</p>
                <h4 className="mt-1 font-display text-2xl leading-tight">
                  {actieveRij.bezet ? "Er staat al iets ingepland" : actieveRegel.over ? "Deze dag is overgeslagen" : (actieveNaam ?? "Geen passend gerecht gevonden")}
                </h4>
                {actieveRij.idee?.waarom ? <p className="mt-2 text-base text-muted-foreground">{actieveRij.idee.waarom}</p> : null}
              </div>
            </div>

            {!actieveRij.bezet ? (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4 text-primary" /> Kooktijd</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TIJD_KEUZES.map((tijd) => (
                      <Button key={tijd.id} type="button" variant={actieveRegel.maxMinuten === tijd.id ? "default" : "outline"} aria-pressed={actieveRegel.maxMinuten === tijd.id} onClick={() => zetRegel(actieveRij.datum, { maxMinuten: tijd.id })} className="h-12 whitespace-normal px-2 text-sm">{tijd.label}</Button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Utensils className="size-4 text-primary" /> Type gerecht</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SOORT_KEUZES.map((soort) => (
                      <Button key={soort.label} type="button" variant={actieveRegel.soort === soort.id ? "default" : "outline"} aria-pressed={actieveRegel.soort === soort.id} onClick={() => zetRegel(actieveRij.datum, { soort: soort.id })} className="h-12 text-sm">{soort.label}</Button>
                    ))}
                  </div>
                </div>

                <Button variant="secondary" onClick={() => setKeuzeOpen((open) => !open)} className="h-14 w-full text-base"><RefreshCw className="size-5" /> Ik wil iets anders</Button>

                {keuzeOpen ? (
                  <div className="space-y-3 border-t border-border pt-4">
                    <Button variant="outline" onClick={() => { wissel(actieveRij.datum, actieveRij.moment); setKeuzeOpen(false); }} disabled={!!bezigMet} className="h-14 w-full justify-start text-base"><Sparkles className="size-5 text-primary" /> Ander voorstel uit mijn recepten</Button>
                    <div className="rounded-xl border border-border p-3">
                      <p className="flex items-center gap-2 font-semibold"><BookOpen className="size-5 text-primary" /> Zelf een gerecht kiezen</p>
                      <Input value={eigenZoek} onChange={(event) => setEigenZoek(event.target.value)} placeholder="Zoek in mijn recepten" className="mt-3 h-12 text-base" />
                      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                        {eigenResultaten.map((recept) => <GerechtKaart key={recept.id} recept={recept} onKies={() => kiesEigenGerecht(actieveRij, recept)} />)}
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => void kiesNieuwIdee(actieveRij)} disabled={!!bezigMet} className="h-14 w-full justify-start text-base">
                      {bezigMet ? <Loader2 className="size-5 animate-spin" /> : <WandSparkles className="size-5 text-primary" />} Nieuw idee van Foodlo <span className="ml-auto text-sm font-normal text-muted-foreground">kost credits</span>
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className={`${keuzeOpen ? "" : "sticky bottom-0"} -mx-5 mt-6 border-t border-border bg-card px-5 py-4`}>
              {actieveStap < rijen.length - 1 ? (
                <div className="grid grid-cols-[1fr_2fr] gap-2">
                  <Button variant="ghost" onClick={() => gaVerder(false)} className="h-14 text-base">Overslaan</Button>
                  <Button disabled={!actieveNaam || actieveRij.bezet || !!bezigMet} onClick={() => gaVerder(true)} className="h-14 text-base"><Check className="size-5" /> Goed, volgende dag</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button disabled={!actieveNaam || actieveRij.bezet || !!bezigMet} onClick={() => gaVerder(true)} variant={actieveRij.aan ? "secondary" : "default"} className="h-14 w-full text-base"><Check className="size-5" /> {actieveRij.aan ? "Deze dag is gekozen" : "Deze dag kiezen"}</Button>
                  <Button disabled={!aantalAan || !!bezigMet} onClick={async () => { setBezigMet("bezig"); try { await onZet(rijen.filter((rij) => rij.aan)); } finally { setBezigMet(""); } }} className="h-14 w-full text-base">
                    {bezigMet ? <Loader2 className="size-5 animate-spin" /> : <>Zet {aantalAan} {aantalAan === 1 ? "dag" : "dagen"} in mijn weekmenu</>}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
