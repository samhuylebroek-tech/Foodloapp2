/**
 * Na het koken (usecase 18, P3): "Blijft er iets over?" Eén tik op het aantal porties bewaart een
 * restje (op je account na migratie 0019, anders op dit toestel), met "Ongedaan maken". Opnieuw tikken past de porties aan. De naam is
 * voorgevuld en aan te passen; de bewaardatum is een richtwaarde, geen veiligheidsbelofte.
 */
import { useId, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRestjesActies } from "@/hooks/useRestjes";
import { bewaarRichtwaarde } from "@/lib/intelligentie/restjes";
import { meet } from "@/lib/meten";
import { cn } from "@/lib/utils";

export function RestjeVraag({ titel, receptId }: { titel: string; receptId: string }) {
  const { user } = useAuth();
  const acties = useRestjesActies();
  const [gekozen, setGekozen] = useState<number | null>(null);
  const [naam, setNaam] = useState(titel);
  const naamId = useId();
  const uitlegId = useId();
  if (!user) return null;
  const richtwaarde = bewaarRichtwaarde(Date.now());

  function kies(porties: number) {
    if (!user || !acties) return;
    const r = acties.bewaar({ titel: naam.trim() || titel, receptId, porties });
    setGekozen(porties);
    void meet("restjes.bewaard", undefined, { porties });
    toast.success(`Restje bewaard: ${porties} ${porties === 1 ? "portie" : "porties"}`, {
      description: "Je ziet het de komende dagen op Vandaag, in Week en in Keuken.",
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          acties.verwijder(r.id);
          setGekozen(null);
        },
      },
    });
  }

  return (
    <fieldset className="text-left" aria-describedby={uitlegId}>
      <legend className="text-lg font-semibold">Blijft er iets over?</legend>
      <p id={uitlegId} className="text-base text-muted-foreground">
        Tik hoeveel porties. Foodlo stelt ze de komende dagen voor.
      </p>
      <label htmlFor={naamId} className="mt-3 block text-base font-semibold">
        Naam van het restje
      </label>
      <input
        id={naamId}
        value={naam}
        maxLength={120}
        onChange={(e) => setNaam(e.target.value)}
        className="mt-1 h-14 w-full rounded-xl border border-input bg-background px-3 text-base"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => kies(n)}
            aria-pressed={gekozen === n}
            className={cn(
              "min-h-12 min-w-12 rounded-full border px-4 text-base font-semibold",
              gekozen === n ? "border-primary bg-primary text-primary-foreground" : "border-border",
            )}
          >
            {n === 4 ? "4 of meer" : n === 1 ? "1 portie" : `${n} porties`}
          </button>
        ))}
      </div>
      <p className="mt-3 text-base text-muted-foreground" data-testid="restje-richtwaarde">
        {richtwaarde.tekst}
      </p>
    </fieldset>
  );
}
