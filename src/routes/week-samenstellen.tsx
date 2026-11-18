/**
 * P1 Slimme planner — "Stel mijn week samen" (Week) en "Maak mijn week goedkoper".
 *
 * 1. Weekcontext: per dag wie meeëet, "Weinig tijd", "Niet thuis", "Feestelijk", "Restjesdag";
 *    welke dagen, 1 of 2 weken, welke maaltijdmomenten. Budget en prijzen staan erbij.
 * 2. Voorstel: per dag een gerecht met waarom, porties en kost; "Goedkoper", "Sneller",
 *    "Past beter" via dezelfde engine en dezelfde veiligheidscontrole.
 * 3. "Bewaar dit menu": alles in één keer via wijzigMenu (lijst gaat mee), één "Ongedaan maken".
 *    Wat al gepland staat, wordt alleen vervangen na een uitdrukkelijke bevestiging.
 *
 * Gezinsleden waarvan je de gegevens niet mag lezen: de server beoordeelt elk gekozen gerecht
 * (alleen waar/onwaar); een afgekeurd gerecht valt weg en Foodlo kiest opnieuw.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarRange, Loader2, ShieldCheck, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";
import {
  DagContextKaart,
  DagVoorstelKaart,
  MenuSamenvatting,
  type DagInstelling,
} from "@/components/planner/SlimmePlanner";
import { datumTekst, labelVoor, maandagVan } from "@/components/planner/gedeeld";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMaaltijdEters } from "@/hooks/useMaaltijdEters";
import { usePlanProfiel } from "@/hooks/usePlanProfiel";
import { useVoorstelBronnen } from "@/hooks/useVoorstelBronnen";
import { useVoorstelEters } from "@/hooks/useVoorstelEters";
import { useWeekbudget } from "@/hooks/useWeekbudget";
import { euro } from "@/lib/budget";
import { vatSamen } from "@/lib/intelligentie/geschiedenis";
import { nietNuLijst } from "@/lib/intelligentie/niet-nu";
import { leesKennismaking, standaardPersonen } from "@/lib/kennismaking";
import {
  lijstUitleg,
  planErbij,
  planSamen,
  planVervang,
  wijzigMenu,
  type PlanUitvoering,
} from "@/lib/kringloop-db";
import { etersVoorMaaltijd, metEigenRegels } from "@/lib/maaltijd-eters";
import { alleRijen } from "@/lib/pagineer";
import { moeilijkheidVan } from "@/lib/planner/apparatuur";
import {
  alternatief,
  ALTERNATIEF_LABEL,
  filterVoorDag,
  GEEN_ALTERNATIEF,
  keuzeVoor,
  maakGoedkoper,
  menuUit,
  sleutelVan,
  stelMenuSamen,
  vervangDag,
  type AlternatiefSoort,
  type DagKeuze,
  type Filter,
  type MenuVoorstel,
  type PlanContext,
  type PlanDag,
  type PlanKandidaat,
} from "@/lib/planner/engine";
import { lokaleDatum } from "@/lib/tijd";
import type { Recipe } from "@/lib/types";
import { serverOordeel } from "@/lib/voeding-db";
import type { EtersContext } from "@/lib/voorstel-eters";
import { useVoorkeuren } from "@/lib/voorkeuren";
import { minutenVan } from "@/lib/weekmenu-voorstel";
import { zichtbareEigenaren } from "@/lib/zichtbare-eigenaren";

type Zoek = { goedkoper?: 1; week?: string };

export const Route = createFileRoute("/week-samenstellen")({
  validateSearch: (s: Record<string, unknown>): Zoek => ({
    ...(s["goedkoper"] === 1 || s["goedkoper"] === "1" ? { goedkoper: 1 as const } : {}),
    ...(typeof s["week"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["week"])
      ? { week: s["week"] }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Stel je week samen – Foodlo" },
      {
        name: "description",
        content: "Foodlo stelt je weekmenu samen voor wie meeëet, met je tijd en je budget.",
      },
    ],
  }),
  component: WeekSamenstellenPagina,
});

type Regel = { name: string; quantity: number | null; unit: string };
type Bestaand = {
  id: string;
  plan_date: string;
  meal_type: string;
  recipe_id: string | null;
  custom_title: string | null;
  personen: number | null;
};

const MOMENT_LABEL: Record<string, string> = {
  ontbijt: "Ontbijt",
  middageten: "Middageten",
  avondeten: "Avondeten",
  maaltijd: "Eten",
};

function plusDagen(datum: string, n: number) {
  const d = new Date(`${datum}T12:00:00`);
  d.setDate(d.getDate() + n);
  return datumTekst(d);
}

/** Alle gegevens die de engine nodig heeft (recepten, hoeveelheden, bronnen, gezin). */
function usePlannerGegevens() {
  const { user } = useAuth();
  const { data: recepten, isSuccess: receptenKlaar } = useQuery({
    queryKey: ["planner-recepten", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Tweede laag naast RLS (BUG-105): alleen jouw recepten en die van je gezin.
      const eigenaren = await zichtbareEigenaren();
      if (!eigenaren.length) return [] as Recipe[];
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .in("user_id", eigenaren)
        .is("deleted_at", null)
        .eq("is_concept", false)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Recipe[];
    },
  });
  const ids = useMemo(() => (recepten ?? []).map((r) => r.id), [recepten]);
  const { data: regels, isSuccess: regelsKlaar } = useQuery({
    queryKey: ["planner-regels", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const uit: Record<string, Regel[]> = {};
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await alleRijen(
          supabase
            .from("recipe_ingredients")
            .select("recipe_id, name, quantity, unit")
            .in("recipe_id", ids.slice(i, i + 100))
            .order("id"),
          20_000,
        );
        for (const r of data) (uit[r.recipe_id as string] ??= []).push(r as unknown as Regel);
      }
      return uit;
    },
  });
  const { data: bronnen, isSuccess: bronnenKlaar } = useVoorstelBronnen(ids, true);
  const klaar =
    receptenKlaar && (ids.length === 0 || (regelsKlaar && bronnenKlaar && !!regels && !!bronnen));
  return { recepten: recepten ?? [], regels: regels ?? {}, bronnen, klaar };
}

