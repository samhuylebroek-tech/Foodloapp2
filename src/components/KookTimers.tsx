import { useEffect, useState } from "react";
import { BellRing, Pause, Play, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { duurLabel, toonTijd, type TimerVoorstel } from "@/lib/kookstand";
import { cn } from "@/lib/utils";

type LopendeTimer = {
  id: number;
  label: string;
  totaal: number;
  /** Eindtijdstip (ms) als hij loopt; bij pauze null en `rest` bewaart de resterende tijd. */
  eind: number | null;
  rest: number;
  klaar: boolean;
};

/**
 * Timers voor de kookstand. Blijven lopen als je naar een andere stap gaat,
 * en rekenen met een eindtijdstip, zodat ze ook na het vergrendelen van de
 * telefoon juist zijn.
 */
export function KookTimers({ voorstellen }: { voorstellen: TimerVoorstel[] }) {
  const [timers, setTimers] = useState<LopendeTimer[]>([]);
  const [nu, setNu] = useState(() => Date.now());
  const [aankondiging, setAankondiging] = useState("");

  const lopend = timers.some((t) => t.eind !== null && !t.klaar);
  useEffect(() => {
    if (!lopend) return;
    const i = window.setInterval(() => setNu(Date.now()), 250);
    return () => window.clearInterval(i);
  }, [lopend]);

  // Afgelopen timers melden (één keer per timer).
  useEffect(() => {
    const afgelopen = timers.filter((t) => t.eind !== null && !t.klaar && t.eind <= nu);
    if (!afgelopen.length) return;
    setTimers((oud) =>
      oud.map((t) =>
        afgelopen.some((a) => a.id === t.id) ? { ...t, klaar: true, eind: null, rest: 0 } : t,
      ),
    );
    for (const t of afgelopen) {
      const tekst = `Tijd is om: ${t.label}`;
      setAankondiging(tekst);
      toast.success(tekst, { duration: 15_000 });
      try {
        navigator.vibrate?.([300, 150, 300, 150, 600]);
      } catch {
        // trillen niet beschikbaar
      }
    }
  }, [nu, timers]);

  function start(v: TimerVoorstel) {
    setNu(Date.now());
    setTimers((oud) => [
      ...oud,
      {
        id: Date.now() + Math.random(),
        label: v.label,
        totaal: v.seconden,
        eind: Date.now() + v.seconden * 1000,
        rest: v.seconden,
        klaar: false,
      },
    ]);
    setAankondiging(`Timer gestart: ${duurLabel(v.seconden)}`);
  }

  function pauzeerOfHervat(id: number) {
    setTimers((oud) =>
      oud.map((t) => {
        if (t.id !== id || t.klaar) return t;
        if (t.eind !== null)
          return { ...t, eind: null, rest: Math.max(0, (t.eind - Date.now()) / 1000) };
        return { ...t, eind: Date.now() + t.rest * 1000 };
      }),
    );
    setNu(Date.now());
  }

  function stop(id: number) {
    setTimers((oud) => oud.filter((t) => t.id !== id));
  }

  if (!voorstellen.length && !timers.length) return null;

  return (
    <div className="mt-6 space-y-3">
      <p className="sr-only" aria-live="assertive">
        {aankondiging}
      </p>
      {voorstellen.length ? (
        <div className="flex flex-wrap gap-2">
          {voorstellen.map((v) => (
            <button
              key={v.seconden}
              type="button"
              onClick={() => start(v)}
              className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-[var(--honing-zacht)] px-5 text-lg font-semibold text-[var(--honing-foreground)] shadow-zacht transition-transform active:scale-95"
            >
              <Timer className="size-6" aria-hidden />
              Timer {duurLabel(v.seconden)}
            </button>
          ))}
        </div>
      ) : null}
      {timers.length ? (
        <ul className="space-y-2" aria-label="Lopende timers">
          {timers.map((t) => {
            const rest = t.klaar ? 0 : t.eind !== null ? (t.eind - nu) / 1000 : t.rest;
            const voortgang = t.totaal ? 1 - rest / t.totaal : 1;
            return (
              <li
                key={t.id}
                className={cn(
                  "relative flex min-h-20 items-center gap-3 overflow-hidden rounded-2xl p-3 shadow-zacht",
                  t.klaar ? "bg-terracotta text-terracotta-foreground" : "bg-card",
                )}
              >
                {!t.klaar ? (
                  <span
                    className="absolute inset-y-0 left-0 bg-secondary transition-[width] duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, voortgang * 100))}%` }}
                    aria-hidden
                  />
                ) : null}
                <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-card/80 text-foreground">
                  {t.klaar ? (
                    <BellRing className="size-6" aria-hidden />
                  ) : (
                    <Timer className="size-6 text-primary" aria-hidden />
                  )}
                </span>
                <span className="relative min-w-0 flex-1">
                  <span
                    className="block text-3xl font-bold tabular-nums"
                    role="timer"
                    aria-label={`${t.label}: nog ${toonTijd(rest)}`}
                  >
                    {t.klaar ? "Klaar!" : toonTijd(rest)}
                  </span>
                  <span className="block truncate text-base opacity-80">{t.label}</span>
                </span>
                {!t.klaar ? (
                  <button
                    type="button"
                    onClick={() => pauzeerOfHervat(t.id)}
                    aria-label={
                      t.eind !== null ? `Pauzeer timer ${t.label}` : `Hervat timer ${t.label}`
                    }
                    className="relative flex size-14 shrink-0 items-center justify-center rounded-xl bg-card text-foreground shadow-zacht"
                  >
                    {t.eind !== null ? (
                      <Pause className="size-6" aria-hidden />
                    ) : (
                      <Play className="size-6" aria-hidden />
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => stop(t.id)}
                  aria-label={t.klaar ? `Sluit timer ${t.label}` : `Stop timer ${t.label}`}
                  className="relative flex size-14 shrink-0 items-center justify-center rounded-xl bg-card text-foreground shadow-zacht"
                >
                  <X className="size-6" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
