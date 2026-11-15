/**
 * Recept invoeren in stappen (beginners). Alleen de kop, de navigatie en de samenvatting staan
 * hier; de velden zelf blijven in RecipeForm en worden per stap getoond of verborgen (niet
 * weggehaald), zodat heen en weer gaan niets verliest.
 */
import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Check, ListOrdered, Loader2, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AANTAL_STAPPEN,
  ontbreektVoorBewaren,
  RECEPT_STAPPEN,
  voortgangTekst,
  type ReceptStap,
} from "@/lib/recept-stappen";

/** Keuze tussen "stap voor stap" en "alles op één scherm" (alleen bij een nieuw recept). */
export function StappenKeuze({
  aan,
  onWissel,
}: {
  aan: boolean;
  onWissel: (aan: boolean) => void;
}) {
  // In de stappen zelf: alleen een rustige tekstknop, zodat de stap bovenaan staat.
  if (aan)
    return (
      <button
        type="button"
        onClick={() => onWissel(false)}
        className="inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary underline underline-offset-4"
      >
        <Rows3 className="size-5" aria-hidden />
        Alles op één scherm
      </button>
    );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-secondary p-3">
      <p className="min-w-[min(100%,14rem)] flex-1 text-base">
        {aan
          ? "Je vult je recept stap voor stap in."
          : "Liever rustig, één ding tegelijk? Vul je recept stap voor stap in."}
      </p>
      <Button
        type="button"
        variant="outline"
        aria-pressed={aan}
        onClick={() => onWissel(!aan)}
        className="h-auto min-h-14 max-w-full text-base whitespace-normal"
      >
        {aan ? (
          <Rows3 className="size-5" aria-hidden />
        ) : (
          <ListOrdered className="size-5" aria-hidden />
        )}
        {aan ? "Alles op één scherm" : "Stap voor stap"}
      </Button>
    </div>
  );
}

/** "Stap 2 van 4: Ingrediënten" met een voortgangsbalk. De kop krijgt de focus bij elke stap. */
export function StappenKop({ stap }: { stap: ReceptStap }) {
  const kop = useRef<HTMLHeadingElement>(null);
  const eerste = useRef(true);
  useEffect(() => {
    // Niet bij het openen van het scherm, wel bij elke volgende/vorige stap (schermlezers).
    if (eerste.current) {
      eerste.current = false;
      return;
    }
    kop.current?.focus();
  }, [stap]);
  return (
    <div>
      <h2
        ref={kop}
        tabIndex={-1}
        className="text-sectietitel outline-none"
        data-testid="stap-voortgang"
      >
        {voortgangTekst(stap)}
      </h2>
      <ol className="mt-2 grid grid-cols-4 gap-1.5" aria-label="Voortgang">
        {RECEPT_STAPPEN.map((s) => (
          <li
            key={s.nr}
            aria-current={s.nr === stap ? "step" : undefined}
            className={s.nr <= stap ? "h-2 rounded-full bg-primary" : "h-2 rounded-full bg-border"}
          >
            <span className="sr-only">
              {s.titel}
              {s.nr < stap ? " (klaar)" : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Samenvatting voor stap 4. */
export function StappenControle({
  titel,
  heeftFoto,
  ingredienten,
  stappen,
  onNaarStap,
}: {
  titel: string;
  heeftFoto: boolean;
  ingredienten: string[];
  stappen: string[];
  onNaarStap: (s: ReceptStap) => void;
}) {
  const rij = (nr: ReceptStap, label: string, inhoud: string, ok: boolean) => (
    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-border py-3 last:border-0">
      <span className="min-w-[min(100%,12rem)] flex-1">
        <span className="block text-base font-semibold">
          {ok ? "✓" : "○"} {label}
        </span>
        <span className="block text-base break-words text-muted-foreground">{inhoud}</span>
      </span>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onNaarStap(nr)}
        aria-label={`${label} aanpassen`}
        className="h-12 shrink-0 text-base"
      >
        Aanpassen
      </Button>
    </li>
  );
  return (
    <ul className="rounded-2xl border border-border bg-card px-4" data-testid="stap-controle">
      {rij(1, "Naam", titel.trim() || "Nog geen naam", !!titel.trim())}
      {rij(1, "Foto", heeftFoto ? "Foto gekozen" : "Nog geen foto (mag ook later)", heeftFoto)}
      {rij(
        2,
        "Ingrediënten",
        ingredienten.length
          ? `${ingredienten.length} ${ingredienten.length === 1 ? "ingrediënt" : "ingrediënten"}: ${ingredienten.slice(0, 4).join(", ")}${ingredienten.length > 4 ? " …" : ""}`
          : "Nog geen ingrediënten (mag ook later)",
        ingredienten.length > 0,
      )}
      {rij(
        3,
        "Bereiding",
        stappen.length
          ? `${stappen.length} ${stappen.length === 1 ? "stap" : "stappen"}`
          : "Nog geen stappen (mag ook later)",
        stappen.length > 0,
      )}
    </ul>
  );
}

/** Vorige / Volgende onderaan; op stap 4 wordt "Volgende" de bewaarknop. */
export function StappenNavigatie({
  stap,
  titel,
  bezig,
  bewaarLabel,
  onVorige,
  onVolgende,
  onBewaar,
}: {
  stap: ReceptStap;
  titel: string;
  bezig: boolean;
  bewaarLabel: string;
  onVorige: () => void;
  onVolgende: () => void;
  onBewaar: () => void;
}) {
  const ontbreekt = stap === AANTAL_STAPPEN ? ontbreektVoorBewaren({ titel }) : null;
  return (
    <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 -mx-1 rounded-2xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur md:bottom-4">
      {ontbreekt ? (
        <p role="alert" className="px-2 pb-2 text-base font-semibold text-destructive">
          {ontbreekt}
        </p>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onVorige}
          disabled={stap === 1}
          className="h-auto min-h-14 min-w-0 px-3 text-base whitespace-normal"
        >
          <ArrowLeft className="size-5" aria-hidden /> Vorige
        </Button>
        {stap < AANTAL_STAPPEN ? (
          <Button
            type="button"
            onClick={onVolgende}
            className="h-auto min-h-14 min-w-0 px-3 text-base whitespace-normal"
          >
            Volgende <ArrowRight className="size-5" aria-hidden />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onBewaar}
            disabled={bezig || !!ontbreekt}
            className="h-auto min-h-14 min-w-0 px-3 text-base whitespace-normal"
          >
            {bezig ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Check className="size-5" aria-hidden />
            )}
            {bewaarLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
