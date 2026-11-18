import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Smartphone, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageSkeleton } from "@/components/PageSkeleton";
import { BudgetInstelling } from "@/components/budget/BudgetInstelling";
import { ApparatuurKeuze, ErvaringKeuze, VoorraadKeuze } from "@/components/planner/KeukenProfiel";
import { Button } from "@/components/ui/button";
import { usePlanProfiel } from "@/hooks/usePlanProfiel";
import type { Apparaat } from "@/lib/planner/apparatuur";
import type { Kookervaring, PlanProfiel, Voorraadniveau } from "@/lib/planner/profiel";

export const Route = createFileRoute("/mijn-keuken")({
  head: () => ({
    meta: [
      { title: "Mijn keuken – Foodlo" },
      {
        name: "description",
        content: "Je keukenapparatuur, kookervaring, voorraad en weekbudget voor je weekmenu.",
      },
    ],
  }),
  component: MijnKeukenPagina,
});

type Concept = {
  apparatuur: Apparaat[];
  kookervaring: Kookervaring | null;
  voorraadniveau: Voorraadniveau | null;
  basisvoorraad: string[];
};

function MijnKeukenPagina() {
  const plan = usePlanProfiel();
  const [c, setC] = useState<Concept | null>(null);
  const [aangeraakt, setAangeraakt] = useState(false);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (plan.laden || c) return;
    setC({
      apparatuur: plan.apparatuur,
      kookervaring: plan.kookervaring,
      voorraadniveau: plan.voorraadniveau,
      basisvoorraad: plan.profiel.basisvoorraad,
    });
  }, [plan.laden, c, plan.apparatuur, plan.kookervaring, plan.voorraadniveau, plan.profiel]);

  if (!c) return <PageSkeleton />;
  const zet = (deel: Partial<Concept>) => {
    setAangeraakt(true);
    setC((o) => ({ ...o!, ...deel }));
  };

  async function bewaar() {
    if (!c) return;
    const vorig: PlanProfiel = { ...plan.profiel };
    setBezig(true);
    try {
      await plan.bewaar({
        apparatuur: c.apparatuur,
        kookervaring: c.kookervaring,
        voorraadniveau: c.voorraadniveau,
        basisvoorraad: c.basisvoorraad,
      });
      setAangeraakt(false);
      toast.success("Je keuken is bewaard. Je weekvoorstellen houden er rekening mee.", {
        action: {
          label: "Ongedaan maken",
          onClick: () => {
            void plan.bewaar(vorig).then(() =>
              setC({
                apparatuur: vorig.apparatuur ?? ["oven", "kookplaat"],
                kookervaring: vorig.kookervaring,
                voorraadniveau: vorig.voorraadniveau,
                basisvoorraad: vorig.basisvoorraad,
              }),
            );
          },
        },
      });
    } catch {
      toast.error("Bewaren lukte niet. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <AppShell
      title="Mijn keuken"
      ondertitel="Zo stelt Foodlo een week samen die je echt kan koken."
    >
      <div className="mx-auto max-w-2xl space-y-9 pb-28">
        <Link
          to="/instellingen"
          className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary"
        >
          <ArrowLeft className="size-5" aria-hidden />
          Terug naar Instellingen
        </Link>
        <p className="flex items-start gap-2 text-[0.95rem] text-muted-foreground">
          {plan.opslag === "account" ? (
            <UserRound className="mt-0.5 size-5 shrink-0" aria-hidden />
          ) : (
            <Smartphone className="mt-0.5 size-5 shrink-0" aria-hidden />
          )}
          <span>
            {plan.opslag === "account"
              ? "Bewaard op je account, ook op je andere toestellen. Alleen jij ziet dit."
              : "Bewaard op dit toestel. Alleen jij ziet dit."}
          </span>
        </p>
        <ApparatuurKeuze
          waarde={c.apparatuur}
          aangenomen={plan.apparatuurAangenomen && !aangeraakt}
          zet={(a) => zet({ apparatuur: a })}
        />
        <ErvaringKeuze waarde={c.kookervaring} zet={(w) => zet({ kookervaring: w })} />
        <VoorraadKeuze
          niveau={c.voorraadniveau}
          basis={c.basisvoorraad}
          zetNiveau={(n) => zet({ voorraadniveau: n })}
          zetBasis={(b) => zet({ basisvoorraad: b })}
        />
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 -mx-4 bg-background/95 px-4 py-3 backdrop-blur md:bottom-0">
          <Button onClick={bewaar} disabled={bezig} className="h-14 w-full text-lg">
            {bezig ? "Bezig met bewaren…" : "Bewaar mijn keuken"}
          </Button>
        </div>
        <BudgetInstelling />
      </div>
    </AppShell>
  );
}
