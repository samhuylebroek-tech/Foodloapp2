import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { TestmodusBand } from "@/components/TestmodusBand";
import { Button } from "@/components/ui/button";
import { PremiumExtraBlok } from "@/components/premium/PremiumExtra";
import { startTestCheckout } from "@/lib/betalen/betalen.functions";
import { btwRegel, jaarBesparingCent, prijsPer } from "@/lib/betalen/prijzen";
import { KERN_GRATIS, NIVEAUS, RECHTEN } from "@/lib/betalen/rechten";
import { STATUS_UITLEG } from "@/lib/betalen/statusmachine";
import { euro, PLANNEN } from "@/lib/betalen/types";
import { useAbonnement } from "@/lib/betalen/useAbonnement";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";

export const Route = createFileRoute("/premium")({
  head: () => ({ meta: [{ title: "Premium – Foodlo" }] }),
  component: Premium,
});

/**
 * Wat gratis is, blijft gratis. Premium voegt alleen extra's toe. Beide kolommen komen uit de
 * centrale rechtenlijst (`rechten.ts`), zodat deze tabel nooit iets anders belooft dan de server.
 */
const RIJEN: { functie: string; gratis: boolean; premium: boolean }[] = [
  ...KERN_GRATIS.map((functie) => ({ functie, gratis: true, premium: true })),
  ...NIVEAUS.premium.rechten.map((r) => ({
    functie: RECHTEN[r].titel,
    gratis: false,
    premium: true,
  })),
];

function Premium() {
  const plan = PLANNEN.premium_maand;
  const jaar = PLANNEN.premium_jaar;
  const { data, isLoading } = useAbonnement();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const start = useServerFn(startTestCheckout);
  const checkout = useMutation({
    mutationFn: (gekozen: "premium_maand" | "premium_jaar") => start({ data: { plan: gekozen } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["abonnement"] });
      toast.success("Testabonnement gestart. Er werd niets aangerekend.");
      void navigate({ to: "/abonnement" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const status = data?.abonnement?.status ?? "geen";
  const heeftPremium = status !== "geen";

  return (
    <AppShell title="Foodlo Premium" ondertitel="Extra's bovenop alles wat gratis blijft">
      {data && !data.beschikbaar ? (
        <ModuleNietBeschikbaar naam="Premium" terugNaar="/meer" terugLabel="Terug naar Meer" />
      ) : (
        <div className="space-y-6">
          <TestmodusBand>
            De prijs is een voorstel. Je kunt Premium uitproberen met een testabonnement: er wordt
            niets aangerekend.
          </TestmodusBand>
          <section aria-labelledby="vergelijk" className="paneel overflow-x-auto p-4">
            <h2 id="vergelijk" className="text-sectietitel mb-3">
              Gratis of Premium
            </h2>
            <table className="w-full min-w-[18rem] text-left text-base">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-3">
                    Functie
                  </th>
                  <th scope="col" className="px-2 py-2 text-center">
                    Gratis
                  </th>
                  <th scope="col" className="px-2 py-2 text-center">
                    Premium
                  </th>
                </tr>
              </thead>
              <tbody>
                {RIJEN.map((r) => (
                  <tr key={r.functie} className="border-b border-border/60">
                    <th scope="row" className="py-2.5 pr-3 font-normal">
                      {r.functie}
                    </th>
                    {[r.gratis, r.premium].map((ja, i) => (
                      <td key={i} className="px-2 py-2.5 text-center">
                        {ja ? (
                          <Check className="mx-auto size-6 text-primary" aria-label="Ja" />
                        ) : (
                          <Minus
                            className="mx-auto size-6 text-muted-foreground"
                            aria-label="Nee"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section aria-labelledby="prijs" className="paneel space-y-3 p-4">
            <h2 id="prijs" className="text-sectietitel">
              {euro(plan.prijsCent)} per maand
            </h2>
            <p className="text-base text-muted-foreground">
              Voorstel, nog niet te koop. Eerst {plan.proefDagen} dagen gratis proberen, daarna
              maandelijks opzegbaar in twee tikken. Prijs inclusief btw ({btwRegel(plan.prijsCent)}
              ).
            </p>
            <p className="text-base">
              Of per jaar: <strong>{prijsPer(jaar.prijsCent, "jaar")}</strong> (
              {euro(jaarBesparingCent())} minder dan twaalf maanden; {btwRegel(jaar.prijsCent)}).
            </p>
            {isLoading ? null : heeftPremium ? (
              <div className="space-y-2">
                <p className="text-base">
                  Jouw testabonnement: <strong>{STATUS_UITLEG[status].titel}</strong>
                </p>
                <Button asChild variant="outline" className="h-14 px-6 text-base">
                  <Link to="/abonnement">Mijn abonnement bekijken</Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  className="h-14 w-full px-6 text-base sm:w-auto"
                  disabled={checkout.isPending}
                  onClick={() => checkout.mutate("premium_maand")}
                >
                  Premium testen (testmodus)
                </Button>
                <Button
                  variant="outline"
                  className="h-14 w-full px-6 text-base sm:w-auto"
                  disabled={checkout.isPending}
                  onClick={() => checkout.mutate("premium_jaar")}
                >
                  Per jaar testen (testmodus)
                </Button>
              </div>
            )}
          </section>
          <PremiumExtraBlok
            soort="seizoenskalender"
            titel="Premium-extra: seizoenskalender"
            metKnop={false}
          />
          <PremiumExtraBlok
            soort="weekmenu_sjablonen"
            titel="Premium-extra: weekmenu-sjablonen"
            metKnop={false}
          />
        </div>
      )}
    </AppShell>
  );
}
