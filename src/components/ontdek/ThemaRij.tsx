/**
 * Fase 3 — Ontdek: thema's als grote, tikbare kaarten met echte receptfoto's (collage).
 * Horizontaal scrollend op de telefoon, raster vanaf tablet.
 */
import { CollectieOmslag } from "@/components/ontdek/CollectieOmslag";
import type { Thema } from "@/lib/themas";

export function ThemaRij({ themas, onKies }: { themas: Thema[]; onKies: (t: Thema) => void }) {
  if (!themas.length) return null;
  return (
    <section aria-labelledby="themas-titel">
      <h2 id="themas-titel" className="text-sectietitel">
        Thema's
      </h2>
      <ul className="scroll-rij -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-4">
        {themas.map((t) => (
          <li key={t.id} className="w-64 shrink-0 md:w-auto">
            <button
              type="button"
              onClick={() => onKies(t)}
              className="group block w-full overflow-hidden rounded-[1.5rem] bg-card text-left shadow-zacht ring-1 ring-border/60 transition-shadow hover:shadow-kaart"
            >
              <CollectieOmslag
                titel={t.titel}
                recepten={t.recepten}
                className="aspect-[16/10] w-full transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <span className="block p-4">
                <span className="block text-kaarttitel">{t.titel}</span>
                <span className="mt-0.5 block text-base text-muted-foreground">{t.uitleg}</span>
                <span className="mt-1 block text-base font-semibold text-primary">
                  {t.recepten.length} {t.recepten.length === 1 ? "gerecht" : "gerechten"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
