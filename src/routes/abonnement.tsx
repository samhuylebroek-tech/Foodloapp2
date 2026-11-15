import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";
import { TestmodusBand } from "@/components/TestmodusBand";
import { Button } from "@/components/ui/button";
import { simuleerTestBetaling, zegTestAbonnementOp } from "@/lib/betalen/betalen.functions";
import { STATUS_UITLEG } from "@/lib/betalen/statusmachine";
import { euro, PLANNEN } from "@/lib/betalen/types";
import { useAbonnement } from "@/lib/betalen/useAbonnement";
import { korteDatum } from "@/lib/partners";

export const Route = createFileRoute("/abonnement")({
  head: () => ({ meta: [{ title: "Mijn abonnement – Foodlo" }] }),
  component: AbonnementPagina,
});

function AbonnementPagina() {
  const { data, isLoading, isError, refetch } = useAbonnement();
  const qc = useQueryClient();
  const opzeggenFn = useServerFn(zegTestAbonnementOp);
  const simuleerFn = useServerFn(simuleerTestBetaling);
  const [bevestig, setBevestig] = useState(false);
  const ververs = () => qc.invalidateQueries({ queryKey: ["abonnement"] });

  const opzeggen = useMutation({
    mutationFn: () => opzeggenFn({ data: {} }),
    onSuccess: () => {
      setBevestig(false);
      toast.success("Opgezegd. Premium blijft werken tot het einde van je periode.");
      void ververs();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const simuleer = useMutation({
    mutationFn: (soort: "betaling_mislukt" | "betaling_gelukt") => simuleerFn({ data: { soort } }),
    onSuccess: () => void ververs(),
    onError: (e: Error) => toast.error(e.message),
  });

  const abo = data?.abonnement ?? null;
  const status = abo?.status ?? "geen";
  const uitleg = STATUS_UITLEG[status];
  const kanOpzeggen = status === "actief" || status === "proef" || status === "betaling_mislukt";

  return (
    <AppShell title="Mijn abonnement" ondertitel="Plan, status en testfacturen">
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-3xl bg-muted" aria-label="Laden" />
      ) : isError || !data ? (
        <div className="paneel p-5 text-center">
          <p className="text-base">Je abonnement kon niet geladen worden.</p>
          <Button
            variant="outline"
            className="mt-3 h-14 px-6 text-base"
            onClick={() => void refetch()}
          >
            Opnieuw proberen
          </Button>
        </div>
      ) : !data.beschikbaar ? (
        <ModuleNietBeschikbaar naam="Abonnementen" terugNaar="/meer" terugLabel="Terug naar Meer" />
      ) : (
        <div className="space-y-6">
          <TestmodusBand />
          <section aria-labelledby="plan-titel" className="paneel space-y-3 p-4">
            <p className="text-base text-muted-foreground">Huidig plan</p>
            <h2 id="plan-titel" className="text-sectietitel">
              {abo && status !== "geen" ? PLANNEN[abo.plan].naam : "Gratis"}
            </h2>
            <p role="status" className="text-base">
              <span className="mr-2 rounded-full bg-secondary px-3 py-1 font-semibold">
                {uitleg.titel}
              </span>
              {uitleg.uitleg}
            </p>
            {abo?.periode_einde && status !== "geen" ? (
              <p className="text-base text-muted-foreground">
                {status === "opgezegd"
                  ? "Premium werkt nog tot"
                  : status === "proef"
                    ? "Proef loopt tot"
                    : "Volgende periode op"}{" "}
                {korteDatum(abo.periode_einde)}.
              </p>
            ) : null}
            {status === "geen" || status === "opgezegd" ? (
              <Button asChild className="h-14 px-6 text-base">
                <Link to="/premium">
                  {status === "opgezegd" ? "Premium opnieuw testen" : "Bekijk Premium"}
                </Link>
              </Button>
            ) : null}
            {kanOpzeggen && !bevestig ? (
              <Button
                variant="outline"
                className="h-14 px-6 text-base"
                onClick={() => setBevestig(true)}
              >
                Abonnement opzeggen
              </Button>
            ) : null}
            {kanOpzeggen && bevestig ? (
              <div
                role="alertdialog"
                aria-labelledby="opzeg-vraag"
                className="space-y-3 rounded-2xl bg-muted p-4"
              >
                <p id="opzeg-vraag" className="text-base font-semibold">
                  Zeker opzeggen? Premium blijft werken tot het einde van je periode; je gratis
                  functies blijven.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    className="h-14 px-6 text-base"
                    disabled={opzeggen.isPending}
                    onClick={() => opzeggen.mutate()}
                  >
                    Ja, opzeggen
                  </Button>
                  <Button
                    variant="outline"
                    className="h-14 px-6 text-base"
                    onClick={() => setBevestig(false)}
                  >
                    Nee, houden
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          {abo && status !== "geen" && status !== "opgezegd" ? (
            <section aria-labelledby="sim-titel" className="paneel space-y-3 p-4">
              <h2 id="sim-titel" className="text-sectietitel">
                Testmodus: betaling nabootsen
              </h2>
              <p className="text-base text-muted-foreground">
                Alleen om te zien hoe Foodlo reageert. Er gebeurt niets met echt geld.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="min-h-12"
                  disabled={simuleer.isPending}
                  onClick={() => simuleer.mutate("betaling_mislukt")}
                >
                  Mislukte betaling nabootsen
                </Button>
                <Button
                  variant="outline"
                  className="min-h-12"
                  disabled={simuleer.isPending}
                  onClick={() => simuleer.mutate("betaling_gelukt")}
                >
                  Geslaagde betaling nabootsen
                </Button>
              </div>
            </section>
          ) : null}

          <section aria-labelledby="facturen-titel" className="space-y-3">
            <h2 id="facturen-titel" className="text-sectietitel">
              Testfacturen
            </h2>
            {!data.facturen.length ? (
              <p className="paneel p-4 text-base text-muted-foreground">Nog geen facturen.</p>
            ) : (
              <ul aria-label="Testfacturen" className="space-y-2">
                {data.facturen.map((f) => (
                  <li
                    key={f.id}
                    className="paneel flex flex-wrap items-center justify-between gap-2 p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{f.omschrijving}</p>
                      <p className="text-[0.95rem] text-muted-foreground">
                        {f.nummer} · {korteDatum(f.datum)} · testfactuur
                      </p>
                    </div>
                    <p className="text-base font-semibold">
                      {euro(f.bedrag_cent)}{" "}
                      <span className="font-normal text-muted-foreground">
                        (
                        {f.status === "betaald"
                          ? "betaald"
                          : f.status === "mislukt"
                            ? "mislukt"
                            : "open"}
                        )
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
