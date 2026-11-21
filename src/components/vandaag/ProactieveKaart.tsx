/**
 * P4 — Hooguit één proactieve kaart op Vandaag.
 *
 * Kandidaten (in deze volgorde): restjes en bijna over datum ("Gebruik eerst"), budget, weer,
 * gevarieerder eten, seizoen. Per soort aan of uit in Instellingen › Suggesties; elke kaart heeft
 * "Niet meer tonen" (met ongedaan maken). "Slimme voorstellen" uit = geen kaart.
 * Een voorstel om iets te wijzigen gaat altijd via de assistent (voorstel → Doe maar).
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, EyeOff, Leaf, PiggyBank, Settings2, TriangleAlert } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GebruikEerstKaart, useGebruikEerst } from "@/components/vandaag/GebruikEerstKaart";
import { WeerSignaal } from "@/components/vandaag/WeerSignaal";
import { useAuth } from "@/hooks/useAuth";
import { useSuggesties } from "@/hooks/useSuggesties";
import { useVoorstelBronnen } from "@/hooks/useVoorstelBronnen";
import { useWeekbudget } from "@/hooks/useWeekbudget";
import { useWeer } from "@/hooks/useWeer";
import { dagNaam } from "@/lib/assistent/acties";
import { schatWeek } from "@/lib/budget";
import { seizoensProductenIn } from "@/lib/intelligentie/seizoen-producten";
import { useSlimmeVoorstellen } from "@/lib/intelligentie/slim";
import {
  budgetSignaal,
  isAan,
  kiesKaart,
  variatieSignaal,
  type KaartKandidaat,
  type MaaltijdSoort,
} from "@/lib/suggesties";
import { lokaleDatum } from "@/lib/tijd";
import type { Recipe } from "@/lib/types";
import { soortVan } from "@/lib/weekmenu-voorstel";

type Ingr = { name: string; quantity: number | null; unit: string };

function maandagVan(vandaag: string) {
  const d = new Date(`${vandaag}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return lokaleDatum(d);
}

function plusDagen(datum: string, n: number) {
  const d = new Date(`${datum}T12:00:00`);
  d.setDate(d.getDate() + n);
  return lokaleDatum(d);
}

/** Eigen weekmenu van deze week (maandag–zondag), met porties, voor kost en variatie. */
function useEigenWeek(aan: boolean) {
  const { user } = useAuth();
  const vandaag = lokaleDatum();
  const maandag = maandagVan(vandaag);
  return useQuery({
    queryKey: ["home-dagmenu", "suggesties-week", user?.id, maandag],
    enabled: !!user && aan,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_plan")
        .select("plan_date, meal_type, recipe_id, personen")
        .eq("user_id", user!.id)
        .is("group_id", null)
        .gte("plan_date", maandag)
        .lte("plan_date", plusDagen(maandag, 6));
      if (error) throw error;
      return (data ?? []) as {
        plan_date: string;
        meal_type: string;
        recipe_id: string | null;
        personen: number | null;
      }[];
    },
  });
}

function KaartVoet({ onVerberg }: { onVerberg: () => void }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 pt-1">
      <Button variant="ghost" size="sm" className="-ml-3 px-3" onClick={onVerberg}>
        <EyeOff aria-hidden /> Niet meer tonen
      </Button>
      <Link
        to="/instellingen/suggesties"
        className="inline-flex min-h-12 min-w-0 max-w-full items-center gap-1.5 text-[0.95rem] font-semibold underline underline-offset-4"
      >
        <Settings2 className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">Suggesties instellen</span>
      </Link>
    </div>
  );
}

function Kaart({
  label,
  icoon,
  titel,
  children,
  voet,
}: {
  label: string;
  icoon: ReactNode;
  titel: string;
  children: ReactNode;
  voet: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-zacht"
      data-suggestie={label}
    >
      <span className="mt-0.5 shrink-0">{icoon}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-lg font-semibold leading-snug break-words">{titel}</p>
        {children}
        {voet}
      </div>
    </section>
  );
}

const ANDERS: Record<"vlees" | "vis", string> = { vlees: "vegetarisch", vis: "vegetarisch" };

