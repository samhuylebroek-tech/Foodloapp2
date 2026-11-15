import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlleenLezen, PartnerKop, usePartner } from "@/components/partner/PartnerShell";
import { TestmodusBand } from "@/components/TestmodusBand";
import { Button } from "@/components/ui/button";
import { startTestCheckout, zegTestAbonnementOp } from "@/lib/betalen/betalen.functions";
import { STATUS_UITLEG } from "@/lib/betalen/statusmachine";
import { euro, PLANNEN, type PlanId } from "@/lib/betalen/types";
import { useAbonnement } from "@/lib/betalen/useAbonnement";
import { korteDatum } from "@/lib/partners";

export const Route = createFileRoute("/partner/abonnement")({ component: PartnerAbonnement });

const PARTNERPLANNEN: { id: PlanId; wat: string[] }[] = [
  { id: "partner_basis", wat: ["Bedrijfsprofiel", "Producten koppelen aan ingrediënten"] },
  {
    id: "partner_plus",
    wat: ["Alles van Basis", "Campagnes met gesponsorde plek", "Rapportage exporteren"],
  },
];

function PartnerAbonnement() {
  const { partner, mag } = usePartner();
  const { data, isLoading } = useAbonnement(partner.id);
  const qc = useQueryClient();
  const startFn = useServerFn(startTestCheckout);
  const opzegFn = useServerFn(zegTestAbonnementOp);
  const ververs = () => qc.invalidateQueries({ queryKey: ["abonnement"] });
  const kies = useMutation({
    mutationFn: (plan: PlanId) => startFn({ data: { plan, partnerId: partner.id } }),
    onSuccess: () => {
      toast.success("Testplan gekozen. Er werd niets aangerekend.");
      void ververs();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const opzeggen = useMutation({
    mutationFn: () => opzegFn({ data: { partnerId: partner.id } }),
    onSuccess: () => {
      toast.success("Testplan opgezegd.");
      void ververs();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const magBeheren = mag("abonnement.beheren");
  const abo = data?.abonnement ?? null;
  const status = abo?.status ?? "geen";
  const huidig = abo && status !== "geen" ? abo.plan : null;

  return (
    <>
      <PartnerKop titel="Abonnement" uitleg="Zakelijke plannen voor je organisatie." />
      <TestmodusBand>
        Testplannen: prijzen zijn een voorstel, er wordt niets aangerekend. Facturen hieronder zijn
        testfacturen.
      </TestmodusBand>
      {!magBeheren ? <AlleenLezen wat="het abonnement" /> : null}
      {isLoading ? (
        <p role="status" className="text-muted-foreground">
          Laden…
        </p>
      ) : (
        <>
          <p className="paneel p-4 text-base">
            Huidig plan: <strong>{huidig ? PLANNEN[huidig].naam : "geen"}</strong> ·{" "}
            {STATUS_UITLEG[status].titel}
            {abo?.periode_einde && huidig ? ` · tot ${korteDatum(abo.periode_einde)}` : ""}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {PARTNERPLANNEN.map((p) => {
              const plan = PLANNEN[p.id];
              const dit = huidig === p.id && status !== "opgezegd";
              return (
                <article key={p.id} aria-label={plan.naam} className="paneel space-y-3 p-4">
                  <h2 className="text-sectietitel">{plan.naam}</h2>
                  <p className="text-xl font-semibold">
                    {plan.prijsCent ? `${euro(plan.prijsCent)} per maand` : "Gratis"}
                    <span className="block text-[0.95rem] font-normal text-muted-foreground">
                      voorstel, excl. btw nog te bepalen
                    </span>
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-base">
                    {p.wat.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                  {magBeheren ? (
                    dit ? (
                      <Button
                        variant="outline"
                        className="min-h-12"
                        disabled={opzeggen.isPending}
                        onClick={() => opzeggen.mutate()}
                      >
                        Testplan opzeggen
                      </Button>
                    ) : (
                      <Button
                        className="min-h-12"
                        disabled={kies.isPending}
                        onClick={() => kies.mutate(p.id)}
                      >
                        Kies {plan.naam} (testmodus)
                      </Button>
                    )
                  ) : null}
                </article>
              );
            })}
          </div>
          <section aria-labelledby="pf-titel" className="space-y-2">
            <h2 id="pf-titel" className="text-sectietitel">
              Testfacturen
            </h2>
            {!data?.facturen.length ? (
              <p className="paneel p-4 text-base text-muted-foreground">Nog geen facturen.</p>
            ) : (
              <ul className="space-y-2" aria-label="Testfacturen">
                {data.facturen.map((f) => (
                  <li key={f.id} className="paneel flex flex-wrap justify-between gap-2 p-4">
                    <span>
                      {f.omschrijving}{" "}
                      <span className="text-muted-foreground">
                        · {f.nummer} · {korteDatum(f.datum)}
                      </span>
                    </span>
                    <strong>{euro(f.bedrag_cent)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
