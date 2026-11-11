import { createFileRoute, Link } from "@tanstack/react-router";
import { useId, useMemo, useState } from "react";
import {
  BookOpen,
  CircleHelp,
  Compass,
  Film,
  ListChecks,
  MessageSquareHeart,
  Search,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Groep, LinkRij } from "@/components/mobiel/Lijst";
import { ConceptBand, DoeHetNu, Stappen } from "@/components/hulp/HulpDelen";
import { Input } from "@/components/ui/input";
import { MODULES, type ModuleId } from "@/lib/functies";
import { zichtbareArtikels } from "@/lib/hulp/artikels";
import { beantwoord, zoekHulp } from "@/lib/hulp/zoeken";

export const Route = createFileRoute("/hulp/")({
  validateSearch: (s: Record<string, unknown>): { module?: ModuleId } => {
    const m = typeof s["module"] === "string" ? s["module"] : undefined;
    return MODULES.some((x) => x.id === m) ? { module: m as ModuleId } : {};
  },
  head: () => ({ meta: [{ title: "Hulp — Foodlo" }] }),
  component: HulpCentrum,
});

function HulpCentrum() {
  const { module } = Route.useSearch();
  const artikels = useMemo(() => zichtbareArtikels(), []);
  const [vraag, setVraag] = useState("");
  const [gesteld, setGesteld] = useState("");
  const veldId = useId();
  const antwoord = gesteld ? beantwoord(gesteld, artikels) : null;
  const resultaten = vraag.trim().length >= 2 ? zoekHulp(vraag, artikels).slice(0, 6) : [];
  const huidig = module ? MODULES.find((m) => m.id === module) : undefined;

  const perModule = MODULES.map((m) => ({
    ...m,
    artikels: artikels.filter((a) => a.module === m.id && a.soort === "handleiding"),
  })).filter((m) => m.artikels.length);
  const vragen = artikels.filter((a) => a.soort === "vraag");
  const problemen = artikels.filter((a) => a.soort === "probleem");

  return (
    <AppShell title="Hulp" ondertitel="Uitleg, tutorials en antwoorden op je vragen">
      <div className="space-y-7">
        <ConceptBand />

        <section aria-labelledby={`${veldId}-kop`} className="paneel space-y-3 p-5">
          <h2 id={`${veldId}-kop`} className="text-kaarttitel">
            Vraag het Foodlo
          </h2>
          <form
            role="search"
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setGesteld(vraag);
            }}
          >
            <label htmlFor={veldId} className="sr-only">
              Zoek of stel je vraag
            </label>
            <Input
              id={veldId}
              value={vraag}
              onChange={(e) => setVraag(e.target.value)}
              placeholder="Bijvoorbeeld: hoe deel ik mijn lijst?"
              className="h-12 min-w-0 flex-1 basis-48 text-base"
              autoComplete="off"
              enterKeyHint="search"
            />
            <button
              type="submit"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Search className="size-5" aria-hidden />
              Vraag
            </button>
          </form>
          <p className="text-[0.95rem] text-muted-foreground">
            Antwoorden komen altijd uit de uitleg hieronder. Staat het er niet in, dan zeggen we dat
            eerlijk.
          </p>

          <div aria-live="polite">
            {antwoord?.soort === "antwoord" ? (
              <div data-antwoord className="mt-2 space-y-3 rounded-2xl bg-secondary/60 p-4">
                <p className="text-base font-semibold">
                  Uit:{" "}
                  <Link
                    to="/hulp/$slug"
                    params={{ slug: antwoord.bron.slug }}
                    className="underline underline-offset-4"
                  >
                    {antwoord.bron.titel}
                  </Link>
                </p>
                <Stappen stappen={antwoord.stappen} />
                <DoeHetNu artikel={antwoord.bron} />
                {antwoord.meer.length ? (
                  <p className="text-base text-muted-foreground">
                    Ook nuttig:{" "}
                    {antwoord.meer.map((a, i) => (
                      <span key={a.slug}>
                        {i ? ", " : ""}
                        <Link
                          to="/hulp/$slug"
                          params={{ slug: a.slug }}
                          className="underline underline-offset-4"
                        >
                          {a.titel}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            ) : null}
            {antwoord?.soort === "onzeker" ? (
              <div data-antwoord className="mt-2 space-y-2 rounded-2xl bg-muted p-4">
                <p className="text-base font-semibold">
                  Ik weet niet zeker wat je bedoelt. Is het een van deze?
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {antwoord.suggesties.map((a) => (
                    <li key={a.slug}>
                      <Link
                        to="/hulp/$slug"
                        params={{ slug: a.slug }}
                        className="text-base underline underline-offset-4"
                      >
                        {a.titel}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {antwoord?.soort === "geen" ? (
              <div data-antwoord className="mt-2 space-y-2 rounded-2xl bg-muted p-4">
                <p className="text-base font-semibold">Daar heb ik nog geen uitleg over.</p>
                <p className="text-base text-muted-foreground">
                  Ik verzin liever niets. Stel je vraag aan support, dan helpen we je verder.
                </p>
                <Link
                  to="/feedback"
                  className="inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4"
                >
                  Vraag het aan support
                </Link>
              </div>
            ) : null}
          </div>

          {resultaten.length && !gesteld ? (
            <ul
              aria-label="Zoekresultaten"
              className="divide-y divide-border/80 overflow-hidden rounded-2xl ring-1 ring-border"
            >
              {resultaten.map(({ artikel: a }) => (
                <li key={a.slug}>
                  <Link
                    to="/hulp/$slug"
                    params={{ slug: a.slug }}
                    className="flex min-h-12 items-center px-4 py-2 text-base hover:bg-muted"
                  >
                    {a.titel}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {huidig ? (
          <Groep titel={`Hulp bij dit scherm: ${huidig.titel}`}>
            {artikels
              .filter((a) => a.module === huidig.id)
              .map((a) => (
                <LinkRij
                  key={a.slug}
                  to="/hulp/$slug"
                  params={{ slug: a.slug }}
                  icoon={BookOpen}
                  titel={a.titel}
                />
              ))}
          </Groep>
        ) : null}

        <Groep titel="Aan de slag">
          <LinkRij
            to="/eerste-stappen"
            icoon={ListChecks}
            tint="groen"
            titel="Eerste stappen"
            uitleg="Zes korte oefeningen in de echte app"
          />
          <LinkRij
            to="/rondleiding"
            icoon={Compass}
            tint="groen"
            titel="Rondleiding"
            uitleg="Een korte toer langs alle schermen"
          />
          <LinkRij
            to="/hulp/tutorials"
            icoon={Film}
            tint="honing"
            titel="Tutorials"
            uitleg="Korte uitleg per module, met ondertitels"
          />
        </Groep>

        {perModule.map((m) => (
          <Groep key={m.id} titel={m.titel}>
            {m.artikels.map((a) => (
              <LinkRij
                key={a.slug}
                to="/hulp/$slug"
                params={{ slug: a.slug }}
                icoon={BookOpen}
                titel={a.titel}
              />
            ))}
          </Groep>
        ))}

        <Groep titel="Veelgestelde vragen">
          {vragen.map((a) => (
            <LinkRij
              key={a.slug}
              to="/hulp/$slug"
              params={{ slug: a.slug }}
              icoon={CircleHelp}
              tint="blauw"
              titel={a.titel}
            />
          ))}
        </Groep>

        <Groep titel="Problemen oplossen">
          {problemen.map((a) => (
            <LinkRij
              key={a.slug}
              to="/hulp/$slug"
              params={{ slug: a.slug }}
              icoon={Wrench}
              tint="terracotta"
              titel={a.titel}
            />
          ))}
        </Groep>

        <Groep titel="Nog vragen?">
          <LinkRij
            to="/feedback"
            icoon={MessageSquareHeart}
            tint="terracotta"
            titel="Contact met support"
            uitleg="Stel je vraag of meld een probleem"
          />
        </Groep>

        {artikels.length === 0 ? (
          <p className="text-base text-muted-foreground">
            De uitleg wordt nog nagelezen. Heb je een vraag? Neem contact op met support.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
