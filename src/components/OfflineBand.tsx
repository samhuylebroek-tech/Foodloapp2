/**
 * P6 — Offline-melding bovenaan elk scherm. Het voorleesgebied (aria-live) bestaat altijd, zodat
 * een schermlezer het meldt zodra de verbinding wegvalt; de melding zelf heeft role="status".
 *
 * Eerlijk per plek: op de lijst worden afvinken en toevoegen bewaard en straks verstuurd; elders
 * zie je de laatst bekende gegevens en wacht wijzigen tot je weer online bent.
 */
import { useRouterState } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { useOnline, useWachtrijAantal } from "@/hooks/useOnline";

export const OFFLINE_TEKST_LIJST =
  "Je bent offline — wijzigingen worden bewaard en straks verstuurd.";
export const OFFLINE_TEKST_ELDERS =
  "Je bent offline — je ziet wat laatst geladen werd. Afvinken en toevoegen op je lijst worden bewaard en straks verstuurd.";

export function wachtTekst(n: number): string {
  if (n <= 0) return "";
  return n === 1
    ? "1 wijziging wacht om verstuurd te worden."
    : `${n} wijzigingen wachten om verstuurd te worden.`;
}

export function OfflineBand() {
  const online = useOnline();
  const wacht = useWachtrijAantal();
  const pad = useRouterState({ select: (s) => s.location.pathname });
  const lijst = pad.startsWith("/boodschappen");
  return (
    <div aria-live="polite" data-testid="offline-band">
      {online ? null : (
        <p
          role="status"
          className="mb-5 flex items-start gap-3 rounded-2xl bg-honing-zacht px-4 py-3 text-base text-honing-foreground ring-1 ring-honing/40"
        >
          <WifiOff className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="block font-semibold">
              {lijst ? OFFLINE_TEKST_LIJST : OFFLINE_TEKST_ELDERS}
            </span>
            {wacht ? <span className="block">{wachtTekst(wacht)}</span> : null}
          </span>
        </p>
      )}
    </div>
  );
}
