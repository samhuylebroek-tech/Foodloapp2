/**
 * Gedeelde mobiele bouwstenen (V2): gegroepeerde lijsten zoals in de
 * instellingen van iOS en Android, een rustig paneel en een lege staat.
 * Eén vormtaal voor Meer, Instellingen, Gezin, Vrienden, Meldingen, enz.
 */
import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tint = "groen" | "honing" | "terracotta" | "inkt" | "blauw" | "rood" | "grijs";

const TINT: Record<Tint, string> = {
  groen: "bg-secondary text-primary",
  honing: "bg-honing-zacht text-honing-foreground",
  terracotta: "bg-terracotta-zacht text-terracotta",
  inkt: "bg-inkt text-inkt-foreground",
  blauw:
    "bg-[oklch(0.94_0.03_235)] text-[oklch(0.42_0.09_240)] dark:bg-[oklch(0.32_0.04_240)] dark:text-[oklch(0.88_0.05_235)]",
  rood: "bg-[oklch(0.95_0.03_25)] text-destructive dark:bg-[oklch(0.32_0.06_25)]",
  grijs: "bg-muted text-muted-foreground",
};

/** Gekleurd icoonblokje vooraan een rij. */
export function Icoon({
  icoon: I,
  tint = "groen",
  groot = false,
}: {
  icoon: LucideIcon;
  tint?: Tint | undefined;
  groot?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        groot ? "size-12" : "size-10",
        TINT[tint],
      )}
    >
      <I className={groot ? "size-6" : "size-[1.35rem]"} aria-hidden />
    </span>
  );
}

/** Een groep rijen met een korte kop en optionele uitleg eronder. */
export function Groep({
  titel,
  voet,
  children,
  className,
  actie,
}: {
  titel?: ReactNode;
  voet?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Kleine actie rechts naast de kop (bv. "Alles tonen"). */
  actie?: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={titel ? id : undefined} className={cn("min-w-0", className)}>
      {titel ? (
        <div className="mb-2 flex min-h-8 items-end justify-between gap-3 px-1">
          <h2 id={id} className="font-sans text-[0.95rem] font-bold text-muted-foreground">
            {titel}
          </h2>
          {actie}
        </div>
      ) : null}
      <div className="divide-y divide-border/80 paneel overflow-hidden">{children}</div>
      {voet ? <p className="mt-2 px-1 text-[0.95rem] text-muted-foreground">{voet}</p> : null}
    </section>
  );
}

type RijBasis = {
  icoon?: LucideIcon;
  tint?: Tint | undefined;
  titel: ReactNode;
  uitleg?: ReactNode;
  /** Inhoud rechts: waarde, badge of een bediening (schakelaar). */
  rechts?: ReactNode;
  /** Rood en zonder pijl, voor afmelden of verwijderen. */
  gevaar?: boolean;
  className?: string;
};

function RijInhoud({
  icoon,
  tint,
  titel,
  uitleg,
  rechts,
  gevaar,
  pijl,
}: RijBasis & { pijl: boolean }) {
  return (
    <>
      {icoon ? <Icoon icoon={icoon} tint={gevaar ? "rood" : tint} /> : null}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[1.05rem] font-semibold leading-snug",
            gevaar ? "text-destructive" : "text-foreground",
          )}
        >
          {titel}
        </span>
        {uitleg ? (
          <span className="mt-0.5 block text-[0.95rem] leading-snug text-muted-foreground">
            {uitleg}
          </span>
        ) : null}
      </span>
      {rechts ? <span className="flex shrink-0 items-center gap-2">{rechts}</span> : null}
      {pijl ? <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : null}
    </>
  );
}

const rijKlasse = "flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left transition-colors";
const tikbaar = "cursor-pointer hover:bg-muted/70 active:bg-muted focus-visible:-outline-offset-4";

/** Rij die naar een ander scherm gaat. */
export function LinkRij({
  to,
  params,
  search,
  ...rest
}: RijBasis & {
  to: NonNullable<LinkProps["to"]>;
  /** Routeparameters, bv. { id } voor /kaarten/$id. */
  params?: Record<string, string>;
  /** Zoekparameters, bv. { terug: "instellingen" }. */
  search?: Record<string, string>;
}) {
  return (
    <Link
      {...({ to, ...(params ? { params } : {}), ...(search ? { search } : {}) } as LinkProps)}
      className={cn(rijKlasse, tikbaar, rest.className)}
    >
      <RijInhoud {...rest} pijl={!rest.gevaar} />
    </Link>
  );
}

/** Rij die een actie uitvoert (knop). */
export function KnopRij({
  onClick,
  disabled,
  pijl = false,
  ...rest
}: RijBasis & { onClick: () => void; disabled?: boolean; pijl?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        rijKlasse,
        tikbaar,
        "disabled:cursor-not-allowed disabled:opacity-60",
        rest.className,
      )}
    >
      <RijInhoud {...rest} pijl={pijl} />
    </button>
  );
}

/** Rij zonder eigen actie (bv. met een schakelaar rechts, of alleen informatie). */
export function Rij(props: RijBasis & { children?: ReactNode }) {
  return (
    <div className={cn(rijKlasse, props.className)}>
      <RijInhoud {...props} pijl={false} />
      {props.children}
    </div>
  );
}

/** Rustig paneel voor formulieren en vrije inhoud. */
export function Paneel({
  children,
  className,
  titel,
  uitleg,
}: {
  children: ReactNode;
  className?: string;
  titel?: ReactNode;
  uitleg?: ReactNode;
}) {
  return (
    <div className={cn("paneel p-4 sm:p-5", className)}>
      {titel ? <h2 className="text-kaarttitel">{titel}</h2> : null}
      {uitleg ? <p className="mt-1 text-[0.95rem] text-muted-foreground">{uitleg}</p> : null}
      {titel || uitleg ? <div className="mt-4">{children}</div> : children}
    </div>
  );
}

/** Lege staat: groot icoon, één zin uitleg en (optioneel) de volgende stap. */
export function LegeStaat({
  icoon: I,
  titel,
  uitleg,
  children,
  tint = "groen",
}: {
  icoon: LucideIcon;
  titel: ReactNode;
  uitleg?: ReactNode;
  children?: ReactNode;
  tint?: Tint;
}) {
  return (
    <div className="flex flex-col items-center paneel px-5 py-8 text-center">
      <span className={cn("flex size-16 items-center justify-center rounded-full", TINT[tint])}>
        <I className="size-8" aria-hidden />
      </span>
      <h2 className="mt-4 text-sectietitel">{titel}</h2>
      {uitleg ? <p className="mt-2 max-w-sm text-base text-muted-foreground">{uitleg}</p> : null}
      {children ? <div className="mt-5 w-full max-w-sm space-y-2">{children}</div> : null}
    </div>
  );
}

/** Ladende lijst: grijze rijen in dezelfde vorm als de echte inhoud. */
export function LadenRijen({ aantal = 3, label = "Laden…" }: { aantal?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className="divide-y divide-border/80 paneel overflow-hidden"
    >
      {Array.from({ length: aantal }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3.5 px-4 py-3">
          <span className="size-10 animate-pulse rounded-xl bg-muted" />
          <span className="flex-1 space-y-2">
            <span className="block h-4 w-2/3 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-1/2 animate-pulse rounded bg-muted" />
          </span>
        </div>
      ))}
    </div>
  );
}
