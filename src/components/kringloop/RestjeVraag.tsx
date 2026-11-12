/**
 * Na het koken (usecase 18): "Blijft er iets over?" Eén tik op het aantal porties bewaart een
 * restje op dit toestel, met "Ongedaan maken". Opnieuw tikken past de porties aan.
 */
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { bewaarRestje, verwijderRestje } from "@/lib/intelligentie/restjes";
import { meet } from "@/lib/meten";
import { cn } from "@/lib/utils";

export function RestjeVraag({ titel, receptId }: { titel: string; receptId: string }) {
  const { user } = useAuth();
  const [gekozen, setGekozen] = useState<number | null>(null);
  if (!user) return null;

  function kies(porties: number) {
    if (!user) return;
    const r = bewaarRestje(user.id, { titel, receptId, porties });
    setGekozen(porties);
    void meet("restjes.bewaard", undefined, { porties });
    toast.success(`Restje bewaard: ${porties} ${porties === 1 ? "portie" : "porties"}`, {
      description: "Je ziet het de komende dagen op Vandaag en in Keuken.",
      action: {
        label: "Ongedaan maken",
        onClick: () => {
          verwijderRestje(user.id, r.id);
          setGekozen(null);
        },
      },
    });
  }

  return (
    <fieldset className="mt-6 text-left">
      <legend className="text-lg font-semibold">Blijft er iets over?</legend>
      <p className="text-base text-muted-foreground">
        Tik hoeveel porties. Foodlo stelt ze de komende dagen voor.
      </p>
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
    </fieldset>
  );
}
