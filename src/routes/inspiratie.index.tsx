import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, Shuffle, Clock3, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  haalInspiratieLijst,
  filterInspiratie,
  inspiratieCategorieen,
  verrasMij,
  LEGE_FILTERS,
  type InspiratieFilters,
} from "@/lib/inspiratie";
import { useSignedUrl } from "@/lib/photos";

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

  const { data: recepten = [], isLoading, isError } = useQuery({
    queryKey: ["inspiratie"],
    queryFn: haalInspiratieLijst,
    staleTime: 5 * 60 * 1000,
  });

  const categorieen = useMemo(() => inspiratieCategorieen(recepten), [recepten]);
  const resultaten = useMemo(() => filterInspiratie(recepten, filters), [recepten, filters]);

  const actieveFilters =
    (filters.categorie ? 1 : 0) +
    (filters.maxTijd !== null ? 1 : 0) +
    (filters.alleenVegatarisch ? 1 : 0) +
    (filters.alleenVegan ? 1 : 0);

  function verras() {
    const keuze = verrasMij(resultaten);
    if (keuze) navigate({ to: "/inspiratie/$id", params: { id: keuze.id } });
  }

  return (
    <AppShell title="Ideeën om te koken">
      <div className="space-y-4">
        <div>
          <p className="text-muted-foreground">
            Ontdek recepten die Foodlo al kent en voeg ze met één tik toe aan je eigen recepten.
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.zoek}
            onChange={(e) => setFilters((f) => ({ ...f, zoek: e.target.value }))}
            placeholder="Waar heb je zin in?"
            aria-label="Zoeken in inspiratie"
            className="h-14 rounded-xl pl-12 text-base"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            variant={actieveFilters ? "default" : "outline"}
            onClick={() => setFilterOpen(true)}
            className="h-12 shrink-0 rounded-full px-5 text-sm"
          >
            <SlidersHorizontal className="size-4" />
            Filters{actieveFilters ? ` (${actieveFilters})` : ""}
          </Button>
          <Button
            variant="outline"
            onClick={() => setFilters((f) => ({ ...f, maxTijd: f.maxTijd === 30 ? null : 30 }))}
            aria-pressed={filters.maxTijd === 30}
            className="h-12 shrink-0 rounded-full px-5 text-sm"
          >
            ≤ 30 min
          </Button>
          <Button
            variant="outline"
            onClick={() => setFilters((f) => ({ ...f, alleenVegatarisch: !f.alleenVegatarisch, alleenVegan: false }))}
            aria-pressed={filters.alleenVegatarisch}
            className="h-12 shrink-0 rounded-full px-5 text-sm"
          >
            Vegetarisch
          </Button>
          <Button
            variant="outline"
            onClick={() => setFilters((f) => ({ ...f, alleenVegan: !f.alleenVegan, alleenVegatarisch: false }))}
            aria-pressed={filters.alleenVegan}
            className="h-12 shrink-0 rounded-full px-5 text-sm"
          >
            Vegan
          </Button>
          <Button variant="outline" onClick={verras} disabled={!resultaten.length} className="h-12 shrink-0 rounded-full px-5 text-sm">
            <Shuffle className="size-4" /> Verras mij
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3" aria-label="Laden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : isError ? (
          <p className="rounded-xl border border-border bg-card p-4 text-center text-muted-foreground">
            De inspiratie kon niet geladen worden. Probeer het straks opnieuw.
          </p>
        ) : !resultaten.length ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
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
          <ul className="grid grid-cols-2 gap-3">
            {resultaten.map((r) => (
              <li key={r.id}>
                <Link
                  to="/inspiratie/$id"
                  params={{ id: r.id }}
                  className="block overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:shadow-md"
                >
                  <ReceptFoto pad={r.image_url} titel={r.title} />
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-2 text-base font-semibold leading-tight">{r.title}</p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      {r.category ? <span className="capitalize">{r.category}</span> : null}
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

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-4 pb-3 pt-4 text-left">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            <div>
              <p className="mb-2 text-sm font-semibold">Soort gerecht</p>
              <div className="flex flex-wrap gap-2">
                {categorieen.map((c) => (
                  <Button
                    key={c}
                    variant={filters.categorie === c ? "default" : "outline"}
                    onClick={() => setFilters((f) => ({ ...f, categorie: f.categorie === c ? "" : c }))}
                    aria-pressed={filters.categorie === c}
                    className="h-12 rounded-full px-4 text-sm capitalize"
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Bereidingstijd</p>
              <div className="flex flex-wrap gap-2">
                {[15, 30, 45, 60].map((min) => (
                  <Button
                    key={min}
                    variant={filters.maxTijd === min ? "default" : "outline"}
                    onClick={() => setFilters((f) => ({ ...f, maxTijd: f.maxTijd === min ? null : min }))}
                    aria-pressed={filters.maxTijd === min}
                    className="h-12 rounded-full px-4 text-sm"
                  >
                    ≤ {min} min
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Eetstijl</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filters.alleenVegatarisch ? "default" : "outline"}
                  onClick={() => setFilters((f) => ({ ...f, alleenVegatarisch: !f.alleenVegatarisch, alleenVegan: false }))}
                  aria-pressed={filters.alleenVegatarisch}
                  className="h-12 rounded-full px-4 text-sm"
                >
                  Vegetarisch
                </Button>
                <Button
                  variant={filters.alleenVegan ? "default" : "outline"}
                  onClick={() => setFilters((f) => ({ ...f, alleenVegan: !f.alleenVegan, alleenVegatarisch: false }))}
                  aria-pressed={filters.alleenVegan}
                  className="h-12 rounded-full px-4 text-sm"
                >
                  Vegan
                </Button>
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
