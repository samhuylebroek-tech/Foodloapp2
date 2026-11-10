import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, Shuffle, Clock3, X, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { normaliseerTekst } from "@/lib/zoeken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  haalInspiratieLijst,
  filterInspiratie,
  inspiratieCategorieen,
  LEGE_FILTERS, EETSTIJLEN,
  type InspiratieFilters,
  type InspiratieRecept,
} from "@/lib/inspiratie";
import { useSignedUrl } from "@/lib/photos";
import { themas as maakThemas, type Thema } from "@/lib/themas";
import { ThemaRij } from "@/components/ontdek/ThemaRij";
import { OntdekLeeg } from "@/components/ontdek/OntdekLeeg";
import { soortLabel } from "@/lib/recept-keuzes";

export const Route = createFileRoute("/inspiratie/")({
  head: () => ({
    meta: [
      { title: "Inspiratie – Foodlo" },
      {
        name: "description",
        content:
          "Ontdek recepten die Foodlo al kent. Zoek, filter en voeg met één tik toe aan je eigen recepten — zonder extra kosten.",
      },
      { property: "og:title", content: "Inspiratie – Foodlo" },
      {
        property: "og:description",
        content: "Blader door de Foodlo-receptenbibliotheek en voeg toe aan je eigen recepten.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InspiratiePage,
});

function tijdLabel(r: { prep_minutes: number; cook_minutes: number }): string {
  const totaal = r.prep_minutes + r.cook_minutes;
  return totaal > 0 ? `${totaal} min` : "";
}

/** Foto met nette terugval als de afbeelding ontbreekt of niet laadt. */
function ReceptFoto({ pad, titel }: { pad: string | null; titel: string }) {
  const url = useSignedUrl(pad);
  const [kapot, setKapot] = useState(false);
  if (!url || kapot) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-secondary text-3xl" aria-hidden>
        🍽️
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={titel}
      loading="lazy"
      onError={() => setKapot(true)}
      className="aspect-[4/3] w-full object-cover"
    />
  );
}

function InspiratiePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<InspiratieFilters>(LEGE_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: alleRecepten = [], isLoading, isError } = useQuery({
    queryKey: ["inspiratie"],
    queryFn: haalInspiratieLijst,
    staleTime: 5 * 60 * 1000,
  });

  // Eigen recepten: verberg het gekoppelde idee én oudere overeenkomsten op titel.
  const { data: eigenRecepten = [] } = useQuery({
    queryKey: ["eigen-recept-titels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("title, inspiration_id")
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });

  const recepten = useMemo(() => {
    if (!eigenRecepten.length) return alleRecepten;
    const eigenTitels = new Set(eigenRecepten.map((r) => normaliseerTekst(r.title)));
    const gekoppeldeIdeeen = new Set(eigenRecepten.map((r) => r.inspiration_id).filter(Boolean));
    return alleRecepten.filter((r) => !gekoppeldeIdeeen.has(r.id) && !eigenTitels.has(normaliseerTekst(r.title)));
  }, [alleRecepten, eigenRecepten]);

  const categorieen = useMemo(() => inspiratieCategorieen(recepten), [recepten]);
  // Fase 3: thema's (seizoen, snel, vegetarisch, weekend) als ingang; een thema werkt als filter.
  const themaLijst = useMemo(() => maakThemas(recepten), [recepten]);
  const [thema, setThema] = useState<Thema | null>(null);
  const resultaten = useMemo(() => {
    const gefilterd = filterInspiratie(recepten, filters);
    if (!thema) return gefilterd;
    const ids = new Set(thema.recepten.map((x) => x.id));
    return gefilterd.filter((x) => ids.has(x.id));
  }, [recepten, filters, thema]);

  const actieveFilters =
    (filters.categorie ? 1 : 0) +
    (filters.maxTijd !== null ? 1 : 0) +
    (filters.eetstijl ? 1 : 0);

  // Verras mij: toont steeds een nieuw, onbekend gerecht in een venster.
  // Al getoonde suggesties komen niet meteen terug; je blijft gewoon op dit scherm.
  const [verrassing, setVerrassing] = useState<InspiratieRecept | null>(null);
  const [getoond, setGetoond] = useState<string[]>([]);

  function kiesVerrassing() {
    if (!resultaten.length) return;
    const vers = resultaten.filter((r) => !getoond.includes(r.id));
    const pool = vers.length ? vers : resultaten;
    const keuze = pool[Math.floor(Math.random() * pool.length)];
    if (!keuze) return;
    setVerrassing(keuze);
    setGetoond((g) => (vers.length ? [...g, keuze.id] : [keuze.id]));
  }

  return (
    <AppShell
      title="Ontdek"
      ondertitel="Ideeën om te koken"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.zoek}
            onChange={(e) => setFilters((f) => ({ ...f, zoek: e.target.value }))}
            placeholder="Waar heb je zin in?"
            aria-label="Zoeken in inspiratie"
            className="h-14 pl-12 text-base"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            variant={actieveFilters ? "default" : "outline"}
            onClick={() => setFilterOpen(true)}
            className="h-12 shrink-0 px-5 text-base"
          >
            <SlidersHorizontal className="size-4" />
            Filters{actieveFilters ? ` (${actieveFilters})` : ""}
          </Button>
          <Button
            variant="outline"
            onClick={() => setFilters((f) => ({ ...f, maxTijd: f.maxTijd === 30 ? null : 30 }))}
            aria-pressed={filters.maxTijd === 30}
            className="h-12 shrink-0 px-5 text-base"
          >
            ≤ 30 min
          </Button>
          <Button variant="outline" onClick={kiesVerrassing} disabled={!resultaten.length} className="h-12 shrink-0 px-5 text-base">
            <Shuffle className="size-4" /> Verras mij
          </Button>
        </div>

        {thema ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-base text-muted-foreground">Thema</p>
              <h2 className="text-sectietitel">{thema.titel}</h2>
            </div>
            <Button variant="outline" onClick={() => setThema(null)} className="shrink-0">
              <X /> Alle ideeën
            </Button>
          </div>
        ) : !isLoading && !isError && !actieveFilters && !filters.zoek && recepten.length ? (
          <ThemaRij themas={themaLijst} onKies={setThema} />
        ) : null}

        {!isLoading && !isError && !recepten.length ? (
          <OntdekLeeg />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3" aria-label="Laden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-[1.25rem] bg-muted" />
            ))}
          </div>
        ) : isError ? (
          <p className="paneel p-4 text-center text-muted-foreground">
            De inspiratie kon niet geladen worden. Probeer het straks opnieuw.
          </p>
        ) : !resultaten.length ? (
          <div className="paneel p-6 text-center">
            <p className="text-lg font-semibold">Geen recepten gevonden</p>
            <p className="mt-1 text-muted-foreground">
              We vinden momenteel geen gerecht met deze combinatie. Probeer bijvoorbeeld pasta, kip
              of vegetarisch.
            </p>
            <Button variant="outline" onClick={() => setFilters(LEGE_FILTERS)} className="mt-4 h-14 px-6 text-base">
              Filters wissen
            </Button>
          </div>
        ) : (
          <ul
            className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
            aria-label={thema ? thema.titel : "Alle ideeën"}
          >
            {resultaten.map((r) => (
              <li key={r.id}>
                <Link
                  to="/inspiratie/$id"
                  params={{ id: r.id }}
                  className="paneel block overflow-hidden transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:shadow-md"
                >
                  <ReceptFoto pad={r.image_url} titel={r.title} />
                  <div className="space-y-1 p-3">
                    <p className="text-base font-semibold leading-tight">{r.title}</p>
                    {/* Bron: later de food creator (naam en profiel), nu de Foodlo-keuken. */}
                    <p className="text-[0.9rem] text-muted-foreground">Foodlo-keuken</p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-muted-foreground">
                      {r.category ? <span>{soortLabel(r.category)}</span> : null}
                      {tijdLabel(r) ? (
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Clock3 className="size-3" /> {tijdLabel(r)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!verrassing} onOpenChange={(open) => !open && setVerrassing(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          {verrassing ? (
            <div>
              <ReceptFoto pad={verrassing.image_url} titel={verrassing.title} />
              <div className="space-y-4 p-5">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl leading-snug">{verrassing.title}</DialogTitle>
                </DialogHeader>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted-foreground">
                  {verrassing.category ? <span>{soortLabel(verrassing.category)}</span> : null}
                  {tijdLabel(verrassing) ? (
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Clock3 className="size-4" /> {tijdLabel(verrassing)}
                    </span>
                  ) : null}
                </p>
                <div className="grid gap-2">
                  <Button
                    className="h-14 text-base"
                    onClick={() => {
                      const id = verrassing.id;
                      setVerrassing(null);
                      navigate({ to: "/inspiratie/$id", params: { id } });
                    }}
                  >
                    Bekijk dit gerecht
                  </Button>
                  <Button variant="outline" className="h-14 text-base" onClick={kiesVerrassing}>
                    <Shuffle className="size-4" /> Nog een suggestie
                  </Button>
                  <Button variant="ghost" className="h-12 text-base" onClick={() => setVerrassing(null)}>
                    Sluiten
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-4 pb-3 pt-4 text-left">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            <div>
              <p className="mb-2 text-base font-semibold">Soort gerecht</p>
              <div className="flex flex-wrap gap-2">
                {categorieen.map((c) => (
                  <Button
                    key={c}
                    variant={filters.categorie === c ? "default" : "outline"}
                    onClick={() => setFilters((f) => ({ ...f, categorie: f.categorie === c ? "" : c }))}
                    aria-pressed={filters.categorie === c}
                    className="h-12 px-4 text-base"
                  >
                    {soortLabel(c)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-base font-semibold">Bereidingstijd</p>
              <div className="flex flex-wrap gap-2">
                {[15, 30, 45, 60].map((min) => (
                  <Button
                    key={min}
                    variant={filters.maxTijd === min ? "default" : "outline"}
                    onClick={() => setFilters((f) => ({ ...f, maxTijd: f.maxTijd === min ? null : min }))}
                    aria-pressed={filters.maxTijd === min}
                    className="h-12 px-4 text-base"
                  >
                    ≤ {min} min
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-base font-semibold">Eetstijl</p>
              <div className="flex flex-wrap gap-2">
                {EETSTIJLEN.map((e) => (
                  <Button
                    key={e.waarde}
                    variant={filters.eetstijl === e.waarde ? "default" : "outline"}
                    onClick={() => setFilters((f) => ({ ...f, eetstijl: f.eetstijl === e.waarde ? "" : e.waarde }))}
                    aria-pressed={filters.eetstijl === e.waarde}
                    className="h-12 px-4 text-base"
                  >
                    {e.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-2 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button className="h-14 text-base" onClick={() => setFilterOpen(false)}>
              Toon {resultaten.length} {resultaten.length === 1 ? "recept" : "recepten"}
            </Button>
            <Button
              variant="ghost"
              className="h-12 text-base"
              onClick={() => setFilters((f) => ({ ...LEGE_FILTERS, zoek: f.zoek }))}
            >
              <X className="size-4" /> Filters wissen
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
