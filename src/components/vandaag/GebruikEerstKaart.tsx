/**
 * P3 "Gebruik eerst" op Vandaag: restjes die bijna aan hun richtwaarde zitten (2 à 3 dagen na het
 * koken) en verse producten die al even in huis zijn (alleen als je je voorraad bijhoudt), met
 * één voorstel uit de engine dat het opmaakt. Nooit "bedorven" of "vervalt": alleen richtwaarden.
 * Uit met "Slimme voorstellen". Allergieën en dieet: dezelfde regel als overal.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChefHat, Hourglass, Loader2, Soup } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRestjes } from "@/hooks/useRestjes";
import { useVoorstelBronnen } from "@/hooks/useVoorstelBronnen";
import { bepaalContext } from "@/lib/intelligentie/context";
import { dagenTekst, voorstelDatOpmaakt } from "@/lib/intelligentie/gebruik-eerst";
import { vatSamen } from "@/lib/intelligentie/geschiedenis";
import { nietTonenLijst } from "@/lib/intelligentie/niet-nu";
import {
  bijnaOpRestjes,
  gekooktTekst,
  planRestje,
  restjeVeilig,
  type Restje,
} from "@/lib/intelligentie/restjes";
import { useSlimmeVoorstellen } from "@/lib/intelligentie/slim";
import { leesKennismaking } from "@/lib/kennismaking";
import { meet } from "@/lib/meten";
import { beveelAan } from "@/lib/planner/engine";
import { usePlanProfiel } from "@/hooks/usePlanProfiel";
import { lokaleDatum } from "@/lib/tijd";
import { zitInVoorraad } from "@/lib/voorraad-match";
import { useT, useVoorkeuren } from "@/lib/voorkeuren";

type ReceptKort = {
  id: string;
  title: string;
  category: string | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  tags?: string[] | null;
};

const minutenVan = (r: ReceptKort) => (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);

/**
 * P4: wat "Gebruik eerst" zou tonen (restjes en wat al even in huis is), zonder iets te tekenen.
 * Zo kan Vandaag kiezen welke ene proactieve kaart er komt.
 */
export function useGebruikEerst(recepten: readonly ReceptKort[]) {
  const { user } = useAuth();
  const { weekmenu } = useVoorkeuren();
  const [slim] = useSlimmeVoorstellen();
  const plan = usePlanProfiel();
  const alleRestjes = useRestjes();
  const ids = useMemo(() => recepten.map((r) => r.id), [recepten]);
  const { data: bronnen } = useVoorstelBronnen(ids, slim);

  const kennis = useMemo(() => leesKennismaking(user?.id), [user?.id]);
  const restjes = useMemo(
    () =>
      bijnaOpRestjes(alleRestjes).filter((r) =>
        restjeVeilig(r, r.receptId ? bronnen?.ingredienten[r.receptId] : undefined, kennis),
      ),
    [alleRestjes, bronnen, kennis],
  );

  // Eén voorstel dat een product opmaakt dat al even in huis is (zelfde engine als Vanavond).
  const opmaken = useMemo(() => {
    if (!bronnen || !bronnen.oudInHuis.length) return null;
    const nu = new Date();
    const context = bepaalContext(nu, null);
    const dag = weekmenu.perDag?.[String(context.weekdag)];
    const minuten = Object.fromEntries(recepten.map((r) => [r.id, minutenVan(r)]));
    const lijst = beveelAan({
      kandidaten: recepten.map((r) => ({
        id: r.id,
        title: r.title,
        minuten: minutenVan(r),
        category: r.category,
        tags: r.tags ?? [],
        ingredienten: bronnen.ingredienten[r.id] ?? [],
        vereist: bronnen.vereist[r.id] ?? [],
      })),
      apparatuur: plan.apparatuur,
      context,
      voorraad: bronnen.voorraad,
      geschiedenis: vatSamen(bronnen.plan, minuten, context.datum),
      sterren: bronnen.sterren,
      favorieten: bronnen.favorieten,
      voorkeur: {
        maxMinuten: dag?.maxMinuten || weekmenu.maxMinuten || 0,
        soort: dag?.soort ?? null,
        vermijd: weekmenu.vermijd ?? "",
        dieet: kennis.dieet,
      },
      allergieen: kennis.allergieen,
      nietNu: nietTonenLijst(user?.id),
      oudInHuis: bronnen.oudInHuis,
      onlangsGekocht: bronnen.onlangsGekocht,
      max: 12,
    });
    return {
      oud: bronnen.oudInHuis.slice(0, 3),
      voorstel: voorstelDatOpmaakt(lijst, bronnen.oudInHuis.slice(0, 3), (n, p) =>
        zitInVoorraad(n, [p]),
      ),
    };
  }, [bronnen, recepten, weekmenu, kennis, user?.id, plan.apparatuur]);

  return { slim, restjes, opmaken };
}

