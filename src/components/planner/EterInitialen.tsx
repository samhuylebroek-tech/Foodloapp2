import { initialen, type HuishoudenLid } from "@/lib/gezin-veiligheid";
import { cn } from "@/lib/utils";

/** Kleine gezichtjes met initialen van wie meeëet (weekkaart). Leeg = niets tonen. */
export function EterInitialen({
  leden,
  className,
}: {
  leden: Pick<HuishoudenLid, "id" | "naam">[];
  className?: string;
}) {
  if (!leden.length) return null;
  const namen = leden.map((l) => l.naam).join(", ");
  return (
    <span
      className={cn("flex flex-wrap items-center gap-1", className)}
      aria-label={`Eet mee: ${namen}`}
      role="img"
      data-testid="mee-eters"
    >
      {leden.slice(0, 6).map((l) => (
        <span
          key={l.id}
          aria-hidden
          title={l.naam}
          className="inline-flex size-7 items-center justify-center rounded-full bg-secondary text-[0.8rem] font-bold text-primary ring-1 ring-border"
        >
          {initialen(l.naam)}
        </span>
      ))}
      {leden.length > 6 ? (
        <span aria-hidden className="text-[0.9rem] font-semibold text-muted-foreground">
          +{leden.length - 6}
        </span>
      ) : null}
    </span>
  );
}
