/** Gedeelde bouwstenen voor het Help Center. */
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { toonConcepten, type Artikel } from "@/lib/hulp/artikels";

/** Eerlijk label: zolang uitleg niet nagelezen is, zeggen we dat. */
export function ConceptBand() {
  if (!toonConcepten()) return null;
  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-2xl bg-honing-zacht px-4 py-3 text-base text-honing-foreground"
    >
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>
        Voorlopige uitleg: deze teksten zijn voorbereid op basis van de app en nog niet door een
        mens nagelezen.
      </span>
    </p>
  );
}

export function Stappen({ stappen }: { stappen: string[] }) {
  return (
    <ol className="space-y-3">
      {stappen.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-bold text-primary"
          >
            {i + 1}
          </span>
          <span className="min-w-0 pt-0.5 text-base leading-relaxed [overflow-wrap:anywhere]">
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function DoeHetNu({ artikel }: { artikel: Artikel }) {
  if (!artikel.doeHetNu) return null;
  return (
    <Link
      to={artikel.doeHetNu.route as "/"}
      className="inline-flex min-h-12 max-w-full items-center justify-center rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90"
    >
      Doe het nu: {artikel.doeHetNu.label}
    </Link>
  );
}

export const SOORT_LABEL: Record<Artikel["soort"], string> = {
  handleiding: "Handleiding",
  vraag: "Veelgestelde vraag",
  probleem: "Probleem oplossen",
};
