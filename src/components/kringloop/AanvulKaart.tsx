/**
 * Eén kaart, één knop: "Er ontbreken 12 dingen voor je komende maaltijden".
 * Foodlo heeft al afgetrokken wat je in huis hebt en wat al op je lijst staat.
 * Verschijnt op Vandaag en bovenaan je lijst; verdwijnt als alles klaarstaat.
 */
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronRight, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAanvulling } from "@/hooks/useAanvulling";

export function AanvulKaart({ toonKlaar = false }: { toonKlaar?: boolean }) {
  const { data, zetOpLijst, haalWeg } = useAanvulling();
  const [bezig, setBezig] = useState(false);
  if (!data) return null;
  const a = data.aanvulling;
  const aantal = a.kopen.length;
  const weg = a.nietMeerNodig;

  if (!aantal && !weg.length) {
    if (!toonKlaar || !a.aantalGerechten) return null;
    return (
      <div className="flex items-center gap-3 rounded-[1.25rem] bg-secondary px-4 py-3 text-secondary-foreground">
        <Check className="size-6 shrink-0" aria-hidden />
        <p className="text-base font-semibold">Alles voor je komende maaltijden staat klaar</p>
      </div>
    );
  }

  return (
    <section
      aria-label="Boodschappen voor je komende maaltijden"
      className="rounded-[1.5rem] bg-inkt p-5 text-inkt-foreground shadow-kaart"
    >
      {aantal ? (
        <>
          <div className="flex items-center gap-4">
            <span className="text-5xl font-bold tabular-nums leading-none">{aantal}</span>
            <p className="text-lg font-semibold leading-snug">
              {aantal === 1 ? "ding ontbreekt" : "dingen ontbreken"} voor je komende maaltijden
            </p>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <Button
              variant="secondary"
              disabled={bezig}
              onClick={async () => {
                setBezig(true);
                await zetOpLijst("alles");
                setBezig(false);
              }}
              className="bg-honing text-honing-foreground hover:bg-honing/90"
            >
              {bezig ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
              Zet op mijn lijst
            </Button>
            <Button
              asChild
              variant="ghost"
              className="text-inkt-foreground hover:bg-white/10 hover:text-inkt-foreground"
            >
              <Link to="/aanvullen">
                Bekijk <ChevronRight />
              </Link>
            </Button>
          </div>
        </>
      ) : null}
      {weg.length ? (
        <div className={aantal ? "mt-4 border-t border-white/15 pt-3" : ""}>
          <p className="text-base text-inkt-zacht">
            {weg.length} {weg.length === 1 ? "ding" : "dingen"} op je lijst{" "}
            {weg.length === 1 ? "is" : "zijn"} voor een gerecht dat niet meer gepland is.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void haalWeg(weg.map((w) => w.id))}
            className="mt-1 -ml-3 text-inkt-foreground underline underline-offset-4 hover:bg-white/10 hover:text-inkt-foreground"
          >
            Haal van mijn lijst
          </Button>
        </div>
      ) : null}
    </section>
  );
}
