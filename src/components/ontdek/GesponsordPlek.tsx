/**
 * De ene, vaste gesponsorde plek in Ontdek (partnerportaal, voorstel 0011).
 * - Altijd gelabeld: "Gesponsord" en "In samenwerking met <partner>".
 * - Eigen sectie, nooit tussen persoonlijke voorstellen of ideeën gemengd. Max 1 item.
 * - Dezelfde allergie- en dieetregel als voorstellen: past het niet, dan geen plek.
 * - Toont niets zolang de module ontbreekt of er geen goedgekeurde, lopende campagne is.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { leesKennismaking } from "@/lib/kennismaking";
import { useModuleBeschikbaar } from "@/lib/module-beschikbaar";
import { gesponsordLabel, kiesGesponsordePlek, magGesponsordTonen } from "@/lib/partners";
import { haalGesponsordeInhoud, haalLopendeCampagnes } from "@/lib/partners-db";
import { RecipePhoto } from "@/components/RecipePhoto";

function vandaag() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function GesponsordPlek() {
  const { beschikbaar } = useModuleBeschikbaar("campagnes");
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["gesponsorde-plek", vandaag()],
    enabled: beschikbaar && !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { campagnes, items } = await haalLopendeCampagnes();
      const item = kiesGesponsordePlek(campagnes, items, vandaag());
      if (!item) return null;
      const campagne = campagnes.find((c) => c.id === item.campagne_id)!;
      return haalGesponsordeInhoud(item, campagne);
    },
  });
  if (!beschikbaar || !data) return null;

  const kennis = leesKennismaking(user?.id);
  if (
    data.recept &&
    !magGesponsordTonen(data.recept, { allergieen: kennis.allergieen, dieet: kennis.dieet })
  ) {
    return null;
  }
  // Een product heeft geen ingrediëntenlijst om te controleren: bij allergieën geen plek.
  if (!data.recept && kennis.allergieen.length) return null;
  const { label, partner } = gesponsordLabel(data.item.label_tekst, data.partner.naam);

  return (
    <section aria-labelledby="gesponsord-titel" className="space-y-2">
      <h2 id="gesponsord-titel" className="sr-only">
        Gesponsord
      </h2>
      <div className="paneel overflow-hidden border-2 border-amber-300 dark:border-amber-500/50">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-amber-50 px-4 py-2 text-[0.95rem] text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          <span className="rounded-full bg-amber-200 px-2.5 py-0.5 font-bold dark:bg-amber-800">
            {label}
          </span>
          <span className="font-semibold">{partner}</span>
        </p>
        {data.recept ? (
          <Link
            to="/recepten/$id"
            params={{ id: data.recept.id }}
            className="flex items-center gap-4 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RecipePhoto
              path={data.recept.image_url}
              alt=""
              recept={{ title: data.recept.title, category: data.recept.category }}
              className="aspect-square w-24 shrink-0 rounded-xl"
            />
            <span className="min-w-0">
              <span className="block text-kaarttitel break-words">{data.recept.title}</span>
              <span className="block text-[0.95rem] text-muted-foreground">
                Betaalde plek. Je allergieën en dieet zijn gecontroleerd zoals bij elk voorstel.
              </span>
            </span>
          </Link>
        ) : (
          <div className="p-4">
            <p className="text-kaarttitel break-words">{data.item.product_naam}</p>
            <p className="text-[0.95rem] text-muted-foreground">Betaalde plek voor een product.</p>
          </div>
        )}
      </div>
    </section>
  );
}
