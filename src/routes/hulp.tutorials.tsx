import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ConceptBand } from "@/components/hulp/HulpDelen";
import { MODULES } from "@/lib/functies";
import { zichtbareArtikels } from "@/lib/hulp/artikels";
import {
  hoofdstukkenVtt,
  maakTutorial,
  naarScript,
  naarWebVtt,
  type Tutorial,
} from "@/lib/hulp/tutorials";

export const Route = createFileRoute("/hulp/tutorials")({
  head: () => ({ meta: [{ title: "Tutorials — Foodlo" }] }),
  component: Tutorials,
});

function download(naam: string, inhoud: string, type: string) {
  const url = URL.createObjectURL(new Blob([inhoud], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = naam;
  a.click();
  URL.revokeObjectURL(url);
}

function Kaart({ tut }: { tut: Tutorial }) {
  return (
    <li className="paneel space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 text-base font-bold [overflow-wrap:anywhere]">
          <Link
            to="/hulp/$slug"
            params={{ slug: tut.slug }}
            className="underline-offset-4 hover:underline"
          >
            {tut.titel}
          </Link>
        </h3>
        <span className="text-[0.95rem] text-muted-foreground">
          ± {Math.round(tut.duur)} s · {tut.scenes.length - 1} stappen
        </span>
      </div>
      <p className="text-[0.95rem] text-muted-foreground">
        Video: nog niet opgenomen · ondertitels klaar
      </p>
      <details>
        <summary className="min-h-11 cursor-pointer text-base font-semibold">Storyboard</summary>
        <ol className="mt-2 space-y-2 text-[0.95rem]">
          {tut.scenes.map((s) => (
            <li key={s.nummer}>
              <span className="font-semibold">Scene {s.nummer}</span> ({s.start.toFixed(1)}–
              {s.eind.toFixed(1)} s): {s.beeld}
            </li>
          ))}
        </ol>
      </details>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => download(`${tut.slug}.nl.vtt`, naarWebVtt(tut), "text/vtt")}
          className="min-h-11 rounded-full px-4 text-base font-semibold ring-1 ring-border hover:bg-muted"
        >
          Ondertitels (.vtt)
        </button>
        <button
          type="button"
          onClick={() => download(`${tut.slug}.hoofdstukken.vtt`, hoofdstukkenVtt(tut), "text/vtt")}
          className="min-h-11 rounded-full px-4 text-base font-semibold ring-1 ring-border hover:bg-muted"
        >
          Hoofdstukken
        </button>
        <button
          type="button"
          onClick={() => download(`${tut.slug}.script.md`, naarScript(tut), "text/markdown")}
          className="min-h-11 rounded-full px-4 text-base font-semibold ring-1 ring-border hover:bg-muted"
        >
          Script
        </button>
      </div>
    </li>
  );
}

function Tutorials() {
  const tuts = zichtbareArtikels()
    .map(maakTutorial)
    .filter((t): t is Tutorial => !!t);
  return (
    <AppShell title="Tutorials" ondertitel="Korte uitleg per module, met ondertitels">
      <div className="space-y-7">
        <ConceptBand />
        <p className="text-base text-muted-foreground">
          Elke tutorial volgt de stappen uit de uitleg. Opnames worden gemaakt in de demo-app met
          verzonnen gegevens, zonder stem. Ondertitels en hoofdstukken zijn al beschikbaar.
        </p>
        {MODULES.map((m) => {
          const lijst = tuts.filter((t) => t.module === m.id);
          if (!lijst.length) return null;
          return (
            <section key={m.id} aria-labelledby={`tut-${m.id}`} className="space-y-3">
              <h2 id={`tut-${m.id}`} className="text-sectietitel">
                {m.titel}
              </h2>
              <ul className="space-y-3">
                {lijst.map((t) => (
                  <Kaart key={t.slug} tut={t} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
