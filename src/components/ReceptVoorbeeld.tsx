/**
 * Voorbeeldweergave in de recepteditor (ronde 3, FR-RI-05): zo ziet je recept eruit vóór je
 * bewaart. Alleen weergave, niets wordt bewaard. Zelfde omslag als de receptpagina (foto of
 * ontworpen omslag), zelfde Belgische maten.
 */
import { Clock3, Users } from "lucide-react";
import { RecipePhoto } from "@/components/RecipePhoto";
import { toonBelgischeMaat } from "@/lib/ingredienten";

export type VoorbeeldIngredient = { name: string; quantity: number | null; unit?: string | null };

export function ReceptVoorbeeld({
  titel,
  omschrijving,
  fotoPad,
  soort,
  minuten,
  personen,
  ingredienten,
  stappen,
}: {
  titel: string;
  omschrijving?: string;
  fotoPad: string | null;
  soort: string;
  minuten: number;
  personen: number | null;
  ingredienten: VoorbeeldIngredient[];
  stappen: string[];
}) {
  return (
    <article
      aria-label="Voorbeeld van je recept"
      className="space-y-4"
      data-testid="recept-voorbeeld"
    >
      <RecipePhoto
        path={fotoPad}
        alt={titel}
        recept={{ title: titel, category: soort }}
        opschrift
        className="aspect-[4/3] w-full rounded-2xl"
      />
      <h3 className="text-heldentitel break-words">{titel || "Naamloos recept"}</h3>
      {omschrijving ? <p className="text-lg text-muted-foreground">{omschrijving}</p> : null}
      <p className="flex flex-wrap gap-2 text-base">
        {minuten > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
            <Clock3 className="size-4" aria-hidden /> {minuten} min
          </span>
        ) : null}
        {personen ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1">
            <Users className="size-4" aria-hidden /> {personen}{" "}
            {personen === 1 ? "persoon" : "personen"}
          </span>
        ) : null}
      </p>
      <section aria-label="Ingrediënten" className="paneel p-4">
        <h4 className="font-display text-xl">Ingrediënten</h4>
        {ingredienten.length ? (
          <ul className="mt-2 divide-y divide-border/70">
            {ingredienten.map((i, n) => (
              <li key={n} className="flex justify-between gap-3 py-2 text-base">
                <span className="min-w-0 break-words">{i.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {toonBelgischeMaat(i.quantity, i.unit)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-base text-muted-foreground">Nog geen ingrediënten.</p>
        )}
      </section>
      <section aria-label="Bereiding">
        <h4 className="font-display text-xl">Bereiding</h4>
        {stappen.length ? (
          <ol className="mt-2 space-y-2">
            {stappen.map((stap, n) => (
              <li key={n} className="flex gap-3 rounded-2xl bg-card p-3 text-base">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-inkt font-bold text-inkt-foreground"
                >
                  {n + 1}
                </span>
                <span className="min-w-0 break-words">{stap}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-base text-muted-foreground">Nog geen stappen.</p>
        )}
      </section>
    </article>
  );
}
