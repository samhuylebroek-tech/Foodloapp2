import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ModuleNietBeschikbaar } from "@/components/ModuleNietBeschikbaar";
import { TestmodusBand } from "@/components/TestmodusBand";
import { Button } from "@/components/ui/button";
import {
  btwVan,
  factuurTekst,
  proRataWijziging,
  terugbetalingMogelijk,
  volgendeFactuur,
} from "@/lib/betalen/abonnement-regels";
import {
  simuleerTestBetaling,
  vraagTestTerugbetaling,
  wijzigTestPlan,
  zegTestAbonnementOp,
} from "@/lib/betalen/betalen.functions";
import { PRIJZEN } from "@/lib/betalen/prijzen";
import { STATUS_UITLEG } from "@/lib/betalen/statusmachine";
import { euro, PLANNEN } from "@/lib/betalen/types";
import { useAbonnement } from "@/lib/betalen/useAbonnement";
import { korteDatum } from "@/lib/partners";

export const Route = createFileRoute("/abonnement")({
  head: () => ({ meta: [{ title: "Mijn abonnement – Foodlo" }] }),
  component: AbonnementPagina,
});

type Simulatie = "betaling_mislukt" | "betaling_gelukt" | "periode_afgelopen";

/** Bewaart een testfactuur als tekstbestand. */
function bewaarTekst(bestand: string, inhoud: string) {
  const blob = new Blob([inhoud], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = bestand;
  a.click();
  URL.revokeObjectURL(url);
}

function AbonnementPagina() {
  const { data, isLoading, isError, refetch } = useAbonnement();
  const qc = useQueryClient();
  const opzeggenFn = useServerFn(zegTestAbonnementOp);
  const simuleerFn = useServerFn(simuleerTestBetaling);
  const wijzigFn = useServerFn(wijzigTestPlan);
  const terugFn = useServerFn(vraagTestTerugbetaling);
  const [bevestig, setBevestig] = useState(false);
  const [terugVraag, setTerugVraag] = useState(false);
  const ververs = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["abonnement"] }),
      qc.invalidateQueries({ queryKey: ["premium-extra"] }),
    ]);

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
    mutationFn: (soort: Simulatie) => simuleerFn({ data: { soort } }),
    onSuccess: () => void ververs(),
    onError: (e: Error) => toast.error(e.message),
  });
  const wijzig = useMutation({
    mutationFn: (naar: "premium_maand" | "premium_jaar") => wijzigFn({ data: { naar } }),
    onSuccess: (r) => {
      toast.success(
        r.soort === "upgrade" ? "Overgestapt (testmodus)." : "Overstap gepland (testmodus).",
      );
      void ververs();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const terug = useMutation({
    mutationFn: () => terugFn(),
    onSuccess: (r) => {
      setTerugVraag(false);
      toast.success(`Terugbetaald: ${euro(r.bedragCent)} (testmodus). Er werd niets gestort.`);
      void ververs();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const abo = data?.abonnement ?? null;
  const status = abo?.status ?? "geen";
  const uitleg = STATUS_UITLEG[status];
  const kanOpzeggen = status === "actief" || status === "proef" || status === "betaling_mislukt";
  const consument = abo ? PLANNEN[abo.plan].voor === "consument" : false;
  const volgende = volgendeFactuur(abo);
  const ander = abo?.plan === "premium_jaar" ? "premium_maand" : "premium_jaar";
  const wijziging =
    abo && consument
      ? proRataWijziging({
          van: abo.plan,
          naar: ander,
          status: abo.status,
          periodeEinde: abo.periode_einde,
        })
      : null;
  const terugbetaling = data && status !== "geen" ? terugbetalingMogelijk(data.facturen) : null;

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
          {status === "betaling_mislukt" ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border-2 border-destructive/60 bg-destructive/10 p-4 text-base"
            >
              <AlertTriangle className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden />
              <div className="min-w-0 space-y-1">
                <p className="font-semibold">Je laatste (test)betaling lukte niet.</p>
                <p>
                  Premium blijft werken tot{" "}
                  <strong>{korteDatum(abo?.genade_tot ?? abo?.periode_einde ?? "")}</strong>{" "}
                  (genadeperiode van {PRIJZEN.genadeDagen} dagen). Je recepten, lijsten en planning
                  blijven altijd bewaard.
                </p>
              </div>
            </div>
          ) : null}
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
            {volgende ? (
              <p className="text-base" data-testid="volgende-factuur">
                Volgende testfactuur: <strong>{korteDatum(volgende.datum)}</strong>,{" "}
                {euro(volgende.bedragCent)} (niets wordt aangerekend).
              </p>
            ) : null}
            {abo?.gepland_plan && status !== "geen" ? (
              <p className="text-base">
                Gepland: vanaf {korteDatum(abo.periode_einde ?? "")} ga je naar{" "}
                {PLANNEN[abo.gepland_plan].naam}.
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

          {wijziging && (wijziging.soort === "upgrade" || wijziging.soort === "downgrade") ? (
            <section aria-labelledby="wijzig-titel" className="paneel space-y-3 p-4">
              <h2 id="wijzig-titel" className="text-sectietitel">
                {ander === "premium_jaar" ? "Overstappen naar een jaar" : "Terug naar maandelijks"}
              </h2>
              <p className="text-base" data-testid="pro-rata">
                {wijziging.tekst}
              </p>
              {abo?.gepland_plan === ander ? (
                <p className="text-base text-muted-foreground">Deze overstap is al gepland.</p>
              ) : (
                <Button
                  variant="outline"
                  className="h-14 px-6 text-base"
                  disabled={wijzig.isPending}
                  onClick={() => wijzig.mutate(ander)}
                >
                  {ander === "premium_jaar"
                    ? "Overstappen naar jaar (testmodus)"
                    : "Maandelijks vanaf volgende periode (testmodus)"}
                </Button>
              )}
            </section>
          ) : null}

          {terugbetaling ? (
            <section aria-labelledby="terug-titel" className="paneel space-y-3 p-4">
              <h2 id="terug-titel" className="text-sectietitel">
                Geld terug binnen {PRIJZEN.herroepingDagen} dagen
              </h2>
              <p className="text-base">{terugbetaling.tekst}</p>
              {terugbetaling.mag && !terugVraag ? (
                <Button
                  variant="outline"
                  className="h-14 px-6 text-base"
                  onClick={() => setTerugVraag(true)}
                >
                  Terugbetaling vragen (testmodus)
                </Button>
              ) : null}
              {terugbetaling.mag && terugVraag ? (
                <div
                  role="alertdialog"
                  aria-labelledby="terug-vraag"
                  className="space-y-3 rounded-2xl bg-muted p-4"
                >
                  <p id="terug-vraag" className="text-base font-semibold">
                    Zeker? Premium stopt meteen. Je krijgt {euro(terugbetaling.bedragCent)} terug
                    (testmodus: er wordt niets gestort).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      className="h-14 px-6 text-base"
                      disabled={terug.isPending}
                      onClick={() => terug.mutate()}
                    >
                      Ja, terugbetalen
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 px-6 text-base"
                      onClick={() => setTerugVraag(false)}
                    >
                      Nee, houden
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {abo && status !== "geen" ? (
            <section aria-labelledby="sim-titel" className="paneel space-y-3 p-4">
              <h2 id="sim-titel" className="text-sectietitel">
                Testmodus: betaling nabootsen
              </h2>
              <p className="text-base text-muted-foreground">
                Alleen om te zien hoe Foodlo reageert. Er gebeurt niets met echt geld.
              </p>
              <div className="flex flex-wrap gap-2">
                {status !== "opgezegd" ? (
                  <>
                    <Button
                      variant="outline"
                      className="min-h-14"
                      disabled={simuleer.isPending}
                      onClick={() => simuleer.mutate("betaling_mislukt")}
                    >
                      Mislukte betaling nabootsen
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-14"
                      disabled={simuleer.isPending}
                      onClick={() => simuleer.mutate("betaling_gelukt")}
                    >
                      Geslaagde betaling nabootsen
                    </Button>
                  </>
                ) : null}
                {status === "opgezegd" || status === "betaling_mislukt" ? (
                  <Button
                    variant="outline"
                    className="min-h-14"
                    disabled={simuleer.isPending}
                    onClick={() => simuleer.mutate("periode_afgelopen")}
                  >
                    {status === "opgezegd"
                      ? "Einde van de periode nabootsen"
                      : "Einde van de genadeperiode nabootsen"}
                  </Button>
                ) : null}
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
                {data.facturen.map((f) => {
                  const { btwCent, procent } = btwVan(f);
                  const credit = f.soort === "creditnota";
                  return (
                    <li key={f.id} className="paneel space-y-2 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold break-words">{f.omschrijving}</p>
                          <p className="text-[0.95rem] text-muted-foreground">
                            {f.nummer} · {korteDatum(f.datum)} ·{" "}
                            {credit ? "testcreditnota" : "testfactuur"}
                          </p>
                        </div>
                        <p className="text-base font-semibold">
                          {credit ? "− " : ""}
                          {euro(f.bedrag_cent)}{" "}
                          <span className="font-normal text-muted-foreground">
                            (
                            {credit
                              ? "terugbetaald"
                              : f.status === "betaald"
                                ? "betaald"
                                : f.status === "mislukt"
                                  ? "mislukt"
                                  : "open"}
                            )
                          </span>
                        </p>
                      </div>
                      <p className="text-[0.95rem] text-muted-foreground">
                        Excl. btw {euro(f.bedrag_cent - btwCent)} · btw {procent} % {euro(btwCent)}
                      </p>
                      <Button
                        variant="outline"
                        className="min-h-14"
                        onClick={() => bewaarTekst(`${f.nummer}.txt`, factuurTekst(f))}
                      >
                        <Download className="size-5" aria-hidden />
                        Download {f.nummer} (tekst)
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
