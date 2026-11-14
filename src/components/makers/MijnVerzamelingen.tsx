/** Rij "Mijn verzamelingen" in Keuken › Recepten (alleen als er verzamelingen zijn). */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { CollectieOmslag } from "@/components/ontdek/CollectieOmslag";
import { haalRecepten, haalVerzamelingenVan } from "@/lib/makers-db";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";

export function MijnVerzamelingen() {
  const { user } = useAuth();
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
  if (!beschikbaar || !lijst.length) return null;
  const perId = new Map(recepten.map((r) => [r.id, r]));

  return (
    <section aria-labelledby="verzamelingen-titel">
      <h2 id="verzamelingen-titel" className="text-sectietitel">
        Mijn verzamelingen
      </h2>
      <ul className="scroll-rij relative -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 xl:grid-cols-6">
        {lijst.map((v) => {
          const inhoud = (v.collection_recipes ?? []).flatMap((r) => perId.get(r.recipe_id) ?? []);
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
    </section>
  );
}
