/**
 * Fase 3 — je eigen verzameling beheren: volgorde (pijlknoppen, slepen of Alt + pijltjes),
 * recept eruit (met ongedaan maken), delen (link; alleen als ze openbaar is) en inplannen via
 * de assistent (nakijken, veiligheidscontrole, "Doe maar", ongedaan maken).
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, CalendarPlus, GripVertical, Link2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { RecipePhoto } from "@/components/RecipePhoto";
import { AllergieLabel, MakerBron, useAllergieOordelen } from "@/components/makers/MakerOnderdelen";
import { Button } from "@/components/ui/button";
import { appOrigin } from "@/lib/app-url";
import type { Maker } from "@/lib/makers";
import { gewijzigdePosities, herschik, verzamelingLink } from "@/lib/collecties";
import {
  haalUitVerzameling,
  zetInVerzameling,
  zetVolgorde,
  type ReceptKaart,
  type Verzameling,
} from "@/lib/makers-db";

export function VerzamelingBeheer({
  v,
  recepten,
  bron,
}: {
  v: Verzameling;
  recepten: ReceptKaart[];
  /** Bronvermelding voor recepten van makers (zoals in het raster). */
  bron?: (r: ReceptKaart) => Pick<Maker, "naam" | "handle"> | null | undefined;
}) {
  const oordeelVan = useAllergieOordelen(recepten);
  const qc = useQueryClient();
  const [volgorde, setVolgorde] = useState<string[] | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [melding, setMelding] = useState("");
  const perId = new Map(recepten.map((r) => [r.id, r]));
  const ids = (volgorde ?? recepten.map((r) => r.id)).filter((id) => perId.has(id));

  const ververs = async () => {
    await qc.invalidateQueries({ queryKey: ["verzameling", v.id] });
    await qc.invalidateQueries({ queryKey: ["verzamelingen"] });
  };

  async function verplaats(van: number, naar: number) {
    if (naar < 0 || naar >= ids.length || van === naar) return;
    const nieuw = herschik(ids, van, naar);
    setVolgorde(nieuw);
    const titel = perId.get(ids[van]!)?.title ?? "";
    setMelding(`${titel}: plaats ${naar + 1} van ${ids.length}`);
    try {
      await zetVolgorde(v.id, gewijzigdePosities(v.collection_recipes ?? [], nieuw));
      await ververs();
    } catch {
      setVolgorde(ids);
      toast.error("De nieuwe volgorde bewaren lukte niet.");
    }
  }

  async function haalUit(r: ReceptKaart) {
    const rij = (v.collection_recipes ?? []).find((x) => x.recipe_id === r.id);
    try {
      await haalUitVerzameling(v.id, r.id);
      setVolgorde(ids.filter((x) => x !== r.id));
      await ververs();
      toast.success(`${r.title} uit "${v.naam}". Het recept zelf blijft.`, {
        action: {
          label: "Ongedaan maken",
          onClick: () =>
            void zetInVerzameling(v.id, r.id, rij?.positie ?? 0).then(async () => {
              setVolgorde(null);
              await ververs();
            }),
        },
      });
    } catch {
      toast.error("Dat lukte niet. De verzameling blijft zoals ze was.");
    }
  }

  async function deel() {
    const url = verzamelingLink(appOrigin(), v.id);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: v.naam, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link gekopieerd");
    } catch {
      toast(`De link: ${url}`);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {ids.length ? (
          <Button asChild className="h-14 px-5 text-base">
            <Link to="/assistent" search={{ verzameling: v.id }}>
              <CalendarPlus aria-hidden />
              Inplannen in mijn week
            </Link>
          </Button>
        ) : null}
        {v.openbaar ? (
          <Button variant="outline" className="h-14 px-4 text-base" onClick={() => void deel()}>
            <Link2 aria-hidden />
            Deel link
          </Button>
        ) : null}
      </div>
      {!v.openbaar ? (
        <p className="flex items-start gap-2 rounded-2xl bg-muted px-4 py-3 text-base">
          <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            Privé: alleen jij ziet deze verzameling. Wil je ze delen? Zet "Tonen op mijn
            makerpagina" aan; dan is ze met een link te openen (alleen openbare recepten).
          </span>
        </p>
      ) : null}

      {ids.length ? (
        <section aria-labelledby="volgorde-titel">
          <h2 id="volgorde-titel" className="text-sectietitel">
            Volgorde
          </h2>
          <p id="volgorde-uitleg" className="mt-1 text-base text-muted-foreground">
            Gebruik de pijlen, sleep een recept, of kies een recept en druk Alt + pijltje.
          </p>
          <p className="sr-only" aria-live="polite">
            {melding}
          </p>
          <ol
            aria-label={`Recepten in ${v.naam}`}
            aria-describedby="volgorde-uitleg"
            className="mt-3 divide-y divide-border rounded-2xl bg-card shadow-zacht"
          >
            {ids.map((id, i) => {
              const r = perId.get(id)!;
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={(e) => {
                    setSleep(i);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (sleep !== null) void verplaats(sleep, i);
                    setSleep(null);
                  }}
                  onDragEnd={() => setSleep(null)}
                  onKeyDown={(e) => {
                    if (!e.altKey) return;
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      void verplaats(i, i - 1);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      void verplaats(i, i + 1);
                    }
                  }}
                  data-recept={id}
                  className="flex min-h-[4.5rem] flex-wrap items-center gap-x-3 gap-y-2 py-2 pl-2 pr-2"
                >
                  <GripVertical
                    className="size-5 shrink-0 cursor-grab text-muted-foreground"
                    aria-hidden
                  />
                  <span className="w-7 shrink-0 text-center text-base font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <Link
                    to="/recepten/$id"
                    params={{ id }}
                    className="flex min-h-12 min-w-0 flex-1 basis-40 items-center gap-3"
                  >
                    <RecipePhoto
                      path={r.image_url}
                      alt=""
                      recept={r}
                      className="size-12 shrink-0 rounded-xl"
                      icoonClassName="size-6"
                    />
                    <span className="min-w-0">
                      <span className="block break-words text-lg font-semibold leading-snug">
                        {r.title}
                      </span>
                      <AllergieLabel oordeel={oordeelVan(r)} />
                    </span>
                  </Link>
                  {bron?.(r) ? (
                    <span className="w-full pl-[4.5rem]">
                      <MakerBron maker={bron(r)!} className="text-[0.95rem]" />
                    </span>
                  ) : null}
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void verplaats(i, i - 1)}
                      disabled={i === 0}
                      aria-label={`${r.title} naar boven`}
                      className="flex size-12 items-center justify-center rounded-full hover:bg-muted disabled:opacity-35"
                    >
                      <ArrowUp className="size-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void verplaats(i, i + 1)}
                      disabled={i === ids.length - 1}
                      aria-label={`${r.title} naar beneden`}
                      className="flex size-12 items-center justify-center rounded-full hover:bg-muted disabled:opacity-35"
                    >
                      <ArrowDown className="size-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void haalUit(r)}
                      aria-label={`${r.title} uit de verzameling`}
                      className="flex size-12 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <X className="size-5" aria-hidden />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