export function GebruikEerstKaart({
  recepten,
  restjeKnop = true,
  toonRestjes = true,
  toonVoorraad = true,
  voet,
}: {
  recepten: readonly ReceptKort[];
  /** Nee als de Nu-kaart zelf al "Eet vanavond restjes" toont (niets gepland). */
  restjeKnop?: boolean;
  /** P4: per soort aan of uit (Instellingen › Suggesties). */
  toonRestjes?: boolean;
  toonVoorraad?: boolean;
  /** P4: "Niet meer tonen" en de link naar de instellingen. */
  voet?: ReactNode;
}) {
  const t = useT();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { momenten } = useVoorkeuren();
  const [bezig, setBezig] = useState(false);
  const eerst = useGebruikEerst(recepten);
  const restjes = toonRestjes ? eerst.restjes : [];
  const opmaken = toonVoorraad ? eerst.opmaken : null;

  if (!eerst.slim || !user || (!restjes.length && !opmaken?.oud.length)) return null;

  async function eetVanavond(r: Restje) {
    if (!user || bezig) return;
    setBezig(true);
    try {
      const moment = momenten.includes("avondeten")
        ? "avondeten"
        : (momenten.at(-1) ?? "avondeten");
      const { data, error } = await supabase
        .from("meal_plan")
        .insert({
          user_id: user.id,
          recipe_id: null,
          custom_title: `Restjes: ${r.titel}`,
          plan_date: lokaleDatum(),
          meal_type: moment,
          personen: r.porties,
          group_id: null,
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("geen id");
      planRestje(user.id, r.id, lokaleDatum());
      void meet("restjes.vanavond", undefined, { bron: "gebruik-eerst" });
      const vernieuw = () => {
        for (const k of ["home-dagmenu", "home-week", "meal-plan"])
          void qc.invalidateQueries({ queryKey: [k] });
      };
      vernieuw();
      toast.success(`Restjes van ${r.titel} staan op vanavond`, {
        duration: 8000,
        action: {
          label: "Ongedaan maken",
          onClick: async () => {
            await supabase.from("meal_plan").delete().eq("id", data.id);
            planRestje(user.id, r.id, null);
            vernieuw();
          },
        },
      });
    } catch {
      toast.error("Dat lukte niet. Er is niets veranderd; probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <section aria-labelledby="gebruik-eerst-titel" className="paneel space-y-4 p-4 sm:p-5">
      <div>
        <h2 id="gebruik-eerst-titel" className="flex items-center gap-2 text-sectietitel">
          <Hourglass className="size-6 shrink-0 text-[var(--honing-foreground)]" aria-hidden />
          {t("Gebruik eerst")}
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          {t("Richtwaarden, geen garantie: kijk, ruik en proef zelf.")}
        </p>
      </div>
      {restjes.length ? (
        <ul className="space-y-3" aria-label={t("Restjes")}>
          {restjes.map((r) => (
            <li key={r.id} className="rounded-2xl bg-secondary p-3 sm:p-4" data-restje={r.titel}>
              <p className="flex items-start gap-2 text-lg font-semibold break-words">
                <Soup className="mt-1 size-5 shrink-0" aria-hidden />
                <span>{r.titel}</span>
              </p>
              <p className="text-base text-muted-foreground">
                {gekooktTekst(r)} · {r.porties} {r.porties === 1 ? "portie" : "porties"} ·{" "}
                {r.laatsteDag ? t("best vandaag op") : t("best vandaag of morgen op")}
              </p>
              {restjeKnop ? (
                <button
                  type="button"
                  onClick={() => void eetVanavond(r)}
                  disabled={bezig}
                  className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-primary px-4 text-base font-semibold text-primary disabled:opacity-60"
                >
                  {bezig ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
                  {t("Eet vanavond op")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {opmaken?.oud.length ? (
        <div className="rounded-2xl bg-secondary p-3 sm:p-4" data-testid="gebruik-eerst-voorraad">
          <p className="text-base">
            <span className="font-semibold">{t("Al even in huis")}:</span>{" "}
            {opmaken.oud.map((o) => `${o.naam} (${dagenTekst(o.dagen)})`).join(", ")}
          </p>
          {opmaken.voorstel ? (
            <>
              <p className="mt-2 text-base">
                {t("Foodlo stelt voor")}:{" "}
                <span className="font-semibold">{opmaken.voorstel.voorstel.title}</span>{" "}
                <span className="text-muted-foreground">
                  ({t("maakt")} {opmaken.voorstel.product.naam} {t("op")})
                </span>
              </p>
              <Link
                to="/recepten/$id"
                params={{ id: opmaken.voorstel.voorstel.id }}
                className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-primary px-4 text-base font-semibold text-primary"
              >
                <ChefHat className="size-5" aria-hidden />
                {t("Bekijk recept")}
              </Link>
            </>
          ) : (
            <p className="mt-2 text-base text-muted-foreground">
              {t("Geen recept gevonden dat het opmaakt. Voeg er een toe of kook vrij.")}
            </p>
          )}
        </div>
      ) : null}
      {voet}
    </section>
  );
}
