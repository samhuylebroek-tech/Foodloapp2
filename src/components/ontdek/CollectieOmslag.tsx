/**
 * Omslag voor een collectie of thema: echte receptfoto's waar die er zijn (collage), anders een
 * ontworpen typografische omslag in de kleur van de soort — nooit een generiek pictogram.
 */
import { RecipePhoto } from "@/components/RecipePhoto";
import { kiesOmslag } from "@/lib/omslag";
import { cn } from "@/lib/utils";

export type OmslagRecept = {
  image_url?: string | null;
  title?: string | null;
  category?: string | null;
  tags?: string[] | null;
};

export function CollectieOmslag({
  titel,
  recepten,
  className,
}: {
  titel: string;
  recepten: OmslagRecept[];
  className?: string;
}) {
  const metFoto = recepten.filter(
    (r, i, a) => r.image_url && a.findIndex((x) => x.image_url === r.image_url) === i,
  );
  const vak = (r: OmslagRecept, extra?: string) => (
    <RecipePhoto
      path={r.image_url ?? null}
      alt=""
      recept={r}
      className={cn("size-full object-cover", extra)}
    />
  );

  if (metFoto.length >= 3) {
    return (
      <div className={cn("grid grid-cols-[2fr_1fr] grid-rows-2 gap-0.5 bg-card", className)}>
        <div className="row-span-2 overflow-hidden">{vak(metFoto[0]!)}</div>
        <div className="overflow-hidden">{vak(metFoto[1]!)}</div>
        <div className="overflow-hidden">{vak(metFoto[2]!)}</div>
      </div>
    );
  }
  if (metFoto.length === 2) {
    return (
      <div className={cn("grid grid-cols-2 gap-0.5 bg-card", className)}>
        <div className="overflow-hidden">{vak(metFoto[0]!)}</div>
        <div className="overflow-hidden">{vak(metFoto[1]!)}</div>
      </div>
    );
  }
  if (metFoto.length === 1)
    return <div className={cn("overflow-hidden", className)}>{vak(metFoto[0]!)}</div>;

  // Geen foto: warme omslag van de soort met een grote, rustige beginletter.
  const { stijl } = kiesOmslag(recepten[0] ?? { title: titel });
  return (
    <div
      className={cn("omslag relative overflow-hidden", `omslag-${stijl}`, className)}
      data-omslag={stijl}
      aria-hidden
    >
      <span className="absolute -left-1 -top-4 font-display text-[7.5rem] font-semibold leading-none text-white/35">
        {titel.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
