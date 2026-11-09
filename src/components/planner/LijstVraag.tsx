/** WP6 — vraag "ook op je lijst?" (gezinsweekmenu; uit routes/planner.tsx, ongewijzigd). */
import { useEffect, useRef, useState } from "react";
import { ShoppingCart, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type ShoppingList } from "@/lib/boodschappen";

export function LijstVraag({
  titel,
  lijsten,
  onSluit,
  onKies,
  onNieuw,
}: {
  titel: string;
  lijsten: ShoppingList[];
  onSluit: () => void;
  onKies: (listId: string) => void;
  onNieuw: (naam: string) => void;
}) {
  const [nieuweNaam, setNieuweNaam] = useState("");
  const [nieuwTonen, setNieuwTonen] = useState(false);
  const venster = useRef<HTMLDivElement>(null);
  const sluitRef = useRef(onSluit);
  sluitRef.current = onSluit;

  // Toegankelijk venster: focus erin, Escape sluit, focus terug bij sluiten (BUG-030).
  // Eén keer bij openen (geen afhankelijkheden), zodat de focus niet verspringt.
  useEffect(() => {
    const vorige = document.activeElement as HTMLElement | null;
    const zetFocus = () => {
      if (!venster.current?.contains(document.activeElement))
        venster.current?.querySelector<HTMLElement>("button")?.focus();
    };
    zetFocus();
    // Geopend vanuit een menu? Dat menu houdt de focus vast tot het helemaal dicht is:
    // daarna nog eens (anders belandt de focus achter het venster).
    const later = window.setTimeout(zetFocus, 250);
    const opToets = (e: KeyboardEvent) => {
      if (e.key === "Escape") sluitRef.current();
    };
    document.addEventListener("keydown", opToets);
    return () => {
      window.clearTimeout(later);
      document.removeEventListener("keydown", opToets);
      vorige?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center">
      <div
        ref={venster}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lijstvraag-titel"
        className="w-full max-w-lg rounded-t-3xl bg-card p-4 sm:rounded-3xl"
      >
        <h2 id="lijstvraag-titel" className="font-display text-xl">
          Ook op je boodschappenlijst?
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          De ingrediënten van “{titel}” worden bij je lijst opgeteld.
        </p>

        <div className="mt-4 space-y-2">
          {lijsten.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onKies(l.id)}
              className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border px-4 text-left text-lg active:bg-secondary"
            >
              <ShoppingCart className="size-5" aria-hidden /> {l.name}
            </button>
          ))}

          {nieuwTonen ? (
            <div className="flex gap-2">
              <Input
                value={nieuweNaam}
                onChange={(e) => setNieuweNaam(e.target.value)}
                placeholder="Naam van het lijstje"
                aria-label="Naam van het nieuwe lijstje"
                className="h-14 text-base"
              />
              <Button
                onClick={() => nieuweNaam.trim() && onNieuw(nieuweNaam.trim())}
                className="h-14 px-6 text-base"
              >
                Maken
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNieuwTonen(true)}
              className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 text-left text-lg"
            >
              <ListPlus className="size-5" aria-hidden /> Nieuw lijstje maken
            </button>
          )}
        </div>

        <Button variant="ghost" onClick={onSluit} className="mt-3 h-14 w-full text-base">
          Nee, bedankt
        </Button>
      </div>
    </div>
  );
}