export function ProactieveKaart({
  recepten,
  restjeKnop,
}: {
  recepten: readonly Recipe[];
  restjeKnop: boolean;
}) {
  const [slim] = useSlimmeVoorstellen();
  const sug = useSuggesties();
  const vandaag = lokaleDatum();
  const maandag = maandagVan(vandaag);
  const eerst = useGebruikEerst(recepten);
  const { signaal: weer } = useWeer();
  const [budget] = useWeekbudget();
  const { data: week } = useEigenWeek(slim);
  const ids = useMemo(() => recepten.map((r) => r.id), [recepten]);
  const { data: bronnen } = useVoorstelBronnen(ids, slim);
  const weekIds = useMemo(
    () => [...new Set((week ?? []).map((w) => w.recipe_id).filter((x): x is string => !!x))].sort(),
    [week],
  );
  const { data: hoeveelheden } = useQuery({
    queryKey: ["budget-ingredienten", weekIds.join(",")],
    enabled: slim && !!budget && weekIds.length > 0 && isAan(sug.inst, "budget"),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, name, quantity, unit")
        .in("recipe_id", weekIds);
      if (error) throw error;
      const uit: Record<string, Ingr[]> = {};
      for (const r of data ?? []) (uit[r.recipe_id as string] ??= []).push(r as Ingr);
      return uit;
    },
  });

  const kandidaten = useMemo(() => {
    const uit: (KaartKandidaat & { data?: unknown })[] = [];
    if (eerst.restjes.length)
      uit.push({
        soort: "restjes",
        sleutel: `restjes:${eerst.restjes
          .map((r) => r.id)
          .sort()
          .join(",")}`.slice(0, 120),
      });
    if (eerst.opmaken?.oud.length)
      uit.push({
        soort: "over-datum",
        sleutel: `over-datum:${eerst.opmaken.oud
          .map((o) => o.naam)
          .sort()
          .join(",")}`.slice(0, 120),
      });
    const receptVan = (id: string | null) => recepten.find((r) => r.id === id);
    if (week && hoeveelheden) {
      const kost = schatWeek(
        week.map((w) => ({
          recipe_id: w.recipe_id,
          personen: w.personen,
          servings: receptVan(w.recipe_id)?.servings ?? null,
        })),
        hoeveelheden,
      );
      const b = budgetSignaal(kost, budget);
      if (b) uit.push({ soort: "budget", sleutel: `budget:${maandag}:${b.status}`, data: b });
    }
    if (weer) uit.push({ soort: "weer", sleutel: `weer:${vandaag}:${weer.soort}` });
    if (week && bronnen) {
      const maaltijden = week
        .filter((w) => w.meal_type !== "ontbijt" && receptVan(w.recipe_id))
        .map((w) => ({
          datum: w.plan_date,
          soort: soortVan(
            receptVan(w.recipe_id)!,
            bronnen.ingredienten[w.recipe_id!] ?? [],
          ) as MaaltijdSoort,
        }));
      const v = variatieSignaal(maaltijden, vandaag);
      if (v) uit.push({ soort: "variatie", sleutel: `variatie:${maandag}:${v.soort}`, data: v });
    }
    if (bronnen) {
      const maand = new Date(`${vandaag}T12:00:00`).getMonth();
      const tel = new Map<string, number>();
      for (const r of recepten)
        for (const p of seizoensProductenIn(
          [r.title, ...(bronnen.ingredienten[r.id] ?? [])],
          maand,
        ))
          tel.set(p, (tel.get(p) ?? 0) + 1);
      const [product, aantal] = [...tel.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
      if (product && aantal)
        uit.push({
          soort: "seizoen",
          sleutel: `seizoen:${vandaag.slice(0, 7)}:${product}`,
          data: { product, aantal },
        });
    }
    return uit;
  }, [
    eerst.restjes,
    eerst.opmaken,
    week,
    hoeveelheden,
    budget,
    weer,
    bronnen,
    recepten,
    maandag,
    vandaag,
  ]);

  const kaart = kiesKaart(kandidaten, sug.inst);
  if (!slim || sug.laden || !kaart) return null;

  async function verberg(sleutels: string[]) {
    const vorig = sug.inst;
    try {
      let nieuw = vorig;
      for (const s of sleutels) nieuw = { ...nieuw, verborgen: [...nieuw.verborgen, s] };
      await sug.herstel(nieuw);
      toast("Deze suggestie zie je niet meer", {
        duration: 8000,
        action: { label: "Ongedaan maken", onClick: () => void sug.herstel(vorig) },
      });
    } catch {
      toast.error("Verbergen lukte niet. Probeer het opnieuw.");
    }
  }

  if (kaart.soort === "restjes" || kaart.soort === "over-datum") {
    // "Gebruik eerst" is één kaart voor beide soorten (als ze allebei aan staan).
    const zichtbaar = kandidaten.filter(
      (k) =>
        (k.soort === "restjes" || k.soort === "over-datum") &&
        isAan(sug.inst, k.soort) &&
        !sug.inst.verborgen.includes(k.sleutel),
    );
    return (
      <GebruikEerstKaart
        recepten={recepten}
        restjeKnop={restjeKnop}
        toonRestjes={zichtbaar.some((k) => k.soort === "restjes")}
        toonVoorraad={zichtbaar.some((k) => k.soort === "over-datum")}
        voet={<KaartVoet onVerberg={() => void verberg(zichtbaar.map((k) => k.sleutel))} />}
      />
    );
  }
  const voet = <KaartVoet onVerberg={() => void verberg([kaart.sleutel])} />;
  if (kaart.soort === "weer") return <WeerSignaal voet={voet} />;
  if (kaart.soort === "budget") {
    const b = kaart.data as ReturnType<typeof budgetSignaal> & object;
    return (
      <Kaart
        label="Budget-waarschuwing"
        titel={b.status === "over" ? "Boven je weekbudget" : "Bijna aan je weekbudget"}
        icoon={
          b.status === "over" ? (
            <TriangleAlert className="size-7 text-[var(--honing-foreground)]" aria-hidden />
          ) : (
            <PiggyBank className="size-7 text-primary" aria-hidden />
          )
        }
        voet={voet}
      >
        <p className="text-base text-muted-foreground">{b.tekst} (schatting)</p>
        <Link
          to="/assistent"
          search={{ van: "vandaag", vraag: "Maak mijn week goedkoper" }}
          className="inline-flex min-h-12 items-center rounded-full border-2 border-primary px-4 text-base font-semibold text-primary"
        >
          Maak mijn week goedkoper
        </Link>
      </Kaart>
    );
  }
  if (kaart.soort === "variatie") {
    const v = kaart.data as NonNullable<ReturnType<typeof variatieSignaal>>;
    const dag = dagNaam(v.datum, vandaag);
    return (
      <Kaart
        label="Gevarieerder eten"
        titel={`Deze week ${v.aantal} keer ${v.soort}`}
        icoon={<CalendarDays className="size-7 text-primary" aria-hidden />}
        voet={voet}
      >
        <p className="text-base text-muted-foreground">
          Zin in iets anders op {dag}? Foodlo stelt een {ANDERS[v.soort]} gerecht voor; jij beslist.
        </p>
        <Link
          to="/assistent"
          search={{ van: "vandaag", vraag: `vervang ${dag} door iets ${ANDERS[v.soort]}` }}
          className="inline-flex min-h-12 items-center rounded-full border-2 border-primary px-4 text-base font-semibold text-primary"
        >
          Toon een voorstel
        </Link>
      </Kaart>
    );
  }
  const s = kaart.data as { product: string; aantal: number };
  return (
    <Kaart
      label="Seizoen"
      titel={`In het seizoen: ${s.product}`}
      icoon={<Leaf className="size-7 text-primary" aria-hidden />}
      voet={voet}
    >
      <p className="text-base text-muted-foreground">
        {s.aantal === 1 ? "Eén recept" : `${s.aantal} recepten`} van jou{" "}
        {s.aantal === 1 ? "gebruikt" : "gebruiken"} {s.product}.
      </p>
      <Link
        to="/assistent"
        search={{ van: "vandaag", vraag: `wat kan ik maken met ${s.product}` }}
        className="inline-flex min-h-12 items-center rounded-full border-2 border-primary px-4 text-base font-semibold text-primary"
      >
        Toon ideeën
      </Link>
    </Kaart>
  );
}
