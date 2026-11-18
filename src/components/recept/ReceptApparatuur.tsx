/**
 * Editor: welke toestellen vraagt dit recept? Foodlo herkent het uit de stappen; jij past aan.
 * Wat je kiest, gebruikt de weekplanner (geen airfryer-recept voor wie geen airfryer heeft).
 */
import { Check, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import {
  APPARATEN,
  herkenApparatuur,
  vereisteTekst,
  type Apparaat,
} from "@/lib/planner/apparatuur";
import { VEREISTEN_TABEL } from "@/lib/planner/vereisten-db";
import { cn } from "@/lib/utils";

export function ReceptApparatuur({
  titel,
  beschrijving,
  tags,
  stappen,
  zelf,
  zet,
}: {
  titel: string;
  beschrijving: string;
  tags: string[];
  stappen: string[];
  /** null = herkenning gebruiken. */
  zelf: Apparaat[] | null;
  zet: (a: Apparaat[] | null) => void;
}) {
  const { beschikbaar } = useModuleBeschikbaar(VEREISTEN_TABEL);
  const herkend = useMemo(
    () => herkenApparatuur({ title: titel, description: beschrijving, tags, stappen }),
    [titel, beschrijving, tags, stappen],
  );
  const getoond: Apparaat[] = zelf ?? [...new Set(herkend.flat())];
  return (
    <fieldset className="space-y-2 sm:col-span-2">
      <legend className="text-base font-medium">Nodig in de keuken</legend>
      <p className="text-[0.95rem] text-muted-foreground">
        {zelf
          ? "Door jou gekozen."
          : herkend.length
            ? `Foodlo herkende: ${herkend.map(vereisteTekst).join(", ")}. Klopt het niet? Pas het aan.`
            : "Foodlo herkende geen bijzonder toestel (een kookplaat volstaat)."}
      </p>
      {beschikbaar ? (
        <>
          <div className="flex flex-wrap gap-2">
            {APPARATEN.filter((a) => a.id !== "kookplaat" && a.id !== "andere").map((a) => {
              const aan = getoond.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={aan}
                  onClick={() => zet(aan ? getoond.filter((x) => x !== a.id) : [...getoond, a.id])}
                  className={cn(
                    "inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 text-base font-semibold",
                    aan
                      ? "bg-primary text-primary-foreground"
                      : "bg-card ring-1 ring-border hover:bg-muted",
                  )}
                >
                  {aan ? <Check className="size-4" aria-hidden /> : null}
                  {a.naam}
                </button>
              );
            })}
          </div>
          {zelf ? (
            <Button type="button" variant="ghost" onClick={() => zet(null)}>
              <RotateCcw className="size-4" aria-hidden />
              Terug naar wat Foodlo herkende
            </Button>
          ) : null}
        </>
      ) : (
        <p className="text-[0.95rem] text-muted-foreground">
          Zelf aanpassen wordt binnenkort geactiveerd.
        </p>
      )}
    </fieldset>
  );
}
