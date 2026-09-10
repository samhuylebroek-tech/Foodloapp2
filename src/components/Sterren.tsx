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
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onKies(waarde === n ? 0 : n)}
            aria-label={`${n} ${n === 1 ? "ster" : "sterren"}`}
            aria-pressed={n <= waarde}
            className="flex size-14 items-center justify-center rounded-xl hover:bg-secondary"
          >
            <Star
              className={cn(
                "size-8",
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