function WeekSamenstellenPagina() {
  const { goedkoper, week } = Route.useSearch();
  return (
    <AppShell
      title={goedkoper ? "Maak je week goedkoper" : "Stel je week samen"}
      ondertitel={
        goedkoper
          ? "Foodlo zoekt goedkopere gerechten die voor iedereen passen."
          : "Foodlo stelt een menu voor; jij kijkt het na."
      }
    >
      <div className="mx-auto max-w-3xl space-y-6 pb-8">
        <Link
          to="/planner"
          className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Terug naar Week
        </Link>
        {goedkoper ? <Goedkoper week={week} /> : <Samenstellen week={week} />}
      </div>
    </AppShell>
  );
}

/** Kandidaten voor de engine (zelfde vorm voor samenstellen en goedkoper). */
function useKandidaten(g: ReturnType<typeof usePlannerGegevens>): PlanKandidaat[] {
  return useMemo(
    () =>
      g.recepten.map((r) => ({
        id: r.id,
        title: r.title,
        minuten: minutenVan(r),
        category: r.category ?? null,
        tags: r.tags ?? [],
        ingredienten: g.bronnen?.ingredienten[r.id] ?? [],
        regels: g.regels[r.id] ?? [],
        servings: r.servings,
        vereist: g.bronnen?.vereist[r.id] ?? [],
        moeilijkheid: moeilijkheidVan({
          difficulty: r.difficulty,
          stappen: r.instructions,
          minuten: minutenVan(r),
        }),
      })),
    [g.recepten, g.regels, g.bronnen],
  );
}

/**
 * Serveroordeel voor gezinsleden waarvan je de gegevens niet mag lezen: alleen voor de
 * gerechten die gekozen zijn. Geeft de oordelen en of er nog gecontroleerd wordt.
 */
function useServerControle(nietLeesbaar: readonly string[], gekozen: readonly string[]) {
  const [server, setServer] = useState<Record<string, Map<string, boolean>>>({});
  const open = nietLeesbaar.length ? gekozen.filter((id) => !server[id]) : [];
  const sleutel = open.join(",");
  useEffect(() => {
    if (!sleutel) return;
    let weg = false;
    void Promise.all(
      sleutel
        .split(",")
        .map(async (id) => [id, await serverOordeel(id, [...nietLeesbaar])] as const),
    ).then((paren) => {
      if (!weg) setServer((s) => ({ ...s, ...Object.fromEntries(paren) }));
    });
    return () => {
      weg = true;
    };
  }, [sleutel, nietLeesbaar]);
  return { server, bezig: open.length > 0 };
}

// ---------------------------------------------------------------- samenstellen

