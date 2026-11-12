import { useEffect, useState } from "react";
import {
  Beef,
  CakeSlice,
  Carrot,
  Cookie,
  Croissant,
  CupSoda,
  Fish,
  Salad,
  Soup,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useSignedUrl } from "@/lib/photos";
import { kiesOmslag, type OmslagIcoon } from "@/lib/omslag";
import { cn } from "@/lib/utils";

const ICONEN: Record<OmslagIcoon, LucideIcon> = {
  beef: Beef,
  fish: Fish,
  carrot: Carrot,
  soup: Soup,
  salad: Salad,
  cake: CakeSlice,
  croissant: Croissant,
  cup: CupSoda,
  cookie: Cookie,
  utensils: UtensilsCrossed,
};

/** Eerste letter van de naam, zonder lidwoord ("De gouden soep" → "G"). */
export function beginletter(titel: string | null | undefined): string {
  const woorden = (titel ?? "").trim().split(/\s+/).filter((w) => /\p{L}/u.test(w));
  const kern =
    woorden.length > 1 && /^(de|het|een|'t)$/i.test(woorden[0]!) ? woorden[1] : woorden[0];
  return (kern?.match(/\p{L}/u)?.[0] ?? "").toLocaleUpperCase("nl-BE");
}

/**
 * Receptfoto, of — zonder (werkende) foto — een warme omslag in de kleur
 * van het soort gerecht. Geef `recept` mee voor de juiste omslag.
 */
export function RecipePhoto({
  path,
  alt,
  className,
  recept,
  icoonClassName,
  opschrift = false,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  recept?: { title?: string | null; category?: string | null; tags?: string[] | null };
  icoonClassName?: string;
  /**
   * Grote omslag (receptkop, kaarten in Ontdek): de beginletter van het gerecht in het
   * merklettertype, met het pictogram van de soort klein in de hoek. Zo is elke omslag eigen
   * en herkenbaar, zonder een foto die niet bij het gerecht hoort (review 2026-11-12, punt 2).
   */
  opschrift?: boolean;
}) {
  const url = useSignedUrl(path);
  // Externe foto's (bv. van sociale media) kunnen vervallen of geweigerd worden;
  // dan tonen we dezelfde rustige omslag in plaats van een gebroken beeld.
  const [mislukt, setMislukt] = useState(false);
  useEffect(() => setMislukt(false), [url]);

  if (!url || mislukt) {
    const { stijl, icoon } = kiesOmslag(recept ?? { title: alt });
    const Icoon = ICONEN[icoon];
    const letter = beginletter(recept?.title ?? alt);
    if (opschrift && letter) {
      return (
        <div
          className={cn("omslag @container relative overflow-hidden", `omslag-${stijl}`, className)}
          data-omslag={stijl}
        >
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center font-display text-[34cqw] font-semibold leading-none text-white/90 drop-shadow-[0_2px_12px_oklch(0_0_0/0.18)]"
          >
            {letter}
          </span>
          <span
            aria-hidden
            className="absolute bottom-[6%] left-[5%] flex size-[max(2rem,14cqw)] max-h-14 max-w-14 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm"
          >
            <Icoon className="size-[55%] text-white" strokeWidth={1.75} />
          </span>
          {alt ? <span className="sr-only">{alt}</span> : null}
        </div>
      );
    }
    return (
      <div
        className={cn("omslag flex items-center justify-center", `omslag-${stijl}`, className)}
        data-omslag={stijl}
      >
        <Icoon
          className={cn(
            "size-[38%] max-h-24 max-w-24 text-white/85 drop-shadow-sm",
            icoonClassName,
          )}
          strokeWidth={1.5}
          aria-hidden
        />
        {alt ? <span className="sr-only">{alt}</span> : null}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setMislukt(true)}
      className={cn("object-cover", className)}
    />
  );
}
