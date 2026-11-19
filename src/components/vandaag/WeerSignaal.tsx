/**
 * Klein weersignaal op Vandaag ("Warm vandaag: iets fris?"). Optioneel: aan/uit in Instellingen.
 * Zolang er geen echte weerbron is, komt het weer uit vaste testgegevens en staat dat erbij.
 */
import { Link } from "@tanstack/react-router";
import { CloudRain, Snowflake, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useWeer } from "@/hooks/useWeer";

const ICOON = { warm: Sun, koud: Snowflake, nat: CloudRain } as const;

/** `voet`: P4 "Niet meer tonen" en de link naar Instellingen › Suggesties. */
export function WeerSignaal({ voet }: { voet?: ReactNode } = {}) {
  const { weer, signaal } = useWeer();
  if (!weer || !signaal) return null;
  const Icoon = ICOON[signaal.soort];
  return (
    <section
      aria-label="Weer vandaag"
      className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-zacht"
    >
      <Icoon className="mt-0.5 size-7 shrink-0 text-[var(--honing-foreground)]" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-lg font-semibold leading-snug">{signaal.titel}</p>
        <p className="text-base text-muted-foreground">
          {Math.round(weer.temp)} °C in {weer.plaats}. {signaal.uitleg}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem]">
          {weer.test ? (
            <span className="min-w-0 max-w-full rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100">
              Testgegevens, geen echte weerdienst
            </span>
          ) : null}
          <Link
            to="/instellingen"
            hash="maaltijden"
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Weer uitzetten
          </Link>
        </p>
        {voet}
      </div>
    </section>
  );
}
