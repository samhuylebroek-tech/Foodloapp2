/**
 * P4 — Alles wat de assistent moet weten om een voorstel te maken: je weekmenu (vanaf vandaag,
 * twee weken), wie meeëet, je recepten in de vorm van de planner-engine, je regels (allergie,
 * dieet, liever niet, keuken) en je budget. Alleen lezen; niets verlaat het toestel.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMaaltijdEters } from "@/hooks/useMaaltijdEters";
import { usePlanProfiel } from "@/hooks/usePlanProfiel";
import { useKandidaten, usePlannerGegevens } from "@/hooks/usePlannerGegevens";
import { useVoorstelEters } from "@/hooks/useVoorstelEters";
import { useWeekbudget } from "@/hooks/useWeekbudget";
import type { AssistentContext, MenuRij } from "@/lib/assistent/acties";
import { vatSamen } from "@/lib/intelligentie/geschiedenis";
import { nietTonenLijst } from "@/lib/intelligentie/niet-nu";
import { leesKennismaking, standaardPersonen } from "@/lib/kennismaking";
import { metEigenRegels } from "@/lib/maaltijd-eters";
import { lokaleDatum } from "@/lib/tijd";
import { useVoorkeuren } from "@/lib/voorkeuren";

export const ASSISTENT_MENU = "assistent-menu";

function plusDagen(datum: string, n: number) {
  const d = new Date(`${datum}T12:00:00`);
  d.setDate(d.getDate() + n);
  return lokaleDatum(d);
}

type Rij = {
  id: string;
  plan_date: string;
  meal_type: string;
  recipe_id: string | null;
  custom_title: string | null;
  personen: number | null;
};

export function useAssistentContext() {
  const { user } = useAuth();
  const vandaag = lokaleDatum();
  const tot = plusDagen(vandaag, 13);
  const g = usePlannerGegevens();
  const kandidaten = useKandidaten(g);
  const plan = usePlanProfiel();
  const [budget] = useWeekbudget();
  const { momenten, weekmenu } = useVoorkeuren();
  const huis = useVoorstelEters({});
  const { data: ruw, isSuccess: menuKlaar } = useQuery({
    queryKey: [ASSISTENT_MENU, user?.id, vandaag],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plan")
        .select("id, plan_date, meal_type, recipe_id, custom_title, personen")
        .eq("user_id", user!.id)
        .is("group_id", null)
        .gte("plan_date", vandaag)
        .lte("plan_date", tot)
        .order("plan_date");
      if (error) throw error;
      return (data ?? []) as Rij[];
    },
  });
  const eters = useMaaltijdEters((ruw ?? []).map((r) => r.id));
  const kennis = leesKennismaking(user?.id);
  const ik = huis.leden.find((l) => l.user_id === user?.id) ?? null;
  const voeding = useMemo(
    () => metEigenRegels(huis.voeding, ik, user?.id, kennis),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [huis.voeding, ik, user?.id, kennis.allergieen.join(","), kennis.dieet],
  );
  /** Leden waarvan je de gegevens niet mag lezen: de server kijkt die na vóór het uitvoeren. */
  const nietLeesbaar = useMemo(
    () => huis.leden.filter((l) => !voeding.get(l.id) && l.user_id !== user?.id).map((l) => l.id),
    [huis.leden, voeding, user?.id],
  );
  const hoofdMoment = momenten.includes("avondeten")
    ? "avondeten"
    : (momenten.at(-1) ?? "avondeten");

  // Wie meeëet als sleutel (de hook zelf geeft elke keer een nieuw object).
  const eterSleutel = (ruw ?? [])
    .map((r) =>
      eters.isGekozen(r.id)
        ? eters
            .etersVan(r.id)
            .map((e) => e.id)
            .join("+")
        : "",
    )
    .join("|");

  const ctx: AssistentContext | null = useMemo(() => {
    if (!user || !g.klaar || !menuKlaar || !ruw || plan.laden) return null;
    const titel = (r: Rij) =>
      r.custom_title ?? g.recepten.find((x) => x.id === r.recipe_id)?.title ?? "Een maaltijd";
    const rijen: MenuRij[] = ruw.map((r) => ({
      id: r.id,
      datum: r.plan_date,
      moment: r.meal_type,
      recipeId: r.recipe_id,
      titel: titel(r),
      personen: r.personen,
      eterIds: eters.isGekozen(r.id) ? eters.etersVan(r.id).map((e) => e.id) : null,
    }));
    const voorraad =
      plan.voorraadniveau === "basis" ? plan.profiel.basisvoorraad : (g.bronnen?.voorraad ?? []);
    return {
      vandaag,
      rijen,
      plan: {
        kandidaten,
        allergieen: kennis.allergieen,
        dieet: kennis.dieet,
        vermijd: weekmenu.vermijd ?? "",
        nietNu: nietTonenLijst(user.id),
        apparatuur: plan.apparatuur,
        kookervaring: plan.kookervaring,
        voorraad,
        oudInHuis: plan.voorraadniveau === "basis" ? [] : (g.bronnen?.oudInHuis ?? []),
        onlangsGekocht: g.bronnen?.onlangsGekocht ?? [],
        geschiedenis: vatSamen(
          g.bronnen?.plan ?? [],
          Object.fromEntries(kandidaten.map((k) => [k.id, k.minuten])),
          vandaag,
        ),
        sterren: g.bronnen?.sterren ?? {},
        favorieten: g.bronnen?.favorieten ?? [],
        budget,
      },
      leden: huis.leden,
      voeding,
      kijkerId: user.id,
      inHuis: voorraad,
      standaardPersonen: standaardPersonen(kennis),
      hoofdMoment,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    g.klaar,
    g.bronnen,
    g.recepten,
    menuKlaar,
    ruw,
    eterSleutel,
    kandidaten,
    plan.laden,
    plan.apparatuur,
    plan.kookervaring,
    plan.voorraadniveau,
    budget,
    voeding,
    huis.leden,
    hoofdMoment,
    weekmenu.vermijd,
  ]);

  return { ctx, nietLeesbaar, eters, budget, regels: g.regels, recepten: g.recepten };
}
