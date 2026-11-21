/**
 * Fase 8 — Eén toestemming: wat, waarom, sinds wanneer, en intrekken met duidelijke gevolgen.
 * Intrekken vraagt altijd een bevestiging in de kaart zelf (geen pop-up), met de gevolgen
 * erboven. Aanzetten kan meteen (dat verliest niets).
 */
import { useId, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ToestemmingStand = "aan" | "uit" | "geen";

export function ToestemmingKaart({
  titel,
  stand,
  standTekst,
  wat,
  waarom,
  sinds,
  gevolgen,
  intrekLabel,
  bevestigLabel,
  onIntrekken,
  onAanzetten,
  aanzetLabel,
  extra,
  testId,
}: {
  titel: string;
  stand: ToestemmingStand;
  /** Bv. "Aan", "Uit", "Niet bewaard op je account". */
  standTekst: string;
  wat: ReactNode;
  waarom: ReactNode;
  sinds?: string | null | undefined;
  /** Wat er gebeurt met je gegevens als je intrekt. */
  gevolgen?: ReactNode;
  intrekLabel?: string;
  bevestigLabel?: string;
  onIntrekken?: (() => Promise<void>) | undefined;
  onAanzetten?: (() => Promise<void>) | undefined;
  aanzetLabel?: string;
  extra?: ReactNode;
  testId?: string;
}) {
  const id = useId();
  const [vraag, setVraag] = useState(false);
  const [bezig, setBezig] = useState(false);

  async function doe(f: () => Promise<void>) {
    setBezig(true);
    try {
      await f();
      setVraag(false);
    } finally {
      setBezig(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-titel`} className="paneel space-y-3 p-4" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h2 id={`${id}-titel`} className="min-w-0 flex-1 text-lg font-semibold leading-snug">
          {titel}
        </h2>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[0.95rem] font-semibold",
            stand === "aan" && "bg-primary/10 text-primary",
            stand === "uit" && "bg-muted text-foreground",
            stand === "geen" && "bg-muted text-muted-foreground",
          )}
          data-testid={testId ? `${testId}-stand` : undefined}
        >
          {standTekst}
        </span>
      </div>
      <dl className="space-y-2 text-base">
        <div>
          <dt className="font-semibold">Wat</dt>
          <dd className="text-muted-foreground">{wat}</dd>
        </div>
        <div>
          <dt className="font-semibold">Waarom</dt>
          <dd className="text-muted-foreground">{waarom}</dd>
        </div>
        {sinds ? (
          <div>
            <dt className="font-semibold">Sinds</dt>
            <dd className="text-muted-foreground">{sinds}</dd>
          </div>
        ) : null}
      </dl>
      {extra}

      {vraag && gevolgen ? (
        <div
          role="group"
          aria-labelledby={`${id}-gevolg`}
          className="space-y-3 rounded-2xl bg-[oklch(0.97_0.02_25)] p-3 dark:bg-muted"
        >
          <p id={`${id}-gevolg`} className="text-base font-semibold">
            Wat gebeurt er met je gegevens?
          </p>
          <div className="text-base">{gevolgen}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="destructive"
              className="min-h-14 text-base"
              disabled={bezig}
              onClick={() => onIntrekken && void doe(onIntrekken)}
            >
              {bezig ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {bevestigLabel ?? "Ja, intrekken"}
            </Button>
            <Button
              variant="outline"
              className="min-h-14 text-base"
              disabled={bezig}
              onClick={() => setVraag(false)}
            >
              Niet intrekken
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {stand === "aan" && onIntrekken ? (
            <Button variant="outline" className="min-h-14 text-base" onClick={() => setVraag(true)}>
              {intrekLabel ?? "Intrekken"}
            </Button>
          ) : null}
          {stand !== "aan" && onAanzetten ? (
            <Button
              variant="outline"
              className="min-h-14 text-base"
              disabled={bezig}
              onClick={() => void doe(onAanzetten)}
            >
              {bezig ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {aanzetLabel ?? "Weer aanzetten"}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
