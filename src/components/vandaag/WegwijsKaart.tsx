/**
 * Kleine kaart op Vandaag voor nieuwe gebruikers: verder met de rondleiding, de eerste stappen
 * of het Help Center. Nooit blokkerend, altijd weg te klikken. Bestaande gebruikers zien hem
 * niet (alleen na de nieuwe kennismaking).
 */
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  eersteStappenVerborgen,
  isNieuweGebruiker,
  verbergEersteStappen,
} from "@/lib/eerste-stappen";
import {
  bewaardeStap,
  opRondleidingWijziging,
  rondleidingActief,
  startRondleiding,
} from "@/lib/rondleiding";

export function WegwijsKaart() {
  const [stand, setStand] = useState<{ tonen: boolean; stap: number } | null>(null);
  useEffect(() => {
    const lees = () =>
      setStand({
        tonen: isNieuweGebruiker() && !eersteStappenVerborgen() && !rondleidingActief(),
        stap: bewaardeStap(),
      });
    lees();
    return opRondleidingWijziging(lees);
  }, []);
  if (!stand?.tonen) return null;
  return (
    <section aria-labelledby="wegwijs-kop" className="paneel relative space-y-3 p-5 pr-14">
      <h2 id="wegwijs-kop" className="text-kaarttitel">
        Wegwijs in Foodlo
      </h2>
      <p className="text-base text-muted-foreground">
        Korte oefeningen in de echte app, op je eigen tempo.
      </p>
      <div className="flex flex-wrap gap-2">
        {stand.stap > 0 ? (
          <button
            type="button"
            onClick={() => startRondleiding()}
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Ga verder met de rondleiding (stap {stand.stap + 1})
          </button>
        ) : null}
        <Link
          to="/eerste-stappen"
          className="inline-flex min-h-11 items-center rounded-full px-4 text-base font-semibold ring-1 ring-border hover:bg-muted"
        >
          Eerste stappen
        </Link>
        <Link
          to="/hulp"
          className="inline-flex min-h-11 items-center rounded-full px-4 text-base font-semibold ring-1 ring-border hover:bg-muted"
        >
          Help Center
        </Link>
      </div>
      <button
        type="button"
        aria-label="Wegwijs-kaart verbergen"
        onClick={() => {
          verbergEersteStappen(true);
          setStand((s) => (s ? { ...s, tonen: false } : s));
        }}
        className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full hover:bg-muted"
      >
        <X className="size-5" aria-hidden />
      </button>
    </section>
  );
}
