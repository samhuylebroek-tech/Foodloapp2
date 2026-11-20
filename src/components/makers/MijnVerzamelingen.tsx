/**
 * Rij "Mijn verzamelingen" in Keuken › Recepten, met "Nieuwe verzameling" (fase 3: ook als je
 * er nog geen hebt).
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { CollectieOmslag } from "@/components/ontdek/CollectieOmslag";
import { haalRecepten, haalVerzamelingenVan, maakVerzameling } from "@/lib/makers-db";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";

export function MijnVerzamelingen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [maken, setMaken] = useState(false);
  const [naam, setNaam] = useState("");
  const [bezig, setBezig] = useState(false);
  const { beschikbaar } = useModuleBeschikbaar("collections");
  const { data: lijst = [] } = useQuery({
    queryKey: ["verzamelingen", user?.id],
    enabled: beschikbaar && !!user,
    queryFn: () => haalVerzamelingenVan(user!.id),
  });
  const ids = [
    ...new Set(lijst.flatMap((v) => (v.collection_recipes ?? []).map((r) => r.recipe_id))),
  ];
  const { data: recepten = [] } = useQuery({
    queryKey: ["verzameling-omslagen", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: () => haalRecepten(ids),
  });
  if (!beschikbaar || !user) return null;
  const perId = new Map(recepten.map((r) => [r.id, r]));

  async function maak() {
    const n = naam.trim();
    if (!user || !n || bezig) return;
    setBezig(true);
    try {
      const v = await maakVerzameling(user.id, n);
      await qc.invalidateQueries({ queryKey: ["verzamelingen"] });
      toast.success(`Verzameling "${v.naam}" gemaakt`);
      setNaam("");
      setMaken(false);
      void navigate({ to: "/verzamelingen/$id", params: { id: v.id } });
    } catch {
      toast.error("De verzameling kon niet gemaakt worden. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <section aria-labelledby="verzamelingen-titel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="verzamelingen-titel" className="text-sectietitel">
          Mijn verzamelingen
        </h2>
        {!maken ? (
          <Button variant="outline" className="h-12 px-4 text-base" onClick={() => setMaken(true)}>
            <FolderPlus aria-hidden />
            Nieuwe verzameling
          </Button>
        ) : null}
      </div>
      {maken ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void maak();
          }}
        >
          <div className="min-w-0 flex-1 basis-48">
            <label htmlFor="nieuwe-verzameling" className="block text-base font-semibold">
              Naam van de verzameling
            </label>
            <Input
              id="nieuwe-verzameling"
              value={naam}
              maxLength={60}
              autoFocus
              onChange={(e) => setNaam(e.target.value)}
              placeholder="Bijvoorbeeld: Snel door de week"
              className="mt-1 h-14 text-base"
            />
          </div>
          <Button type="submit" disabled={!naam.trim() || bezig} className="h-14 px-5 text-base">
            Maken
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-14 text-base"
            onClick={() => setMaken(false)}
          >
            Annuleren
          </Button>
        </form>
      ) : null}
      {!lijst.length && !maken ? (
        <p className="mt-2 text-base text-muted-foreground">
          Bundel recepten die samen horen, bijvoorbeeld "Snel door de week". Plan ze daarna in één
          keer in.
        </p>
      ) : null}
      {lijst.length ? (
        <ul className="scroll-rij relative -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 xl:grid-cols-6">
          {lijst.map((v) => {
            const inhoud = (v.collection_recipes ?? []).flatMap(
              (r) => perId.get(r.recipe_id) ?? [],
            );
            const aantal = v.collection_recipes?.length ?? 0;
            return (
              <li key={v.id} className="w-36 shrink-0 lg:w-auto">
                <Link
                  to="/verzamelingen/$id"
                  params={{ id: v.id }}
                  className="group relative block overflow-hidden rounded-2xl shadow-zacht outline-offset-2"
                >
                  <CollectieOmslag
                    titel={v.naam}
                    recepten={inhoud}
                    className="aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <span
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
                    aria-hidden
                  />
                  <span className="absolute inset-x-0 bottom-0 p-3 text-white">
                    <span className="block font-display text-xl font-semibold leading-tight break-words">
                      {v.naam}
                    </span>
                    <span className="block text-[0.9rem] text-white/90">
                      {aantal} {aantal === 1 ? "recept" : "recepten"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
