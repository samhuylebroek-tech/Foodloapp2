import { useId, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { ALLERGENEN } from "@/lib/allergenen";
import {
  DIEETEN,
  INTOLERANTIES,
  MAX_TERMEN,
  voegTermToe,
  type Voeding,
} from "@/lib/persoonlijke-voeding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const aanKlasse =
  "flex min-h-14 items-center justify-between gap-2 rounded-2xl border-2 border-primary bg-secondary px-4 text-left text-base font-semibold";
const uitKlasse =
  "flex min-h-14 items-center justify-between gap-2 rounded-2xl border-2 border-transparent bg-card px-4 text-left text-base font-semibold ring-1 ring-border hover:bg-muted";

function wissel(lijst: string[], id: string) {
  return lijst.includes(id) ? lijst.filter((x) => x !== id) : [...lijst, id];
}

/**
 * Keuze voor allergieën (14 EU-allergenen), intoleranties, dieet en "liever niet". Zelfde
 * velden voor jezelf en voor een gezinslid. Alleen vaste codes en korte termen.
 */
export function VoedingKeuze({
  waarde,
  onWijzig,
  wie = "je",
}: {
  waarde: Voeding;
  onWijzig: (v: Voeding) => void;
  /** "je" of een naam, voor de vraagteksten. */
  wie?: string;
}) {
  const id = useId();
  const [term, setTerm] = useState("");
  const vol = waarde.uitsluitingen.length >= MAX_TERMEN;
  const voegToe = () => {
    onWijzig({ ...waarde, uitsluitingen: voegTermToe(waarde.uitsluitingen, term) });
    setTerm("");
  };
  const knop = (aan: boolean, label: string, onClick: () => void, sleutel: string) => (
    <button
      key={sleutel}
      type="button"
      aria-pressed={aan}
      onClick={onClick}
      className={aan ? aanKlasse : uitKlasse}
    >
      <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
      {aan ? <Check className="size-5 shrink-0 text-primary" aria-hidden /> : null}
    </button>
  );
  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="text-lg font-semibold">Allergieën</legend>
        <p className="mt-1 text-base text-muted-foreground">
          Tik alles aan waar {wie === "je" ? "je" : wie} niet tegen kan.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[22rem]:grid-cols-2">
          {ALLERGENEN.map((a) =>
            knop(
              waarde.allergieen.includes(a.id),
              a.naam,
              () => onWijzig({ ...waarde, allergieen: wissel(waarde.allergieen, a.id) }),
              a.id,
            ),
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold">Intoleranties</legend>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[22rem]:grid-cols-2">
          {INTOLERANTIES.map((i) =>
            knop(
              waarde.intoleranties.includes(i.id),
              i.naam,
              () => onWijzig({ ...waarde, intoleranties: wissel(waarde.intoleranties, i.id) }),
              i.id,
            ),
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold">Dieet</legend>
        <div role="radiogroup" aria-label="Dieet" className="mt-3 grid gap-2">
          {DIEETEN.map((d) => {
            const aan = (waarde.dieet ?? "alles") === d.id;
            return (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={aan}
                onClick={() => onWijzig({ ...waarde, dieet: d.id === "alles" ? null : d.id })}
                className={aan ? aanKlasse : uitKlasse}
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">{d.naam}</span>
                {aan ? <Check className="size-5 shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold">Liever niet</legend>
        <p className="mt-1 text-base text-muted-foreground">
          Korte woorden, bv. “bloemkool” of “koriander”.
        </p>
        {waarde.uitsluitingen.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {waarde.uitsluitingen.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() =>
                    onWijzig({
                      ...waarde,
                      uitsluitingen: waarde.uitsluitingen.filter((x) => x !== t),
                    })
                  }
                  aria-label={`${t} weghalen`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-secondary px-4 text-base font-semibold"
                >
                  {t}
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex gap-2">
          <label htmlFor={`${id}-term`} className="sr-only">
            Iets dat {wie === "je" ? "je" : wie} liever niet eet
          </label>
          <Input
            id={`${id}-term`}
            value={term}
            maxLength={40}
            disabled={vol}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                voegToe();
              }
            }}
            placeholder={vol ? "Maximaal 20 woorden" : "bv. bloemkool"}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={voegToe}
            disabled={vol || !term.trim()}
            className="shrink-0"
          >
            <Plus className="size-5" aria-hidden /> Toevoegen
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
