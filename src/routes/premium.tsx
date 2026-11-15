import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Lock, Minus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { TestmodusBand } from "@/components/TestmodusBand";
import { Button } from "@/components/ui/button";
import { startTestCheckout } from "@/lib/betalen/betalen.functions";
import { STATUS_UITLEG } from "@/lib/betalen/statusmachine";
import { euro, PLANNEN } from "@/lib/betalen/types";
import { useAbonnement } from "@/lib/betalen/useAbonnement";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";

export const Route = createFileRoute("/premium")({
  head: () => ({ meta: [{ title: "Premium – Foodlo" }] }),
  component: Premium,
});

/** Wat gratis is, blijft gratis. Premium voegt alleen extra's toe. */
const RIJEN: { functie: string; gratis: boolean; premium: boolean }[] = [
  { functie: "Recepten bewaren, plannen en koken", gratis: true, premium: true },
  { functie: "Boodschappenlijst en voorraad", gratis: true, premium: true },
  { functie: "Allergie- en dieetcontrole", gratis: true, premium: true },
  { functie: "Gezin en delen", gratis: true, premium: true },
  { functie: "Extra weekmenu-sjablonen", gratis: false, premium: true },
  { functie: "Seizoenskalender met wat nu lekker is", gratis: false, premium: true },
];

const SEIZOEN = [
  "Pompoen en butternut",
  "Prei en witloof",
  "Spruitjes en boerenkool",
  "Appels en peren",
];

function Premium() {
  const plan = PLANNEN.premium_maand;
  const { data, isLoading, mag } = useAbonnement();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const start = useServerFn(startTestCheckout);
  const checkout = useMutation({
    mutationFn: () => start({ data: { plan: "premium_maand" } }),
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
              maandelijks opzegbaar in twee tikken.
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
              <Button
                className="h-14 w-full px-6 text-base sm:w-auto"
                disabled={checkout.isPending}
                onClick={() => checkout.mutate()}
              >
                Premium testen (testmodus)
              </Button>
            )}
          </section>
          <section aria-labelledby="extra" className="paneel space-y-3 p-4">
            <h2 id="extra" className="text-sectietitel">
              Premium-extra: seizoenskalender
            </h2>
            {mag("premium.seizoenskalender") ? (
              <>
                <p className="text-base text-muted-foreground">Nu op zijn best in België:</p>
                <ul aria-label="Seizoenskalender" className="grid gap-2 sm:grid-cols-2">
                  {SEIZOEN.map((s) => (
                    <li key={s} className="rounded-xl bg-secondary px-3 py-2 text-base">
                      {s}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="flex items-start gap-2 text-base text-muted-foreground">
                <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
                Beschikbaar met Premium. Alles wat je nu gratis gebruikt, blijft gratis.
              </p>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
