/**
 * Bouwstenen voor "Stel mijn week samen" (P1): de weekcontext per dag en het voorstel per dag.
 * De logica zit in src/lib/planner/engine.ts; hier alleen weergave en knoppen.
 */
import { Link } from "@tanstack/react-router";
import {
  Check,
  Clock3,
  Coins,
  Info,
  PartyPopper,
  Soup,
  Sparkles,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { euro } from "@/lib/budget";
import type { HuishoudenLid } from "@/lib/gezin-veiligheid";
import {
  ALTERNATIEF_LABEL,
  bekendeKost,
  CHIPS,
  FILTER_TEKST,
  VERSOEPELBAAR,
  type AlternatiefSoort,
  type DagChip,
  type DagUitkomst,
  type MenuVoorstel,
} from "@/lib/planner/engine";
import { cn } from "@/lib/utils";
import { labelVoor } from "./gedeeld";

const CHIP_ICOON: Record<DagChip, typeof Zap> = {
  "weinig-tijd": Zap,
  "niet-thuis": UtensilsCrossed,
  feestelijk: PartyPopper,
  restjes: Soup,
};

const pil = (aan: boolean) =>
  cn(
    "inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 text-base font-semibold",
    aan ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border hover:bg-muted",
  );

export type DagInstelling = {
  aan: boolean;
  /** null = het hele huishouden. */
  eters: string[] | null;
  chips: DagChip[];
};

export function DagContextKaart({
  datum,
  instelling,
  leden,
  bestaand,
  zet,
}: {
  datum: string;
  instelling: DagInstelling;
  leden: readonly HuishoudenLid[];
  /** Wat al gepland staat op het hoofdmoment ("Spaghetti bolognese"). */
  bestaand: string | null;
  zet: (deel: Partial<DagInstelling>) => void;
}) {
  const titelId = `dag-${datum}`;
  const eters = instelling.eters ?? leden.map((l) => l.id);
  const nietThuis = instelling.chips.includes("niet-thuis");
  return (
    <li
      aria-labelledby={titelId}
      data-dag={datum}
      className={cn("paneel space-y-3 p-4", !instelling.aan && "opacity-90")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={titelId} className="text-kaarttitel first-letter:uppercase">
          {labelVoor(datum)}
        </h3>
        <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 text-base font-semibold">
          <input
            type="checkbox"
            className="size-6 accent-[var(--primary)]"
            checked={instelling.aan}
            onChange={(e) => zet({ aan: e.target.checked })}
          />
          Plannen
        </label>
      </div>
      {bestaand ? (
        <p className="flex items-start gap-2 text-[0.95rem] text-muted-foreground">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            Staat al: <strong className="text-foreground">{bestaand}</strong>.
            {instelling.aan ? " Foodlo vraagt eerst of je dat wil vervangen." : ""}
          </span>
        </p>
      ) : null}
      {instelling.aan ? (
        <>
          <div
            role="group"
            aria-label={`Zo is ${labelVoor(datum)}`}
            className="flex flex-wrap gap-2"
          >
            {CHIPS.map((c) => {
              const aan = instelling.chips.includes(c.id);
              const I = CHIP_ICOON[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={aan}
                  onClick={() =>
                    zet({
                      chips: aan
                        ? instelling.chips.filter((x) => x !== c.id)
                        : [...instelling.chips, c.id],
                    })
                  }
                  className={pil(aan)}
                >
                  {aan ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <I className="size-4" aria-hidden />
                  )}
                  {c.label}
                </button>
              );
            })}
          </div>
          {leden.length && !nietThuis ? (
            <div>
              <p
                id={`${titelId}-wie`}
                className="mb-2 flex items-center gap-2 text-base font-medium"
              >
                <Users className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                Wie eet mee?{" "}
                <span className="font-normal text-muted-foreground">
                  {eters.length === 1 ? "1 persoon" : `${eters.length} personen`}
                </span>
              </p>
              <div role="group" aria-labelledby={`${titelId}-wie`} className="flex flex-wrap gap-2">
                {leden.map((l) => {
                  const aan = eters.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={aan}
                      aria-label={`${l.naam} eet mee op ${labelVoor(datum)}`}
                      onClick={() => {
                        const volgende = aan ? eters.filter((x) => x !== l.id) : [...eters, l.id];
                        // Nooit niemand: dan blijft de laatste staan.
                        if (!volgende.length) return;
                        zet({ eters: volgende.length === leden.length ? null : volgende });
                      }}
                      className={pil(aan)}
                    >
                      {aan ? <Check className="size-4" aria-hidden /> : null}
                      {l.naam}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

export function MenuSamenvatting({ menu }: { menu: MenuVoorstel }) {
  const over = menu.budget?.status === "over";
  return (
    <section
      aria-label="Kost van dit menu"
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4",
        over
          ? "border-[var(--honing)] bg-[var(--honing-zacht)] text-[var(--honing-foreground)]"
          : "border-border bg-card",
      )}
    >
      <Coins className="mt-0.5 size-6 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1 text-base">
        <p className="font-semibold" data-weekkost={menu.kost.totaal}>
          {menu.kost.geschat + menu.kost.nietGeschat === 0
            ? "Nog geen gerecht gekozen"
            : `Dit menu ≈ ${euro(menu.kost.totaal)} (schatting)`}
          {menu.budget ? ` · budget ${euro(menu.budget.bedrag)}` : ""}
        </p>
        {menu.budget ? (
          <p role="status">
            {over
              ? `${euro(-menu.budget.verschil)} boven je budget. Tik op "Goedkoper" bij een dag.`
              : `Binnen je budget: nog ongeveer ${euro(menu.budget.verschil)} over.`}
          </p>
        ) : (
          <p className="text-[0.95rem] text-muted-foreground">
            <Link
              to="/mijn-keuken"
              className="font-medium underline underline-offset-4"
            >
              Stel een weekbudget in
            </Link>{" "}
            en Foodlo houdt er rekening mee.
          </p>
        )}
        <p className="text-[0.95rem] text-muted-foreground">
          Vaste richtprijzen, geen winkelprijzen.
          {menu.kost.nietGeschat
            ? ` ${menu.kost.nietGeschat} ${menu.kost.nietGeschat === 1 ? "gerecht" : "gerechten"}: prijs onbekend (niet meegeteld).`
            : ""}
        </p>
      </div>
    </section>
  );
}

export function DagVoorstelKaart({
  uitkomst,
  momentLabel,
  bezig,
  melding,
  onAlternatief,
  onVersoepel,
}: {
  uitkomst: DagUitkomst;
  momentLabel: string | null;
  bezig: boolean;
  /** Korte uitleg na een wissel of als er geen alternatief is. */
  melding: string | null;
  onAlternatief: (soort: AlternatiefSoort) => void;
  onVersoepel: () => void;
}) {
  const k = uitkomst.keuze;
  const titelId = `voorstel-${uitkomst.datum}-${uitkomst.moment ?? ""}`;
  const kost = bekendeKost(k?.kost);
  return (
    <li
      aria-labelledby={titelId}
      data-voorstel={uitkomst.datum}
      data-status={uitkomst.status}
      className="paneel space-y-3 p-4"
    >
      <p id={titelId} className="text-base font-bold text-muted-foreground first-letter:uppercase">
        {labelVoor(uitkomst.datum)}
        {momentLabel ? ` · ${momentLabel}` : ""}
      </p>
      {uitkomst.status === "niet-thuis" ? (
        <p className="text-base">Niemand thuis: niets gepland.</p>
      ) : uitkomst.status === "restjes" ? (
        <p className="text-base">Restjesdag: je eet op wat er nog is. Niets op je lijst.</p>
      ) : uitkomst.status === "leeg" ? (
        <div className="space-y-2" role="status">
          <p className="text-base">{FILTER_TEKST[uitkomst.krapste ?? "herhaling"].waarom}</p>
          {uitkomst.krapste && VERSOEPELBAAR.includes(uitkomst.krapste) ? (
            <Button variant="outline" onClick={onVersoepel}>
              {FILTER_TEKST[uitkomst.krapste].versoepel}
            </Button>
          ) : (
            <p className="text-[0.95rem] text-muted-foreground">
              Allergieën en dieet versoepelt Foodlo nooit. Voeg een recept toe of kies zelf in Week.
            </p>
          )}
        </div>
      ) : k ? (
        <>
          <h3 className="text-kaarttitel" data-titel>
            {k.title}
          </h3>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-base text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" aria-hidden />
              {k.personen === 1 ? "1 persoon" : `${k.personen} personen`}
            </span>
            {k.minuten > 0 ? (
              <span className="inline-flex items-center gap-1.5" data-minuten={k.minuten}>
                <Clock3 className="size-4" aria-hidden />
                {k.minuten} min
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5" data-kost={kost ?? ""}>
              <Coins className="size-4" aria-hidden />
              {kost === null ? "prijs onbekend" : `≈ ${euro(kost)}`}
            </span>
          </p>
          <ul aria-label="Waarom" className="space-y-1">
            {k.redenen.map((r) => (
              <li key={r.tekst} className="flex items-start gap-2 text-base">
                <Sparkles className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                <span>{r.tekst}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
            {(Object.keys(ALTERNATIEF_LABEL) as AlternatiefSoort[]).map((s) => (
              <Button
                key={s}
                variant="outline"
                disabled={bezig}
                onClick={() => onAlternatief(s)}
                aria-label={`${ALTERNATIEF_LABEL[s]} gerecht voor ${labelVoor(uitkomst.datum)}`}
              >
                {ALTERNATIEF_LABEL[s]}
              </Button>
            ))}
          </div>
        </>
      ) : null}
      {melding ? (
        <p role="status" className="text-[0.95rem] text-muted-foreground">
          {melding}
        </p>
      ) : null}
    </li>
  );
}
