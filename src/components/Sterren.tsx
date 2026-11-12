import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sterren({ waarde, klein = false }: { waarde: number; klein?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${waarde} van 5 sterren`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={cn(
            klein ? "size-4" : "size-5",
            n <= waarde ? "fill-primary text-primary" : "text-muted-foreground",
          )}
        />
      ))}
    </span>
  );
}

export function SterrenKiezer({
  waarde,
  onKies,
  label = "Jouw score",
}: {
  waarde: number;
  onKies: (n: number) => void;
  label?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-base font-semibold">{label}</p>
      {/* Altijd vijf op één rij: de knoppen krimpen tot 44 px in plaats van naar een
          tweede regel te springen (review 2026-11-12: 4 + 1 en 3 + 2). */}
      <div className="flex max-w-[19rem] items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onKies(waarde === n ? 0 : n)}
            aria-label={`${n} ${n === 1 ? "ster" : "sterren"}`}
            aria-pressed={n <= waarde}
            className="flex h-14 min-w-[44px] flex-1 items-center justify-center rounded-xl hover:bg-secondary"
          >
            <Star
              className={cn(
                "size-8 max-w-[34px]",
                n <= waarde ? "fill-primary text-primary" : "text-muted-foreground",
              )}
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Compacte sterrenrij onder een receptkaart: één tik = score, nog eens op dezelfde ster = wissen. */
export function SterrenSnel({ waarde, onKies }: { waarde: number; onKies: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between" role="group" aria-label={`Jouw score: ${waarde} van 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onKies(waarde === n ? 0 : n)}
          aria-label={`Geef ${n} ${n === 1 ? "ster" : "sterren"}`}
          aria-pressed={n <= waarde}
          className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg active:scale-90 transition-transform hover:bg-secondary"
        >
          <Star
            aria-hidden
            className={cn(
              "size-6",
              // Donkere rand: gele vulling alleen haalt geen 3:1 op wit (WCAG 1.4.11).
              n <= waarde
                ? "fill-[var(--honing)] text-[var(--honing-foreground)]"
                : "text-muted-foreground/60",
            )}
          />
        </button>
      ))}
    </div>
  );
}
