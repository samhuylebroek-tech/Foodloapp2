import { useEffect, useRef, useState } from "react";
import { useFocusTerug } from "@/hooks/useFocusTerug";
import { meet } from "@/lib/meten";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  ShoppingCart,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Repeat,
  Settings,
  CalendarDays,
  Clock3,
  BookOpen,
  MoreVertical,
  Users,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { meldMetHerstel } from "@/hooks/useAanvulling";
import {
  HalfGelukt,
  lijstUitleg,
  planErbij,
  planVerplaats,
  planVervang,
  planWeg,
  wijzigMenu,
  type Herstel,
  type PlanUitvoering,
} from "@/lib/kringloop-db";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ingredientToLine } from "@/lib/ingredienten";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
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
import { RecipePhoto } from "@/components/RecipePhoto";
import { receptVanNaam, type WeekmenuIdee } from "@/lib/ai.functions";
import { useVoorkeuren } from "@/lib/voorkeuren";
import {
  zorgVoorLijst,
  maakLijst,
  vindDubbels,
  voegToeAlsNieuw,
  type Dubbel,
  type NieuwItem,
  type ShoppingList,
} from "@/lib/boodschappen";
import { tijdLabel } from "@/lib/tijd";
import { zorgVoorReceptFoto } from "@/lib/photos";
import {
  type PlanRow,
  schaalPerRecept,
  schaalHoeveelheid,
  maandagVan,
  datumTekst,
  labelVoor,
  type NieuwExtra,
  type Basis,
} from "@/components/planner/gedeeld";
import { ReceptKiezer } from "@/components/planner/ReceptKiezer";
import { LijstVraag } from "@/components/planner/LijstVraag";
import { WeekmenuInstellingen } from "@/components/planner/WeekmenuInstellingen";
import { ReceptFoto, WeekmenuVoorstel } from "@/components/planner/WeekmenuVoorstel";
import { VulAan } from "@/components/planner/VulAan";
import { VerplaatsSheet, KoppelSheet } from "@/components/planner/PlanSheets";
import { useTablet } from "@/hooks/useTablet";
import { TabletWeek } from "@/components/planner/TabletWeek";

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


