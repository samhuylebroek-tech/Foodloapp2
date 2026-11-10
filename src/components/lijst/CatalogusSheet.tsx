/**
 * Fase 5 — productcatalogus met tegels (zoals Bring!): tik om toe te voegen, nog eens tikken om
 * weg te halen (met "Ongedaan maken" via de lijst). Bovenaan je favorieten en wat je vaak koopt.
 */
import { useMemo, useState } from "react";
import { Check, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CATALOGUS, beeldVoor, zoekCatalogus } from "@/lib/catalogus";
import { CATEGORIE_LABEL } from "@/lib/categorie";
import { cn } from "@/lib/utils";

export function CatalogusSheet({
  open,
  onSluit,
  opLijst,
  favorieten,
  onKies,
}: {
  open: boolean;
  onSluit: () => void;
  /** Staat dit product al (open) op de lijst? */
  opLijst: (naam: string) => boolean;
  /** Vaste en vaak gekochte producten, al zonder dubbels. */
  favorieten: string[];
  /** Tik op een tegel: toevoegen, of weghalen als het er al op staat. */
  onKies: (naam: string, staatErOp: boolean) => void;
}) {
  const [zoek, setZoek] = useState("");
  const groepen = useMemo(() => zoekCatalogus(zoek), [zoek]);
  const fav = useMemo(() => {
    const t = zoek.trim().toLowerCase();
    return favorieten.filter((f) => !t || f.toLowerCase().includes(t)).slice(0, 12);
  }, [favorieten, zoek]);

  const tegel = (naam: string, beeld: string | null) => {
    const aan = opLijst(naam);
    return (
      <li key={naam}>
        <button
          type="button"
          aria-pressed={aan}
          aria-label={aan ? `${naam}: staat op je lijst, tik om weg te halen` : `${naam} toevoegen`}
          onClick={() => onKies(naam, aan)}
          className={cn(
            "relative flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-center transition-colors",
            aan
              ? "bg-primary text-primary-foreground shadow-zacht"
              : "bg-card ring-1 ring-border/70 hover:bg-muted",
          )}
        >
          <span className="text-3xl leading-none" aria-hidden>
            {beeld ?? "🛒"}
          </span>
          <span className="text-[0.95rem] font-semibold leading-tight first-letter:uppercase">
            {naam}
          </span>
          {aan ? (
            <Check className="absolute right-1.5 top-1.5 size-5" strokeWidth={3} aria-hidden />
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setZoek("");
          onSluit();
        }
      }}
    >
      <SheetContent side="bottom" className="flex max-h-[92dvh] flex-col gap-0 rounded-t-2xl p-0">
        <SheetHeader className="px-4 pb-3 pt-4 text-left">
          <SheetTitle>Producten kiezen</SheetTitle>
          <SheetDescription>
            Tik om op je lijst te zetten, nog eens tikken om weg te halen.
          </SheetDescription>
          <div className="relative mt-2">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek een product"
              aria-label="Zoek in de producten"
              className="h-14 rounded-full pl-12 text-lg"
            />
          </div>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {fav.length ? (
            <section aria-labelledby="cat-fav">
              <h3
                id="cat-fav"
                className="mb-2 flex items-center gap-2 text-[0.95rem] font-bold text-muted-foreground"
              >
                <Star className="size-4" aria-hidden /> Jouw favorieten en vaak gekocht
              </h3>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {fav.map((f) => tegel(f, beeldVoor(f)))}
              </ul>
            </section>
          ) : null}
          {groepen.map((g) => (
            <section key={g.afdeling} aria-labelledby={`cat-${g.afdeling}`}>
              <h3
                id={`cat-${g.afdeling}`}
                className="mb-2 text-[0.95rem] font-bold text-muted-foreground"
              >
                {g.afdeling === "voorraadkast" ? "Kast en houdbaar" : CATEGORIE_LABEL[g.afdeling]}
              </h3>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {g.producten.map((p) => tegel(p.naam, p.beeld))}
              </ul>
            </section>
          ))}
          {!groepen.length && !fav.length ? (
            <p className="text-lg text-muted-foreground">
              Niets gevonden. Typ het gewoon in het invoerveld van je lijst.
            </p>
          ) : null}
          <p className="sr-only">{CATALOGUS.length} afdelingen</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
