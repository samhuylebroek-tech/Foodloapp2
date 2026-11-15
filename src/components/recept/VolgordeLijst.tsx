/**
 * Volgorde aanpassen met knoppen (geen slepen nodig): elke regel heeft "hoger" en "lager",
 * 48 × 48 px, met een naam voor schermlezers ("Zet 2 eieren hoger"). Na het verplaatsen blijft
 * de focus op dezelfde knop van het verplaatste item, en een melding zegt waar het nu staat.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { kanVerplaatsen } from "@/lib/volgorde";

export function VolgordeLijst({
  id,
  titel,
  items,
  onVerplaats,
}: {
  id: string;
  titel: string;
  items: string[];
  onVerplaats: (index: number, richting: -1 | 1) => void;
}) {
  const lijst = useRef<HTMLOListElement>(null);
  const [focus, setFocus] = useState<{ index: number; richting: -1 | 1 } | null>(null);
  const [melding, setMelding] = useState("");

  useEffect(() => {
    if (!focus) return;
    const knop = lijst.current?.querySelector<HTMLButtonElement>(
      `[data-plek="${focus.index}"][data-richting="${focus.richting}"]`,
    );
    // Aan de rand is die knop uitgeschakeld: dan de andere knop van hetzelfde item.
    const ander = lijst.current?.querySelector<HTMLButtonElement>(
      `[data-plek="${focus.index}"][data-richting="${-focus.richting}"]`,
    );
    (knop && !knop.disabled ? knop : ander)?.focus();
    setFocus(null);
  }, [focus, items]);

  if (items.length < 2) return null;

  function zet(index: number, richting: -1 | 1) {
    const doel = index + richting;
    onVerplaats(index, richting);
    setFocus({ index: doel, richting });
    setMelding(`${items[index]} staat nu op plaats ${doel + 1} van ${items.length}.`);
  }

  return (
    <details className="mt-2 rounded-2xl border border-border bg-card" data-testid={id}>
      <summary className="flex min-h-12 cursor-pointer items-center px-4 text-base font-semibold text-primary">
        {titel}
      </summary>
      <ol ref={lijst} className="divide-y divide-border border-t border-border">
        {items.map((item, i) => (
          <li key={`${i}-${item}`} className="flex items-center gap-2 py-1 pr-1 pl-3">
            <span className="w-6 shrink-0 text-base font-semibold text-primary">{i + 1}</span>
            <span className="min-w-0 flex-1 text-base break-words">{item}</span>
            <button
              type="button"
              data-plek={i}
              data-richting={-1}
              disabled={!kanVerplaatsen(items.length, i, -1)}
              onClick={() => zet(i, -1)}
              aria-label={`Zet ${item} hoger`}
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-card hover:bg-muted disabled:opacity-40"
            >
              <ArrowUp className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              data-plek={i}
              data-richting={1}
              disabled={!kanVerplaatsen(items.length, i, 1)}
              onClick={() => zet(i, 1)}
              aria-label={`Zet ${item} lager`}
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-card hover:bg-muted disabled:opacity-40"
            >
              <ArrowDown className="size-5" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        {melding}
      </p>
    </details>
  );
}
