/**
 * Week: "Vul aan met voorstellen" (usecase 7). Staan er deze week nog minstens twee dagen leeg,
 * dan stelt Foodlo per lege dag één gerecht uit je eigen recepten voor, met 1 à 2 redenen.
 * Eén tik per dag of alles samen; daarna altijd "Ongedaan maken" (via het weekmenu).
 * Dezelfde harde regels als overal (allergie, dieet, liever niet, Niet nu). Uitschakelbaar met
 * "Slimme voorstellen". Pas zichtbaar als alle ingrediënten geladen zijn (allergiecontrole).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVoorstelBronnen } from "@/hooks/useVoorstelBronnen";
import { vatSamen } from "@/lib/intelligentie/geschiedenis";
import { herstelNietNu, nietNuLijst, zetNietNu } from "@/lib/intelligentie/niet-nu";
import { useSlimmeVoorstellen } from "@/lib/intelligentie/slim";
import { vulAan } from "@/lib/intelligentie/vul-aan";
import { leesKennismaking } from "@/lib/kennismaking";
import { meet } from "@/lib/meten";
import type { Recipe } from "@/lib/types";
import { useVoorkeuren } from "@/lib/voorkeuren";
import { minutenVan } from "@/lib/weekmenu-voorstel";
import { labelVoor } from "./gedeeld";

type Rij = { datum: string; moment: string; recept: Recipe; idee: null };

export function VulAan({
  legeDagen,
  moment,
  alGepland,
  vandaag,
  onZet,
}: {
  /** Lege dagen vanaf vandaag in de getoonde week. */
  legeDagen: string[];
  moment: string;
  alGepland: ReadonlySet<string>;
  vandaag: string;
  onZet: (rijen: Rij[]) => Promise<void>;
}) {
  const { user } = useAuth();
  const { weekmenu } = useVoorkeuren();
  const [slim] = useSlimmeVoorstellen();
  const [nietNu, setNietNu] = useState<string[]>([]);
  const [bezig, setBezig] = useState<string | null>(null);
  useEffect(() => setNietNu(nietNuLijst(user?.id)), [user?.id]);
  const actief = slim && legeDagen.length >= 2;

  const { data: recepten = [] } = useQuery({
    queryKey: ["vul-aan-recepten", user?.id],
    enabled: !!user && actief,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .eq("is_concept", false)
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Recipe[];
    },
  });
  const { data: bronnen, isSuccess } = useVoorstelBronnen(
    recepten.map((r) => r.id),
    actief,
  );

  const voorstellen = useMemo(() => {
    if (!bronnen || !actief) return [];
    const kennis = leesKennismaking(user?.id);
    const minuten = Object.fromEntries(recepten.map((r) => [r.id, minutenVan(r)]));
    return vulAan({
      dagen: legeDagen,
      kandidaten: recepten.map((r) => ({
        id: r.id,
        title: r.title,
        minuten: minutenVan(r),
        category: r.category,
        tags: r.tags ?? [],
        ingredienten: bronnen.ingredienten[r.id] ?? [],
      })),
      voorraad: bronnen.voorraad,
      oudInHuis: bronnen.oudInHuis,
      geschiedenis: vatSamen(bronnen.plan, minuten, vandaag),
      sterren: bronnen.sterren,
      favorieten: bronnen.favorieten,
      voorkeurVoor: (wd) => {
        const dag = weekmenu.perDag?.[String(wd)];
        return {
          maxMinuten: dag?.maxMinuten || weekmenu.maxMinuten || 0,
          soort: dag?.soort ?? null,
          vermijd: weekmenu.vermijd ?? "",
          dieet: kennis.dieet,
        };
      },
      allergieen: kennis.allergieen,
      nietNu,
      alGepland,
      max: 3,
    });
  }, [bronnen, actief, recepten, legeDagen, weekmenu, nietNu, alGepland, vandaag, user?.id]);

  if (!actief || !isSuccess || !voorstellen.length) return null;
  const receptVan = (id: string) => recepten.find((r) => r.id === id)!;

  async function zet(rijen: { datum: string; id: string }[], sleutel: string) {
    setBezig(sleutel);
    try {
      await onZet(
        rijen.map((r) => ({ datum: r.datum, moment, recept: receptVan(r.id), idee: null })),
      );
      void meet("week.vul_aan", undefined, { aantal: rijen.length });
    } finally {
      setBezig(null);
    }
  }

  function nietNuTik(id: string) {
    if (!user) return;
    zetNietNu(user.id, id);
    setNietNu(nietNuLijst(user.id));
    toast("Je ziet dit voorstel een week niet.", {
      duration: 8000,
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          herstelNietNu(user.id, id);
          setNietNu(nietNuLijst(user.id));
        },
      },
    });
  }

  return (
    <section aria-labelledby="vul-aan-kop" className="paneel min-w-0 p-4 lg:col-span-2">
      <h2 id="vul-aan-kop" className="text-sectietitel">
        Vul aan met voorstellen
      </h2>
      <p className="mt-1 text-base text-muted-foreground">
        Nog {legeDagen.length} dagen zonder maaltijd. Foodlo stelt voor uit je eigen recepten.
      </p>
      <ul className="mt-4 space-y-3">
        {voorstellen.map(({ datum, aanbeveling: a }) => (
          <li key={datum} className="min-w-0 rounded-2xl bg-muted/50 p-3">
            <p className="text-[0.95rem] font-semibold capitalize text-muted-foreground">
              {labelVoor(datum)}
            </p>
            <p className="text-lg font-semibold leading-snug break-words">{a.title}</p>
            <p
              data-redenen
              className="mt-0.5 text-[0.95rem] leading-snug break-words text-muted-foreground"
            >
              {a.redenen.map((r) => r.tekst).join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                onClick={() => void zet([{ datum, id: a.id }], datum)}
                disabled={!!bezig}
                aria-label={`Plan ${a.title} op ${labelVoor(datum)}`}
                className="h-12 min-w-[48px] px-4 text-base"
              >
                {bezig === datum ? <Loader2 className="size-5 animate-spin" /> : null}
                Plan
              </Button>
              <Button
                variant="ghost"
                onClick={() => nietNuTik(a.id)}
                disabled={!!bezig}
                aria-label={`Niet nu: ${a.title}`}
                className="h-12 min-w-[48px] px-4 text-base"
              >
                Niet nu
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {voorstellen.length > 1 ? (
          <Button
            variant="outline"
            onClick={() =>
              void zet(
                voorstellen.map((v) => ({ datum: v.datum, id: v.aanbeveling.id })),
                "alles",
              )
            }
            disabled={!!bezig}
            className="h-12 max-w-full px-4 text-base"
          >
            {bezig === "alles" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CalendarPlus className="size-5" aria-hidden />
            )}
            Zet ze alle {voorstellen.length} in je weekmenu
          </Button>
        ) : null}
        <Link
          to="/hulp/$slug"
          params={{ slug: "voorstellen" }}
          className="inline-flex min-h-12 items-center text-base underline underline-offset-4"
        >
          Waarom zie ik dit?
        </Link>
      </div>
    </section>
  );
}