function PlannerPage() {
  useEffect(() => {
    void meet("weekmenu.bekeken");
  }, []);
  const { user } = useAuth();
  const { momenten: algemeneMomenten, weekmenu, zetWeekmenu } = useVoorkeuren();
  // Dagdelen: eigen keuze voor het weekmenu, anders je algemene momenten.
  const momenten = weekmenu.momenten.length ? weekmenu.momenten : algemeneMomenten;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [verplaats, setVerplaats] = useState<{ rij: PlanRow; kopie: boolean } | null>(null);
  const [koppelRij, setKoppelRij] = useState<PlanRow | null>(null);
  const [weekStart, setWeekStart] = useState(() => maandagVan(new Date()));
  const [kiezen, setKiezen] = useState<{ datum: string; moment: string; vraagDag?: boolean } | null>(
    null,
  );
  const [lijstId, setLijstId] = useState<string>("");
  useFocusTerug(Boolean(kiezen));
  useFocusTerug(Boolean(verplaats));
  const [vervangRij, setVervangRij] = useState<PlanRow | null>(null);
  const [vraagLijst, setVraagLijst] = useState<{ recipeId: string; titel: string } | null>(null);
  const [opruimVraag, setOpruimVraag] = useState<{
    titel: string;
    items: { id: string; naam: string }[];
  } | null>(null);
  const [naVoorstel, setNaVoorstel] = useState<{ recipeId: string; titel: string }[] | null>(null);
  const [naGekozen, setNaGekozen] = useState<Set<string>>(new Set());
  const [dubbelVraag, setDubbelVraag] = useState<{
    listId: string;
    rows: NieuwItem[];
    dubbels: Dubbel[];
    gekozen: Set<number>;
    /** Waar komen de boodschappen vandaan? Voor de titel van het overzicht. */
    bron: string;
  } | null>(null);

  const [weergave, setWeergave] = useState<"mij" | "gezin">("mij");
  const [instellingenOpen, setInstellingenOpen] = useState(false);
  const [voorstelOpen, setVoorstelOpen] = useState(false);
  const [kalenderOpen, setKalenderOpen] = useState(false);
  const [boodschappenOpen, setBoodschappenOpen] = useState(false);
  const [dagKeuze, setDagKeuze] = useState<string | null>(null);
  const [heleWeek, setHeleWeek] = useState(false);

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
  // In de huidige week beginnen we bij vandaag; verleden dagen zie je alleen
  // als je bewust naar een vorige week bladert.
  const getoondeDagen = weekVerschil === 0 ? zichtbareDagen.filter((dag) => dag >= vandaag) : zichtbareDagen;
  const tablet = useTablet();
  const gekozenDag = dagKeuze && week.includes(dagKeuze) ? dagKeuze : week.includes(vandaag) ? vandaag : (zichtbareDagen[0] ?? week[0] ?? vandaag);
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
        .select("id, plan_date, meal_type, recipe_id, custom_title, soort, personen, user_id, group_id, recipes(*)")
        .gte("plan_date", week[0]!)
        .lte("plan_date", week[6]!)
        .order("plan_date");
      q = weergave === "gezin" ? q.eq("group_id", gezin!.id) : q.is("group_id", null);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as PlanRow[];
    },
  });

  // Het weekmenu opent op vandaag: de dag van vandaag is al gekozen en
  // gemarkeerd in de weekbalk, dus we scrollen niet automatisch naar beneden —
  // anders verdwijnt de weekwisseling uit beeld.

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

  // V2 (WP4): in je eigen weekmenu stuurt Foodlo de boodschappenlijst meteen bij — geen vraag,
  // wel één melding met "Ongedaan maken" die menu én lijst terugzet. Het gezinsweekmenu houdt
  // voorlopig de vragen (huishouden: WP9).
  const eigenMenu = weergave === "mij";
  // Het hoofdmoment van de dag (avondeten, of "maaltijd" in één blok), zoals Laat Foodlo kiezen.
  const hoofdMoment = momenten[momenten.length - 1] ?? "avondeten";
  const legeDagen = zichtbareDagen.filter(
    (dag) =>
      dag >= vandaag && !plan.some((p) => p.plan_date === dag && p.meal_type === hoofdMoment),
  );
  const menuBezig = useRef(false);
  function vernieuwMenu() {
    for (const k of ["meal-plan", "shopping", "aanvulling", "voorraad", "home-dagmenu", "home-week"])
      void qc.invalidateQueries({ queryKey: [k] });
  }
  /** Voert een menuwijziging uit met lijst; geeft het plan-id terug, of null als het mislukte. */
  async function menuWijziging(
    actie: () => Promise<PlanUitvoering>,
    tekst: string,
  ): Promise<string | undefined | null> {
    if (!user || menuBezig.current) return null;
    menuBezig.current = true;
    try {
      const r = await wijzigMenu(user.id, actie);
      vernieuwMenu();
      if (r.veranderd) {
        const uitleg = lijstUitleg(r.effect);
        meldMetHerstel(uitleg ? `${tekst} · ${uitleg}` : tekst, r.herstel, vernieuwMenu);
      }
      return r.id;
    } catch (fout) {
      vernieuwMenu();
      toast.error(
        fout instanceof HalfGelukt
          ? "Dat lukte maar half. Kijk je weekmenu en lijst even na."
          : "Dat lukte niet. Er is niets veranderd; probeer het opnieuw.",
      );
      return null;
    } finally {
      menuBezig.current = false;
    }
  }

  async function verwijder(id: string, recipeId?: string | null, titel?: string) {
    if (eigenMenu) {
      await menuWijziging(planWeg(id), `${titel ?? "Gerecht"} uit je weekmenu`);
      return;
    }
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
          naam: ingredientToLine({ name: r.name, quantity: r.quantity, unit: r.unit ?? "" }),
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

  // BUG-032: een dubbele tik terwijl de eerste nog bezig is, mag niet twee keer inplannen.
  const planBezig = useRef(false);

  async function plan_toevoegen(recipeId: string, datum: string, moment: string, titel: string, personen: number) {
    if (!user || planBezig.current) return;
    if (eigenMenu) {
      const id = await menuWijziging(
        planErbij({ userId: user.id, recipeId, datum, moment, personen }),
        `${titel} staat op ${labelVoor(datum)}`,
      );
      if (id === null) return;
      setKiezen(null);
      setWeekStart(maandagVan(new Date(`${datum}T12:00:00`)));
      return;
    }
    planBezig.current = true;
    let resultaat: { data: { id: string } | null; error: unknown };
    try {
      resultaat = await supabase
        .from("meal_plan")
        .insert({
          user_id: user.id,
          recipe_id: recipeId,
          plan_date: datum,
          meal_type: moment,
          personen,
          group_id: weergave === "gezin" ? gezin!.id : null,
        })
        .select("id")
        .single();
    } catch (e) {
      resultaat = { data: null, error: e };
    } finally {
      planBezig.current = false;
    }
    const { data, error } = resultaat;
    if (error || !data) {
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
    const herstellen: Herstel[] = [];
    const effect = { erbij: 0, minder: 0, weg: 0 };
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
          await zorgVoorReceptFoto(data.id, basis.title || rij.idee.title, user.id).catch(() => null);
        }
        if (!recipeId) continue;
        if (eigenMenu) {
          const w = await wijzigMenu(
            user.id,
            planErbij({ userId: user.id, recipeId, datum: rij.datum, moment: rij.moment }),
          );
          herstellen.push(w.herstel);
          effect.erbij += w.effect.erbij;
          effect.minder += w.effect.minder;
          effect.weg += w.effect.weg;
        } else {
          const { error } = await supabase.from("meal_plan").insert({
            user_id: user.id,
            recipe_id: recipeId,
            plan_date: rij.datum,
            meal_type: rij.moment,
            group_id: weergave === "gezin" ? gezin!.id : null,
          });
          if (error) throw error;
        }
        gelukt += 1;
        ingepland.push({ recipeId, titel: rij.recept?.title ?? rij.idee?.title ?? "Gerecht" });
      } catch {
        toast.error(`${labelVoor(rij.datum)} inplannen lukte niet`);
      }
    }
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
    setVoorstelOpen(false);
    if (eigenMenu) {
      vernieuwMenu();
      if (gelukt) {
        const uitleg = lijstUitleg(effect);
        const tekst = `${gelukt} ${gelukt === 1 ? "dag" : "dagen"} ingepland`;
        meldMetHerstel(
          uitleg ? `${tekst} · ${uitleg}` : tekst,
          async () => {
            let mislukt = false;
            for (const h of [...herstellen].reverse()) {
              try {
                await h();
              } catch {
                mislukt = true;
              }
            }
            if (mislukt) throw new HalfGelukt();
          },
          vernieuwMenu,
        );
      }
      return;
    }
    if (gelukt) toast.success(`${gelukt} ${gelukt === 1 ? "dag" : "dagen"} ingepland`);
    if (ingepland.length) {
      setNaVoorstel(ingepland);
      setNaGekozen(new Set(ingepland.map((r) => r.recipeId)));
    }
  }

  /**
   * Ingrediënten naar de boodschappenlijst. Staat iets er al, dan eerst één
   * rustige controle: de gebruiker kiest zelf wat nog eens toegevoegd wordt.
   * Er wordt nooit stil samengevoegd.
   */
  async function ingredienNaarLijst(rows: NieuwItem[], listId: string, bron = "deze gerechten") {
    if (!user) return;
    try {
      const dubbels = await vindDubbels(listId, rows);
      if (dubbels.length) {
        // Staat álles er al? Dan geen stille dubbel, maar een duidelijke melding.
        setDubbelVraag({ listId, rows, dubbels, gekozen: new Set(), bron });
        return;
      }
      await voegToeAlsNieuw(user.id, listId, rows);
      toast.success("Op je boodschappenlijst gezet");
      qc.invalidateQueries({ queryKey: ["shopping"] });
    } catch {
      toast.error("Toevoegen lukte niet");
    }
  }

  async function dubbelBevestigen() {
    if (!user || !dubbelVraag) return;
    const { listId, rows, dubbels, gekozen } = dubbelVraag;
    const dubbelIdx = new Set(dubbels.map((d) => d.index));
    const toeTeVoegen = rows.filter((_, i) => !dubbelIdx.has(i) || gekozen.has(i));
    setDubbelVraag(null);
    if (!toeTeVoegen.length) {
      toast.message("Niets toegevoegd — alles stond al op je lijst.");
      return;
    }
    try {
      await voegToeAlsNieuw(user.id, listId, toeTeVoegen);
      const overgeslagen = dubbels.length - gekozen.size;
      toast.success(
        overgeslagen > 0
          ? `Toegevoegd — ${overgeslagen} ${overgeslagen === 1 ? "ingrediënt" : "ingrediënten"} overgeslagen`
          : "Alles staat op je boodschappenlijst",
      );
      qc.invalidateQueries({ queryKey: ["shopping"] });
    } catch {
      toast.error("Toevoegen lukte niet");
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
    await ingredienNaarLijst(
      data.map((i) => ({
        name: i.name as string,
        quantity: i.quantity as number | null,
        unit: (i.unit as string) ?? "",
        recipe_id: i.recipe_id as string,
      })),
      listId,
    );
    setNaVoorstel(null);
  }


  async function nieuw_gerecht(naam: string, basis: Basis | null, datum: string, moment: string, extra?: NieuwExtra, personen?: number) {
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
      if (!basis.image_url) {
        await zorgVoorReceptFoto(data.id, basis.title || naam, user.id).catch(() => null);
      }
    }

    let geplandeRij: { id: string } | null = null;
    if (eigenMenu) {
      const id = await menuWijziging(
        planErbij({
          userId: user.id,
          recipeId,
          datum,
          moment,
          personen: personen ?? null,
          customTitle: naam,
          soort: extra?.soort ?? null,
        }),
        `${naam} staat op ${labelVoor(datum)}`,
      );
      if (id === null) return;
      geplandeRij = id ? { id } : null;
    } else {
      const { data, error } = await supabase.from("meal_plan").insert({
        user_id: user.id,
        recipe_id: recipeId,
        custom_title: recipeId ? null : naam,
        soort: extra?.soort ?? null,
        plan_date: datum,
        meal_type: moment,
        personen: personen ?? null,
        group_id: weergave === "gezin" ? gezin!.id : null,
      }).select("id").single();
      if (error) {
        toast.error("Inplannen lukte niet");
        return;
      }
      geplandeRij = data;
    }
    if (extra?.maakRecept && geplandeRij) {
      setKiezen(null);
      navigate({ to: "/recepten/nieuw", search: { title: naam, koppel: geplandeRij.id } });
      return;
    }
    setKiezen(null);
    setWeekStart(maandagVan(new Date(`${datum}T12:00:00`)));
    if (!eigenMenu) toast.success(basis ? "Ingepland en bewaard bij je recepten" : "In je weekmenu gezet");
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
    qc.invalidateQueries({ queryKey: ["recipes"] });
    qc.invalidateQueries({ queryKey: ["alle-ingredienten"] });
    if (recipeId && !eigenMenu) setVraagLijst({ recipeId, titel: naam });
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
    await ingredienNaarLijst(
      data.map((i) => ({
        name: i.name as string,
        quantity: i.quantity as number | null,
        unit: (i.unit as string) ?? "",
        recipe_id: recipeId,
      })),
      listId,
    );
  }

  /** Verplaatst of dupliceert een geplande maaltijd naar een andere dag/moment. */
  async function verplaatsNaar(rij: PlanRow, datum: string, moment: string, kopie: boolean) {
    if (!user) return;
    if (eigenMenu) {
      const id = await menuWijziging(
        kopie
          ? planErbij({
              userId: user.id,
              recipeId: rij.recipe_id,
              datum,
              moment,
              personen: rij.personen ?? null,
              customTitle: rij.custom_title,
              soort: rij.soort ?? null,
            })
          : planVerplaats(rij.id, datum, moment),
        kopie ? `Ook ingepland op ${labelVoor(datum)}` : `Verplaatst naar ${labelVoor(datum)}`,
      );
      if (id !== null) setVerplaats(null);
      return;
    }
    const { error } = kopie
      ? await supabase.from("meal_plan").insert({
          user_id: user.id,
          recipe_id: rij.recipe_id,
          custom_title: rij.custom_title,
          soort: rij.soort ?? null,
          personen: rij.personen ?? null,
          plan_date: datum,
          meal_type: moment,
          group_id: rij.group_id,
        })
      : await supabase.from("meal_plan").update({ plan_date: datum, meal_type: moment }).eq("id", rij.id);
    if (error) {
      toast.error(kopie ? "Dupliceren lukte niet" : "Verplaatsen lukte niet");
      return;
    }
    toast.success(kopie ? `Ook ingepland op ${labelVoor(datum)}` : `Verplaatst naar ${labelVoor(datum)}`);
    setVerplaats(null);
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
  }

  async function koppelRecept(rij: PlanRow, recept: Recipe) {
    if (eigenMenu) {
      const id = await menuWijziging(planVervang(rij.id, recept.id), `${recept.title} gekoppeld`);
      if (id !== null) setKoppelRij(null);
      return;
    }
    const { error } = await supabase
      .from("meal_plan")
      .update({ recipe_id: recept.id, custom_title: null })
      .eq("id", rij.id);
    if (error) {
      toast.error("Koppelen lukte niet");
      return;
    }
    toast.success(`${recept.title} gekoppeld`);
    setKoppelRij(null);
    qc.invalidateQueries({ queryKey: ["meal-plan"] });
  }

  async function alleBoodschappen() {
    if (!user || plan.length === 0) return;
    const ids = plan.map((p) => p.recipe_id).filter((x): x is string => !!x);
    const zonderRecept = plan.filter((p) => !p.recipe_id && !p.soort).map((p) => p.custom_title).filter(Boolean);
    if (zonderRecept.length) {
      toast.message(
        `${zonderRecept.slice(0, 2).join(", ")}${zonderRecept.length > 2 ? " …" : ""} ${zonderRecept.length === 1 ? "heeft" : "hebben"} nog geen recept — zet zelf iets op de lijst of voeg een recept toe.`,
      );
    }
    if (!ids.length) {
      toast.error("Geen ingrediënten gevonden");
      return;
    }
    const standaardLijst =
      weergave === "gezin" && gezinsLijst ? gezinsLijst.id : lijstId || lijsten[0]?.id;
    const listId = standaardLijst || (await zorgVoorLijst(user.id));
    const factoren = schaalPerRecept(plan);
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("name, quantity, unit, recipe_id")
      .in("recipe_id", ids);
    if (error || !data?.length) {
      toast.error("Geen ingrediënten gevonden");
      return;
    }
    await ingredienNaarLijst(
      data.map((i) => ({
        name: i.name as string,
        quantity: schaalHoeveelheid(i.quantity as number | null, factoren.get(i.recipe_id as string) ?? 1),
        unit: (i.unit as string) ?? "",
        recipe_id: i.recipe_id as string,
      })),
      listId,
      "deze week",
    );
  }

  /** Alle ingrediënten van één gekozen dag in één keer op de lijst. */
  async function boodschappenVoorDag(dag: string) {
    if (!user) return;
    const dagPlan = plan.filter((p) => p.plan_date === dag);
    const ids = dagPlan.map((p) => p.recipe_id).filter((x): x is string => !!x);
    const zonderRecept = dagPlan
      .filter((p) => !p.recipe_id && !p.soort)
      .map((p) => p.custom_title)
      .filter(Boolean);
    if (zonderRecept.length) {
      toast.message(
        `${zonderRecept.slice(0, 2).join(", ")}${zonderRecept.length > 2 ? " …" : ""} ${zonderRecept.length === 1 ? "heeft" : "hebben"} nog geen recept — die tellen niet mee voor de lijst.`,
      );
    }
    if (!ids.length) {
      toast.error("Geen ingrediënten gevonden voor deze dag");
      return;
    }
    const standaardLijst =
      weergave === "gezin" && gezinsLijst ? gezinsLijst.id : lijstId || lijsten[0]?.id;
    const listId = standaardLijst || (await zorgVoorLijst(user.id));
    const factoren = schaalPerRecept(dagPlan);
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("name, quantity, unit, recipe_id")
      .in("recipe_id", ids);
    if (error || !data?.length) {
      toast.error("Geen ingrediënten gevonden voor deze dag");
      return;
    }
    await ingredienNaarLijst(
      data.map((i) => ({
        name: i.name as string,
        quantity: schaalHoeveelheid(i.quantity as number | null, factoren.get(i.recipe_id as string) ?? 1),
        unit: (i.unit as string) ?? "",
        recipe_id: i.recipe_id as string,
      })),
      listId,
      labelVoor(dag),
    );
  }

  function verschuif(weken: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + weken * 7);
    setWeekStart(d);
  }

  // Mobiel: veeg over de dag om naar de vorige of volgende dag te gaan.
  const veegStart = useRef<{ x: number; y: number } | null>(null);
  function veegDag(e: React.TouchEvent, start: boolean) {
    const t = start ? e.touches[0] : e.changedTouches[0];
    if (!t) return;
    if (start) {
      veegStart.current = { x: t.clientX, y: t.clientY };
      return;
    }
    const begin = veegStart.current;
    veegStart.current = null;
    if (!begin) return;
    const dx = t.clientX - begin.x;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(t.clientY - begin.y) * 1.5) return;
    const i = week.indexOf(gekozenDag);
    const volgende = week[i + (dx < 0 ? 1 : -1)];
    if (volgende) setDagKeuze(volgende);
  }

  /** Acties voor een geplande maaltijd — gedeeld door de daglijst en het weekraster. */
  function planActies(p: PlanRow, compact = false) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            aria-label={`Acties voor ${p.recipes?.title ?? p.custom_title ?? "maaltijd"}`}
            className={compact ? "size-11 shrink-0" : "size-12 shrink-0"}
          >
            <MoreVertical className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-60 p-2"
          // Opent een menukeuze een venster, dan houdt dat venster de focus (BUG-030):
          // het menu mag de focus dan niet terugzetten op zijn knop.
          onCloseAutoFocus={(e) => {
            if (document.querySelector('[role="dialog"]')) e.preventDefault();
          }}
        >
          {p.recipe_id ? (
            <DropdownMenuItem
              onSelect={() =>
                setVraagLijst({
                  recipeId: p.recipe_id as string,
                  titel: p.recipes?.title ?? "Recept",
                })
              }
              className="min-h-12 rounded-lg text-base"
            >
              <ShoppingCart className="size-5" /> Op boodschappenlijst
            </DropdownMenuItem>
          ) : null}
          {!p.recipe_id && !p.soort ? (
            <DropdownMenuItem
              onSelect={() => setKoppelRij(p)}
              className="min-h-12 rounded-lg text-base"
            >
              <BookOpen className="size-5" /> Recept koppelen
            </DropdownMenuItem>
          ) : null}
          {!p.recipe_id && !p.soort ? (
            <DropdownMenuItem
              onSelect={() =>
                navigate({
                  to: "/recepten/nieuw",
                  search: { title: p.custom_title ?? "", koppel: p.id },
                })
              }
              className="min-h-12 rounded-lg text-base"
            >
              <Plus className="size-5" /> Recept maken of importeren
            </DropdownMenuItem>
          ) : null}
          {p.recipe_id && eigenMenu ? (
            <DropdownMenuItem
              onSelect={() => setVervangRij(p)}
              className="min-h-12 rounded-lg text-base"
            >
              <Repeat className="size-5" /> Ander gerecht
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={() => setVerplaats({ rij: p, kopie: false })}
            className="min-h-12 rounded-lg text-base"
          >
            <CalendarDays className="size-5" /> Verplaatsen
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setVerplaats({ rij: p, kopie: true })}
            className="min-h-12 rounded-lg text-base"
          >
            <Copy className="size-5" /> Dupliceren
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const d = new Date(`${p.plan_date}T12:00:00`);
              d.setDate(d.getDate() + 7);
              void verplaatsNaar(p, datumTekst(d), p.meal_type, true);
            }}
            className="min-h-12 rounded-lg text-base"
          >
            <Repeat className="size-5" /> Volgende week opnieuw
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void verwijder(p.id, p.recipe_id, p.recipes?.title ?? "Dit gerecht")}
            className="min-h-12 rounded-lg text-base text-destructive focus:text-destructive"
          >
            <Trash2 className="size-5" /> Uit planning halen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /** V2 — desktop: de hele week in één raster (dagen als kolommen, maaltijden als rijen). */
  function weekRaster() {
    const alleMomenten = [...new Set([...momenten, ...plan.map((p) => p.meal_type)])];
    return (
      <section aria-label="Weekoverzicht" className="hidden lg:col-span-2 xl:block">
        <div className="grid grid-cols-7 gap-3">
          {week.map((dag) => {
            const d = new Date(`${dag}T12:00:00`);
            const isVandaag = dag === vandaag;
            const voorbij = dag < vandaag;
            const items = plan.filter((p) => p.plan_date === dag);
            return (
              <div
                key={dag}
                className={`flex min-w-0 flex-col rounded-3xl p-2.5 ${isVandaag ? "bg-inkt text-inkt-foreground shadow-kaart" : voorbij ? "bg-muted/60" : "bg-card shadow-zacht"}`}
              >
                <h2 className="px-1.5 pb-2 pt-1">
                  <span
                    className={`block text-base font-semibold uppercase tracking-wide ${isVandaag ? "text-inkt-zacht" : "text-muted-foreground"}`}
                  >
                    {isVandaag ? "Vandaag" : d.toLocaleDateString("nl-BE", { weekday: "long" })}
                  </span>
                  <span className="block text-2xl font-bold leading-tight">
                    {d.getDate()}{" "}
                    {d.toLocaleDateString("nl-BE", { month: "short" }).replace(".", "")}
                  </span>
                </h2>
                <div className="flex flex-1 flex-col gap-2">
                  {alleMomenten.map((m) => {
                    const bij = items.filter((p) => p.meal_type === m);
                    if (!bij.length && items.length && momenten.length === 1) return null;
                    return (
                      <div key={m} className="min-w-0">
                        <p
                          className={`px-1.5 text-[0.9rem] font-semibold first-letter:uppercase ${isVandaag ? "text-inkt-zacht" : "text-muted-foreground"}`}
                        >
                          {m}
                        </p>
                        {bij.length ? (
                          <ul className="mt-1 space-y-2">
                            {bij.map((p) => (
                              <li
                                key={p.id}
                                className="overflow-hidden rounded-2xl bg-card text-foreground shadow-zacht"
                              >
                                {p.recipe_id ? (
                                  <Link
                                    to="/recepten/$id"
                                    params={{ id: p.recipe_id }}
                                    search={p.personen != null ? { personen: p.personen } : {}}
                                    className="block"
                                  >
                                    <RecipePhoto
                                      path={p.recipes?.image_url ?? null}
                                      alt=""
                                      recept={p.recipes ?? { title: "" }}
                                      className="aspect-[4/3] w-full"
                                      icoonClassName="size-10"
                                    />
                                    <span className="line-clamp-2 px-2.5 pt-2 text-base font-semibold leading-snug">
                                      {p.recipes?.title ?? "Recept"}
                                    </span>
                                  </Link>
                                ) : (
                                  <span className="line-clamp-2 block px-2.5 pt-2.5 text-base font-semibold leading-snug">
                                    {p.custom_title}
                                  </span>
                                )}
                                <div className="flex items-center justify-between gap-1 pb-1 pl-2.5 pr-1">
                                  <span className="truncate text-[0.9rem] text-muted-foreground">
                                    {p.recipes
                                      ? tijdLabel(p.recipes.prep_minutes, p.recipes.cook_minutes)
                                      : ""}
                                  </span>
                                  {planActies(p, true)}
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : voorbij ? (
                          <p
                            className={`px-1.5 py-2 text-[0.9rem] ${isVandaag ? "text-inkt-zacht" : "text-muted-foreground"}`}
                          >
                            —
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setKiezen({ datum: dag, moment: m })}
                            aria-label={`Gerecht toevoegen: ${m}, ${d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })}`}
                            className={`mt-1 flex min-h-16 w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed text-base font-semibold transition-colors ${isVandaag ? "border-inkt-foreground/30 text-inkt-foreground hover:bg-white/10" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
                          >
                            <Plus className="size-5" aria-hidden /> Toevoegen
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  function toonDag(dag: string, groot: boolean) {
    const items = plan.filter((p) => p.plan_date === dag);
    const datum = new Date(`${dag}T12:00:00`);
    const voorbij = dag < vandaag;
    const alleMomenten = [...new Set([...momenten, ...items.map((p) => p.meal_type)])];
    const titel = datum.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
    const kaart = (p: PlanRow) => (
                    <li key={p.id} className="paneel @container flex min-h-24 items-center gap-2 p-3">
                      {p.recipe_id ? <Link to="/recepten/$id" params={{ id: p.recipe_id }} search={p.personen != null ? { personen: p.personen } : {}} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hyphens-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @max-[17rem]:flex-col @max-[17rem]:items-start"><ReceptFoto url={p.recipes?.image_url ?? null} recept={p.recipes} /><span className="min-w-0"><span className="block text-base font-semibold capitalize text-muted-foreground">{p.meal_type}</span><span className="block text-lg font-semibold leading-tight">{p.recipes?.title ?? "Recept"}</span>{p.recipes ? <span className="mt-0.5 flex items-center gap-1 text-base text-muted-foreground"><Clock3 className="size-3.5" /> {tijdLabel(p.recipes.prep_minutes, p.recipes.cook_minutes) || "Tijd niet ingevuld"}</span> : null}</span></Link> : <div className="flex min-w-0 flex-1 items-center gap-3 hyphens-auto @max-[17rem]:flex-col @max-[17rem]:items-start"><ReceptFoto url={null} /><span className="min-w-0"><span className="block text-base font-semibold capitalize text-muted-foreground">{p.meal_type}</span><span className="block text-lg font-semibold leading-tight">{p.custom_title}</span>{!p.soort ? <button type="button" onClick={() => setKoppelRij(p)} className="mt-0.5 block text-left text-base font-semibold text-primary underline underline-offset-2">Nog geen recept · koppelen</button> : null}</span></div>}
                      {weergave === "gezin" && p.user_id !== user?.id ? <Avatar naam={plannerNamen[p.user_id] ?? "?"} sleutel={p.user_id} className="size-8 shrink-0 text-base" /> : null}
                      {planActies(p)}
                    </li>
    );
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1 basis-52">
            {groot ? (
              <p className="text-base font-semibold text-muted-foreground">
                {dag === vandaag ? "Vandaag" : voorbij ? "Voorbij" : dag === datumTekst(new Date(Date.now() + 86400000)) ? "Morgen" : "Gepland"}
              </p>
            ) : null}
            <h2 id={`dag-${dag}`} className="text-sectietitel first-letter:uppercase">
              {titel}
              {!groot && dag === vandaag ? <span className="ml-2 align-middle text-base font-semibold text-honing-foreground"> · vandaag</span> : null}
            </h2>
          </div>
          {groot ? (
            <Button
              variant="ghost"
              onClick={() => setHeleWeek(true)}
              className="h-11 min-h-11 shrink-0 px-3 text-base md:hidden"
            >
              Hele week
            </Button>
          ) : null}
        </div>
        {alleMomenten.map((m) => {
          const bij = items.filter((p) => p.meal_type === m);
          // Eén algemeen moment en al iets gepland: geen leeg vak erbij.
          if (!bij.length && items.length && momenten.length === 1) return null;
          return (
            <div key={m} className="space-y-2">
              <h3 className="px-1 text-[0.95rem] font-bold text-muted-foreground first-letter:uppercase">{m}</h3>
              {bij.length ? (
                <ul className="space-y-2">{bij.map(kaart)}</ul>
              ) : voorbij ? (
                <p className="text-base text-muted-foreground">Niets gepland</p>
              ) : (
                <Button variant="ghost" onClick={() => setKiezen({ datum: dag, moment: m })} className="h-16 w-full justify-start gap-3 rounded-[1.25rem] border-2 border-dashed border-border px-4 text-base text-muted-foreground">
                  <Plus className="size-5" /> Gerecht toevoegen
                </Button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AppShell
      title="Weekmenu"
      breed
      action={
        // Mobiel-eerst: "Opties" in de titelregel, geen eigen rij boven de week.
        <Button
          variant="ghost"
          onClick={() => setInstellingenOpen(true)}
          className="h-12 shrink-0 gap-2 px-3 text-base"
        >
          <Settings className="size-5" /> Opties
        </Button>
      }
    >
      <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-6 lg:gap-y-6 lg:space-y-0">
        {/* Kopregel: welke planning en opties (desktop: rechts naast de weekkeuze) */}
        {gezin ? (
          <div className="flex items-center gap-2 lg:col-start-2 lg:row-start-1 lg:self-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-12 min-w-0 flex-1 justify-start gap-2 px-2 text-base font-semibold">
                  {weergave === "gezin" ? <Users className="size-5 shrink-0" /> : <CalendarDays className="size-5 shrink-0" />}
                  <span className="truncate">{weergave === "gezin" ? gezin.naam : "Mijn planning"}</span>
                  <ChevronRight className="size-4 shrink-0 rotate-90" />
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
          </div>
        ) : null}

        {/* Week kiezen: duidelijke titel met datums, grote pijlen, rustige dagkeuze */}
        {/* Mobiel: één compacte weekband die bovenaan blijft staan (dag wisselen kan altijd). */}
        <section aria-label="Week kiezen" className="paneel sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 p-2.5 shadow-kaart md:static md:p-3 md:shadow-none lg:col-start-1 lg:row-start-1 lg:w-full lg:max-w-lg lg:p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => verschuif(-1)}
              aria-label="Vorige week"
              className="size-12 shrink-0 rounded-full"
            >
              <ChevronLeft className="size-7" />
            </Button>
            <Popover open={kalenderOpen} onOpenChange={setKalenderOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-2 text-center transition-colors hover:bg-muted md:min-h-14"
                >
                  {/* Zichtbare tekst blijft deel van de naam (WCAG 2.5.3); de uitleg komt erbij. */}
                  <span className="font-display text-lg font-semibold leading-tight md:text-xl">
                    {weekVerschil === 0 ? "Deze week" : weekVerschil === 1 ? "Volgende week" : weekVerschil === -1 ? "Vorige week" : "Week"}
                  </span>
                  <span className="text-[0.95rem] text-muted-foreground md:text-base">
                    {new Date(`${week[0]}T12:00:00`).toLocaleDateString("nl-BE", { day: "numeric", month: "short" })}
                    {" – "}
                    {new Date(`${week[6]}T12:00:00`).toLocaleDateString("nl-BE", { day: "numeric", month: "short" })}
                  </span>
                  <span className="sr-only"> — kies een week in de kalender</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={weekStart}
                  onSelect={(datum) => {
                    if (!datum) return;
                    setWeekStart(maandagVan(datum));
                    setDagKeuze(datumTekst(datum));
                    setKalenderOpen(false);
                  }}
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              onClick={() => verschuif(1)}
              aria-label="Volgende week"
              className="size-12 shrink-0 rounded-full"
            >
              <ChevronRight className="size-7" />
            </Button>
          </div>
          {weekVerschil !== 0 ? (
            <button
              type="button"
              onClick={() => { setWeekStart(huidigeWeek); setDagKeuze(vandaag); setHeleWeek(false); }}
              className="mx-auto mt-2 flex h-10 items-center rounded-full bg-secondary px-4 text-base font-semibold text-secondary-foreground"
            >
              Terug naar vandaag
            </button>
          ) : null}
          <div className="mt-2 grid grid-cols-7 gap-1 md:hidden" role="tablist" aria-label="Dag kiezen">
            {week.map((dag) => {
              const d = new Date(`${dag}T12:00:00`);
              const actief = !heleWeek && dag === gekozenDag;
              const isVandaag = dag === vandaag;
              const aantal = plan.filter((p) => p.plan_date === dag).length;
              const verborgen = !zichtbareDagen.includes(dag);
              return (
                <button
                  key={dag}
                  type="button"
                  role="tab"
                  aria-selected={actief}
                  onClick={() => { setDagKeuze(dag); setHeleWeek(false); }}
                  className={[
                    "flex min-h-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors",
                    actief
                      ? "bg-inkt text-inkt-foreground shadow-zacht"
                      : isVandaag
                        ? "bg-honing-zacht text-foreground ring-2 ring-honing"
                        : "text-foreground hover:bg-muted",
                    verborgen && !actief ? "opacity-40" : "",
                  ].join(" ")}
                >
                  <span className="text-base font-semibold uppercase tracking-wide">
                    {d.toLocaleDateString("nl-BE", { weekday: "short" }).replace(".", "")}
                  </span>
                  {/* Figtree voor getallen: Fraunces-cijfers zijn "oldstyle" (ongelijke hoogte). */}
                  <span className="text-xl font-bold leading-none">{d.getDate()}</span>
                  {/* Weekoverzicht in één oogopslag: één streepje per maaltijd, gevuld = gepland. */}
                  <span aria-hidden className="flex flex-col items-center gap-[3px]">
                    {momenten.map((m) => {
                      const gepland = plan.some((p) => p.plan_date === dag && p.meal_type === m);
                      return (
                        <span
                          key={m}
                          className={`h-1 w-5 rounded-full ${
                            gepland
                              ? actief
                                ? "bg-honing"
                                : "bg-primary"
                              : actief
                                ? "bg-white/20"
                                : "bg-border"
                          }`}
                        />
                      );
                    })}
                  </span>
                  {/* Volledige uitleg als verborgen tekst ná de zichtbare tekst, zodat de
                      knopnaam altijd begint met wat je ziet ("ma 2") — WCAG 2.5.3. */}
                  <span className="sr-only">
                    {`, ${d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })}${isVandaag ? ", vandaag" : ""}${aantal ? `, ${aantal} gepland` : ""}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {weekRaster()}
        {tablet ? (
          <TabletWeek
            week={week}
            gekozen={gekozenDag}
            vandaag={vandaag}
            plan={plan}
            zichtbaar={zichtbareDagen}
            onKies={(dag) => {
              setDagKeuze(dag);
              setHeleWeek(false);
            }}
          >
            {toonDag(gekozenDag, true)}
          </TabletWeek>
        ) : heleWeek ? (
          <section aria-label="Hele week" className="space-y-6 lg:hidden">
            <div className="flex items-end gap-3">
              <h2 className="min-w-0 flex-1 text-sectietitel">De hele week</h2>
              <Button
                variant="ghost"
                onClick={() => setHeleWeek(false)}
                className="h-11 min-h-11 shrink-0 px-3 text-base"
              >
                Per dag
              </Button>
            </div>
            {zichtbareDagen.map((dag) => <div key={dag}>{toonDag(dag, false)}</div>)}
          </section>
        ) : (
          <section
            aria-label="Gekozen dag"
            className="lg:hidden"
            onTouchStart={(e) => veegDag(e, true)}
            onTouchEnd={(e) => veegDag(e, false)}
          >
            {toonDag(gekozenDag, true)}
            <p className="mt-4 text-center text-[0.95rem] text-muted-foreground">
              Veeg opzij voor de vorige of volgende dag
            </p>
          </section>
        )}

        {/* Usecase 7: lege dagen deze week? Per dag één voorstel, met redenen en ongedaan maken.
            Alleen in je eigen weekmenu (daar is ongedaan maken altijd mogelijk). */}
        {/* Niet tegelijk met "Laat Foodlo kiezen": één voorstel tegelijk. */}
        {eigenMenu && weekVerschil >= 0 && !voorstelOpen ? (
          <VulAan
            legeDagen={legeDagen}
            moment={hoofdMoment}
            alGepland={new Set(plan.map((p) => p.recipe_id).filter((id): id is string => !!id))}
            vandaag={vandaag}
            onZet={zetVoorstel}
          />
        ) : null}

        {/* Acties (review 2026-11-12, punt 4): eerst plannen (twee rustige knoppen naast elkaar),
            dan één gevulde hoofdknop voor de boodschappen. Zelf dagen kiezen is een tekstlink. */}
        <section aria-label="Acties" className="space-y-3 lg:col-span-2">
          {/* Naast elkaar als het past; bij grote tekst onder elkaar. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const startDag = gekozenDag >= vandaag ? gekozenDag : voorstelDagen[0];
                if (!startDag) {
                  toast("Deze week is voorbij. Ga naar volgende week om iets te plannen.");
                  return;
                }
                setKiezen({ datum: startDag, moment: momenten[momenten.length - 1] ?? "avondeten", vraagDag: true });
              }}
              className="h-auto min-h-16 gap-2 px-3 text-base"
            >
              <Plus className="size-5 shrink-0" /> Gerecht toevoegen
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!voorstelDagen.length) {
                  toast("Er zijn in deze week geen komende dagen meer. Ga naar volgende week.");
                  return;
                }
                setVoorstelOpen(true);
              }}
              className="h-auto min-h-16 gap-2 px-3 text-base"
            >
              <Wand2 className="size-5 shrink-0" /> Laat Foodlo kiezen
            </Button>
          </div>
          {/* V2-kringloop: wat nog nodig is, min voorraad en lijst — één tik. */}
          <Button asChild className="h-auto min-h-16 w-full flex-col gap-0.5 py-3 text-lg">
            <Link to="/aanvullen">
              <span className="flex items-center gap-3">
                <ShoppingCart className="size-6 shrink-0" /> Slim aanvullen
              </span>
              <span className="text-base font-normal opacity-90">
                Wat je deze week nog nodig hebt, op je lijst
              </span>
            </Link>
          </Button>
          <div className="text-center">
            <Button
              variant="link"
              onClick={() => setBoodschappenOpen(true)}
              className="h-auto min-h-12 px-2 text-base"
            >
              Of kies zelf welke dagen op de lijst komen
            </Button>
          </div>
        </section>
      </div>

      <Sheet open={boodschappenOpen} onOpenChange={setBoodschappenOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Boodschappen voor deze week</SheetTitle>
            <SheetDescription>Kies de hele week, of alleen een dag waarop je iets gepland hebt.</SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-4">
            {lijsten.length > 1 ? <select value={lijstId || (weergave === "gezin" && gezinsLijst ? gezinsLijst.id : lijsten[0]?.id ?? "")} onChange={(e) => setLijstId(e.target.value)} aria-label="Naar welk lijstje?" className="h-14 w-full rounded-xl border border-input bg-card px-3 text-base">{lijsten.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select> : null}
            {plan.some((p) => p.recipe_id) ? (
              <>
                <Button onClick={() => { void alleBoodschappen(); setBoodschappenOpen(false); }} className="h-16 w-full text-base">
                  <ShoppingCart className="size-5" /> Hele week op de lijst
                </Button>
                <div>
                  <p className="mb-2 text-base font-semibold text-muted-foreground">Of kies één dag</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {getoondeDagen
                      .filter((dag) => plan.some((p) => p.plan_date === dag && p.recipe_id))
                      .map((dag) => {
                        const aantal = plan.filter((p) => p.plan_date === dag && p.recipe_id).length;
                        return (
                          <Button
                            key={dag}
                            variant="outline"
                            onClick={() => { void boodschappenVoorDag(dag); setBoodschappenOpen(false); }}
                            className="h-14 w-full justify-between px-4 text-base capitalize"
                          >
                            <span>{labelVoor(dag)}</span>
                            <span className="text-base font-normal text-muted-foreground">{aantal} {aantal === 1 ? "gerecht" : "gerechten"}</span>
                          </Button>
                        );
                      })}
                  </div>
                </div>
              </>
            ) : (
              <p role="status" className="rounded-xl bg-secondary p-4 text-base text-secondary-foreground">
                In deze week staan nog geen gerechten met een recept. Plan eerst een recept om de ingrediënten toe te voegen.
              </p>
            )}
            <Button variant="outline" asChild className="h-14 w-full text-base"><Link to="/boodschappen">Open mijn boodschappenlijst</Link></Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Eén rustig overzicht vóór er iets op de lijst komt: wat staat er al,
          wat is nieuw, en de gebruiker beslist zelf. */}
      <Sheet open={!!dubbelVraag} onOpenChange={(open) => { if (!open) setDubbelVraag(null); }}>
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 p-0">
          {dubbelVraag ? (() => {
            const dubbelIdx = new Set(dubbelVraag.dubbels.map((d) => d.index));
            const nieuweItems = dubbelVraag.rows.filter((_, i) => !dubbelIdx.has(i));
            const allesAlOpLijst = nieuweItems.length === 0;
            return (
              <>
                <SheetHeader className="border-b border-border px-4 pb-3 pt-4 text-left">
                  <SheetTitle>
                    {allesAlOpLijst
                      ? `De boodschappen van ${dubbelVraag.bron} staan al op je lijst`
                      : `Boodschappen voor ${dubbelVraag.bron}`}
                  </SheetTitle>
                  <SheetDescription>
                    {allesAlOpLijst
                      ? "Er wordt niets dubbel gezet. Wil je iets toch nog eens toevoegen, vink het hieronder aan."
                      : `Je hebt ${dubbelVraag.rows.length} ${dubbelVraag.rows.length === 1 ? "ingrediënt" : "ingrediënten"} nodig. ${dubbelVraag.dubbels.length} ${dubbelVraag.dubbels.length === 1 ? "staat" : "staan"} al op je lijst.`}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                  <div>
                    <p className="mb-2 text-base font-bold uppercase tracking-wide text-muted-foreground">Al op je lijst</p>
                    <ul className="space-y-2">
                      {dubbelVraag.dubbels.map((d) => {
                        const aan = dubbelVraag.gekozen.has(d.index);
                        return (
                          <li key={d.index}>
                            <button
                              type="button"
                              aria-pressed={aan}
                              onClick={() =>
                                setDubbelVraag((v) => {
                                  if (!v) return v;
                                  const gekozen = new Set(v.gekozen);
                                  if (gekozen.has(d.index)) gekozen.delete(d.index);
                                  else gekozen.add(d.index);
                                  return { ...v, gekozen };
                                })
                              }
                              className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-base font-semibold">{d.name}</span>
                                <span className="block text-base text-muted-foreground">Staat al op je lijst: {d.bestaand}</span>
                              </span>
                              <span className={aan ? "shrink-0 rounded-full bg-primary px-3 py-1 text-base font-semibold text-primary-foreground" : "shrink-0 rounded-full bg-secondary px-3 py-1 text-base font-semibold text-secondary-foreground"}>
                                {aan ? "Nog eens toevoegen" : "Niet toevoegen"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {nieuweItems.length ? (
                    <div>
                      <p className="mb-2 text-base font-bold uppercase tracking-wide text-muted-foreground">Nieuw — komt er automatisch bij</p>
                      <ul className="space-y-1">
                        {nieuweItems.map((item, i) => (
                          <li key={i} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-base">
                            <Check className="size-4 shrink-0 text-primary" />
                            <span>{item.name}{item.quantity != null ? ` — ${item.quantity} ${item.unit ?? ""}`.trim() : ""}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-2 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                  {allesAlOpLijst ? (
                    <>
                      <Button variant="outline" asChild className="h-14 text-base">
                        <Link to="/boodschappen">Bekijk mijn lijst</Link>
                      </Button>
                      {dubbelVraag.gekozen.size ? (
                        <Button className="h-14 text-base" onClick={dubbelBevestigen}>
                          Gekozen ingrediënten toch toevoegen
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Button className="h-14 text-base" onClick={dubbelBevestigen}>
                        {dubbelVraag.gekozen.size ? "Gekozen + nieuwe toevoegen" : "Alleen nieuwe toevoegen"}
                      </Button>
                      {!dubbelVraag.gekozen.size ? (
                        <Button
                          variant="outline"
                          className="h-14 text-base"
                          onClick={() =>
                            setDubbelVraag((v) =>
                              v ? { ...v, gekozen: new Set(v.dubbels.map((d) => d.index)) } : v,
                            )
                          }
                        >
                          Alles toevoegen (ook wat er al staat)
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              </>
            );
          })() : null}
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

      {verplaats && (
        <VerplaatsSheet
          rij={verplaats.rij}
          kopie={verplaats.kopie}
          momenten={momenten}
          onSluit={() => setVerplaats(null)}
          onKies={(d, m) => void verplaatsNaar(verplaats.rij, d, m, verplaats.kopie)}
        />
      )}

      {koppelRij && (
        <KoppelSheet
          rij={koppelRij}
          onSluit={() => setKoppelRij(null)}
          onKies={(r) => void koppelRecept(koppelRij, r)}
          onNieuw={() => navigate({ to: "/recepten/nieuw", search: { title: koppelRij.custom_title ?? "", koppel: koppelRij.id } })}
        />
      )}

      {vervangRij && (
        <KoppelSheet
          rij={vervangRij}
          titel="Ander gerecht"
          uitleg={`In plaats van “${vervangRij.recipes?.title ?? "dit gerecht"}” op ${labelVoor(vervangRij.plan_date)}. Je lijst past zich aan.`}
          beginZoek=""
          zonder={vervangRij.recipe_id}
          onSluit={() => setVervangRij(null)}
          onKies={async (r) => {
            const id = await menuWijziging(
              planVervang(vervangRij.id, r.id),
              `${r.title} in plaats van ${vervangRij.recipes?.title ?? "het vorige gerecht"}`,
            );
            if (id !== null) setVervangRij(null);
          }}
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



