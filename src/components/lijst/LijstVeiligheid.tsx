/**
 * Fase 1 — veiligheid op de boodschappenlijst. Een product dat botst met iemand die meeëet aan
 * een geplande maaltijd (komende 7 dagen) krijgt een kleine markering en "Vervanger zoeken".
 *
 * - Zelfde oordeel als overal (`productOordeel` in voorstel-eters.ts).
 * - Alleen met een gedeelde reden: anders zou "hazelnoten — niet voor Lotte" verraden wat Lotte
 *   niet mag. Voor die leden staat de waarschuwing op het gerecht (Week, Vandaag), niet hier.
 * - Vervangers komen uit de vaste tabel van de kookassistent, getoetst aan wie meeëet.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Info, Search, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OordeelMelding } from "@/components/veiligheid/EtersOordeel";
import { useAuth } from "@/hooks/useAuth";
import { useMaaltijdEters } from "@/hooks/useMaaltijdEters";
import { etersUit } from "@/lib/assistent/eters";
import { veiligeVervangers, type Vervanger } from "@/lib/assistent/vervangingen";
import type { HuishoudenLid } from "@/lib/gezin-veiligheid";
import { leesKennismaking } from "@/lib/kennismaking";
import { plannenVoorProduct } from "@/lib/maaltijd-eters";
import { lokaleDatum } from "@/lib/tijd";
import { cn } from "@/lib/utils";
import { namenLijst, productOordeel, redenRegel, type MaaltijdOordeel } from "@/lib/voorstel-eters";

export type LijstBotsing = { oordeel: MaaltijdOordeel; eters: HuishoudenLid[] };

function plusDagen(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return lokaleDatum(d);
}

/** Botsingen per lijstregel (id → oordeel), alleen voor open regels. */
export function useLijstBotsingen(
  items: readonly { id: string; name: string; recipe_id?: string | null; checked: boolean }[],
): { botsingen: Record<string, LijstBotsing>; mee: ReturnType<typeof useMaaltijdEters> } {
  const { user } = useAuth();
  const vandaag = lokaleDatum();
  const { data: plannen = [] } = useQuery({
    queryKey: ["lijst-veiligheid-plan", user?.id, vandaag],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: rijen } = await supabase
        .from("meal_plan")
        .select("id, recipe_id")
        .gte("plan_date", vandaag)
        .lte("plan_date", plusDagen(vandaag, 6))
        .not("recipe_id", "is", null);
      const lijst = (rijen ?? []) as { id: string; recipe_id: string | null }[];
      const ids = [...new Set(lijst.map((r) => r.recipe_id).filter((x): x is string => !!x))];
      if (!ids.length) return [];
      const { data: ingr } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, name")
        .in("recipe_id", ids);
      return lijst.map((p) => ({
        ...p,
        ingredienten: (ingr ?? []).filter((i) => i.recipe_id === p.recipe_id).map((i) => i.name),
      }));
    },
  });
  const mee = useMaaltijdEters(plannen.map((p) => p.id));
  // Je eigen allergieën: die controleert de lijst al bij het toevoegen en in de winkelmodus.
  const voeding = mee.voeding;
  const sleutel = items.map((i) => `${i.id}:${i.name}:${i.checked}`).join("|");
  const botsingen = useMemo(() => {
    const uit: Record<string, LijstBotsing> = {};
    if (!mee.leden.length || !plannen.length) return uit;
    for (const item of items) {
      if (item.checked) continue;
      const planIds = plannenVoorProduct(item.name, item.recipe_id, plannen);
      if (!planIds.length) continue;
      const eters = mee.leden.filter((l) =>
        planIds.some((p) => mee.etersVan(p).some((e) => e.id === l.id)),
      );
      const oordeel = productOordeel(item.name, { eters, voeding, kijkerId: user?.id });
      if (oordeel.niveau !== "ok") uit[item.id] = { oordeel, eters };
    }
    return uit;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel, plannen, mee.leden, mee.etersVan, voeding, user?.id]);
  return { botsingen, mee };
}

