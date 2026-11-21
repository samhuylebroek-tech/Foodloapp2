import { Link } from "@tanstack/react-router";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Vriendelijke staat voor een module waarvan de tabel nog niet bestaat (productie vóór de
 * migratie). Nooit een foutmelding of een leeg scherm.
 */
export function ModuleNietBeschikbaar({
  naam,
  terugNaar = "/",
  terugLabel = "Terug naar Vandaag",
  compact = false,
}: {
  /** Bv. "Makers" of "Verzamelingen". */
  naam?: string;
  terugNaar?: string;
  terugLabel?: string;
  /** Kleine variant binnen een ander scherm (zonder terugknop). */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p
        role="status"
        className="paneel flex items-start gap-3 p-4 text-base text-muted-foreground"
      >
        <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <span>{naam ? `${naam}: ` : ""}deze functie wordt binnenkort geactiveerd.</span>
      </p>
    );
  }
  return (
    <div role="status" className="flex flex-col items-center paneel px-5 py-9 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-secondary text-primary [&_svg]:size-8">
        <Clock aria-hidden />
      </div>
      <h2 className="text-sectietitel">{naam ? `${naam} komt binnenkort` : "Binnenkort"}</h2>
      <p className="mx-auto mt-2 max-w-sm text-base text-muted-foreground">
        Deze functie wordt binnenkort geactiveerd. Je hoeft niets te doen: zodra ze klaar is,
        verschijnt ze hier vanzelf.
      </p>
      <div className="mt-6 w-full max-w-sm">
        <Button asChild variant="outline" className="h-14 w-full text-base">
          <Link to={terugNaar as "/"}>
            <ArrowLeft aria-hidden />
            {terugLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
}
