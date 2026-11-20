/**
 * Fase 4 — op de makerpagina: abonneren in TESTMODUS ("er wordt niets aangerekend"), voordelen,
 * prijs met btw als tekst, opzeggen met de testterugbetaling vooraf uitgelegd, en de
 * testbetalingen. Geen betaalprovider, geen kaartgegevens. Toont niets zonder (actief) plan.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { TestmodusBand } from "@/components/TestmodusBand";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { btwTekst, opzegBerekening, prijsTekst } from "@/lib/betalen/maker-abonnement";
import {
  abonneerOpMaker,
  makerAbonnementStaat,
  zegMakerAbonnementOp,
} from "@/lib/betalen/maker-abonnement.functions";
import { euro } from "@/lib/betalen/types";
import { MAKER_RECHTEN_SLEUTEL } from "@/lib/betalen/useMakerRechten";
import type { Maker } from "@/lib/makers";

const datum = (iso: string) =>
  new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });

export function MakerAbonneren({
  maker,
  aantalExclusief,
}: {
  maker: Maker;
  aantalExclusief: number;
}) {
  const qc = useQueryClient();
  const haal = useServerFn(makerAbonnementStaat);
  const abonneer = useServerFn(abonneerOpMaker);
  const zegOp = useServerFn(zegMakerAbonnementOp);
  const q = useQuery({
    queryKey: ["maker-abonnement", maker.id],
    queryFn: () => haal({ data: { creatorId: maker.id } }),
  });
  const [vraag, setVraag] = useState<"abonneren" | "opzeggen" | null>(null);
  const [bezig, setBezig] = useState(false);
  const s = q.data;
  if (!s?.beschikbaar) return null;
  const { plan, abonnement, recht, betalingen } = s;
  if (!plan?.actief && !recht) return null;

  async function vernieuw() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["maker-abonnement", maker.id] }),
      qc.invalidateQueries({ queryKey: [MAKER_RECHTEN_SLEUTEL] }),
      qc.invalidateQueries({ queryKey: ["recipe"] }),
      qc.invalidateQueries({ queryKey: ["verzameling-recepten"] }),
    ]);
  }

  async function doeAbonneren() {
    setBezig(true);
    try {
      await abonneer({ data: { creatorId: maker.id } });
      await vernieuw();
      toast.success(`Je bent abonnee van ${maker.naam} (testmodus, er werd niets aangerekend)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Abonneren lukte niet.");
    } finally {
      setBezig(false);
      setVraag(null);
    }
  }

  async function doeOpzeggen() {
    setBezig(true);
    try {
      const r = await zegOp({ data: { creatorId: maker.id } });
      await vernieuw();
      toast.success(
        r.terugCent
          ? `Opgezegd. Testterugbetaling: ${euro(r.terugCent)}`
          : "Opgezegd. Er valt niets terug te betalen.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opzeggen lukte niet.");
    } finally {
      setBezig(false);
      setVraag(null);
    }
  }

  const opzeg = abonnement && recht ? opzegBerekening(abonnement) : null;

  return (
    <section
      aria-labelledby="abonnement-titel"
      className="paneel space-y-4 p-4"
      data-testid="maker-abonneren"
    >
      <h2 id="abonnement-titel" className="text-sectietitel">
        Abonnement bij {maker.naam}
      </h2>
      <TestmodusBand>
        Er wordt niets aangerekend en je vult geen betaalgegevens in. Zo kan je zien hoe een
        abonnement op een maker zou werken.
      </TestmodusBand>
      {plan ? (
        <div className="space-y-2">
          <p className="font-display text-2xl font-semibold">{prijsTekst(plan.prijs_cent)}</p>
          <p className="text-[0.95rem] text-muted-foreground">
            {btwTekst(plan.prijs_cent)}. Maandelijks opzegbaar. In testmodus: € 0,00.
          </p>
          <ul className="space-y-1.5" aria-label="Wat je krijgt">
            {plan.voordelen.map((v) => (
              <li key={v} className="flex items-start gap-2 text-base">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 break-words">{v}</span>
              </li>
            ))}
            {aantalExclusief ? (
              <li className="flex items-start gap-2 text-base">
                <Lock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <span>
                  {aantalExclusief}{" "}
                  {aantalExclusief === 1 ? "exclusief recept" : "exclusieve recepten"} nu al
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {recht && abonnement ? (
        <div className="space-y-3">
          <p
            role="status"
            className="rounded-2xl bg-secondary p-3 text-base text-secondary-foreground"
          >
            Je bent abonnee (testmodus) sinds {datum(abonnement.start_op)}. Loopt tot{" "}
            {datum(abonnement.periode_einde)}.
          </p>
          <Button
            variant="outline"
            disabled={bezig}
            onClick={() => setVraag("opzeggen")}
            className="h-14 px-5 text-base"
          >
            Abonnement opzeggen
          </Button>
        </div>
      ) : (
        <Button
          disabled={bezig || !plan?.actief}
          onClick={() => setVraag("abonneren")}
          className="h-auto min-h-14 px-5 text-base"
        >
          {bezig ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Abonneren in testmodus
        </Button>
      )}

      {betalingen.length ? (
        <details className="rounded-2xl bg-muted/60 p-3">
          <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold">
            Testbetalingen ({betalingen.length})
          </summary>
          <ul className="mt-2 divide-y divide-border/60">
            {betalingen.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2 text-base">
                <span>
                  {b.soort === "terugbetaling" ? "Testterugbetaling" : "Testbetaling"} ·{" "}
                  {datum(b.created_at)}
                </span>
                <span className="font-semibold">
                  {b.soort === "terugbetaling" ? "− " : ""}
                  {euro(b.bedrag_cent)}{" "}
                  <span className="font-normal text-muted-foreground">
                    (waarvan {euro(b.btw_cent)} btw)
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.95rem] text-muted-foreground">
            Alleen een test: er is geen geld betaald of terugbetaald.
          </p>
        </details>
      ) : null}

      <AlertDialog open={vraag !== null} onOpenChange={(o) => !o && setVraag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {vraag === "opzeggen" ? "Abonnement opzeggen?" : "Abonneren in testmodus?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {vraag === "opzeggen"
                ? `Je toegang tot de exclusieve recepten van ${maker.naam} stopt meteen. ${opzeg?.uitleg ?? ""}`
                : `Er wordt niets aangerekend. In het echt zou dit ${plan ? prijsTekst(plan.prijs_cent) : ""} kosten (inclusief btw). Opzeggen kan altijd.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-14 text-base">Nee, nog niet</AlertDialogCancel>
            <AlertDialogAction
              className="h-14 text-base"
              onClick={(e) => {
                e.preventDefault();
                void (vraag === "opzeggen" ? doeOpzeggen() : doeAbonneren());
              }}
            >
              {vraag === "opzeggen" ? "Ja, opzeggen" : "Ja, abonneren (test)"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
