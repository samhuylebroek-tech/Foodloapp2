/**
 * Instellingen › Maaltijden › Weekbudget. Per toestel. Leeg = geen budget (geen waarschuwingen).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Groep } from "@/components/mobiel/Lijst";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWeekbudget } from "@/hooks/useWeekbudget";
import { euro, leesBedrag } from "@/lib/budget";

export function BudgetInstelling() {
  const [budget, zet] = useWeekbudget();
  const [tekst, setTekst] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  useEffect(() => setTekst(budget ? String(budget).replace(".", ",") : ""), [budget]);

  function bewaar() {
    const bedrag = leesBedrag(tekst);
    if (bedrag === null) {
      setFout("Typ een bedrag in euro, bijvoorbeeld 60 of 59,50.");
      return;
    }
    setFout(null);
    zet(bedrag);
    toast.success(`Weekbudget bewaard: ${euro(bedrag)}`);
  }

  return (
    <Groep
      titel="Weekbudget"
      voet="Foodlo schat in Week wat je geplande gerechten ongeveer kosten en waarschuwt als je erboven gaat. Een schatting met vaste richtprijzen, geen echte winkelprijzen. Deze keuze geldt op dit toestel."
    >
      <form
        className="space-y-3 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          bewaar();
        }}
      >
        <label htmlFor="weekbudget" className="block text-[1.05rem] font-semibold leading-snug">
          Wat wil je per week uitgeven aan eten? (in euro)
        </label>
        <Input
          id="weekbudget"
          inputMode="decimal"
          autoComplete="off"
          value={tekst}
          placeholder="Bv. 60"
          aria-invalid={!!fout}
          aria-describedby={fout ? "weekbudget-fout" : undefined}
          onChange={(e) => setTekst(e.target.value)}
        />
        {fout ? (
          <p id="weekbudget-fout" role="alert" className="text-base text-destructive">
            {fout}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline">
            Bewaar budget
          </Button>
          {budget ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                zet(null);
                toast("Weekbudget gewist", {
                  action: { label: "Ongedaan maken", onClick: () => zet(budget) },
                });
              }}
            >
              Geen budget
            </Button>
          ) : null}
        </div>
      </form>
    </Groep>
  );
}