/** De markering onder de productnaam. */
export function LijstBotsingLabel({
  naam,
  botsing,
  onVervanger,
}: {
  naam: string;
  botsing: LijstBotsing | undefined;
  onVervanger: () => void;
}) {
  if (!botsing) return null;
  const o = botsing.oordeel;
  const hard = o.niveau === "hard";
  const wie = hard ? o.hard : o.zacht;
  return (
    <span
      data-testid="lijst-botsing"
      data-niveau={o.niveau}
      className={cn(
        "mt-1 flex w-full flex-col items-start gap-1 rounded-lg px-2 py-1 text-[0.95rem] font-semibold leading-snug",
        hard
          ? "bg-terracotta-zacht text-foreground ring-1 ring-terracotta"
          : "border border-dashed border-honing bg-honing-zacht text-honing-foreground",
      )}
    >
      <span className="flex w-full items-start gap-1">
        {hard ? (
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-terracotta" aria-hidden />
        ) : (
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 hyphens-auto">
          {hard ? "Niet voor" : "Liever niet voor"} {wie.map(redenRegel).join("; ")}
        </span>
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onVervanger();
        }}
        aria-label={`Vervanger zoeken voor ${naam}`}
        className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        Vervanger zoeken
      </button>
    </span>
  );
}

/** Onderblad met vervangers die passen voor iedereen die meeëet. */
export function VervangerSheet({
  item,
  botsing,
  voeding,
  onSluit,
  onKies,
}: {
  item: { id: string; name: string } | null;
  botsing: LijstBotsing | undefined;
  voeding: ReturnType<typeof useMaaltijdEters>["voeding"];
  onSluit: () => void;
  onKies: (v: Vervanger) => void;
}) {
  const { user } = useAuth();
  const eters = useMemo(
    () => etersUit(leesKennismaking(user?.id), botsing?.eters ?? [], voeding, user?.id),
    [botsing, voeding, user?.id],
  );
  const uitkomst = item ? veiligeVervangers(item.name, eters) : null;
  return (
    <Sheet open={!!item} onOpenChange={(open) => (open ? undefined : onSluit())}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Vervanger voor {item?.name}</SheetTitle>
          <SheetDescription>
            Voor wie meeëet: {namenLijst((botsing?.eters ?? []).map((e) => e.naam))}.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <OordeelMelding oordeel={botsing?.oordeel} />
          {uitkomst?.geschikt.length ? (
            <ul className="space-y-2" aria-label="Vervangers die passen">
              {uitkomst.geschikt.map((v) => (
                <li key={v.naam} className="paneel flex flex-col gap-2 p-4">
                  <p className="text-lg font-semibold">{v.naam}</p>
                  <p className="text-base">{v.reden}</p>
                  <p className="text-[0.95rem] text-muted-foreground">Hoeveel: {v.verhouding}</p>
                  <Button variant="outline" className="self-start" onClick={() => onKies(v)}>
                    Zet {v.naam} op mijn lijst
                    <ArrowRight className="size-5" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-muted px-4 py-3 text-base">
              {uitkomst?.bekend
                ? "Foodlo vond geen vervanger die voor iedereen past."
                : "Foodlo kent hier nog geen vaste vervanger voor."}{" "}
              Pas het product zelf aan, of kies in het weekmenu een ander gerecht.
            </p>
          )}
          {uitkomst?.afgevallen.length ? (
            <details className="text-base">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">
                Niet voorgesteld ({uitkomst.afgevallen.length})
              </summary>
              <ul className="space-y-1 text-muted-foreground">
                {uitkomst.afgevallen.map((a) => (
                  <li key={a.vervanger.naam}>
                    {a.vervanger.naam}: {a.redenen.join(", ")}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
