/** WP6 — instellingen van het weekmenu (uit routes/planner.tsx, ongewijzigd). */
import { X } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALLE_MOMENTEN, type WeekmenuInstelling } from "@/lib/voorkeuren";
import { DAG_NAMEN } from "./gedeeld";

export function WeekmenuInstellingen({
  instelling,
  algemeneMomenten,
  onZet,
  onSluit,
}: {
  instelling: WeekmenuInstelling;
  algemeneMomenten: string[];
  onZet: (deel: Partial<WeekmenuInstelling>) => void;
  onSluit: () => void;
}) {
  const momenten = instelling.momenten.length ? instelling.momenten : algemeneMomenten;

  function wisselDag(n: number) {
    const aan = instelling.dagen.includes(n);
    onZet({
      dagen: aan ? instelling.dagen.filter((d) => d !== n) : [...instelling.dagen, n].sort(),
    });
  }

  function wisselMoment(m: string) {
    const aan = momenten.includes(m);
    const nieuw = aan ? momenten.filter((x) => x !== m) : [...momenten, m];
    onZet({ momenten: nieuw.length ? nieuw : [m] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl">Instellingen weekmenu</h2>
          <Button variant="ghost" onClick={onSluit} aria-label="Sluiten" className="size-12">
            <X className="size-5" />
          </Button>
        </div>

        <Accordion type="single" collapsible defaultValue="foodlo" className="mt-4">
          <AccordionItem value="foodlo">
            <AccordionTrigger className="min-h-16 text-left text-lg">
              Voorstellen door Foodlo
            </AccordionTrigger>
            <AccordionContent className="pb-5">
              <p className="text-base text-muted-foreground">Hoeveel keer per week?</p>
              <div className="mt-2 space-y-2">
                {(
                  [
                    { id: "vlees", label: "Vlees" },
                    { id: "vis", label: "Vis" },
                    { id: "vega", label: "Vegetarisch" },
                  ] as const
                ).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3">
                    <span className="text-base font-semibold">{o.label}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        aria-label={`${o.label} minder`}
                        onClick={() => onZet({ [o.id]: Math.max(0, instelling[o.id] - 1) })}
                        className="size-12 text-lg"
                      >
                        –
                      </Button>
                      <span className="w-8 text-center text-lg font-semibold">
                        {instelling[o.id]}
                      </span>
                      <Button
                        variant="secondary"
                        aria-label={`${o.label} meer`}
                        onClick={() => onZet({ [o.id]: Math.min(7, instelling[o.id] + 1) })}
                        className="size-12 text-lg"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-base text-muted-foreground">Hoelang mag koken duren?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { id: 20, label: "Max 20 min" },
                  { id: 45, label: "Max 45 min" },
                  { id: 90, label: "Rustig koken" },
                  { id: 0, label: "Maakt niet uit" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={instelling.maxMinuten === t.id}
                    onClick={() => onZet({ maxMinuten: t.id })}
                    className={
                      instelling.maxMinuten === t.id
                        ? "min-h-12 rounded-xl bg-primary px-3 text-base font-semibold text-primary-foreground"
                        : "min-h-12 rounded-xl border border-border px-3 text-base font-semibold"
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-base text-muted-foreground" htmlFor="vermijd">
                Wat eet je liever niet?
              </label>
              <Input
                id="vermijd"
                value={instelling.vermijd}
                onChange={(e) => onZet({ vermijd: e.target.value })}
                placeholder="bv. paddenstoelen, bloemkool"
                className="mt-1 h-14 text-base"
                aria-describedby="vermijd-uitleg"
              />
              {/* BUG-142: eerlijk zeggen wat er met deze tekst gebeurt. */}
              <p id="vermijd-uitleg" className="mt-1 text-[0.95rem] text-muted-foreground">
                Allergieën vul je in bij je allergieën. Voor ideeën van de AI sturen we alleen
                smaakwensen door, nooit allergieën, dieet of gezondheid.
              </p>
              <p className="mt-4 text-base text-muted-foreground">Waaruit mag Foodlo kiezen?</p>
              <div className="mt-2 grid gap-2">
                {(
                  [
                    { id: "eigen", label: "Alleen mijn recepten" },
                    { id: "ook-extern", label: "Ook nieuwe ideeën" },
                  ] as const
                ).map((optie) => (
                  <Button
                    key={optie.id}
                    type="button"
                    variant={instelling.bron === optie.id ? "default" : "secondary"}
                    onClick={() => onZet({ bron: optie.id })}
                    className="h-14 justify-start text-base"
                  >
                    {optie.label}
                  </Button>
                ))}
              </div>
              {Object.keys(instelling.perDag).length ? (
                <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-base text-muted-foreground">
                  Je vaste voorkeuren per weekdag worden hier automatisch meegeteld. Je kunt ze bij
                  elk voorstel aanpassen.
                </p>
              ) : null}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="weergave">
            <AccordionTrigger className="min-h-16 text-left text-lg">Weergave</AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "lijst", label: "Onder elkaar" },
                    { id: "kaarten", label: "Naast elkaar (swipen)" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={instelling.weergave === o.id}
                    onClick={() => onZet({ weergave: o.id })}
                    className={
                      instelling.weergave === o.id
                        ? "min-h-14 rounded-xl bg-primary px-3 text-base font-semibold text-primary-foreground"
                        : "min-h-14 rounded-xl border border-border px-3 text-base font-semibold"
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="dagen">
            <AccordionTrigger className="min-h-16 text-left text-lg">
              Dagen en momenten
            </AccordionTrigger>
            <AccordionContent className="space-y-5 pb-5">
              <div>
                <h3 className="text-base font-semibold">De week begint op</h3>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 0, label: "Maandag" },
                      { id: 6, label: "Zondag" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={instelling.startdag === o.id}
                      onClick={() => onZet({ startdag: o.id })}
                      className={
                        instelling.startdag === o.id
                          ? "min-h-14 rounded-xl bg-primary px-3 text-base font-semibold text-primary-foreground"
                          : "min-h-14 rounded-xl border border-border px-3 text-base font-semibold"
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold">Welke dagen toon je?</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAG_NAMEN.map((naam, n) => (
                    <button
                      key={naam}
                      type="button"
                      aria-pressed={instelling.dagen.includes(n)}
                      onClick={() => wisselDag(n)}
                      className={
                        instelling.dagen.includes(n)
                          ? "min-h-12 rounded-xl bg-primary px-4 text-base font-semibold capitalize text-primary-foreground"
                          : "min-h-12 rounded-xl border border-border px-4 text-base font-semibold capitalize"
                      }
                    >
                      {naam.slice(0, 2)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-base font-semibold">Welke dagdelen plan je?</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ALLE_MOMENTEN.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={momenten.includes(m)}
                      onClick={() => wisselMoment(m)}
                      className={
                        momenten.includes(m)
                          ? "min-h-12 rounded-xl bg-primary px-4 text-base font-semibold capitalize text-primary-foreground"
                          : "min-h-12 rounded-xl border border-border px-4 text-base font-semibold capitalize"
                      }
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button onClick={onSluit} className="mt-6 h-14 w-full text-base">
          Klaar
        </Button>
      </div>
    </div>
  );
}

/** Kleine foto bij een ingepland gerecht; zonder foto de warme V2-omslag. */
