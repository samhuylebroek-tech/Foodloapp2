/**
 * "Mijn keuken" (P1): keukenapparatuur, kookervaring en voorraadniveau. Gebruikt op de pagina
 * Mijn keuken (Instellingen › Jouw Foodlo) en, ingekort, in de kennismaking.
 * Alles optioneel; zonder keuze rekent Foodlo met oven + kookplaat en zegt dat erbij.
 */
import { Check, Info } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { APPARATEN, type Apparaat } from "@/lib/planner/apparatuur";
import { BASIS_SUGGESTIES, type Kookervaring, type Voorraadniveau } from "@/lib/planner/profiel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const chip = (aan: boolean) =>
  cn(
    "inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 text-base font-semibold",
    aan ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border hover:bg-muted",
  );

export function ApparatuurKeuze({
  waarde,
  aangenomen,
  zet,
}: {
  waarde: readonly Apparaat[];
  /** Nog niets gekozen: oven + kookplaat aangenomen. */
  aangenomen: boolean;
  zet: (a: Apparaat[]) => void;
}) {
  const id = useId();
  return (
    <fieldset className="space-y-3" aria-describedby={`${id}-u`}>
      <legend className="text-lg font-bold">Wat heb je in je keuken?</legend>
      <p id={`${id}-u`} className="text-[0.95rem] text-muted-foreground">
        Foodlo stelt dan geen recepten voor die een toestel vragen dat je niet hebt.
      </p>
      {aangenomen ? (
        <p
          role="note"
          className="flex items-start gap-2 rounded-xl bg-honing-zacht px-3 py-2 text-base text-honing-foreground"
        >
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span className="min-w-0">
            Nog niets gekozen: Foodlo neemt aan dat je een <strong>oven</strong> en een{" "}
            <strong>kookplaat</strong> hebt.
          </span>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {APPARATEN.map((a) => {
          const aan = waarde.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={aan}
              onClick={() => zet(aan ? waarde.filter((x) => x !== a.id) : [...waarde, a.id])}
              className={chip(aan)}
            >
              {aan ? <Check className="size-4" aria-hidden /> : null}
              {a.naam}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const ERVARING: { w: Kookervaring; label: string; uitleg: string }[] = [
  { w: "beginner", label: "Beginner", uitleg: "Eenvoudige recepten, geen moeilijke" },
  { w: "gemiddeld", label: "Gemiddeld", uitleg: "Gewone gerechten" },
  { w: "ervaren", label: "Ervaren", uitleg: "Alles mag, ook uitdagend" },
];

export function ErvaringKeuze({
  waarde,
  zet,
}: {
  waarde: Kookervaring | null;
  zet: (w: Kookervaring | null) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-bold">Hoe ervaren ben je in de keuken?</legend>
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
        {ERVARING.map((o) => {
          const aan = waarde === o.w;
          return (
            <button
              key={o.w}
              type="button"
              aria-pressed={aan}
              onClick={() => zet(aan ? null : o.w)}
              className={cn(
                "flex min-h-16 flex-col items-start justify-center rounded-2xl border-2 px-4 py-2 text-left",
                aan
                  ? "border-primary bg-secondary"
                  : "border-transparent bg-card ring-1 ring-border hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-1.5 text-base font-semibold">
                {aan ? <Check className="size-4 text-primary" aria-hidden /> : null}
                {o.label}
              </span>
              <span className="text-[0.95rem] text-muted-foreground">{o.uitleg}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const NIVEAU: { w: Voorraadniveau; label: string; uitleg: string }[] = [
  {
    w: "geen",
    label: "Niet bijhouden",
    uitleg: "Foodlo gaat ervan uit dat je niets in huis hebt.",
  },
  {
    w: "basis",
    label: "Alleen basis",
    uitleg: "Je kiest wat je altijd in huis hebt (bv. bloem, olie, rijst).",
  },
  {
    w: "volledig",
    label: "Alles bijhouden",
    uitleg: "Wat in je voorraad staat, telt als in huis.",
  },
];

export function VoorraadKeuze({
  niveau,
  basis,
  zetNiveau,
  zetBasis,
}: {
  niveau: Voorraadniveau | null;
  basis: readonly string[];
  zetNiveau: (n: Voorraadniveau) => void;
  zetBasis: (b: string[]) => void;
}) {
  const [nieuw, setNieuw] = useState("");
  const extra = basis.filter((b) => !BASIS_SUGGESTIES.includes(b));
  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-bold">Je voorraad</legend>
      <p className="text-[0.95rem] text-muted-foreground">
        Wat Foodlo niet weet, telt nooit als &quot;in huis&quot;.
      </p>
      <div className="grid grid-cols-1 gap-2">
        {NIVEAU.map((o) => {
          const aan = niveau === o.w;
          return (
            <button
              key={o.w}
              type="button"
              aria-pressed={aan}
              onClick={() => zetNiveau(o.w)}
              className={cn(
                "flex min-h-16 flex-col items-start justify-center rounded-2xl border-2 px-4 py-2 text-left",
                aan
                  ? "border-primary bg-secondary"
                  : "border-transparent bg-card ring-1 ring-border hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-1.5 text-base font-semibold">
                {aan ? <Check className="size-4 text-primary" aria-hidden /> : null}
                {o.label}
              </span>
              <span className="text-[0.95rem] text-muted-foreground">{o.uitleg}</span>
            </button>
          );
        })}
      </div>
      {niveau === "basis" ? (
        <div className="space-y-3 rounded-2xl bg-muted/50 p-3">
          <p id="basis-uitleg" className="text-base font-semibold">
            Wat heb je altijd in huis?
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="basis-uitleg">
            {[...BASIS_SUGGESTIES, ...extra].map((p) => {
              const aan = basis.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={aan}
                  onClick={() => zetBasis(aan ? basis.filter((x) => x !== p) : [...basis, p])}
                  className={chip(aan)}
                >
                  {aan ? <Check className="size-4" aria-hidden /> : null}
                  {p}
                </button>
              );
            })}
          </div>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = nieuw.trim().toLowerCase();
              if (t.length >= 2 && !basis.includes(t)) zetBasis([...basis, t]);
              setNieuw("");
            }}
          >
            <Input
              aria-label="Ander basisproduct"
              placeholder="Iets anders, bv. sojasaus"
              value={nieuw}
              maxLength={40}
              onChange={(e) => setNieuw(e.target.value)}
              className="min-w-0 flex-1 basis-48"
            />
            <Button type="submit" variant="outline">
              Toevoegen
            </Button>
          </form>
        </div>
      ) : null}
    </fieldset>
  );
}