function Samenstellen({ week }: { week: string | undefined }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { momenten, weekmenu } = useVoorkeuren();
  const plan = usePlanProfiel();
  const [budget] = useWeekbudget();
  const g = usePlannerGegevens();
  const kandidaten = useKandidaten(g);
  const huis = useVoorstelEters({});
  const mee = useMaaltijdEters([]);
  const vandaag = lokaleDatum();
  const ditMaandag = datumTekst(maandagVan(new Date()));
  const [start, setStart] = useState<string>(() =>
    week && week >= ditMaandag ? week : ditMaandag,
  );
  const [weken, setWeken] = useState<1 | 2>(1);
  const hoofd = momenten.includes("avondeten") ? "avondeten" : (momenten.at(-1) ?? "avondeten");
  const extraMomenten = momenten.filter((m) => m !== hoofd && m !== "maaltijd");
  const [gekozenMomenten, setGekozenMomenten] = useState<string[]>([hoofd]);
  useEffect(() => setGekozenMomenten((m) => (m.length ? m : [hoofd])), [hoofd]);
  const dagen = useMemo(
    () =>
      Array.from({ length: 7 * weken }, (_, i) => plusDagen(start, i)).filter((d) => d >= vandaag),
    [start, weken, vandaag],
  );
  const eind = plusDagen(start, 7 * weken - 1);

  const { data: bestaand = [] } = useQuery({
    queryKey: ["planner-bestaand", user?.id, start, eind],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plan")
        .select("id, plan_date, meal_type, recipe_id, custom_title, personen")
        .eq("user_id", user!.id)
        .is("group_id", null)
        .gte("plan_date", start)
        .lte("plan_date", eind);
      if (error) throw error;
      return (data ?? []) as Bestaand[];
    },
  });
  const titelVan = (b: Bestaand) =>
    b.custom_title ?? g.recepten.find((r) => r.id === b.recipe_id)?.title ?? "een maaltijd";
  const bestaandOp = (datum: string, moment: string) =>
    bestaand.find((b) => b.plan_date === datum && b.meal_type === moment) ?? null;

  const [inst, setInst] = useState<Record<string, DagInstelling>>({});
  const instVoor = (datum: string): DagInstelling =>
    inst[datum] ?? { aan: !bestaandOp(datum, hoofd), eters: null, chips: [] };
  const zetDag = (datum: string, deel: Partial<DagInstelling>) =>
    setInst((o) => ({ ...o, [datum]: { ...instVoor(datum), ...deel } }));

  const [stap, setStap] = useState<"context" | "voorstel" | "bewaard">("context");
  const [seed, setSeed] = useState(1);
  const [versoepel, setVersoepel] = useState<Filter[]>([]);
  const [wissels, setWissels] = useState<Record<string, DagKeuze>>({});
  const [getoond, setGetoond] = useState<Record<string, string[]>>({});
  const [meldingen, setMeldingen] = useState<Record<string, string>>({});
  const [bevestigVervang, setBevestigVervang] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<string | null>(null);

  const kennis = leesKennismaking(user?.id);
  const ik = huis.leden.find((l) => l.user_id === user?.id) ?? null;
  const voeding = useMemo(
    () => metEigenRegels(huis.voeding, ik, user?.id, kennis),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [huis.voeding, ik, user?.id, kennis.allergieen.join(","), kennis.dieet],
  );
  const nietLeesbaar = useMemo(
    () => huis.leden.filter((l) => !voeding.get(l.id) && l.user_id !== user?.id).map((l) => l.id),
    [huis.leden, voeding, user?.id],
  );

  const planDagen: (PlanDag & { etersIds: string[] })[] = useMemo(
    () =>
      dagen
        .filter((d) => instVoor(d).aan)
        .flatMap((datum) =>
          gekozenMomenten.map((moment) => {
            const i = instVoor(datum);
            const wd = String((new Date(`${datum}T12:00:00`).getDay() + 6) % 7);
            const pd = weekmenu.perDag?.[wd];
            const eters = huis.leden.length ? etersVoorMaaltijd(huis.leden, i.eters) : [];
            return {
              datum,
              moment,
              eters: null as EtersContext | null,
              etersIds: eters.map((e) => e.id),
              personen: eters.length || standaardPersonen(kennis),
              maxMinuten: moment === hoofd ? pd?.maxMinuten || weekmenu.maxMinuten || 0 : 0,
              chips: i.chips,
              soort: moment === hoofd ? (pd?.soort ?? null) : null,
            };
          }),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dagen, inst, gekozenMomenten, huis.leden, weekmenu, hoofd, bestaand],
  );

  // Wat al vastligt in deze periode en niet vervangen wordt: niet opnieuw voorstellen.
  const vervangen = new Set(planDagen.map((d) => sleutelVan(d)));
  const blijft = bestaand.filter(
    (b) => b.recipe_id && !vervangen.has(`${b.plan_date}|${b.meal_type}`),
  );

  const [gekozenIds, setGekozenIds] = useState<string[]>([]);
  const controle = useServerControle(nietLeesbaar, gekozenIds);

  const ctx: PlanContext | null = useMemo(() => {
    if (!g.klaar || !g.bronnen) return null;
    const v = plan.voorraadniveau === "basis" ? plan.profiel.basisvoorraad : g.bronnen.voorraad;
    return {
      dagen: planDagen.map((d) => ({
        ...d,
        eters: huis.leden.length
          ? {
              eters: huis.leden.filter((l) =>
                d.etersIds.includes(l.id),
              ),
              voeding,
              kijkerId: user?.id,
              server: controle.server,
            }
          : null,
      })),
      kandidaten,
      allergieen: kennis.allergieen,
      dieet: kennis.dieet,
      vermijd: weekmenu.vermijd ?? "",
      nietNu: nietNuLijst(user?.id),
      apparatuur: plan.apparatuur,
      kookervaring: plan.kookervaring,
      voorraad: v,
      oudInHuis: plan.voorraadniveau === "basis" ? [] : g.bronnen.oudInHuis,
      onlangsGekocht: g.bronnen.onlangsGekocht,
      geschiedenis: vatSamen(
        g.bronnen.plan,
        Object.fromEntries(kandidaten.map((k) => [k.id, k.minuten])),
        vandaag,
      ),
      sterren: g.bronnen.sterren,
      favorieten: g.bronnen.favorieten,
      budget,
      alGepland: new Set(blijft.map((b) => b.recipe_id!)),
      vast: blijft.map((b) => ({ datum: b.plan_date, recipeId: b.recipe_id! })),
      versoepel,
      seed,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    g.klaar,
    g.bronnen,
    planDagen,
    kandidaten,
    voeding,
    controle.server,
    plan.apparatuur,
    plan.kookervaring,
    plan.voorraadniveau,
    budget,
    versoepel,
    seed,
    bestaand,
  ]);

  const menu: MenuVoorstel | null = useMemo(() => {
    if (!ctx || stap === "context") return null;
    let m = stelMenuSamen(ctx);
    // Eigen wissels (Goedkoper / Sneller / Past beter) blijven staan zolang ze veilig zijn.
    m.dagen.forEach((d, i) => {
      const w = wissels[sleutelVan(d)];
      if (!w) return;
      const dag = ctx.dagen[i]!;
      if (
        filterVoorDag({ ...ctx, versoepel: ["herhaling", ...ctx.versoepel!] }, dag).over.some(
          (k) => k.id === w.id,
        )
      )
        m = vervangDag(m, i, w, ctx.budget);
    });
    return m;
  }, [ctx, stap, wissels]);

  const ids = menu?.dagen.map((d) => d.keuze?.id).filter((x): x is string => !!x) ?? [];
  const idSleutel = ids.join(",");
  useEffect(() => setGekozenIds(idSleutel ? idSleutel.split(",") : []), [idSleutel]);

  if (!g.klaar || plan.laden) return <PageSkeleton />;
  if (!g.recepten.length)
    return (
      <EmptyState
        icon={<CalendarRange className="size-8" aria-hidden />}
        title="Nog geen recepten"
        description="Foodlo stelt je week samen uit je eigen recepten. Voeg er eerst een paar toe."
        action={
          <Button asChild>
            <Link to="/recepten/nieuw">Recept toevoegen</Link>
          </Button>
        }
      />
    );

  function kiesAlternatief(index: number, soort: AlternatiefSoort) {
    if (!ctx || !menu) return;
    const d = menu.dagen[index]!;
    const s = sleutelVan(d);
    const alt = alternatief(ctx, menu, index, soort, getoond[s] ?? []);
    if (!alt) {
      setMeldingen((m) => ({ ...m, [s]: GEEN_ALTERNATIEF[soort] }));
      return;
    }
    const vorige = d.keuze;
    setWissels((w) => ({ ...w, [s]: alt }));
    setGetoond((o) => ({ ...o, [s]: [...(o[s] ?? []), ...(vorige ? [vorige.id] : [])] }));
    setMeldingen((m) => ({
      ...m,
      [s]: vorige
        ? `${ALTERNATIEF_LABEL[soort]}: ${alt.title} in plaats van ${vorige.title}.`
        : `${alt.title} gekozen.`,
    }));
  }

  const teVervangen =
    menu?.dagen.filter((d) => d.keuze && bestaandOp(d.datum, d.moment ?? hoofd)) ?? [];

  async function bewaar(vervangOk: boolean) {
    if (!user || !menu || !ctx) return;
    if (teVervangen.length && !vervangOk) {
      setBevestigVervang(true);
      return;
    }
    setBevestigVervang(false);
    setBezig(true);
    const rijen = menu.dagen
      .map((d, i) => ({ d, dag: ctx.dagen[i]! }))
      .filter((x) => x.d.keuze && (vervangOk || !bestaandOp(x.d.datum, x.d.moment ?? hoofd)));
    const acties: (() => Promise<PlanUitvoering>)[] = rijen.map(({ d }) => {
      const b = bestaandOp(d.datum, d.moment ?? hoofd);
      return b
        ? planVervang(b.id, d.keuze!.id)
        : planErbij({
            userId: user.id,
            recipeId: d.keuze!.id,
            datum: d.datum,
            moment: d.moment ?? hoofd,
            personen: d.keuze!.personen,
          });
    });
    try {
      const planIds: (string | undefined)[] = [];
      const r = await wijzigMenu(user.id, planSamen(acties, planIds));
      // Wie meeëet (alleen als het niet het hele huishouden is).
      await Promise.all(
        rijen.map(async ({ dag }, i) => {
          const id = planIds[i];
          const eters = dag.eters?.eters.map((e) => e.id) ?? [];
          if (id && huis.leden.length && eters.length && eters.length < huis.leden.length)
            await mee.bewaarStil(id, eters).catch(() => undefined);
        }),
      );
      void qc.invalidateQueries({ queryKey: ["planner-bestaand"] });
      void qc.invalidateQueries({ queryKey: ["shopping"] });
      void qc.invalidateQueries({ queryKey: ["meal_plan"] });
      const lijst = lijstUitleg(r.effect) || "lijst: niets nieuw";
      const tekst = `Menu bewaard · ${lijst} · ≈ ${euro(menu.kost.totaal)} (schatting)`;
      setResultaat(tekst);
      setStap("bewaard");
      toast.success(tekst, {
        duration: 15_000,
        action: {
          label: "Ongedaan maken",
          onClick: () => {
            void r
              .herstel()
              .then(() => {
                void qc.invalidateQueries();
                setResultaat("Menu teruggezet: je week en je lijst staan weer zoals ervoor.");
                toast.success("Menu teruggezet. Je lijst ook.");
              })
              .catch(() => toast.error("Terugzetten lukte niet helemaal. Kijk je week na."));
          },
        },
      });
    } catch {
      toast.error("Bewaren lukte niet. Er is niets veranderd. Probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  if (stap === "bewaard")
    return (
      <section aria-labelledby="bewaard-titel" className="paneel space-y-4 p-5">
        <h2 id="bewaard-titel" className="text-sectietitel">
          Je menu staat in Week
        </h2>
        <p role="status" className="text-base">
          {resultaat}
        </p>
        <p className="text-[0.95rem] text-muted-foreground">
          Wat verder dan 7 dagen vooruit ligt, zet Foodlo op je lijst als het dichterbij komt (Slim
          aanvullen).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/planner">Naar je weekmenu</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/boodschappen">Naar je lijst</Link>
          </Button>
        </div>
      </section>
    );

  if (stap === "voorstel" && menu)
    return (
      <div className="space-y-5">
        <MenuSamenvatting menu={menu} />
        {controle.bezig ? (
          <p role="status" className="flex items-center gap-2 text-base text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Foodlo controleert de gerechten voor iedereen die meeëet…
          </p>
        ) : nietLeesbaar.length ? (
          <p className="flex items-start gap-2 text-[0.95rem] text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            Gecontroleerd voor iedereen die meeëet, ook wie zijn gegevens niet deelt.
          </p>
        ) : null}
        <ul aria-label="Voorgesteld menu" className="space-y-3">
          {menu.dagen.map((d, i) => (
            <DagVoorstelKaart
              key={sleutelVan(d)}
              uitkomst={d}
              momentLabel={
                gekozenMomenten.length > 1 ? (MOMENT_LABEL[d.moment ?? ""] ?? null) : null
              }
              bezig={bezig}
              melding={meldingen[sleutelVan(d)] ?? null}
              onAlternatief={(s) => kiesAlternatief(i, s)}
              onVersoepel={() => d.krapste && setVersoepel((v) => [...new Set([...v, d.krapste!])])}
            />
          ))}
        </ul>
        {bevestigVervang ? (
          <section
            role="alertdialog"
            aria-labelledby="vervang-titel"
            className="space-y-3 rounded-2xl border-2 border-[var(--honing)] bg-[var(--honing-zacht)] p-4 text-[var(--honing-foreground)]"
          >
            <h2 id="vervang-titel" className="text-lg font-bold">
              {teVervangen.length === 1
                ? "1 maaltijd stond al gepland"
                : `${teVervangen.length} maaltijden stonden al gepland`}
            </h2>
            <ul className="list-disc pl-5 text-base">
              {teVervangen.map((d) => {
                const b = bestaandOp(d.datum, d.moment ?? hoofd)!;
                return (
                  <li key={sleutelVan(d)} className="capitalize-first">
                    {labelVoor(d.datum)}: {titelVan(b)} → {d.keuze!.title}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void bewaar(true)} disabled={bezig}>
                Ja, vervang ze
              </Button>
              <Button variant="outline" onClick={() => setBevestigVervang(false)}>
                Nee, terug
              </Button>
            </div>
          </section>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button
            className="h-14 text-lg"
            disabled={bezig || controle.bezig || !menu.dagen.some((d) => d.keuze)}
            onClick={() => void bewaar(false)}
          >
            {bezig ? "Bezig met bewaren…" : "Bewaar dit menu"}
          </Button>
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => {
                setSeed((s) => s + 1);
                setWissels({});
                setMeldingen({});
              }}
            >
              Ander voorstel
            </Button>
            <Button variant="ghost" onClick={() => setStap("context")}>
              Terug naar je keuzes
            </Button>
          </div>
        </div>
      </div>
    );

  // ---------------------------------------------------------------- stap 1: weekcontext
  const aantal = dagen.filter((d) => instVoor(d).aan).length;
  return (
    <div className="space-y-6">
      <section aria-labelledby="periode-titel" className="space-y-3">
        <h2 id="periode-titel" className="text-sectietitel">
          Welke week?
        </h2>
        <div role="group" aria-label="Week" className="flex flex-wrap gap-2">
          {[
            { w: ditMaandag, label: "Deze week" },
            { w: plusDagen(ditMaandag, 7), label: "Volgende week" },
          ].map((o) => (
            <Button
              key={o.w}
              variant={start === o.w ? "default" : "outline"}
              aria-pressed={start === o.w}
              onClick={() => {
                setStart(o.w);
                setInst({});
              }}
            >
              {o.label}
            </Button>
          ))}
          <Button
            variant={weken === 2 ? "default" : "outline"}
            aria-pressed={weken === 2}
            onClick={() => setWeken(weken === 2 ? 1 : 2)}
          >
            Twee weken
          </Button>
        </div>
        {extraMomenten.length ? (
          <div role="group" aria-label="Maaltijden" className="flex flex-wrap gap-2">
            {[hoofd, ...extraMomenten].map((m) => {
              const aan = gekozenMomenten.includes(m);
              return (
                <Button
                  key={m}
                  variant={aan ? "default" : "outline"}
                  aria-pressed={aan}
                  disabled={m === hoofd}
                  onClick={() =>
                    setGekozenMomenten(
                      aan ? gekozenMomenten.filter((x) => x !== m) : [...gekozenMomenten, m],
                    )
                  }
                >
                  {MOMENT_LABEL[m] ?? m}
                </Button>
              );
            })}
          </div>
        ) : null}
        <p className="text-[0.95rem] text-muted-foreground">
          {budget ? `Budget: ${euro(budget)} per week (schatting). ` : "Geen weekbudget. "}
          Prijzen: vaste richtprijzen, geen winkelprijzen.{" "}
          {plan.apparatuurAangenomen ? "Toestellen: oven en kookplaat aangenomen. " : ""}
          <Link
            to="/mijn-keuken"
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Mijn keuken aanpassen
          </Link>
        </p>
      </section>

      <section aria-labelledby="dagen-titel" className="space-y-3">
        <h2 id="dagen-titel" className="text-sectietitel">
          Hoe ziet je week eruit?
        </h2>
        {dagen.length ? (
          <ul className="space-y-3">
            {dagen.map((d) => {
              const b = bestaandOp(d, hoofd);
              return (
                <DagContextKaart
                  key={d}
                  datum={d}
                  instelling={instVoor(d)}
                  leden={huis.leden}
                  bestaand={b ? titelVan(b) : null}
                  zet={(deel) => zetDag(d, deel)}
                />
              );
            })}
          </ul>
        ) : (
          <p className="text-base">Deze week is voorbij. Kies "Volgende week".</p>
        )}
      </section>

      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 -mx-4 bg-background/95 px-4 py-3 backdrop-blur md:bottom-0">
        <Button
          className="h-14 w-full text-lg"
          disabled={!aantal}
          onClick={() => {
            setWissels({});
            setMeldingen({});
            setGetoond({});
            setVersoepel([]);
            setStap("voorstel");
          }}
        >
          <Wand2 className="size-5" aria-hidden />
          {aantal
            ? `Stel mijn menu samen (${aantal} ${aantal === 1 ? "dag" : "dagen"})`
            : "Kies minstens één dag"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- goedkoper

function Goedkoper({ week }: { week: string | undefined }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const plan = usePlanProfiel();
  const [budget] = useWeekbudget();
  const g = usePlannerGegevens();
  const kandidaten = useKandidaten(g);
  const huis = useVoorstelEters({});
  const vandaag = lokaleDatum();
  const start = week ?? datumTekst(maandagVan(new Date()));
  const eind = plusDagen(start, 6);
  const { data: rijen } = useQuery({
    queryKey: ["planner-bestaand", user?.id, start, eind],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plan")
        .select("id, plan_date, meal_type, recipe_id, custom_title, personen")
        .eq("user_id", user!.id)
        .is("group_id", null)
        .gte("plan_date", start)
        .lte("plan_date", eind);
      if (error) throw error;
      return (data ?? []) as Bestaand[];
    },
  });
  const geplandeRijen = useMemo(
    () =>
      (rijen ?? [])
        .filter((r) => r.recipe_id && r.plan_date >= vandaag)
        .sort((a, b) => a.plan_date.localeCompare(b.plan_date)),
    [rijen, vandaag],
  );
  const eters = useMaaltijdEters(geplandeRijen.map((r) => r.id));
  const kennis = leesKennismaking(user?.id);
  const ik = huis.leden.find((l) => l.user_id === user?.id) ?? null;
  const voeding = useMemo(
    () => metEigenRegels(huis.voeding, ik, user?.id, kennis),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [huis.voeding, ik, user?.id, kennis.allergieen.join(","), kennis.dieet],
  );
  const nietLeesbaar = useMemo(
    () => huis.leden.filter((l) => !voeding.get(l.id) && l.user_id !== user?.id).map((l) => l.id),
    [huis.leden, voeding, user?.id],
  );
  const [naarIds, setNaarIds] = useState<string[]>([]);
  const controle = useServerControle(nietLeesbaar, naarIds);
  const [uit, setUit] = useState<string[]>([]);
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState<string | null>(null);

  const uitkomst = useMemo(() => {
    if (!g.klaar || !g.bronnen || !rijen) return null;
    const metKandidaat = geplandeRijen
      .map((r) => ({ r, k: kandidaten.find((k) => k.id === r.recipe_id) }))
      .filter((x): x is { r: Bestaand; k: PlanKandidaat } => !!x.k);
    const dagen: PlanDag[] = metKandidaat.map(({ r }) => {
      const wie = huis.leden.length ? eters.etersVan(r.id) : [];
      return {
        datum: r.plan_date,
        moment: r.meal_type,
        personen: r.personen ?? (wie.length || standaardPersonen(kennis)),
        eters: wie.length
          ? { eters: wie, voeding, kijkerId: user?.id, server: controle.server }
          : null,
      };
    });
    const ctx: PlanContext = {
      dagen,
      kandidaten,
      allergieen: kennis.allergieen,
      dieet: kennis.dieet,
      nietNu: nietNuLijst(user?.id),
      apparatuur: plan.apparatuur,
      kookervaring: plan.kookervaring,
      budget,
      // Goedkoper hoeft niet sneller: de tijd van de dag blijft een zachte regel.
      versoepel: ["tijd"],
      alGepland: new Set(
        (rijen ?? []).filter((r) => r.plan_date < vandaag && r.recipe_id).map((r) => r.recipe_id!),
      ),
    };
    const huidig = menuUit(
      metKandidaat.map(({ k }, i) => ({ dag: dagen[i]!, keuze: keuzeVoor(ctx, k, dagen[i]!) })),
      budget,
    );
    const { wissels } = maakGoedkoper(ctx, huidig);
    return { huidig, wissels, rijen: metKandidaat.map((x) => x.r) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    g.klaar,
    g.bronnen,
    rijen,
    geplandeRijen,
    kandidaten,
    huis.leden,
    eters,
    voeding,
    controle.server,
    plan.apparatuur,
    plan.kookervaring,
    budget,
  ]);

  const naarSleutel = uitkomst?.wissels.map((w) => w.naar.id).join(",") ?? "";
  useEffect(() => setNaarIds(naarSleutel ? naarSleutel.split(",") : []), [naarSleutel]);

  if (!g.klaar || !uitkomst) return <PageSkeleton />;
  const { huidig, wissels } = uitkomst;
  const gekozen = wissels.filter((w) => !uit.includes(huidig.dagen[w.index]!.datum + w.index));
  const besparing = gekozen.reduce((s, w) => s + w.besparing, 0);

  async function bevestig() {
    if (!user || !uitkomst) return;
    setBezig(true);
    try {
      const r = await wijzigMenu(
        user.id,
        planSamen(gekozen.map((w) => planVervang(uitkomst.rijen[w.index]!.id, w.naar.id))),
      );
      void qc.invalidateQueries({ queryKey: ["planner-bestaand"] });
      void qc.invalidateQueries({ queryKey: ["meal_plan"] });
      const tekst = `Week ≈ ${euro(besparing)} goedkoper (schatting) · ${lijstUitleg(r.effect) || "lijst: niets veranderd"}`;
      setKlaar(tekst);
      toast.success(tekst, {
        duration: 15_000,
        action: {
          label: "Ongedaan maken",
          onClick: () =>
            void r
              .herstel()
              .then(() => {
                void qc.invalidateQueries();
                setKlaar("Teruggezet: je week en je lijst staan weer zoals ervoor.");
              })
              .catch(() => toast.error("Terugzetten lukte niet helemaal. Kijk je week na.")),
        },
      });
    } catch {
      toast.error("Wisselen lukte niet. Er is niets veranderd.");
    } finally {
      setBezig(false);
    }
  }

  if (klaar)
    return (
      <section className="paneel space-y-4 p-5" aria-labelledby="goedkoper-klaar">
        <h2 id="goedkoper-klaar" className="text-sectietitel">
          Gewisseld
        </h2>
        <p role="status" className="text-base">
          {klaar}
        </p>
        <Button asChild>
          <Link to="/planner">Naar je weekmenu</Link>
        </Button>
      </section>
    );

  return (
    <div className="space-y-5">
      <MenuSamenvatting menu={huidig} />
      {!huidig.dagen.length ? (
        <p className="text-base">Er staan deze week (vanaf vandaag) nog geen recepten gepland.</p>
      ) : !wissels.length ? (
        <p role="status" className="text-base">
          Je week is al zo goedkoop als het kan met je eigen recepten (voor iedereen die meeëet).
        </p>
      ) : (
        <>
          <h2 className="text-sectietitel">Zo wordt je week goedkoper</h2>
          <ul aria-label="Voorgestelde wissels" className="space-y-3">
            {wissels.map((w) => {
              const sleutel = huidig.dagen[w.index]!.datum + w.index;
              const aan = !uit.includes(sleutel);
              return (
                <li key={sleutel} className="paneel p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-6 shrink-0 accent-[var(--primary)]"
                      checked={aan}
                      onChange={() =>
                        setUit((u) => (aan ? [...u, sleutel] : u.filter((x) => x !== sleutel)))
                      }
                    />
                    <span className="min-w-0 space-y-1 text-base">
                      <span className="block font-bold capitalize">
                        {labelVoor(huidig.dagen[w.index]!.datum)}
                      </span>
                      <span className="block">
                        {w.van.title} → <strong>{w.naar.title}</strong>
                      </span>
                      <span className="block text-muted-foreground" data-besparing={w.besparing}>
                        ≈ {euro(w.besparing)} goedkoper ·{" "}
                        {w.naar.redenen[0]?.tekst ?? "Past voor iedereen die meeëet"}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {controle.bezig ? (
            <p role="status" className="flex items-center gap-2 text-base text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Foodlo controleert de gerechten voor iedereen die meeëet…
            </p>
          ) : null}
          <Button
            className="h-14 w-full text-lg"
            disabled={bezig || controle.bezig || !gekozen.length}
            onClick={() => void bevestig()}
          >
            {gekozen.length
              ? `Wissel ${gekozen.length} ${gekozen.length === 1 ? "gerecht" : "gerechten"} (≈ ${euro(besparing)} minder)`
              : "Kies minstens één wissel"}
          </Button>
        </>
      )}
    </div>
  );
}
