/**
 * P5 — Keuze bij een gelijktijdige wijziging: "Houd die van Jan" / "Zet de mijne" /
 * "Bekijk allebei". Niets gaat verloren: na "Zet de mijne" zet "Ongedaan maken" de versie van
 * de ander terug. Gebruikt voor het weekmenu en de boodschappenlijst.
 */
import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { wieTekst } from "@/lib/samenwerking/conflict";

export type ConflictVoorstel = {
  /** "Jan veranderde woensdag net in Lasagne". */
  kop: string;
  /** Naam van wie het veranderde (of null: onbekend). */
  wie: string | null;
  /** Wat er nu staat (van de ander); null = weggehaald. */
  hun: string | null;
  /** Wat jij wilde. */
  mijn: string;
  /** Extra regel onder de vergelijking (bv. "Je lijst past zich aan."). */
  uitleg?: string | undefined;
  houdHun: () => void | Promise<void>;
  zetMijn: () => void | Promise<void>;
  /** Allebei houden (bv. twee gerechten op die dag, of samengevoegd op de lijst). */
  allebei?: { label: string; doe: () => void | Promise<void> } | undefined;
};

export function ConflictKeuze({
  voorstel,
  onSluit,
}: {
  voorstel: ConflictVoorstel | null;
  onSluit: () => void;
}) {
  const [vergelijk, setVergelijk] = useState(false);
  const [bezig, setBezig] = useState<string | null>(null);
  const wie = wieTekst(voorstel?.wie);
  const iemand = wie === "Iemand anders";

  async function kies(naam: string, f: () => void | Promise<void>) {
    if (bezig) return;
    setBezig(naam);
    try {
      await f();
    } finally {
      setBezig(null);
      setVergelijk(false);
      onSluit();
    }
  }

  return (
    <Dialog
      open={!!voorstel}
      onOpenChange={(open) => {
        // Sluiten zonder keuze = de versie van de ander houden (er verandert niets).
        if (!open && !bezig) {
          setVergelijk(false);
          onSluit();
        }
      }}
    >
      {voorstel ? (
        <DialogContent className="rounded-2xl sm:max-w-md" data-testid="conflict-keuze">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 text-left leading-snug">
              <Users className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 break-words">{voorstel.kop}</span>
            </DialogTitle>
            <DialogDescription className="text-left">
              Er is nog niets overschreven. Kies wat er moet blijven staan.
            </DialogDescription>
          </DialogHeader>

          {vergelijk ? (
            <dl className="grid gap-2" aria-label="Beide versies">
              <div className="rounded-xl border border-border bg-secondary/60 p-3">
                <dt className="text-base font-semibold text-muted-foreground">
                  {iemand ? "Wat er nu staat" : `Van ${wie}`}
                </dt>
                <dd className="mt-0.5 text-lg font-semibold leading-snug break-words">
                  {voorstel.hun ?? "Weggehaald"}
                </dd>
              </div>
              <div className="rounded-xl border-2 border-primary/50 p-3">
                <dt className="text-base font-semibold text-muted-foreground">Van jou</dt>
                <dd className="mt-0.5 text-lg font-semibold leading-snug break-words">
                  {voorstel.mijn}
                </dd>
              </div>
              {voorstel.uitleg ? (
                <p className="text-base text-muted-foreground">{voorstel.uitleg}</p>
              ) : null}
            </dl>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              disabled={!!bezig}
              onClick={() => void kies("hun", voorstel.houdHun)}
            >
              {bezig === "hun" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {iemand ? "Houd wat er nu staat" : `Houd die van ${wie}`}
            </Button>
            <Button
              className="w-full"
              disabled={!!bezig}
              onClick={() => void kies("mijn", voorstel.zetMijn)}
            >
              {bezig === "mijn" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Zet de mijne
            </Button>
            {vergelijk && voorstel.allebei ? (
              <Button
                variant="outline"
                className="w-full"
                disabled={!!bezig}
                onClick={() => void kies("allebei", voorstel.allebei!.doe)}
              >
                {bezig === "allebei" ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {voorstel.allebei.label}
              </Button>
            ) : null}
            {!vergelijk ? (
              <Button
                variant="ghost"
                className="w-full"
                disabled={!!bezig}
                aria-expanded={false}
                onClick={() => setVergelijk(true)}
              >
                Bekijk allebei
              </Button>
            ) : null}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
